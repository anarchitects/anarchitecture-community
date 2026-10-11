import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
import { join, resolve, sep } from 'node:path';

const workspace = resolve(import.meta.dirname, '../../../..');
const project = resolve(import.meta.dirname, '..');
const matrix = JSON.parse(
  await readFile(
    new URL('./compatibility-matrix.json', import.meta.url),
    'utf8',
  ),
);
const selected = process.argv[2] ?? 'all';
const names = selected === 'all' ? Object.keys(matrix) : [selected];
assert(
  names.every((name) => Object.hasOwn(matrix, name)),
  `Unknown compatibility cell: ${selected}`,
);
const scratch = await realpath(
  await mkdtemp(join(tmpdir(), 'editorjs-packed-')),
);
const cache = join(scratch, 'npm-cache');

try {
  const archives = {};
  for (const [name, directory] of [
    ['@anarchitects/editorjs-core', 'packages/editorjs/core'],
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
  await rm(scratch, { recursive: true, force: true });
}

async function validate(name, versions, archives) {
  const root = join(scratch, name);
  const report = join(project, 'test-output/compatibility', name);
  await mkdir(root);
  await rm(report, { recursive: true, force: true });
  await mkdir(report, { recursive: true });
  const dependencies = {
    ...archives,
    '@editorjs/editorjs': versions.editorjs,
    rxjs: '7.8.2',
    tslib: '2.8.1',
  };
  for (const packageName of [
    'core',
    'common',
    'compiler',
    'platform-browser',
    'forms',
  ])
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
      node: versions.node,
    },
  });
  console.log(`\nValidating ${name}`, versions);
  try {
    // No symlinks to peers, source conditions, workspace aliases or Nx in this app.
    await run('npm', ['install', '--no-audit', '--no-fund'], root);
    const node = join(root, 'node_modules/node/bin/node');
    const actualNode = (await run(node, ['--version'], root, true)).trim();
    assert.equal(actualNode, `v${versions.node}`);
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
    }
    await json(join(report, 'versions.json'), {
      ...versions,
      actualNode,
      platform: process.platform,
      arch: process.arch,
    });
    await cp(
      join(root, 'package-lock.json'),
      join(report, 'package-lock.json'),
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
    };
    await json(join(root, 'tsconfig.json'), tsconfig);
    await json(join(root, 'tsconfig.examples.json'), {
      ...tsconfig,
      include: ['examples/**/*.ts'],
    });
    await json(join(root, 'angular.json'), {
      version: 1,
      cli: { analytics: false },
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
    await run(
      node,
      [
        resolve(compilerRoot, compilerManifest.bin.ngc),
        '-p',
        'tsconfig.examples.json',
      ],
      root,
    );
    await run(
      node,
      [
        '--input-type=module',
        '--eval',
        `
      import assert from 'node:assert/strict';
      import '@angular/compiler';
      import '@angular/core';
      import '@angular/common';
      for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'EditorJS']) {
        Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('Browser access: ' + name); } });
      }
      const wrapper = await import('@anarchitects/editorjs-angular');
      const core = await import('@anarchitects/editorjs-core');
      assert.equal(wrapper.EditorJsOperationError, core.EditorJsOperationError);
      assert.deepEqual(Object.keys(wrapper).sort(), ['EDITOR_JS_LOADER', 'EditorJs', 'EditorJsOperationError', 'provideEditorJsLoader']);
      assert.ok(import.meta.resolve('@anarchitects/editorjs-angular').includes('/fesm2022/'));
      assert.ok(import.meta.resolve('@anarchitects/editorjs-core').includes('/dist/'));
      await assert.rejects(import('@anarchitects/editorjs-angular/src/index.ts'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    `,
      ],
      root,
    );
    await run(node, ['node_modules/@angular/cli/bin/ng.js', 'build'], root);
    // Reuse the five real-browser scenarios against the separately installed app.
    await run(
      process.execPath,
      [
        join(workspace, 'node_modules/@playwright/test/cli.js'),
        'test',
        '--config',
        join(project, 'packed.config.mts'),
      ],
      project,
      false,
      {
        EDITORJS_PACKED_ROOT: root,
        EDITORJS_PACKED_NODE: node,
        EDITORJS_PACKED_REPORT: report,
      },
    );
    console.log(`Packed consumer ${name} passed.`);
  } finally {
    // Only the disposable tree is removed; reports and dependency locks survive.
    await rm(root, { recursive: true, force: true });
  }
}

async function assertDocumentation(root) {
  const installed = join(root, 'node_modules/@anarchitects/editorjs-angular');
  const readme = await readFile(join(installed, 'README.md'), 'utf8');
  assert.equal(
    readme,
    await readFile(
      join(workspace, 'packages/editorjs/angular/README.md'),
      'utf8',
    ),
  );
  const examples = [...readme.matchAll(/```ts\n([\s\S]*?)```/g)];
  assert(examples.length >= 4, 'Expected all documented TypeScript examples');
  const directory = join(root, 'examples');
  await mkdir(directory);
  for (const [index, match] of examples.entries())
    await writeFile(join(directory, `readme-${index}.ts`), match[1]);
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

function run(command, args, cwd, capture = false, extraEnv = {}) {
  return new Promise((yes, no) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        NODE_OPTIONS: '',
        NODE_PATH: '',
        npm_config_cache: cache,
        NG_CLI_ANALYTICS: 'false',
        ...extraEnv,
      },
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    });
    let output = '';
    child.stdout?.on('data', (chunk) => {
      output += chunk;
    });
    child.once('error', no);
    child.once('close', (code) =>
      code === 0
        ? yes(output)
        : no(new Error(`${command} ${args.join(' ')} exited with ${code}`)),
    );
  });
}
