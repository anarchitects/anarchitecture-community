import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

for (const name of ['window', 'document', 'HTMLElement', 'customElements']) {
  Object.defineProperty(globalThis, name, {
    get() {
      throw new Error(`Unexpected browser access: ${name}`);
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
]) {
  assert.throws(() => require.resolve(name), { code: 'MODULE_NOT_FOUND' });
}
const {
  prepareNotebookRecord,
  requireNotebookForEditing,
  readCurrentRawForEditing,
} = await import('./compiled/evolution.js');
const { legacyRecord, currentRecord } = await import(
  './compiled/migration-fixtures.js'
);
const { MemoryTextStore } = await import('./compiled/memory-store.js');
const { loadRecord, saveRecord, encodeRaw } = await import(
  './compiled/persistence.js'
);
const legacy = () => structuredClone(legacyRecord);
const current = () => structuredClone(currentRecord);
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function editable() {
  return {
    id: 'note-1',
    revision: 'r1',
    document: {
      blocks: [
        {
          id: 'x',
          type: 'callout',
          data: { text: '<mark>hello</mark>', tone: 'warning' },
          tunes: { flag: { flagged: false } },
        },
        { type: 'paragraph', data: { text: 'Unchanged' } },
      ],
    },
    provenance: {
      schema: { id: 'example/editorial-notebook', version: '2' },
      toolVersions: { callout: '2', paragraph: '1' },
    },
  };
}

test('archived explicit destination matches migration of a frozen source', () => {
  const input = freeze(legacy());
  const result = prepareNotebookRecord(input);
  assert.equal(result.status, 'migrated');
  assert.deepEqual(result.record, currentRecord);
  assert.deepEqual(input, legacyRecord);
  result.record.document.blocks[1].data.text = 'changed';
  result.record.provenance.archive.retained.push(2);
  assert.deepEqual(input, legacyRecord);
});

test('loading and migration never write back; explicit save reloads as current', async () => {
  const store = new MemoryTextStore();
  await saveRecord(store, legacy());
  const bytes = await store.read();
  let writes = 0;
  const tracked = {
    read: () => store.read(),
    write: async (text) => {
      writes++;
      await store.write(text);
    },
  };
  const result = prepareNotebookRecord(await loadRecord(tracked));
  assert.equal(writes, 0);
  assert.equal(await store.read(), bytes);
  await saveRecord(tracked, result.record);
  assert.equal(writes, 1);
  for (let i = 0; i < 3; i++) {
    const loaded = prepareNotebookRecord(await loadRecord(tracked));
    assert.equal(loaded.status, 'current');
    assert.deepEqual(loaded.record, currentRecord);
  }
  assert.equal(writes, 1);
});

test('current input is detached and never remigrated', () => {
  const input = freeze(current());
  const result = prepareNotebookRecord(input);
  assert.equal(result.status, 'current');
  assert.deepEqual(result.record, input);
  assert.notEqual(result.record, input);
  assert.notEqual(
    result.record.document.blocks[0].data,
    input.document.blocks[0].data,
  );
});

test('missing and unsupported schema never guess from Editor.js or raw extensions', () => {
  for (const mutate of [
    (r) => {
      delete r.provenance;
    },
    (r) => {
      r.provenance = {};
    },
    (r) => {
      delete r.provenance.schema;
    },
  ]) {
    const input = current();
    mutate(input);
    assert.throws(() => prepareNotebookRecord(input), {
      code: 'missing_schema',
    });
  }
  for (const schema of [
    { id: 'other', version: '2' },
    { id: 'example/editorial-notebook', version: '99' },
    { id: 'example/editorial-notebook', version: '2.0.0' },
  ]) {
    const input = current();
    input.provenance.schema = schema;
    assert.throws(() => prepareNotebookRecord(input), {
      code: 'unsupported_schema',
    });
  }
  const raw = editable().document;
  assert.throws(() => readCurrentRawForEditing(encodeRaw(raw)), {
    code: 'raw_profile_required',
  });
  assert.throws(() => readCurrentRawForEditing(encodeRaw(raw), 'guess'), {
    code: 'raw_profile_required',
  });
  assert.deepEqual(
    readCurrentRawForEditing(encodeRaw(raw), 'notebook-v2'),
    raw,
  );
  assert.equal(Object.hasOwn(raw, 'schema'), false);
  assert.equal(Object.hasOwn(raw, 'version'), false);
});

test('supplied producer and tool versions use exact independent allowlists', () => {
  for (const mutate of [
    (r) => {
      r.document.version = '1';
    },
    (r) => {
      r.provenance.producer.name = 'other';
    },
    (r) => {
      r.provenance.producer.version = '99';
    },
    (r) => {
      r.provenance.toolVersions.aside = '1.0.0';
    },
    (r) => {
      r.provenance.toolVersions.paragraph = 'future';
    },
  ]) {
    const input = legacy();
    mutate(input);
    assert.throws(() => prepareNotebookRecord(input), {
      code: 'unsupported_version',
    });
  }
  const stale = current();
  stale.provenance.toolVersions.aside = '1';
  assert.throws(() => prepareNotebookRecord(stale), {
    code: 'unsupported_version',
  });
  const source = legacy();
  delete source.document.version;
  delete source.provenance.producer;
  const result = prepareNotebookRecord(source).record;
  assert.equal(Object.hasOwn(result.document, 'version'), false);
  assert.equal(Object.hasOwn(result.provenance, 'producer'), false);
});

test('optional tool provenance is neither synthesized nor lost', () => {
  for (const versions of [
    undefined,
    {},
    { paragraph: '1' },
    { aside: '1' },
    { aside: '1', archivedTool: 'future' },
  ]) {
    const input = legacy();
    if (versions === undefined) delete input.provenance.toolVersions;
    else input.provenance.toolVersions = versions;
    const result = prepareNotebookRecord(input).record;
    assert.equal(
      Object.hasOwn(result.provenance, 'toolVersions'),
      versions !== undefined,
    );
    const expected = versions === undefined ? undefined : { ...versions };
    if (expected && Object.hasOwn(expected, 'aside')) {
      delete expected.aside;
      expected.callout = '2';
    }
    assert.deepEqual(result.provenance.toolVersions, expected);
  }
});

test('field, block-name and provenance collisions reject rather than overwrite', () => {
  for (const mutate of [
    (r) => {
      r.document.blocks[0].data.text = 'conflict';
    },
    (r) => {
      r.document.blocks.push({
        type: 'callout',
        data: { text: 'present', tone: 'info' },
      });
    },
    (r) => {
      r.provenance.toolVersions.callout = '2';
    },
    (r) => {
      delete r.provenance.toolVersions.aside;
      r.provenance.toolVersions.callout = '2';
    },
  ]) {
    const input = legacy();
    mutate(input);
    const before = structuredClone(input);
    assert.throws(() => prepareNotebookRecord(input), { code: 'collision' });
    assert.deepEqual(input, before);
  }
});

test('source and target validation are separate and failure leaves all storage unchanged', async () => {
  for (const [mutate, code] of [
    [
      (r) => {
        r.provenance.schema.version = '99';
      },
      'unsupported_schema',
    ],
    [
      (r) => {
        r.document.blocks[0].data.message = 42;
      },
      'source_invalid',
    ],
    [
      (r) => {
        r.document.blocks[0].data.tone = 'danger';
      },
      'source_invalid',
    ],
    [
      (r) => {
        r.document.blocks[0].tunes.flag.flagged = 'true';
      },
      'source_invalid',
    ],
    [
      (r) => {
        r.document.blocks[0].data.message = 'x'.repeat(2001);
      },
      'target_invalid',
    ],
    [
      (r) => {
        r.document.blocks[1].type = 'unknown';
      },
      'source_invalid',
    ],
    [
      (r) => {
        r.document.blocks = [r.document.blocks[1]];
      },
      'no_legacy_block',
    ],
  ]) {
    const input = legacy();
    mutate(input);
    const before = structuredClone(input);
    const store = new MemoryTextStore();
    await saveRecord(store, input);
    const bytes = await store.read();
    assert.throws(() => prepareNotebookRecord(input), { code });
    assert.deepEqual(input, before);
    assert.equal(await store.read(), bytes);
  }
});

test('current records and raw content must pass configured-name and tune checks', () => {
  for (const mutate of [
    (r) => {
      r.document.blocks[0].data.text = 3;
    },
    (r) => {
      r.document.blocks[0].data.tone = 'danger';
    },
    (r) => {
      r.document.blocks[0].type = 'other';
    },
    (r) => {
      r.document.blocks[0].tunes.flag = null;
    },
  ]) {
    const input = editable();
    mutate(input);
    assert.throws(() => prepareNotebookRecord(input), {
      code: 'target_invalid',
    });
    assert.throws(
      () => readCurrentRawForEditing(encodeRaw(input.document), 'notebook-v2'),
      { code: 'target_invalid' },
    );
  }
});

test('archival extensions survive but each unsupported editor field is rejected independently', () => {
  assert.deepEqual(requireNotebookForEditing(editable()), editable());
  for (const mutate of [
    (r) => {
      r.document.schema = { raw: true };
    },
    (r) => {
      r.document.blocks[0].extension = true;
    },
    (r) => {
      r.document.blocks[0].data.extension = true;
    },
    (r) => {
      r.document.blocks[0].tunes.review = { keep: true };
    },
    (r) => {
      r.document.blocks[0].tunes.flag.extension = true;
    },
    (r) => {
      r.provenance.toolVersions.archivedTool = 'future';
    },
  ]) {
    const input = editable();
    mutate(input);
    assert.deepEqual(prepareNotebookRecord(input).record, input);
    assert.throws(() => requireNotebookForEditing(input), {
      code: 'editing_unsupported',
    });
    assert.deepEqual(prepareNotebookRecord(input).record, input);
  }
  assert.throws(() => requireNotebookForEditing(legacy()), {
    code: 'editing_unsupported',
  });
});

test('bounds, malformed sidecars, non-JSON values and duplicate IDs fail before transformation', () => {
  for (const mutate of [
    (r) => {
      r.provenance.schema.version = undefined;
    },
    (r) => {
      r.document.blocks[0].data.callback = () => 1;
    },
    (r) => {
      r.document.blocks[1].id = 'first';
    },
    (r) => {
      r.document.blocks[0].data.message = 'x'.repeat(65536);
    },
  ]) {
    const input = legacy();
    mutate(input);
    assert.throws(() => prepareNotebookRecord(input));
    assert.equal(input.provenance.schema.version === '2', false);
  }
  const input = legacy();
  input.document.blocks = Array.from({ length: 129 }, () => ({
    type: 'aside',
    data: { message: '', tone: 'info' },
  }));
  assert.throws(() => prepareNotebookRecord(input), { code: 'source_invalid' });
  input.document.blocks.pop();
  assert.equal(prepareNotebookRecord(input).record.document.blocks.length, 128);
});

test('prototype-like JSON keys, inline markers and tune values survive detached migration', () => {
  const input = legacy();
  Object.assign(
    input.document.blocks[0].data,
    JSON.parse('{"constructor":{"x":1}}'),
  );
  Object.defineProperty(input.document.blocks[0].data, '__proto__', {
    value: { retained: true },
    enumerable: true,
  });
  const result = prepareNotebookRecord(input).record;
  assert.equal(
    Object.hasOwn(result.document.blocks[0].data, '__proto__'),
    true,
  );
  assert.deepEqual(result.document.blocks[0].data.__proto__, {
    retained: true,
  });
  assert.deepEqual(result.document.blocks[0].data.constructor, { x: 1 });
  assert.equal(
    result.document.blocks[0].data.text,
    'Hello <mark>reader</mark>',
  );
  assert.deepEqual(
    result.document.blocks[0].tunes,
    input.document.blocks[0].tunes,
  );
  assert.equal({}.retained, undefined);
});

test('rejected explicit write preserves the migration candidate and original', async () => {
  const store = new MemoryTextStore();
  await saveRecord(store, legacy());
  const candidate = prepareNotebookRecord(await loadRecord(store)).record;
  const before = structuredClone(candidate);
  store.failNextWrite();
  await assert.rejects(saveRecord(store, candidate), { stage: 'write' });
  assert.deepEqual(candidate, before);
  assert.deepEqual(await loadRecord(store), legacyRecord);
});
