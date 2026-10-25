import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

const attemptUrl = new URL(
  './nest-angular-ssr-consumer-attempt.mjs',
  import.meta.url,
).href;
// Execute the production attempt in a separate runner: resolving its Promise
// alone would miss the original regression where inherited pipes prevent exit.
const runnerSource = `
  import { runFixtureAttempt } from ${JSON.stringify(attemptUrl)};
  try {
    const result = await runFixtureAttempt('test-consumer', {
      appDir: process.env.APP_DIR, port: Number(process.env.PORT),
    }, { mode: 'direct', label: 'direct' }, {
      startupTimeoutMs: 1500, shutdownTimeoutMs: 150,
    });
    console.log(JSON.stringify(result));
    if (result.result === 'unsupported') process.exitCode = 1;
  } catch (error) {
    console.error(error);
    process.exitCode ||= 1;
  }
`;
const serverSource = `
  const { appendFileSync, writeFileSync } = require('node:fs');
  const { spawn } = require('node:child_process');
  const { createServer } = require('node:http');
  const scenario = process.env.SCENARIO;
  appendFileSync('pids', process.pid + '\\n');
  console.log('fixture output');
  console.error('fixture diagnostic');
  if (scenario === 'exit') process.exit(7);
  if (scenario === 'signal-exit') process.kill(process.pid, 'SIGTERM');
  if (scenario === 'ignore-term') process.on('SIGTERM', () => {});
  if (scenario === 'descendant' || scenario === 'leader-exit') {
    const descendant = spawn(process.execPath, ['-e',
      "process.on('SIGTERM', () => {}); console.log('descendant ready'); setInterval(() => {}, 1000);"
    ], { stdio: ['ignore', 'pipe', 'inherit'] });
    appendFileSync('pids', descendant.pid + '\\n');
    descendant.stdout.once('data', () => {
      // Prove the signal handler is installed; stderr holds the runner's pipe.
      writeFileSync('descendant-ready', 'ready');
      if (scenario === 'leader-exit') process.exit(8);
    });
  }
  if (scenario === 'no-listen' || scenario === 'leader-exit') {
    setInterval(() => {}, 1000);
  } else {
    createServer((request, response) => {
      if (scenario === 'hang-startup') return;
      if (request.url === '/main.js') {
        writeFileSync('asserting', 'ready');
        if (scenario === 'hang-assertion') return;
        if (scenario === 'descendant' && !require('node:fs').existsSync('descendant-ready')) {
          const timer = setInterval(() => {
            if (require('node:fs').existsSync('descendant-ready')) {
              clearInterval(timer); response.end('test-consumer');
            }
          }, 10);
          return;
        }
        response.end(scenario === 'assertion' ? 'wrong asset' : 'test-consumer');
      } else response.end(request.url === '/api/health' ? 'ok' : 'Fixture');
    }).listen(Number(process.env.PORT), '127.0.0.1');
  }
`;

async function waitUntil(predicate, message, timeout = 5_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(25);
  }
  assert.fail(message);
}

async function isRunning(pid) {
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
  // An orphan killed on Linux can briefly remain a zombie awaiting init/reaping.
  if (process.platform === 'linux') {
    try {
      if (/\) Z /.test(await readFile(`/proc/${pid}/stat`, 'utf8')))
        return false;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }
  return true;
}

for (const [scenario, expectedCode, expectedOutput, interrupt] of [
  ['success', 0, /"result":"direct"/],
  ['assertion', 1, /Static asset assertion failed/],
  ['exit', 1, /code 7/],
  ['signal-exit', 1, /SIGTERM/],
  ['no-listen', 1, /server did not start in time/],
  ['hang-startup', 1, /server did not start in time/],
  ['ignore-term', 0, /"result":"direct"/],
  ['descendant', 0, /"result":"direct"/],
  ['leader-exit', 1, /code 8/],
  ['spawn-error', 1, /ENOENT/],
  ['no-listen', 130, /SIGINT/, 'SIGINT'],
  ['hang-assertion', 143, /SIGTERM/, 'SIGTERM'],
]) {
  test(
    `${scenario}${interrupt ? ` interrupted by ${interrupt}` : ''} closes runner, server and pipes`,
    {
      timeout: 15_000,
      skip:
        process.platform === 'win32'
          ? 'POSIX consumer CI runs on Ubuntu and macOS'
          : false,
    },
    async (t) => {
      const appDir = await mkdtemp(join(tmpdir(), 'ssr-lifecycle-'));
      const pids = async () => {
        try {
          return (await readFile(join(appDir, 'pids'), 'utf8'))
            .trim()
            .split('\n')
            .map(Number);
        } catch (error) {
          if (error.code === 'ENOENT') return [];
          throw error;
        }
      };
      t.after(async () => {
        for (const pid of await pids()) {
          try {
            process.kill(pid, 'SIGKILL');
          } catch (error) {
            if (error.code !== 'ESRCH') throw error;
          }
        }
        await rm(appDir, { recursive: true, force: true });
      });
      await mkdir(join(appDir, 'dist'));
      await writeFile(join(appDir, 'dist/main.js'), serverSource);
      const listener = createServer();
      listener.listen(0, '127.0.0.1');
      await once(listener, 'listening');
      const port = listener.address().port;
      await new Promise((resolve) => listener.close(resolve));

      const runner = spawn(
        process.execPath,
        ['--input-type=module', '-e', runnerSource],
        {
          env: {
            ...process.env,
            APP_DIR:
              scenario === 'spawn-error' ? join(appDir, 'missing') : appDir,
            PORT: String(port),
            SCENARIO: scenario,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      t.after(() => {
        runner.kill('SIGKILL');
        runner.stdout.destroy();
        runner.stderr.destroy();
      });
      let output = '';
      runner.stdout.on('data', (chunk) => {
        output += chunk;
      });
      runner.stderr.on('data', (chunk) => {
        output += chunk;
      });
      const closed = once(runner, 'close');
      // Bound the test independently of the implementation's shutdown deadline.
      const watchdog = setTimeout(() => {
        runner.kill('SIGKILL');
        runner.stdout.destroy();
        runner.stderr.destroy();
      }, 10_000);
      t.after(() => clearTimeout(watchdog));
      if (interrupt) {
        await waitUntil(async () => {
          if (scenario === 'no-listen') return (await pids()).length > 0;
          try {
            return await readFile(join(appDir, 'asserting'), 'utf8');
          } catch (error) {
            if (error.code === 'ENOENT') return false;
            throw error;
          }
        }, 'Fixture never reached interruption point');
        runner.kill(interrupt);
      }
      const [code, signal] = await closed;
      assert.equal(signal, null, output);
      assert.equal(code, expectedCode, output);
      assert.match(output, expectedOutput);
      if (scenario === 'success') {
        assert.match(output, /fixture output/);
        assert.match(output, /fixture diagnostic/);
      }
      const ownedPids = await pids();
      assert.equal(
        ownedPids.length,
        scenario === 'spawn-error'
          ? 0
          : ['descendant', 'leader-exit'].includes(scenario)
            ? 2
            : 1,
      );
      await waitUntil(
        async () =>
          (await Promise.all(ownedPids.map(isRunning))).every(
            (running) => !running,
          ),
        `Fixture processes survived runner exit: ${ownedPids}`,
      );
      // Also prove the listening socket is reusable after every outcome.
      const probe = createServer();
      t.after(() => probe.close());
      probe.listen(port, '127.0.0.1');
      await once(probe, 'listening');
    },
  );
}
