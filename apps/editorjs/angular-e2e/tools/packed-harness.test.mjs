import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { commandRunner } from './packed-process.mjs';
import { leasePorts } from './packed-ports.mjs';
import { prepareReadmeSsr } from './readme-ssr.mjs';
import { parallelism, phasesFor, targetFor } from './packed-phases.mjs';
import { createNodesV2 } from './packed-plugin.mjs';
import {
  pathsFor,
  platformIdentity,
  sourceFingerprint,
  readSnapshot,
  sha256,
} from './packed-artifacts.mjs';

const project = resolve(import.meta.dirname, '..');
async function temporary(t) {
  const root = await mkdtemp(join(tmpdir(), 'editorjs-harness-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('distributed graphs contain only cacheable tasks with isolated outputs and no fresh-install dependency', async () => {
  const workspace = resolve(project, '../../..');
  const [[, graph]] = await createNodesV2[1](
    ['apps/editorjs/angular-e2e/project.json'],
    {},
    { workspaceRoot: workspace },
  );
  const { targets } = graph.projects['apps/editorjs/angular-e2e'];
  const visited = new Set();
  const outputs = new Set();
  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    const target = targets[name];
    assert.equal(target.cache, true, `Uncacheable DTE prerequisite: ${name}`);
    assert(
      target.inputs.some((input) =>
        input.runtime?.includes('packed-input-hash'),
      ),
    );
    for (const output of target.outputs) {
      assert(!outputs.has(output));
      outputs.add(output);
    }
    for (const dependency of target.dependsOn) {
      assert.equal(dependency.params, 'forward');
      visit(dependency.target);
    }
  }
  for (const mode of ['csr', 'ssr'])
    for (const cell of [
      'angular22-minimum',
      'angular22-reference',
      'angular22-current',
    ]) {
      for (const phase of phasesFor(mode, cell))
        visit(targetFor(mode, cell, phase));
      assert.equal(targets[targetFor(mode, cell, 'prepare')].cache, false);
    }
  assert.equal(visited.size, 89); // (7 CSR atoms + 22 SSR atoms) × 3 + 2 Nest adapters
  for (const mode of ['csr', 'ssr'])
    for (const cell of [
      'angular22-minimum',
      'angular22-reference',
      'angular22-current',
    ])
      assert.equal(
        phasesFor(mode, cell).filter((phase) =>
          phase.startsWith('nest-upload-'),
        ).length,
        mode === 'csr' && cell === 'angular22-reference' ? 2 : 0,
      );
  for (const value of ['0', '-1', '1.5', 'Infinity', '9', '2 --skip'])
    assert.throws(() => parallelism(value));
});

test('simultaneous port leases remain disjoint after server handoff', async () => {
  const first = await leasePorts(8);
  let second;
  try {
    await first.handoff();
    second = await leasePorts(8);
    assert.equal(new Set([...first.ports, ...second.ports]).size, 16);
    await second.handoff();
  } finally {
    await first.release();
    await second?.release();
  }
});

test('README profiles can prepare concurrently without rewriting the consumer', async (t) => {
  const root = await temporary(t);
  for (const directory of ['src', 'public', 'examples'])
    await mkdir(join(root, directory));
  await writeFile(join(root, 'angular.json'), 'original CSR configuration');
  await writeFile(join(root, 'examples/article.config.ts'), 'original recipe');
  const report = join(root, 'evidence');
  await Promise.all(
    ['default', 'full'].map(async (profile) => {
      const directory = join(root, `readme-${profile}`);
      await mkdir(directory);
      await prepareReadmeSsr({
        root: directory,
        report,
        profile,
        tsconfig: { compilerOptions: {} },
      });
    }),
  );
  assert.equal(
    await readFile(join(root, 'angular.json'), 'utf8'),
    'original CSR configuration',
  );
  for (const profile of ['default', 'full']) {
    assert.match(
      await readFile(join(root, `readme-${profile}/examples/main.ts`), 'utf8'),
      new RegExp(`articleConfig\\(${profile === 'full'}\\)`),
    );
    assert.equal(
      await readFile(
        join(root, `readme-${profile}/examples/article.config.ts`),
        'utf8',
      ),
      'original recipe',
    );
  }
});

