import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Extract the shipped shared sources and Nest composition into the fresh host. */
export async function prepareNestPersistence({ backend, workspace }) {
  const directory = join(backend, 'persistence');
  await mkdir(directory);
  const files = new Map();
  for (const guide of ['persistence.md', 'service.md']) {
    const text = await readFile(
      join(backend, 'node_modules/@anarchitects/editorjs-core', guide),
      'utf8',
    );
    assert.equal(
      text,
      await readFile(join(workspace, 'packages/editorjs/core', guide), 'utf8'),
    );
    for (const [, file, source] of text.matchAll(
      /<!-- (?:persistence-example|service-neutral|service-nest)-file: ([\w.-]+) -->\s*```(?:ts|js|json)\n([\s\S]*?)```/g,
    )) {
      assert(!files.has(file), `Duplicate archived example: ${file}`);
      files.set(file, source);
    }
  }
  for (const file of [
    'persistence.ts',
    'evolution.ts',
    'notebook-service.ts',
    'nest-notebook.ts',
    'nest-main.mjs',
    'tsconfig.nest.json',
  ]) {
    assert(files.has(file), `Missing archived service example: ${file}`);
    await writeFile(join(directory, file), files.get(file));
  }
}

export async function validateNestPersistence({ backend, node, report, run }) {
  const directory = join(backend, 'persistence');
  await run(
    node,
    ['../node_modules/typescript/bin/tsc', '-p', 'tsconfig.nest.json'],
    directory,
  );
  const output = (await run(node, ['nest-main.mjs'], directory, true)).trim();
  assert.equal(
    output,
    'nest: shared save/load, invalid, stale, forbidden and failed-write checks passed',
  );
  const versions = {};
  for (const name of [
    '@anarchitects/editorjs-core',
    '@nestjs/common',
    '@nestjs/core',
    'typescript',
  ]) {
    versions[name] = JSON.parse(
      await readFile(
        join(backend, 'node_modules', name, 'package.json'),
        'utf8',
      ),
    ).version;
  }
  assert.equal(versions['@nestjs/core'], '12.3.2');
  await writeFile(
    join(report, 'nest-persistence.json'),
    JSON.stringify(
      {
        status: 'passed',
        node: (await run(node, ['--version'], directory, true)).trim(),
        versions,
        output,
        sources: ['persistence.md', 'service.md'],
        scope:
          'Standalone application context; no HTTP listener or adapter claim',
      },
      null,
      2,
    ) + '\n',
  );
}
