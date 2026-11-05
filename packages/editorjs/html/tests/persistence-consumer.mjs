import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

// This file runs inside the independent packed consumer, after compiling the
// actual archived recipes. No source aliases or browser/tool implementations.
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'EditorJS',
  'fetch',
]) {
  Object.defineProperty(globalThis, name, {
    get() {
      throw new Error(`Unexpected global: ${name}`);
    },
  });
}
const require = createRequire(import.meta.url);
for (const name of [
  '@angular/core',
  '@angular/forms',
  '@nestjs/core',
  'nx',
  '@editorjs/editorjs',
])
  assert.throws(() => require.resolve(name), { code: 'MODULE_NOT_FOUND' });
// Import after installing the global traps. These are consumer test imports,
// not lazy runtime edges for Nx's production module-boundary analysis.
const corePackage = '@anarchitects/editorjs-core';
const htmlPackage = '@anarchitects/editorjs-html';
const { EditorJsDocumentCoordinator, validateOutputData } = await import(
  corePackage
);
const { renderEditorJsHtml, createEditorJsHtmlRenderer } = await import(
  htmlPackage
);
const { saveRaw, loadRaw, saveRecord, loadRecord, encodeRecord, decodeRecord } =
  await import('./compiled/persistence.js');
const { MemoryTextStore } = await import('./compiled/memory-store.js');
const { MemoryNotebookRepository, NotebookService } = await import(
  './compiled/notebook-service.js'
);
const { prepareNotebookRecord } = await import('./compiled/evolution.js');
const { legacyRecord, currentRecord } = await import(
  './compiled/migration-fixtures.js'
);

const isObject = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const options = {
  profiles: [
    { name: 'copy', profile: 'paragraph' },
    { name: 'photo', profile: 'image' },
  ],
  blocks: [
    {
      name: 'callout',
      validate: (data) =>
        isObject(data) &&
        typeof data.text === 'string' &&
        ['info', 'warning'].includes(data.tone),
      render: (data, context) => `<aside>${context.inline(data.text)}</aside>`,
    },
    {
      name: 'code',
      validate: (data) => isObject(data) && typeof data.code === 'string',
      render: (data, context) =>
        `<pre><code>${context.escapeText(data.code)}</code></pre>`,
    },
  ],
  tunes: [
    {
      name: 'flag',
      validate: (data) => isObject(data) && typeof data.flagged === 'boolean',
      render: (html, data) =>
        data.flagged ? `<section>${html}</section>` : html,
    },
  ],
};
const paragraph = (text = 'Retained') => ({
  type: 'paragraph',
  data: { text },
});
const image = (alt) => ({
  type: 'photo',
  data: {
    file: {
      url: 'https://assets.invalid/photo.png',
      id: 'asset-7',
      metadata: { retained: true },
    },
    caption: '<b>Caption is not alt</b>',
    withBorder: false,
    withBackground: false,
    stretched: false,
    ...(alt === undefined ? {} : { alt }),
  },
});
const rendered = {};
const failure = (result, code) => {
  assert.equal(result.status, 'failure');
  assert.equal(Object.hasOwn(result, 'html'), false);
  assert.ok(
    result.diagnostics.some((item) => item.code === code),
    JSON.stringify(result),
  );
};
async function stored(input) {
  const store = new MemoryTextStore();
  await saveRaw(store, input);
  return loadRaw(store);
}
function setup() {
  const repository = new MemoryNotebookRepository();
  const calls = { writes: 0 };
  const service = new NotebookService(
    {
      read: (id) => repository.read(id),
      commit: (record, revision) => {
        calls.writes++;
        return repository.commit(record, revision);
      },
    },
    (principal) => principal === 'editor',
  );
  return { repository, service, calls };
}
const request = () => ({
  id: 'note',
  expectedRevision: null,
  document: {
    blocks: [
      {
        type: 'callout',
        data: { text: '<mark>Stored</mark>', tone: 'info' },
        tunes: { flag: { flagged: true } },
      },
    ],
  },
  provenance: {
    schema: { id: 'example/editorial-notebook', version: '2' },
    toolVersions: { callout: '2' },
  },
});

