# @anarchitects/editorjs-core

Framework-neutral document, tool configuration, and upload contracts for Editor.js,
with safe parsing and normalization utilities. Use `import type` for contracts and
regular imports for `parseOutputData` and `normalizeOutputData`. Pluggable tool
validation and version compatibility utilities follow in the remaining issues of #66.

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
`@anarchitects/editorjs-core/package.json`. Workspace tooling uses the existing
`@anarchitecture-community/source` condition to resolve `src/index.ts`.

The package publishes `dist` and its README; source, tests, and build metadata are
excluded. It follows the repository's independent Nx release configuration.

## Development and CI

From the repository root:

```sh
yarn nx run-many -p editorjs-core -t build typecheck test lint
```

The existing CI `run-many` command discovers all four targets. The test target
builds the package first, packs it into a temporary directory, and imports the
unpacked artifact by package name in a separate Node process without workspace
resolution or installed dependencies. Browser global access throws during import.
The smoke tests also check that the published JavaScript and declarations exist,
that source/tests are excluded from the archive, and that an isolated type-only
consumer compiles with `skipLibCheck: false` and no DOM, Node, or Editor.js types.
The `typecheck` target checks custom block narrowing, tool configuration, upload
success/error cases, invalid shapes, and official declaration compatibility.
`test` checks parsing diagnostics, content preservation, normalization idempotence,
representative JSON round trips, and host-supplied upload callbacks. The packed
artifact smoke test also calls both parsing utilities in isolated Node.
The isolated consumer also compiles a typed host/custom-tool registration example.

Angular wrappers, concrete tools, upload adapters, and application consumers are
separate packages owned by the downstream epics linked from #66.
