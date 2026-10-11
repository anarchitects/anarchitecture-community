# @anarchitects/editorjs-core

Framework-neutral document, tool configuration, and upload contracts for Editor.js,
with parsing, normalization, pluggable validation, and optional content provenance.
Use `import type` for contracts and regular imports for `parseOutputData`,
`normalizeOutputData`, `validateOutputData`, and `parseContentWithProvenance`.

Use this package in editors, services, importers, and storage adapters that need a
shared document contract. The core defines the portable API; consumers adapt their
domain models to it and own persistence, rendering, and migrations. It does not
create an editor, install tools, perform uploads, or prescribe a storage envelope.

## Installation

Install a published release with your package manager:

```sh
npm install @anarchitects/editorjs-core
# or
yarn add @anarchitects/editorjs-core
# or
pnpm add @anarchitects/editorjs-core
```

No initialization, Angular provider, Nx workspace, or Editor.js installation is
needed to use the core. An interactive editor integration installs and configures
Editor.js and its tools separately.

## Quick start

Validate a document before passing it to your persistence layer:

```ts
import { validateOutputData } from '@anarchitects/editorjs-core';
import type { OutputData } from '@anarchitects/editorjs-core';

const draft: OutputData = {
  blocks: [{ id: 'intro', type: 'paragraph', data: { text: 'Hello' } }],
};
const result = validateOutputData(draft, { blockIds: 'required' });
if (!result.ok) {
  throw new Error(result.errors.map((error) => error.message).join('; '));
}

export const savedJson = JSON.stringify(result.data);
// {"blocks":[{"id":"intro","type":"paragraph","data":{"text":"Hello"}}]}
```

`savedJson` contains the normalized raw document. Validation checks the envelope
and ID policy here; paragraph data needs a registered tool validator when the host
requires schema checks. Use `parseOutputData(savedJson)` when reading it back.

## Runtime and Editor.js strategy

- ESM package targeting ES2022, with TypeScript declarations. Supported Node.js
  baseline: 22.12 or newer. Browser consumers need an ES2022-capable environment
  or a bundler that transpiles to their target. CommonJS output is not provided.
- No runtime dependencies or peer dependencies. Importing the core requires
  neither Angular nor `@editorjs/editorjs`, and never creates an editor instance.
- Document contracts follow Editor.js 2.x structures and are type-tested against
  the official `@editorjs/editorjs` declarations at **2.31.7**, pinned as a
  development-only dependency. This is a structural type compatibility check,
  not a runtime compatibility claim for every Editor.js or plugin version.
  Wrappers and tool integrations declare and test their own Editor.js peer ranges.
- Runtime source is compiled in strict mode with only the ES2022 standard library
  and no ambient Node or DOM types. Browser access belongs in downstream adapters.

## Framework-neutral editor integration contracts

`EditorJsApi<Block>` describes an instance-owned asynchronous control facade:
`save()`, `render(data)`, `clear()`, `focus(atEnd?)` and `setReadOnly(boolean)`.
`EditorJsReadyEvent<Block>` carries that facade; `EditorJsChangeEvent<Block>`
carries a saved `data` snapshot and increasing owner-local `sequence`.
`EditorJsErrorEvent` carries an `operation`, a failure `code`, and the original
`cause`. `EditorJsOperation` enumerates load/create/readiness, configuration/data,
control operations and destruction. These are shared type contracts; core does
not yet provide a runtime editor controller or create browser editor instances.

```ts
import type { EditorJsApi, OutputData } from '@anarchitects/editorjs-core';

export async function replaceDocument(
  editor: EditorJsApi,
  document: OutputData,
): Promise<OutputData> {
  await editor.render(document);
  return editor.save();
}
```

Owner implementations serialize accepted operations, reject calls before ready
or after destruction, and suppress late outputs. Programmatic document replacement
does not emit editor-originated changes. Rapid editor notifications may coalesce;
obsolete saved snapshots must be discarded, so sequence gaps are valid. Failures
do not poison later queued work. Imperative failures reject and are observable
through the owner's error channel while live; destruction emits no late events.
Generic block parameters describe validated data, not a runtime schema check.

Angular adapters reuse these contracts and core's normalization/validation rather
than redefining them. Non-Angular hosts can implement the same contract without
installing Angular or DOM declarations. Browser loading, holders, concrete editor
drivers, UI lifecycle hooks and forms integration belong to downstream adapters.

## Document and block types