await test('S1/S2: explicit neutral save, detached record and raw round trips retain semantic saved profiles', async () => {
  const input = {
    version: '2.31.7',
    time: 1,
    extension: { future: [null, true, 7] },
    blocks: [
      paragraph('<b>Introduction</b>'),
      { type: 'header', data: { text: 'Title', level: 2 } },
      {
        type: 'quote',
        data: { text: 'Quotation', caption: 'Attribution', alignment: 'left' },
      },
      {
        type: 'list',
        data: {
          style: 'ordered',
          meta: { start: 3, counterType: 'upper-roman' },
          items: [
            {
              content: 'Parent',
              meta: { start: 2, counterType: 'lower-alpha' },
              items: [{ content: 'Child', meta: {}, items: [] }],
            },
          ],
        },
      },
      {
        type: 'list',
        data: {
          style: 'checklist',
          meta: {},
          items: [
            {
              content: 'Done',
              meta: { checked: true },
              items: [
                { content: 'Pending', meta: { checked: false }, items: [] },
              ],
            },
          ],
        },
      },
      { type: 'copy', data: { text: 'Alias <mark>marked</mark>' } },
      {
        type: 'callout',
        data: { text: '<mark>Callout</mark>', tone: 'warning' },
        tunes: { flag: { flagged: true } },
      },
      { type: 'code', data: { code: '<script>literal & code</script>' } },
      image('A "literal" <alt>'),
    ],
  };
  const original = structuredClone(input);
  const coordinator = new EditorJsDocumentCoordinator({
    driver: { save: async () => input, render: async () => undefined },
  });
  coordinator.markReady();
  try {
    const saved = await coordinator.api.save();
    assert.deepEqual(saved, original);
    const record = {
      id: 'note',
      revision: 'host-revision',
      document: saved,
      provenance: {
        schema: { id: 'host/archive', version: 'future' },
        extra: { retained: true },
      },
    };
    const store = new MemoryTextStore();
    await saveRecord(store, record);
    const bytes = await store.read();
    input.blocks[0].data.text = 'Newer draft';
    record.provenance.extra.retained = false;
    const loaded = await loadRecord(store);
    assert.deepEqual(loaded.document, original);
    assert.equal(loaded.provenance.extra.retained, true);
    const raw = await stored(loaded.document);
    assert.deepEqual(raw, original);
    const result = renderEditorJsHtml(raw, options);
    assert.equal(result.status, 'success', JSON.stringify(result));
    assert.deepEqual(renderEditorJsHtml(raw, options), result);
    assert.deepEqual(raw, original);
    rendered.common = result.html;
    loaded.document.blocks.length = 0;
    assert.equal(await store.read(), bytes);
  } finally {
    coordinator.dispose();
  }
});

await test('S2: unknown block/tune JSON survives storage but requires explicit render registration', async () => {
  for (const block of [
    { type: 'third-party', data: { opaque: [null, { retained: true }] } },
    {
      ...paragraph('Omit entire block'),
      tunes: { unregistered: { opaque: true } },
    },
  ]) {
    const input = { blocks: [paragraph(), block] };
    const loaded = await stored(input);
    assert.deepEqual(loaded, input);
    failure(
      renderEditorJsHtml(loaded, options),
      block.type === 'third-party' ? 'unknown_block' : 'unknown_tune',
    );
    const preview = renderEditorJsHtml(loaded, { ...options, mode: 'preview' });
    assert.equal(preview.status, 'preview');
    assert.equal(preview.html, '<p>Retained</p>');
    assert.equal(preview.diagnostics.length, 1);
    assert.equal(preview.diagnostics[0].blockIndex, 1);
    assert.deepEqual(loaded, input);
  }
});

await test('S2: core block validation does not implicitly validate saved tune payloads', async () => {
  const input = {
    blocks: [{ ...paragraph(), tunes: { flag: { flagged: 'true' } } }],
  };
  const checked = validateOutputData(input, {
    toolValidators: new Map([['paragraph', () => ({ ok: true })]]),
  });
  assert.equal(checked.ok, true);
  const loaded = await stored(checked.data);
  failure(renderEditorJsHtml(loaded, options), 'invalid_tune_data');
  assert.equal(
    renderEditorJsHtml(loaded, { ...options, mode: 'preview' }).html,
    '',
  );
});

