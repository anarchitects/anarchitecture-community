import assert from 'node:assert/strict';
import { cp, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, join, sep } from 'node:path';

export const nestUploadVersions = {
  '@nestjs/common': '12.3.2',
  '@nestjs/core': '12.3.2',
  'reflect-metadata': '0.2.2',
  rxjs: '7.8.2',
  zod: '4.6.7',
};
const platforms = {
  fastify: {
    '@nestjs/platform-fastify': '12.3.2',
    fastify: '5.12.7',
    '@fastify/multipart': '10.1.6',
  },
  node: { '@nestjs/platform-node': '12.3.2' },
};
const json = (path, value) =>
  writeFile(path, JSON.stringify(value, null, 2) + '\n');

/** Fresh external installs belong to preparation, never a cacheable DTE atom. */
export async function prepareNestUpload({
  root,
  destination,
  archives,
  report,
  run,
  workspace,
}) {
  await mkdir(root);
  const client = join(root, 'client');
  await mkdir(join(client, 'archives'), { recursive: true });
  const dependencies = {};
  for (const name of [
    '@anarchitects/editorjs-core',
    '@anarchitects/editorjs-upload-fetch',
  ]) {
    const archive = archives[name];
    assert(archive, `Missing packed dependency: ${name}`);
    await cp(archive, join(client, 'archives', basename(archive)));
    dependencies[name] = `file:archives/${basename(archive)}`;
  }
  await json(join(client, 'package.json'), {
    name: 'nest-upload-browser-consumer',
    version: '0.0.0',
    private: true,
    type: 'module',
    dependencies,
    devDependencies: { typescript: '6.0.3' },
  });
  await run('npm', ['install', '--no-audit', '--no-fund'], client);
  const guide = await readFile(
    join(
      client,
      'node_modules/@anarchitects/editorjs-upload-fetch/nest-example.md',
    ),
    'utf8',
  );
  assert.equal(
    guide,
    await readFile(
      join(workspace, 'packages/editorjs/upload-fetch/nest-example.md'),
      'utf8',
    ),
  );
  const examples = new Map(
    [
      ...guide.matchAll(
        /<!-- nest-example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
      ),
    ].map(([, name, code]) => [name, code]),
  );
  assert.deepEqual(
    [...examples.keys()],
    [
      'application.ts',
      'local.ts',
      'http.ts',
      'fastify.ts',
      'native-node.ts',
      'client.ts',
    ],
  );
  await writeFile(join(client, 'client.ts'), examples.get('client.ts'));
  await json(join(client, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      skipLibCheck: false,
      types: [],
      lib: ['ES2022', 'DOM'],
      noEmit: true,
    },
    files: ['client.ts'],
  });
  const evidence = { node: '24.15.0', typescript: '6.0.3', installed: {} };
  for (const [platform, specific] of Object.entries(platforms)) {
    const backend = join(root, platform);
    await mkdir(backend);
    const dependencies = { ...nestUploadVersions, ...specific };
    const devDependencies = { typescript: '6.0.3', '@types/node': '24.10.1' };
    await json(join(backend, 'package.json'), {
      name: `nest-upload-${platform}-consumer`,
      version: '0.0.0',
      private: true,
      type: 'module',
      dependencies,
      devDependencies,
    });
    await run('npm', ['install', '--no-audit', '--no-fund'], backend);
    const files = [
      'application.ts',
      'local.ts',
      'http.ts',
      platform === 'node' ? 'native-node.ts' : 'fastify.ts',
    ];
    for (const file of files)
      await writeFile(join(backend, file), examples.get(file));
    await json(join(backend, 'tsconfig.json'), {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        skipLibCheck: false,
        types: ['node'],
        outDir: 'dist',
      },
      files,
    });
    const installed = {};
    for (const [name, version] of Object.entries({
      ...dependencies,
      ...devDependencies,
    })) {
      const packageRoot = join(backend, 'node_modules', name);
      assert((await realpath(packageRoot)).startsWith(backend + sep));
      const actual = JSON.parse(
        await readFile(join(packageRoot, 'package.json'), 'utf8'),
      ).version;
      assert.equal(actual, version);
      installed[name] = actual;
    }
    evidence.installed[platform] = installed;
    await cp(
      join(backend, 'package-lock.json'),
      join(report, `nest-upload-${platform}-package-lock.json`),
    );
  }
  await cp(
    join(client, 'package-lock.json'),
    join(report, 'nest-upload-client-package-lock.json'),
  );
  await json(join(root, 'versions.json'), evidence);
  await json(join(report, 'nest-upload-versions.json'), evidence);
  await run('tar', ['-czf', destination, '-C', root, '.'], root);
}

export async function validateNestUpload({
  root,
  node,
  platform,
  report,
  run,
  workspace,
}) {
  const client = join(root, 'client');
  const backend = join(root, platform);
  await run(
    node,
    ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'],
    backend,
  );
  await run(
    node,
    ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'],
    client,
  );
  await run(
    node,
    [
      join(workspace, 'apps/editorjs/angular-e2e/nest-upload/run.mjs'),
      root,
      platform,
      report,
    ],
    root,
  );
}
