# Editor.js Angular release readiness

For the registry introduced after this review, use the
[registry documentation and release-readiness addendum](editorjs-tool-registry-release-readiness.md).
It records the current registry surface, atomized packed validation, exact cells
and release history reviewed for #598. This document retains #568's dated
standalone/Forms/SSR evidence; its historical counts and paths are not a new run.

This record consolidates the standalone, opt-in Forms and bounded SSR/hydration
contract through #568. The [SSR fixture evidence](editorjs-angular-ssr-fixture.md)
provides detailed server, browser, request-isolation and route-delivery results.
Consumer installation, examples and support limits live in the
[package README](../packages/editorjs/angular/README.md). The
[development guide](editorjs-angular-development.md) records implementation evidence
and workspace fixture instructions; the [Forms design](editorjs-angular-forms-design.md)
records the accepted ownership contract. This review does not publish a release or
replace the requirement for green CI on the intended release commit.

## Reviewed decisions and public surface

For #568, all seven repository ADRs and all fifteen Meta ADRs at
`e2f34553c6e2492d0ab6f80ac795de44fc592a70` were enumerated and read on 2026-10-13,
including proposed and historical records. Governance ADRs 0001–0003 retain their
own scope. Local Nest ADRs 0005–0006 and Meta HTTP independence, Native Node
evaluation, Nest-first, authentication and canonical HTTP-contract decisions do
not authorize Nest integration or a default change here. Other accepted Meta
records preserve repository ownership and both core architecture styles; proposals
do not override accepted decisions. Accepted Modern Angular
A01/A02/A03/A04/A05/A06/A07/A08/A09/A10/A11 require bounded compatibility, native form ownership,
explicit async semantics, cleanup, supported builders and public artifact evidence.
ADR0004 requires a current consumer README in the archive and keeps fixture/release
procedures in contributor documentation. No conflict or new runtime decision was
introduced. Nx workspace/task skills and the reviewed Angular guidance apply;
this final increment changes validation and documentation, not Angular runtime code.
The guide index, repository application, architecture, providers/routing,
reactivity, Forms, rendering, SSR/builds, testing/migration, validation and API ledger
were reviewed. Angular MCP documentation search confirmed the hydration-provider
API; its best-practices endpoint returned `Unexpected response type`.

| Surface                                   | Reviewed contract                                                                                                                                                                 | Evidence                                                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `EditorJs`                           | Immutable `config`/`data`, initialization-only configuration, payload-free `ready`, detached `change`, typed `error`.                                                             | Packed declarations, library contracts and standalone browser scenarios.                                                                    |
| Root `api`, `invalidate()`, `reconcile()` | One core queue; save/render/clear/focus/read-only controls, readiness/disposal guards and explicit reconciliation.                                                                | Public fixtures, core/component tests and browser cases.                                                                                    |
| Root loading and types                    | `EDITOR_JS_LOADER`, `provideEditorJsLoader`, config/tools/loading types and core event/control re-exports. `EditorJsOperationError` preserves core class identity.                | Exact runtime export checks, typed consumer fixture and real lazy-loader integration.                                                       |
| `/forms` exports                          | Only runtime `EditorJsControl`; type-only `EditorJsControlConfig`; no CVA, fake NgControl or package-owned FormControl/FormGroup.                                                 | Exact secondary export checks, public declaration/example compilation and implementation review.                                            |
| Forms value/config                        | Non-null `OutputData`, immutable initialization config; no separate `data` or `api`. Invalid input retains the requested model and reports an operational error.                  | Native binding, normalization and browser failure/recovery tests.                                                                           |
| Forms state and outputs                   | `disabled`, `readonly`, `invalid`, `pending`, `touched`, `dirty`, `required`, `name`, `errors`; native `touch`, plus `ready`/`change`/`error`. Angular owns flags and validation. | Native contracts and keyboard/focus/availability browser assertions.                                                                        |
| Forms `focus()`, `reset()`, `save()`      | Native focus/reset hooks and detached snapshots. Reset invalidates synchronously; superseded snapshots reject. Save does not publish value, mark dirty or run validation.         | Deterministic race tests and held real-editor snapshots in the browser.                                                                     |
| Native migration bindings                 | Direct reactive controls, `compatForm` and `SignalFormControl.fieldTree` with bounded option/reset behavior. `ngModel` excluded from clean initialization/reset support.          | Forty interop cases per packed baseline; direct reactive browser scenario; compiled examples.                                               |
| Packaging                                 | APF/ESM root, `/forms` and `package.json`; core/tslib dependencies; optional Forms peer; no Forms dependency in core/root.                                                        | Two installation stages per matrix cell, export/dependency allowlists and guarded imports.                                                  |
| SSR and prerendering                      | Request-owned initial state, empty server holders, browser-only creation; no saved-content renderer.                                                                              | Production ESM HTTP/prerender output, escaped transfer data, sequential/overlapping request markers and process/socket teardown.            |
| Hydration and deferred activation         | Immediate default/full-with-replay hydration, fixed prerender samples and one interaction-triggered ordinary/incremental boundary; standalone and Signal Forms.                   | Retained pre-bootstrap holder identity, diagnostics, real editing, controlled lifecycle races and pre-hydration click/Enter.                |
| Public route isolation                    | Host-owned lazy authoring routes without automatic preloading; no universal package-only delivery guarantee.                                                                      | Emitted dependency graph, cold browser network/evaluation/preload checks, positive authoring controls and an eager-import negative control. |

