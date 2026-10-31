import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

// Execute only the shipped, extracted implementation in an external consumer.
for (const name of ['window', 'document', 'HTMLElement', 'customElements']) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
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
const { MemoryTextStore } = await import('./compiled/memory-store.js');
const {
  MAX_TEXT_LENGTH,
  boundedText,
  decodeRaw,
  encodeRaw,
  decodeRecord,
  encodeRecord,
  loadRaw,
  saveRaw,
  loadRecord,
  saveRecord,
} = await import('./compiled/persistence.js');

const document = () =>
  JSON.parse(
    '{"time":123,"version":"2.31.7","schema":{"raw":true},"toolVersions":{"raw":"extension"},"document":{"raw":true},"__proto__":{"safe":true},"blocks":[{"id":"first","type":"future-tool","data":{"nested":[null,false,1,{"x":"y"}]},"tunes":{"unknown":{"enabled":false}},"extension":{"keep":true}},{"type":"paragraph","data":{"text":"second"}}]}',
  );
const record = () => ({
  id: ' note-1 ',
  revision: ' r1 ',
  document: document(),
});

test('raw storage preserves semantic JSON, detached reads, missing metadata and input', async () => {
  const input = document();
  const before = structuredClone(input);
  const store = new MemoryTextStore();
  assert.equal(await loadRaw(store), undefined);
  await saveRaw(store, input);
  assert.deepEqual(input, before);
  input.blocks.reverse();
  const loaded = await loadRaw(store);
  assert.deepEqual(loaded, before);
  loaded.blocks[0].data.nested.push('new');
  assert.deepEqual(await loadRaw(store), before);
  assert.deepEqual(decodeRaw(encodeRaw({ blocks: [] })), { blocks: [] });
  assert.equal(Object.hasOwn((await loadRaw(store)).blocks[1], 'id'), false);
});

test('record mode preserves opaque provenance and distinguishes omitted from empty', async () => {
  const store = new MemoryTextStore();
  assert.equal(await loadRecord(store), undefined);
  for (const provenance of [
    undefined,
    {},
    {
      schema: { id: 'future', version: '999' },
      toolVersions: { 'future-tool': 'opaque' },
      extension: { keep: [true] },
    },
  ]) {
    const input = {
      ...record(),
      ...(provenance === undefined ? {} : { provenance }),
    };
    const before = structuredClone(input);
    await saveRecord(store, input);
    assert.deepEqual(await loadRecord(store), before);
    assert.deepEqual(input, before);
    assert.equal(
      Object.hasOwn(await loadRecord(store), 'provenance'),
      provenance !== undefined,
    );
  }
});

test('explicit format selection rejects wrong mappings and unsafe record properties', () => {
  assert.throws(() => decodeRecord(encodeRaw(document())), { stage: 'record' });
  assert.throws(() => decodeRaw(encodeRecord(record())), { stage: 'parse' });
  for (const input of [
    null,
    [],
    { ...record(), id: '' },
    { ...record(), revision: ' ' },
    { ...record(), extra: true },
    { ...record(), [Symbol('x')]: 1 },
    Object.create(record()),
  ]) {
    assert.throws(() => encodeRecord(input), { stage: 'record' });
  }
  let calls = 0;
  assert.throws(
    () =>
      encodeRecord({
        ...record(),
        get provenance() {
          calls++;
          return {};
        },
      }),
    { stage: 'record' },
  );
  assert.throws(
    () =>
      encodeRecord({
        ...record(),
        toJSON() {
          calls++;
          return {};
        },
      }),
    { stage: 'record' },
  );
  assert.throws(
    () =>
      encodeRecord(
        Object.defineProperty(record(), 'id', {
          value: 'x',
          enumerable: false,
        }),
      ),
    { stage: 'record' },
  );
  assert.equal(calls, 0);
  for (const provenance of [
    undefined,
    null,
    [],
    { schema: { id: 'missing-version' } },
  ]) {
    assert.throws(() => encodeRecord({ ...record(), provenance }), {
      stage: 'provenance',
    });
  }
  assert.throws(
    () => encodeRecord({ ...record(), document: JSON.stringify(document()) }),
    { stage: 'document' },
  );
});

test('non-JSON input fails before storage without invoking getters or toJSON', async () => {
  let writes = 0;
  let calls = 0;
  const store = {
    write: async () => {
      writes++;
    },
  };
  const cyclic = {};
  cyclic.self = cyclic;
  for (const value of [
    undefined,
    () => 1,
    1n,
    NaN,
    Infinity,
    cyclic,
    new Date(),
    {
      get text() {
        calls++;
        return 'bad';
      },
    },
    {
      toJSON() {
        calls++;
        return {};
      },
    },
  ]) {
    const input = { blocks: [{ type: 'test', data: { value } }] };
    await assert.rejects(saveRaw(store, input), { stage: 'document' });
    await assert.rejects(saveRecord(store, { ...record(), document: input }), {
      stage: 'document',
    });
    assert.equal(input.blocks[0].data.value, value);
  }
  assert.equal(writes, 0);
  assert.equal(calls, 0);
  const frozen = Object.freeze({ blocks: Object.freeze([]) });
  assert.deepEqual(decodeRaw(encodeRaw(frozen)), { blocks: [] });
});

