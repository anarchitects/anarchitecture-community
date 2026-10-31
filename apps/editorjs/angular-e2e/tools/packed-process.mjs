import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { finished } from 'node:stream/promises';

/** Each command owns a process group, including servers started by its launcher. */
export function commandRunner({ report, cache, ownerPid }) {
  let sequence = 0;
  let interrupted = false;
  const children = new Set();
  const timings = [];
  const terminate = (child, signal) => {
    if (!child.pid) return;
    try {
      if (process.platform !== 'win32') process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  const interrupt = () => {
    interrupted = true;
    for (const stop of children) stop();
  };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  // Nx launches tasks in separate process groups. Even an abruptly lost outer
  // launcher must not leave a phase or its browser/server descendants running.
  const ownerTimer = ownerPid
    ? setInterval(() => {
        try {
          process.kill(ownerPid, 0);
        } catch (error) {
          if (error.code === 'ESRCH') interrupt();
          else throw error;
        }
      }, 1_000)
    : undefined;
  return {
    get interrupted() {
      return interrupted;
    },
    dispose() {
      clearInterval(ownerTimer);
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', interrupt);
    },
    async run(
      command,
      args,
      cwd,
      capture = false,
      extraEnv = {},
      timeoutMs = 15 * 60_000,
    ) {
      if (interrupted) throw new Error('Packed validation interrupted');
      const id = ++sequence;
      const started = Date.now();
      const log = report
        ? createWriteStream(join(report, `command-${id}.log`))
        : undefined;
      log?.write(JSON.stringify({ command, args, cwd, started }) + '\n');
      let status = 'failed';
      try {
        const output = await new Promise((yes, no) => {
          const child = spawn(command, args, {
            cwd,
            detached: process.platform !== 'win32',
            env: {
              ...process.env,
              NODE_OPTIONS: '',
              NODE_PATH: '',
              npm_config_cache: cache,
              NG_CLI_ANALYTICS: 'false',
              ...extraEnv,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let timedOut = false;
          let spawnError;
          let output = '';
          let killTimer;
          const stop = () => {
            terminate(child, 'SIGTERM');
            killTimer ??= setTimeout(() => terminate(child, 'SIGKILL'), 5_000);
          };
          children.add(stop);
          const timer = setTimeout(() => {
            timedOut = true;
            stop();
          }, timeoutMs);
          child.stdout.on('data', (chunk) => {
            if (capture) output += chunk;
            else process.stdout.write(chunk);
            log?.write(chunk);
          });
          child.stderr.on('data', (chunk) => {
            process.stderr.write(chunk);
            log?.write(chunk);
          });
          child.once('error', (error) => {
            spawnError = error;
          });
          child.once('close', (code) => {
            children.delete(stop);
            clearTimeout(timer);
            clearTimeout(killTimer);
            // A launcher can exit before its descendants. Reap the owned group too.
            if (process.platform !== 'win32') terminate(child, 'SIGKILL');
            log?.end(`\nExit: ${code}\n`);
            if (code === 0 && !interrupted && !timedOut && !spawnError)
              yes(output);
            else
              no(
                spawnError ??
                  new Error(
                    `${command} ${args.join(' ')} exited with ${code}${timedOut ? ' after timeout' : ''}`,
                  ),
              );
          });
        });
        status = 'passed';
        return output;
      } finally {
        // Hashable/restorable evidence requires the final bytes, including Exit.
        if (log) {
          if (!log.writableEnded) log.end();
          await finished(log);
        }
        timings.push({
          id,
          command,
          args,
          started,
          durationMs: Date.now() - started,
          status,
        });
        if (report)
          await writeFile(
            join(report, 'commands.json'),
            JSON.stringify(timings, null, 2) + '\n',
          );
      }
    },
  };
}
