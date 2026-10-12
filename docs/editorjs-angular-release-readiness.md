# Editor.js Angular release readiness

This is contributor/release guidance for the standalone surface reviewed in #539.
Forms value binding and interaction in #549–#550 are covered by the development guide;
full Forms release review remains #554. Consumer instructions live in the
[package README](../packages/editorjs/angular/README.md); implementation and the
workspace browser host are described in the [development guide](editorjs-angular-development.md).

## Reviewed decisions and scope

All five repository ADRs were reviewed for #539. Governance ADRs 0001–0003 retain
their Governance scope. Accepted Modern Angular decisions A01/A02/A03/A05/A06/A09/A10/A11
require bounded compatibility, standalone ownership, public entry points, deliberate
async semantics, supported builders and packed-consumer evidence. ADR 0004 requires
consumer documentation in the actual archive, with internal fixtures and release
procedures kept here. No conflict or new runtime architecture decision is introduced.

The Angular MCP best-practices endpoint remained unavailable. The accepted Angular
guides and installed compiler/API contracts govern this work. The wrapper continues
to use explicit OnPush and signals. No Angular dependency is added to core.

## Public API review

| Surface                                     | Reviewed contract                                                                                                    | Evidence                                                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `EditorJs` / `aa-editorjs`                  | Standalone component; optional immutable `config` and `data`; configuration is initialization-only.                  | Strict packed template compilation; deterministic input/lifecycle tests; browser mount and replacement.                       |
| `ready`, `change`, `error`                  | Payload-free readiness; detached saved changes with owner-local sequence; typed operation/code/cause errors.         | Packed event bindings, core queue tests and browser output assertions.                                                        |
| `api`                                       | Stable per-owner save/render/clear/focus/read-only facade; readiness and disposal guards; one core queue.            | Every control in packed declarations and browser scenarios; deterministic pending-operation and failure tests.                |
| `EditorJsOperationError`                    | Same core class re-exported by Angular; imperative rejection and live error output share identity.                   | Public export equality in each isolated consumer; component tests.                                                            |
| Configuration/loading types                 | `EditorJsConfig`, `EditorJsTools`, `EditorJsLoader`, `EditorJsFactory`, `EditorJsCreateOptions`, `EditorJsInstance`. | Packed consumer compiles all names; owned config fields are rejected with type assertions.                                    |
| Shared event/control types                  | `EditorJsApi`, `EditorJsReadyEvent`, `EditorJsChangeEvent`, `EditorJsErrorEvent`, `EditorJsOperation`.               | Packed consumer compile; core independently compiles ES2022-only declarations.                                                |
| `EDITOR_JS_LOADER`, `provideEditorJsLoader` | Lazy stateless loading infrastructure; one raw instance per factory call; environment-scoped overrides.              | DI/platform/ownership tests; packed import guards; browser integration delegates to the real default loader.                  |
| Entry points and dependencies               | Package root plus `package.json`; APF/ESM; actual core dependency plus tslib; Angular and Editor.js peers.           | Exact runtime exports and dependency allowlist, blocked private subpath, declaration resolution and npm archive installation. |

Core owns normalization, shared controls/events, serialization/coalescing and disposal
guards. Angular owns signal/DI/platform/holder adaptation and editor lifetime. A
non-Angular host can use `EditorJsDocumentCoordinator` with its own non-DOM driver,
readiness and teardown. Core validation remains independent of Angular adoption.

## Compatibility matrix and reproduction

The authoritative executable cells are in
[compatibility-matrix.json](../apps/editorjs/angular-e2e/tools/compatibility-matrix.json).
Registry metadata was checked on 2026-10-11: Editor.js 2.31.7 is the current published
reference; Angular 22.2.2 is the current Angular 22 release. These exact cells do
not track an unbounded `latest` tag.

| Cell                  | Angular core/common/compiler/CLI/build | Editor.js | Consumer Node | TypeScript |
| --------------------- | -------------------------------------- | --------- | ------------- | ---------- |
| `angular22-minimum`   | 22.0.0                                 | 2.31.7    | 22.22.3       | 6.0.3      |
| `angular22-reference` | 22.1.4                                 | 2.31.7    | 24.15.0       | 6.0.3      |
| `angular22-current`   | 22.2.2                                 | 2.31.7    | 26.0.0        | 6.0.3      |

