import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertFastifyTree,
  bindArchive,
  command,
  fixtureEnv,
  subject,
  selectCells,
  verifyArchive,
  digest,
} from './nest-angular-ssr-locked-support.mjs';

const environment = {
  name: 'consumer',
  dependencies: { fastify: '5.12.8' },
  devDependencies: {},
};
const frozen = {
  lockfileVersion: 3,
  packages: {
    '': structuredClone(environment),
    'node_modules/fastify': {
      version: '5.12.8',
      integrity: 'third-party-integrity',
    },
  },
};
const manifest = {
  name: subject,
  version: '0.3.2',
  peerDependencies: { fastify: '^5.0.0' },
};

test('release-line selection keeps maintenance and feature consumers distinct', () => {
  const matrix = {
    old: { nest: '11.1.29' },
    current: { nest: '11.2.10' },
    feature: { nest: '12.5.0' },
    historical: { nest: '12.5.0', historical: true },
  };
  assert.deepEqual(selectCells(matrix, 'nest11'), ['old', 'current']);
  assert.deepEqual(selectCells(matrix, 'nest12'), ['feature']);
  assert.deepEqual(selectCells(matrix, 'all'), ['old', 'current', 'feature']);
  assert.deepEqual(selectCells(matrix, 'historical'), ['historical']);
  assert.deepEqual(selectCells(matrix, 'old'), ['old']);
  assert.throws(() => selectCells(matrix, 'nest13'), /Unknown cell/);
});

test('external maintenance archives require the exact approved bytes', () => {
  const bytes = Buffer.from('maintenance archive');
  verifyArchive(bytes, digest(bytes));
  assert.throws(() => verifyArchive(bytes), /requires --archive-sha256/);
  assert.throws(
    () => verifyArchive(bytes, digest(Buffer.from('other'))),
    /SHA256 mismatch/,
  );
});

test('binding retains all third-party resolutions and the real archive peer contract', () => {
  const { pkg, lock } = bindArchive(
    environment,
    frozen,
    manifest,
    Buffer.from('archive'),
  );
  assert.equal(pkg.dependencies[subject], 'file:./candidate.tgz');
  assert.deepEqual(
    lock.packages['node_modules/fastify'],
    frozen.packages['node_modules/fastify'],
  );
  assert.deepEqual(
    lock.packages[`node_modules/${subject}`].peerDependencies,
    manifest.peerDependencies,
  );
  assert.notEqual(
    bindArchive(environment, frozen, manifest, Buffer.from('different')).lock
      .packages[`node_modules/${subject}`].integrity,
    lock.packages[`node_modules/${subject}`].integrity,
  );
  assert.equal(frozen.packages[`node_modules/${subject}`], undefined);
});

test('new package dependencies and stale environment pins cannot silently resolve', () => {
  assert.throws(
    () =>
      bindArchive(
        environment,
        frozen,
        { ...manifest, dependencies: { missing: '^1' } },
        Buffer.from('archive'),
      ),
    /Freeze missing/,
  );
  assert.throws(() =>
    bindArchive(
      { ...environment, dependencies: { fastify: '5.12.9' } },
      frozen,
      manifest,
      Buffer.from('archive'),
    ),
  );
});

test('old-floor validation rejects a vulnerable nested Fastify even when root is patched', () => {
  assertFastifyTree(frozen);
  const nested = structuredClone(frozen);
  nested.packages[
    'node_modules/@nestjs/platform-fastify/node_modules/fastify'
  ] = { version: '5.11.0' };
  assert.throws(() => assertFastifyTree(nested), /Unpatched Fastify/);
});

test('peer-bypass and source-alias environment cannot leak into consumer commands', () => {
  const previous = process.env.NODE_OPTIONS;
  const previousForce = process.env.NPM_CONFIG_FORCE;
  try {
    process.env.NODE_OPTIONS = '--conditions=@anarchitecture-community/source';
    process.env.NPM_CONFIG_FORCE = 'true';
    const env = fixtureEnv();
    assert.equal(env.NODE_OPTIONS, undefined);
    assert.equal(env.NPM_CONFIG_FORCE, undefined);
    assert.equal(env.npm_config_force, 'false');
    assert.equal(env.npm_config_legacy_peer_deps, 'false');
  } finally {
    if (previous === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = previous;
    if (previousForce === undefined) delete process.env.NPM_CONFIG_FORCE;
    else process.env.NPM_CONFIG_FORCE = previousForce;
  }
});

test(
  'a hung build is bounded, its log survives, and its child process is reaped',
  { timeout: 10_000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'ssr-command-test-'));
    try {
      const log = join(root, 'command.log');
      await writeFile(
        join(root, 'hang.mjs'),
        "console.log('CHILD_PID=' + process.pid); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);\n",
      );
      await assert.rejects(
        command(process.execPath, ['hang.mjs'], root, { timeoutMs: 200, log }),
        /timed out/,
      );
      const pid = Number(
        (await readFile(log, 'utf8')).match(/CHILD_PID=(\d+)/)?.[1],
      );
      assert.ok(pid > 0);
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

test('spawn errors fail promptly rather than waiting for the command deadline', async () => {
  await assert.rejects(
    command('/nonexistent/ssr-command', [], tmpdir(), { timeoutMs: 1000 }),
    /ENOENT/,
  );
});

test(
  'interruption preserves a nonzero signal status and reaps the active command',
  { timeout: 10_000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'ssr-interrupt-test-'));
    const previousExit = process.exitCode;
    let timer;
    try {
      const log = join(root, 'command.log');
      await writeFile(
        join(root, 'wait.mjs'),
        "console.log('CHILD_PID=' + process.pid); setInterval(() => {}, 1000);\n",
      );
      timer = setTimeout(() => process.emit('SIGTERM'), 300);
      await assert.rejects(
        command(process.execPath, ['wait.mjs'], root, { log, timeoutMs: 5000 }),
        /interrupted by SIGTERM/,
      );
      assert.equal(process.exitCode, 143);
      const pid = Number(
        (await readFile(log, 'utf8')).match(/CHILD_PID=(\d+)/)?.[1],
      );
      assert.ok(pid > 0);
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    } finally {
      clearTimeout(timer);
      process.exitCode = previousExit;
      await rm(root, { recursive: true, force: true });
    }
  },
);