Core owns normalization, the shared queue, coalescing, invalidation and disposal
checks. Angular owns signals, DI/platform adaptation and holder/component lifetime.
The Forms adapter consumes Angular's native field state; it introduces no second
operation queue or application form model. Non-Angular hosts can use the neutral
core coordinator with their own driver, readiness and teardown.

## Compatibility matrix and reproduction

The executable cells live in
[compatibility-matrix.json](../apps/editorjs/angular-e2e/tools/compatibility-matrix.json).
These pinned reference cells do not track `latest` or claim every patch permutation.

| Cell                  | Matched Angular runtime/Forms/SSR/compiler/CLI/build | Editor.js | Consumer Node | TypeScript |
| --------------------- | ---------------------------------------------------- | --------- | ------------- | ---------- |
| `angular22-minimum`   | 22.0.0                                               | 2.31.7    | 22.22.3       | 6.0.3      |
| `angular22-reference` | 22.1.4                                               | 2.31.7    | 24.15.0       | 6.0.3      |
| `angular22-current`   | 22.2.2                                               | 2.31.7    | 26.0.0        | 6.0.3      |

Angular peers remain `^22.0.0`; Forms must match the application's other Angular
packages. Editor.js remains `^2.31.7`, with 2.31.7 pinned in the fixtures/install
examples. Angular tooling is bounded to `^22.22.3 || ^24.15.0 || ^26.0.0`;
future Angular/Editor.js majors and Node 27+ are not promised. Core retains its
independent Node >=22.12.0 baseline. Chromium/macOS local evidence and Linux CI
jobs do not constitute a full browser, OS or Windows-tooling certification.

```sh
yarn nx run editorjs-angular-e2e:install-browsers
yarn nx run-many -p editorjs-core editorjs-angular editorjs-angular-host editorjs-angular-e2e -t build typecheck test lint e2e
yarn nx run editorjs-angular-e2e:e2e-packed
# Re-run one cell:
yarn nx run editorjs-angular-e2e:e2e-packed --cell=angular22-minimum
yarn nx run editorjs-angular-e2e:test-ssr
yarn nx run editorjs-angular-e2e:e2e-hydration
yarn nx run editorjs-angular-e2e:e2e-isolation
yarn nx run editorjs-angular-e2e:e2e-packed-ssr
```

`e2e-packed` packs both libraries and installs them in an owned temporary directory
outside the workspace, using fresh exact peers and a cell-specific Node binary.
It asserts actual versions and paths, without workspace aliases, peer symlinks or
Nx installed in the consumer. Each cell performs two installation stages:

1. **Forms absent:** install the archives and root prerequisites; require resolution
   of `@angular/forms` to fail; import the root under browser-global guards; compile
   the standalone public declaration fixture with the cell's Angular compiler.
2. **Forms installed:** install the exact matching Forms peer, recheck all dependency
   versions/paths, and assert root/secondary exports and blocked private subpaths.
   Both imports remain guarded against package-introduced browser-global access.
   Compile every CSR TypeScript block from the installed README and both public contract
   fixtures, run forty native interop cases, build the consumer with its Angular CLI,
   and run thirteen Chromium scenarios (five standalone, eight Forms).