test('failed validation evidence survives collection and fails the uncached gate', async (t) => {
  const workspace = resolve(project, '../../..');
  const runId = `harness-${process.pid}-${Date.now()}`;
  const mode = 'csr',
    cell = 'angular22-reference';
  const { input, output } = pathsFor(workspace, runId, mode, cell);
  t.after(async () => {
    await rm(resolve(input, '../../..', runId), {
      recursive: true,
      force: true,
    });
    await rm(resolve(output, '../../..', runId), {
      recursive: true,
      force: true,
    });
  });
  await mkdir(join(input, 'evidence'), { recursive: true });
  // The failing prerequisite is checked before extraction, so bytes need only
  // satisfy the integrity contract; an extraction attempt would fail this test.
  await writeFile(join(input, 'consumer.tar.gz'), 'not extracted');
  const digest = await sha256(join(input, 'consumer.tar.gz'));
  const snapshot = {
    version: 1,
    runId,
    mode,
    cell,
    platform: platformIdentity(),
    sha256: digest,
    sources: await sourceFingerprint(workspace),
  };
  await writeFile(join(input, 'snapshot.json'), JSON.stringify(snapshot));
  await readSnapshot(input, runId, mode, cell);
  await assert.rejects(readSnapshot(input, 'another-run', mode, cell));
  for (const phase of phasesFor(mode, cell)) {
    if (phase === 'csr-editor') continue;
    await mkdir(join(output, phase), { recursive: true });
    await writeFile(
      join(output, phase, 'result.json'),
      JSON.stringify({
        runId,
        mode,
        cell,
        phase,
        snapshot: digest,
        status: phase === 'build-csr' ? 'failed' : 'passed',
        error: 'Build failed',
      }),
    );
  }
  const invoke = (script, args) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [join(import.meta.dirname, script), ...args],
        {
          env: { ...process.env, EDITORJS_PACKED_RUN_ID: runId },
          stdio: 'ignore',
        },
      );
      child.on('error', reject);
      child.on('close', resolve);
    });
  assert.equal(
    await invoke('packed-phase.mjs', [mode, cell, 'csr-editor', runId]),
    1,
  );
  const record = JSON.parse(
    await readFile(join(output, 'csr-editor/result.json'), 'utf8'),
  );
  assert.equal(record.status, 'failed');
  assert.match(record.error, /Prerequisite failed/);
  assert.equal(await invoke('packed-results.mjs', [runId, mode, cell]), 1);
  assert.equal(
    JSON.parse(
      await readFile(
        join(output, 'collect/phases/csr-editor/result.json'),
        'utf8',
      ),
    ).status,
    'failed',
  );
  // Runtime input hashing must not be the only stale-snapshot guard.
  snapshot.sources = 'stale-source-fingerprint';
  await writeFile(join(input, 'snapshot.json'), JSON.stringify(snapshot));
  assert.equal(
    await invoke('packed-phase.mjs', [mode, cell, 'csr-editor', runId]),
    1,
  );
  const stale = JSON.parse(
    await readFile(join(output, 'csr-editor/result.json'), 'utf8'),
  );
  assert.match(stale.error, /Prepare a new snapshot/);
  // Independently test collection, even when every retained phase claims success.
  for (const phase of phasesFor(mode, cell)) {
    const file = join(output, phase, 'result.json');
    const result = JSON.parse(await readFile(file, 'utf8'));
    await writeFile(
      file,
      JSON.stringify({ ...result, status: 'passed', error: undefined }),
    );
  }
  assert.equal(await invoke('packed-results.mjs', [runId, mode, cell]), 1);
  const collected = JSON.parse(
    await readFile(join(output, 'collect/result.json'), 'utf8'),
  );
  assert(
    collected.errors.some((error) => error.includes('Prepare a new snapshot')),
  );
  await writeFile(join(input, 'consumer.tar.gz'), 'changed');
  await assert.rejects(readSnapshot(input, runId, mode, cell), /modified/);
});

test('command failures and spawn errors retain timings and reject', async (t) => {
  const root = await temporary(t);
  const runner = commandRunner({ report: root, cache: join(root, 'cache') });
  t.after(() => runner.dispose());
  await assert.rejects(
    runner.run(process.execPath, ['-e', 'process.exit(3)'], root),
    /exited with 3/,
  );
  await assert.rejects(
    runner.run(join(root, 'missing-command'), [], root),
    /ENOENT/,
  );
  const commands = JSON.parse(
    await readFile(join(root, 'commands.json'), 'utf8'),
  );
  assert.equal(commands.length, 2);
  assert(
    commands.every(
      ({ status, durationMs }) => status === 'failed' && durationMs >= 0,
    ),
  );
});

test('interruption rejects active work and prevents later commands', async (t) => {
  const root = await temporary(t);
  const ready = join(root, 'ready');
  const runner = commandRunner({ report: root, cache: join(root, 'cache') });
  t.after(() => runner.dispose());
  const active = runner.run(
    process.execPath,
    [
      '-e',
      "require('node:fs').writeFileSync(process.argv[1], 'ready'); setInterval(() => {}, 1000)",
      ready,
    ],
    root,
  );
  // Attach the rejection handler before delivering interruption.
  const rejected = assert.rejects(active, /exited with/);
  for (let attempt = 0; ; attempt++) {
    try {
      await readFile(ready);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT' || attempt === 100) throw error;
      await delay(50);
    }
  }
  process.emit('SIGTERM');
  await rejected;
  assert.equal(runner.interrupted, true);
  await assert.rejects(
    runner.run(process.execPath, ['-e', 'process.exit(0)'], root),
    /interrupted/,
  );
});

test(
  'timed out launcher cannot leave its server descendant running',
  { skip: process.platform === 'win32' },
  async (t) => {
    const root = await temporary(t);
    const pidFile = join(root, 'server.pid');
    const runner = commandRunner({ report: root, cache: join(root, 'cache') });
    t.after(() => runner.dispose());
    const program = `
    const { spawn } = require('node:child_process');
    const { writeFileSync } = require('node:fs');
    const server = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: 'ignore' });
    writeFileSync(process.argv[1], String(server.pid));
    setInterval(() => {}, 1000);
  `;
    await assert.rejects(
      runner.run(
        process.execPath,
        ['-e', program, pidFile],
        root,
        false,
        {},
        500,
      ),
      /after timeout/,
    );
    const pid = Number(await readFile(pidFile, 'utf8'));
    let stopped = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        process.kill(pid, 0);
      } catch (error) {
        if (error.code === 'ESRCH') {
          stopped = true;
          break;
        }
        throw error;
      }
      await delay(20);
    }
    assert(stopped, `Descendant ${pid} survived timeout`);
  },
);
