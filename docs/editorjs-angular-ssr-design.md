# Editor.js Angular SSR and hydration contract

This contributor contract implements #562, the design slice of epic #69, against
the completed #66–#68 packages. It defines the implementation and evidence required
in #563–#568; it does **not** certify SSR/hydration support. The
[package README](../packages/editorjs/angular/README.md) remains the authority for
current consumer support. No runtime code, exports, peers, versions or public
README claims change in this slice.

The subsequent [fixture record](editorjs-angular-ssr-fixture.md) covers #563–#567
server/browser/matrix evidence. The [release review](editorjs-angular-release-readiness.md)
consolidates #568's public support and packed README checks. The design-stage
limitations and future-tense delivery requirements below are retained as history;
current support is the bounded contract in the package README.

## Decisions and existing evidence

All five repository ADRs were enumerated and reviewed on 2026-10-12:

| Record                                                                                                                                                                                         | Application to this work                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [0001](adr/0001-governance-package-boundaries.md), [0002](adr/0002-governance-core-multi-technology-canonical-model.md), [0003](adr/0003-governance-core-adapter-extension-host-boundaries.md) | Accepted Governance decisions retain their Governance scope; no changes to their packages or models.                                                                                 |
| [0004](adr/0004-public-package-documentation.md)                                                                                                                                               | Accepted. Planning, fixture instructions and certification evidence stay in contributor docs. Public support changes require accurate packed consumer documentation.                 |
| [Modern Angular](adr/modern-angular-22-signal-forms.md)                                                                                                                                        | Accepted A01–A12 apply to compatibility, package/provider ownership, routed delivery, native form state, asynchronous lifetime, rendering, artifact evidence and release discipline. |

The [repository application](guides/modern-angular/repository-application.md),
architecture, provider/routing, reactivity, Forms, rendering/defer, SSR/builds,
testing/migration and API-ledger guides inform this contract. No ADR conflict or
exception is proposed. No experimental API, broad `ngSkipHydration` workaround,
framework dependency in core or duplicate Forms facade is authorized.

The [existing release review](editorjs-angular-release-readiness.md) establishes
guarded package imports, an empty-holder server smoke render, CSR browser behavior,
optional Forms installation and packed compatibility. It does not establish real
HTTP SSR, hydration, request isolation or non-authoring bundle isolation. In the
current implementation `EditorJs` owns a core coordinator and starts its lazy loader
from `afterNextRender`; `EditorJsControl` wraps that component and native field state.
These remain the starting points, not a second SSR editor implementation.

## Versioned API evidence

The existing [matrix](../apps/editorjs/angular-e2e/tools/compatibility-matrix.json)
remains pinned. No support expansion or dependency upgrade follows from this review.

| Angular packages | Consumer Node | TypeScript | Editor.js | Hydration default verified in artifact          |
| ---------------- | ------------- | ---------- | --------- | ----------------------------------------------- |
| 22.0.0           | 22.22.3       | 6.0.3      | 2.31.7    | Incremental hydration and event replay enabled. |
| 22.1.4           | 24.15.0       | 6.0.3      | 2.31.7    | Incremental hydration and event replay enabled. |
| 22.2.2           | 26.0.0        | 6.0.3      | 2.31.7    | Incremental hydration and event replay enabled. |

On 2026-10-12, exact published `@angular/core`, `@angular/platform-browser`,
`@angular/compiler` and `@angular/ssr` archives were inspected for each row, outside
the workspace. The declarations and ESM implementations establish:

- `provideClientHydration()` installs incremental hydration unless
  `withNoIncrementalHydration()` is supplied. The incremental provider installs
  event replay. Full hydration with replay can be selected explicitly using
  `withNoIncrementalHydration()` together with `withEventReplay()`.
- `afterNextRender` and `afterRenderEffect` are browser rendering hooks. Their
  declaration guidance does not guarantee components have hydrated before DOM
  access; using a hook is insufficient evidence of safe editor initialization.