Each stage also checks the optional peer metadata, Angular's core/tslib dependency
allowlist and core's empty runtime/peer/optional dependency set. Exact packed README
bytes must match the source. The documented custom-tool import is supplied by a
small consumer-owned fixture; validation/submission example endpoints remain
application responsibilities. The ordinary library package test additionally checks
root imports and an empty-holder server render without Editor.js installed.

Reports now live under
`dist/editorjs-packed-results/<runId>/csr/<cell>/collect`, including both locks,
versions, package boundaries, browser HTML reports and failure artifacts. Fresh
preparation remains uncached. Build and browser atoms transport immutable,
run-scoped evidence through Nx caching; the final uncached gate fails on any
failed or missing outcome. Consumers and leased ports are cleaned up after each
atom. See [packed validation and Nx DTE](editorjs-angular-packed-dte.md) for the
graph, artifact/cache contract, CI lifecycle and measured limitations.

## Documentation review

The packed README covers purpose, prerequisites/install, standalone and Signal Forms
quick starts, native state/focus/reset, current-snapshot submission, validation and
operational errors, deferred save limitations, supported migration paths, public
exports, ownership and troubleshooting. It now includes the bounded SSR profiles,
host-owned provider/routing recipes, ordinary and incremental activation, initial
data/privacy rules, native-submission/replay limits and failure recovery.
All TypeScript examples compile on every SSR cell; the separate CSR consumer
compiles CSR examples without adding SSR host dependencies. Both installation stages
exercise the optional-peer contract. Contributor-only
fixture descriptions were removed from the public README under ADR0004.

`e2e-packed-ssr` extracts the named recipe files from the **installed README**,
including the existing standalone and Forms quick starts. It builds an additional
application with the documented route/provider functions in both default and full
profiles. Only root bootstrap, a router outlet/navigation shell and the existing
private Node server are supplied by the harness. Real browser checks exercise
request-rendered and prerendered holders, editing and Forms availability, ordinary
defer, incremental Forms activation, navigation cleanup and JavaScript-disabled
non-submission. The incremental-specific case runs only in the default profile.
These examples intentionally have no persistence endpoint; the separate submission
recipe still requires application-owned validation/persistence services.

This adds thirteen README browser cases per cell (seven default, six full) to the
existing forty Forms interop, thirteen CSR, 118 hydration and ten isolation cases
and four fixture builds. The two README builds, extracted sources, exact config and
browser reports are retained under `ssr-compatibility/<cell>/readme/{default,full}`.
Port 4335 is owned by the README server, with normal Playwright shutdown and outer
packed-task process-group cleanup. Existing CI matrix jobs run these checks through
the same uncached target and upload the additional evidence automatically.

The supported reset model is explicitly non-null. Legacy controls require the
editor reset hook when reset/write can overtake editor work; `SignalFormControl`
dispatches it natively. Legacy `updateOn` modes do not defer saved publications,
`compatForm` silent writes are unobserved until an event, and compatibility control
availability/validation belongs to native schema rules. Direct `ngModel` has a
transient-null diagnostic and a simultaneous reset/write stale-view limitation.
No blanket legacy-option parity or automatic save-on-submit is promised.

## Release gates and evidence limits

Local validation on 2026-10-12 (macOS arm64) passed all fifteen relevant Nx tasks
across core, Angular, the browser host and e2e project; four tasks used valid cache
results. This includes build/typecheck/lint, 152 core tests, 138 Angular tests and
thirteen workspace Chromium scenarios. All three packed cells passed both peer
installation stages, declaration/README compilation, forty native interop cases
per cell (120 executions) and thirteen Chromium scenarios per cell (39 executions).
Retained locks confirm Forms is absent initially and exactly matched afterward.
Existing lint warnings remain: one in core, eleven in Angular and six in the
standalone browser spec; no lint errors. This is local evidence, without CI
monitoring, version changes or publication.

