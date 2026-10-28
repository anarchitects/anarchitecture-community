import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { preparePortable } from './portable-consumer.mjs';
import { preparePackedSsr } from './packed-ssr.mjs';
import { prepareReadmeSsr } from './readme-ssr.mjs';
import { commandRunner } from './packed-process.mjs';
import {
  pathsFor,
  platformIdentity,
  sha256,
  sourceFingerprint,
} from './packed-artifacts.mjs';

const workspace = resolve(import.meta.dirname, '../../../..');
const project = resolve(import.meta.dirname, '..');
const matrix = JSON.parse(
  await readFile(
    new URL('./compatibility-matrix.json', import.meta.url),
    'utf8',
  ),
);
const selected = process.argv[2] ?? 'all';
const mode = process.argv[3] ?? 'csr';
assert(['csr', 'ssr'].includes(mode), `Unknown consumer mode: ${mode}`);
const runId = process.argv[4];
assert.equal(
  runId,
  process.env.EDITORJS_PACKED_RUN_ID,
  'Preparation requires the invocation run ID',
);
const names = selected === 'all' ? Object.keys(matrix) : [selected];
assert(
  names.every((name) => Object.hasOwn(matrix, name)),
  `Unknown compatibility cell: ${selected}`,
);
const scratch = await realpath(
  await mkdtemp(join(tmpdir(), 'editorjs-packed-')),
);
const cache = join(scratch, 'npm-cache');
let runner = commandRunner({ cache });
const run = (...args) => runner.run(...args);

try {
  const archives = {};
  for (const [name, directory] of [
    ['@anarchitects/editorjs-core', 'packages/editorjs/core'],
    ['@anarchitects/editorjs-tool-header', 'packages/editorjs/tool-header'],
    ['@anarchitects/editorjs-tool-list', 'packages/editorjs/tool-list'],
    ['@anarchitects/editorjs-tool-quote', 'packages/editorjs/tool-quote'],
    [
      '@anarchitects/editorjs-tool-paragraph',
      'packages/editorjs/tool-paragraph',
    ],
    ['@anarchitects/editorjs-angular', 'dist/packages/editorjs/angular'],
  ]) {
    const output = await run(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch],
      join(workspace, directory),
      true,
    );
    archives[name] = join(scratch, JSON.parse(output)[0].filename);
  }
  for (const name of names) await validate(name, matrix[name], archives);
} finally {
  runner.dispose();
  await rm(scratch, { recursive: true, force: true });
}

