import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Both packed consumers build the same entry point. Own Node itself, rather
// than npm and its shell; on POSIX also own any descendants in a process group.
export async function runFixtureAttempt(
  name,
  fixture,
  attempt,
  { startupTimeoutMs = 20_000, shutdownTimeoutMs = 2_000 } = {},
) {
  const grouped = process.platform !== 'win32';
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: fixture.appDir,
    env: {
      ...process.env,
      PORT: String(fixture.port),
      NEST_SSR_CONSUMPTION_MODE: attempt.mode,
    },
    detached: grouped,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let spawnError;
  let closed = false;
  // Register immediately: spawn errors and signal exits need not set exitCode.
  child.on('error', (error) => {
    spawnError = error;
  });
  child.once('close', () => {
    closed = true;
  });
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const interruption = new AbortController();
  const handlers = new Map(
    ['SIGINT', 'SIGTERM'].map((signal) => [
      signal,
      () => {
        process.exitCode = signal === 'SIGINT' ? 130 : 143;
        interruption.abort(
          new Error(`Fixture validation interrupted by ${signal}.`),
        );
      },
    ]),
  );
  for (const [signal, handler] of handlers) process.on(signal, handler);

  let outcome;
  try {
    const started = await waitForServer(
      `http://127.0.0.1:${fixture.port}/`,
      child,
      () => spawnError,
      interruption.signal,
      startupTimeoutMs,
    );
    if (!started.ok) {
      outcome = {
        mode: attempt.mode,
        result: 'unsupported',
        summary: `${attempt.label} startup failed: ${started.reason}`,
      };
    } else {
      await assertHttpBehavior(fixture.port, name, interruption.signal);
      outcome = {
        mode: attempt.mode,
        result: attempt.mode === 'direct' ? 'direct' : 'interop',
        summary:
          attempt.mode === 'direct'
            ? 'Direct package consumption worked.'
            : 'Direct consumption failed; dynamic-import interop worked.',
      };
    }
  } finally {
    try {
      await stopServer(child, grouped, () => closed, shutdownTimeoutMs);
    } finally {
      for (const [signal, handler] of handlers) process.off(signal, handler);
    }
  }
  interruption.signal.throwIfAborted();
  return { ...outcome, stdout, stderr };
}

async function waitForServer(url, child, getSpawnError, signal, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const error = getSpawnError();
    if (error) return { ok: false, reason: error.message };
    if (child.exitCode !== null || child.signalCode !== null) {
      return {
        ok: false,
        reason: `process exited with ${child.signalCode ?? `code ${child.exitCode}`}`,
      };
    }
    try {
      const response = await fetch(url, {
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(
            Math.max(1, Math.min(1_000, deadline - Date.now())),
          ),
        ]),
      });
      // Readiness only needs the status; release the body/connection explicitly.
      await response.body?.cancel();
      if (response.ok) return { ok: true };
    } catch {
      signal.throwIfAborted();
    }
    await delay(Math.max(0, Math.min(250, deadline - Date.now())), undefined, {
      signal,
    });
  }
  return { ok: false, reason: 'server did not start in time' };
}

async function assertHttpBehavior(port, fixtureName, signal) {
  for (const [path, expected, description] of [
    ['/main.js', fixtureName, 'Static asset'],
    ['/', 'Fixture', 'SSR route'],
    ['/api/health', 'ok', 'API bypass'],
  ]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
    });
    const body = await response.text();
    if (
      !response.ok ||
      (path === '/api/health' ? body !== expected : !body.includes(expected))
    ) {
      throw new Error(`${description} assertion failed.`);
    }
  }
}

async function stopServer(child, grouped, isClosed, timeoutMs) {
  const send = (signal) => {
    if (!child.pid) return;
    try {
      if (grouped) process.kill(-child.pid, signal);
      else if (child.exitCode === null && child.signalCode === null)
        child.kill(signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  const waitForClose = async () => {
    const deadline = Date.now() + timeoutMs;
    while (!isClosed() && Date.now() < deadline) await delay(25);
  };
  try {
    send('SIGTERM');
    await waitForClose();
    // A leader can exit while descendants keep pipes (or other handles) open.
    // Kill the remaining group even when the leader has already closed.
    send('SIGKILL');
    await waitForClose();
    if (!isClosed())
      throw new Error('Fixture server did not close after SIGKILL.');
  } finally {
    // A shutdown failure must be reported without hanging the validation runner.
    child.stdout.destroy();
    child.stderr.destroy();
    child.unref();
  }
}
