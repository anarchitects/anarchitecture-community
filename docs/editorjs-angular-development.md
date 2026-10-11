# Editor.js Angular package development

Nx project: `editorjs-angular`. Package: `@anarchitects/editorjs-angular`.
Consumer-facing behavior is documented in the
[package README](../packages/editorjs/angular/README.md).

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
# Interactive host (builds library dependencies first): http://127.0.0.1:4317
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

## Release configuration

The project participates in independent Nx release configuration with
`editorjs-angular@<version>` tags. Source and generated package manifests are both
updated during versioning, and publishing targets the generated APF directory.
Dist manifests remove local dependency protocols. Core must be available at a
compatible version before an external consumer can install the wrapper.

Use `init:` for this new package scaffold. The existing manual release workflow
uses `--skip-publish`; creating or merging the scaffold does not publish it. Keep
the README's forms/hydration limitations until those implementations exist, and
complete #67's release-readiness checks before advertising a working editor.
