# @anarchitects/editorjs-core

Framework-neutral document and block types for Editor.js integrations. Parsing,
validation, normalization, and version compatibility utilities will follow in the
remaining issues in epic #66. All current exports are types; use `import type`.

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
The `typecheck` target checks custom block narrowing, invalid shapes, and official
declaration compatibility; `test` checks representative JSON round trips.

Angular wrappers, concrete tools, upload adapters, and application consumers are
separate packages owned by the downstream epics linked from #66.