- `@angular/ssr` exposes `RenderMode.Server`, `RenderMode.Prerender`,
  `RenderMode.Client`, `provideServerRendering` and `withRoutes`, plus the public
  `@angular/ssr/node` entry point. These are consumer infrastructure, not library
  runtime dependencies.
- Each version's compiler successfully parsed ordinary `on interaction` deferral
  and combined `on interaction; hydrate on interaction` syntax, including the
  ordinary placeholder/loading/error blocks. Parsing establishes syntax only,
  not component type checking, lazy emission, SSR or browser behavior.

Reproduce the artifact inspection with `npm pack --ignore-scripts --json` for
each exact package/version in an owned temporary directory. Read the public
`types/*.d.ts`, `platform-browser/fesm2022/platform-browser.mjs` and
`core/fesm2022/core.mjs`; follow public exports rather than importing private
symbols into the application. Inspect `compiler/fesm2022/compiler.mjs` with its
public `parseTemplate` API for the two trigger forms above. Useful immutable
artifact identifiers for the platform-browser default-provider check are:

| Version | npm tarball SHA-1 (`shasum`)               |
| ------- | ------------------------------------------ |
| 22.0.0  | `d809c0013f82818701698e7c1407bacf9d64ce02` |
| 22.1.4  | `0c2942f8ca21ad0c0b69212d21cf131ea114dce7` |
| 22.2.2  | `247f382fa5db4e201ea681f261dc1247cc924759` |