await test('S3: persisted missing/blank alt fails publication; explicit decorative and authored alt recover', async () => {
  const store = new MemoryTextStore();
  for (const alt of [undefined, ' \n', '', 'A "literal" <alt>']) {
    const input = { blocks: [paragraph(), image(alt)] };
    await saveRaw(store, input);
    const loaded = await loadRaw(store);
    assert.deepEqual(loaded, input);
    const result = renderEditorJsHtml(loaded, options);
    if (alt === undefined || alt === ' \n') {
      failure(result, 'missing_alt');
      const preview = renderEditorJsHtml(loaded, {
        ...options,
        mode: 'preview',
      });
      assert.equal(preview.status, 'preview');
      assert.equal(preview.html, '<p>Retained</p>');
      assert.equal(preview.diagnostics[0].code, 'missing_alt');
    } else {
      assert.equal(result.status, 'success');
      rendered[alt === '' ? 'decorative' : 'authored'] = result.html;
    }
  }
});

await test('S4: malformed data fails before a write and corrupt reads never become an empty document', async () => {
  const store = new MemoryTextStore();
  await saveRaw(store, { blocks: [paragraph()] });
  const before = await store.read();
  let writes = 0;
  for (const input of [
    { blocks: [null] },
    { blocks: [{ type: 'paragraph', data: { text: 1n } }] },
  ]) {
    await assert.rejects(
      saveRaw(
        {
          write: async () => {
            writes++;
          },
        },
        input,
      ),
      { stage: 'document' },
    );
  }
  assert.equal(writes, 0);
  for (const text of ['{', '{"blocks":[null]}'])
    await assert.rejects(loadRaw({ read: async () => text }), {
      stage: 'parse',
    });
  assert.equal(await store.read(), before);
  assert.equal(
    renderEditorJsHtml(await loadRaw(store)).html,
    '<p>Retained</p>',
  );
});

await test('S4: service failures preserve the acknowledged renderable record', async () => {
  const { service, repository, calls } = setup();
  const saved = await service.save('editor', request());
  assert.equal(saved.ok, true);
  const before = await repository.read('note');
  const cases = [
    [
      'editor',
      { ...request(), document: { blocks: [null] } },
      'invalid_content',
    ],
    [
      'editor',
      {
        ...request(),
        provenance: {
          schema: { id: 'example/editorial-notebook', version: 'future' },
        },
      },
      'unsupported_content',
    ],
    [
      'editor',
      {
        ...request(),
        document: {
          blocks: [
            {
              type: 'aside',
              data: { message: 'Old', text: 'Collision', tone: 'info' },
            },
          ],
        },
        provenance: {
          schema: { id: 'example/editorial-notebook', version: '1' },
        },
      },
      'migration_failed',
    ],
    ['other', request(), 'forbidden'],
    ['editor', request(), 'conflict'],
  ];
  for (const [principal, input, code] of cases) {
    const result = await service.save(principal, input);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, code);
    assert.equal(Object.hasOwn(result, 'value'), false);
    assert.equal(await repository.read('note'), before);
    const loaded = await service.load('editor', 'note');
    assert.equal(loaded.ok, true);
    assert.equal(
      renderEditorJsHtml(loaded.value.record.document, options).html,
      '<section><aside><mark>Stored</mark></aside></section>',
    );
  }
  assert.equal(calls.writes, 2); // Initial success and the rejected compare-and-write only.
});

await test('S4: failed storage acknowledgement cannot publish a candidate and retry recovers', async () => {
  const { service, repository } = setup();
  await service.save('editor', request());
  const before = await repository.read('note');
  const update = {
    ...request(),
    expectedRevision: 'r1',
    document: { blocks: [paragraph('Updated')] },
  };
  repository.failNextWrite();
  assert.deepEqual(await service.save('editor', update), {
    ok: false,
    error: { code: 'unavailable', stage: 'write' },
  });
  assert.equal(await repository.read('note'), before);
  assert.equal((await service.save('editor', update)).ok, true);
  const loaded = await service.load('editor', 'note');
  assert.equal(loaded.value.record.revision, 'r2');
  assert.equal(
    renderEditorJsHtml(loaded.value.record.document).html,
    '<p>Updated</p>',
  );
});

