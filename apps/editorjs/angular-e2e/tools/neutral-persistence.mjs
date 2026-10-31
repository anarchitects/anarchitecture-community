import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { sha256 } from './packed-artifacts.mjs';

const fixtures = [
  'persistence-consumer.mjs',
  'migration-consumer.mjs',
  'service-consumer.mjs',
];
const modes = ['NodeNext', 'Bundler'];

/** Fresh, framework-free installation; only its immutable archive enters the atom. */
export async function prepareNeutralPersistence({
  root,
  destination,
  archive,
  versions,
  workspace,
  report,
  run,
}) {
  await mkdir(root);
  await cp(archive, join(root, basename(archive)));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        '@anarchitects/editorjs-core': `file:${basename(archive)}`,
      },
      devDependencies: {
        typescript: versions.typescript,
        // The reference atom also exercises core's independent minimum runtime.
        ...(versions.angular === '22.1.4' ? { node: '22.12.0' } : {}),
      },
    }),
  );
  await run('npm', ['install', '--no-audit', '--no-fund'], root);
  const sources = new Map();
  const guides = {};
  for (const guide of ['persistence.md', 'service.md']) {
    const path = join(root, 'node_modules/@anarchitects/editorjs-core', guide);
    const text = await readFile(path, 'utf8');
    assert.equal(
      text,
      await readFile(join(workspace, 'packages/editorjs/core', guide), 'utf8'),
    );
    guides[guide] = await sha256(path);
    for (const [, file, code] of text.matchAll(
      /<!-- (?:persistence-example|service-neutral)-file: ([\w.-]+) -->\s*```(?:ts|js)\n([\s\S]*?)```/g,
    )) {
      assert(!sources.has(file), `Duplicate archived source: ${file}`);
      sources.set(file, code);
    }
  }
  assert.deepEqual(
    [...sources.keys()],
    [
      'persistence.ts',
      'memory-store.ts',
      'main.mjs',
      'evolution.ts',
      'migration-fixtures.ts',
      'migrate.mjs',
      'notebook-service.ts',
      'service-main.mjs',
    ],
  );
  for (const mode of modes) {
    const directory = join(root, mode);
    await mkdir(directory);
    for (const [file, code] of sources)
      await writeFile(join(directory, file), code);
    for (const file of fixtures)
      await cp(
        join(workspace, 'packages/editorjs/core/tests/fixtures', file),
        join(directory, file),
      );
    await writeFile(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: mode === 'NodeNext' ? mode : 'ESNext',
          moduleResolution: mode,
          lib: ['ES2022'],
          types: [],
          strict: true,
          skipLibCheck: false,
          outDir: 'compiled',
        },
        files: [...sources.keys()].filter((file) => file.endsWith('.ts')),
      }),
    );
  }
  await writeFile(
    join(root, 'sources.json'),
    JSON.stringify({ guides, archiveSha256: await sha256(archive) }),
  );
  await cp(
    join(root, 'package-lock.json'),
    join(report, 'neutral-persistence-package-lock.json'),
  );
  await run('tar', ['-czf', destination, '-C', root, '.'], root);
}

/** Execute the shipped recipes and existing preservation tests in both declaration modes. */
export async function validateNeutralPersistence({ root, node, report, run }) {
  const packagePath = join(
    root,
    'node_modules/@anarchitects/editorjs-core/package.json',
  );
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.deepEqual(manifest.dependencies ?? {}, {});
  const installed = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  );
  const runtimes = [node];
  if (installed.devDependencies.node)
    runtimes.push(join(root, 'node_modules/node/bin/node'));
  const results = [];
  for (const mode of modes) {
    const directory = join(root, mode);
    await run(
      node,
      ['../node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'],
      directory,
    );
    for (const runtime of runtimes) {
      const version = (await run(runtime, ['--version'], root, true)).trim();
      if (runtime !== node) assert.equal(version, 'v22.12.0');
      for (const file of ['main.mjs', 'migrate.mjs', 'service-main.mjs'])
        await run(runtime, [file], directory);
      // These existing suites assert absent Angular/Forms/Nest/Nx/Editor.js and
      // trap browser-global reads before importing the actual compiled recipes.
      const output = await run(
        runtime,
        ['--test', '--test-reporter=tap', ...fixtures],
        directory,
        true,
      );
      const tests = Number(output.match(/# tests (\d+)/)?.[1]);
      assert(tests > 0, 'Missing neutral behavior checks');
      assert.match(output, /# fail 0\b/);
      results.push({ mode, node: version, tests, status: 'passed' });
    }
  }
  await cp(
    join(root, 'package-lock.json'),
    join(report, 'neutral-persistence-package-lock.json'),
  );
  await writeFile(
    join(report, 'neutral-persistence.json'),
    JSON.stringify(
      {
        status: 'passed',
        core: manifest.version,
        typescript: JSON.parse(
          await readFile(
            join(root, 'node_modules/typescript/package.json'),
            'utf8',
          ),
        ).version,
        ...JSON.parse(await readFile(join(root, 'sources.json'), 'utf8')),
        lockSha256: await sha256(join(root, 'package-lock.json')),
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
