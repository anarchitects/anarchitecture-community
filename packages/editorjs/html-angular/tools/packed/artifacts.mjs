import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const workspace = resolve(import.meta.dirname, '../../../../..');
export const matrix = JSON.parse(
  readFileSync(new URL('./matrix.json', import.meta.url), 'utf8'),
);
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
export const phases = (cell) =>
  matrix[cell].angular
    ? ['build', 'behavior', 'corpus', 'isolation']
    : ['headless'];
export const target = (cell, phase) => `packed--${cell}--${phase}`;
export function paths(cell, phase) {
  const runId = process.env.EDITORJS_RENDERER_RUN_ID;
  assert(
    /^[a-zA-Z0-9-]{1,80}$/.test(runId ?? ''),
    'Set a unique EDITORJS_RENDERER_RUN_ID',
  );
  assert(Object.hasOwn(matrix, cell), 'Unknown renderer cell');
  if (phase)
    assert(
      ['prepare', ...phases(cell)].includes(phase),
      'Unknown renderer phase',
    );
  return {
    runId,
    input: join(workspace, 'dist/editorjs-renderer-inputs', runId, cell),
    output: join(
      workspace,
      'dist/editorjs-renderer-results',
      runId,
      cell,
      phase ?? '',
    ),
  };
}
export function files(directory, exclude = []) {
  const entries = {};
  function visit(relative = '') {
    for (const name of readdirSync(join(directory, relative)).sort()) {
      const path = relative ? `${relative}/${name}` : name;
      if (exclude.includes(path)) continue;
      const full = join(directory, path);
      if (statSync(full).isDirectory()) visit(path);
      else entries[path] = sha(readFileSync(full));
    }
  }
  visit();
  return entries;
}
export function sourceIdentity() {
  const hashes = {};
  for (const path of [
    'package.json',
    'yarn.lock',
    'nx.json',
    'tsconfig.base.json',
    'tsconfig.json',
    '.github/workflows/ci.yml',
  ])
    hashes[path] = sha(readFileSync(join(workspace, path)));
  for (const name of ['core', 'html', 'html-angular', 'angular']) {
    const root = join(workspace, 'packages/editorjs', name);
    hashes[name] = files(root, [
      'node_modules',
      'dist',
      'out-tsc',
      'coverage',
      'test-output',
    ]);
  }
  return sha(JSON.stringify(hashes));
}
export function snapshot(cell) {
  const { input, runId } = paths(cell);
  const value = read(join(input, 'snapshot.json'));
  assert.equal(value.version, 1);
  assert.equal(value.cell, cell);
  assert.equal(value.runId, runId);
  assert.deepEqual(value.versions, matrix[cell]);
  assert.equal(
    value.sources,
    sourceIdentity(),
    'Sources changed: prepare a fresh renderer snapshot',
  );
  assert.equal(
    value.platform,
    `${process.platform}/${process.arch}/${process.report.getReport().header.glibcVersionRuntime ?? ''}`,
  );
  assert.equal(
    value.archive,
    sha(readFileSync(join(input, 'consumer.tar.gz'))),
    'Corrupt renderer snapshot',
  );
  return value;
}
export function verifyResult(directory, identity, cell, phase) {
  const result = read(join(directory, 'result.json'));
  assert.equal(result.status, 'passed');
  assert.equal(result.identity, identity, 'Stale renderer evidence');
  assert.equal(result.cell, cell);
  assert.equal(result.phase, phase);
  assert(Object.keys(result.files ?? {}).length > 0, 'Empty renderer evidence');
  assert.deepEqual(
    files(directory, ['result.json']),
    result.files,
    'Missing or corrupt renderer evidence',
  );
  return result;
}