`OutputData` has a required `blocks` array and optional `time` (milliseconds) and
`version` (Editor.js version, not an application schema version). Each
`OutputBlockData<Type, Data>` contains `type` and object-shaped `data`, with optional
`id` and `tunes`. Tool names are the keys chosen in an editor's configuration;
there is no built-in list of paragraph, heading, or third-party tool names.

By default, block data is an opaque `object` and tune values are `unknown`.
Consumers must narrow or validate plugin-specific fields before accessing them.
The public types deliberately do not re-export the upstream declarations: the
upstream entry point references browser APIs and defaults plugin data to `any`.
Structural types keep consumers independent of DOM types and the Editor.js
installation, while compatibility tests use the official declarations directly.

Define a finite tool map to derive a discriminated union:

```ts
import type {
  OutputBlockDataFor,
  OutputData,
} from '@anarchitects/editorjs-core';

interface ToolData {
  paragraph: { text: string };
  rating: { score: number; maximum: number };
}

type Block = OutputBlockDataFor<ToolData>;

const document: OutputData<Block> = {
  blocks: [
    { type: 'paragraph', data: { text: 'Hello' } },
    { type: 'rating', data: { score: 4, maximum: 5 } },
  ],
};

for (const block of document.blocks) {
  if (block.type === 'rating') {
    // The type selects the corresponding data shape.
    const score: number = block.data.score;
  }
}
```

Alternatively, pass a union of `OutputBlockData<'name', CustomData>` types to
`OutputData`. A finite tool map rejects unknown names and mismatched payloads.
Keep generic `OutputData` when reading documents containing unfamiliar plugins;
validate before treating external data as your narrower document type. Adding a
catch-all `OutputBlockData` to a union loses exhaustive tool-name narrowing.

## Serializable data

`JsonValue`, `JsonObject`, and `JsonArray` describe JSON-compatible values: strings,
numbers, booleans, null, arrays, and string-keyed objects. Use `satisfies JsonObject`
for an opt-in check of a data literal:

```ts
import type { JsonObject } from '@anarchitects/editorjs-core';

const data = {
  text: 'Hello',
  items: [1, true, null, { nested: ['value'] }],
} satisfies JsonObject;
```

These JSON types exclude `undefined`, functions, symbols, bigint, and class values
such as `Date`. They cannot prove finite numbers, acyclic references, or runtime
plugin behavior. Persist plain, acyclic objects with finite numbers; omit optional
fields rather than storing `undefined`. A custom data interface can be used as
block data without adding a string index signature, but that alone does not prove
serializability. Type annotations neither validate untrusted input nor sanitize
HTML strings. Runtime validation is a separate concern.

