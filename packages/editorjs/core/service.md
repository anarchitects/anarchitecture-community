# Portable persistence service and optional Nest composition

This **Editorial Notebook** application example builds on the shipped
[persistence and evolution guide](persistence.md). Copy its `persistence.ts` and
`evolution.ts` unchanged alongside the files below. The service uses that one
codec, version policy, migration and editing gate. These are application files,
not new exports from `@anarchitects/editorjs-core` or a shared public API schema.

The service accepts unknown input, detaches and checks it, authorizes a trusted
principal, then accesses a repository. A successful write returns the stored
record with a repository-issued revision. `null` means create only; an update
requires the last loaded revision. A stale revision produces `conflict` without
overwriting newer content. Loading a legacy record prepares an editable candidate
but never writes it back; explicitly saving that candidate requires its original
storage revision.

## Install and run the neutral service

Use Node 22.12.0 or newer in an empty directory. Install a released core version
when available, or replace the archive path with the actual core `.tgz` you have.
No workspace alias or source checkout is needed.

```sh
npm init -y
npm pkg set type=module
npm install /absolute/path/to/anarchitects-editorjs-core-0.0.1.tgz
npm install --save-dev typescript@6.0.3
```

Save the two shared files from `node_modules/@anarchitects/editorjs-core/persistence.md`
and the following `notebook-service.ts` and `service-main.mjs` files. Compile and run:

```sh
npx tsc --target ES2022 --module NodeNext --moduleResolution NodeNext --lib ES2022 --strict --skipLibCheck false --outDir compiled persistence.ts evolution.ts notebook-service.ts
node service-main.mjs
```

The same TypeScript sources also compile with `--module ESNext --moduleResolution
Bundler`. They require no DOM or Node ambient types, Angular, Nest, Nx, Editor.js
runtime or browser globals. Only the demonstration runner imports Node assertions.

## Shared service and bounded repository

`SaveNotebookRequest` describes an application DTO, not runtime validation.
`save` still accepts `unknown` and rejects extra request fields, accessors and
non-plain objects. The document and provenance are checked by the shared helpers;
the request mapper does not implement another serializer or migration.

The repository retains at most eight records, each bounded by the shared
65,536 UTF-16 code-unit codec limit. It never evicts a record silently. Its
revision comparison and assignment execute without an intervening `await` in
one process. This is **not durable storage or distributed atomicity**. Each new
instance starts empty and owns its revision sequence. A production adapter must
implement a transactional compare-and-write, scoped identity/tenant lookup,
durable revision generation, capacity policy and appropriate credentials.

<!-- service-neutral-file: notebook-service.ts -->

