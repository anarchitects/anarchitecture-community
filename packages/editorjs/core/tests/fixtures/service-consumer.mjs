import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

for (const name of ['window', 'document', 'HTMLElement', 'EditorJS']) {
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
])
  assert.throws(() => require.resolve(name), { code: 'MODULE_NOT_FOUND' });
const { MemoryNotebookRepository, NotebookService } = await import(
  './compiled/notebook-service.js'
);
const { decodeRecord, encodeRecord } = await import(
  './compiled/persistence.js'
);
const request = () => ({
  id: 'note',
  expectedRevision: null,
  document: {
    blocks: [
      {
        type: 'callout',
        data: { text: 'Original', tone: 'info' },
        tunes: { flag: { flagged: true } },
      },
    ],
  },
  provenance: {
    schema: { id: 'example/editorial-notebook', version: '2' },
    toolVersions: { callout: '2' },
    archive: { retained: true },
  },
});
function setup() {
  const repository = new MemoryNotebookRepository();
  const calls = { reads: 0, writes: 0 };
  const service = new NotebookService(
    {
      read: (id) => {
        calls.reads++;
        return repository.read(id);
      },
      commit: (record, revision) => {
        calls.writes++;
        return repository.commit(record, revision);
      },
    },
    (principal) => principal === 'editor',
  );
  return { repository, service, calls };
}
const failure = (result, code, stage) => {
  assert.equal(result.ok, false);
  assert.equal(result.error.code, code);
  if (stage) assert.equal(result.error.stage, stage);
};

test('stored acknowledgements and reloads detach document, tunes and provenance', async () => {
  const { service, repository } = setup();
  const input = request();
  const original = structuredClone(input);
  const saved = await service.save('editor', input);
  assert.equal(saved.ok, true);
  assert.equal(saved.value.migration, 'current');
  assert.deepEqual(input, original);
  assert.equal(saved.value.record.revision, 'r1');
  assert.deepEqual(saved.value.record.document, original.document);
  const bytes = await repository.read('note');
  input.document.blocks[0].data.text = 'Mutated input';
  saved.value.record.provenance.archive.retained = false;
  const loaded = await service.load('editor', 'note');
  assert.deepEqual(loaded.value.record, decodeRecord(bytes));
  loaded.value.record.document.blocks.length = 0;
  assert.equal(await repository.read('note'), bytes);
});

test('unknown request shape is rejected without evaluating accessors or invoking storage', async () => {
  const { service, calls } = setup();
  const accessor = request();
  Object.defineProperty(accessor, 'document', {
    get() {
      assert.fail('getter invoked');
    },
    enumerable: true,
  });
  const hidden = request();
  Object.defineProperty(hidden, 'secret', { value: 'credential' });
  class Dto {
    constructor() {
      Object.assign(this, request());
    }
  }
  for (const value of [
    null,
    [],
    'json',
    {},
    new Dto(),
    accessor,
    hidden,
    { ...request(), extra: true },
    { ...request(), principal: 'editor' },
    { ...request(), [Symbol('secret')]: true },
    { ...request(), id: '../other' },
    { ...request(), expectedRevision: 'arbitrary' },
    { ...request(), expectedRevision: undefined },
    { id: 'note', expectedRevision: null },
  ]) {
    failure(await service.save('editor', value), 'invalid_request', 'request');
  }
  failure(await service.load('editor', {}), 'invalid_request');
  assert.deepEqual(calls, { reads: 0, writes: 0 });
});