test('validation policy applies to reading and writing, independently of tunes', () => {
  const options = { unknownTools: 'reject' };
  for (const operation of [
    () => encodeRaw(document(), options),
    () => decodeRaw(encodeRaw(document()), options),
    () => encodeRecord(record(), options),
    () => decodeRecord(encodeRecord(record()), options),
  ]) {
    assert.throws(operation, { stage: 'document' });
  }
  const duplicate = {
    blocks: [
      { id: 'x', type: 'x', data: {} },
      { id: 'x', type: 'x', data: {} },
    ],
  };
  assert.throws(() => encodeRaw(duplicate), { stage: 'document' });
  assert.deepEqual(decodeRaw(encodeRaw(document())).blocks[0].tunes, {
    unknown: { enabled: false },
  });
});

test('text bounds apply before decoding and before storage, with an exact boundary', async () => {
  const store = new MemoryTextStore();
  const base = { blocks: [], padding: '' };
  const input = {
    ...base,
    padding: 'x'.repeat(MAX_TEXT_LENGTH - encodeRaw(base).length),
  };
  await saveRaw(store, input);
  assert.equal((await store.read()).length, MAX_TEXT_LENGTH);
  assert.deepEqual(await loadRaw(store), input);
  await assert.rejects(
    saveRaw(store, { ...input, padding: input.padding + 'x' }),
    { stage: 'size' },
  );
  assert.deepEqual(await loadRaw(store), input);
  assert.throws(() => decodeRaw(' '.repeat(MAX_TEXT_LENGTH + 1)), {
    stage: 'size',
  });
  assert.throws(() => decodeRecord(' '.repeat(MAX_TEXT_LENGTH + 1)), {
    stage: 'size',
  });
  assert.throws(() => boundedText(42), { stage: 'parse' });
  await assert.rejects(store.write('x'.repeat(MAX_TEXT_LENGTH + 1)), {
    stage: 'size',
  });
});

test('read failures and corrupt content are distinct from absent content', async () => {
  for (const load of [loadRaw, loadRecord]) {
    await assert.rejects(
      load({
        read: async () => {
          throw new Error('private payload');
        },
      }),
      { stage: 'read', message: 'Persistence failed at read.' },
    );
    await assert.rejects(load({ read: async () => '{' }), { stage: 'parse' });
  }
});

test('failed writes retain caller drafts and the demonstration store, then recover', async () => {
  for (const [save, load, original, changed] of [
    [saveRaw, loadRaw, document(), { blocks: [] }],
    [saveRecord, loadRecord, record(), { ...record(), revision: 'r2' }],
  ]) {
    const store = new MemoryTextStore();
    await save(store, original);
    const before = structuredClone(changed);
    store.failNextWrite();
    await assert.rejects(save(store, changed), { stage: 'write' });
    assert.deepEqual(changed, before);
    assert.deepEqual(await load(store), original);
    await save(store, changed);
    assert.deepEqual(await load(store), changed);
  }
  assert.equal(await new MemoryTextStore().read(), undefined);
});

test('save acknowledges only after write and captures the submitted snapshot', async () => {
  let release;
  let stored;
  let acknowledged = false;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  const input = document();
  const before = structuredClone(input);
  const pending = saveRaw(
    {
      write: async (text) => {
        stored = text;
        await wait;
      },
    },
    input,
  ).then(() => {
    acknowledged = true;
  });
  input.blocks.reverse();
  await Promise.resolve();
  assert.equal(acknowledged, false);
  release();
  await pending;
  assert.equal(acknowledged, true);
  assert.deepEqual(decodeRaw(stored), before);
});

test('serialization failure never invokes storage or exposes the original exception', async () => {
  const original = JSON.stringify;
  let writes = 0;
  const input = document();
  const before = structuredClone(input);
  let pending;
  try {
    JSON.stringify = () => {
      throw new Error('private payload');
    };
    pending = saveRaw(
      {
        write: async () => {
          writes++;
        },
      },
      input,
    );
  } finally {
    JSON.stringify = original;
  }
  await assert.rejects(pending, {
    stage: 'serialize',
    message: 'Persistence failed at serialize.',
  });
  assert.equal(writes, 0);
  assert.deepEqual(input, before);
});