The final #568 packed SSR run on 2026-10-13 (macOS arm64) passed all three cells in
one invocation. Each passed both peer-installation stages, all fourteen README
TypeScript blocks, public declarations/exports, forty native Forms tests, thirteen
CSR browser cases, four fixture SSR builds, server/request-isolation checks,
118 hydration cases, ten route-isolation cases and both additional README builds.
The README applications passed seven default-profile and six full-profile browser
cases per cell: 39 additional browser executions across the matrix. Both archive
READMEs matched source bytes. Passing result/cleanup records were checked, and all
three consumer directories and their shared scratch directory were confirmed absent.
The Angular package tests and Angular/e2e lint and type checks also passed.
The independent `e2e-packed --cell=angular22-reference` CSR regression passed with
the revised example extraction, including its optional-peer stages, forty native
Forms tests and thirteen browser cases. Formatting, relative links/anchors and
whitespace checks passed. These results are local evidence, not hosted CI status.

Validation corrected two harness details: the README application's local server
now has an explicit loopback-host allowlist, and the existing keyboard/touch test
selects the named fixture note input rather than any textbox (which could also
match Editor.js's toolbar filter). The latter failure trace is retained locally in
`test-output/readiness-failures/reference-keyboard`. No assertion was removed,
automatic retry enabled or package runtime changed to obtain these results.

Required CI paths remain:

- Main workspace build/typecheck/test/lint job.
- Independent `editorjs-core` Node 22.12.0 baseline.
- Workspace Chromium job (`editorjs-angular-browser`).
- All three packed-consumer matrix jobs (`editorjs-angular-packed-consumers`).
- Workspace SSR/hydration/isolation (`editorjs-angular-ssr`) and all three
  packed SSR jobs (`editorjs-angular-packed-ssr`), added with #567.

Before release, require green checks for the exact release commit and review its
matrix artifacts and final tarballs after any version/manifest transforms. Local
success and merged implementation PRs are not hosted CI or publication evidence.
CI monitoring is intentionally omitted unless the maintainer requests it. Existing
workspace checks and branch protection remain in force.
The manual release/publish workflows do not themselves run the complete SSR
matrix or query these exact-commit statuses. Maintainers must review all required
checks and retained artifacts before authorizing a release; workflow presence or a
successful package-only publish prerequisite is not a substitute.

Browser evidence includes value/flag synchronization, keyboard/composite focus,
availability, reset, validation/submission failure, independent controls and repeated
teardown. Save delivery can be held after a real capture to verify invalidation and
output silence. This is not proof of universal third-party leak freedom, tool
accessibility, screen-reader conformance or every browser combination. Guarded imports
alone are not SSR evidence; the additional fixture and packed evidence establishes the explicitly
bounded support contract.

The SSR evidence accumulated through #567 on 2026-10-13 includes all three pinned
cells, each with four builds, real ESM HTTP serving, fixed public prerender output,
zero server editor activity, sequential and overlapping request-state isolation,
escaped transfer values, 118 hydration cases and ten route-isolation cases. Shared
workspace suites passed separately. Browser assertions retain server node identity,
reject hydration diagnostics, hold loading/readiness/save work across owner removal,
exercise native form state and guarded pre-hydration click/Enter, and prove public
route isolation with both positive and negative controls. The detailed fixture
record preserves commands and earlier failure/recovery observations.

Support remains limited to the README's immediate default/full-with-replay,
fixed public prerender, ordinary interaction defer and one non-nested incremental
interaction boundary. It does not extend to nested hydration, every defer trigger,
editable `hydrate never`, custom route reuse, multiple apps per document,
streaming/edge/Nest deployments or arbitrary tools. Real-browser evidence is
Chromium/macOS arm64; Linux jobs are required CI paths, not a claim of an observed
hosted result in this review. Firefox, WebKit, other operating systems and Windows
tooling remain untested. Legacy Forms SSR support is not inferred from the Signal
Forms matrix. The editor still does not render saved blocks on the server.

## Final artifact and release ordering review

The generated Angular APF manifest remains `0.0.1`, ESM/ES2022, with public `.`,
`./forms` and `./package.json` exports. Root and Forms resolve to packaged `types`
and `fesm2022` files under normal consumer conditions. The repository-only source
condition is not a consumer entry point. Runtime dependencies are
`@anarchitects/editorjs-core: ^0.0.1` and `tslib: ^2.3.0`; core/common/optional
Forms peers remain `^22.0.0`, Editor.js remains `^2.31.7`, and tooling engines remain
`^22.22.3 || ^24.15.0 || ^26.0.0`. Core remains `0.0.1`, Node `>=22.12.0`, with
root/package-metadata exports and no runtime, peer or optional dependencies.
Both packages' actual archive READMEs must byte-match their sources; public
declaration compilation, exact runtime exports and private-subpath rejection are
checked again in each fresh consumer.

The tarball installs prove compatibility with the locally packed core; they do
not establish registry availability. Publish or verify a compatible core release
before publishing Angular, then recheck Angular's transformed dependency range.
At `0.0.x`, `^0.0.1` does not admit `0.0.2`: if core's release version changes, the
Angular release must explicitly reference the compatible released core and repeat
the final artifact checks. A shared commit or independent tags do not guarantee
that dependency ordering. No version or manifest is changed by this review.

## Semver and release notes

No version, release tag or registry publication changes in #568. Working manifests
remain 0.0.1. `init` is the required delivery prefix, not a semver classification;
it does not request a semver bump here or classify the
compatibility impact. Compare the intended release with the previously published
artifact, choose the version explicitly, publish a compatible core before Angular,
and verify that the generated core dependency range resolves from the registry.

The #69 runtime diff from the completed Forms baseline `a165681` is confined to
the Forms editing region: #563 adds a serialized `inert` attribute alongside the
existing DOM-property binding so unavailable server HTML matches the client.
That is a bug fix to the existing unavailable-state contract and is patch-level
in isolation. No core runtime, public exports, required peers or dependency ranges
changed in #69. The new bounded SSR support statement is an additive capability
claim and belongs in feature release notes; if releasing an already-published
compatible line, prefer an explicit minor release for that capability. The full
unreleased package history still requires the compatibility review below; a patch
classification for the inert fix does not classify all accumulated work.

During `0.x`, incompatible contract changes need an explicit minor release and
migration guidance; from `1.0`, use a major. Peer/runtime narrowing, accepted document
shape, loader obligations and event/error semantics are compatibility decisions.
The optional secondary entry is additive, but the core/root snapshot change is
material: later authoritative replacement/reset rejects pending snapshots with
`superseded`. Failed render/clear suspends publication until successful explicit
reconciliation. Do not describe the entire increment as automatically non-breaking.

Release notes should describe:

- Standalone Angular 22 editing, immutable configuration/data, typed outputs and
  per-owner controls backed by the generic core coordinator.
- Opt-in `@anarchitects/editorjs-angular/forms`, the matching optional Forms peer,
  `EditorJsControl`/`EditorJsControlConfig`, native value/state/touch/focus/reset and
  explicit snapshots; no CVA or separate package FormControl.
- Non-null models, superseded snapshot rejection and reset/reconciliation recovery;
  already-running upstream work cannot be forcibly cancelled.
- Native legacy support boundaries and migration actions above, including `ngModel`
  exclusion, immediate `updateOn` publication and explicit legacy reset hooks.
- Read-only save restrictions, asynchronous validation versus editor work, and the
  consumer's responsibility to capture and validate the exact persistence payload.
- Lazy loading, disposal, public APF exports and the exact tested combinations;
  bounded SSR/prerendering, immediate full/default hydration and ordinary/incremental
  interaction defer, with empty server holders rather than saved-content rendering.
- Host-owned providers, request data, safe pre-hydration submission and lazy route
  composition; normal route teardown and asynchronous reset/disposal limitations.
- The unavailable Forms region now serializes `inert` consistently during SSR.
  No tool registry/bundle, uploads, persistence or Nest integration is included.

If earlier published metadata claimed unbounded Node 26+, also explain the bounded
Node 26 tooling range. Review the actual final README and exports after release
transforms rather than treating an unchanged source manifest as publication proof.

## Downstream ownership

The implemented Forms surface completes the package work reviewed under #68;
#69's agreed SSR profiles and consumer documentation are now covered.
Maintainer merge/release approval remains separate. Further work stays downstream:

| Workstream           | Ownership                                                       |
| -------------------- | --------------------------------------------------------------- |
| Nest SSR integration | Separate host integration and its own adapter/runtime evidence. |
| #70                  | Registry composition.                                           |
| #71 / #73            | Concrete tools and their integration.                           |
| #72                  | Upload transports and integration.                              |
| #74                  | Persistence and application storage.                            |

Existing applications adapt to these generic packages; adoption does not gate this
release. No concrete consumer-adoption gap was found in this review. Track a newly
found gap separately rather than redesigning the package around an existing consumer.