test('invalid, unsupported and migration-rejected input never reaches the writer', async () => {
  const { service, repository, calls } = setup();
  await service.save('editor', request());
  const bytes = await repository.read('note');
  const cases = [
    [{ ...request(), document: null }, 'invalid_content'],
    [
      {
        ...request(),
        document: {
          blocks: [
            { type: 'callout', data: { text: 'private payload', tone: 'bad' } },
          ],
        },
      },
      'invalid_content',
    ],
    [{ ...request(), provenance: undefined }, 'invalid_content'],
    [
      { id: 'note', expectedRevision: null, document: request().document },
      'unsupported_content',
    ],
    [
      {
        ...request(),
        provenance: {
          schema: { id: 'example/editorial-notebook', version: 'future' },
        },
      },
      'unsupported_content',
    ],
    [
      { ...request(), document: { ...request().document, extra: true } },
      'unsupported_content',
    ],
    [
      {
        ...request(),
        document: {
          blocks: [
            {
              type: 'aside',
              data: { message: 'x', text: 'collision', tone: 'info' },
            },
          ],
        },
        provenance: {
          schema: { id: 'example/editorial-notebook', version: '1' },
        },
      },
      'migration_failed',
    ],
  ];
  for (const [value, code] of cases) {
    const original = structuredClone(value);
    const result = await service.save('editor', value);
    failure(result, code);
    assert.deepEqual(value, original);
    assert.ok(JSON.stringify(result).length < 200);
    assert.ok(!JSON.stringify(result).includes('private payload'));
    assert.equal(await repository.read('note'), bytes);
  }
  assert.equal(calls.writes, 1);
});

test('two concurrent creates and stale updates have one winner and preserve it', async () => {
  const { service, repository } = setup();
  const creates = await Promise.all([
    service.save('editor', request()),
    service.save('editor', request()),
  ]);
  assert.equal(creates.filter((result) => result.ok).length, 1);
  failure(
    creates.find((result) => !result.ok),
    'conflict',
    'write',
  );
  const update = {
    ...request(),
    expectedRevision: 'r1',
    document: { blocks: [] },
  };
  const updates = await Promise.all([
    service.save('editor', update),
    service.save('editor', update),
  ]);
  assert.equal(updates.filter((result) => result.ok).length, 1);
  const bytes = await repository.read('note');
  assert.equal(decodeRecord(bytes).revision, 'r2');
  failure(await service.save('editor', request()), 'conflict');
  assert.equal(await repository.read('note'), bytes);
});

test('failed writes do not consume a revision, acknowledge success or alter stored bytes', async () => {
  const { service, repository } = setup();
  await service.save('editor', request());
  const bytes = await repository.read('note');
  repository.failNextWrite();
  const update = {
    ...request(),
    expectedRevision: 'r1',
    document: { blocks: [] },
  };
  failure(await service.save('editor', update), 'unavailable', 'write');
  assert.equal(await repository.read('note'), bytes);
  assert.equal(
    (await service.save('editor', update)).value.record.revision,
    'r2',
  );
});

test('bounded repository refuses the ninth creation without eviction and still permits updates', async () => {
  const { service, repository } = setup();
  for (let index = 0; index < 8; index++)
    assert.equal(
      (await service.save('editor', { ...request(), id: `note-${index}` })).ok,
      true,
    );
  failure(await service.save('editor', request()), 'capacity', 'write');
  assert.equal(await repository.read('note'), undefined);
  const loaded = await service.load('editor', 'note-0');
  assert.equal(
    (
      await service.save('editor', {
        ...request(),
        id: 'note-0',
        expectedRevision: loaded.value.record.revision,
      })
    ).ok,
    true,
  );
});

test('authorization denies read/write without storage access and exceptions are sanitized', async () => {
  const { service, repository, calls } = setup();
  failure(await service.save('other', request()), 'forbidden');
  failure(await service.load('other', 'note'), 'forbidden');
  assert.deepEqual(calls, { reads: 0, writes: 0 });
  const broken = new NotebookService(repository, () => {
    throw new Error('credential-secret');
  });
  assert.deepEqual(await broken.save('editor', request()), {
    ok: false,
    error: { code: 'unavailable', stage: 'authorization' },
  });
});