```ts
import type { ContentProvenance } from '@anarchitects/editorjs-core';
import {
  decodeRecord,
  encodeRecord,
  PersistenceError,
  type FailureStage,
  type NotebookRecord,
} from './persistence.js';
import {
  EvolutionError,
  prepareNotebookRecord,
  requireNotebookForEditing,
  type EvolutionCode,
} from './evolution.js';

export interface SaveNotebookRequest {
  id: string;
  expectedRevision: string | null;
  document: unknown;
  provenance?: ContentProvenance;
}

type Stage = 'request' | 'content' | 'authorization' | 'read' | 'write';
type Code =
  | 'invalid_request'
  | 'invalid_content'
  | 'unsupported_content'
  | 'migration_failed'
  | 'forbidden'
  | 'unavailable'
  | 'conflict'
  | 'not_found'
  | 'capacity';
export type NotebookResult =
  | {
      ok: true;
      value: { record: NotebookRecord; migration: 'current' | 'migrated' };
    }
  | {
      ok: false;
      error: {
        code: Code;
        stage: Stage;
        reason?: FailureStage | EvolutionCode;
      };
    };

type CommitResult =
  | { status: 'saved'; text: string }
  | { status: 'conflict' | 'capacity' };
export interface NotebookRepository {
  read(id: string): Promise<string | undefined>;
  commit(
    record: NotebookRecord,
    expectedRevision: string | null,
  ): Promise<CommitResult>;
}
export type AuthorizeNotebook = (
  principal: string,
  id: string,
  action: 'read' | 'write',
) => boolean | Promise<boolean>;

const failure = (code: Code, stage: Stage): NotebookResult => ({
  ok: false,
  error: { code, stage },
});
const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);

function contentFailure(error: unknown, stage: Stage): NotebookResult {
  if (error instanceof PersistenceError)
    return {
      ok: false,
      error: { code: 'invalid_content', stage, reason: error.stage },
    };
  if (error instanceof EvolutionError) {
    const code: Code = [
      'missing_schema',
      'unsupported_schema',
      'unsupported_version',
      'editing_unsupported',
    ].includes(error.code)
      ? 'unsupported_content'
      : ['collision', 'no_legacy_block'].includes(error.code)
        ? 'migration_failed'
        : 'invalid_content';
    return { ok: false, error: { code, stage, reason: error.code } };
  }
  return failure('invalid_content', stage);
}

function requestFields(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw new Error();
  const fields: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(input)) {
    if (
      typeof key !== 'string' ||
      !['id', 'expectedRevision', 'document', 'provenance'].includes(key)
    )
      throw new Error();
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) throw new Error();
    fields[key] = descriptor.value;
  }
  if (!validId(fields['id']) || !Object.hasOwn(fields, 'document'))
    throw new Error();
  const revision = fields['expectedRevision'];
  if (
    revision !== null &&
    (typeof revision !== 'string' || !/^r[1-9]\d{0,15}$/.test(revision))
  )
    throw new Error();
  return fields;
}

export class NotebookService {
  constructor(
    private readonly repository: NotebookRepository,
    private readonly authorize: AuthorizeNotebook,
  ) {}

  private async permission(
    principal: string,
    id: string,
    action: 'read' | 'write',
  ): Promise<NotebookResult | undefined> {
    try {
      if ((await this.authorize(principal, id, action)) !== true)
        return failure('forbidden', 'authorization');
      return undefined;
    } catch {
      return failure('unavailable', 'authorization');
    }
  }

  async save(principal: string, input: unknown): Promise<NotebookResult> {
    let fields: Record<string, unknown>;
    try {
      fields = requestFields(input);
    } catch {
      return failure('invalid_request', 'request');
    }
    const id = fields['id'] as string;
    const expectedRevision = fields['expectedRevision'] as string | null;
    let prepared: ReturnType<typeof prepareNotebookRecord>;
    let candidate: NotebookRecord;
    // Capture a checked snapshot before the first await, including provenance.
    try {
      prepared = prepareNotebookRecord({
        id,
        revision: expectedRevision ?? 'new',
        document: fields['document'],
        ...(Object.hasOwn(fields, 'provenance')
          ? { provenance: fields['provenance'] }
          : {}),
      });
      candidate = requireNotebookForEditing(prepared.record);
    } catch (error) {
      return contentFailure(error, 'content');
    }
    const denied = await this.permission(principal, id, 'write');
    if (denied) return denied;
    let committed: CommitResult;
    try {
      committed = await this.repository.commit(candidate, expectedRevision);
    } catch {
      return failure('unavailable', 'write');
    }
    if (committed.status !== 'saved') return failure(committed.status, 'write');
    try {
      const record = decodeRecord(committed.text);
      if (record.id !== id) return failure('unavailable', 'write');
      return { ok: true, value: { record, migration: prepared.status } };
    } catch {
      return failure('unavailable', 'write');
    }
  }

  async load(principal: string, id: unknown): Promise<NotebookResult> {
    if (!validId(id)) return failure('invalid_request', 'request');
    const denied = await this.permission(principal, id, 'read');
    if (denied) return denied;
    let text: string | undefined;
    try {
      text = await this.repository.read(id);
    } catch {
      return failure('unavailable', 'read');
    }
    if (text === undefined) return failure('not_found', 'read');
    try {
      const stored = decodeRecord(text);
      if (stored.id !== id) return failure('invalid_content', 'read');
      const prepared = prepareNotebookRecord(stored);
      const record = requireNotebookForEditing(prepared.record);
      return { ok: true, value: { record, migration: prepared.status } };
    } catch (error) {
      return contentFailure(error, 'read');
    }
  }
}

export class MemoryNotebookRepository implements NotebookRepository {
  private readonly records = new Map<string, string>();
  private sequence = 0;
  private failWrite = false;

  failNextWrite(): void {
    this.failWrite = true;
  }

  async read(id: string): Promise<string | undefined> {
    return this.records.get(id);
  }

  async commit(
    record: NotebookRecord,
    expectedRevision: string | null,
  ): Promise<CommitResult> {
    const previous = this.records.get(record.id);
    const revision =
      previous === undefined ? null : decodeRecord(previous).revision;
    if (revision !== expectedRevision) return { status: 'conflict' };
    if (
      (previous === undefined && this.records.size >= 8) ||
      this.sequence === Number.MAX_SAFE_INTEGER
    )
      return { status: 'capacity' };
    const next = this.sequence + 1;
    // Encode before changing the map or consuming the revision.
    const text = encodeRecord({ ...record, revision: `r${next}` });
    if (this.failWrite) {
      this.failWrite = false;
      throw new Error('Injected write failure');
    }
    this.records.set(record.id, text);
    this.sequence = next;
    return { status: 'saved', text };
  }
}
```

