# @anarchitects/editorjs-angular

Angular package foundation for Editor.js integrations using
`@anarchitects/editorjs-core` document contracts.

**This version is a package scaffold.** Its root entry point has no public runtime
or type exports yet. It does not provide an editor component, providers, events,
imperative controls, or forms integration. Use `@anarchitects/editorjs-core`
directly for document contracts and parsing utilities.

## Installation and prerequisites

When installing a published scaffold release into an existing Angular application:

```sh
npm install @anarchitects/editorjs-angular @editorjs/editorjs@2.31.7
```

Use the matching package-manager command for Yarn or pnpm. A compatible Angular
application supplies `@angular/core` and `@angular/common` from the same Angular
22 release line; do not install mismatched Angular package versions.

| Requirement                     | Declared range/reference                   |
| ------------------------------- | ------------------------------------------ | --- | -------- | --- | --------- |
| Angular core/common peers       | `^22.0.0`                                  |
| Editor.js peer                  | `^2.31.7`                                  |
| Editor.js development reference | Exactly `2.31.7`                           |
| Node.js tooling                 | `^22.22.3                                  |     | ^24.15.0 |     | >=26.0.0` |
| Package format                  | ESM, Angular Package Format, ES2022 output |

The scaffold is checked with Angular 22.1.4 and TypeScript 6.0.3. These checks
establish packaging and import compatibility, not editor lifecycle, tool, forms,
or hydration support across every version allowed by the peer ranges. Follow
Angular's compiler/runtime requirements for your application. No CommonJS build
is supplied, and Nx is not a consumer dependency.

## Import check

The complete currently available usage is an import of the empty entry point:

```js
import * as editorjsAngular from '@anarchitects/editorjs-angular';

console.log(Object.keys(editorjsAngular)); // []
```

No Angular provider or editor initialization is required. Importing this entry
point does not load Editor.js or touch browser globals. It does not render an
editor; there is no `<aa-editorjs>` export in this version.

## Public entry points

- `@anarchitects/editorjs-angular`: empty ESM module with declarations.
- `@anarchitects/editorjs-angular/package.json`: package metadata.

Use package-root imports. Source, build internals, and test files are not public
entry points. The packaged artifact includes its README and Apache-2.0 license.

## Ownership and compatibility

The core package defines portable document/tool/upload contracts. Applications
own their domain records, storage mappings, transports, rendering safety, version
policies, and migrations. This package has no application-specific persistence
model and does not change core's framework independence.

Angular Forms, SSR/hydration orchestration, tool registries, concrete tools, and
upload implementations are not supplied by this scaffold. Successful import on a
server does not imply that a browser editor can be rendered or hydrated there.
Editor.js is a peer so applications own its installed runtime version; the pinned
development reference is not a bundled editor runtime.

Package versions are independent from saved document schema/tool versions. During
`0.x`, review release notes before upgrading; a scaffold version must not be
treated as a stable editor API. See
[GitHub releases](https://github.com/anarchitects/anarchitecture-community/releases)
for `editorjs-angular@<version>` release notes.

## Troubleshooting

| Symptom                                              | Action                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| No component or provider export exists               | This is the scaffold version; it currently supports only the import check above.                              |
| Angular peer dependency mismatch                     | Use matching Angular 22 core/common versions and their supported Node/TypeScript toolchain.                   |
| A package subpath is not exported                    | Import the package root or `package.json`, not source/build internals.                                        |
| A published package resolves to missing source files | Remove the repository-only `@anarchitecture-community/source` custom resolution condition from your consumer. |

Report reproducible packaging problems through the
[issue tracker](https://github.com/anarchitects/anarchitecture-community/issues),
including package, Angular, and Node versions. Repository build/release details
are in the [development guide](https://github.com/anarchitects/anarchitecture-community/blob/main/docs/editorjs-angular-development.md).

## License

Apache-2.0.
