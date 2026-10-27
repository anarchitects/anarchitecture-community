# Paragraph implementation and validation

Issue: [#610](https://github.com/anarchitects/anarchitecture-community/issues/610).
This is the first package slice following the
[common tools contract](editorjs-common-tools-design.md), not the combined
five-tool certification owned by #615.

## Architecture preflight

On 27 October 2026, before generating or editing code, all eight Community ADRs
and all eighteen Meta ADRs were enumerated and read, including proposed,
historical and superseded content. Community started at
`280e31baba73ac46e13bb30037939a0d8852bd36` (merged #609); Meta was clean at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. The filename/status inventory in the
[registry review](editorjs-tool-registry-design.md#architecture-review-and-authority)
remains applicable. Only `docs/adr` was found as a Community ADR directory.

The Modern Angular index, repository application, architecture, providers/routing,
reactivity, Forms, rendering, SSR/builds, testing/migration, validation and API
ledger guides were read. Nx generation/workspace/task/package-linking skills and
Angular guidance were applied. The Nx JS library generator created the package;
Yarn workspace commands added dependencies and Nx sync added project references.

Applicable constraints are the neutral core and explicit browser boundary,
existing standalone Angular registry integration and optional native Forms,
public exports and complete packed README evidence (local 0004 and Modern Angular
decisions), actual distribution history and exact Nx scope (local 0007/Meta0013),
and accurate cache/DTE inputs and outputs (Meta0015). Governance proposals and
HTTP/Nest decisions retain their original scope; no proposed decision overrides
accepted policy. There is no accepted ADR conflict or requested exception.

The reviewed upstream constructor needs one bounded refinement: paragraph 2.11.7
requires `config`, whereas Editor.js's public block constructor allows it to be
absent. The browser subclass supplies `{}` only when absent. It inherits upstream
rendering, saving and static capabilities; it does not patch private internals.
The configured-class consumer exposed this difference from #609's raw constructor
probe. Unit and real browser evidence cover the refined public seam.

## Package and consumer evidence

- Package: `@anarchitects/editorjs-tool-paragraph` 0.0.1; exact upstream paragraph
  2.11.7 dependency and Editor.js 2.31.7 peer; TypeScript 6.0.3.
- Build, typecheck, lint and 23 unit/package tests pass, including Node 22.12.0.
  The minimum-runtime CI job now includes paragraph alongside core.
- Packed root import succeeds with poisoned DOM globals and no Angular,
  Editor.js or upstream paragraph installed. Strict ES2022-only declarations pass
  under both NodeNext and Bundler, with library checks enabled.
- Archive checks cover exports, license, README identity, dependency metadata,
  declarations, browser entry and exclusion of source/tests/build-info files.
- The helper preserves alias and constructor inference (including promise chains),
  config identity and explicit replacement semantics. Validator negatives cover
  malformed text, non-JSON extensions, cycles, depth and unreadable/accessor data.
- Fresh reference preparation installs the tarballs in independent consumers,
  compiles all four README examples and verifies Angular root use without Forms.
  Browser declarations use Bundler resolution; upstream's NodeNext limitation is
  documented rather than hidden with `skipLibCheck`.

The reference packed run is `paragraph-610-ready`: Angular 22.1.4, consumer Node
24.15.0, Editor.js 2.31.7, TypeScript 6.0.3, Chromium on macOS arm64, orchestrated
with Node 24.22.1. Its preparation evidence and locks live under
`dist/editorjs-packed-inputs/paragraph-610-ready/csr/angular22-reference/evidence`;
phase reports live under the corresponding `dist/editorjs-packed-results` path.
These generated artifacts are not committed.

The direct consumer shares an inert lazy definition with the Angular host. A
constructor probe, emitted upstream module provenance, cold request exclusion and
post-mount requests prove actual packaged activation. Real editing covers inline
bold HTML, save/render, placeholder, blank preservation, read-only transitions and
removal. An untouched built-in control omits blank content. Angular exercises the
existing provider, editing/save/render/clear/read-only and independent owners.

## Caching and distribution

Resolved `editorjs-tool-paragraph:build` is cacheable and restores
`{projectRoot}/dist`, with `^build` ordering. Runtime version/platform/architecture,
Node options, root configuration, dependency source and lockfile participate in
inputs. Package tests and the three inferred `test-ci` atoms share runtime-aware
inputs; each atom depends on build. The collector retains all three prerequisites.

The graph contains `editorjs-angular-e2e -> editorjs-angular-host ->
editorjs-tool-paragraph`. Uncached packed preparation builds and packs paragraph.
Source fingerprints include its implementation, manifest, README, license,
TypeScript/Vite configuration and the previously omitted core Vite configuration.
Existing immutable snapshots retain archive/dependency-lock integrity checks.
The 66 packed validation atoms remain intact; these short cases extend the existing
portable and CSR editor atoms. Fresh registry installation stays outside DTE.

Local build evidence from this slice:

| Probe                                  | Task hash              | Result                                                         |
| -------------------------------------- | ---------------------- | -------------------------------------------------------------- |
| Baseline/repeat                        | `7365887533346542002`  | Local hit (built by preceding package checks)                  |
| Identical repeat                       | `7365887533346542002`  | Local hit                                                      |
| Removed output directory               | `7365887533346542002`  | Local hit; eight files restored with identical SHA-256 digests |
| Paragraph source comment               | `16187975837657004465` | Miss                                                           |
| Vite configuration comment             | `14561739077608882754` | Miss                                                           |
| Core dependency source comment         | `11802005477966375557` | Miss                                                           |
| Lockfile comment                       | `4536132120513583894`  | Miss                                                           |
| All probe edits reverted byte-for-byte | `7365887533346542002`  | Local hit                                                      |

These probes establish file sensitivity and local restoration, not semantic
compatibility with a different dependency version. They do not establish remote
reuse or execution on multiple workers. Nx rejects the inferred `test-ci` collector
with `NX_NO_CLOUD=true`; local validation uses the full `test` target. Hosted
distribution remains the existing CI workflow's responsibility, with combined
remote equivalence evidence owned by #615. Revisit on this PR's hosted run and
retain any actual CI failure as a merge blocker; do not infer DTE from local
parallelism.

## Delivery boundaries

On this date the npm registry returned 404 for this package, its remote matching
tag list was empty and none of 102 GitHub releases mentioned it. Use
`init(editorjs-tool-paragraph)` with manifest version 0.0.1. No publication,
version bump, merge or next slice is authorized by this implementation.

Local evidence is bounded to the reference cell and Chromium. The existing CI
matrix retains the other pinned cells; combined tools, comprehensive accessibility,
public content rendering and hosted equivalence remain #615/#616 responsibilities.
Structural validation does not sanitize HTML. The browser entry injects global CSS;
root imports remain DOM-free. Image alt-text authoring and its storage/rendering
semantics are recorded in #71/#614/#615/#616 and are not paragraph behavior.