## Observe save, reload and failure recovery

The principal below represents already-authenticated host context. It must never
come from an untrusted DTO field. The one-name policy is demonstration-only;
replace it with authoritative per-record/per-tenant server authorization.

<!-- service-neutral-file: service-main.mjs -->

```js
import assert from 'node:assert/strict';
import {
  MemoryNotebookRepository,
  NotebookService,
} from './compiled/notebook-service.js';

const repository = new MemoryNotebookRepository();
const service = new NotebookService(
  repository,
  (principal) => principal === 'example-editor',
);
const request = {
  id: 'note-1',
  expectedRevision: null,
  document: {
    blocks: [{ type: 'callout', data: { text: 'Hello', tone: 'info' } }],
  },
  provenance: { schema: { id: 'example/editorial-notebook', version: '2' } },
};
const saved = await service.save('example-editor', request);
assert.equal(saved.ok, true);
assert.equal(saved.value.record.revision, 'r1');
assert.deepEqual(
  (await service.load('example-editor', 'note-1')).value.record,
  saved.value.record,
);
console.log('service: saved and reloaded r1');

const update = { ...request, expectedRevision: 'r1', document: { blocks: [] } };
assert.equal(
  (await service.save('example-editor', update)).value.record.revision,
  'r2',
);
assert.equal(
  (await service.save('example-editor', update)).error.code,
  'conflict',
);
assert.equal(
  (await service.save('example-editor', { ...update, document: null })).error
    .code,
  'invalid_content',
);
repository.failNextWrite();
assert.equal(
  (await service.save('example-editor', { ...update, expectedRevision: 'r2' }))
    .error.code,
  'unavailable',
);
assert.equal(
  (await service.load('example-editor', 'note-1')).value.record.revision,
  'r2',
);
console.log('service: invalid, stale and failed writes preserve r2');
```

Expected output is the two `service:` lines above. On a failed save, retain the
draft and last acknowledged revision. Never interpret a conflict as permission
to overwrite; explicitly reload and reconcile. Do not reset an editor from a
late acknowledgement if the user has made newer edits.

Diagnostics contain only a finite `code`, `stage` and optional shared-helper
`reason`, never content, credentials or arbitrary exception messages. A
`not_found` result is distinct from corrupt/unsupported content. Read/migration
errors never synthesize an empty replacement or write. `migration_failed`
identifies a rejected migration precondition; `invalid_content` with
`target_invalid` identifies a rejected current/target shape. `unsupported_content`
requires a compatible reader or safe export of the retained original.

## Optional Nest DTO/service boundary

