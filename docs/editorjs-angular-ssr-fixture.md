# Editor.js Angular SSR fixture

This private fixture implements server evidence (#563) and standalone hydration
and asynchronous lifetime evidence (#564), plus native Signal Forms hydration and
pre-hydration safety (#565) and non-authoring route isolation (#566), from the
[SSR contract](editorjs-angular-ssr-design.md). The packed SSR version matrix and CI
gates (#567) run these same checks against installed artifacts. Public package
support claims live in the README; the [consolidated release review](editorjs-angular-release-readiness.md)
records #568's final assessment and executable packed README examples.

## Architecture review

On 2026-10-12, all seven local ADRs and all fourteen Meta ADR records were enumerated
and read, including the historical landscape record and the proposed cooperative
enrichment, governance hierarchy, Archi and workspace-layering decisions. Meta was
reviewed at `e97790c4721099c3d75a5cb82a8afb0cbc122ed9`.

The accepted local and Meta Modern Angular A01–A12 rules require standalone public
entry points, native Signal Forms, explicit state ownership, supported SSR APIs,
matching initial markup and behavioral evidence. Local ADR 0004 keeps fixture and
validation instructions here rather than in the public README. Governance ADRs
0001–0003 retain their package-specific scope. Local ADRs 0005–0006 and Meta HTTP,
Native Node candidate, Nest-first and authentication migration decisions preserve
existing Nest compatibility: this fixture introduces no Nest integration or default
change. The other accepted Meta records preserve repository ownership and the two
core architecture styles. Proposals do not override accepted decisions. No conflict
or exception is required, including for the narrow Forms attribute fix below.

The Modern Angular guide's repository application, architecture, provider/routing,
reactivity, Forms, rendering, SSR/builds, testing and API ledger were reviewed.
The Angular MCP best-practices endpoint returned `Unexpected response type`;
accepted guides, [official SSR documentation](https://angular.dev/guide/ssr) and
installed public declarations supplied the implementation guidance.

## Composition and commands

Use the pinned Yarn workspace and install with `yarn install --immutable`.
From the repository root:

```sh
yarn nx run editorjs-angular-host:build-ssr
yarn nx run editorjs-angular-host:serve-ssr
yarn nx run editorjs-angular-e2e:test-ssr
yarn nx run editorjs-angular-e2e:e2e-hydration
yarn nx run editorjs-angular-e2e:e2e-isolation
yarn nx run editorjs-angular-e2e:e2e-packed-ssr
# Or one exact installed-consumer cell:
yarn nx run editorjs-angular-e2e:e2e-packed-ssr --cell=angular22-minimum
yarn nx run-many -p editorjs-angular-host,editorjs-angular-e2e -t typecheck,typecheck-ssr,lint
yarn nx run-many -p editorjs-core,editorjs-angular -t test
yarn nx run editorjs-angular-e2e:e2e
```

`serve-ssr` uses `http://127.0.0.1:4319` (or `PORT`) and terminates with SIGTERM.
The automated server suite allocates its own port, waits for its owned process's
readiness record and health response, and never reuses a developer server. It
asserts a clean process exit, server-close callback and closed listening socket.
A five-second shutdown deadline kills a stuck process and fails the assertion.

| Route                | Rendering   | Content                                 |
| -------------------- | ----------- | --------------------------------------- |
| `/`                  | Request SSR | Lightweight public page                 |
| `/standalone`        | Request SSR | Public root editor entry                |
| `/deferred`          | Request SSR | Interaction-triggered ordinary defer    |
| `/incremental`       | Request SSR | One incremental interaction boundary    |
| `/forms`             | Request SSR | Optional native Signal Forms entry      |
| `/forms-deferred`    | Request SSR | Ordinary interaction-deferred form      |
| `/forms-incremental` | Request SSR | Incrementally hydrated form boundary    |
| `/sample/public`     | Prerender   | Fixed public page                       |
| `/sample/standalone` | Prerender   | Fixed synthetic document                |
| `/sample/forms`      | Prerender   | Fixed synthetic document and form state |

Request authoring routes accept a bounded synthetic `marker`, `disabled=true` and
`readonly=true`. For example, `/forms?marker=review-a&disabled=true`.
Prerender samples ignore these query parameters. No authentication or persistence
is provided; `/fixture-submit` records unexpected native submission and returns
409 without storing data. This is a loopback test host, not a deployment template.

The Nx `setup-ssr` generator supplied the Angular application-builder/server
bootstrap conventions. Its generated configuration was separated into `build-ssr`
and `src/ssr`, preserving the existing CSR bootstrap, targets and output directory.
The generated Express example was adapted to the public Angular Node handler with
Node HTTP so the private fixture needs no additional web-framework dependency.
The public editor dependencies were already linked by Yarn; no new workspace link,
package, dependency upgrade or publishable harness was needed.

`build-ssr` explicitly depends on library builds and writes
`dist/apps/editorjs/angular-host-ssr`. Its cache inputs include source/dependency
production inputs, TypeScript configuration, the lockfile and Node version.
`serve-ssr` depends on that build and is continuous/uncached. `test-ssr` explicitly
depends on the SSR build and is uncached so process, socket and overlap evidence
is rerun on every invocation. Existing CSR and packed-CSR targets remain separate;
the packed-CSR consumer excludes the new SSR source roots from its compilation.

## Request ownership and evidence

The host installs `provideClientHydration(withNoHttpTransferCache())` and lazy
routes. Each authoring component provides its own request state and an observer of
the package's real loader. The observer delegates to the public parent loader;
it does not substitute an SSR mock. Every owner gets detached document data and,
for Forms, a new signal model and native field tree. Angular `TransferState`
serializes only the synthetic document, marker and initial disabled/readonly flags.
The browser consumes and removes that key. Credentials, cookies, diagnostics,
callbacks and pending tasks are never transferred.

Server HTML contains stable labels/status placeholders and empty editor holders.
Forms has a disabled fieldset until editor readiness, a safe POST action and an
inert custom editing region. The tests exposed that the adapter's DOM `inert`
property binding alone was not serialized by server rendering. An explicit inert
attribute binding now accompanies the property binding; it is removed on activation
or re-enablement. This restores the existing unavailable-region contract without
new public APIs, hydration providers or a second lifecycle coordinator.

The server suite asserts:

- Real production HTTP SSR for public, standalone and Forms routes; deterministic
  repeated responses; all three generated prerender documents and their HTTP output.
- Empty holders without tool DOM, contenteditable surfaces or toolbars; Forms
  availability attributes and untouched, pristine, non-pending/non-submitting state.
- Sequential A/B/A requests and two simultaneous Angular owners for each authoring
  route, with distinct documents and form flags and no marker/state contamination.
- Correct escaping of closing-script text, angle brackets, quotes, ampersands and a
  Unicode line separator through Angular transfer serialization. Synthetic secret
  sentinels in authorization/cookie headers never appear in HTML.
- Zero loader invocations/instances and destruction of each component-owned state
  and loader provider. Angular schedules platform destruction after rendering;
  assertions await actual `DestroyRef` callbacks rather than inferring disposal
  from response completion or forcing application destruction.
- A Node module-load guard rejects the actual Editor.js-containing server outputs
  identified by the builder's input/output graph. The real server succeeds with
  that guard; a deliberate import fails, proving the detection control works.
  No browser-global shims are installed in the server. JSDOM only parses captured
  HTML in the separate test process and never executes response scripts.

The bounded request delay is test instrumentation for overlapping live Angular
applications, not a browser initialization or hydration timing policy. Tests verify
that the second owner exists before the first response finishes. Server errors and
rejections remain visible and fail the suite; no diagnostic suppression is used.

Evidence is retained in `apps/editorjs/angular-e2e/test-output/ssr`: HTTP and
prerender HTML, server logs, import-guard negative control, build statistics,
actual versions and the workspace lockfile. Nx retains build failures in task
output; a failed dependency prevents the test from running. Generated artifacts
are ignored by Git.

## Standalone hydration and lifetime evidence (#564)

Before implementation on 2026-10-12, all seven local ADRs and all fifteen Meta
records were enumerated and read again, at Meta commit
`e2f34553c6e2492d0ab6f80ac795de44fc592a70`. This includes newly accepted Meta ADR 0012:
canonical public HTTP contracts belong to `anarchitecture-contracts`. This private
fixture changes no shared HTTP contract. Relevant Modern Angular architecture,
provider/routing, reactivity, rendering, SSR/build and testing guides were reviewed.
A03/A05 keep ownership and ordering explicit; A08/A09 require supported defer and
hydration APIs with matching DOM; A10 requires observable integration evidence.
No conflict, exception, dependency upgrade or public API change was needed.
The Angular MCP incremental-hydration documentation and installed Angular APIs
confirmed the two interaction-trigger forms and host-owned hydration profiles.

`e2e-hydration` builds three isolated application outputs, then runs Chromium
against three owned Node servers. It never reuses a developer server:

| Profile             | Build configuration | Port | Cases                                                                                |
| ------------------- | ------------------- | ---- | ------------------------------------------------------------------------------------ |
| Default production  | `production`        | 4320 | Immediate SSR, fixed prerender, ordinary defer, incremental boundary, lifetime races |
| Default diagnostics | `diagnostic`        | 4321 | Same cases, with development hydration diagnostics enabled                           |
| Full with replay    | `full`              | 4322 | Immediate SSR, fixed prerender, lifetime races                                       |

The shared server/browser `full` build replacement supplies
`withNoIncrementalHydration()` and `withEventReplay()`. Both profiles disable HTTP
transfer caching. The production output remains `angular-host-ssr`; the other
outputs append `-diagnostic` and `-full`. The uncached `build-hydration` aggregate
runs those cacheable builds sequentially; the browser target is also uncached.
No library hydration provider, private Angular flag, skip-hydration exception,
second queue or timing-based activation policy is introduced.

The suite holds bootstrap scripts, captures the parsed server root, editor host
and empty holder, then verifies those exact nodes remain connected and reused.
Shell render status is only a fixture checkpoint, never a claim that all deferred
content has hydrated. Browser console errors, hydration diagnostics, page errors
and unhandled rejections fail each test. Injected operational failures must arrive
through the editor's typed error output; diagnostics are not broadly suppressed.

The standalone card uses the public component, inputs, outputs and controls. Its
optional browser-test probe decorates the public real loader: actual Editor.js
creates the holder content, resolves readiness, edits, renders and captures every
save. Each component owns its probe session. The Playwright-owned observer can
hold module loading, readiness after the real instance settles, or a captured
real save; it records terminal events and releases or rejects a specific operation.
It intentionally retains old callbacks and DOM only inside an isolated test page
for disposal assertions. No probe exists in ordinary use, and none is serialized
or installed on the server.

The 49 browser cases establish:

- Retained SSR/prerender nodes, one instance and ready event per live holder,
  keyboard editing, detached change payloads, save/render/clear/focus/readonly
  controls and no synthetic change from authoritative input replacement.
- Latest input before module resolution, before readiness and after readiness;
  replacement of a captured save rejects with the existing `superseded` contract.
  The race waits for Angular to render the new bound input before releasing the
  save; a button click alone does not establish that checkpoint.
- Navigation before load/readiness resolves or rejects; no abandoned creation or
  stale output, with physical disposal when readiness safely settles. Load and
  initialization failure report once, and component recreation recovers.
- Captured automatic and imperative saves during removal/navigation, including
  rejection after a new owner is ready; repeated remounts and simultaneous A/B
  owners with distinct holders and independent documents. Disconnected DOM and
  retained upstream callbacks cannot publish; every created instance in the
  repeated-owner scenario is destroyed exactly once.
- Ordinary defer's placeholder, loading and error states, plus reload recovery
  after failed module delivery. The failed view asset is located through builder
  input/output metadata, not a guessed hashed filename. Incremental interaction
  reuses server content, replays activation, and creates one editor; subsequent
  client navigation follows the ordinary interaction trigger. Both boundaries
  may be abandoned before activation or while the editor loader is pending.

Readiness is still upstream-owned. A never-settling readiness promise cannot be
forcibly cancelled, and safe physical cleanup is only demonstrated on settlement.
Custom router strategies that retain components are outside this fixture's default
route-destruction coverage. A failed JavaScript module is cached by the browser;
view-delivery recovery explicitly reloads, whereas editor-loader/readiness recovery
recreates the component. No implicit retry or new recovery API is added.

The evidence required no library or core change. Reports, HTML, per-session events,
console messages, actual versions, the workspace lockfile, build metadata and server logs are retained in
`apps/editorjs/angular-e2e/test-output/hydration`; browser traces/screenshots are
retained on failure. Existing server-import, request-isolation, core, Angular,
root-without-Forms and CSR tests remain separate checks. These results certify only
this bounded workspace fixture; the separate packed evidence is recorded below.

## Native Signal Forms hydration and reset evidence (#565)

The complete ADR and engineering-guide preflight was repeated for this slice on
2026-10-12: seven local records and all fifteen Meta records at
`e2f34553c6e2492d0ab6f80ac795de44fc592a70`, including accepted, proposed and historical
records. A01/A02 preserve matched Forms peers and the optional public entry point;
A03/A05 retain component ownership and the existing framework-neutral coordinator;
A07 requires native values, flags and reset; A08–A10 require real Angular activation
and integration evidence. The public HTTP-contract, Nest and governance decisions
introduce no additional fixture changes. No conflict or exception was required.
The relevant guide topics were reviewed again. The Angular MCP best-practices
endpoint still failed; its API search and installed declarations confirmed
[public form naming](https://angular.dev/api/forms/signals/FormOptions).

`/forms` and `/sample/forms` now render a private reusable form owner. Each instance
has its own non-null signal model, native `form()` tree, schema-owned disabled and
readonly state, validation resource, optional loader probe and mock submission
completion. The abort regression exposed that a resource created in native
validation metadata did not follow component disposal in this baseline. Passing
the owning component injector explicitly to `resource()` closes that host lifetime
gap through the public API; the test requires both abort and settlement. The root
form name is explicitly stable per owner through Angular's
`FormOptions.name`; this avoids process-wide generated names changing otherwise
identical SSR responses. There are no manual name/value/flag bindings on the native
`[formField]` input and no new package form abstraction or CVA.

The two new lazy routes use Angular `@defer` directly: ordinary `on interaction`
and `on interaction; hydrate on interaction`. The latter renders the main form on
the server and hydrates it on a host activation click or Enter. Client navigation
uses the ordinary placeholder/interaction path. These routes run in default
production and diagnostic profiles; the explicitly non-incremental `full` profile
runs immediate Forms, prerender and lifetime cases. There is one activation
boundary, with no time-based trigger, private flag or skip-hydration exception.

The 69 added browser cases cover:

- Matched Angular/Forms 22.1.4 SSR and fixed prerender hydration, retained root/editor/
  holder nodes, non-null data, schema availability and initially valid, pristine,
  untouched, non-pending state. Readiness occurs once and initialization publishes
  no saved change or touch.
- Held bootstrap, JavaScript-disabled browsing, and a held incremental view module.
  Real mouse/Enter interactions cannot submit disabled native controls; browser
  `FormData` contains no successful controls before activation. The host activation
  click replays once after module delivery; it does not replay editor keystrokes
  into an editor DOM that did not exist on the server. No native POST, navigation
  or duplicate fixture submission occurs.
- Keyboard editing, focus movement within the composite control and touch on exit;
  synchronous content errors, asynchronous pending/rejected review, native
  submitting state, submission errors and reset/retry. `submit()` with
  `ignoreValidators: 'none'` refuses pending/invalid models; it does not wait and
  automatically retry. The host explicitly calls `EditorJsControl.save()` and
  validates the exact captured document. A held automatic save proves that this
  explicit capture works when the form model lags the edited DOM.
- Writes and native resets while module loading or readiness is held; subsequent
  disabled/readonly transitions; same-value reset overtaking automatic, explicit
  and submission snapshots. Native reset restores flags, suppresses old automatic
  publication and produces the existing typed `superseded` result for explicit saves.
- Independent A/B owners and replacement during pending load, readiness or save,
  on both resolution and rejection. Old owners emit no late outputs into their
  replacement. Pending validation aborts and settles on disposal. Reset or disposal
  also abandons the host's pending mock submission result; a replacement starts
  with fresh native flags and no captured document or submission count.

The disabled fieldset is host policy, including its native note input and submit
button; the adapter's inert editing region alone does not disable an enclosing
form. The fieldset remains disabled until real editor readiness and during native
submission. Its note is synthetic test data, not a credential. The controls used
to trigger races live outside the fieldset and are explicitly `type="button"`.
Native submit handlers prevent the default action immediately and fence concurrent
attempts. Host operation epochs guard host-owned snapshot/result display after a
reset or destruction; they do not replace the editor coordinator or native flags.
Mock completion performs no persistence. Already-sent real requests still require
application-specific cancellation/idempotency policy.

This evidence covers ordinary user interactions with this bounded form. Disabled
controls do not make a general form-submission firewall: application code calling
native `form.submit()`, enabled controls outside the fieldset, hidden inputs or
other submitters require their own host policy. Event replay does not defer a
browser's native form action until Angular is ready. No-JavaScript visitors retain
the unavailable message; they cannot author or submit in this fixture.

The Forms and core libraries needed no changes. Existing CSR `[formControl]`
coverage and native interoperability unit contracts remain intact. This slice
adds no legacy SSR, `ngModel`, CVA, package `FormControl`/`FormGroup`, automatic
save-on-submit or persistence support. The complete hydration run contains 118
cases, including the existing 49 standalone cases. Evidence uses the same HTML,
per-owner events, diagnostics, version/lockfile/build metadata and failure traces
as #564; server import/request cleanup and the 13-case CSR suite are separate
regressions. The packed SSR matrix is recorded below; final public support review
remains separate.

## Non-authoring route isolation (#566)

The complete preflight was repeated on 2026-10-13: all seven local ADRs and all
fifteen Meta records at `e2f34553c6e2492d0ab6f80ac795de44fc592a70`, including proposed
and historical records, plus the relevant Modern Angular guides. A01 preserves
installed peers; A02 requires actual dependency-graph evidence; A03/A05 retain
component ownership and the existing coordinator; A04 separates route loading
from dependency injection; A08–A10 require real defer and production browser/SSR
evidence. Governance, Nest and public HTTP contracts remain unchanged. No conflict
or exception was required. Angular MCP route-loading documentation and the
installed builder/browser tooling informed the checks; its best-practices endpoint
still returned `Unexpected response type`.

`e2e-isolation` runs ten Chromium cases against two owned production Node servers:
the ordinary build on port 4323 and an intentionally eager control on 4324. The
uncached `build-isolation` aggregate builds them sequentially. The eager control
uses a separate browser entry and output directory (`angular-host-ssr-eager`),
statically imports the real Editor.js constructor and retains it on `window`.
It never creates an editor. This entry is excluded from ordinary CSR and packed
CSR compilation; the normal production bootstrap is unchanged.

The graph check reads the production builder's input/output metadata and actual
emitted browser files. Positive `bytesInOutput` contributions from the Editor.js
package identify runtime-bearing outputs, independently of their hashed names.
It traverses static import edges from the browser entry and public route, adding
actual HTML script and preload/prefetch roots observed in the browser. Dynamic
imports are excluded from this eager closure and traversed separately to prove
the runtime remains reachable for authoring. Missing metadata, unclassified
external dependencies and an absent runtime fail the check. The eager control
must fail the same public-closure assertion. This uses the builder's
[metafile provenance](https://esbuild.github.io/api/#metafile), not source grep,
barrel structure or a size budget.

Fresh browser contexts capture requests, responses, HTML/HTTP resource hints and
Chromium precise execution coverage. Positive execution counts distinguish module
evaluation from parsing or delivery; the existing real-loader probe separately
records each owner and Editor.js instance. The cases establish:

- Cold request SSR (`/`) and prerender (`/sample/public`) loads, followed by actual
  client navigation between public routes, request no runtime, advertise no
  runtime preload/prefetch, execute no runtime and start no editor owner. Each
  public checkpoint includes a one-second observation bracketed by browser idle
  callbacks. Root identity confirms navigation did not reload the document.
- All six standalone/Forms authoring routes load and edit successfully. Deferred
  routes remain isolated before interaction; incremental routes reached through
  client navigation use their ordinary interaction trigger. Holding the actual
  runtime request proves request, delivery/evaluation and holder creation are
  separate stages. Releasing it produces real readiness and keyboard edits.
- Exit destroys the old editor while a captured real save is pending. Re-entry
  creates a fresh owner using the cached module. Releasing the old save and
  invoking its retained callback cannot publish stale outputs or overwrite the
  new owner. The new instance is also destroyed on exit. No claim is made that
  navigation unloads JavaScript from the browser's module cache.
- A deliberate `modulepreload` downloads the runtime without evaluating it or
  creating an editor, and fails the same public-delivery assertion. The eager
  build both downloads and evaluates it on a public route, creates no editor,
  and fails both graph and browser isolation assertions.

The host uses lazy routes with no router preloading strategy, authoring prefetch
policy or service worker; the browser suite explicitly blocks service workers.
These bounded idle checks do not prove the absence of arbitrary future timers.
Host-selected [route preloading](https://angular.dev/guide/routing/loading-strategies),
resource hints or eager imports can change delivery without changing per-holder
ownership. Applications must apply their own delivery policy; the library does
not prevent a host from preloading its modules. This slice adds no library or
core change and makes no new packed-version or custom-tool support claim.

Evidence is retained in `apps/editorjs/angular-e2e/test-output/isolation`: complete
ordinary/eager build copies, statistics, actual versions and workspace lockfile,
owned-server logs, graph reports, public HTML, network/resource-hint checkpoints,
raw runtime execution counts and per-owner lifetime events. The HTML report links
the attachments; browser traces and screenshots are retained on failure. Existing
server, hydration and CSR suites remain separate regressions.

## Packed SSR consumers and required CI (#567)

Before implementation on 2026-10-13, all seven local ADRs and all fifteen Meta
records were enumerated and read again, at Meta commit
`e2f34553c6e2492d0ab6f80ac795de44fc592a70`. The architecture, provider/routing,
reactivity, Forms, rendering, SSR/build, testing, validation and API guides were
reviewed. A01 requires exact compatibility evidence; A02/A09 keep public package
and browser/server boundaries intact; A10/A11 require installed artifacts and
release gates. ADR 0004 requires checking the actual packed READMEs. Governance,
Nest, authentication and public HTTP-contract decisions add no runtime change to
this private consumer. Proposed and historical decisions remain contextual; no
conflict, exception or dependency upgrade was needed. The Angular MCP provider
documentation was available; its best-practices endpoint still failed.

`e2e-packed-ssr` extends the existing two-stage packed consumer. It builds both
libraries through explicit Nx dependencies, packs them once and installs the
archives into owned temporary directories outside the workspace. The consumer has
no Nx installation, source aliases or workspace peer links. Every direct runtime
and build dependency is checked for its actual version and a real path inside the
consumer. Production metadata must identify installed Angular APF and core `dist`
inputs, and must not contain workspace library sources.

| Cell                  | All Angular runtime/SSR/build/Forms peers | Consumer Node | Editor.js | TypeScript |
| --------------------- | ----------------------------------------- | ------------- | --------- | ---------- |
| `angular22-minimum`   | 22.0.0                                    | 22.22.3       | 2.31.7    | 6.0.3      |
| `angular22-reference` | 22.1.4                                    | 24.15.0       | 2.31.7    | 6.0.3      |
| `angular22-current`   | 22.2.2                                    | 26.0.0        | 2.31.7    | 6.0.3      |

The matched Angular set includes core, common, compiler, compiler-cli,
platform-browser, platform-server, router, SSR, CLI, build and Forms. The first
stage intentionally omits Forms and proves the root imports and declarations work
without it. The second installs the exact Forms peer. Both stages retain browser
global guards, public export/private-subpath checks and neutral core dependency
checks. Both packed READMEs must match their source; the Angular README TypeScript
examples and public declaration fixtures compile with the cell's compiler.

Each cell then runs the existing forty native Forms interoperability tests and
thirteen real CSR browser cases. It copies the same SSR host sources and application
builder configuration into the isolated consumer, with standalone local TypeScript
configuration. The cell's Node binary runs its Angular compiler/builds and all
consumer servers. Workspace Playwright drives Chromium as external test tooling;
it is not installed into or resolved by the application.

All four SSR builds run per cell: default production, diagnostics, full hydration
with replay and the deliberately eager negative control. The complete server suite,
118 hydration cases and ten route-isolation cases run without reducing the
assertions for older minors. This exercises the installed default incremental
behavior and the explicit full-hydration opt-out independently. The server suite
allocates a port and proves clean process/socket teardown. Browser suites own ports
4330–4334, separate from workspace SSR ports 4320–4324; packed CSR keeps 4318.
They never reuse a developer server. Cells and builds run sequentially locally;
CI matrix cells run in separate machines.

Angular 22.0/22.1 emit a combined `stats.json`; the installed 22.2 builder emits
`browser-stats.json` and `server-stats.json`. The harness retains both originals
and writes a combined view for the shared assertions, with a `sources` field and
unchanged output records. Duplicate output keys fail rather than silently hiding
one graph. The same input provenance, eager-closure and server-import controls
apply to both metadata layouts.

The networked target is uncached and declares its dependencies, configuration,
lock/runtime inputs and report outputs. Existing workspace build caching and the
independent `e2e-packed` CSR target remain available. Do not run multiple packed
matrix invocations concurrently on one machine: they share reserved ports and
per-cell report directories. Each command has a fifteen-minute failure deadline,
then a five-second termination grace period. Interruptions terminate the owned
command process group; consumer directories and the task-owned npm cache are
removed in finalization. No global package cache or developer process is removed.

Evidence lives in `apps/editorjs/angular-e2e/test-output/ssr-compatibility/<cell>`:
both tarballs with SHA-256 identifiers, initial/final dependency locks and manifest,
actual dependency versions/paths, exact application/TypeScript build configurations,
command logs, all four emitted builds, server HTML/import-guard logs, hydration and
isolation reports/attachments, browser diagnostics and failure traces/screenshots.
`result.json` records completion or failure; `cleanup.json` records temporary
consumer removal. Build output is retained even when a later assertion fails.

The existing CI workflow adds these required release paths, with no
`continue-on-error` and always-run artifact upload:

- `editorjs-angular SSR (Chromium)`: workspace server, hydration and route-isolation
  targets, executed sequentially.
- `editorjs-angular packed SSR (angular22-minimum)`,
  `editorjs-angular packed SSR (angular22-reference)` and
  `editorjs-angular packed SSR (angular22-current)`: fresh full consumers in
  independent matrix jobs, with fail-fast disabled and seven-day artifact retention.

These gates supplement the main workspace checks, standalone Node 22.12.0 core
baseline, workspace CSR and existing packed CSR matrix. Release requires all gates
green on the exact intended release commit and review of the retained artifacts.
Workflow wiring does not modify repository branch-protection settings or establish
that hosted CI passed. This task does not monitor CI, merge, publish or bump versions.

Local validation on 2026-10-13 passed all three packed SSR cells: each completed
forty native Forms tests, thirteen CSR browser cases, all four SSR builds, the
server suite, 118 hydration cases and ten route-isolation cases. Minimum and
reference passed in the full-matrix invocation; current passed in a focused rerun
after adding support for its split build metadata. Each cell retained a passing
result and cleanup record, and its consumer and scratch directories were confirmed
absent. A deliberate offline-install failure also retained its failure log and
removed its temporary consumer. Workspace server/hydration/isolation suites,
standalone packed reference CSR, core and Angular unit tests, and e2e lint/type
checks passed. These are local results; hosted CI remains a separate release gate.

## Validation boundary

The workspace runtime is Angular 22.1.4 (including Forms/platform-server), with
build/SSR tooling 22.1.6 and Node 24.21.0 at validation. The separately installed
matrix above matches runtime and SSR/build peers in each cell. Existing package
checks retain root-only operation without Angular Forms or installed Editor.js and
core declarations without Angular/browser dependencies. Existing CSR browser
coverage is retained. Evidence remains bounded to the documented interaction
profiles, default route destruction, fixture tools and Chromium. It does not
certify arbitrary tools, route-reuse strategies, nested hydration, other browsers
or edge runtimes. Consumer-facing support and the final release gates are recorded
in the release review linked above.
