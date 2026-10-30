import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

/** Fresh installation is separate from the cacheable browser/build atom. */
export async function preparePortable({
  root,
  destination,
  archive,
  paragraphArchive,
  headerArchive,
  listArchive,
  quoteArchive,
  imageArchive,
  node,
  versions,
  workspace,
  report,
  run,
}) {
  await mkdir(root);
  await cp(archive, join(root, basename(archive)));
  await cp(paragraphArchive, join(root, basename(paragraphArchive)));
  await cp(headerArchive, join(root, basename(headerArchive)));
  await cp(listArchive, join(root, basename(listArchive)));
  await cp(quoteArchive, join(root, basename(quoteArchive)));
  await cp(imageArchive, join(root, basename(imageArchive)));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        '@anarchitects/editorjs-core': `file:${basename(archive)}`,
        '@anarchitects/editorjs-tool-paragraph': `file:${basename(paragraphArchive)}`,
        '@anarchitects/editorjs-tool-header': `file:${basename(headerArchive)}`,
        '@anarchitects/editorjs-tool-list': `file:${basename(listArchive)}`,
        '@anarchitects/editorjs-tool-quote': `file:${basename(quoteArchive)}`,
        '@anarchitects/editorjs-tool-image': `file:${basename(imageArchive)}`,
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
  const guide = await readFile(
    join(root, 'node_modules/@anarchitects/editorjs-core/custom-tools.md'),
    'utf8',
  );
  const customExamples = [
    ...guide.matchAll(
      /<!-- (?:neutral|browser)-example-file: ([\w.-]+) -->\s*```(?:ts|html)\n([\s\S]*?)```/g,
    ),
  ];
  assert.deepEqual(
    customExamples.map(([, file]) => file),
    [
      'callout-data.ts',
      'callout-tool.ts',
      'callout-direct.ts',
      'callout-lazy.ts',
      'callout-editor.ts',
      'main.ts',
      'index.html',
      'editorial-data.ts',
      'marker-tool.ts',
      'flag-tune.ts',
      'editorial-registry.ts',
      'editorial-main.ts',
    ],
  );
  await mkdir(join(root, 'custom'));
  for (const [, file, code] of customExamples)
    await writeFile(join(root, 'custom', file), code);
  await cp(
    join(workspace, 'apps/editorjs/angular-e2e/tools/custom-tool-probe.txt'),
    join(root, 'custom/probe.ts'),
  );
  await writeFile(
    join(report, 'custom-tool-examples.json'),
    JSON.stringify({
      source: '@anarchitects/editorjs-core/custom-tools.md',
      files: customExamples.map(([, file]) => file),
    }),
  );
  const paragraphReadme = await readFile(
    join(root, 'node_modules/@anarchitects/editorjs-tool-paragraph/README.md'),
    'utf8',
  );
  const paragraphExamples = [
    ...paragraphReadme.matchAll(
      /<!-- paragraph-example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
    ),
  ];
  assert.equal(paragraphExamples.length, 3);
  for (const [, file, code] of paragraphExamples)
    await writeFile(join(root, 'readme', file), code);
  await cp(
    join(workspace, 'apps/editorjs/angular-host/src/paragraph'),
    join(root, 'paragraph'),
    { recursive: true },
  );
  const headerReadme = await readFile(
    join(root, 'node_modules/@anarchitects/editorjs-tool-header/README.md'),
    'utf8',
  );
  const headerExamples = [
    ...headerReadme.matchAll(
      /<!-- header-example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
    ),
  ];
  assert.equal(headerExamples.length, 3);
  for (const [, file, code] of headerExamples)
    await writeFile(join(root, 'readme', file), code);
  await cp(
    join(workspace, 'apps/editorjs/angular-host/src/header'),
    join(root, 'header'),
    { recursive: true },
  );
  const listReadme = await readFile(
    join(root, 'node_modules/@anarchitects/editorjs-tool-list/README.md'),
    'utf8',
  );
  const listExamples = [
    ...listReadme.matchAll(
      /<!-- list-example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
    ),
  ];
  assert.equal(listExamples.length, 3);
  for (const [, file, code] of listExamples)
    await writeFile(join(root, 'readme', file), code);
  await cp(
    join(workspace, 'apps/editorjs/angular-host/src/list'),
    join(root, 'list'),
    { recursive: true },
  );
  const quoteReadme = await readFile(
    join(root, 'node_modules/@anarchitects/editorjs-tool-quote/README.md'),
    'utf8',
  );
  const quoteExamples = [
    ...quoteReadme.matchAll(
      /<!-- quote-example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
    ),
  ];
  assert.equal(quoteExamples.length, 3);
  for (const [, file, code] of quoteExamples)
    await writeFile(join(root, 'readme', file), code);
  await cp(
    join(workspace, 'apps/editorjs/angular-host/src/image'),
    join(root, 'image'),
    { recursive: true },
  );
  const imageReadme = await readFile(
    join(root, 'node_modules/@anarchitects/editorjs-tool-image/README.md'),
    'utf8',
  );
  const imageExamples = [
    ...imageReadme.matchAll(
      /<!-- image-example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
    ),
  ];
  assert.equal(imageExamples.length, 3);
  for (const [, file, code] of imageExamples)
    await writeFile(join(root, 'readme', file), code);
  await cp(
    join(workspace, 'apps/editorjs/angular-host/src/quote'),
    join(root, 'quote'),
    { recursive: true },
  );
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
  await cp(
    join(workspace, 'apps/editorjs/angular-host/src/common'),
    join(root, 'common'),
    { recursive: true },
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
      files: [
        'custom/main.ts',
        'custom/editorial-main.ts',
        'custom/callout-direct.ts',
        'custom/probe.ts',
        'registry/direct.ts',
        'readme/main.ts',
        'paragraph/direct.ts',
        'header/direct.ts',
        'list/direct.ts',
        'quote/direct.ts',
        'image/direct.ts',
        ...imageExamples.map(([, file]) => `readme/${file}`),
        ...quoteExamples.map(([, file]) => `readme/${file}`),
        ...listExamples.map(([, file]) => `readme/${file}`),
        ...headerExamples.map(([, file]) => `readme/${file}`),
        ...paragraphExamples.map(([, file]) => `readme/${file}`),
      ],
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
    const result = await build({ entryPoints: { 'dist/main': 'custom/main.ts', 'editorial/dist/main': 'custom/editorial-main.ts', 'custom-probe': 'custom/probe.ts', direct: 'registry/direct.ts', readme: 'readme/main.ts', paragraph: 'paragraph/direct.ts', header: 'header/direct.ts', list: 'list/direct.ts', quote: 'quote/direct.ts', image: 'image/direct.ts' }, bundle: true, format: 'esm', splitting: true, outdir: 'dist/browser', metafile: true });
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
  const customInitial = new Set();
  function visitCustom(file) {
    if (customInitial.has(file)) return;
    customInitial.add(file);
    for (const edge of metadata.outputs[file].imports)
      if (edge.kind !== 'dynamic-import' && !edge.external)
        visitCustom(edge.path);
  }
  visitCustom('dist/browser/dist/main.js');
  visitCustom('dist/browser/editorial/dist/main.js');
  const calloutChunks = Object.entries(metadata.outputs)
    .filter(([, output]) =>
      Object.entries(output.inputs).some(
        ([file, value]) =>
          file === 'custom/callout-tool.ts' && value.bytesInOutput > 0,
      ),
    )
    .map(([file]) => file);
  assert(calloutChunks.length > 0, 'Missing archived callout implementation');
  assert(
    !calloutChunks.some((file) => customInitial.has(file)),
    'Callout entered the lazy page initial closure',
  );
  const editorialChunks = Object.fromEntries(
    ['marker-tool', 'flag-tune'].map((name) => {
      const chunks = Object.entries(metadata.outputs)
        .filter(([, output]) =>
          Object.entries(output.inputs).some(
            ([file, value]) =>
              file === `custom/${name}.ts` && value.bytesInOutput > 0,
          ),
        )
        .map(([file]) => file);
      assert(chunks.length > 0, `Missing archived ${name} implementation`);
      assert(
        !chunks.some((file) => customInitial.has(file)),
        `${name} entered the lazy page initial closure`,
      );
      return [name, chunks];
    }),
  );
  await writeFile(
    join(report, 'custom-tool-delivery.json'),
    JSON.stringify({
      initial: [...customInitial],
      calloutChunks,
      editorialChunks,
    }),
  );
  const commonTools = Object.fromEntries(
    ['paragraph', 'header', 'list', 'quote', 'image'].map((name) => [
      name,
      Object.entries(metadata.outputs)
        .filter(([, output]) =>
          Object.entries(output.inputs).some(
            ([input, value]) =>
              input.includes('@editorjs/' + name + '/dist/') &&
              value.bytesInOutput > 0,
          ),
        )
        .map(([file]) => basename(file)),
    ]),
  );
  for (const [name, chunks] of Object.entries(commonTools)) {
    assert(chunks.length > 0, 'Missing upstream provenance: ' + name);
    assert(
      Object.keys(metadata.inputs).some((path) =>
        path.includes(
          '@anarchitects/editorjs-tool-' + name + '/dist/browser.js',
        ),
      ),
      'Missing packed browser entry: ' + name,
    );
    assert(
      !chunks.some((file) => initial.has('dist/browser/' + file)),
      'Eager tool: ' + name,
    );
  }
  const graph = JSON.stringify({ tools, commonTools, initial: [...initial] });
  await writeFile(join(root, 'dist/browser/registry-graph.json'), graph);
  await writeFile(join(report, 'portable-graph.json'), graph);
  await cp(join(root, 'metadata.json'), join(report, 'portable-build.json'));
  const paragraphChunks = Object.entries(metadata.outputs)
    .filter(([, output]) =>
      Object.entries(output.inputs).some(
        ([input, value]) =>
          input.includes('@editorjs/paragraph/dist/') &&
          value.bytesInOutput > 0,
      ),
    )
    .map(([file]) => file);
  assert(paragraphChunks.length > 0, 'Missing upstream paragraph provenance');
  assert(
    Object.keys(metadata.inputs).some((path) =>
      path.includes('@anarchitects/editorjs-tool-paragraph/dist/browser.js'),
    ),
    'Missing packaged paragraph browser entry',
  );
  initial.clear();
  visit('dist/browser/paragraph.js');
  assert(
    !paragraphChunks.some((file) => initial.has(file)),
    'Paragraph entered the initial closure',
  );
  await writeFile(
    join(root, 'dist/browser/paragraph-graph.json'),
    JSON.stringify({ chunks: paragraphChunks.map((file) => basename(file)) }),
  );
  const headerChunks = Object.entries(metadata.outputs)
    .filter(([, output]) =>
      Object.entries(output.inputs).some(
        ([input, value]) =>
          input.includes('@editorjs/header/dist/') && value.bytesInOutput > 0,
      ),
    )
    .map(([file]) => file);
  assert(headerChunks.length > 0, 'Missing upstream header provenance');
  assert(
    Object.keys(metadata.inputs).some((path) =>
      path.includes('@anarchitects/editorjs-tool-header/dist/browser.js'),
    ),
    'Missing packaged header browser entry',
  );
  initial.clear();
  visit('dist/browser/header.js');
  assert(
    !headerChunks.some((file) => initial.has(file)),
    'Header entered the initial closure',
  );
  await writeFile(
    join(root, 'dist/browser/header-graph.json'),
    JSON.stringify({ chunks: headerChunks.map((file) => basename(file)) }),
  );
  const listChunks = Object.entries(metadata.outputs)
    .filter(([, output]) =>
      Object.entries(output.inputs).some(
        ([input, value]) =>
          input.includes('@editorjs/list/dist/') && value.bytesInOutput > 0,
      ),
    )
    .map(([file]) => file);
  assert(listChunks.length > 0, 'Missing upstream list provenance');
  assert(
    Object.keys(metadata.inputs).some((path) =>
      path.includes('@anarchitects/editorjs-tool-list/dist/browser.js'),
    ),
    'Missing packaged list browser entry',
  );
  initial.clear();
  visit('dist/browser/list.js');
  assert(
    !listChunks.some((file) => initial.has(file)),
    'List entered the initial closure',
  );
  await writeFile(
    join(root, 'dist/browser/list-graph.json'),
    JSON.stringify({ chunks: listChunks.map((file) => basename(file)) }),
  );
  const quoteChunks = Object.entries(metadata.outputs)
    .filter(([, output]) =>
      Object.entries(output.inputs).some(
        ([input, value]) =>
          input.includes('@editorjs/quote/dist/') && value.bytesInOutput > 0,
      ),
    )
    .map(([file]) => file);
  assert(quoteChunks.length > 0, 'Missing upstream quote provenance');
  assert(
    Object.keys(metadata.inputs).some((path) =>
      path.includes('@anarchitects/editorjs-tool-quote/dist/browser.js'),
    ),
    'Missing packaged quote browser entry',
  );
  initial.clear();
  visit('dist/browser/quote.js');
  assert(
    !quoteChunks.some((file) => initial.has(file)),
    'List entered the initial closure',
  );
  await writeFile(
    join(root, 'dist/browser/quote-graph.json'),
    JSON.stringify({ chunks: quoteChunks.map((file) => basename(file)) }),
  );
  const imageChunks = Object.entries(metadata.outputs)
    .filter(([, output]) =>
      Object.entries(output.inputs).some(
        ([input, value]) =>
          input.includes('@editorjs/image/dist/') && value.bytesInOutput > 0,
      ),
    )
    .map(([file]) => file);
  assert(imageChunks.length > 0, 'Missing upstream image provenance');
  assert(
    Object.keys(metadata.inputs).some((path) =>
      path.includes('@anarchitects/editorjs-tool-image/dist/browser.js'),
    ),
    'Missing packaged image browser entry',
  );
  initial.clear();
  visit('dist/browser/image.js');
  assert(
    !imageChunks.some((file) => initial.has(file)),
    'Image entered the initial closure',
  );
  await writeFile(
    join(root, 'dist/browser/image-graph.json'),
    JSON.stringify({ chunks: imageChunks.map((file) => basename(file)) }),
  );
  await writeFile(
    join(root, 'dist/browser/paragraph.html'),
    `<!doctype html><html><head><link rel="icon" href="data:,"></head><body><h1>Packaged paragraph</h1><button id="mount">Mount</button><div id="editor"></div><button id="save">Save</button><button id="render">Render saved</button><button id="clear">Clear</button><button id="readonly">Read only</button><button id="remove">Remove</button><output></output><h2>Built-in control</h2><div id="builtin"></div><button id="save-builtin">Save builtin</button><pre id="builtin-output"></pre><script type="module" src="/paragraph.js"></script></body></html>`,
  );
  await writeFile(
    join(root, 'dist/browser/header.html'),
    `<!doctype html><html><head><link rel="icon" href="data:,"></head><body><h1>Packaged header</h1><button id="mount">Mount</button><div id="editor"></div><button id="save">Save</button><button id="render">Render saved</button><button id="clear">Clear</button><button id="readonly">Read only</button><button id="remove">Remove</button><output></output><h2>Singleton level</h2><div id="singleton"></div><button id="save-singleton">Save singleton</button><pre id="singleton-output"></pre><h2>Default config</h2><div id="defaults"></div><script type="module" src="/header.js"></script></body></html>`,
  );
  await writeFile(
    join(root, 'dist/browser/list.html'),
    `<!doctype html><html><head><link rel="icon" href="data:,"><style>#editor{min-height:500px}output{display:block;white-space:pre-wrap}</style></head><body><h1>Packaged list</h1><button id="mount">Mount</button><div id="editor"></div><button id="save">Save</button><button id="render">Render saved</button><button id="clear">Clear</button><button id="readonly">Read only</button><button id="remove-main">Remove main</button><button id="remove">Remove</button><output></output><h2>Flat list</h2><div id="flat"></div><button id="save-flat">Save flat</button><pre id="flat-output"></pre><h2>Default config</h2><div id="defaults"></div><script type="module" src="/list.js"></script></body></html>`,
  );
  await writeFile(
    join(root, 'dist/browser/quote.html'),
    `<!doctype html><html><head><link rel="icon" href="data:,"><style>#editor{min-height:500px}output{display:block;white-space:pre-wrap}</style></head><body><h1>Packaged quote</h1><button id="mount">Mount</button><div id="editor"></div><button id="save">Save</button><button id="render">Render saved</button><button id="clear">Clear</button><button id="readonly">Read only</button><button id="remove-main">Remove main</button><button id="remove">Remove</button><output></output><h2>Independent quote</h2><div id="second"></div><button id="save-second">Save second</button><pre id="second-output"></pre><h2>Default config</h2><div id="defaults"></div><button id="save-defaults">Save defaults</button><pre id="defaults-output"></pre><script type="module" src="/quote.js"></script></body></html>`,
  );
  await writeFile(
    join(root, 'dist/browser/image.html'),
    `<!doctype html><html><head><link rel="icon" href="data:,"><style>#editor{min-height:500px}output{display:block;white-space:pre-wrap}</style></head><body><h1>Packaged image</h1><button id="mount">Mount</button><div id="editor"></div><label>Upload outcome<select id="upload-mode"><option>success</option><option>pending</option><option>failure</option><option>reject</option><option>malformed</option></select></label><button id="upload-url">Upload URL</button><button id="release">Release uploads</button><button id="save">Save</button><button id="render">Render saved</button><button id="clear">Clear</button><button id="readonly">Read only</button><button id="remove-main">Remove main</button><button id="remove">Remove</button><output></output><h2>Independent image</h2><div id="second"></div><button id="save-second">Save second</button><pre id="second-output"></pre><script type="module" src="/image.js"></script></body></html>`,
  );
  await writeFile(
    join(root, 'dist/browser/readme.html'),
    `<!doctype html><html><head><link rel="icon" href="data:,"></head><body><h1>Core README</h1><div id="editor"></div><button id="save">Save</button><button id="remove">Remove</button><output></output><script type="module" src="/readme.js"></script></body></html>`,
  );
  await cp(
    join(root, 'custom/index.html'),
    join(root, 'dist/browser/custom-tool.html'),
  );
  await writeFile(
    join(root, 'dist/browser/editorial.html'),
    (await readFile(join(root, 'custom/index.html'), 'utf8')).replace(
      '/dist/main.js',
      '/editorial/dist/main.js',
    ),
  );
  await writeFile(
    join(root, 'dist/browser/custom-probe.html'),
    `<!doctype html><html lang="en"><head><link rel="icon" href="data:,"></head><body><h1>Custom tool probes</h1><div id="editor"></div><p id="status" role="status">Loading</p><output></output><script type="module" src="/custom-probe.js"></script></body></html>`,
  );
  await writeFile(
    join(root, 'dist/browser/index.html'),
    `<!doctype html><html><head><link rel="icon" href="data:,"></head><body><h1>Portable registry</h1><button id="toggle">Toggle registry A</button><button id="fail">Fail next tool</button><button id="hold">Hold next tool</button><script type="module" src="/direct.js"></script></body></html>`,
  );
}