This composition uses Nest 12.3.2's
[standalone application context](https://docs.nestjs.com/standalone-applications)
and [factory providers](https://docs.nestjs.com/fundamentals/custom-providers).
It starts no HTTP listener and closes its context in `finally`. It demonstrates
DI and direct DTO calls, not Nest request pipes, guards or HTTP adapter parity.
It does not add an HTTP contract, endpoint, auth subsystem or adapter default.

In the same directory, install these optional dependencies:

```sh
npm install @nestjs/common@12.3.2 @nestjs/core@12.3.2 reflect-metadata@0.2.2 rxjs@7.8.2
npm install --save-dev @types/node@24.10.1
```

The verified reference runtime is Node 24.15.0 with TypeScript 6.0.3. Save the
following three files, then run `npx tsc -p tsconfig.nest.json` and
`node nest-main.mjs`. Core and the shared service remain independent of Nest;
only this composition imports it. A production transport must perform its own
canonical schema mapping and authentication before invoking the service.

<!-- service-nest-file: nest-notebook.ts -->

```ts
import 'reflect-metadata';
import { Inject, Injectable, Module } from '@nestjs/common';
import {
  MemoryNotebookRepository,
  NotebookService,
} from './notebook-service.js';

@Injectable()
export class NotebookBoundary {
  constructor(
    @Inject(NotebookService) private readonly service: NotebookService,
  ) {}

  save(trustedPrincipal: string, dto: unknown) {
    return this.service.save(trustedPrincipal, dto);
  }
  load(trustedPrincipal: string, id: unknown) {
    return this.service.load(trustedPrincipal, id);
  }
}

@Module({
  providers: [
    {
      provide: MemoryNotebookRepository,
      useFactory: () => new MemoryNotebookRepository(),
    },
    {
      provide: NotebookService,
      inject: [MemoryNotebookRepository],
      useFactory: (repository: MemoryNotebookRepository) =>
        new NotebookService(
          repository,
          (principal) => principal === 'example-editor',
        ),
    },
    NotebookBoundary,
  ],
})
export class NotebookModule {}
```

<!-- service-nest-file: nest-main.mjs -->

```js
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { NotebookBoundary, NotebookModule } from './compiled/nest-notebook.js';
import { MemoryNotebookRepository } from './compiled/notebook-service.js';

const app = await NestFactory.createApplicationContext(NotebookModule, {
  logger: false,
});
try {
  const boundary = app.get(NotebookBoundary);
  const repository = app.get(MemoryNotebookRepository);
  const dto = {
    id: 'nest-note',
    expectedRevision: null,
    document: {
      blocks: [
        { type: 'paragraph', data: { text: 'Nest calls the same service' } },
      ],
    },
    provenance: { schema: { id: 'example/editorial-notebook', version: '2' } },
  };
  const saved = await boundary.save('example-editor', dto);
  assert.equal(saved.ok, true);
  assert.deepEqual(
    (await boundary.load('example-editor', dto.id)).value.record,
    saved.value.record,
  );
  assert.equal(
    (await boundary.save('example-editor', dto)).error.code,
    'conflict',
  );
  assert.equal(
    (await boundary.save('example-editor', { ...dto, document: null })).error
      .code,
    'invalid_content',
  );
  assert.equal((await boundary.save('other', dto)).error.code, 'forbidden');
  repository.failNextWrite();
  assert.equal(
    (await boundary.save('example-editor', { ...dto, expectedRevision: 'r1' }))
      .error.code,
    'unavailable',
  );
  assert.deepEqual(
    (await boundary.load('example-editor', dto.id)).value.record,
    saved.value.record,
  );
  console.log(
    'nest: shared save/load, invalid, stale, forbidden and failed-write checks passed',
  );
} finally {
  await app.close();
}
```

<!-- service-nest-file: tsconfig.nest.json -->

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "skipLibCheck": false,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "outDir": "compiled"
  },
  "files": [
    "persistence.ts",
    "evolution.ts",
    "notebook-service.ts",
    "nest-notebook.ts"
  ]
}
```

Expected output is the `nest:` line above. The context owns the in-memory
repository; a new context starts empty. A durable adapter with open connections
must implement the appropriate host lifecycle and close them on shutdown.

## Host responsibilities and limits

- Validate and authorize again on the server, even when a browser already did
  so. Derive identity and tenant scope from trusted authentication. Revisions
  prevent stale writes; they are not authorization. The repository is a trusted
  internal port and must not be exposed as an unauthenticated endpoint.
- Apply request byte limits before parsing, plus depth/work limits, rate limits,
  domain rules and per-tool/tune validation appropriate to the host. The codec's
  string bound does not bound an arbitrarily large already-decoded input or every
  transient allocation. Use bounded transport decoding for hostile input.
- Enforce upload/URL policy and rendering sanitization separately. Accepted HTML
  strings remain HTML strings; successful storage is not safe public rendering,
  blog publication or an accessibility guarantee. Caption/alt-text intent remains
  author-owned; do not infer alt text from captions.
- Keep storage credentials server-side. Implement durable transactional
  compare-and-write and recovery/retention policies in the adapter. An external
  store may commit before a timeout or response-decoding failure: `unavailable`
  means no acknowledgement, not rollback. Reconcile by reading under the same
  authorization, or use a separately proven idempotency policy before retrying.
- Preserve the original legacy/unsupported bytes for inspection/export. Migration
  is application policy, not automatic package behavior. Explicit replacement
  requires a valid revision and a supported candidate; never drop unknown fields
  just to pass the editing gate.

The [persistence guide](persistence.md) explains raw JSON, optional provenance and
the exact schema/version policy reused here. This guide adds service and DTO
ownership; it does not change core's JSON contract or package dependencies.