test('pending authorization cannot change the submitted snapshot or precondition', async () => {
  const repository = new MemoryNotebookRepository();
  let allow;
  const permission = new Promise((resolve) => {
    allow = resolve;
  });
  const service = new NotebookService(repository, () => permission);
  const input = request();
  const pending = service.save('editor', input);
  input.id = 'changed';
  input.expectedRevision = 'r99';
  input.document.blocks[0].data.text = 'changed';
  input.provenance.schema.version = 'future';
  allow(true);
  const result = await pending;
  assert.equal(result.ok, true);
  assert.equal(result.value.record.id, 'note');
  assert.equal(result.value.record.document.blocks[0].data.text, 'Original');
  assert.equal(await repository.read('changed'), undefined);
});

test('legacy load prepares without writeback; explicit revisioned save stores the shared migration', async () => {
  const { repository, service, calls } = setup();
  const legacy = {
    id: 'note',
    revision: 'imported',
    document: {
      blocks: [
        {
          type: 'aside',
          data: { message: 'Old', tone: 'info' },
          tunes: { flag: { flagged: false } },
        },
      ],
    },
    provenance: {
      schema: { id: 'example/editorial-notebook', version: '1' },
      toolVersions: { aside: '1' },
    },
  };
  // Trusted import port: bypassing the service is never an untrusted API.
  await repository.commit(legacy, null);
  const bytes = await repository.read('note');
  const loaded = await service.load('editor', 'note');
  assert.equal(loaded.value.migration, 'migrated');
  assert.equal(loaded.value.record.document.blocks[0].type, 'callout');
  assert.equal(await repository.read('note'), bytes);
  assert.equal(calls.writes, 0);
  const { id, document, provenance, revision } = loaded.value.record;
  const saved = await service.save('editor', {
    id,
    document,
    provenance,
    expectedRevision: revision,
  });
  assert.equal(saved.value.record.revision, 'r2');
  assert.equal(
    (await service.load('editor', 'note')).value.migration,
    'current',
  );
  const direct = await service.save('editor', {
    ...legacy,
    revision: undefined,
  });
  failure(direct, 'invalid_request');
  const migratedSave = await service.save('editor', {
    id: 'other',
    document: legacy.document,
    provenance: legacy.provenance,
    expectedRevision: null,
  });
  assert.equal(migratedSave.value.migration, 'migrated');
  assert.deepEqual(
    migratedSave.value.record.document,
    saved.value.record.document,
  );
});

test('missing, corrupt, mismatched and unsupported reads never become empty documents or writes', async () => {
  const { service } = setup();
  failure(await service.load('editor', 'note'), 'not_found', 'read');
  for (const text of [
    '{',
    encodeRecord({ id: 'other', revision: 'r1', document: { blocks: [] } }),
    encodeRecord({
      id: 'note',
      revision: 'r1',
      document: { blocks: [] },
      provenance: {
        schema: { id: 'example/editorial-notebook', version: 'future' },
      },
    }),
  ]) {
    const readOnly = new NotebookService(
      {
        read: async () => text,
        commit: async () => assert.fail('write during load'),
      },
      () => true,
    );
    const result = await readOnly.load('editor', 'note');
    assert.equal(result.ok, false);
    assert.equal(result.error.stage, 'read');
  }
  const broken = new NotebookService(
    {
      read: async () => {
        throw new Error('storage-credential');
      },
      commit: async () => {
        throw new Error('storage-credential');
      },
    },
    () => true,
  );
  assert.deepEqual(await broken.load('editor', 'note'), {
    ok: false,
    error: { code: 'unavailable', stage: 'read' },
  });
  assert.deepEqual(await broken.save('editor', request()), {
    ok: false,
    error: { code: 'unavailable', stage: 'write' },
  });
});

test('oversized and invalid tune data fail before writing; independent repositories do not share state', async () => {
  const { service, calls } = setup();
  const oversized = request();
  oversized.provenance.archive = 'x'.repeat(65_536);
  failure(await service.save('editor', oversized), 'invalid_content');
  const tune = request();
  tune.document.blocks[0].tunes.flag.flagged = 'true';
  failure(await service.save('editor', tune), 'invalid_content');
  assert.equal(calls.writes, 0);
  await service.save('editor', request());
  failure(await setup().service.load('editor', 'note'), 'not_found');
});