Upstream references: [saved data format](https://editorjs.io/saving-data/) and
[official document types](https://github.com/codex-team/editor.js/blob/v2.31.7/types/data-formats/output-data.d.ts).

## Parsing and normalization

`parseOutputData(input: unknown)` accepts JSON text or an already decoded value.
`normalizeOutputData(input: unknown)` accepts decoded input only. Both return an
`OutputDataParseResult`: `{ ok: true, data }` or `{ ok: false, error }`, with no
partial document on failure. They check the JSON shape and document/block envelope,
not the schema of any particular plugin.

```ts
import { parseOutputData } from '@anarchitects/editorjs-core';

const result = parseOutputData(
  '{"blocks":[{"type":"custom","data":{"value":1}}]}',
);
if (result.ok) {
  // result.data is OutputData; custom payload fields still require narrowing.
  const document = result.data;
} else {
  // For example: { code: 'missing_property', path: ['blocks'], message: '...' }
  const issue = result.error;
}
```

The document must be a plain object with a `blocks` array (an empty array is valid).
Every block needs a non-empty string `type` and a plain JSON object `data`. Optional
`time` must be finite numeric data, `version` and block `id` must be strings, and
block `tunes` must be a plain JSON object. Arrays are supported inside custom data
and tune values. There is no list of known tool names or version allowlist.

Normalization returns a detached copy, preserving all supported JSON fields,
including unknown document/block extensions, custom payloads, and tune data. It
omits explicitly `undefined` optional `time`, `version`, block `id`, and block
`tunes` properties. Missing metadata stays missing; no timestamp, ID, version, or
empty block is generated. Null metadata is rejected. Other values are retained
without trimming, defaulting, or coercion. Re-normalizing successful output gives
the same data, and neither utility mutates its input.

The first error has a stable code, explanatory message, and an array of property
names/array indices. An empty path means the root. Paths preserve unusual keys
without ambiguous dot notation; error messages do not echo content.

| Code                 | Meaning                                                      |
| -------------------- | ------------------------------------------------------------ |
| `invalid_json`       | Text could not be parsed as JSON.                            |
| `missing_property`   | Required `blocks`, block `type`, or block `data` is absent.  |
| `invalid_type`       | A document/block envelope field has the wrong shape.         |
| `non_json_value`     | A value cannot be preserved as supported plain JSON data.    |
| `circular_reference` | An ancestor is referenced again within its descendants.      |
| `max_depth_exceeded` | A value is more than 100 property/index steps from the root. |
| `unreadable_value`   | A supplied object could not be inspected.                    |

Decoded inputs must contain finite numbers, dense arrays without extra properties,
and plain objects (including null-prototype objects) with enumerable data
properties. Functions, bigint, symbols, class instances, accessors, non-enumerable
properties, and other `undefined` values are rejected instead of silently discarded
or coerced by JSON serialization. Getters and `toJSON` hooks are not invoked.
Shared references are copied independently; circular references are rejected.
Prototype-like keys such as `__proto__` remain own data properties.

These helpers are intended for JSON text and decoded data, not executable proxy
objects; inspecting a proxy can invoke its traps. Hosts should bound input size
before parsing. Successful parsing is not plugin validation, ID uniqueness or
required-ID policy, version migration, or HTML sanitization. HTML strings remain
unchanged and must be handled safely by the rendering host.

## Content provenance and version policy

The core keeps version provenance separate from compatibility decisions:

| Field                            | Meaning                                              | Owner                     |
| -------------------------------- | ---------------------------------------------------- | ------------------------- |
| `OutputData.version`             | Editor.js package version recorded with the document | Editor integration        |
| `ContentProvenance.schema`       | Application content schema identity and version      | Consumer                  |
| `ContentProvenance.toolVersions` | Tool versions keyed by configured tool name          | Consumer/tool integration |
| `ContentProvenance.producer`     | Application or process name and optional version     | Consumer                  |

These versions are independent. An Editor.js upgrade does not imply an application
schema upgrade, and a tool's package version is not a universal content schema.
The core's own package version does not describe saved content. No version is
inferred from installed dependencies, tool names, or missing metadata.

`parseContentWithProvenance(input, provenance?)` accepts raw `OutputData` as JSON
text or decoded data, plus an optional **decoded** `ContentProvenance` sidecar.
Consumers choose whether and where to persist this metadata; the helper requires
no storage envelope or application-specific mapping.

```ts
import { parseContentWithProvenance } from '@anarchitects/editorjs-core';

const result = parseContentWithProvenance(
  { version: '2.31.7', blocks: [] },
  {
    schema: { id: 'example/article', version: '3' },
    toolVersions: { paragraph: '2.11.6' },
    producer: { name: 'example-host', version: '1.0.0' },
  },
);
if (result.ok) {
  // Raw OutputData remains usable by existing editors and persistence adapters.
  const document = result.data;
  const provenance = result.provenance;
}
```

Without a sidecar, legacy raw documents round-trip through `result.data` with no
added provenance field. Existing parsing and validation APIs keep their raw
document contracts. Fields named `schema` or `toolVersions` inside a raw document
remain document extensions; they are never interpreted as the sidecar.

Success returns `{ ok: true, data, provenance? }` with detached copies. The
sidecar is a plain JSON object; each known field is optional. When supplied,
`schema` requires nonblank string `id` and `version`, `producer` requires a
nonblank `name` and optionally a nonblank `version`, and `toolVersions` maps
non-empty configured tool names to nonblank version strings. Strings are retained
without trimming or semantic-version parsing. Omit absent fields rather than
setting them to `undefined`; an omitted sidecar and an empty sidecar stay distinct.
Unknown JSON extension fields are preserved, using the parsing safeguards above.

Failure returns `{ ok: false, error }` with the parsing error codes and no partial
content. Paths start with `data` for document errors and `provenance` for sidecar
errors. The document is checked first. This helper checks structure only; use
`validateOutputData` separately for block IDs and plugin-specific validation.

**Unknown and future versions are preserved, not certified as compatible.**
Successful parsing means that the shape is supported, not that the host can render
or edit its contents. The core has no version allowlist, comparison rules, migration
registry, or migration callback. It never upgrades or downgrades content. Consumers
must decide how to handle missing or unsupported versions, select explicit
migrations where needed, validate migrated data, and update provenance only after
their migration succeeds. Changing a version label alone does not migrate data.

## Structural and tool validation

`validateOutputData(input, options?)` accepts JSON text or decoded input and returns
an `OutputDataValidationResult`: `{ ok: true, data }` or `{ ok: false, errors }`.
Failure never returns a partial or rejected document. Success returns normalized
`OutputData`, without asserting any particular custom block type.

Validation runs in three stages:

1. Parse and check the JSON/document/block envelope using `parseOutputData`. Its
   first failure is returned with `source: 'structure'` and its existing path/code.
2. Check block IDs under the selected policy, collecting errors in block order.
   Any structural error prevents all tool callbacks from running.
3. Invoke registered tool validators, collecting tool errors in block order and
   then in each validator's issue order.

| Option                   | Default      | Behavior                                                                                              |
| ------------------------ | ------------ | ----------------------------------------------------------------------------------------------------- |
| `blockIds`               | `'optional'` | Missing IDs are allowed; present IDs must be nonblank and unique.                                     |
| `blockIds: 'required'`   |              | Every block needs a nonblank, unique ID.                                                              |
| `blockIds: 'ignore'`     |              | Skip presence, blankness, and uniqueness policies; the parser still requires string IDs when present. |
| `unknownTools`           | `'allow'`    | Preserve blocks without a registered validator.                                                       |
| `unknownTools: 'reject'` |              | Every configured tool name needs a registered validator.                                              |
| `toolValidators`         | absent       | Host-supplied `ReadonlyMap<string, ToolDataValidator>`, keyed by the exact configured tool name.      |

IDs are compared exactly and never trimmed, generated, or rewritten. Unknown tools
are permitted by default so generic consumers can preserve third-party payloads.
Use the reject policy when a host needs an explicit set of supported tools.

Each tool or host can export its validator independently and the consuming host
can compose their entries into a map. No global registry or concrete tool is
provided. For example:

```ts
import { validateOutputData } from '@anarchitects/editorjs-core';
import type { ToolDataValidator } from '@anarchitects/editorjs-core';

const paragraphValidator: ToolDataValidator = (data) => {
  if (
    data !== null &&
    typeof data === 'object' &&
    'text' in data &&
    typeof data.text === 'string'
  ) {
    return { ok: true };
  }
  return {
    ok: false,
    errors: [
      { path: ['text'], code: 'text_required', message: 'Expected text.' },
    ],
  };
};

const result = validateOutputData(
  { blocks: [{ id: 'intro', type: 'paragraph', data: { text: 'Hello' } }] },
  {
    blockIds: 'required',
    unknownTools: 'reject',
    toolValidators: new Map([['paragraph', paragraphValidator]]),
  },
);
```

`ToolDataValidator` is synchronous and receives `unknown` data plus a
`ToolValidationContext` containing `type`, `blockIndex`, and optional `id`. Data is
a deeply frozen, detached copy; context is also frozen. Callbacks cannot rewrite
the accepted document through these arguments. The returned document remains
mutable and detached from the original input. Validators and configuration are
trusted host code, not sandboxed code; callbacks should be pure.

A callback returns `{ ok: true }` or `{ ok: false, errors: [...] }`. Each
`ToolValidationIssue` has a nonempty message, an optional code, and an optional
property/index path relative to block data. Omitting the path refers to the data
object itself. For example, `['items', 0]` becomes
`['blocks', blockIndex, 'data', 'items', 0]`. The host code is retained as
`validatorCode`; the main error code is `tool_data_invalid` with `source: 'tool'`.

Other validation codes are `missing_block_id`, `invalid_block_id`,
`duplicate_block_id`, `unknown_tool`, `validator_failed` (a callback threw), and
`invalid_validator_result` (a callback returned an unsupported result). Exceptions
become generic diagnostics without exposing their text. Empty failure lists,
invalid issue paths, and asynchronous results are rejected, not treated as success.
Remote/asynchronous checks belong in the host's separate workflow.

**Validation is not HTML sanitization or XSS-safe rendering.** Payload strings
remain unchanged, including HTML. The host must render content and diagnostic
messages safely; custom validator messages are host-supplied text. Schema checks
also do not establish authorization, URL safety, or version compatibility.

## Tool configuration

`ToolConfiguration<Tool, Config, Data>` keeps a host-supplied class and its config
typed. `ToolRegistration<Tool, Config, Data>` also accepts the class directly.
`ToolOptions<Data>` covers inline toolbar, tunes, shortcut, and toolbox settings;
`ToolboxEntry<Data>` allows partial saved-data overrides. `ToolConstructor` is an
opaque class constraint, not an instantiation API. Pass a concrete `typeof MyTool`
to retain that tool's constructor type.

These are external-tool registration contracts. Core does not check that a class
implements an editor's rendering API, infer its config from its constructor,
register tools, or manage lifecycle. The host supplies compatible classes and
validates configuration. Config can hold callbacks and services; do not serialize
it as document data. Toolbox icon strings remain the host's responsibility.

```ts
import type {
  ImageUploader,
  ToolConfiguration,
} from '@anarchitects/editorjs-core';

interface Input {
  name: string;
  bytes: Uint8Array;
}

interface Asset {
  url: string;
  assetId: string;
}

interface HostError {
  code: string;
  message: string;
}

interface ImageConfig {
  uploader: ImageUploader<Input, Asset, HostError>;
  captionPlaceholder?: string;
}

// Declaration of a class supplied by a downstream custom-tool integration.
declare class CustomImageTool {
  constructor(options: { config?: ImageConfig });
}

function configureHost(
  transport: ImageUploader<Input, Asset, HostError>,
): ToolConfiguration<typeof CustomImageTool, ImageConfig, { caption: string }> {
  return {
    class: CustomImageTool,
    config: { uploader: transport, captionPlaceholder: 'Describe this image' },
    inlineToolbar: ['bold'],
    toolbox: { title: 'Image', data: { caption: '' } },
  };
}
```

Settings compatibility is type-tested with Editor.js 2.31.7 when the host supplies
an official `ToolConstructable`. See the upstream
[tool settings](https://github.com/codex-team/editor.js/blob/v2.31.7/types/tools/tool-settings.d.ts).

## Upload boundaries

`ImageUploader<Input, FileData, ErrorData>` combines asynchronous `uploadByFile`
and `uploadByUrl` callbacks. Use `FileUploader` or `UrlUploader` for a host that
exposes only one capability. `Input` is explicit: browser consumers can use
`File`, while server consumers can use their own byte or stream payload. The core
imports neither DOM nor Node types.

Both callbacks resolve to `UploadResponse<FileData, ErrorData>`:

- Success: `{ success: 1, file: { url: string, ... } }`. Extend `UploadedFile` with
  host metadata such as an asset ID or dimensions. `UploadSuccess` requires a file.
- Expected failure: `{ success: 0 }` or `{ success: 0, error: ... }`.
  `UploadFailure` has no usable file; error details default to `unknown`. The
  optional `error` field is a host extension, not an Editor.js error standard.

Narrow on `result.success === 1` before using `result.file`. A successful response
cannot also carry error details. The response shape follows the
[image tool upload contract](https://github.com/editor-js/image#providing-custom-uploading-methods);
no image tool is installed or implemented here. A consuming adapter handles the
concrete tool's behavior for failures and unsupported upload capabilities.

The host owns transport, endpoints, credentials, URL/file validation, storage,
retries, cancellation, and persistence. Returning metadata does not save the
editor document. Persist only appropriate JSON metadata, not callbacks, credentials,
or raw input bytes. URL validity, accessibility, and expiry need host validation.

Expected failures can resolve with `success: 0`. Transport exceptions can also
reject the promise; rejection values are not typed by TypeScript. Hosts must
catch them as unknown and either report them or map them to an explicit failure
response. These interfaces do not perform I/O or handle exceptions automatically.

## Package exports

`@anarchitects/editorjs-core` resolves to `dist/index.js`, with declarations at
`dist/index.d.ts`. Package metadata is available through
`@anarchitects/editorjs-core/package.json`. Import contracts with `import type`:

| Area               | Public exports                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime functions  | `parseOutputData`, `normalizeOutputData`, `validateOutputData`, `parseContentWithProvenance`                                                                                                                           |
| Documents and JSON | `OutputData`, `OutputBlockData`, `OutputBlockDataFor`, `JsonValue`, `JsonObject`, `JsonArray`                                                                                                                          |
| Editor integration | `EditorJsApi`, `EditorJsReadyEvent`, `EditorJsChangeEvent`, `EditorJsErrorEvent`, `EditorJsOperation`                                                                                                                  |
| Tool registration  | `ToolConstructor`, `ToolboxEntry`, `ToolOptions`, `ToolConfiguration`, `ToolRegistration`                                                                                                                              |
| Uploads            | `UploadedFile`, `UploadSuccess`, `UploadFailure`, `UploadResponse`, `FileUploader`, `UrlUploader`, `ImageUploader`                                                                                                     |
| Parsing            | `OutputDataParseResult`, `OutputDataParseError`, `OutputDataParseErrorCode`                                                                                                                                            |
| Validation         | `OutputDataValidationResult`, `OutputDataValidationOptions`, `OutputDataValidationError`, `OutputDataValidationErrorCode`, `ToolDataValidator`, `ToolValidationContext`, `ToolValidationIssue`, `ToolValidationResult` |
| Provenance         | `ContentProvenance`, `ContentSchemaVersion`, `ContentProducer`, `ContentParseResult`                                                                                                                                   |

Only the four functions have runtime exports; the remaining contracts are types.
Import from the package root. Deep imports into `src`, `dist`, or helper modules
are private and blocked by the export map. Use TypeScript's `NodeNext` resolution
for Node ESM projects, or `Bundler` resolution for bundler-based projects. The
published declarations require only ES2022 library types, without DOM or Node
ambient declarations. CommonJS output is not supplied.

## Consumer adapters

Keep application-specific records outside the core. Extract the raw document from
your record, apply your version policy and any explicit migration, then validate
before storing or editing it. A storage boundary can accept the core contracts
without dictating a database, record shape, or framework:

```ts
import {
  parseContentWithProvenance,
  validateOutputData,
} from '@anarchitects/editorjs-core';
import type {
  ContentProvenance,
  OutputData,
  OutputDataValidationOptions,
} from '@anarchitects/editorjs-core';

interface Storage {
  save(document: OutputData, provenance?: ContentProvenance): Promise<void>;
}

export async function saveContent(
  raw: unknown,
  metadata: unknown,
  validation: OutputDataValidationOptions,
  storage: Storage,
): Promise<void> {
  // The caller applies its version policy/migrations before calling this function.
  const parsed = parseContentWithProvenance(raw, metadata);
  if (!parsed.ok) throw new Error(parsed.error.message);
  const checked = validateOutputData(parsed.data, validation);
  if (!checked.ok) {
    throw new Error(checked.errors.map((error) => error.message).join('; '));
  }
  await storage.save(checked.data, parsed.provenance);
}
```

Framework wrappers own editor creation, disposal, browser loading, forms, and SSR
boundaries. Angular consumers choose their wrapper's supported Angular and forms
APIs; the core has no Angular peer range or form-control interface. Tool packages
own their data schemas and editor lifecycle. Upload adapters own transport and
credentials. Applications own authorization, rendering safety, domain models,
storage mappings, and migrations. Existing applications adopt these contracts
through their own adapters rather than extending core with application fields.

## Package versioning

The package is independently versioned. Its package version governs the exported
API and documented behavior; it does not set `OutputData.version`, application
schema versions, or tool versions. During `0.x`, review minor-release notes for
breaking changes and pin the version or compatible range appropriate to your
application. From `1.0`, incompatible API changes require a major release.
Changes to signatures, accepted input, normalization, or diagnostic codes must be
described in release notes with migration guidance when needed. Diagnostic message
wording is explanatory; branch on codes and paths instead of exact message text.

See [GitHub releases](https://github.com/anarchitects/anarchitecture-community/releases)
for release notes under `editorjs-core@<version>` tags. An upstream Editor.js or
tool update does not automatically change this package's support guarantees.

## Troubleshooting

| Symptom                                               | Action                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A type is missing at runtime                          | Use `import type`; interfaces and type aliases are erased.                                                   |
| A package subpath is not exported                     | Import from `@anarchitects/editorjs-core`, not `src` or `dist`.                                              |
| An installed package resolves to missing source files | Remove the repository-only `@anarchitecture-community/source` custom condition from the consumer's resolver. |
| Parsing reports `non_json_value`                      | Pass plain JSON data; omit undefined fields, and convert class instances before parsing.                     |
| Unknown tools pass validation                         | The default is `unknownTools: 'allow'`; register validators and use `'reject'` for an allowlist.             |
| Content parses but a tool cannot render it            | Check the host's schema/tool version policy and migrate explicitly; parsing certifies structure only.        |
| A custom validator returns a promise                  | Validators are synchronous; perform remote checks separately in the host.                                    |

Report reproducible package problems through the
[issue tracker](https://github.com/anarchitects/anarchitecture-community/issues),
including package/runtime versions and a minimal payload without private content.
Contributor checks and release preparation are documented in the
[development guide](https://github.com/anarchitects/anarchitecture-community/blob/main/docs/editorjs-core-development.md).

## License

Apache-2.0.
