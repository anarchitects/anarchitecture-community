import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Reuse the real fixture and its assertions; only installation/build roots differ. */
export async function preparePackedSsr({ root, report, workspace, tsconfig }) {
  const host = 'apps/editorjs/angular-host';
  await mkdir(join(root, host), { recursive: true });
  await cp(join(root, '..', 'src'), join(root, host, 'src'), {
    recursive: true,
  });
  await cp(join(root, '..', 'public'), join(root, host, 'public'), {
    recursive: true,
  });
  const { targets } = JSON.parse(
    await readFile(join(workspace, host, 'project.json'), 'utf8'),
  );
  const target = targets['build-ssr'];
  const writeJson = (file, data) =>
    writeFile(join(root, file), JSON.stringify(data, null, 2) + '\n');
  for (const [file, entry] of [
    ['tsconfig.ssr.json', 'ssr/main.ts'],
    ['tsconfig.isolation.json', 'isolation/main.eager.ts'],
  ]) {
    await writeJson(file, {
      ...tsconfig,
      compilerOptions: { ...tsconfig.compilerOptions, types: ['node'] },
      include: [],
      exclude: [],
      files: [
        `${host}/src/${entry}`,
        `${host}/src/main.server.ts`,
        `${host}/src/server.ts`,
      ],
    });
  }
  const configurations = structuredClone(target.configurations);
  configurations['eager-control'].tsConfig = 'tsconfig.isolation.json';
  await writeJson('angular.ssr.json', {
    version: 1,
    cli: { analytics: false, cache: { enabled: false } },
    projects: {
      consumer: {
        projectType: 'application',
        root: '',
        sourceRoot: `${host}/src`,
        architect: {
          build: {
            builder: target.executor,
            options: { ...target.options, tsConfig: 'tsconfig.ssr.json' },
            configurations,
            defaultConfiguration: 'production',
          },
        },
      },
    },
  });
  // This workspace owns SSR configuration; CSR and README never rewrite it.
  await cp(join(root, '..', 'angular.json'), join(report, 'angular.csr.json'));
  for (const file of ['package.json', 'package-lock.json'])
    await cp(join(root, '..', file), join(root, file));
  await cp(join(root, 'angular.ssr.json'), join(root, 'angular.json'));
  for (const file of [
    'angular.json',
    'tsconfig.ssr.json',
    'tsconfig.isolation.json',
  ])
    await cp(join(root, file), join(report, file));
}

export const ssrProfiles = {
  production: '',
  diagnostic: '-diagnostic',
  full: '-full',
  'eager-control': '-eager',
};

export async function buildPackedSsr({ root, report, node, run, profile }) {
  assert(
    Object.hasOwn(ssrProfiles, profile),
    `Unknown SSR profile: ${profile}`,
  );
  const suffix = ssrProfiles[profile];
  const output = join(root, `dist/apps/editorjs/angular-host-ssr${suffix}`);
  try {
    await run(
      node,
      [
        join(root, '..', 'node_modules/@angular/cli/bin/ng.js'),
        'build',
        `--configuration=${profile}`,
      ],
      root,
    );
    const stats = await buildMetadata(output);
    const inputs = Object.keys(stats.inputs);
    for (const artifact of [
      'editorjs-angular/fesm2022/',
      'editorjs-core/dist/',
    ])
      assert(
        inputs.some((input) =>
          input.includes(`node_modules/@anarchitects/${artifact}`),
        ),
        `Missing installed artifact provenance: ${artifact}`,
      );
    assert(
      !inputs.some((input) =>
        /packages\/editorjs\/(angular|core)\/src\//.test(input),
      ),
      'Workspace library source leaked into the consumer',
    );
  } finally {
    await mkdir(join(report, 'builds'), { recursive: true });
    await cp(output, join(report, 'builds', profile), {
      recursive: true,
    }).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

async function buildMetadata(output) {
  try {
    return JSON.parse(await readFile(join(output, 'stats.json'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // Angular 22.2 separates browser/server metafiles. Keep both originals and
  // expose their unchanged output records to the existing graph assertions.
  const sources = ['browser-stats.json', 'server-stats.json'];
  const [browser, server] = await Promise.all(
    sources.map(async (file) =>
      JSON.parse(await readFile(join(output, file), 'utf8')),
    ),
  );
  for (const name of Object.keys(browser.outputs))
    assert(
      !(name in server.outputs),
      `Ambiguous browser/server output: ${name}`,
    );
  const combined = {
    sources,
    inputs: { ...browser.inputs, ...server.inputs },
    outputs: { ...browser.outputs, ...server.outputs },
  };
  await writeFile(
    join(output, 'stats.json'),
    JSON.stringify(combined, null, 2) + '\n',
  );
  return combined;
}