The supported Angular peer range stays `^22.0.0`, Editor.js stays `^2.31.7`, and the
Angular package's tooling range is bounded to `^22.22.3 || ^24.15.0 || ^26.0.0`.
Future Angular/Editor.js majors and Node 27+ are not promised. These paired cells
are representative baselines, not the Cartesian product of every patch and browser.
Core's independent Node baseline and engine policy are unchanged.

From the repository root:

```sh
yarn nx run editorjs-angular-e2e:install-browsers
yarn nx run-many -p editorjs-core editorjs-angular editorjs-angular-host editorjs-angular-e2e -t build typecheck test lint e2e
yarn nx run editorjs-angular-e2e:e2e-packed
# Re-run one cell:
yarn nx run editorjs-angular-e2e:e2e-packed --cell=angular22-minimum
```

`e2e-packed` depends on the normal Nx build graph. It packs both libraries, creates
an owned temporary directory outside the workspace, installs the archives plus fresh
pinned peers and a cell-specific Node binary, then checks actual installed versions
and paths. There are no workspace source aliases or peer symlinks. It copies the
existing host source into that consumer and builds with the supported Angular
application builder via the cell's CLI. Nx orchestrates the repository target but
is not installed in the consumer application.

Each cell compiles every TypeScript block extracted from the **packed** README,
plus the public-contract fixture. The custom-tool example explicitly assumes a
consumer-supplied tool; a small fixture supplies that implementation for compilation.
The ordinary library package test performs the same README compilation on the
workspace peer baseline without requiring a registry install.

Each cell also imports the packed runtime with guarded browser globals and checks
core export identity and public paths, then runs all five existing Playwright
scenarios against its own production bundle. A local static server uses the cell's
Node binary on port 4318; Playwright starts it, waits for readiness and terminates
it. The normal workspace E2E uses port 4317. The helper runs on the repository's
macOS/Linux tooling baseline; this is not a Windows runner certification.

Network/package installation is deliberate and `e2e-packed` is not cached. Exact
installed transitive dependency locks and version records, HTML reports and failure
traces/screenshots are retained under
`apps/editorjs/angular-e2e/test-output/compatibility/<cell>`; temporary applications
are removed on success or failure. Re-run after updating a matrix baseline, and
review the retained lock when comparing runs.

## Release gates and evidence limits

Local validation on 2026-10-11 (macOS arm64) passed all three packed cells: public
contract and README compilation, guarded imports, production builds and 15 Chromium
checks. Each consumer used the exact Node version recorded above. The four-project
Nx build/typecheck/test/lint/E2E run also passed all 14 applicable tasks, including
the five workspace browser scenarios. `yarn install --immutable` succeeded with
the existing workspace peer-dependency warning and no lockfile change.

The required CI paths are the main build/typecheck/test/lint job, the independent
core Node 22.12 baseline, the workspace Chromium job and all three packed-consumer
matrix jobs. The matrix jobs install Chromium with Linux OS dependencies and upload
per-cell artifacts on failure or success. Existing workspace checks remain required;
this change does not weaken or bypass branch protection.

Before a release, require a green run for the exact release commit and review its
matrix artifacts. A passing local check is not evidence of a hosted CI result.
CI monitoring is intentionally omitted from this implementation workflow at the
maintainer's request; release approval remains a separate gate.

The browser scenarios validate initial data, editing/change/save, focus, render,
input replacement, clear, read-only transitions, accessible host labels/errors,
independent editors and repeated teardown. They establish observable ownership and
output silence, not universal third-party leak freedom or tool accessibility.
Server import/empty-holder smoke checks do not establish full SSR/hydration support.
No runtime/API change is needed to pass this review beyond bounding tooling metadata.

## Semver and release-note guidance

No package version, tag or registry publication is changed by #539. `init` commits
do not request a semver bump in this workspace. The current working manifests stay
at 0.0.1; the release author must select the actual release version after comparing
the intended surface with any previously published artifact. Core and Angular are
independently versioned; publish a compatible core before the Angular package and
verify that the generated manifest's core range resolves from the registry.

