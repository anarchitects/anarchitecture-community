import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

/** Fresh installation is separate from the cacheable browser/build atom. */
export async function preparePortable({
  root,
  destination,
  archive,
  node,
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
        '@editorjs/editorjs': versions.editorjs,
      },
      devDependencies: { esbuild: '0.28.2', typescript: versions.typescript },
    }),
  );
  await run('npm', ['install', '--no-audit', '--no-fund'], root);
  const readme = await readFile(
    join(root, 'node_modules/@anarchitects/editorjs-core/README.md'),
    'utf8',
  );
  const browserExamples = [
    ...readme.matchAll(
      /<!-- browser-example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
    ),
  ];
  assert.deepEqual(
    browserExamples.map((example) => example[1]),
    ['browser-editor.ts'],
  );
  await mkdir(join(root, 'readme'));
  await writeFile(
    join(root, 'readme/browser-editor.ts'),
    browserExamples[0][2],
  );
  await writeFile(
    join(root, 'readme/main.ts'),
    `
    import { composeToolRegistry, EDITOR_JS_2_31_7_TOOL_PROFILE } from '@anarchitects/editorjs-core';
    import { mountEditor } from './browser-editor';
    const holder = document.querySelector<HTMLElement>('#editor')!;
    const output = document.querySelector<HTMLOutputElement>('output')!;
    const owner = mountEditor(holder, composeToolRegistry([], { profile: EDITOR_JS_2_31_7_TOOL_PROFILE }));
    owner.ready.then(() => { holder.dataset.ready = 'true'; }).catch((error: unknown) => { output.textContent = String(error); });
    document.querySelector('#save')!.addEventListener('click', () => {
      owner.ready.then(editor => editor.save()).then(data => { output.textContent = JSON.stringify(data); }).catch((error: unknown) => { output.textContent = String(error); });
    });
    document.querySelector('#remove')!.addEventListener('click', () => {
      owner.dispose().then(() => { holder.dataset.removed = 'true'; }).catch((error: unknown) => { output.textContent = String(error); });
    });
  `,
  );
  await mkdir(join(root, 'registry'));
  for (const file of ['direct.ts', 'definitions.ts', 'probe.ts', 'tools'])
    await cp(
      join(workspace, 'apps/editorjs/angular-host/src/registry', file),
      join(root, 'registry', file),
      { recursive: true },
    );
  await cp(
    join(workspace, 'apps/editorjs/angular-e2e/tools/serve-packed.mjs'),
    join(root, 'server.mjs'),
  );
  await writeFile(
    join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        lib: ['ES2022', 'DOM'],
        types: [],
        strict: true,
        noEmit: true,
      },
      files: ['registry/direct.ts', 'readme/main.ts'],
    }),
  );
  await run(
    node,
    ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'],
    root,
  );
  await run(
    node,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import { composeToolRegistry, createToolResolver, EDITOR_JS_2_31_7_TOOL_PROFILE } from '@anarchitects/editorjs-core';
    for (const name of ['@angular/core', '@angular/forms', '@anarchitects/editorjs-angular']) assert.throws(() => import.meta.resolve(name), { code: 'ERR_MODULE_NOT_FOUND' });
    let calls = 0;
    class Tool {}
    const registry = composeToolRegistry([[{ name: 'custom', kind: 'block', source: 'lazy', load: async () => { calls++; return Tool; } }]], { profile: EDITOR_JS_2_31_7_TOOL_PROFILE });
    const resolver = createToolResolver(registry);
    assert.equal((await resolver.resolve()).custom.class, Tool);
    assert.equal(calls, 1);
    resolver.dispose();
  `,
    ],
    root,
  );
  await cp(
    join(root, 'package-lock.json'),
    join(report, 'portable-package-lock.json'),
  );
  await run('tar', ['-czf', destination, '-C', root, '.'], root);
}
export async function buildPortable({ root, node, report, run }) {
  await mkdir(join(root, 'dist/browser'), { recursive: true });
  await run(
    node,
    [
      '--input-type=module',
      '-e',
      `
    import { build } from 'esbuild';
    import { writeFile } from 'node:fs/promises';
    const result = await build({ entryPoints: { direct: 'registry/direct.ts', readme: 'readme/main.ts' }, bundle: true, format: 'esm', splitting: true, outdir: 'dist/browser', metafile: true });
    await writeFile('metadata.json', JSON.stringify(result.metafile));
  `,
    ],
    root,
  );
  const metadata = JSON.parse(
    await readFile(join(root, 'metadata.json'), 'utf8'),
  );
  assert(
    !Object.keys(metadata.inputs).some((path) => path.includes('@angular/')),
    'Angular leaked into the portable bundle',
  );
  assert(
    Object.keys(metadata.inputs).some((path) =>
      path.includes('@anarchitects/editorjs-core/dist/'),
    ),
    'Missing packed core provenance',
  );
  const tools = Object.fromEntries(
    ['card', 'marker', 'flag', 'unselected'].map((name) => [
      name,
      Object.entries(metadata.outputs)
        .filter(([, output]) =>
          Object.entries(output.inputs).some(
            ([input, value]) =>
              input === `registry/tools/${name}.ts` && value.bytesInOutput > 0,
          ),
        )
        .map(([file]) => basename(file)),
    ]),
  );
  for (const [name, outputs] of Object.entries(tools))
    assert(outputs.length > 0, `Missing portable tool output: ${name}`);
  const initial = new Set();
  function visit(file) {
    if (initial.has(file)) return;
    initial.add(file);
    for (const edge of metadata.outputs[file].imports) {
      if (edge.kind === 'dynamic-import') continue;
      assert(!edge.external, `Unexpected external dependency: ${edge.path}`);
      visit(edge.path);
    }
  }
  visit('dist/browser/direct.js');
  assert(
    !Object.values(tools)
      .flat()
      .some((file) => initial.has(`dist/browser/${file}`)),
    'Tool code entered the portable eager closure',
  );
  const graph = JSON.stringify({ tools, initial: [...initial] });
  await writeFile(join(root, 'dist/browser/registry-graph.json'), graph);
  await writeFile(join(report, 'portable-graph.json'), graph);
  await cp(join(root, 'metadata.json'), join(report, 'portable-build.json'));
  await writeFile(
    join(root, 'dist/browser/readme.html'),
    `<!doctype html><html><head><link rel="icon" href="data:,"></head><body><h1>Core README</h1><div id="editor"></div><button id="save">Save</button><button id="remove">Remove</button><output></output><script type="module" src="/readme.js"></script></body></html>`,
  );
  await writeFile(
    join(root, 'dist/browser/index.html'),
    `<!doctype html><html><head><link rel="icon" href="data:,"></head><body><h1>Portable registry</h1><button id="toggle">Toggle registry A</button><button id="fail">Fail next tool</button><button id="hold">Hold next tool</button><script type="module" src="/direct.js"></script></body></html>`,
  );
}
