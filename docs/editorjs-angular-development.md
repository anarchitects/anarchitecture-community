# Editor.js Angular package development

Nx project: `editorjs-angular`. Package: `@anarchitects/editorjs-angular`.
Consumer-facing behavior is documented in the
[package README](../packages/editorjs/angular/README.md).

The [tool registry implementation contract](editorjs-tool-registry-design.md)
defines #70's core composition (#593) and lazy resolution (#594), plus planned
optional Angular providers and browser ownership. Its proposed Angular APIs are
not current package exports.

The [SSR and hydration contract](editorjs-angular-ssr-design.md) defines #69's
rendering modes and ownership. The [fixture evidence](editorjs-angular-ssr-fixture.md)
and [consolidated release review](editorjs-angular-release-readiness.md) record the
completed bounded SSR/hydration support and packed README verification through #568.
The implementation sections below preserve their historical scope; their earlier
“remains #69” statements are superseded by that review, not broader support claims.

## Implementation boundary

Issue #533 established packaging and artifact checks. #534 adds typed configuration,
shared controls/events and the lazy loader/provider seam. #535 adds the standalone `EditorJs` component and per-component lifecycle. The
maintainer chose readiness-only notification (`EditorJsReadyEvent = void`), with
a separate stable `api` facade added in #537. #536 added live document updates and
saved-change outputs through the framework-neutral `EditorJsDocumentCoordinator`.

Core owns framework-neutral controls/events and data algorithms. Angular re-exports
the shared event/control types and consumes `normalizeOutputData` at the creation
boundary. Editor.js configuration (which references browser types), Angular DI,
platform checks and holder binding stay here. The loader returns a synchronous
factory so an owner can check for destruction after awaiting code loading and
before constructing an editor. Factory calls create separate instances, reserve
holder/data/callback ownership, and propagate failures; no instance lives in DI.

The contracts choose initialization-only configuration, serialized accepted data
replacements/commands, coalesced automatic saves with stale-result suppression,
and no programmatic-write feedback. Core now owns that document queue behind a
non-DOM driver. #537 extends the same queue for imperative operations; it does not
introduce an independent queue. Angular observes input signals after rendering
and translates core events to outputs. No generic queue or parser is duplicated here.

For #536, all five ADRs and relevant architecture/reactivity/rendering/testing/SSR
and provider guides were reviewed again. Governance decisions remain scoped to
Governance; accepted A02/A05/A06/A09/A10 and ADR 0004 govern this change. The core
queue uses ES2022 promises without adding a framework/reactive runtime dependency.
Angular's `afterRenderEffect` synchronizes the external editor sink; it is not a
lossless event bus. Input values are read explicitly and incidental callback reads
are untracked. The `change` output retains the agreed contract with the same narrow
native-event-name lint exception as `error`; no additional ADR conflict was found.

Editor.js 2.31.7 batches change callbacks and disables its mutation observer during
rendering without clearing an already scheduled callback. Core therefore takes a
silent saved baseline after replacement and compares later normalized snapshots,
ignoring root timestamps and object-key order. The baseline includes upstream IDs
and tool normalization. Notifications during queued/running replacement are ignored;
replacement is authoritative over edits to the previous content. If render/baseline
saving fails, the next successful snapshot is a silent recovery baseline, potentially
including intervening edits; this limitation is documented for consumers.

Generic tests cover serialization, coalescing, stale results, feedback suppression,
validation, failures and disposal independently of Angular. Component tests verify
input identity/readiness/configuration behavior and core event/error delegation.
Packed consumers exercise the new class with ES2022-only declarations and compile
the Angular `(change)` binding. Real browser coverage lives in the separate host and E2E projects described below;
the jsdom runtime test remains a fast check of saved editing and replacement.

