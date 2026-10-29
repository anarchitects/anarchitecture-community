/** Uncached coordinator proof: remove real outputs and require byte-identical cache restoration. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathsFor, sha256 } from './packed-artifacts.mjs';
import { targetFor } from './packed-phases.mjs';

const [runId, cache = 'local'] = process.argv.slice(2);
assert(['local', 'remote'].includes(cache));
assert.equal(process.env.EDITORJS_PACKED_RUN_ID, runId);
const workspace = resolve(import.meta.dirname, '../../../..');
const mode = 'csr',
  cell = 'angular22-reference';
const phases = ['build-csr', 'csr-upload'];
const report = join(
  workspace,
  'dist/editorjs-packed-results',
  runId,
  'cache-audit',
);
const scratch = await mkdtemp(join(tmpdir(), 'editorjs-cache-audit-'));
const before = {};
const result = { runId, cache, phases, status: 'failed' };
await mkdir(report, { recursive: true });

async function manifest(directory) {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return Object.fromEntries(
    await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const file = join(entry.parentPath, entry.name);
          return [file.slice(directory.length + 1), await sha256(file)];
        }),
    ),
  );
}

try {
  for (const phase of phases) {
    const { output } = pathsFor(workspace, runId, mode, cell, phase);
    const record = JSON.parse(
      await readFile(join(output, 'result.json'), 'utf8'),
    );
    assert.equal(record.status, 'passed');
    assert.equal(record.runId, runId);
    await cp(output, join(scratch, phase), { recursive: true });
    before[phase] = await manifest(output);
  }
  await writeFile(join(report, 'before.json'), JSON.stringify(before, null, 2));
  for (const phase of phases)
    await rm(pathsFor(workspace, runId, mode, cell, phase).output, {
      recursive: true,
    });
  const start = performance.now();
  let terminal = '';
  const code = await new Promise((resolve, reject) => {
    const child = spawn(
      'yarn',
      [
        'nx',
        'run-many',
        '-p',
        'editorjs-angular-e2e',
        '-t',
        phases.map((phase) => targetFor(mode, cell, phase)).join(','),
        '--parallel=2',
        `--runId=${runId}`,
        '--outputStyle=static',
      ],
      {
        cwd: workspace,
        env: {
          ...process.env,
          NX_DAEMON: 'false',
          NX_CLOUD_DISTRIBUTED_EXECUTION: 'false',
          // Empty, private cache and database: no coordinator-local cache can satisfy this proof.
          ...(cache === 'remote'
            ? {
                NX_CACHE_DIRECTORY: join(scratch, 'cache'),
                NX_WORKSPACE_DATA_DIRECTORY: join(scratch, 'workspace-data'),
              }
            : {}),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (chunk) => {
        terminal += chunk;
        process.stdout.write(chunk);
      });
    child.once('error', reject);
    child.once('close', resolve);
  });
  result.durationMs = performance.now() - start;
  await writeFile(join(report, 'nx.log'), terminal);
  assert.equal(code, 0, 'Cache replay must pass');
  const after = {};
  for (const phase of phases) {
    after[phase] = await manifest(
      pathsFor(workspace, runId, mode, cell, phase).output,
    );
    assert.deepEqual(
      after[phase],
      before[phase],
      `Cache did not restore identical ${phase} evidence`,
    );
    if (cache === 'remote')
      assert(
        terminal
          .split('\n')
          .some(
            (line) =>
              line.includes(targetFor(mode, cell, phase)) &&
              line.includes('[remote cache]'),
          ),
        `Nx did not report a remote cache hit for ${phase}`,
      );
  }
  await writeFile(join(report, 'after.json'), JSON.stringify(after, null, 2));
  result.files = Object.values(before).reduce(
    (count, files) => count + Object.keys(files).length,
    0,
  );
  result.status = 'passed';
} catch (error) {
  result.error = String(error);
  process.exitCode = 1;
} finally {
  // Preserve the original cold evidence even if restoration fails. The audit
  // still fails the job and retains its own diagnostic; it cannot certify a miss.
  for (const phase of Object.keys(before)) {
    const { output } = pathsFor(workspace, runId, mode, cell, phase);
    await rm(output, { recursive: true, force: true });
    await cp(join(scratch, phase), output, { recursive: true });
  }
  await writeFile(
    join(report, 'result.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  await rm(scratch, { recursive: true, force: true });
}
console.log(JSON.stringify(result));