During `0.x`, an incompatible public contract change requires an explicit minor
release with migration instructions. From `1.0`, use a major. Treat peer/runtime
narrowing, accepted document shape, output/error semantics and loader obligations
as compatibility changes. In particular, replace the previous open-ended Node 26+
claim with the bounded Node 26 range in release notes if the old metadata was published.
Do not classify that metadata correction as automatically non-breaking simply
because the implementation commit uses `init`.

Suggested release notes should state:

- Standalone Angular 22 `EditorJs`, immutable configuration/data inputs and payload-free
  readiness, saved changes and typed errors.
- Per-instance save/render/clear/focus/read-only controls using shared core coordination,
  with explicit readiness/disposal rejection and documented recovery limitations.
- Lazy browser loading, per-component teardown, APF public exports and the tested
  Angular/Editor.js/Node/Chromium combinations above.
- Input updates can coalesce; replacements are authoritative; already-running upstream
  work and never-settling readiness cannot be forcibly cancelled. Editor.js save is
  unavailable while read-only. Tools own their schemas and accessibility.
- Opt-in Signal Forms value synchronization, composite touch, disabled/readonly and
  focus, reset invalidation and explicit snapshots. Snapshots superseded by newer
  authoritative work reject with `superseded`; failed render/clear requires an
  explicit successful reconciliation before publication resumes. No full
  SSR/hydration guarantee, registry, concrete tool bundle, upload transport or
  persistence implementation.

Do not present documentation, a merged PR or an unchanged manifest as a published
release. Review the package README in the final tarball after any release transform.

## Downstream boundaries

| Workstream | Follow-up ownership                              |
| ---------- | ------------------------------------------------ |
| #68        | Angular Forms / Signal Forms integration.        |
| #69        | Full SSR/hydration integration and evidence.     |
| #70        | Registry composition.                            |
| #71 / #73  | Concrete tools and their integration.            |
| #72        | Upload transports and integration.               |
| #74        | Persistence and application storage integration. |

These are not implemented promises of the standalone wrapper. Existing applications
adapt to the generic packages; their adoption does not gate this release. No concrete
consumer adoption gap was discovered by this package-focused review. If one is found,
track it separately rather than changing core or the wrapper around that consumer.

## Signal Forms lifecycle increment (#551)

Adds native reset and explicit snapshot methods, core-owned synchronous invalidation,
failed-render publication suspension, typed `superseded` snapshot rejection and
validation/submission documentation. This changes earlier explicit-save semantics:
a later accepted replacement now rejects an obsolete pending snapshot. Release
notes must describe this behavior even though the development commit uses `init`.
There is no version bump or publication in this change.

Native Angular contract tests supply deterministic race/failure evidence; full Forms
browser certification remains #553–#554. Existing standalone browser checks and
packed declaration/example compilation protect the earlier support surface.

Validation on 2026-10-12: 152 core tests, 98 Angular tests (62 Forms), builds,
type checks and lint passed. Final packed declarations/README examples compiled
on Angular/Forms 22.0.0, 22.1.4 and 22.2.2; all 15 standalone Chromium checks
passed. Root-only consumers remained independent of Forms. Existing lint warnings
remain; no CI monitoring or publication was performed.

## Native legacy Forms interoperability (#552)

Adds 40 native interoperability contract cases and three public migration examples.
Direct `formControl`/`formControlName`, `compatForm` and `SignalFormControl.fieldTree`
have explicitly bounded support. `ngModel` is characterized but excluded from clean
initialization/reset support because of transient null and stale-view behavior.
The README specifies non-null models, reset hooks, immediate publication despite
legacy `updateOn` modes, silent-write limitations and schema-owned compatibility
control state. No package runtime, dependency/peer or release version changes.

Validation on 2026-10-12: all 138 Angular tests passed, including 40 native legacy
interoperability cases. Angular and consumer-host builds, Angular/e2e type checks
and lint passed. The existing root-only package check still compiles without Forms.
The final isolated matrix passed on Angular/Forms 22.0.0, 22.1.4 and 22.2.2:
40 interoperability cases per cell, public declarations and every README example,
and all 15 existing standalone Chromium checks. Existing lint warnings remain.

These interoperability tests use actual Angular directives and packed package APIs
with a controlled editor in TestBed/jsdom. They do not replace #553's Forms browser
coverage or #554's final release certification. CI is not monitored; no publication
or merge is performed.