All five repository ADRs were reviewed: Governance ADRs 0001–0003 retain their
Governance scope; the accepted Modern Angular ADR and ADR 0004 apply to this
package. Relevant architecture, reactivity, providers, forms, SSR/builds and testing
guides were reviewed. The wrapper follows the core's contracts; existing consumers
own adaptations. Forms and full SSR/hydration validation remain #68/#69.

The Angular MCP best-practices endpoint failed during this scaffold work; official
[Angular guidance](https://angular.dev/ai/develop-with-ai) and the local accepted
guides were used. The live guidance now relies on Angular 22's default OnPush,
whereas the accepted local guide requires it explicitly. Follow the local explicit
setting in Angular fixtures/components. The component's documented `error` and
`change` outputs retain their contracts with narrow `no-output-native` lint exceptions;
these are not DOM events. Angular signal queries require TypeScript-private rather than `#private`
fields on the installed compiler.

The reviewed `@nx/angular:component` generator was dry-run before #535. Its unrelated
workspace defaults were removed, the public barrel uses a named export, and a
meaningful lifecycle suite replaces the generator's skipped placeholder test.

## Imperative controls and read-only evidence

For #537 the ADR inventory was re-enumerated; all five previously reviewed records
and relevant guides are unchanged. The same accepted architecture, lifecycle,
reactivity and documentation decisions apply. Angular's best-practices tool still
failed, so official component-query guidance and the reviewed local guides apply.

The component constructs one coordinator and exposes its frozen, bound `api` from
construction onward. Core guards readiness/disposal before invoking the lazy driver
closures; Angular alone retains the raw instance. Inputs, automatic saves and all
controls use the same FIFO queue. Replacements invalidate obsolete automatic work;
explicit save results belong to their callers and are not discarded on later edits.
Core tracks active/queued promise cancellations, rejects immediately on disposal,
and observes later driver settlement without emitting after destruction. The error
class is core-owned and re-exported by Angular; imperative rejection and the live
error output share the same object. Callers remain responsible for catching promises.

The operation set was verified against the installed 2.31.7 implementation/types
and upstream [API](https://editorjs.io/api/), [blocks](https://editorjs.io/blocks/)
and [configuration](https://editorjs.io/configuration/) references. Actual runtime
integration exposed that the public `save` API rejects while read-only, although
upstream's mode transition uses its internal saver. We retain the public API:
core captures before entering read-only, defers replacement baselines while there,
and captures again on return to editing. The optional raw `readOnly.isEnabled`
value seeds readiness and supplies actual mode during recovery; custom loaders
without it fall back to initial config and successful toggle results. Drivers that
can partially change mode before rejection should expose that value.

Core tests exercise all control failures, queue ordering, stale saves, retained
facades, immediate disposal rejection and read-only recovery without Angular.
Component tests verify binding, ownership and error identity. The real Editor.js
jsdom test covers save, mode toggles and clear; actual browser focus and broader
integration run in `editorjs-angular-e2e` against the extracted host. No
forms interfaces or SSR/hydration expansion is included here.

## Generator and TypeScript configuration

The installed `@nx/angular:library` generator was inspected and dry-run before
generation. Nx 23.2.1 rejects this repository's TypeScript solution setup by
default; its documented `NX_IGNORE_UNSUPPORTED_TS_SETUP=true` override was used
only for generation, with `--skipTsConfig` so it introduced no source path aliases.

Angular compilation uses `composite: false`, no project references, and no source
custom resolution conditions. The Angular package and private browser projects are excluded from inferred
`@nx/js/typescript` targets; it has explicit `ngc`/test-typechecking tasks instead.
Its library tsconfig tells Nx sync not to add a core project reference. Nx build
dependencies still build core first; Angular resolves the built core declarations.
The repository's other projects retain their TypeScript solution configuration.

The package source export condition is for workspace tooling only. Consumers use
the generated APF `types` and `default` entry points. Do not enable the source
condition when testing or installing a packed artifact.

## Dependencies and linting

Angular core/common remain peers. Editor.js is a `^2.31.7` peer with exactly
`2.31.7` as the development reference; it is never imported eagerly. The core
dependency is added through Yarn and uses a semver range that links the local
workspace package while remaining valid in the generated publish manifest.
`ng-packagr` is allowed to retain that specific non-peer dependency and supplies
its standard `tslib` dependency.

The generator adds ng-packagr, Angular ESLint and stylesheet build prerequisites
as workspace development tooling. The ESLint utility is aligned with the existing
8.68.0 TypeScript ESLint toolchain; its older transitive copy is deduplicated to
avoid an incompatible TypeScript peer requirement. Runtime dependencies are checked
without scaffold exemptions. Test-only imports
and Vitest configuration are excluded from runtime dependency checks.

## Validation

From the repository root:

```sh
yarn nx run-many -p editorjs-angular editorjs-core -t build typecheck test lint
yarn nx format:check --projects=editorjs-angular
```

- `build` uses `@nx/angular:package` / ng-packagr in partial compilation mode and
  produces `dist/packages/editorjs/angular` with FESM2022 and bundled declarations.
- `typecheck` runs Angular compilation with no emit plus strict test typechecking.
- `test` depends on build, packs the generated Angular artifact and core package,
  then unpacks them into an isolated temporary consumer without source aliases.
- The packed import runs in Node with Angular peers installed and Editor.js absent.
  Angular peers initialize before browser-global guards (Angular itself probes
  optional globals); the wrapper must introduce no further access. This checks
  module evaluation, not a complete SSR rendering contract.
- A separate consumer links the installed Angular 22.1.4 peers and compiler
  prerequisites, compiles a standalone host with strict templates against the
  packed wrapper/core, and verifies Angular compilation output. Editor.js declarations
  are supplied by the pinned peer; custom configuration, shared controls/events and
  forbidden ownership fields are type-checked. Core separately compiles its full
  public API in an ES2022-only consumer without Angular, Editor.js or DOM types.
- Loader tests exercise actual Angular DI/platform selection, override scope,
  deferred loading/construction, independent factories, protected options, core
  normalization and error propagation. They use a fake Editor.js module; real
  browser behavior is checked separately by Playwright.
- Artifact tests check public paths, portable dependencies, current README and
  Apache-2.0 license, and exclusion of source/test files. Keep the package LICENSE
  synchronized with the repository license.

The main Node 24 CI `run-many` discovers these targets. The core's separate Node
22.12 job remains core-only: the Angular toolchain requires a newer Node baseline.
The checks establish the installed baseline, not an Angular-minor/browser matrix.
The component suite loads built ngc output via Node's ESM interop because plain
Vite TypeScript transformation does not compile Angular signal input/query metadata.
The atomized component-test target depends on build. The packed server-render smoke
runs without Editor.js installed and rejects any loader invocation. Full hydration remains #69. Browser coverage and deterministic races remain
separate layers of evidence.

## Browser host and E2E projects

`editorjs-angular-host` (`apps/editorjs/angular-host`) is a private standalone,
OnPush, zoneless Angular application. It imports only public package entry points.
Yarn links its Angular dependency to `dist/packages/editorjs/angular`; core resolves
its built `dist` export. No TypeScript source condition or path alias bypasses those
artifacts. The application builder compiles the consumer and links the partial APF.
The host's explicit `editorjs-angular` dependency makes the artifact relationship
visible to Nx. It also imports core's public document type.

`editorjs-angular-e2e` (`apps/editorjs/angular-e2e`) owns Playwright, Chromium tests
and reports. Its implicit host dependency gives the graph:

```text
editorjs-angular-e2e -> editorjs-angular-host -> editorjs-angular -> editorjs-core
```

The host also has a direct core dependency. Both new package manifests are private,
and neither appears in the explicit Nx release selection. Browser files and tooling
are outside both publishable packages. The former library-owned `browser-smoke`
target and `tests/fixtures/browser` application have been removed.

All five ADRs were reviewed for this extraction. Accepted A02/A03/A05/A06/A09/A10
and ADR 0004 apply: standalone composition, signal state, owner-specific cleanup,
application builder versus library packaging, public artifact testing and separate
contributor documentation. No public API or dependency ownership changed. Forms
and SSR/hydration remain separate work. The application/component and Playwright
generators were inspected and dry-run. The application generator used Nx's documented
TypeScript-setup override; generated project references were removed and sync ignores
the host's artifact dependencies. The rest of the workspace keeps its TS solution setup.

Nx's lint import locator misclassifies the linked APF entry as an application. A
host-only allow entry covers exactly `@anarchitects/editorjs-angular`; all other
module-boundary constraints remain active. The explicit dependency and public
imports preserve the intended boundary without source aliases.

### Commands and CI

```sh
# Install Chromium locally; CI additionally supplies --with-deps on Linux.
yarn nx run editorjs-angular-e2e:install-browsers
# Production package builds, host build, managed server and browser tests.
yarn nx run editorjs-angular-e2e:e2e
# Interactive host: standalone at /, Forms at /?forms (port 4317).
yarn nx run editorjs-angular-host:serve
# All four projects' relevant checks; no empty host unit-test target.
yarn nx run-many -p editorjs-core editorjs-angular editorjs-angular-host editorjs-angular-e2e -t build typecheck test lint e2e
```

Playwright starts the production `serve-static` target, waits for HTTP readiness,
creates isolated browser contexts and terminates the server after the run. It refuses
to reuse a server already on port 4317, preventing accidental tests against stale
content. The static host needs no SPA fallback. Stop an interactive host before
running E2E. HTML reports, failed-test screenshots and traces are written under
`apps/editorjs/angular-e2e/test-output` (ignored by Git and ESLint).

The dedicated CI job installs Chromium with OS dependencies, invokes `e2e`
explicitly and uploads that output directory even on failure. The existing main job
continues to discover host build/typecheck/lint and E2E typecheck/lint. Browser tests
use the Nx Playwright inferred target without per-file atomization; one server
belongs to each complete invocation. CI retries once, retaining failure traces.

### Behavioral evidence and limits

The five Chromium scenarios cover initial data, real DOM editing/change/save,
keyboard focus, render/input replacement, clear, read-only transitions, accessible
host groups and error alerts, independent simultaneous editors, and unmount/remount.
Three complete two-editor cycles verify that every created raw instance is destroyed,
no editor DOM remains, and detached-node input/keyboard events plus pending mutation
batches produce no late wrapper outputs. Instrumentation delegates to the default
lazy loader and stores counters only, never an instance registry.

The wrapper adds no document/window event listeners. Editor.js owns its DOM listeners;
the host checks observable disposal and output silence, not heap collection or universal
absence of third-party leaks. A named editor group, keyboard-operable host controls,
focus forwarding and an error alert are host guarantees tested here. Paragraph/tool
internals retain upstream accessibility responsibilities; this is not a full screen
reader or WCAG audit. Chromium on the installed baseline is not a browser/Angular
compatibility matrix.

Deterministic tests remain with their owners: core checks pending writes settling
successfully or rejecting after disposal without starting baseline saves or queued
controls; Angular checks late import rejection, readiness rejection, pending operations,
output suppression and fresh-owner recovery. Existing packed/compiler/server contracts
and the jsdom real-runtime check remain in the library. No generic queue is implemented
in the host or E2E project.

### Cache and affected boundaries

Host builds use `production` and `^production`; E2E hashes its own inputs and transitive
production dependencies, CI mode and platform/architecture. Reports are declared cache
outputs. Nx builds core, Angular and the host before E2E. Host-only or E2E-only changes
therefore do not feed into a library build's inputs. Library changes propagate to the
host and browser tests. Changing the shared CI workflow intentionally affects all
projects once, as configured by the workspace.

Validated locally with Node 24.21.0, Angular 22.1.4, Nx 23.2.1, Editor.js 2.31.7
and Playwright 1.64.0 / Chromium on macOS arm64. All 14 relevant Nx tasks passed,
including five browser scenarios and the library/packed-consumer suites. A warm
E2E invocation and temporary comment-only changes demonstrated these cache results
(the probe edits were restored):

| Input change                 | Core build | Angular build | Host build | E2E |
| ---------------------------- | ---------- | ------------- | ---------- | --- |
| None, warm run               | Hit        | Hit           | Hit        | Hit |
| Host stylesheet only         | Hit        | Hit           | Run        | Run |
| Core coordinator source only | Run        | Run           | Run        | Run |
| Restored original inputs     | Hit        | Hit           | Hit        | Hit |

Affected-project queries returned host + E2E for a host file, only E2E for an E2E
file, and all four for a core file. Both private projects resolve without a publish
target. These are local checks; hosted CI was not monitored.

Reproduce the affected boundary with:

```sh
yarn nx show projects --affected --files=apps/editorjs/angular-host/src/app/app.ts
yarn nx show projects --affected --files=apps/editorjs/angular-e2e/src/editor.spec.ts
yarn nx show projects --affected --files=packages/editorjs/core/src/lib/editor-document-coordinator.ts
yarn nx graph --print
yarn nx show project editorjs-angular-host --json
yarn nx show project editorjs-angular-e2e --json
```

## Packed consumers and release review

The [release-readiness guide](editorjs-angular-release-readiness.md) records the
public API review, executable compatibility matrix, tarball-consumer commands,
CI gates, semver guidance and downstream boundaries. `editorjs-angular-e2e:e2e-packed`
installs both archives and fresh peers outside the workspace, compiles every README
example and runs the same browser suite against the consumer build. The package test
also compiles the published examples locally. This extends the workspace-linked host
coverage without moving library contract fixtures into a separate project.

## Signal Forms value binding

The [Signal Forms implementation contract](editorjs-angular-forms-design.md) defines
the opt-in entry point, state ownership, reset/availability races and validation
plan for epic #68. #549 adds the APF `/forms` entry point with `EditorJsControl`
and `EditorJsControlConfig`. It composes the root component; normalization and
operation ordering remain core-owned. The standalone package remains usable without
Angular Forms, enforced by packed import and declaration checks.

The accepted ADR inventory is unchanged from #548. A02/A05/A06/A07/A10 and ADR 0004
govern this slice; no conflict was found. The Angular MCP endpoint still returned
`Unexpected response type`, so implementation uses the inspected Angular 22 APIs.
Nx generators created the secondary entry point/component. Their source alias and
global component defaults were removed; resolution uses the linked APF package.
The typecheck target depends on the package build because secondary-entry-point
self-imports resolve the root APF declarations; this also prevents concurrent build
cleanup from removing declarations during typechecking.
Forms is a bounded optional peer, with 22.1.4 installed for development through Yarn.

Angular Signal Forms 22 decorates array items with symbol-keyed identity metadata.
Core now provides an explicit, framework-neutral `symbolKeys: 'omit'` normalization
option; defaults and provenance parsing remain strict. The adapter opts in for
inbound projection, and publishes a separate core-normalized model copy so Forms
cannot decorate the public saved event. JSON copying and validation remain in core.
This extends the core-first boundary without changing the accepted ADR decisions.

Inbound values are normalized by core before projecting them to the child. Angular
input lifecycle notifications distinguish external writes from the model's outgoing
updates; an echoed published reference is suppressed. This prevents a save/render
feedback loop without duplicating core fingerprinting. Invalid input retains the
last valid projection and blocks outgoing updates until corrected; an invalid initial
value does not create an editor. Child initialization failures retain the wrapper's
recreation requirement.

`tests/forms.spec.ts` exercises native FormField value binding with the built APF
component, controlled editor drivers and zoneless Angular. Packed checks compile the
root without Forms, then link the matching Forms peer and compile the secondary
entry point plus every README example. The isolated matrix now installs matching
Forms peers for declaration/example compilation; its browser scenarios still cover
the standalone host. This is the #549 value-binding baseline; #550 interaction work
is described below. Reset/validation hardening, legacy interoperability, Forms browser
coverage and final release certification remain #551–#554.

Validation on 2026-10-11: core and Angular build/typecheck/lint checks passed, with
148 core and 50 Angular tests (including 16 value-binding cases). E2E-project lint
and typecheck passed. The packed matrix passed on Angular/Forms 22.0.0, 22.1.4 and
22.2.2 with their recorded Node versions, including declaration/example compilation
and 15 standalone browser checks. Existing lint warnings remain; no Forms browser
certification is implied by these results.

## Signal Forms interaction and availability (#550)

The five-ADR inventory remains unchanged. A02/A05/A06/A07/A09/A10 and ADR 0004
apply: native form-tree state, Angular-only DOM adaptation, ordered core operations,
public entry-point composition and documented/tested consumer behavior. No accepted
ADR conflict was found. The Angular MCP best-practices endpoint again returned
`Unexpected response type`; the installed Angular 22.1.4 public declarations and
the accepted engineering guides provide the implementation contract.

The adapter captures initial availability in one child configuration, then uses
`api.setReadOnly` for subsequent requests. An inert editor region and capture-phase
event gating prevent interaction during loading, disablement, mode transitions and
failed transitions. Core continues to own the command queue and pre-transition
snapshot capture. Native Forms owns dirty/touched; the adapter only emits composite
focus-exit touch. FocusOptions are accepted but not forwarded to Editor.js. Full
same-value reset invalidation and snapshot/validation hardening remain #551.
The [WAI-ARIA 1.2 group contract](https://www.w3.org/TR/wai-aria-1.2/#group) was
checked for host attributes: `aria-disabled`/`aria-busy` are supported;
`aria-invalid` is deprecated on group, and `aria-required`/`aria-readonly` are not
supported. Those field flags use data attributes, visible labels/errors and
consumer-owned `aria-describedby` associations instead.

Validation on 2026-10-11: Angular build/typecheck/lint and 74 tests passed, including
40 Forms cases. Tests cover composite focus exit, artificial blur, disabled input
capture, readonly focus, pending edits, rapid/failing transitions, explicit-value
reset while unavailable, error counts, disposal and independent owners. Angular
retains and temporarily suppresses computed dirty/touched for non-interactive fields;
pre-transition changes remain published. The packed public API/examples compiled
across Angular/Forms 22.0.0, 22.1.4 and 22.2.2, with all 15 standalone browser checks
passing. Forms browser interaction certification remains #553–#554. Existing lint
warnings remain; no dependencies or release versions changed.

## Reset, validation and async failures (#551)

Re-enumerated and reviewed all five accepted ADRs and relevant architecture,
reactivity, Forms, SSR/builds and testing guides. Governance ADRs retain their own
scope. Modern Angular A02/A05/A06/A07/A09/A10 and ADR 0004 apply; no conflict was
found. Angular MCP best-practices again returned `Unexpected response type`.
Installed Angular 22.1.4 declarations/runtime and the official
[FormUiControl](https://angular.dev/api/forms/signals/FormUiControl),
[submit](https://angular.dev/api/forms/signals/submit) and
[async operations](https://angular.dev/guide/forms/signals/async-operations)
references informed the implementation.

Core owns synchronous invalidation, generation checks and the shared queue.
Writes retain their acceptance generation. Explicit snapshots now reject with
`superseded` after newer authoritative work; a failed render/clear keeps publication
suspended until explicit reconciliation. The Angular wrapper exposes a two-phase
invalidation/reconciliation seam, and Forms supplies the native reset hook and
snapshot method. A lazy, optional lookup of the public `FORM_FIELD` token checks
native field state before publishing or saving, closing the interval between a model
write and Angular input delivery. It preserves native debounce and introduces no
fake NgControl or parallel field state. No dependency, peer range or release version
changes.

Native form-tree tests cover unchanged/different/implicit reset during save,
queued render/reset/write, pre-ready reset, teardown, remount, typed error counts,
required/custom/async validation and immediate-edit submission. Submission tests
verify captured-payload validation, duplicate prevention and retained values after
server failure. Full Forms browser certification remains #553–#554, legacy binding
#552, and full SSR/hydration #69. Running upstream work is not forcibly cancelled.

Local validation on 2026-10-12: core/Angular builds, type checks and lint passed;
152 core tests and 98 Angular tests passed, including 62 native Forms cases.
Existing lint warnings remain. Coverage includes native deferred synchronization,
pre-input-delivery writes, completion-time snapshot guards and one reconciliation
per reset. The root package remains usable without Forms. Formatting and whitespace
diff checks passed. The final packed artifacts compiled public declarations and all
README examples on Angular/Forms 22.0.0, 22.1.4 and 22.2.2; all 15 existing
standalone Chromium checks passed. Native Forms browser scenarios remain #553;
this matrix run does not claim that coverage. CI was not monitored.

## Native legacy Forms interoperability (#552)

Re-enumerated all five ADRs and checked the applicable engineering guides before
implementation. ADR0004 and Modern Angular decisions A02/A05/A06/A07/A09/A10
apply; the governance ADRs retain their own scope. This is the accepted migration
seam for existing forms, not a change to the Signal Forms default. There are no
conflicts, dependency/peer changes, package-owned CVAs or new runtime providers.
Angular MCP best-practices retrieval failed with an unexpected response type;
official Angular migration/API docs and versioned installed public APIs supplied
the fallback evidence.

The new `forms-interop.spec.ts` suite exercises native `formControl`,
`formControlName`, `ngModel`, retained `FormControl` leaves in `compatForm`, and
`SignalFormControl.fieldTree`. It tests value/flag projection, disabled state,
validation and async pending/errors, non-null reset, reset/write races, and native
`updateOn` behavior. Tests consume built APF locally; the packed matrix copies the
same suite into each isolated consumer and runs it with that cell's Angular/Forms
and Node versions. These are TestBed/jsdom contracts with a controlled upstream
editor, separate from the Forms browser scenarios assigned to #553.

Supported reactive/compatibility bindings publish immediately for `updateOn: blur`
and `submit`. Retained legacy controls require an explicit `EditorJsControl.reset()`
hook to invalidate editor work during reset; direct legacy authoritative writes
need it before input delivery too. `SignalFormControl` dispatches the native hook.
`compatForm` does not observe `emitEvent: false` writes until the control emits.
Schema rules own `SignalFormControl` availability/validation; legacy imperative
`disable`, `setValidators` and `setErrors` throw. These are bounded native semantics,
not gaps to fill with a second state model inside the package.

Direct `ngModel` is characterized but excluded from the support claim: initialization
delivers a transient null and emits `invalid-data`, and simultaneous model assignment
and editor reset can leave its view/control value stale. The public README describes
these limitations, nullable-model adaptation and working migration alternatives.
Three copyable examples and direct-binding declaration fixtures compile from public
imports. No core or package implementation changes were needed.

Validation results are recorded in the [release-readiness increment](editorjs-angular-release-readiness.md#release-gates-and-evidence-limits).

## Dedicated Forms browser coverage (#553)

All five ADRs remain unchanged since the previous review. Accepted Modern Angular
A02/A03/A05/A06/A09/A10 and ADR0004 govern this increment: standalone composition,
public artifacts, native form ownership, zoneless state, cleanup and bounded
compatibility claims. The Angular MCP best-practices call again returned an
unexpected response type; the already reviewed official API guidance and installed
Angular 22.1.4 APIs supplied the fallback. The skill's Cypress/devtools example is
not this repository's runner; the established Nx/Playwright projects remain the
accepted testing seam. No architecture conflict or package runtime change.

The existing private `editorjs-angular-host` serves standalone editors at `/` and
Forms fixtures at `/?forms`. Nx generated the new standalone `FormsCard`; its
browser tests live in `editorjs-angular-e2e/src/forms.spec.ts`, not in the library.
Two independent Signal Forms controls and one native reactive control consume the
built public `/forms` entry point. They retain generic `OutputData`, and the host
owns content validation and simulated persistence. The reactive fixture follows
#552's explicit reset-hook policy.

`FormsWork` is per-card test instrumentation around the real lazy loader. It can
pause delivery of one snapshot after real Editor.js capture, expose that captured
document, release it after reset/disposal, or inject a save rejection. It also owns
abort-aware async validation and explicitly completed submission promises. Nothing
uses a fake editor, package internals, a global instance registry or application
models. The loader forwards the live read-only getter without reading it before
Editor.js readiness. Ownership counters still verify raw creation/destruction.

Eight Forms scenarios add actual keyboard editing, focus moves inside/outside the
composite control, event/model detachment, programmatic writes and flags,
disabled/readonly transitions, unchanged-value reset during a captured save,
repeated teardown with detached input/keyboard/focus events, independent controls,
async validation/pending and failed submission, observable operation errors, and
native reactive interoperability. Tests wait for observable state; the deliberate
750ms negative-observation window covers Editor.js's 400ms mutation batching.

The existing `e2e` target discovers both spec files and runs 13 scenarios. Its
existing dependency chain still builds core, Angular APF and the host in order;
`e2e-packed` runs the same 13 scenarios in each isolated consumer, in addition to
#552's 40 native interop cases per cell. Existing CI browser/packed-consumer jobs
already invoke these targets and collect reports, so no workflow or new project
is needed. Package contract tests remain in the library. Full SSR/hydration and
non-authoring-route bundle checks remain #69, with the final Forms release review
in #554. CI is not monitored automatically.

Validation results are recorded in the [release-readiness increment](editorjs-angular-release-readiness.md#release-gates-and-evidence-limits).

## Final Forms readiness review (#554)

The [release-readiness record](editorjs-angular-release-readiness.md) now reviews
both public entry points, the complete Forms surface and the implemented support
limits. It supersedes the earlier standalone-only readiness summary; the preceding
sections retain the implementation chronology.

Every packed matrix cell first installs both archives without Forms. It verifies
that the peer cannot resolve, compiles the standalone declaration fixture and
imports the root under browser-global guards. It then installs the exact matching
Forms peer, rechecks versions/paths, verifies secondary exports and private-subpath
blocking, and compiles the packed README/examples before native interop and browser
checks. Core's empty runtime dependency set and Angular's optional-peer/dependency
allowlists are asserted in both stages. The root-only and final locks, matched
Forms version and package-boundary results are retained with the existing reports.

ADR0004 review removed contributor test-fixture details from the public README,
clarified optional-peer installation, and kept native migration/reset limitations
consumer-facing. The release record documents the material `superseded` snapshot
semantics, explicit semver choice, exact-commit CI gates and #69/downstream limits.
No runtime change, version bump or publication is part of this review. Validation
results and the limits of local evidence are recorded in that release record.

## Release configuration

The project participates in independent Nx release configuration with
`editorjs-angular@<version>` tags. Source and generated package manifests are both
updated during versioning, and publishing targets the generated APF directory.
Dist manifests remove local dependency protocols. Core must be available at a
compatible version before an external consumer can install the wrapper.

Use `init` with the exact affected Nx project scopes for this package work. The
manual release workflow uses `--skip-publish`; merging does not publish a package.
Apply the consolidated release review's exact-commit checks, bounded support and
semver assessment before release. The prefix is not a version classification.