async function validate(name, versions, archives) {
  const root = join(scratch, name);
  const { input } = pathsFor(workspace, runId, mode, name);
  await mkdir(input, { recursive: true });
  const report = join(input, 'evidence');
  await mkdir(report); // Exclusive preparation ownership for this invocation.
  await mkdir(root);
  runner.dispose();
  runner = commandRunner({ cache, report });
  const started = Date.now();
  console.log(`Packed preparation evidence: ${report}`);
  const artifacts = {};
  for (const [packageName, archive] of Object.entries(archives)) {
    await cp(archive, join(report, basename(archive)));
    artifacts[packageName] = {
      archive: basename(archive),
      sha256: createHash('sha256')
        .update(await readFile(archive))
        .digest('hex'),
    };
  }
  await json(join(report, 'artifacts.json'), artifacts);
  await mkdir(join(root, 'archives'));
  for (const archive of Object.values(archives))
    await cp(archive, join(root, 'archives', basename(archive)));
  const dependencies = {
    ...Object.fromEntries(
      Object.entries(archives).map(([name, archive]) => [
        name,
        `file:archives/${basename(archive)}`,
      ]),
    ),
    '@editorjs/editorjs': versions.editorjs,
    rxjs: '7.8.2',
    tslib: '2.8.1',
  };
  for (const packageName of ['core', 'common', 'compiler', 'platform-browser'])
    dependencies[`@angular/${packageName}`] = versions.angular;
  if (mode === 'ssr')
    for (const packageName of ['router', 'platform-server', 'ssr'])
      dependencies[`@angular/${packageName}`] = versions.angular;
  await json(join(root, 'package.json'), {
    name: 'editorjs-packed-consumer',
    version: '0.0.0',
    private: true,
    type: 'module',
    dependencies,
    devDependencies: {
      '@angular/build': versions.angular,
      '@angular/cli': versions.angular,
      '@angular/compiler-cli': versions.angular,
      typescript: versions.typescript,
      vitest: '4.0.18',
      jsdom: '22.1.0',
      node: versions.node,
      ...(mode === 'ssr' ? { '@types/node': '20.19.9' } : {}),
    },
  });
  console.log(`\nValidating ${name}`, versions);
  try {
    // No symlinks to peers, source conditions, workspace aliases or Nx in this app.
    await run('npm', ['install', '--no-audit', '--no-fund'], root);
    const node = join(root, 'node_modules/node/bin/node');
    const actualNode = (await run(node, ['--version'], root, true)).trim();
    assert.equal(actualNode, `v${versions.node}`);
    await assertInstalled(root, dependencies);
    const installed = JSON.parse(
      await readFile(join(root, 'package.json'), 'utf8'),
    );
    await assertInstalled(root, installed.devDependencies);
    await cp(
      join(root, 'package-lock.json'),
      join(report, 'root-only-package-lock.json'),
    );
    await assertDocumentation(root);
    await cp(
      join(workspace, 'apps/editorjs/angular-host/src'),
      join(root, 'src'),
      { recursive: true },
    );
    await cp(
      join(workspace, 'apps/editorjs/angular-host/public'),
      join(root, 'public'),
      { recursive: true },
    );
    await cp(
      new URL('./serve-packed.mjs', import.meta.url),
      join(root, 'server.mjs'),
    );
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'preserve',
        moduleResolution: 'bundler',
        lib: ['ES2022', 'DOM'],
        types: [],
        strict: true,
        skipLibCheck: false,
        experimentalDecorators: true,
        outDir: './out-tsc',
        rootDir: '.',
      },
      angularCompilerOptions: {
        strictTemplates: true,
        strictInjectionParameters: true,
      },
      include: ['src/**/*.ts'],
      // This consumer certifies the existing CSR entry; SSR has its own fixture.
      exclude: [
        'src/ssr/**/*.ts',
        'src/isolation/**/*.ts',
        'src/registry/direct.ts',
        'src/main.server.ts',
        'src/server.ts',
      ],
    };
    await json(join(root, 'tsconfig.json'), tsconfig);
    await json(join(root, 'tsconfig.examples.json'), {
      ...tsconfig,
      include: ['examples/**/*.ts'],
    });
    await json(join(root, 'angular.json'), {
      version: 1,
      cli: { analytics: false, cache: { enabled: false } },
      projects: {
        consumer: {
          projectType: 'application',
          root: '',
          sourceRoot: 'src',
          architect: {
            build: {
              builder: '@angular/build:application',
              options: {
                browser: 'src/main.ts',
                index: 'src/index.html',
                tsConfig: 'tsconfig.json',
                outputPath: 'dist',
                styles: ['src/styles.css'],
                assets: [{ glob: '**/*', input: 'public' }],
              },
            },
          },
        },
      },
    });
    const compilerRoot = join(root, 'node_modules/@angular/compiler-cli');
    const compilerManifest = JSON.parse(
      await readFile(join(compilerRoot, 'package.json'), 'utf8'),
    );
    const compiler = resolve(compilerRoot, compilerManifest.bin.ngc);
    // Certify the optional peer boundary before installing Forms in this cell.
    await json(join(root, 'tsconfig.root.json'), {
      ...tsconfig,
      include: [],
      files: [
        'examples/consumer.ts',
        'src/registry/editor.ts',
        'examples/paragraph-app.ts',
        'examples/header-app.ts',
        'examples/list-app.ts',
        'examples/quote-app.ts',
      ],
    });
    await assertBoundaries(root, node, false);
    await run(node, [compiler, '-p', 'tsconfig.root.json'], root);
    console.log(`Root declarations/imports without Forms passed: ${name}`);
    if (mode === 'csr')
      await preparePortable({
        root: join(scratch, `${name}-portable`),
        destination: join(root, 'portable.tar.gz'),
        archive: archives['@anarchitects/editorjs-core'],
        paragraphArchive: archives['@anarchitects/editorjs-tool-paragraph'],
        headerArchive: archives['@anarchitects/editorjs-tool-header'],
        listArchive: archives['@anarchitects/editorjs-tool-list'],
        quoteArchive: archives['@anarchitects/editorjs-tool-quote'],
        node,
        versions,
        workspace,
        report,
        run,
      });

    await run(
      'npm',
      [
        'install',
        '--save-exact',
        '--no-audit',
        '--no-fund',
        `@angular/forms@${versions.angular}`,
      ],
      root,
    );
    dependencies['@angular/forms'] = versions.angular;
    await assertInstalled(root, dependencies);
    await assertBoundaries(root, node, true);
    await run(node, [compiler, '-p', 'tsconfig.examples.json'], root);
    await json(join(report, 'versions.json'), {
      ...versions,
      actualNode,
      forms: versions.angular,
      platform: process.platform,
      arch: process.arch,
      installed: await assertInstalled(root, {
        ...dependencies,
        ...installed.devDependencies,
      }),
    });
    await cp(
      join(root, 'package-lock.json'),
      join(report, 'package-lock.json'),
    );
    await json(join(report, 'package-boundaries.json'), {
      rootWithoutForms: 'passed',
      rootDeclarationsWithoutForms: 'passed',
      formsWithMatchedPeer: 'passed',
      guardedImportsAndPublicExports: 'passed',
      neutralCoreDependencies: 'passed',
      packedReadmeAndExamples: 'passed',
    });
    // Run the identical native Forms contract against each cell's installed APF/peers.
    // This uses jsdom and a fake upstream editor; Forms browser coverage is separate.
    await cp(
      join(workspace, 'packages/editorjs/angular/tests/forms-interop.spec.ts'),
      join(root, 'forms-interop.spec.ts'),
    );
    await writeFile(
      join(root, 'vitest.config.mjs'),
      "export default { test: { include: ['forms-interop.spec.ts'] } };\n",
    );
    if (mode === 'ssr') {
      await preparePackedSsr({
        root: join(root, 'ssr'),
        report,
        workspace,
        tsconfig,
      });
      for (const profile of ['default', 'full']) {
        const readmeRoot = join(root, `readme-${profile}`);
        await mkdir(readmeRoot);
        await prepareReadmeSsr({ root: readmeRoot, report, tsconfig, profile });
      }
    }
    const archive = join(input, 'consumer.tar.gz');
    await run(
      'tar',
      [
        '-czf',
        archive,
        '--exclude=./.angular',
        '--exclude=./out-tsc',
        '-C',
        root,
        '.',
      ],
      root,
    );
    await json(join(input, 'snapshot.json'), {
      version: 1,
      runId,
      mode,
      cell: name,
      versions,
      artifacts,
      platform: platformIdentity(),
      sha256: await sha256(archive),
      sources: await sourceFingerprint(workspace),
    });
    await json(join(report, 'result.json'), {
      status: 'passed',
      mode,
      cell: name,
      durationMs: Date.now() - started,
    });
    console.log(`Packed consumer ${name} passed.`);
  } catch (error) {
    await json(join(report, 'result.json'), {
      status: 'failed',
      mode,
      cell: name,
      durationMs: Date.now() - started,
      error: String(error),
    });
    throw error;
  } finally {
    // Only the disposable tree is removed; reports and dependency locks survive.
    for (const file of ['package.json', 'package-lock.json'])
      await cp(join(root, file), join(report, file)).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    await rm(root, { recursive: true, force: true });
    await json(join(report, 'cleanup.json'), {
      consumerRemoved: true,
      interrupted: runner.interrupted,
    });
    runner.dispose();
  }
}