await test('S4: migration retains extensions/provenance and requires explicit render registration', async () => {
  const original = structuredClone(legacyRecord);
  const migrated = prepareNotebookRecord(
    decodeRecord(encodeRecord(legacyRecord)),
  );
  assert.equal(migrated.status, 'migrated');
  assert.deepEqual(migrated.record, currentRecord);
  assert.deepEqual(legacyRecord, original);
  failure(renderEditorJsHtml(migrated.record.document), 'unknown_block');
  failure(
    renderEditorJsHtml(migrated.record.document, options),
    'unknown_tune',
  );
  const result = renderEditorJsHtml(migrated.record.document, {
    ...options,
    tunes: [
      ...options.tunes,
      {
        name: 'review',
        validate: (data) => isObject(data) && data.owner === 'host',
        ignore: true,
      },
    ],
  });
  assert.equal(result.status, 'success', JSON.stringify(result));
  rendered.migrated = result.html;
  assert.deepEqual(migrated.record, currentRecord);
});

await test('S4: legacy service load renders a migrated candidate without implicit writeback', async () => {
  const { service, repository, calls } = setup();
  const legacy = {
    id: 'note',
    revision: 'imported',
    document: {
      blocks: [
        {
          type: 'aside',
          data: { message: '<mark>Legacy</mark>', tone: 'info' },
        },
      ],
    },
    provenance: { schema: { id: 'example/editorial-notebook', version: '1' } },
  };
  await repository.commit(legacy, null);
  const before = await repository.read('note');
  const loaded = await service.load('editor', 'note');
  assert.equal(loaded.ok, true);
  assert.equal(loaded.value.migration, 'migrated');
  assert.equal(
    renderEditorJsHtml(loaded.value.record.document, options).html,
    '<aside><mark>Legacy</mark></aside>',
  );
  assert.equal(calls.writes, 0);
  assert.equal(await repository.read('note'), before);
});

await test('S4: successful persistence is not HTML publication; per-call policy remains isolated', async () => {
  const { service } = setup();
  const input = request();
  input.document.blocks[0].data.text =
    '<mark>Visible</mark><script>private-payload</script>';
  assert.equal((await service.save('editor', input)).ok, true);
  const loaded = await service.load('editor', 'note');
  assert.equal(loaded.ok, true);
  const document = loaded.value.record.document;
  failure(renderEditorJsHtml(document, options), 'unsafe_html');
  const preview = renderEditorJsHtml(document, { ...options, mode: 'preview' });
  assert.equal(preview.status, 'preview');
  assert.ok(preview.diagnostics.some((item) => item.code === 'unsafe_html'));
  assert.equal(
    JSON.stringify(preview.diagnostics).includes('private-payload'),
    false,
  );
  rendered.unsafe = preview.html;
  assert.deepEqual(document, input.document);
  const http = await stored({
    blocks: [paragraph('<a href="http://example.invalid">Link</a>')],
  });
  const strict = createEditorJsHtmlRenderer({ urls: { httpsOnly: true } });
  failure(strict.render(http), 'unsafe_html');
  assert.equal(renderEditorJsHtml(http).status, 'success');
  failure(strict.render(http), 'unsafe_html');
});

await test('S4: persisted callback data still enters the common HTML safety boundary', async () => {
  const document = await stored({
    blocks: [
      {
        type: 'third-party',
        data: {
          html: '<p onclick="run()">Safe</p><script>private-payload</script>',
        },
      },
    ],
  });
  const custom = {
    blocks: [
      {
        name: 'third-party',
        validate: (data) => isObject(data) && typeof data.html === 'string',
        render: (data) => data.html,
      },
    ],
  };
  failure(renderEditorJsHtml(document, custom), 'unsafe_html');
  const preview = renderEditorJsHtml(document, { ...custom, mode: 'preview' });
  assert.equal(preview.status, 'preview');
  assert.ok(preview.diagnostics.some((item) => item.code === 'unsafe_html'));
  rendered.customUnsafe = preview.html;
});

writeFileSync('persistence-rendered.json', JSON.stringify(rendered));