Official references checked alongside the artifacts:
[hydration providers](https://angular.dev/api/platform-browser/provideClientHydration),
[incremental hydration](https://angular.dev/guide/incremental-hydration),
[render hooks](https://angular.dev/api/core/afterNextRender),
[SSR/rendering modes](https://angular.dev/guide/ssr), and the repository's
[API ledger](guides/modern-angular/api-ledger.md). Living documentation is contextual
evidence; the exact artifacts govern availability in each cell. The Angular MCP
documentation search succeeded; its best-practices tool returned `Unexpected
response type`, so the accepted guides and official documentation supplied that
guidance.

## Ownership and initial DOM

| Owner                    | Responsibility                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editorjs-core`          | Detached document normalization, operation ordering, invalidation, current-snapshot semantics and disposal through a neutral driver. No DOM, Angular, SSR request or Forms dependency. |
| `editorjs-angular` root  | Browser/platform adaptation, lazy loader, live holder, one instance and coordinator per component, Angular lifecycle and outputs.                                                      |
| `editorjs-angular/forms` | Native field binding, interaction/availability projection and reset/snapshot hooks through the root component. Angular owns form flags, validation and submission.                     |
| Consumer host            | Rendering routes, hydration providers, initial data, safe serialization, labels/placeholders, pre-hydration HTML policy, persistence and request lifetime.                             |

The host supplies the same normalized initial document and deterministic initial
form/schema state to server and client. Use request-owned Angular `TransferState`
for the fixture's safe synthetic data, with a stable key scoped to the document
slot, consume it once on the client, and retain independent copies per owner.
Serialize through Angular's supported mechanism; do not concatenate document text
into inline scripts or HTML. Include escaping-sensitive text in the tests. Tool
constructors/configuration are code supplied by the host, not serialized data.

Never keep request documents, field trees, credentials, mutable editor configuration
or instances in module/static variables or a shared process injector. Static immutable
tool definitions and cached module code are distinct from mutable instance state.
Use distinguishable safe request markers, not real user information, to inspect
HTML/transfer state across sequential and overlapping requests. Do not transfer
promises, validation requests or sensitive headers. The fixture needs no HTTP transfer
cache: disable it explicitly with `withNoHttpTransferCache()` in both hydration
profiles; production hosts separately own their cache/privacy policy.

Server output contains Angular's component structure and empty editor holder. A
valid Forms model produces its wrapper and child holder with deterministic native
attributes and an unavailable editing region until ready. Neither entry point
server-renders saved blocks, Editor.js tool DOM, contenteditable elements or a toolbar.
The editor is not a document renderer. Host-owned explanatory text, labels and a
reserved-size placeholder sit outside the editor-owned holder, with stable IDs;
there is no fake textbox before editing exists.

Server and initial client markup must match, including form state, IDs, conditional
children and whitespace relevant to hydration. Avoid random/time-derived IDs and
browser-only initial template branches. The host may update a loading status after
activation, but editor mutations may only affect its owned holder after that
component's DOM has been claimed safely. The implementation must prove this for each
configured boundary through DOM identity and diagnostics; neither `afterNextRender`
nor application stability alone is a universal hydration-completion signal.

If the existing initialization path fails this proof, #564/#565 must fix the narrow
adapter/lifecycle boundary with supported APIs and regression evidence. Do not
introduce private Angular hydration flags, arbitrary timeouts or `ngSkipHydration`
to hide failures. An unavoidable exception needs an explicit reviewed decision,
affected support limits and removal criteria before it can become a public claim.

## Bounded rendering and activation profiles

Both profiles are host-owned shared server/client configuration. **Default** uses
`provideClientHydration(withNoHttpTransferCache())`. **Full with replay** adds
`withNoIncrementalHydration()` and `withEventReplay()` to that call. Never combine
an incremental opt-in with its opt-out, and do not add hydration providers inside
either library entry point.

The required cases below apply to standalone and Signal Forms unless stated
otherwise. They run against the three pinned cells in #567, not merely the workspace
version. This is the intended certification set; it is not yet a supported-mode claim.

| Case                        | Rendering/activation                                                                     | Expected initial output and proof                                                                                                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public route                | Request SSR and one fixed public prerender route; Default profile                        | No editor import in the eager browser dependency closure, no Editor.js fetch/evaluation while idle, compatible ordinary host HTML.                                                                                                                        |
| Immediate authoring         | Request SSR; both profiles                                                               | Empty holder is reused during hydration; one real editor starts, latest initial document becomes editable, no mismatch/fallback or synthetic saved edit.                                                                                                  |
| Fixed authoring sample      | Prerender; Default profile                                                               | Public synthetic document only, no request/user state baked into artifacts; standalone and Forms holders hydrate and editing works.                                                                                                                       |
| Ordinary deferred authoring | Request SSR; Default profile; explicit `on interaction(activate)` and no hydrate trigger | Lightweight placeholder renders on server. An external `type="button"` activation control precedes later component creation; placeholder/loading/error and destruction are observable.                                                                    |
| Incremental authoring       | Request SSR; Default profile; `on interaction; hydrate on interaction`                   | Server emits the deferred host's main Angular structure, including the empty holder, not tool DOM. A focusable host-owned activation button inside the block triggers hydration; client navigation uses the ordinary interaction trigger and placeholder. |
| Existing client-only host   | Existing CSR build/entry                                                                 | Existing standalone/Forms behavior remains green; no hydration proof is inferred from this suite.                                                                                                                                                         |

Only one non-nested incremental boundary and interaction activation are required.
Nested hydration, every viewport/idle/timer combination, `hydrate never` for editable
UI, arbitrary custom route reuse, streaming/edge runtimes, multiple apps per document
and other browsers are outside this certification set. A timeout may bound a test;
it must not define when the product is considered hydrated. Basic client navigation
from public to authoring and back is required for both deferred cases.

## Pre-hydration interaction and submission

There is nothing to type into inside an empty holder. Events on editor/tool DOM
created later cannot be captured before it exists. Replay assertions concern
server-rendered host controls whose Angular listeners participate in replay, not
invented keystrokes in a future editor.

For the Forms fixture, native inputs and submission controls are in a disabled
fieldset until the host is active and the editor is ready. This host HTML gate must
not rewrite schema-owned disabled state or mark the native form dirty/touched.
The custom editor region
also retains its own unavailable/inert behavior; a disabled fieldset alone does not
disable arbitrary contenteditable DOM. Activation buttons are `type="button"`,
outside disabled/inert regions, and do not submit or mutate the document. Retain a
safe POST method/action as defense in depth, pointing to a harmless fixture endpoint
that records unexpected fallback rather than persisting anything. Never depend on
event replay, an unattached Angular handler or `aria-disabled` to prevent native
submission.

Test physical click and Enter with bootstrap scripts held, with JavaScript disabled,
and while an incremental boundary is dehydrated. Before readiness there must be no
submission request, URL data leak, navigation or hidden document update. After
activation a replayed activation action may run once, but must not submit or duplicate
editor creation. Once ready, native Angular submission handles an explicitly captured
current snapshot with the existing validation/concurrency policy; no automatic save
is added. These are host example requirements, not an extra package Forms API.

## Lifetime and pending work

The stateless loader resolves code to a synchronous factory. Resolving its DI token
must not evaluate Editor.js, invoke the loader or create an instance on the server.
Each factory call belongs to one live browser component and holder. Cached code does
not authorize caching a holder, instance, form tree or coordinator in a provider.

| Transition                                                      | Required observable result                                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server render/request disposal                                  | Zero browser loader calls and editor instances; request data and form state stay isolated.                                                                    |
| Owner destroyed before deferred activation or loader resolution | No editor is created by the late continuation; no late ready/change/error output.                                                                             |
| Owner destroyed after creation but before readiness             | Invalidate/dispose core immediately; safely destroy the created instance when upstream readiness permits its public destroy API. A late rejection is handled. |
| Authoritative write/reset while loading or saving               | Latest bound document wins; reset invalidates immediately, including same-value reset. Superseded snapshots retain the established rejection contract.        |
| Readonly/disabled transition                                    | Native state continues to control interaction; queued work follows existing ordering and publication restrictions. Hydration adds no alternate queue.         |
| Route exit or conditional removal                               | Destroy component-owned resources/listeners and fence pending results; no detached events reach the form or outputs.                                          |
| Remount or second simultaneous owner                            | Fresh independent instance/state; old continuations cannot affect it and disposing one does not disable the other.                                            |

Already-running upstream work is not forcibly cancellable. Do not promise immediate
physical cleanup of an upstream instance that never settles readiness; prove fencing
and cleanup on settlement, and record the bounded limitation. Route injector lifetime
is not component lifetime. Default router destruction is covered; a custom strategy
that retains components must supply and validate its own ownership policy.

Preserve typed operational errors and supported recovery: a failed owner can be
destroyed/recreated; explicit reconciliation and Forms reset/snapshot behavior remain
as documented. No implicit automatic retry or new recovery method is introduced.

## Non-authoring delivery boundary

The SSR fixture gets a lightweight routed shell with lazy standalone and Forms
authoring imports. It uses no automatic router preloading, editor prefetch,
service worker precache or eager authoring re-export. Lightweight placeholders
must not themselves import editor/tool code. This is a documented host composition
policy, not a claim that the library can prevent consumer preloading.

Proof has three parts:

1. Production build metadata identifies Editor.js-containing outputs and the eager
   dependency closure of public browser entry points. That closure excludes the
   runtime; a dynamic chunk may exist on disk without being delivered. Separately
   inspect server imports/evaluation without pretending server code must never
   reference the lazy package.
2. A fresh browser context loading the public route fetches/evaluates no editor
   runtime, including idle preloads. Capture network, preload/prefetch and runtime
   evidence; map hashed assets through build metadata. Console silence alone cannot
   establish lack of evaluation.
3. Navigating to each authoring route and activating it loads and runs real Editor.js.
   Returning to public tears down owners, while already-downloaded modules may stay
   cached. A deliberately eager-import negative control demonstrates the isolation
   assertion would detect a regression; do not commit that control into production.

No arbitrary byte budget, filename substring or source grep substitutes for this
proof. Custom tool registry composition remains downstream; the fixture uses the
existing real editor/tool arrangement and does not certify every third-party tool.

## Private Nx fixture arrangement

Keep the existing `editorjs-angular-host` and `editorjs-angular-e2e` projects. Resolved
Nx configuration at base `a165681` uses `@angular/build:application` for the host and
separate Playwright orchestration in e2e. No new project is justified: the same two
public editor surfaces, package dependencies and lifecycle tests are involved.

Add a separate routed SSR browser/server entry and build configuration within the
host, with its own output directory, while retaining the existing CSR entry and
targets. This avoids claiming lazy delivery for the current host that eagerly
composes both editor surfaces. Use supported Angular SSR generator/build conventions
in #563, inspect generated ESM output, and preserve ng-packagr for the library.
Match added SSR platform/build peers deliberately; the current workspace core is
22.1.4 while installed build/SSR tooling is 22.1.6, which is not proof of a matched
packed cell. No dependencies change in #562.

Add focused server/hydration and packed-SSR targets to the existing e2e project in
#563/#567; their exact executable configuration belongs to those implementation PRs.
Declare host/library build dependencies, version/config inputs, distinct report and
build outputs, managed server readiness and teardown. Reserve ports independently
from current CSR tests (4317) and packed CSR tests (4318), or use allocated ports
reported by the owned server. Never reuse an unrelated developer server as evidence.
Fresh network installs remain uncached; any cacheable local target must include its
browser/runtime/environment inputs. Failures retain server logs, HTTP/HTML evidence,
build metadata, actual versions/locks and browser traces, while processes and temporary
consumers are cleaned up.

Library unit/contract regression tests stay with their owning library. Integration
fixtures stay private and consume public built/packed entry points. #543 can revisit
workspace-wide fixture policy later; it is not a blocker or an invitation to extract
another project here without a concrete boundary need.

## Acceptance and evidence matrix

| Delivery             | Evidence required before that slice is complete                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #562 — this contract | ADR/guide review, exact-version provider/declaration inspection, two trigger syntax checks per cell, resolved Nx inventory, reviewed ownership/mode/lifetime decisions. No runtime certification.                  |
| #563 — server host   | Real production HTTP SSR and fixed prerender HTML, zero loader/instance activity, sequential/concurrent request markers, escaped transfer data and server teardown.                                                |
| #564 — standalone    | Hydration without diagnostics or CSR fallback; retained host/holder node identities captured before bootstrap; real editing/controls; gated loading/readiness/save races; independent owners and repeated remount. |
| #565 — Forms         | Matching initial model/schema/DOM, no phantom dirty/touch/change, safe pre-hydration click/Enter, activation replay, current snapshots/reset invalidation and native validation/availability after activation.     |
| #566 — delivery      | Production dependency graph plus cold network/evaluation and preload evidence; both authoring positive controls; an effective eager-import negative control; route cleanup.                                        |
| #567 — packed/CI     | Every agreed mode on every pinned cell outside aliases; matched SSR/Forms peers; root without Forms; public declarations/exports; guarded imports; reproducible Nx/CI jobs and retained failure artifacts.         |
| #568 — readiness     | Consumer examples compiled/exercised from packed README, bounded support and remaining limitations, semver assessment, exact-release-commit CI requirements and updated release record.                            |

Hydration diagnostics, unhandled errors/rejections and unexpected native navigation
fail their suite. Tests must distinguish expected injected operational failures from
framework errors rather than broadly ignoring console output. Preserve previous core,
Angular, native Forms and CSR checks. A production SSR browser run proves the real
deployment path; use a diagnostic-enabled run as needed where production suppresses
helpful hydration warnings. Node identity assertions prevent a silent CSR fallback
from being counted as successful hydration.

The current design validation consists of source/artifact inspection and six parser
checks, not an application build or browser test. No executable repository code was
generated, so no application test rerun is required for this documentation slice.
SSR support remains unestablished until the later evidence exists. CI is configured
in its assigned slice but is not monitored automatically. One focused `init` PR with
exact Nx scopes is delivered per issue; each next issue waits for maintainer merge
and explicit go-ahead. No merge, version bump or publication is part of this work.
