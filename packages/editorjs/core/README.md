# @anarchitects/editorjs-core

Framework-neutral foundation for Editor.js contracts and utilities. This initial
scaffold provides the package boundary and validation pipeline. The public entry
point is intentionally empty until the remaining issues in epic #66 add contracts,
parsing, validation, normalization, and version compatibility.

## Runtime and Editor.js strategy

- ESM package targeting ES2022, with TypeScript declarations. Supported Node.js
  baseline: 22.12 or newer. Browser consumers need an ES2022-capable environment
  or a bundler that transpiles to their target. CommonJS output is not provided.
- No runtime dependencies or peer dependencies. Importing the core requires
  neither Angular nor `@editorjs/editorjs`, and never creates an editor instance.
- Future contracts target Editor.js 2.x data structures using framework-neutral
  structural types. Editor.js itself belongs in consuming editor wrappers and tool
  integrations, which declare and test their own Editor.js peer ranges. This
  scaffold makes no version-specific compatibility claim yet.
- Runtime source is compiled in strict mode with only the ES2022 standard library
  and no ambient Node or DOM types. Browser access belongs in downstream adapters.

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
The smoke tests also check that the published JavaScript and declarations exist
and that source/tests are excluded from the archive.

Angular wrappers, concrete tools, upload adapters, and application consumers are
separate packages owned by the downstream epics linked from #66.
