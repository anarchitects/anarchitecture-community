import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { files, verifyResult, phases, matrix } from './artifacts.mjs';
import { assertDisplayInputs } from './browser-checks.mjs';
import { headlessBrowserIdentity } from './browser-identity.mjs';
import { angularRecipes, angularReadmeExamples } from '../readme-examples.mjs';
import {
  headlessRecipes,
  readmeExamples,
} from '../../../html/tools/readme-examples.mjs';

for (const [name, url, required, extract] of [
  [
    'headless',
    '../../../html/README.md',
    headlessRecipes,
    (readme) => readmeExamples(readme, headlessRecipes),
  ],
  ['Angular', '../../README.md', angularRecipes, angularReadmeExamples],
]) {
  test(`${name} recipes reject missing, duplicate, renamed, empty and unmarked sources`, () => {
    const readme = readFileSync(new URL(url, import.meta.url), 'utf8');
    const examples = extract(readme);
    assert.equal(examples.size, required.length);
    for (const file of required) {
      const marker = `<!-- example: ${file} -->`;
      assert.throws(() => extract(readme.replace(marker, '')), /Missing/);
      assert.throws(
        () =>
          extract(readme.replace(marker, '<!-- example: unexpected.ts -->')),
        /Missing or unexpected/,
      );
      const source = examples.get(file);
      assert.throws(
        () => extract(readme.replace(source, '\n')),
        /Empty README recipe/,
      );
      assert.throws(
        () => extract(`${readme}\n${marker}\n\`\`\`ts\n${source}\`\`\``),
        /Duplicate README recipe/,
      );
    }
    // Same count used to allow a duplicated file to silently overwrite another.
    assert.throws(
      () =>
        extract(
          readme.replace(`example: ${required[0]}`, `example: ${required[1]}`),
        ),
      /Duplicate README recipe/,
    );
    assert.throws(
      () => extract(`${readme}\n\`\`\`ts\nexport const missed = true;\n\`\`\``),
      /Unmarked/,
    );
    assert.deepEqual(
      [...extract(readme.replaceAll('\n', '\r\n')).keys()],
      [...examples.keys()],
    );
  });
}

test('browser identity supports shell-only installs and invalidates changed runtime files', () => {
  const root = mkdtempSync(join(tmpdir(), 'renderer-shell-only-'));
  const plan = `Chrome Headless Shell 156.0.8078.4 (playwright chromium-headless-shell v1248)\n  Install location:    ${root}\n\nFFmpeg (playwright ffmpeg v1013)\n  Install location:    /unused-ffmpeg\n`;
  try {
    assert.throws(() => headlessBrowserIdentity(plan), /Empty headless-shell/);
    writeFileSync(join(root, 'chrome-headless-shell'), 'shell binary');
    writeFileSync(join(root, 'icudtl.dat'), 'runtime resource');
    const original = headlessBrowserIdentity(plan);
    assert.equal(original.directory, root);
    assert.deepEqual(
      headlessBrowserIdentity(plan.replaceAll('\n', '\r\n')),
      original,
    );
    for (const file of ['chrome-headless-shell', 'icudtl.dat']) {
      const originalBytes =
        file === 'icudtl.dat' ? 'runtime resource' : 'shell binary';
      writeFileSync(join(root, file), 'changed');
      assert.notEqual(headlessBrowserIdentity(plan).digest, original.digest);
      writeFileSync(join(root, file), originalBytes);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  assert.throws(() => headlessBrowserIdentity(plan), /ENOENT/);
  assert.throws(
    () => headlessBrowserIdentity('unexpected CLI output'),
    /Expected one/,
  );
  assert.throws(() => headlessBrowserIdentity(plan + plan), /Expected one/);
});

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
