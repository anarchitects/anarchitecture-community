import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { files, verifyResult, phases, matrix } from './artifacts.mjs';
import { assertDisplayInputs } from './browser-checks.mjs';

test('completeness rejects missing, corrupt, stale and failed required evidence after replay', () => {
  const root = mkdtempSync(join(tmpdir(), 'renderer-evidence-test-'));
  const result = () =>
    verifyResult(root, 'current', 'angular-reference', 'build');
  const write = (value) =>
    writeFileSync(join(root, 'result.json'), JSON.stringify(value));
  try {
    assert.throws(result, /ENOENT/);
    writeFileSync(join(root, 'artifact.js'), 'verified build');
    const good = {
      status: 'passed',
      identity: 'current',
      cell: 'angular-reference',
      phase: 'build',
      files: files(root),
    };
    write(good);
    result();
    for (const replacement of [
      { status: 'failed' },
      { identity: 'stale' },
      { cell: 'angular-current' },
      { phase: 'behavior' },
      { files: {} },
    ]) {
      write({ ...good, ...replacement });
      assert.throws(result);
    }
    write(good);
    writeFileSync(join(root, 'artifact.js'), 'corrupt cache replay');
    assert.throws(result, /corrupt/);
    rmSync(join(root, 'artifact.js'));
    assert.throws(result, /Missing/);
    writeFileSync(join(root, 'artifact.js'), 'verified build');
    result();
    writeFileSync(join(root, 'unexpected.json'), '{}');
    assert.throws(result, /corrupt/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('display detector recognizes each authoring boundary independently', () => {
  assertDisplayInputs({
    'node_modules/@anarchitects/editorjs-html/dist/index.js': {},
  });
  for (const path of [
    'node_modules/@editorjs/editorjs/dist/editorjs.mjs',
    'node_modules/@editorjs/paragraph/dist/paragraph.mjs',
    'node_modules/@anarchitects/editorjs-angular/fesm2022/library.mjs',
  ])
    assert.throws(() => assertDisplayInputs({ [path]: {} }), /Authoring/);
});
test('required phase inventory keeps all agreed cells and independent Angular outcomes', () => {
  assert.equal(Object.keys(matrix).length, 7);
  assert.equal(Object.keys(matrix).flatMap(phases).length, 16);
});
