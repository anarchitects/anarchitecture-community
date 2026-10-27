# Common Editor.js tools: upstream evidence

Evidence for [#609](https://github.com/anarchitects/anarchitecture-community/issues/609),
collected on 27 October 2026. The [package contract](editorjs-common-tools-design.md)
records the decisions drawn from this review. These are candidate upstream
artifacts, not certification of five future Anarchitects packages.

## Artifact provenance

Queried the official npm registry, downloaded each published tarball, verified its
bytes against registry SHA-512 integrity, and inspected its package metadata,
license, declarations and emitted ESM. No package scripts were run. The review
uses the actual archive rather than assuming the repository's current main branch
matches publication. None of these metadata records supplied a `gitHead`.

| Package               | Version | Published archive                                                                | ESM entry under `dist/` | Declared normal dependencies                            |
| --------------------- | ------- | -------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------- |
| `@editorjs/paragraph` | 2.11.7  | [tarball](https://registry.npmjs.org/@editorjs/paragraph/-/paragraph-2.11.7.tgz) | `paragraph.mjs`         | `@codexteam/icons ^0.0.4`                               |
| `@editorjs/header`    | 2.8.9   | [tarball](https://registry.npmjs.org/@editorjs/header/-/header-2.8.9.tgz)        | `header.mjs`            | `@codexteam/icons ^0.0.5`, `@editorjs/editorjs ^2.30.7` |
| `@editorjs/list`      | 2.0.9   | [tarball](https://registry.npmjs.org/@editorjs/list/-/list-2.0.9.tgz)            | `editorjs-list.mjs`     | `@codexteam/icons ^0.3.2`                               |
| `@editorjs/quote`     | 2.7.6   | [tarball](https://registry.npmjs.org/@editorjs/quote/-/quote-2.7.6.tgz)          | `quote.mjs`             | `@codexteam/icons ^0.3.2`, `@editorjs/dom ^0.0.5`       |
| `@editorjs/image`     | 2.10.3  | [tarball](https://registry.npmjs.org/@editorjs/image/-/image-2.10.3.tgz)         | `image.mjs`             | `@codexteam/icons ^0.3.0`                               |

Verified integrity values, in the same order:

```text
paragraph sha512-qD6bbWvRc4VvP0mXDOm+hOhzzhUYR9ZjcAvgCuKWcCbUMpCvhVF1s8NX40zdjekPi6JEnuHTamCncTrSzVsVhw==
header    sha512-eBL9/PLDKiE9ADZycmgps3PLz9Lw8w6rPFXr0mfHuhHQI/ynP/q1vLpyruBrRCflTLD2Dlj5nYPoJjL5mP/MFw==
list      sha512-rUTgDSt5wygD3Dp24bNyp6vvye/Xf4UWju0ZuvWeP13Z4cu2z1Jb5JFSTEhCou72XUGuf4xVhtsd8cm/bwUS1g==
quote     sha512-D01KUMSDj2r+6Z+xjDkQqI+y6URpeHCvj0+P4pah+GtkG040lWjFb2H4pgHFXuol2cbfyAoraYSw85fuPheCvw==
image     sha512-ekCsGICZOIdghF/U2T34H7CItqaWAoJDXbkRD+x8l/LIo/7Ozf7KovYm21qz+CluArgV4RurVFHqwlz+O0vfJA==
```

All five declare MIT and contain an MIT license: paragraph/header/quote name
CodeX, 2018; list names CodeX, 2022; image names СodeX, 2020. Keep upstream
attribution/license obligations when packaging; the dependency decision does not
relicense their code as repository-owned Apache-2.0 code. No upstream source or
tarball is committed by this slice.

All five expose only the root via `exports`, with ESM import, UMD require and
`dist/index.d.ts` declarations. Paragraph nests `types` under import/require;
the others have a sibling `types` condition. They declare neither `type`,
`sideEffects`, engines nor peers. Runtime modules export a default constructor;
internal declaration files are not supported package subpaths. The absence of
a peer range is not proof of compatibility with every Editor.js release.

## Browser and declaration boundaries

Each ESM bundle begins with a guarded global style injection. No separate CSS
file was found in any archive. Loading a constructor in a browser can therefore
change `document.head` before a tool instance exists. The guards make four
packages importable without a DOM, but do not make their browser evaluation pure.

Using Node 24.22.1, imported each extracted ESM file in a fresh process without
DOM shims:

| Tool      | Result                                                               | Read-only and destruction evidence                                                                                            |
| --------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Paragraph | Import succeeds; runtime export is `default`.                        | `isReadOnlySupported === true`; no prototype `destroy` hook.                                                                  |
| Header    | Import succeeds; runtime export is `default`.                        | `isReadOnlySupported === true`; no prototype `destroy` hook.                                                                  |
| List      | Import succeeds; runtime export is `default`.                        | `isReadOnlySupported === true`; no prototype `destroy` hook.                                                                  |
| Quote     | Import succeeds; runtime export is `default`.                        | `isReadOnlySupported === true`; no prototype `destroy` hook.                                                                  |
| Image     | Fails with `ReferenceError: window is not defined`, `image.mjs:137`. | Static inspection reports read-only support and no public destroy/cancel hook; the import probe could not evaluate the class. |

Image bundles AJAX/Promise support that touches `window` during module evaluation.
SSR must not import it eagerly. None of these observations proves browser
read-only behavior, resource cleanup, CSP compatibility or absence of network
delivery. Those require the implementation slices' browser controls.

All upstream declarations refer to DOM and Editor.js types, including internal
Editor.js type paths. List uses additional relative declaration files; its
internal data/meta types cannot be consumed through exported subpaths. Quote's
alignment enum is not exported. Pure package-root types must be owned locally
and checked against the public browser boundary.

## Actual isolated consumer type probe

Created a temporary ESM npm consumer outside the workspace. Installed the five
verified local tarballs, exact `@editorjs/editorjs@2.31.7` and
`typescript@6.0.3` with scripts disabled. No Angular package was installed.
`npm ls @editorjs/editorjs --all` showed the header dependency deduplicated to
the root's 2.31.7. This is one successful resolution, not a guarantee for every
host dependency graph.

The probe assigned all five default constructors to one `EditorConfig.tools`
map. Both runs used `strict: true`, `skipLibCheck: false`, `noEmit: true`,
target ES2022, ES2022 plus DOM libraries, and `types: []`.

| Module / resolution | Actual result                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESNext / Bundler    | Pass, no diagnostics.                                                                                                                                                     |
| NodeNext / NodeNext | Fail: five TS2322 diagnostics, one per constructor, because the default import is represented as a module namespace type rather than `ToolConstructable \| ToolSettings`. |

The temporary lockfile SHA-256 was
`432bdcdcf9dd5a7ccb6a83ff469f023c1d5a31a3dae54a161428dfd32b922742`.
Transitive ranges remain upstream-owned; future slices must use their own locked
consumer evidence. Reproduce by installing the pinned artifacts in a fresh ESM
consumer, importing each root default and assigning them under paragraph/header/
list/quote/image in an `EditorConfig` value, then compiling in both modes above.
The NodeNext result is a recorded compatibility limitation, not a suppressed
passing check. No broad assertion or `skipLibCheck` workaround was used.

## Data, configuration and lifetime findings

| Tool      | Inspected declaration/runtime locations                                                                                      | Findings affecting the contract                                                                                                                                                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paragraph | `dist/index.d.ts`; constructor, save and validate in `paragraph.mjs`                                                         | Saves `{text}` with inline HTML. Blank-block retention depends on `preserveBlank`; structural empty text and save-time omission are distinct. It can be confused with Editor.js's built-in paragraph unless activation is positively observed.                                                             |
| Header    | `dist/index.d.ts`; `normalizeData`, `levels`, `defaultLevel` in `header.mjs`                                                 | Saves `{text, level}`. Normalizes input, including numeric-string levels. The default getter falls back to the second available level, so a singleton subset needs an explicit included default. Levels are filtered in numeric order.                                                                     |
| List      | `dist/index.d.ts`, `dist/types/ListParams.d.ts`, `ItemMeta.d.ts`, `OlCounterType.d.ts`; normalization in `editorjs-list.mjs` | Current data has root style/meta/items and recursive content/meta/items. Supports ordered, unordered and checklist. Runtime also converts legacy flat strings and old checklist objects, and fills missing root metadata. That behavior must not be mistaken for the wrapper validator's migration policy. |
| Quote     | `dist/index.d.ts`; constructor/save in `quote.mjs`                                                                           | Saves text, caption and left/center alignment. Configuration's alignment type uses a private enum. Inline HTML strings need host rendering policy.                                                                                                                                                         |
| Image     | `dist/index.d.ts`, `dist/types/types.d.ts`; uploader, paste, data and upload handlers in `image.mjs`                         | Saves file URL/metadata, caption and border/background/stretch flags. Empty upload placeholders are possible before success. Custom uploader methods are individually optional upstream; omission falls back to AJAX. Failure declarations require `file` despite core's file-less failure variant.        |

The image file method accepts Blob: pasted `blob:` image URLs are fetched and
converted to Blob before upload. A File-only port is too narrow for all supported
paths. Core's generic upload port already accommodates Blob without adding DOM
types to core. The wrapper must require both custom methods and translate core
failure results to rejection, preventing implicit endpoint fallback.

Upstream calls custom uploader methods in ways that can expose synchronous
throws; the adapter must normalize calls and preserve the method receiver.
Image's upload-result handlers are private in declarations. Preview/FileReader
and upload promises can outlive the editor, and there is no public cancellation
contract. Use public composition only; #614 owns late-completion evidence and
must seek a reviewed fix/amendment if the minimum lifetime contract cannot be
established. Read-only flags alone do not prove uploads or pending callbacks are
safe after removal.

## Evidence still required

This slice did not construct tools in a real browser, implement the proposed
helpers/validators, or build/install future Anarchitects tool archives. It does
not establish real editing, saved round trips, upload UI behavior, Angular Forms,
SSR hydration, lazy network delivery, root purity or remote DTE for those packages.
The [contract's ownership table](editorjs-common-tools-design.md#evidence-nx-tasks-and-delivery-ownership)
assigns those checks to #610–#616, retaining per-package first-use evidence.

Compatibility is bounded to the observed candidate artifacts and type probe.
Recheck tarball identity, declarations, licensing, runtime behavior and release
history when implementing or changing versions; a later upstream patch is not
automatically covered by this review.
