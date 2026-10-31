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
