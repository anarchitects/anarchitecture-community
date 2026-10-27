# Editor.js registry documentation and release readiness

Issue [#598](https://github.com/anarchitects/anarchitecture-community/issues/598)
consolidates the registry delivered by #592–#597 under epic #70. This review is
based on Community `1001773` (merged #597) plus this documentation and validation
increment. It adds no library runtime API, dependency, peer-range or version change.
The [core README](../packages/editorjs/core/README.md) and
[Angular README](../packages/editorjs/angular/README.md) are the consumer contracts.
The [design](editorjs-tool-registry-design.md),
[portable validation record](editorjs-tool-registry-validation.md) and
[earlier Angular readiness record](editorjs-angular-release-readiness.md) retain
implementation and historical evidence. None substitutes for required green CI
on the eventual release commit.

## Architecture preflight

On 27 October 2026, all eight Community ADRs and all eighteen Meta ADR records at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5` were enumerated and read, including
accepted, proposed, historical and superseded content. The complete inventory
and status mapping is in the [design's architecture review](editorjs-tool-registry-design.md#architecture-review-and-authority).
The Modern Angular guide index, repository application, architecture, providers/
routing, reactivity, Forms, rendering, SSR/builds, testing/migration, validation
and API ledger were reviewed. Angular MCP best practices and the Nx workspace/
task guidance were consulted.

Applicable accepted decisions preserve the framework-neutral, DOM-free core;
public Angular seams and environment/editor ownership; request-isolated SSR;
bounded compatibility and packed artifact evidence; and native opt-in Forms.
Local ADR0004 keeps contributor history outside published READMEs. Local ADR0007
and Meta0013 govern the release decision below. Meta0015 requires accurate
task inputs, restorable outputs and deliberate fresh external preparation.
Governance and HTTP/Nest decisions retain their scope; this change does not alter
those boundaries. Proposals do not override accepted decisions. No conflict,
exception or amendment is required.

## Public guidance and executable acceptance

| Epic #70 / #598 requirement                    | Consumer guidance and evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct non-Angular authoring                   | Core's direct browser recipe creates an owner, resolves tools, imports Editor.js, saves and disposes. `portable-consumer.mjs` extracts the marked recipe from the installed core tarball, typechecks it with DOM and pinned Editor.js, and bundles it. `portable/registry.spec.ts` edits/saves a real built-in paragraph and verifies teardown. The separate shared-tool host proves block/inline/tune behavior. |
| Selective block, inline and tune configuration | Core shows all three kinds, explicit selection, built-in references and whole-definition replacement. Core registry/type tests cover literal inference, name/kind conflicts, replacement, selection, safe keys, immutable containers and opaque config identity. Shared real-browser assertions exercise selected tools, replacement, labels, default paragraph and built-in inline/tunes.                       |
| Constructor versus loader and recovery         | Core documents inert composition, eager materialization, selected-only async resolution, attempt sharing, failure/retry and disposal. Resolver tests cover thrown/rejected loaders, invalid constructors, partial failure, stale siblings and never-settling work. The direct recipe and Angular remount example explain recovery without automatic retry or live tool replacement.                              |
| Optional Angular registration and ownership    | Angular documents environment-only providers, default isolation, explicit inheritance, repeated-provider option agreement, synchronous factory injection and per-editor resolvers. Provider/component tests cover real owner destruction, siblings, retained route environments, direct `config.tools` full-map precedence including `{}`, initialization-only config, and custom loader composition.            |
| SSR, hydration and route delivery              | Angular's named README recipes are built/run by the packed SSR harness. Registry fixtures prove empty server holders, request-local factories, sequential/overlapping requests, hydration and cleanup in production/diagnostic/full profiles. Graphs, browser requests, preload observations and evaluation probes include authoring positives and an eager negative control.                                    |
| Core has no Angular/DOM/Editor.js requirement  | `core/tests/package.spec.ts` checks the archive and compiles all neutral README examples in NodeNext and Bundler modes with `lib: ["ES2022"]`, `types: []` and no Editor.js/Angular installation. Its explicit allowlist separates the one marked browser recipe, which is checked in the browser consumer instead. Core still has no runtime/peer dependencies.                                                 |
| Standalone Angular has no Forms requirement    | Angular package tests and every fresh matrix preparation compile/import the root entry point and registry consumer before Forms is installed. Opt-in `/forms` examples, native interop and real browser behavior run after its separate installation.                                                                                                                                                            |
| Public examples and archive boundaries         | Package tests and fresh preparation compare README bytes, inspect exports/declarations/manifests and compile actual published TS blocks using public exports. Angular templates are checked by `ngc`; SSR recipes are checked by the application builder. The core browser bundle also proves packed-core provenance and absence of Angular inputs.                                                              |

All browser tools and executable hosts remain private fixtures outside the
publishable libraries. `kind` and the versioned profile validate registry
references, not a third-party class's Editor.js hooks, data schema, sanitization,
accessibility or lifecycle correctness. Opaque configuration retains identity;
replacement is not a deep merge. No registration helper promises application-wide
tree shaking or delivery isolation regardless of host policy.

## Exact validation envelope

The executable source of truth remains
[compatibility-matrix.json](../apps/editorjs/angular-e2e/tools/compatibility-matrix.json):

| Cell           | Angular | Node consumer runtime | Editor.js | TypeScript |
| -------------- | ------- | --------------------- | --------- | ---------- |
| Minimum        | 22.0.0  | 22.22.3               | 2.31.7    | 6.0.3      |
| Reference      | 22.1.4  | 24.15.0               | 2.31.7    | 6.0.3      |
| Current pinned | 22.2.2  | 26.0.0                | 2.31.7    | 6.0.3      |

Local orchestration uses macOS arm64, Node 24.22.1, Yarn 4.18.0 and Nx 23.2.1.
Browser evidence is Chromium through Playwright 1.64.0. The independent direct
consumer pins esbuild 0.28.2. These are validated combinations, not every
permutation admitted by the package ranges. Core's Node engine remains
`>=22.12.0`; Angular's remains `^22.22.3 || ^24.15.0 || ^26.0.0`. This review does
not newly certify core's minimum engine or broaden Angular/Editor.js support.

The [packed task graph](editorjs-angular-packed-dte.md) still has five CSR and
seventeen SSR atoms per cell, 66 total. The new README browser scenario runs
inside the existing portable atom. Fresh installs remain uncached coordinator
preparation outside DTE; immutable snapshots, run identity, isolated/restorable
atom outputs and uncached completeness gates remain unchanged. The modified
portable preparation helper already participates in the source fingerprint.
Local execution alone does not prove hosted distribution, cross-agent restore,
performance or cost improvements.

Reproduce through Nx:

```sh
yarn nx run-many -p editorjs-core editorjs-angular -t build typecheck test lint
yarn nx run-many -p editorjs-angular-e2e -t typecheck lint test-packed-harness
yarn nx run editorjs-angular-e2e:e2e-packed --phaseParallel=3
yarn nx run editorjs-angular-e2e:e2e-packed-ssr --phaseParallel=3
```

Local validation uses `NX_NO_CLOUD=true`, `NX_DAEMON=false`,
`NX_ISOLATE_PLUGINS=false` and `NG_BUILD_MAX_WORKERS=2`; these are invocation
settings, not changes to workspace policy. Reports under
`dist/editorjs-packed-results/<runId>/<mode>/<cell>` retain phase results, lockfiles,
commands, browser traces, build metadata and boundary evidence; input snapshots
are under `dist/editorjs-packed-inputs/<runId>/<mode>/<cell>`.

Validation record for this increment:

- Package build/typecheck/lint checks passed; core passed 216 tests and Angular
  passed 176 tests, including public archive and README compilation contracts.
- E2e typecheck/lint and all seven packed-harness tests passed.
- All 15 packed CSR atoms and their uncached completeness gates passed under run
  `e827ae31-1918-49b3-a674-dd55e22d9066`. Each cell ran all three portable browser
  scenarios, including the actual packed core README recipe, as well as the
  standalone, opt-in Forms and native interop suites.
- All 51 packed SSR atoms and their uncached completeness gates passed under run
  `37e2744c-0529-48fa-a7de-e2c53970dd3f`, including the named Angular README
  recipes, registry hydration in all three profiles, request isolation and
  public-route delivery controls. Total local CSR/SSR coordinator durations were
  4m 1s and 7m 34s respectively; these are not hosted DTE benchmarks.

## Release history and intent

The 27 October 2026 review checked both package manifests, the npm registry
package records, all 102 GitHub release records across both pages, GitHub tag
refs beginning with `editorjs`, and local package tags. Both npm package lookups
returned HTTP 404 (`Not found`); no Editor.js package release/tag was found.
The manifest value `0.0.1` in each package is therefore not evidence of a public
release. Under local ADR0007 / Meta0013 these remain **unreleased** packages and
package-specific work uses non-bumping `init` with the exact Nx project scopes
`editorjs-core` and `editorjs-angular`. Nx's independent conventional-commit
version calculation follows affected files; a scope does not restrict bumps.
The configured `init` type has `semverBump: "none"`.

Evidence endpoints: [core npm record](https://registry.npmjs.org/@anarchitects%2feditorjs-core),
[Angular npm record](https://registry.npmjs.org/@anarchitects%2feditorjs-angular),
[repository releases](https://github.com/anarchitects/anarchitecture-community/releases)
and [package tag refs](https://api.github.com/repos/anarchitects/anarchitecture-community/git/matching-refs/tags/editorjs).
Recheck actual history before a future release; this observation is dated.

Core publishes its root and `package.json` with neutral declarations and no
runtime/peer dependencies. Angular publishes root, `/forms` and `package.json`;
the packed APF has core and `tslib` dependencies, Angular common/core and Editor.js
peers, and optional Angular Forms. Root and Forms remain independently usable
according to that boundary. No exports, manifests or compatibility ranges change
in this increment.

Before publication, explicitly select `0.0.1` for each package's first distribution
under the accepted independent-release policy, review the
resulting independent package/dependency versions, verify the actual archives,
and require all configured CI checks green on that exact release commit. An
earlier main/PR run or local matrix is not release-commit evidence. This issue
does not authorize a version bump, npm publication, tag, automatic merge or
release operation. No release commit has been selected by this review.

## Remaining limits and follow-ons

- Disposal releases ownership and fences pending work; it cannot unload imported
  modules or force a never-settling upstream readiness promise to complete.
- SSR renders empty editing holders. Hosts own initial data, hydration providers,
  safe public content rendering, routes, preloading and request-local state.
  The isolation baseline excludes host prefetch/preload/service-worker policies.
- Optional Forms evidence covers the documented native bindings and pinned cells;
  it does not introduce a CVA, broaden `ngModel` support or certify all tools.
- [#71](https://github.com/anarchitects/anarchitecture-community/issues/71) owns
  reusable concrete tool packages and their versioned behavior. Fixture tools are
  not published products or third-party compatibility endorsements.
- [#72](https://github.com/anarchitects/anarchitecture-community/issues/72) owns
  upload adapters/transports and their policy; registry config does not perform
  uploads or supply credentials.
- [#73](https://github.com/anarchitects/anarchitecture-community/issues/73) owns
  expanded custom/third-party tool guidance and tool-specific lifecycle/version
  integration. This review explains the generic registry contract only.
- Persistence (#74), broader demos/testing (#75/#78) and publication (#76) remain
  separate. Epic #70 tracking should distinguish merged implementation slices
  from this readiness PR and the future release gate.
