# Persist raw JSON or a consumer-owned record

This complete local example validates, encodes, stores and reloads Editor.js
content without Angular, Forms, Nest, Nx or an installed browser tool. Choose raw
`OutputData` JSON when that suits your storage, or map it into your own record.
Neither choice is a required package format. The files below are copied
application source, not exports from `@anarchitects/editorjs-core`.

The supplied store holds one string, limited to 65,536 UTF-16 code units, for the
lifetime of one instance. It is useful for trying both formats and failure
handling; it is **not durable storage**. Closing the process loses its contents.
There is no file, database, network request, credential or background resource.

After the round trip, [apply an explicit content migration](#apply-an-explicit-content-migration)
to see how application schema policy differs from storage and editing policy.
Then use the [portable service and optional Nest composition](service.md) to
apply the same helpers at an unknown-input boundary with authorization and
repository-owned revision checks.

## Install and run

Use Node 22.12.0 or newer and an empty directory. Run `npm init -y`, followed by:

```sh
npm pkg set type=module
npm install @anarchitects/editorjs-core
npm install --save-dev typescript@6.0.3
```

Before initial publication, replace the core package name with the supplied
`anarchitects-editorjs-core-0.0.1.tgz` path. Use this guide from the same installed
package version. No repository checkout is needed.

Copy `persistence.ts`, `memory-store.ts` and `main.mjs` from the sections below
into that directory. Save this configuration as `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": [],
    "strict": true,
    "skipLibCheck": false,
    "outDir": "compiled"
  },
  "files": ["persistence.ts", "memory-store.ts"]
}
```

Then run:

```sh
npx tsc -p tsconfig.json
node main.mjs
```

Expected output:

```text
raw: 2 blocks reloaded
record: note-1 at r1; provenance present
write rejected; previous raw content preserved
```

The two TypeScript files also compile with `module: "ESNext"` and
`moduleResolution: "Bundler"`. They need only ES2022 library types; `main.mjs`
uses Node's assertion module solely to check the demonstration's result.

## Validate and map explicitly

Save as `persistence.ts`. Raw decoding uses core's parser; encoding starts with
normalization of decoded input. Validation checks IDs and any supplied tool
validators. Unknown tools are allowed by core's default, so a storage round trip
is not approval to open the content in an editor or publish its HTML.

The illustrative record accepts exactly `id`, `revision`, `document` and optional
decoded `provenance`. IDs/revisions are nonblank strings retained without
trimming. A revision here is stored metadata, **not a compare-and-write check**.
Unknown record fields and explicitly undefined provenance are rejected. Omitted
provenance and an empty sidecar remain distinct. Record mode never auto-detects
raw JSON; raw fields named `schema`, `toolVersions` or `document` remain ordinary
document extensions.

<!-- persistence-example-file: persistence.ts -->

```ts
import {
  normalizeOutputData,
  parseContentWithProvenance,
  parseOutputData,
  validateOutputData,
} from '@anarchitects/editorjs-core';
import type {
  ContentProvenance,
  OutputData,
  OutputDataValidationOptions,
} from '@anarchitects/editorjs-core';

export const MAX_TEXT_LENGTH = 65_536;
export type FailureStage =
  | 'size'
  | 'parse'
  | 'document'
  | 'record'
  | 'provenance'
  | 'serialize'
  | 'read'
  | 'write';

export class PersistenceError extends Error {
  constructor(readonly stage: FailureStage) {
    super(`Persistence failed at ${stage}.`);
    this.name = 'PersistenceError';
  }
}

export interface TextStore {
  read(): Promise<string | undefined>;
  write(text: string): Promise<void>;
}

export interface NotebookRecord {
  id: string;
  revision: string;
  document: OutputData;
  provenance?: ContentProvenance;
}

export function boundedText(text: string): string {
  if (typeof text !== 'string') throw new PersistenceError('parse');
  if (text.length > MAX_TEXT_LENGTH) throw new PersistenceError('size');
  return text;
}

function checkedDocument(
  input: unknown,
  options: OutputDataValidationOptions,
): OutputData {
  const checked = validateOutputData(input, options);
  if (!checked.ok) throw new PersistenceError('document');
  return checked.data;
}

function stringify(value: unknown): string {
  let text: string | undefined;
  try {
    text = JSON.stringify(value);
  } catch {
    throw new PersistenceError('serialize');
  }
  if (text === undefined) throw new PersistenceError('serialize');
  return boundedText(text);
}

export function decodeRaw(
  text: string,
  options: OutputDataValidationOptions = {},
): OutputData {
  const parsed = parseOutputData(boundedText(text));
  if (!parsed.ok) throw new PersistenceError('parse');
  return checkedDocument(parsed.data, options);
}

export function encodeRaw(
  input: unknown,
  options: OutputDataValidationOptions = {},
): string {
  const normalized = normalizeOutputData(input);
  if (!normalized.ok) throw new PersistenceError('document');
  return stringify(checkedDocument(normalized.data, options));
}

function checkedRecord(
  input: unknown,
  options: OutputDataValidationOptions,
): NotebookRecord {
  // Inspect the outer mapping without invoking property getters or toJSON.
  // Core validates/copies the document and sidecar, not this application record.
  let fields: Record<string, PropertyDescriptor>;
  try {
    if (input === null || typeof input !== 'object')
      throw new PersistenceError('record');
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null)
      throw new PersistenceError('record');
    const allowed = new Set(['id', 'revision', 'document', 'provenance']);
    for (const key of Reflect.ownKeys(input)) {
      const field = Object.getOwnPropertyDescriptor(input, key);
      if (
        typeof key !== 'string' ||
        !allowed.has(key) ||
        !field?.enumerable ||
        !Object.hasOwn(field, 'value')
      )
        throw new PersistenceError('record');
    }
    fields = Object.getOwnPropertyDescriptors(input);
  } catch {
    throw new PersistenceError('record');
  }
  for (const key of ['id', 'revision']) {
    if (
      !Object.hasOwn(fields, key) ||
      typeof fields[key].value !== 'string' ||
      !fields[key].value.trim()
    )
      throw new PersistenceError('record');
  }
  if (!Object.hasOwn(fields, 'document')) throw new PersistenceError('record');
  const supplied = Object.hasOwn(fields, 'provenance');
  if (supplied && fields.provenance.value === undefined)
    throw new PersistenceError('provenance');
  const normalized = normalizeOutputData(fields.document.value);
  if (!normalized.ok) throw new PersistenceError('document');
  const parsed = parseContentWithProvenance(
    normalized.data,
    supplied ? fields.provenance.value : undefined,
  );
  if (!parsed.ok) throw new PersistenceError('provenance');
  return {
    id: fields.id.value,
    revision: fields.revision.value,
    document: checkedDocument(parsed.data, options),
    ...(supplied ? { provenance: parsed.provenance } : {}),
  };
}

export function decodeRecord(
  text: string,
  options: OutputDataValidationOptions = {},
): NotebookRecord {
  boundedText(text);
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new PersistenceError('parse');
  }
  return checkedRecord(decoded, options);
}

export function encodeRecord(
  input: unknown,
  options: OutputDataValidationOptions = {},
): string {
  return stringify(checkedRecord(input, options));
}

async function write(store: TextStore, text: string): Promise<void> {
  try {
    await store.write(text);
  } catch {
    throw new PersistenceError('write');
  }
}

async function read(store: TextStore): Promise<string | undefined> {
  try {
    return await store.read();
  } catch {
    throw new PersistenceError('read');
  }
}

export async function saveRaw(
  store: TextStore,
  input: unknown,
  options: OutputDataValidationOptions = {},
): Promise<void> {
  // Encode synchronously before invoking storage or awaiting anything.
  const text = encodeRaw(input, options);
  await write(store, text);
}

export async function loadRaw(
  store: TextStore,
  options: OutputDataValidationOptions = {},
): Promise<OutputData | undefined> {
  const text = await read(store);
  return text === undefined ? undefined : decodeRaw(text, options);
}

export async function saveRecord(
  store: TextStore,
  input: unknown,
  options: OutputDataValidationOptions = {},
): Promise<void> {
  const text = encodeRecord(input, options);
  await write(store, text);
}

export async function loadRecord(
  store: TextStore,
  options: OutputDataValidationOptions = {},
): Promise<NotebookRecord | undefined> {
  const text = await read(store);
  return text === undefined ? undefined : decodeRecord(text, options);
}
```

Only validated, detached values reach `JSON.stringify`: functions, bigint,
nonfinite numbers, cycles, accessors and other unsupported data fail instead of
being silently discarded or coerced. Core's depth limit and optional-metadata
normalization still apply. The text limit is in UTF-16 code units, not network
bytes; bound incoming bytes before decoding in a real transport. The post-encode
limit does not prevent the temporary allocation needed to encode a decoded tree.
These helpers expect data, not executable proxies; reflection can invoke proxy
traps. Do not mutate global serialization hooks in a consuming application.

## A bounded local store with a visible failure

Save as `memory-store.ts`. Each instance owns its own single slot. Failure
injection rejects before changing that slot, so this demonstration can prove
retention of the previous value. Real remote failures may have unknown outcomes.

<!-- persistence-example-file: memory-store.ts -->

```ts
import { boundedText, type TextStore } from './persistence.js';

export class MemoryTextStore implements TextStore {
  #text: string | undefined;
  #failWrite = false;

  failNextWrite(): void {
    this.#failWrite = true;
  }

  async read(): Promise<string | undefined> {
    return this.#text;
  }

  async write(text: string): Promise<void> {
    boundedText(text);
    if (this.#failWrite) {
      this.#failWrite = false;
      throw new Error('Demonstration write rejected before storage.');
    }
    this.#text = text;
  }
}
```

## Run both choices

Save as `main.mjs`. Separate store instances make the format choice explicit.
The revision and provenance are supplied by this fictional Editorial Notebook,
not inferred from Editor.js or package versions. No editor is created.

<!-- persistence-example-file: main.mjs -->

```js
import assert from 'node:assert/strict';
import { MemoryTextStore } from './compiled/memory-store.js';
import {
  loadRaw,
  loadRecord,
  saveRaw,
  saveRecord,
} from './compiled/persistence.js';

const document = {
  time: 123,
  version: '2.31.7',
  schema: { external: 'raw extension, not provenance' },
  blocks: [
    {
      id: 'intro',
      type: 'callout',
      data: { text: 'Hello', tone: 'info' },
      tunes: { flag: { flagged: true } },
    },
    { type: 'future-tool', data: { untouched: [1, null, false] } },
  ],
};
const raw = new MemoryTextStore();
assert.equal(await loadRaw(raw), undefined);
await saveRaw(raw, document);
assert.deepEqual(await loadRaw(raw), document);
console.log('raw: 2 blocks reloaded');

const records = new MemoryTextStore();
const record = {
  id: 'note-1',
  revision: 'r1',
  document,
  provenance: { schema: { id: 'example/editorial-notebook', version: '2' } },
};
await saveRecord(records, record);
assert.deepEqual(await loadRecord(records), record);
console.log('record: note-1 at r1; provenance present');

raw.failNextWrite();
await assert.rejects(saveRaw(raw, { blocks: [] }), { stage: 'write' });
assert.deepEqual(await loadRaw(raw), document);
console.log('write rejected; previous raw content preserved');
```

## Policy, acknowledgement and recovery

This is semantic JSON preservation, not canonical serialization or byte-identical
source text. Whitespace, property order and numeric spelling are not a signing or
hashing contract. Missing IDs/time/version remain missing; unknown supported
document/block/data/tune extensions remain present. Supplied provenance versions
are opaque and preserved, including unknown/future values. No migration or
compatibility inference occurs.

Before **editing or publishing**, apply your explicit schema/tool-version policy,
per-tool validators and separate tune checks. Pass `OutputDataValidationOptions`
to both read and write helpers when requiring known tools or IDs. Core validators
receive block data, not tune payloads. Preserve unsupported content for recovery;
do not replace it with an empty document. A tool's browser save may drop fields
it does not understand even when storage preserves them. See the
[custom-tool guide](custom-tools.md#choose-a-recipe-and-its-ownership).

Keep caption distinct from missing, authored and deliberately decorative alt.
Storing image data does not author alt text, complete an upload or acknowledge a
document save. Upload transport, credentials and owner cancellation remain
separate. Schema success is not HTML/URL sanitization, authorization, rendering
safety or blog-publication approval.

Await the save promise before showing success. Validation/serialization failures
do not call the store. Rejected writes leave the caller's input untouched; only
this local store promises its previous value survives its injected failure.
Remote timeouts can occur after commit: cancellation does not roll back storage.
Use host revision checks, reconciliation and deliberate retry/idempotency policy
when replacing the store. A late acknowledgement applies to the submitted
snapshot, not edits made since. This example supplies no multi-writer conflict
resolution, automatic retry, migration, database transaction or durability claim.

| Symptom                 | Action                                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `parse` / `size`        | Supply bounded JSON text for decoding; transport limits are host-owned.                                                                        |
| `document`              | Check core structure/ID rules and your selected validators; do not coerce invalid payloads.                                                    |
| `record` / `provenance` | Select the correct mapper; inspect required record fields and decoded metadata. Omit absent provenance instead of assigning undefined.         |
| `serialize`             | No write occurred; retain the draft and investigate the host serialization environment.                                                        |
| `read` / `write`        | Retain the draft, report failure and determine the store's outcome before retrying. Missing storage returns undefined; corrupt storage throws. |

Errors intentionally omit payloads and underlying exception text. Hosts can
attach private diagnostics at their storage boundary without exposing content or
credentials. For package questions, use the
[issue tracker](https://github.com/anarchitects/anarchitecture-community/issues)
with runtime/package versions and a minimal non-sensitive payload.

## Apply an explicit content migration

Keep the preceding files and dependencies. Copy `evolution.ts`,
`migration-fixtures.ts` and `migrate.mjs` below into the same directory. Add
`"evolution.ts"` and `"migration-fixtures.ts"` to the `files` array in
`tsconfig.json`, then run `npx tsc -p tsconfig.json` and `node migrate.mjs`.
Both NodeNext and Bundler settings from the earlier example work. Expected output:

```text
legacy: aside.message -> callout.text; stored source unchanged
current: no migration; extensions preserved
future: unsupported; stored source unchanged
```

This fictional Notebook has one supported forward path. Labels are exact opaque
strings, not SemVer ranges or installed package versions:

| Input                                               | Policy                                                                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema `example/editorial-notebook`, version `1`    | Require at least one `aside`, validate legacy data, transform a detached candidate, then validate the entire target.                                 |
| Same schema, version `2`                            | Validate and return `current`; never apply the transformation again.                                                                                 |
| Missing schema                                      | Refuse record migration. For a known raw-current collection, explicitly call `readCurrentRawForEditing(text, 'notebook-v2')`; it adds no provenance. |
| Other schema ID or version, including future labels | Throw `unsupported_schema`; preserve the original for recovery.                                                                                      |
| Malformed document/sidecar                          | The existing codec rejects it before version selection.                                                                                              |

For legacy raw JSON, the host must supply independently known collection/schema
metadata through the explicit record mapper before migration. Payload shape and
raw fields named `schema` or `toolVersions` do not supply that authority.

The bounded profile accepts up to 128 blocks: legacy `aside` or current
`callout`, plus unchanged `paragraph` blocks. `aside.message` becomes
`callout.text`; `tone` stays `info` or `warning`. Current text must fit 2,000
UTF-16 code units, so a longer legacy message fails target validation rather
than being truncated. Existing `text`, a legacy `callout` block, or a legacy
`callout` provenance key is a collision, even if its value looks compatible.
No content is intentionally discarded: only the old field/configured name and
its supplied tool-version key are replaced. Empty/paragraph-only legacy records
are outside this example's migration; they are not upgraded by relabelling.

Supplied `aside: '1'` maps to `callout: '2'`; absent entries remain absent.
`paragraph: '1'` is the other known tool-content version. These are illustrative
payload versions, not npm versions. Unknown keys in `toolVersions` are retained
as archival metadata but block the editing gate. Unknown block types are rejected
by both migration and editing. The producer allowlist is explicitly
`editorial-notebook` with absent version or `'1'`/`'2'`; absent producer is allowed.
`OutputData.version` is separately allowed when absent or `'2.31.7'`, preserved,
and never used to choose a schema migration. Unsupported supplied versions fail.

### Transform detached data, then update provenance

Save as `evolution.ts`. The codec performs bounded structural/provenance checks;
core's tool callbacks validate configured-name **data**. The following separate
tune pass validates known `flag.flagged`. Supported JSON extensions, including
unknown tune keys, survive archival migration unchanged. They do not establish
editing compatibility: `requireNotebookForEditing` rejects document/block/data
extensions and unknown or extended tunes that the selected tools might drop.
Run that gate on both editor load and its save snapshot. Keep a rejected
original for inspection/export rather than stripping fields to pass the gate.

<!-- persistence-example-file: evolution.ts -->

```ts
import {
  validateOutputData,
  type ContentProvenance,
  type OutputData,
  type ToolDataValidator,
} from '@anarchitects/editorjs-core';
import {
  decodeRaw,
  decodeRecord,
  encodeRecord,
  type NotebookRecord,
} from './persistence.js';

export type EvolutionCode =
  | 'missing_schema'
  | 'unsupported_schema'
  | 'unsupported_version'
  | 'source_invalid'
  | 'target_invalid'
  | 'collision'
  | 'no_legacy_block'
  | 'editing_unsupported'
  | 'raw_profile_required';

export class EvolutionError extends Error {
  constructor(readonly code: EvolutionCode) {
    super(`Content evolution rejected: ${code}.`);
    this.name = 'EvolutionError';
  }
}

const SCHEMA = 'example/editorial-notebook';
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const onlyKeys = (value: object, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));

function textValidator(
  key: 'message' | 'text',
  toned: boolean,
  limit: number,
): ToolDataValidator {
  return (value) => {
    const valid =
      isObject(value) &&
      typeof value[key] === 'string' &&
      value[key].length <= limit &&
      (!toned || value.tone === 'info' || value.tone === 'warning');
    return valid
      ? { ok: true }
      : {
          ok: false,
          errors: [{ path: [key], message: 'Unsupported text or tone.' }],
        };
  };
}

function checkProfile(document: OutputData, legacy: boolean): void {
  const code = legacy ? 'source_invalid' : 'target_invalid';
  if (document.blocks.length > 128) throw new EvolutionError(code);
  if (document.version !== undefined && document.version !== '2.31.7')
    throw new EvolutionError('unsupported_version');
  const checked = validateOutputData(document, {
    unknownTools: 'reject',
    toolValidators: new Map([
      [
        legacy ? 'aside' : 'callout',
        textValidator(
          legacy ? 'message' : 'text',
          true,
          legacy ? Infinity : 2_000,
        ),
      ],
      ['paragraph', textValidator('text', false, 2_000)],
    ]),
  });
  if (!checked.ok) throw new EvolutionError(code);
  // A block-data validator never validates its tune payloads.
  for (const block of document.blocks) {
    if (block.tunes && Object.hasOwn(block.tunes, 'flag')) {
      const flag = block.tunes.flag;
      if (!isObject(flag) || typeof flag.flagged !== 'boolean')
        throw new EvolutionError(code);
    }
  }
}

function checkVersions(provenance: ContentProvenance, legacy: boolean): void {
  const producer = provenance.producer;
  if (
    producer &&
    (producer.name !== 'editorial-notebook' ||
      (producer.version !== undefined &&
        !['1', '2'].includes(producer.version)))
  )
    throw new EvolutionError('unsupported_version');
  const versions = provenance.toolVersions ?? {};
  if (Object.hasOwn(versions, legacy ? 'callout' : 'aside'))
    throw new EvolutionError(legacy ? 'collision' : 'unsupported_version');
  for (const [name, expected] of [
    [legacy ? 'aside' : 'callout', legacy ? '1' : '2'],
    ['paragraph', '1'],
  ]) {
    if (Object.hasOwn(versions, name) && versions[name] !== expected)
      throw new EvolutionError('unsupported_version');
  }
}

export function prepareNotebookRecord(input: unknown): {
  status: 'current' | 'migrated';
  record: NotebookRecord;
} {
  // Reuse the raw/record codec: no second JSON parser or schema detector.
  const record = decodeRecord(encodeRecord(input));
  const provenance = record.provenance;
  if (!provenance?.schema) throw new EvolutionError('missing_schema');
  const schema = provenance.schema;
  if (schema.id !== SCHEMA || !['1', '2'].includes(schema.version))
    throw new EvolutionError('unsupported_schema');
  const legacy = schema.version === '1';
  checkVersions(provenance, legacy);
  if (
    legacy &&
    record.document.blocks.some((block) => block.type === 'callout')
  )
    throw new EvolutionError('collision');
  checkProfile(record.document, legacy);
  if (!legacy) return { status: 'current', record };
  if (!record.document.blocks.some((block) => block.type === 'aside'))
    throw new EvolutionError('no_legacy_block');
  const document: OutputData = {
    ...record.document,
    blocks: record.document.blocks.map((block) => {
      if (block.type !== 'aside') return block;
      if (Object.hasOwn(block.data, 'text'))
        throw new EvolutionError('collision');
      const { message, ...extensions } = block.data as Record<string, unknown>;
      return {
        ...block,
        type: 'callout',
        data: { ...extensions, text: message },
      };
    }),
  };
  checkProfile(document, false);
  // No source reference is mutated, and provenance changes only after validation.
  const next: ContentProvenance = {
    ...provenance,
    schema: { ...schema, version: '2' },
  };
  if (provenance.toolVersions !== undefined) {
    next.toolVersions = { ...provenance.toolVersions };
    if (Object.hasOwn(next.toolVersions, 'aside')) {
      delete next.toolVersions.aside;
      next.toolVersions.callout = '2';
    }
  }
  return {
    status: 'migrated',
    record: decodeRecord(
      encodeRecord({ ...record, document, provenance: next }),
    ),
  };
}

function checkEditableFields(document: OutputData): void {
  if (!onlyKeys(document, ['blocks', 'time', 'version']))
    throw new EvolutionError('editing_unsupported');
  for (const block of document.blocks) {
    if (
      !onlyKeys(block, ['id', 'type', 'data', 'tunes']) ||
      !onlyKeys(
        block.data,
        block.type === 'callout' ? ['text', 'tone'] : ['text'],
      )
    )
      throw new EvolutionError('editing_unsupported');
    for (const [name, value] of Object.entries(block.tunes ?? {})) {
      if (name !== 'flag' || !isObject(value) || !onlyKeys(value, ['flagged']))
        throw new EvolutionError('editing_unsupported');
    }
  }
}

export function requireNotebookForEditing(input: unknown): NotebookRecord {
  const result = prepareNotebookRecord(input);
  if (
    result.status !== 'current' ||
    !onlyKeys(result.record.provenance?.toolVersions ?? {}, [
      'callout',
      'paragraph',
    ])
  )
    throw new EvolutionError('editing_unsupported');
  checkEditableFields(result.record.document);
  return result.record;
}

export function readCurrentRawForEditing(
  text: string,
  profile: 'notebook-v2',
): OutputData {
  if (profile !== 'notebook-v2')
    throw new EvolutionError('raw_profile_required');
  const document = decodeRaw(text);
  checkProfile(document, false);
  checkEditableFields(document);
  return document;
}
```

### Source and destination fixtures

Save as `migration-fixtures.ts`. The expected destination is written explicitly,
not obtained by calling the migration. `review`, `archive` and `extension` show
preservation; this archived candidate intentionally fails the narrower editing
gate. The marker remains literal inline text and the flag remains separate tune
data. IDs, order, time, Editor.js version, producer, revision and unrelated
provenance stay unchanged.

<!-- persistence-example-file: migration-fixtures.ts -->

```ts
export const legacyRecord = {
  id: 'note-1',
  revision: 'r1',
  document: {
    time: 123,
    version: '2.31.7',
    schema: { rawExtension: true },
    blocks: [
      {
        id: 'first',
        type: 'aside',
        data: {
          message: 'Hello <mark>reader</mark>',
          tone: 'info',
          extension: [null, false],
        },
        tunes: { flag: { flagged: true }, review: { owner: 'host' } },
      },
      { id: 'second', type: 'paragraph', data: { text: 'Unchanged' } },
    ],
  },
  provenance: {
    schema: { id: 'example/editorial-notebook', version: '1', extension: true },
    toolVersions: { aside: '1', paragraph: '1', archivedTool: 'unknown' },
    producer: { name: 'editorial-notebook', version: '1', extension: true },
    archive: { retained: [1, null] },
  },
};

export const currentRecord = {
  id: 'note-1',
  revision: 'r1',
  document: {
    time: 123,
    version: '2.31.7',
    schema: { rawExtension: true },
    blocks: [
      {
        id: 'first',
        type: 'callout',
        data: {
          text: 'Hello <mark>reader</mark>',
          tone: 'info',
          extension: [null, false],
        },
        tunes: { flag: { flagged: true }, review: { owner: 'host' } },
      },
      { id: 'second', type: 'paragraph', data: { text: 'Unchanged' } },
    ],
  },
  provenance: {
    schema: { id: 'example/editorial-notebook', version: '2', extension: true },
    toolVersions: { callout: '2', paragraph: '1', archivedTool: 'unknown' },
    producer: { name: 'editorial-notebook', version: '1', extension: true },
    archive: { retained: [1, null] },
  },
};
```

### Load, preview and explicitly save

Save as `migrate.mjs`. Loading and preparing a candidate perform no write. The
example explicitly saves into a separate store so its original remains available;
the in-memory store is still non-durable. A missing or unsupported record must
not be replaced by empty/current data or automatically written back.

<!-- persistence-example-file: migrate.mjs -->

```js
import assert from 'node:assert/strict';
import { MemoryTextStore } from './compiled/memory-store.js';
import { loadRecord, saveRecord } from './compiled/persistence.js';
import { prepareNotebookRecord } from './compiled/evolution.js';
import { legacyRecord, currentRecord } from './compiled/migration-fixtures.js';

const source = new MemoryTextStore();
await saveRecord(source, legacyRecord);
const prepared = prepareNotebookRecord(await loadRecord(source));
assert.equal(prepared.status, 'migrated');
assert.deepEqual(prepared.record, currentRecord);
assert.deepEqual(await loadRecord(source), legacyRecord);
console.log('legacy: aside.message -> callout.text; stored source unchanged');

const destination = new MemoryTextStore();
await saveRecord(destination, prepared.record); // Explicit archival save, not editor approval.
const reloaded = prepareNotebookRecord(await loadRecord(destination));
assert.equal(reloaded.status, 'current');
assert.deepEqual(reloaded.record, currentRecord);
console.log('current: no migration; extensions preserved');

const future = structuredClone(currentRecord);
future.provenance.schema.version = '99';
const unsupported = new MemoryTextStore();
await saveRecord(unsupported, future);
assert.throws(() => prepareNotebookRecord(future), {
  code: 'unsupported_schema',
});
assert.deepEqual(await loadRecord(unsupported), future);
assert.deepEqual(await loadRecord(source), legacyRecord);
console.log('future: unsupported; stored source unchanged');
```

### Deployment and recovery belong to the host

Deploy readers and the exact configured-name registrations before enabling new
writers. Keep backups and test restoration before durable writeback. Old readers
must reject new schemas unless explicitly compatible; rolling back application
code does not reverse already migrated data. This example provides no reverse
migration, bulk job, chain discovery or automatic retry.

For concurrent writeback, compare the loaded storage revision atomically; this
example preserves it and does not implement that comparison. A rejected write
retains the draft; a timeout can have an unknown outcome. Keep migration review,
storage acknowledgement, upload completion and Forms dirty/reset state separate.
Retain caption versus missing/authored/decorative alt; this migration does not
invent image metadata. Schema/tool success is not HTML/URL sanitization,
authorization or public-rendering safety.

For `missing_schema`/`raw_profile_required`, obtain the collection's explicit
policy instead of guessing. For `unsupported_schema`/`unsupported_version`, use
a compatible reader or retain/export the original. For `source_invalid`,
`target_invalid`, `collision` or `no_legacy_block`, review the source against the
documented preconditions; nothing was saved or relabelled. For
`editing_unsupported`, preserve the archival content and supply an independently
verified tool/merge policy before editing. Errors expose bounded codes rather
than document text. Existing codec/storage errors retain their earlier meaning.