async function assertInstalled(root, dependencies) {
  const installed = {};
  for (const [packageName, expected] of Object.entries(dependencies)) {
    const packageRoot = join(root, 'node_modules', packageName);
    assert(
      (await realpath(packageRoot)).startsWith(root + sep),
      `Non-isolated dependency: ${packageName}`,
    );
    const manifest = JSON.parse(
      await readFile(join(packageRoot, 'package.json'), 'utf8'),
    );
    if (!packageName.startsWith('@anarchitects/'))
      assert.equal(manifest.version, expected);
    installed[packageName] = {
      version: manifest.version,
      realpath: await realpath(packageRoot),
    };
  }
  return installed;
}

async function assertBoundaries(root, node, withForms) {
  await run(
    node,
    [
      '--input-type=module',
      '--eval',
      `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    // Angular peers can probe optional globals; guard subsequent package imports.
    import '@angular/compiler';
    import '@angular/core';
    import '@angular/common';
    const withForms = ${JSON.stringify(withForms)};
    if (!withForms) {
      assert.throws(() => import.meta.resolve('@angular/forms'), { code: 'ERR_MODULE_NOT_FOUND' });
    }
    for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'EditorJS']) {
      Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('Browser access: ' + name); } });
    }
    const manifest = JSON.parse(readFileSync(new URL(import.meta.resolve('@anarchitects/editorjs-angular/package.json')), 'utf8'));
    const coreManifest = JSON.parse(readFileSync(new URL(import.meta.resolve('@anarchitects/editorjs-core/package.json')), 'utf8'));
    assert.deepEqual(Object.keys(manifest.exports).sort(), ['.', './forms', './package.json']);
    assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['@anarchitects/editorjs-core', 'tslib']);
    assert.deepEqual(manifest.peerDependencies, {
      '@angular/common': '^22.0.0', '@angular/core': '^22.0.0',
      '@angular/forms': '^22.0.0', '@editorjs/editorjs': '^2.31.7',
    });
    assert.deepEqual(manifest.peerDependenciesMeta, { '@angular/forms': { optional: true } });
    assert.deepEqual(Object.keys({ ...coreManifest.dependencies, ...coreManifest.peerDependencies, ...coreManifest.optionalDependencies }), []);
    const core = await import('@anarchitects/editorjs-core');
    const wrapper = await import('@anarchitects/editorjs-angular');
    assert.equal(wrapper.EditorJsOperationError, core.EditorJsOperationError);
    assert.deepEqual(Object.keys(wrapper).sort(), ['EDITOR_JS_LOADER', 'EDITOR_JS_TOOL_REGISTRY', 'EditorJs', 'EditorJsOperationError', 'provideEditorJsLoader', 'provideEditorJsTools']);
    assert.ok(import.meta.resolve('@anarchitects/editorjs-angular').includes('/fesm2022/'));
    assert.ok(import.meta.resolve('@anarchitects/editorjs-core').includes('/dist/'));
    await assert.rejects(import('@anarchitects/editorjs-angular/src/index.ts'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    if (withForms) {
      const forms = await import('@anarchitects/editorjs-angular/forms');
      assert.deepEqual(Object.keys(forms), ['EditorJsControl']);
      assert.ok(import.meta.resolve('@anarchitects/editorjs-angular/forms').includes('/fesm2022/'));
      await assert.rejects(import('@anarchitects/editorjs-angular/forms/src/index.ts'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    }
  `,
    ],
    root,
  );
}

async function assertDocumentation(root) {
  assert.equal(
    await readFile(
      join(root, 'node_modules/@anarchitects/editorjs-core/README.md'),
      'utf8',
    ),
    await readFile(join(workspace, 'packages/editorjs/core/README.md'), 'utf8'),
  );
  const installed = join(root, 'node_modules/@anarchitects/editorjs-angular');
  const readme = await readFile(join(installed, 'README.md'), 'utf8');
  assert.equal(
    readme,
    await readFile(
      join(workspace, 'packages/editorjs/angular/README.md'),
      'utf8',
    ),
  );
  const examples = [
    ...readme.matchAll(
      /(?:<!-- (ssr-)?example-file: ([\w.-]+) -->\s*)?```ts\n([\s\S]*?)```/g,
    ),
  ];
  assert(examples.length >= 4, 'Expected all documented TypeScript examples');
  const directory = join(root, 'examples');
  await mkdir(directory);
  const paragraphReadme = await readFile(
    join(root, 'node_modules/@anarchitects/editorjs-tool-paragraph/README.md'),
    'utf8',
  );
  assert.equal(
    paragraphReadme,
    await readFile(
      join(workspace, 'packages/editorjs/tool-paragraph/README.md'),
      'utf8',
    ),
  );
  const paragraphExamples = [
    ...paragraphReadme.matchAll(
      /<!-- paragraph-(?:angular-)?example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
    ),
  ];
  assert.equal(paragraphExamples.length, 4);
  for (const [, file, code] of paragraphExamples)
    await writeFile(join(directory, file), code);
  const headerReadme = await readFile(
    join(root, 'node_modules/@anarchitects/editorjs-tool-header/README.md'),
    'utf8',
  );
  assert.equal(
    headerReadme,
    await readFile(
      join(workspace, 'packages/editorjs/tool-header/README.md'),
      'utf8',
    ),
  );
  const headerExamples = [
    ...headerReadme.matchAll(
      /<!-- header-(?:angular-)?example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
    ),
  ];
  assert.equal(headerExamples.length, 4);
  for (const [, file, code] of headerExamples)
    await writeFile(join(directory, file), code);
  const listReadme = await readFile(
    join(root, 'node_modules/@anarchitects/editorjs-tool-list/README.md'),
    'utf8',
  );
  assert.equal(
    listReadme,
    await readFile(
      join(workspace, 'packages/editorjs/tool-list/README.md'),
      'utf8',
    ),
  );
  const listExamples = [
    ...listReadme.matchAll(
      /<!-- list-(?:angular-)?example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
    ),
  ];
  assert.equal(listExamples.length, 4);
  for (const [, file, code] of listExamples)
    await writeFile(join(directory, file), code);
  const quoteReadme = await readFile(
    join(root, 'node_modules/@anarchitects/editorjs-tool-quote/README.md'),
    'utf8',
  );
  assert.equal(
    quoteReadme,
    await readFile(
      join(workspace, 'packages/editorjs/tool-quote/README.md'),
      'utf8',
    ),
  );
  const quoteExamples = [
    ...quoteReadme.matchAll(
      /<!-- quote-(?:angular-)?example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
    ),
  ];
  assert.equal(quoteExamples.length, 4);
  for (const [, file, code] of quoteExamples)
    await writeFile(join(directory, file), code);
  for (const [index, match] of examples.entries()) {
    // SSR recipes require host peers absent from the independent CSR consumer.
    if (match[1] && mode !== 'ssr') continue;
    await writeFile(
      join(directory, match[2] ?? `readme-${index}.ts`),
      match[3],
    );
  }
  for (const fixture of [
    'consumer.ts',
    'forms-consumer.ts',
    'callout-tool.ts',
  ]) {
    await cp(
      join(workspace, 'packages/editorjs/angular/tests/fixtures', fixture),
      join(directory, fixture),
    );
  }
}

async function json(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + '\n');
}
