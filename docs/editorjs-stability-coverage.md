# Editor.js stability coverage and gap plan

Inventory for [#674](https://github.com/anarchitects/anarchitecture-community/issues/674),
5 November 2026, at merged renderer-readiness baseline
`b0e4cbeba4370445528fec018697a6f594539f62` (PR #699).
This is the contributor validation plan for [#75](https://github.com/anarchitects/anarchitecture-community/issues/75).
It inventories existing proof and assigns remaining work; it does not certify a
new integrated candidate, change runtime behavior or start the later slices.

The [#675 neutral contract record](#675-neutral-contract-validation) below updates
G01 after this inventory; the original baseline and historical evidence retain
their stated scope.
The [#676 browser composition record](#676-browser-composition) updates G02.

## Decisions and evidence rules

Re-enumerated and read all nine Community ADRs and all eighteen Meta ADRs,
including proposed and historical material. The fresh remote Meta tree matches
the clean adjacent checkout at `47e75544673037d25665c8c9305c809802b58261`.
No additional repository ADR location or nested AGENTS file was found.

Community inventory: 0001–0008 and Modern Angular 22 signal forms, all accepted.
Meta inventory: both 0001 records, 0002–0007, both 0008 records, 0009–0015 and
ADR-0001 landscape. Cooperative enrichment, hierarchy, Archi and layering remain
proposals; 0014's superseded rollout observations are historical. Read the Modern
Angular index, repository application, architecture, providers/routing, reactivity,
Forms, rendering, SSR/builds, testing/migration and validation guides, plus the
core/Angular development guidance and the owning design/validation records below.

Applicable constraints, with no accepted-decision conflict found:

- Community0004: shipped examples and complete package READMEs are consumer
  contracts. This inventory belongs in contributor documentation. Validate actual
  archives after all build/check writers finish, not merely source Markdown.
- Community0008: own neutral formatter with core and `sanitize-html@2.18.1`;
  one safety boundary for built-ins/custom/tunes, explicit strict/preview results,
  missing/authored/decorative alt, normal Angular binding and host-owned policy.
  Structural validity, successful save, safe HTML and publication approval differ.
- Angular A01–A03/A05–A10: preserve standalone/signal ownership, optional native
  Forms, lifetime/cancellation semantics, actual browser/SSR/packed evidence and
  exact supported versions. Ordinary renderer provider arrays remain the accepted
  local refinement. A jsdom test is not browser or hydration certification.
- Community0005/0006 and Meta0008–0012: preserve established Nest 12.3.2 native
  Node reference composition and Fastify behavior. No new adapter default, HTTP
  persistence endpoint, shared wire contract or framework dependency in core.
- Community0007/Meta0013: independent release intent and exact Nx scopes. This
  repository-wide inventory uses `docs:` and changes no package/version. #76 must
  refresh actual distribution history before selecting release versions.
- Meta0015: accurate resolved inputs/outputs/prerequisites, uncached fresh
  resolution/completeness, safe isolation, affected selection and separate local,
  remote and DTE evidence. No monitoring, hosted experiment or capacity decision
  is authorized by this inventory.

Evidence classes used below: **U** deterministic unit/contract; **I** framework or
recipe integration (including TestBed/jsdom); **W** real workspace browser/server;
**P** independently installed packed consumer. A package test can contain both U
and P cases: classify its assertions, not its filename. Tool `browser.spec.ts`
files use jsdom; real tool Chromium proof lives in the packed portable suite.
Repeated fixtures across cells are compatibility executions, not distinct flows.
Configuration and historical passing reports are not fresh test results.

## Current scope and compatibility

The resolved Nx graph contains ten Editor.js libraries plus two private projects:

| Project                                                                                                               | Package/role                                                          | Resolved targets |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------- |
| `editorjs-core`                                                                                                       | Neutral data, coordinator, registry, upload and provenance contracts  | 28               |
| `editorjs-tool-paragraph`, `editorjs-tool-header`, `editorjs-tool-list`, `editorjs-tool-quote`, `editorjs-tool-image` | Five common tools; neutral roots and separate browser implementations | 20 each          |
| `editorjs-upload-fetch`                                                                                               | Browser Fetch upload adapter; optional archived Nest reference        | 20               |
| `editorjs-angular`                                                                                                    | Authoring root and optional `/forms` APF entry                        | 15               |
| `editorjs-html`                                                                                                       | Neutral safe HTML renderer                                            | 24               |
| `editorjs-html-angular`                                                                                               | Optional component/directive/configuration APF                        | 39               |
| `editorjs-angular-host`                                                                                               | Private workspace browser/SSR test host                               | 10               |
| `editorjs-angular-e2e`                                                                                                | Workspace and packed authoring validation                             | 105              |

All ten package manifests currently say `0.0.1`; that is not proof of public npm
availability. Renderer history and final artifacts were reviewed in
[#688's record](editorjs-html-release-readiness.md). #75 does not publish them.

| Layer                           | Established proof contract; preserve separately                                                                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neutral core/tool/upload checks | Dedicated Node 22.12.0 baseline plus general workspace Node 24 checks. Tool public root imports are neutral, but their install manifests include upstream authoring packages; do not equate that with the renderer's dependency-free-of-authoring closure. |
| Authoring packed CSR and SSR    | Angular/Forms 22.0.0 + Node 22.22.3; 22.1.4 + 24.15.0; 22.2.2 + 26.0.0. TypeScript 6.0.3, Editor.js 2.31.7. Preparation checks standalone with Forms absent before installing matched Forms. Reference neutral persistence additionally uses Node 22.12.0. |
| Headless renderer               | Node 22.12.0, 22.22.3, 24.15.0 and 26.0.0; ESM and bundled browser; ES2022-only declarations with NodeNext/Bundler and no DOM/framework ambient types. No advertised native CommonJS.                                                                      |
| Angular renderer                | Three exact Angular/Node pairs above, independently proven; matched compiler/CLI/build/SSR, TypeScript 6.0.3, ng-packagr 22.1.1. Renderer consumers do not require authoring or Forms.                                                                     |
| Browser                         | Existing Playwright 1.64.0 Chromium cells. Renderer record identifies actual Chromium 156.0.8078.4; authoring records also retain revision 1248. No Firefox/WebKit or broad OS support claim follows.                                                      |
| Optional Nest references        | Existing upload Fastify/native Node reference consumers, Nest 12.3.2. The persistence service's standalone Nest DI example is not an HTTP persistence endpoint.                                                                                            |

Sources: [authoring matrix](../apps/editorjs/angular-e2e/tools/compatibility-matrix.json),
[renderer matrix](../packages/editorjs/html-angular/tools/packed/matrix.json),
[persistence evidence](editorjs-persistence-validation.md), and
[renderer readiness](editorjs-html-release-readiness.md).

## Critical-flow coverage

CI identifiers refer to the jobs in the topology section. Paths below are source
coverage inspected at this baseline; dated execution evidence follows separately.

| Risk / observable contract                                      | Concrete existing proof                                                                                                                                                                                                                                                                                                                                                                       | Nx / CI                                                                                                                                            | Gap or reuse decision                                                                                                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parsing, detachment, malformed JSON, IDs and provenance         | U: core `parse-output-data`, `output-data`, `validate-output-data`, `content-provenance` specs; getters/toJSON, cycles, sparse/unknown/prototype-like fields, future versions and validator failures. P: core `package.spec.ts`, ES2022 public imports/declarations and archived recipes.                                                                                                     | `editorjs-core:{build,typecheck,test,lint}`; neutral + main                                                                                        | Reuse; G01 adds the missing persistence-to-renderer boundary rather than duplicating parser cases.                                                              |
| Queue, explicit save, read-only and stale async completion      | U: core `editor-document-coordinator`, `editor-controls`; I: Angular `component`, `loader`; W/P: `src/editor.spec.ts`.                                                                                                                                                                                                                                                                        | Core/Angular `test`; authoring `e2e`, packed `csr-editor`; main + browser + packed                                                                 | Existing queue/disposal proof is substantial. G02 tests composed saved/display state, not a second coordinator.                                                 |
| Registry identity, aliases, resolver ownership and lazy loading | U: core `tool-registry`, `tool-resolver`, `tool-upload`; I: Angular `tool-providers`, component/Forms specs; P: `portable/registry.spec.ts`, hydration registry and isolation routes.                                                                                                                                                                                                         | Core/Angular `test`; packed `portable`, `hydration-registry`, `isolation`; main + packed                                                           | Reuse exact selection/owner contracts; G01/G02 join saved aliases and tunes to explicit renderer registrations.                                                 |
| Common tools, nested lists, quote attribution and image alt     | U/I: each tool's data, package and jsdom browser specs; P: seven [portable specs](../apps/editorjs/angular-e2e/portable), including real individual/common-tool consumers.                                                                                                                                                                                                                    | Tool `test`; packed `portable` and hydration `common`; neutral + main + packed                                                                     | Reuse caption/file metadata and alt controls. G01/G02 verify actual saved alt/list data through storage and rendering.                                          |
| Custom Callout/Marker/FlagTune and literal Code                 | P: archived core/Angular `custom-tools.md`, `angular-custom-consumer.mjs`, portable/CSR/hydration/isolation tests; Code 2.9.4 and explicit-save behavior in [custom-tool evidence](editorjs-custom-tools-validation.md).                                                                                                                                                                      | Packed `portable`, `csr-editor`, `csr-forms`, `hydration-registry`, `isolation`; packed                                                            | No new tool framework. G01/G02 join these saved shapes to the renderer; unknown tunes must not silently disappear.                                              |
| Upload success/failure/abort/retry and ownership                | U: core `upload-operation`, `tool-upload`, upload-fetch `adapter`; I: Angular `upload-owner` and Forms tests; W/P: `src/upload`, `src/forms-upload`, matching hydration files; P: two Nest upload phases.                                                                                                                                                                                     | `editorjs-upload-fetch:test-browser`, authoring `e2e`, packed `csr-upload`, `csr-forms-upload`, `nest-upload-*`; neutral + main + browser + packed | Existing controlled network and owner tests remain authoritative. G02 must distinguish upload completion from document persistence/display acknowledgement.     |
| Persistence codec, migration and revisioned service             | P: core [fixture suites](../packages/editorjs/core/tests/fixtures) `persistence-consumer.mjs`, `migration-consumer.mjs`, `service-consumer.mjs`; archive extraction compiles/runs eight guide files under both declaration modes. Tests cover no-write failures, detached snapshots, collisions, concurrent creates/updates, authorization and bounded storage.                               | Core `test`; packed CSR `portable`; neutral + main + packed                                                                                        | Reuse no-write and migration tests. G01 is the untested composed load-to-render seam; durable storage and authorization policy stay host-owned.                 |
| Angular persistence, native Forms and acknowledgement races     | I: Angular `forms`, `forms-interop`; P: [notebook cases](../apps/editorjs/angular-e2e/persistence/cases.ts) called by editor/Forms specs, and [notebook hydration](../apps/editorjs/angular-e2e/hydration/notebook-cases.ts). They skip intentionally outside archived consumers.                                                                                                             | Angular `test`; packed `interop`, `csr-editor`, `csr-forms`, `hydration-registry`; main + packed                                                   | Workspace browser success does not cover these packed-only cases. G02 adds display composition; retain legacy reset-hook and unsupported direct ngModel limits. |
| Headless semantics, strict/preview and custom policy            | U: HTML `renderer`, `profiles`, `extensions`, `conformance`, `security`; P: guarded imports, declarations, six archived recipes and browser semantics.                                                                                                                                                                                                                                        | `editorjs-html:test`; four `packed--headless-*--headless` atoms; neutral + main + SSR                                                              | Reuse #682/#683/#687. G01 validates real authoring/persistence payloads without assuming structural validity means renderability.                               |
| XSS, unsafe custom output, limits and accessibility             | U/P: shared [adversarial fixtures](../packages/editorjs/html/tests/adversarial-fixtures.ts), `adversarial.spec.ts`, [browser harness](../packages/editorjs/html/tools/adversarial-browser.mjs). #684 covers encoded URLs, namespaces, content models, callback/tune/alias paths, limits, request/execution negative controls and semantic accessibility. Angular corpus uses the same inputs. | HTML `test`; renderer headless/corpus atoms; neutral + main + SSR                                                                                  | Do not copy the corpus or substitute string assertions for DOM proof. G01/G02 test the pipeline's decision boundary; G03 checks changed SSR composition.        |
| Component/directive input, failure recovery and scoped DI       | I: HTML Angular `component`, `directive`, `providers`, `package`; P: behavior/corpus consumers, nearest-provider and instance precedence, invalid replacement clears old HTML.                                                                                                                                                                                                                | `editorjs-html-angular:test`; three behavior/corpus atoms; main + SSR                                                                              | Existing surface proof is reusable. G02 joins actual saved/loaded snapshots and confirms no stale successful display.                                           |
| Server imports, SSR, hydration and request isolation            | W: `validate-ssr.mjs`, eight hydration spec files; P: authoring builds/SSR/hydration and renderer build/behavior cells. Rendering modes, no browser evaluation, Forms absence, request markers and concurrent policy isolation are explicit.                                                                                                                                                  | `test-ssr`, `e2e-hydration`, authoring and renderer packed atoms; SSR + packed                                                                     | G03 covers the newly composed stored-document display. Cold-route timing remains an investigation lead, not a proven product regression.                        |
| Public delivery isolation                                       | W/P: authoring [isolation routes](../apps/editorjs/angular-e2e/isolation/routes.spec.ts), build graph and request/evaluation probes with eager control; P: renderer `browser-checks.mjs` has real Editor.js/Paragraph/authoring-APF negative control.                                                                                                                                         | `e2e-isolation`, authoring `isolation`, renderer isolation atoms; SSR + packed                                                                     | G03 must keep the composed display route free of authoring code, tools and styles; renderer output success alone is insufficient.                               |

Directories for the named suites: [core tests](../packages/editorjs/core/tests),
[Angular tests](../packages/editorjs/angular/tests),
[HTML tests](../packages/editorjs/html/tests),
[HTML Angular tests](../packages/editorjs/html-angular/tests),
[workspace browser specs](../apps/editorjs/angular-e2e/src),
[hydration specs](../apps/editorjs/angular-e2e/hydration).

## Integrated scenarios to close

Source inspection found no renderer imports in the existing authoring host,
authoring/persistence tests or neutral persistence fixture suites. Renderer
consumers instead start from saved fixtures. Their separate successes do not
prove the following joined journeys. Extend owning fixtures/public recipes with
one shared set of scenario data; do not reproduce whole package suites.

| ID  | Scenario and required observations                                                                                                                                                                                                                                                                                                                                       | Primary owner                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| S1  | Author common blocks, nested ordered/check lists, quote and image; explicitly save, persist a detached snapshot, reload through the existing codec/service, render headlessly and through both Angular surfaces. Assert actual data/semantic DOM and no mutation or private imports.                                                                                     | #675 neutral seam; #676 browser composition |
| S2  | Preserve configured aliases, custom Callout/Marker, FlagTune and literal Code through save/storage/load. Register renderers/tunes explicitly; unknown block/tune fails strict without HTML and produces explicit preview omission. Code is escaped literal text and uses explicit save, not an invented live-change guarantee.                                           | #675/#676                                   |
| S3  | Missing/blank image alt can remain structurally valid saved data but cannot strict-render. Preview omits the image; authored literal alt and deliberate empty decorative alt remain distinct from caption. Correcting alt recovers both display surfaces without stale HTML.                                                                                             | #675/#676                                   |
| S4  | Malformed, unsupported, failed-migration, unauthorized or stale-revision data must not write or become an empty valid document. Valid-but-unsafe persisted/custom HTML reaches the common renderer policy: strict has no HTML; preview reports transformation/omission. A successful store/save is never publication approval.                                           | #675; visible recovery #676                 |
| S5  | While an upload/save/load is held, make newer edits, submit twice, reset/recreate or destroy an owner. Acknowledgement applies only to its captured snapshot; newer drafts and native dirty/touched/pending/error state survive appropriately. The display uses the host's deliberately selected acknowledged/current snapshot and does not leak another owner's result. | #676                                        |
| S6  | SSR/prerender the loaded safe document under per-request/scoped policies; hydrate with matching input and verify semantic parity and errors. Interleave two requests, navigate authoring → public display, and observe no authoring downloads/evaluation on cold public display. Retain a negative control that must detect a deliberate leak.                           | #677; reusable minimal recipe #678          |

S4 should inject unsafe stored content at the persistence boundary where needed:
do not force the real editor to preserve markup its own sanitizer removes. Keep
failed transport/storage, invalid structure, unsafe HTML and editorial rejection
observable as different outcomes. These scenarios require no production storage
engine, mandatory envelope or new publication API.

## Existing hosts, recipes and the #78 boundary

There is one private Editor.js Nx application, not four public demo products.
The other application entries in the graph are Nest SSR fixtures and the workspace
root metadata project. Generated packed consumers are real independent
installations but are not deployable showcases.

| Existing surface                                | Location / supported paths                                                                                                                                                                     | Existing gate and required outcome                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace CSR authoring                         | `apps/editorjs/angular-host/src/app`; `/`, `/?forms`, `/?upload`, `/?forms-upload`                                                                                                             | Host build/typecheck/lint via main; `editorjs-angular-e2e:e2e` in browser job starts production `serve-static`, edits/focuses/saves/disposes real editors and controls. Port 4317 must be free; no reuse of an existing server.                                                                         |
| Workspace SSR/hydration                         | Host `src/ssr`; public `/` and `/sample/public`; registry/tools/upload/forms-upload; standalone/forms/deferred/incremental variants; `/sample/standalone` and `/sample/forms` prerender routes | SSR job runs server, hydration and isolation targets with production/diagnostic/full/eager-control builds. Assert server output, actual hydration behavior, request separation and public-route delivery, not HTTP 200 alone.                                                                           |
| Archived authoring/custom/persistence consumers | Core/Angular READMEs, `custom-tools.md`, core `persistence.md`/`service.md`, Angular `persistence.md`; generated `?notebook=editor` and `?notebook=forms`, plus SSR notebook/custom routes     | Packed preparation extracts exact shipped files and checks Forms-absent imports; portable/interop/CSR/hydration/isolation/readme phases compile and execute them. Missing source markers or failed notebook actions fail the relevant gate. These routes do not exist in the unmodified workspace host. |
| Upload browser and optional backend references  | `packages/editorjs/upload-fetch/README.md`, `nest-example.md`; generated neutral/browser and Nest consumers                                                                                    | `test-browser` in browser job plus reference CSR `nest-upload-fastify`/`nest-upload-node` in packed job. Assert actual controlled HTTP/abort/mapping behavior. Existing Nest persistence DI composition proves service injection, not an HTTP endpoint.                                                 |
| Headless renderer recipes                       | Six complete public-import examples extracted by `html/tools/packed-smoke.mjs` from its packed README                                                                                          | Four renderer headless atoms: declarations, execution, guarded Node imports, browser semantics/security and dependency isolation.                                                                                                                                                                       |
| Angular renderer reference/recipes              | Seven README source files; `html-angular/tools/consumer/{app,corpus,server,main,main.server}.ts` and generated scoped/directive routes                                                         | Three build/behavior/corpus/isolation sets in SSR job: compile recipes, real CSR/SSR/prerender/hydration, strict/preview/DI behavior and authoring absence.                                                                                                                                             |
| Joined author/save/load/render example          | Private packed observers from #676 and the stored display/SSR fixture from #677                                                                                                                | Existing CSR file atoms, SSR/hydration/isolation atoms and renderer corpus atoms select these fixtures; see the SI-75.5 mapping below. No extra showcase application is needed.                                                                                                                         |

[#78](https://github.com/anarchitects/anarchitecture-community/issues/78) still
owns new public basic-editor, Forms, SSR and Nest-backed-upload showcases and
their discoverability. Each future supported host must declare its owner, exact
matrix, public imports/recipe assets, Nx build/typecheck and appropriate browser/
SSR smoke, failure diagnostics, isolation and affected-selection dependencies
before being advertised. Nonexistent demos are neither a passing gate nor an
excuse to skip existing fixture validation. Bricks/FitOverForty adoption stays
outside #75.

## Resolved Nx contracts and CI topology

Read the resolved graph, not just project files. The current authoring project has
**89 cached packed atoms**: CSR minimum/reference/current **7/9/7**, SSR **22/22/22**;
six uncached preparations and ten other targets make 105. Reference CSR adds the
two Nest upload phases. Each CSR cell has one build; each SSR cell has CSR plus
four SSR builds. The remaining atoms are interop/portable/browser/server/recipe
checks. These are task counts, not unique tests; SSR consumers also exercise CSR.

Renderer inference adds **16 cached atoms**: four headless and, for each of three
Angular cells, build/behavior/corpus/isolation. Seven uncached preparation atoms
feed the uncached preparation aggregate; the completeness collector is also
uncached. There are **105 packed proof atoms across both families**, plus thirteen
fresh preparation atoms. Inferred per-file Vitest targets are additional potential
work; the main job currently invokes aggregate `test`, not `test-ci`.

| Workload                        | Resolved cache / inputs / output / ordering contract                                                                                                                                                                                                                                                                                                          | Review consequence                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core and neutral package checks | Cached; default/production plus dependency inputs, root TypeScript config, lock, exact Node/platform/arch and NODE_OPTIONS; tests add CI, lint shared rules. Core build emits package `dist`; test depends on build, typecheck on build/dependency typecheck.                                                                                                 | Reuse package proof where identities match. Packed examples are part of package tests; do not count them again as new unit coverage.                                                                                                                                                                                     |
| Authoring packed                | Cached atoms hash project/dependency inputs, yarn/nx/worker configuration, selected copied fixtures, coordinator Node, run ID, CI, build workers, browser path and verified source/snapshot/platform identity. Outputs are disjoint by run/mode/cell/phase. Browser atoms depend on matching restorable builds; preparation stays outside distributed graphs. | `packed-results.mjs` is an uncached CLI gate checking every required phase and file manifest; absent/failed/skipped dependencies cannot pass. Verify changed seams and worker equivalence in #679.                                                                                                                       |
| Renderer packed                 | Cached atoms hash default/dependency inputs, lock/nx, runtime/environment, source identity, sealed consumer and locks, actual headless-shell installation and workspace/platform identity. Three browser phases depend on their matching build. Results are isolated by run/cell/phase.                                                                       | `packed-collect` requires all sixteen valid manifests and deletes prior completion before collecting. Current machine/path/run-bound snapshots do not establish cross-machine remote reuse.                                                                                                                              |
| Workspace browser/server        | `e2e` cached; explicit inputs include default, dependency production, CI, platform/arch and root TS config. Its host build has production/dependency inputs. `test-ssr`, `e2e-hydration`, `e2e-isolation` are uncached; their builders are cached. Hydration/isolation builders share the production SSR output directory.                                    | #679 must resolve effective external dependency hashing and test Node/browser invalidation; explicit inputs lack the packed runtime identity contract. Shared output paths/fixed workspace port preclude assuming concurrent safety. Preserve serial ownership or prove isolation before caching/distributing more work. |
| Upload browser                  | Cached; `uploadTests`, dependency inputs, image sources, Playwright version and browser-path environment; build and image build prerequisites; browser reports declared.                                                                                                                                                                                      | Reuse existing controlled transport tests; #679 audits effective runtime/browser inputs with the other browser tasks.                                                                                                                                                                                                    |
| Fresh/external/long-lived work  | Browser installation, packed preparation, packed convenience wrappers, workspace servers and completeness checks remain uncached. Root Nest validation targets have no explicit cache enablement.                                                                                                                                                             | Keep fresh resolution and side effects uncached. Assess deterministic workspace SSR eligibility in #679 with reason/owner/revisit, not blanket cache disabling.                                                                                                                                                          |

> The following topology is the #674 baseline. The SI-75.8 evidence below records
> the #695 admission and aggregate changes; this inventory is retained for comparison.

`sharedGlobals` currently includes `.github/workflows/ci.yml`. Graph dependencies
include e2e → host/upload-fetch → core/tools/Angular; renderer Angular → headless
→ core plus dev-conformance tool dependencies. These development edges do not
mean headless runtime installs authoring tools. The root source project depends
on `nest-angular-ssr`, but its root-owned fixture target selection still needs
the #695 audit; a project edge alone does not prove per-target admission behavior.

The checked-in [CI workflow](../.github/workflows/ci.yml) has eight job definitions,
twelve expanded jobs, and triggers on PRs and pushes to main. It has no affected
selection, pre-allocation admission job, aggregate gate or `merge_group` event.
All validation jobs allocate runners unconditionally. Most checkouts fetch full
history; the OS consumer job does not. No trusted affected base/head is computed.

| CI key / expanded jobs                          | Actual invocation and ownership                                                                                                                                                                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main` / 1                                      | Ubuntu/Node 24; workspace `run-many -t lint test build typecheck`, Nest split validation and Better Auth integration checks. Ends with existing `nx fix-ci` on always. It has no `needs` on other jobs and is not a workflow-wide aggregate.        |
| `editorjs-core-runtime-baseline` / 1            | Ubuntu/Node 22.12.0; core, five tools, upload-fetch and headless renderer build/typecheck/test/lint. Angular stays out of this floor job.                                                                                                           |
| `editorjs-angular-browser` / 1                  | Ubuntu/Node 24; browser installation, authoring `e2e`, upload-fetch `test-browser`; seven-day failure artifacts.                                                                                                                                    |
| `editorjs-angular-ssr` / 1                      | Ubuntu/Node 24; workspace SSR/hydration/isolation, renderer preparation and all sixteen atoms at parallelism two; always-run renderer collector and seven-day artifacts. No renderer DTE startup here.                                              |
| `editorjs-angular-packed` / 1                   | Ubuntu 22.04/Node 24.22.1; harness tests, worker-template validation, six fresh preparations outside DTE, one-day input artifact, worker start, all 89 atoms, completeness gate, always completion, remote-restoration audit and seven-day results. |
| `nest-angular-ssr-consumers` / 2                | Ubuntu/macOS root consumer validation. macOS retains the case-insensitive filesystem guard-bypass security proof. Selection inside this job would still allocate macOS.                                                                             |
| `nest-angular-ssr-compatibility` / 3            | Ubuntu root matrix: Angular21/Nx22, Angular21/Nx23, Angular22/Nx23. Preserve this independent advertised package support.                                                                                                                           |
| `better-auth-typeorm-adapter-compatibility` / 2 | Node20/TypeORM1.0.0 and Node24/TypeORM^1.0.0, independent of Editor.js scope. #695 must select these honestly rather than running them for unrelated work by default.                                                                               |

The [authoring worker template](../.nx/workflows/editorjs-packed.yaml) uses
`docker_linux_amd64/medium` on `ubuntu22.04-node20.11-v9`, installs Node24.22.1,
immutable workspace dependencies, Chromium headless shell/OS dependencies and
`unzip`, then restores immutable inputs. Existing distribution is the repository
variable or fallback `3 editorjs-packed`; this inventory neither tunes it nor
claims it optimal. Explicit completion/cancellation, worker failures, source/
artifact transport and remote output restoration remain #679 verification seams.

### Validation tiers and affected admission contract

For ordinary relevant changes, retain package build/typecheck/lint/test, neutral
floor, real browser/server checks and all currently required packed cells. #695
may skip unrelated project families only after proving graph-derived selection.
Do not quietly downsample a support matrix or remove macOS security proof.

Required selection examples: core/authoring/tool/upload changes select their
dependent authoring checks; headless safety or sanitizer changes select headless
and Angular renderer proofs; Angular-renderer changes select its cells; SSR
library/fixture/security changes select the Nest OS/matrix gates; shared lock,
toolchain and workflow changes select all affected contracts. An unrelated
Editor.js-only change should avoid Nest platform allocation once modeled safely.
Resolve PR/main base/head with sufficient history; invalid/missing selection must
fall back conservatively, not report an empty success. If a merge queue is later
enabled, add its event/check contract before requiring it.

Integrated acceptance (#680) requires all selected mandatory outcomes on its
exact commit, intentional skips separately verified, actual fresh installations,
complete artifacts and disposition of the exceptions below. #76 repeats these
gates on its final release commit and final archives. No scheduled/full extra
matrix, additional browser/OS or paid validation is introduced by this plan.

## Effective main protection: read-only inventory

Read on 5 November 2026. Connector access to classic protection returned 403;
the local CLI has admin/maintain/push/read access and returned **404 “Branch not
protected”** from classic `/branches/main/protection`. This is absence of a
classic rule, not absence of ruleset protection. CLI effective-branch rules and
the connector's repository/inherited-ruleset inventory agree on one active rule:
[ruleset 14374927, `main`](https://github.com/anarchitects/anarchitecture-community/rules/14374927),
repository source, default-branch inclusion, no exclusions. No inherited rule
was returned. These are dated observations, not future settings guarantees.

| Control                   | Observed effective value                                                                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Required check            | Only context `main`, integration ID `15368`; strict up-to-date requirement enabled; enforced on creation.                                                                                                                    |
| PR and merge              | PR required; ruleset permits squash only. Repository allows merge/rebase/squash generally, but those broader defaults do not override the main ruleset. No merge-queue rule returned.                                        |
| Reviews                   | Required approvals 0; code-owner review, stale-review dismissal, last-push approval and thread-resolution requirements false; extra approval for unattributed changes true. Do not invent a different approval-count policy. |
| Commit/history protection | Signed commits, deletion restriction and non-fast-forward restriction enabled. No separate linear-history rule returned.                                                                                                     |
| Bypass                    | Integration actor ID `3090882`, mode `always`; current connected caller reports `never` bypass. #696 must identify/justify that integration before changing exemptions.                                                      |
| Other repository settings | Auto-merge false; delete-branch-on-merge false.                                                                                                                                                                              |

**Gap G08:** `main` can succeed independently of a failing browser, SSR, packed,
neutral-floor or platform compatibility job. Current protection does not itself
require those outcomes. #695/#679 must establish a stable fail-closed aggregate
and intentional-skip semantics; #696 owns the reviewed settings diff, authorized
update and effective read-back. Preserve existing safeguards and resolve any
weaker/broader bypass proposal with the maintainer. Nothing was changed here.

## Dated evidence and applicability

This review ran graph/configuration/source checks and settings reads, not a new
test matrix or CI inspection. Old green runs are references, not this baseline's
acceptance certificate. The immediately preceding renderer handoff is reusable
only for its exact unchanged inputs and bounded claims.

| Evidence                           | Identity and observed scope                                                                                                                                                                                                                                                                                                                                   | Reuse / outstanding limit                                                                                                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #663/#664 persistence              | [Record](editorjs-persistence-validation.md): baseline `f6050941055668dc3109ab94e3b46f139276d078`, run `si663-local`, source `0280492719e571e653c9689b365def9a03984ded06f0b1613e54ad126fcf5d73`; six fresh preparations, 28 selected atoms, 271 core/196 Angular tests, local restoration/invalidation. #664 records later documentation-only archive hashes. | Reuse scenario design, not old snapshot passes as current. Current authoring fingerprint below differs. Since #74 the lock/nx/CI and notebook hydration readiness synchronization changed; package persistence implementations remain unchanged. |
| Earlier authoring hosted proof     | [Upload readiness](editorjs-upload-release-readiness.md#hosted-dte-and-cache-evidence): source `b1ebe596c4688986e915067aebbac9b78b48e8ea`, workflow `40947715057`, Nx run `1unuepAW6u`: 89 atoms across three workers and two remote hits restoring fifteen files.                                                                                            | Historical topology proof only. It predates custom/persistence changes and the current four-phase cache audit; does not close #663/#664 remote/DTE debt.                                                                                         |
| #681/#684 renderer design/security | [Research](editorjs-html-research.md), accepted [ADR0008](adr/0008-editorjs-html-rendering.md), [adversarial record](editorjs-html-adversarial-validation.md). Shared corpus and sanitizer2.18.1 contract remain present.                                                                                                                                     | Reuse corpus, threat boundary and regression seams; refresh affected proof after policy/dependency/code changes. No universal security or accessibility certification.                                                                           |
| #687/#688 renderer proof           | [Readiness](editorjs-html-release-readiness.md): local `si688-readiness`, seven fresh installations, sixteen cold atoms and collector; 598 headless/35 Angular tests; all archive/snapshot/consumer/runtime lock identities recorded.                                                                                                                         | Current renderer source identity matches. Source applicability was recomputed here; browser and test execution were not repeated. Keep exact archive/lock comparisons when producing the integrated candidate.                                   |
| Reviewed implementation CI         | #688's authorized inspection recorded all twelve jobs green on `b172a04853e23474b6b671c40a17680e6b16855c`, [run 41904896535](https://github.com/anarchitects/anarchitecture-community/actions/runs/41904896535), whose tree equals merged `fbe7ee9`.                                                                                                          | Imported evidence only; no new CI lookup or claim that #699/current main is green. Authoring DTE job success is not renderer DTE proof.                                                                                                          |

Read-only baseline fingerprints recomputed for this inventory:

| Input                         | SHA-256                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| Authoring `sourceFingerprint` | `7b7e680ee9f07c66b6df5dbab393145327afa9e0dd59cce5d3d858c8e60d3fef` |
| Renderer `sourceIdentity`     | `969b0bc161e75900e39dd68e77eb236f438d617946dfaf3d43f988a84a933973` |
| Workspace yarn.lock           | `e9016cf82f01e0be7bd081e4a4b4bb9b54313037181fafff31c47c8184eb878d` |
| CI workflow                   | `32c52cb93e796958f7c4c75cf60d7b6afa6b61a0abcb3e4014b2e9df57807d8c` |
| Packed worker template        | `191eb4c6f2ba1b4cf3ea8ac0bfe119f170cc2c7bc33e87165e6a65247cdb3cc0` |

## Prioritized gap ledger and completion criteria

P1 means required before integrated acceptance unless the maintainer explicitly
accepts a bounded exception. P2 means an investigation with no established product
defect; close with causal evidence or an explicit unresolved disposition. Each
slice updates this ledger with commit, command, archive/lock identity, results
and remaining limits. None needs a test-count quota.

| Gap / priority                                 | Owner and concrete work                                                                                                                                                                                                                                                    | Verification and completion                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G01 / P1 — neutral joined contract             | #675: S1–S4 through public codec/service/core and renderer APIs, reusing archived persistence and renderer fixtures. Add production changes only for reproduced defects.                                                                                                   | Owning core/HTML/tool/upload Nx checks plus appropriate packed neutral/portable atoms. Failures expose no HTML/no write as applicable; safe semantic data survives detached round trips, aliases/tunes/Code/alt. Record actual archives and locks.                                                             |
| G02 / P1 — browser composition                 | #676: S1–S5 using existing authoring/Forms/notebook fixtures and both renderer surfaces; preserve absent/present Forms and owner scope.                                                                                                                                    | Angular/HTML Angular tests, real browser and affected packed CSR/behavior/corpus cells. Assert acknowledged versus newer draft, disposal/late-result fencing, diagnostics, invalid-display clearing and recovery. Do not count independent fixture passes as the joined journey.                               |
| G03 / P1 — composed SSR/delivery               | #677: implemented S6 in the SI-75.4 record below, reusing the existing matrix and negative controls.                                                                                                                                                                       | Workspace SSR/hydration/isolation and affected packed SSR/renderer atoms. Concurrent request/policy isolation, initial DOM parity, no hydration errors and no public authoring delivery. Keep host/browser controls meaningful.                                                                                |
| G03a / P2 — cold-route timing lead             | #677: bounded local investigation completed; historical 30s stall not reproduced. Retain the existing deadline/window and new start evidence; maintainer-owned hosted diagnosis remains unresolved (SI-75.4 below).                                                        | Reproduce under controlled cold conditions or retain owner/needed evidence. Distinguish page event-loop delay from SSR success; no blanket timeout/retry/skip changes. Hosted evidence needs separate authorization.                                                                                           |
| G04 / P1 — recipe/host gate coverage           | #678: implemented the SI-75.5 mapping and exact renderer recipe inventory/output checks below; the existing graph already gates joined S1–S6 fixtures.                                                                                                                     | Build/typecheck plus relevant packed public-import, browser/SSR behavior and collector outcomes. Future #78 showcases remain outside this proof.                                                                                                                                                               |
| G05 / P1 — affected admission                  | #695: graph-derived base/head selection before runner/worker allocation, especially root Nest/macOS jobs; conservative fallback and shared-config handling.                                                                                                                | Local representative selection cases from the admission contract, followed by separately permitted hosted evidence if needed. Selected missing/failed/cancelled work must fail; intentional unaffected skips must not deadlock protection.                                                                     |
| G06 / P1 — whole-family cache/failure contract | #679: reconcile all 105 atoms after preceding changes, workspace/browser inputs and shared outputs, required collectors, restore/invalidate and failure/cancellation behavior.                                                                                             | Local cold/warm, clean output restoration, changed source/lock/runtime/env invalidation; absent/corrupt/stale/failed records fail collection. Reuse still-valid #687 evidence and fix demonstrated omissions; retain explicit uncached exclusions.                                                             |
| G07 / P1 — remote/DTE exceptions               | Community maintainers through #679: current authoring custom/persistence remote restoration/scheduling/failure evidence; renderer transport/relocation and actual distribution. Same-run source/path/platform limits and cold/warm/resource-cost evidence remain explicit. | Separately authorized existing-run inspection or bounded validation must prove worker prerequisites/order, failure propagation, equivalent complete artifacts and remote reuse. Otherwise retain reason, owner, revisit condition and unresolved acceptance gate. No capacity increase or paid run is implied. |
| G08 / P1 — required-check coverage             | #696 after #695/#679: reconcile current `main`-only rule with the final aggregate check; identify bypass integration and preserve accepted safeguards.                                                                                                                     | Concrete current/proposed settings diff, authorized application and effective read-back including inherited rules. Missing permission/evidence leaves the gate open. Do not silently invent approval counts or weaken signature/history requirements.                                                          |
| G09 / P1 — exact integrated candidate          | #680: all predecessor slices plus #695/#696 merged, joined scenarios complete and exceptions disposed of explicitly.                                                                                                                                                       | Exact commit and all required CI outcomes via provided or separately authorized evidence, final archives after writers, recipes/licenses/exports/peers, locks and support matrix. Update #75; hand #76 fresh release-history and final release-commit gates.                                                   |

Sequence remains **#674 → #675 → #676 → #677 → #678 → #695 → #679 → #696 → #680
→ #76 → #651**. Start each slice only after predecessor merge and maintainer
instruction. Parent #650 closure and upstream outreach are not release prerequisites.

## Reproduction and inventory validation

Read-only inventory commands (no tests, workers or CI monitoring):

```sh
yarn nx graph --print
yarn nx show project editorjs-angular-e2e --json
yarn nx show project editorjs-html-angular --json
node apps/editorjs/angular-e2e/tools/packed-targets.mjs
node packages/editorjs/html-angular/tools/packed/run.mjs targets
gh api repos/anarchitects/anarchitecture-community/branches/main/protection
gh api 'repos/anarchitects/anarchitecture-community/rulesets?includes_parents=true'
gh api repos/anarchitects/anarchitecture-community/rules/branches/main
```

The two Node commands list atom names only. Classic protection's observed 404
must be read alongside the effective rules, not interpreted alone. Local graph
reads used Nx23.2.1/Yarn4.18.0/Node24.22.2 with daemon/plugin isolation/cloud off;
an isolated temporary workspace-data directory avoided contention with an
existing editor graph process without resetting that process or its data.

Future local validation uses the existing Nx entry points: package
`run-many -p <affected projects> -t build typecheck lint test`; authoring
`editorjs-angular-e2e:e2e`, `test-ssr`, `e2e-hydration`, `e2e-isolation`,
`e2e-packed` and `e2e-packed-ssr`; renderer preparation, inferred targets and
collector as documented in the [packed reproduction](editorjs-html-packed-validation.md#reproduction-and-results).
Fresh installs remain outside cached/distributed invocations. Consult resolved
targets before choosing focused phases and use unique run IDs; commands above
are not evidence that those tests were executed for #674.

This inventory was checked against the resolved target counts, source paths,
matrix/phase functions, workflow and effective rules. Formatting, local links and
whitespace validation accompany the PR. No runtime/test/CI/settings change,
publication, new compatibility claim or automatic next-slice work is included.

## #675 neutral contract validation

5 November 2026, starting from merged #674 at
`df457e273c9b2cf869bbf9feca7c34a1d2f7db62`. G01 is implemented by the
[packed persistence consumer](../packages/editorjs/html/tests/persistence-consumer.mjs)
and its [archive/DOM harness](../packages/editorjs/html/tools/persistence.mjs),
called by the existing renderer `packed-smoke` target and all four existing
headless atoms. No new target, package, dependency, runtime behavior, supported
version or public export is introduced.

All nine local and eighteen Meta ADRs were enumerated and read again, including
proposals and historical sections. The clean Meta checkout matches the fresh
remote tree `47e75544673037d25665c8c9305c809802b58261`. Core development,
persistence design/recipes, renderer contracts and Modern Angular index,
repository application, architecture, testing/migration and validation guidance
were reviewed for neutral composition and packed evidence. Community0004/0008,
Community0007/Meta0013 and Meta0015 remain the relevant constraints; no conflict
or policy exception was identified. No Angular implementation is changed.

### Observable regressions covered

| Scenario  | New joined proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1/S2     | Explicit save through the public neutral coordinator with a deterministic driver; actual archived raw/record codec writes and reloads; detached common blocks, nested ordered/check lists, quote, configured aliases, Callout/Marker, FlagTune and literal Code reach the installed renderer. Unknown JSON and optional provenance survive; input mutation cannot alter stored bytes. Chromium checks the resulting semantic DOM, ordered counters, checklist accessibility, attribution, image alt/caption and escaped Code. |
| S2        | Unknown third-party blocks/tunes survive permissive structural storage but fail strict rendering without HTML; preview omits the whole offending block with diagnostics. Core block validation does not implicitly validate tunes. Archived migration data retains its unknown `review` tune, requiring explicit validated nonvisual registration.                                                                                                                                                                            |
| S3        | Missing/blank alt remains valid saved data but fails strict rendering; preview retains other blocks and omits the image. Repeated writes with deliberate empty or authored literal alt recover rendering. Chromium checks actual alt attributes separately from captions.                                                                                                                                                                                                                                                     |
| S4        | Invalid structural values fail before storage invocation; corrupt reads reject. Unsupported schema, migration collision, unauthorized save, stale revision and failed write preserve the acknowledged record and its renderability. Retry recovers without consuming a failed revision. Legacy service load renders the migrated candidate without writeback.                                                                                                                                                                 |
| S4 safety | Successfully stored inline script content still fails strict rendering without HTML. Preview exposes diagnostics and safe DOM without leaking payload text through diagnostics. Stored third-party callback output enters the same safety boundary. A restricted renderer instance remains restricted after a separate permissive call.                                                                                                                                                                                       |

The general codec owns the common/alias/image round trips. The shipped Notebook
service deliberately admits only its documented paragraph/Callout editing profile;
tests do not broaden it into a universal storage API. The migration checks reuse
the archive's explicit source/destination fixtures. All eight neutral recipe
files are extracted with duplicate/missing-file assertions, and declarations are
compiled with strict NodeNext and Bundler resolution, ES2022-only libraries and
no framework/DOM ambient types. Runtime imports occur after browser-global traps
are installed; Angular, Forms, Nest, Nx and Editor.js cannot resolve in that
consumer. Only core and HTML are installed as direct runtime packages.

This is neutral save-driver and persistence composition, not real editor typing
or Angular display recovery. #676 still owns the actual authoring/Forms and both
Angular surfaces for S1–S5; #677 owns SSR/hydration S6. #678 owns a shipped joined
recipe and its gate coverage. Existing core parser/registry/resolver, tool,
upload cancellation/error and renderer security suites remain authoritative;
this slice reuses them instead of duplicating their case matrices. The existing
browser adversarial corpus and execution/network negative controls still run.

### Validation and evidence identity

Local Nx validation uses Cloud disabled. The eight neutral projects' build,
typecheck, test and lint targets pass. `editorjs-html:packed-smoke:browser` passes
on Node 24.22.2/macOS arm64 with Chromium 156.0.8078.4: eleven joined tests in each
declaration mode, six resulting DOM cases, the existing 756 adversarial route
executions and 30 semantic omissions. Those are executions of shared cases,
not separate unique coverage claims.

Run `si675-neutral` then passed four fresh preparations and all four cold
headless atoms on Node 22.12.0, 22.22.3, 24.15.0 and 26.0.0. Each cell ran both
declaration modes, all eleven joined cases, six resulting DOM cases and the
unchanged adversarial corpus. Report file hashes were independently verified.
The reference atom subsequently hit local cache (1/1), restoring all four removed
report files byte-for-byte. Preparation and result artifacts are under
`dist/editorjs-renderer-inputs/si675-neutral` and
`dist/editorjs-renderer-results/si675-neutral`; they are not committed or shipped.

| Evidence                  | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| Renderer source identity  | `a1c2acc051b2965f10faa9e92607baf854b2829187cd9789f6897a706616cd19` |
| Core archive (all cells)  | `af9c399df59a106dc03a03dca40c91a524afb2fc404b25a0f0ad9d0cb1867c22` |
| HTML archive (all cells)  | `78bde900a0211b3c04ad7985daedbf57b4b6c8853424969285d43429afae35e8` |
| Consumer lock (all cells) | `4f0d42ac31ca9a9ffc800bf545b6b9ac0223d5c480ff8d63da0f17f9fafd2559` |
| Floor snapshot            | `cc41375027d3bdb3eb9a13ab10f736e51148c62399b29d5a8095a57886db0ce1` |
| Minimum snapshot          | `ddda944bd03a69cf9f1cc1a0e8e168bb8d83cdea62c7f2f6c77c16c0511fa241` |
| Reference snapshot        | `51e5b00890b08380c0cdf83a25bf3f95f31037473802434de83ed53cda53fe66` |
| Current snapshot          | `021cd1b642f9074ec157b408e14e0b34813642278d23ca17daf785e1769d93b7` |

The unchanged archive identities confirm that this increment changes validation,
not the distributed package payload. Actual archive README/license equality,
exports, absent source/tests, declaration modes and framework-free installation
remain enforced by the existing packed harness; the joined harness additionally
checks the two shipped core guides against source.

The initial local sync check reproduced the documented unrelated Nest CJS/ESM
reference discrepancy. Generated unrelated edits were reverted; the scoped
commands use the existing `--skipSync` workaround after inspecting the affected
Editor.js references. No bypass is added to CI or workspace configuration.
One fixture import initially confused lazy-edge analysis, and the first DOM
selector incorrectly selected quote attribution as image caption; both test
harness defects were corrected before final validation. No product defect was
reproduced.

Fresh release history returned npm 404 for HTML, no remote Editor.js release tags
and no Editor.js distribution among all 102 GitHub Releases. The exact scope
remains `editorjs-html` with non-bumping `init` intent and manifest 0.0.1. #76 owns
publication and final release-commit gates.

Reproduction (use a new run ID for every preparation):

```sh
export NX_NO_CLOUD=true
export EDITORJS_RENDERER_RUN_ID=si675-neutral
yarn nx run-many -p editorjs-core,editorjs-tool-paragraph,editorjs-tool-header,editorjs-tool-list,editorjs-tool-quote,editorjs-tool-image,editorjs-upload-fetch,editorjs-html -t build,typecheck,test,lint --parallel=3 --skipSync
yarn nx run editorjs-html:packed-smoke:browser --skipSync
yarn nx run-many -p editorjs-html-angular -t packed--headless-floor--prepare,packed--headless-minimum--prepare,packed--headless-reference--prepare,packed--headless-current--prepare --parallel=2 --skipSync
yarn nx run-many -p editorjs-html-angular -t packed--headless-floor--headless,packed--headless-minimum--headless,packed--headless-reference--headless,packed--headless-current--headless --parallel=2 --skipSync --runId=si675-neutral
```

Fresh preparation stays uncached; deterministic atom inputs already include all
core/HTML source, guides and test tooling in the snapshot identity and `default`
inputs. Summary evidence now records recipe hashes, declaration-mode counts and
DOM results. Existing complete-file hashing protects these reports. The full
sixteen-atom collector is not a partial-neutral-matrix acceptance gate.
No CI results were inspected, no hosted run/monitoring was started, and no remote
cache/DTE or integrated-candidate acceptance is claimed. G02–G09 remain open.

## #676 browser composition

5 November 2026, starting from merged #675 at
`131522cf80a1ea3a68ea80059bbfb4f52ba84913`. The full nine-record Community and
eighteen-record Meta ADR inventories reviewed for #675 were re-enumerated and
verified unchanged; Meta still matches remote
`47e75544673037d25665c8c9305c809802b58261`. The Modern Angular provider, reactivity,
Forms, rendering and SSR guides supplement the preceding architecture/testing
review. Community0004/0008, the accepted native Forms decision,
Community0007/Meta0013 and Meta0015 apply without conflict. No new parser,
sanitizer, Forms facade, compatibility cell or public export is introduced.

### Joined browser proof and reproduced defect

The [composition observer](../apps/editorjs/angular-e2e/tools/composed-display.txt)
is a private packed fixture. It is compiled against installed public archives
and the actual extracted neutral codec. Guarded additions to copied hosts bind
explicit snapshots or loaded/acknowledged service records, never the live draft.
The observer keeps storage and display reload separate and compares component,
directive and headless results. It is not a newly shipped application recipe;
#678 still owns that deliverable.

The new Forms journey reproduced a shipped recipe defect: both load and successful
save reset the native form with the very same document object held by the
acknowledged record. Native tracking metadata then made that record fail strict
encoding. [The recipe](../packages/editorjs/angular/persistence.md#optional-native-signal-forms)
now passes a detached document from its existing neutral editing helper into
both resets. Raw editor snapshots, service records and renderer input retain
strict JSON validation; symbol omission remains limited to the native model
boundary. The browser checks fail before this fix and exercise both reset paths.
The same journey exposed a shared-reference error in the private Forms upload
host: it assigned its explicit persistence snapshot directly to the native model.
The model now receives a clone, leaving the captured snapshot strict-JSON-safe.
The new upload round trip reproduces the failure before that change in all three
Angular cells.

| Journey               | New joined observation                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1/S2 common          | Real paragraph, heading, list and quote edits reach both Angular surfaces after explicit save, codec storage and reload. Later unsaved input and a sibling editor do not change that display. A stored paragraph alias uses the configured public profile.                                                                                                                                                        |
| S2 custom             | Direct/provider Callout with Marker and FlagTune, plus literal Code, survives explicit save/storage/display. Both surfaces retain semantic markup and escaped Code. Reload/read-only/remount and module-delivery fencing reuse the existing cases. Native Forms also preserves Code's silent-edit refresh and explicit second-save requirement.                                                                   |
| S3 upload/alt         | Both standalone and native Forms owners distinguish pending upload, completed upload, explicit capture/submission, storage and display reload. Missing alt fails strict rendering and is omitted in preview; deliberate empty and authored literal alt recover while captions stay separate. Upload failure retains acknowledged display; held work after destruction cannot populate the fresh owner or sibling. |
| S4 persistence/safety | Existing failed writes, revision conflicts, retry, reload and async review now compose with display. Structurally valid stored unsafe markup produces diagnostics and no strict HTML; preview, corrupt reads and later valid replacements clear/recover both surfaces without stale success. Actual browser DOM and an execution sentinel accompany result equality.                                              |
| S5 ownership          | Held acknowledgement renders the captured snapshot while preserving the newer draft/dirty state. A new load fences the old acknowledgement. Destruction with held persistence produces a fresh owner with its own initial record. Native model replacement does not overwrite the explicit stored display or leak to a sibling.                                                                                   |

The existing Angular component/Forms/upload-owner suites remain authoritative for
creation, readiness, queues, operational versus validation errors and disposal.
The existing HTML Angular component/directive/provider suites cover signal
identity, nearest provider and explicit-input precedence, per-instance isolation
and notification teardown. The unchanged independent renderer consumer supplies
display-only dependency isolation and DOM/security negative controls. These are
reused proofs, not newly duplicated case matrices.

### Packaging, graph and remaining ownership

The four existing CSR phases carry the joined tests in all existing compatibility
cells, including the CSR phases of SSR snapshots. Preparations build and install
HTML/HTML Angular archives alongside authoring. The headless archive uses Yarn
packing to resolve its workspace dependency, matching the existing renderer
consumer. Neither production package gains a dependency on the other Angular
surface. The test project has an explicit renderer dependency and preparation
build prerequisite; shipped renderer inputs and observer sources join snapshot
identity. Fresh installs stay uncached, atoms keep their isolated outputs, and
the 105-target/89-atom authoring inventory is unchanged.

The fixture serves a real SVG asset with its correct content type rather than
using a data URL, which the renderer deliberately rejects. Nested packed SSR
copies relocate observer imports alongside the already extracted examples.
This preserves existing SSR preparation; #677 still owns the joined
SSR/hydration gap, including its idle-stall investigation. #678 owns the shipped
joined recipe, #695/#679/#696 retain admission/cache/protection work, and #680
retains the exact integrated-candidate gate. Local results do not establish
remote cache/DTE or CI acceptance.

### Local validation

With Nx Cloud disabled, Angular and HTML Angular build/typecheck/test/lint pass;
the affected authoring host build/typecheck/lint and e2e typecheck/lint/harness
checks also pass. The existing unrelated Nest reference-sync discrepancy remains
handled by scoped `--skipSync` locally, with no workspace or CI bypass change.

Run `si676-final2` prepared fresh CSR consumers for Angular 22.0.0/Node22.22.3,
22.1.4/Node24.15.0 and 22.2.2/Node26.0.0, plus the existing reference SSR consumer.
Each passed Forms-absent compilation/guarded imports before matched Forms
installation, followed by archived example compilation. All three CSR cells
passed `build-csr`, `interop` (40 tests), `csr-editor` (25), `csr-forms` (18),
`csr-upload` (10) and `csr-forms-upload` (18): 213 real-browser executions and
120 native interop executions across the cells. The reference SSR production,
diagnostic and full builds plus `hydration-registry` passed (24 tests). This is
focused regression evidence, not the complete 89-atom collector or new S6 proof.

The existing `editorjs-html-angular:packed-smoke` also passed, including seven
archived README examples, two server requests, both presentation APIs, scoped
providers and security negative controls. Run `si676-display` then passed a fresh
exact reference-cell preparation, build, corpus and isolation: the corpus reports
1,169 cases with two presentations and no errors; all four isolation routes and
the deliberate runtime-delivery negative control pass. Chromium was 156.0.8078.4
on macOS arm64. No timeouts, retries, security checks or compatibility cells were
relaxed to obtain these results.

All final authoring snapshots share source identity
`13ea87c9daea84f1c4eb48be3387a3be087953c8a989a4ffea4b1b461b27eacc`.
After build writers finished, every archive hash was checked, both Angular APF
archives were compared with final build files/manifests, and their README/license
plus the revised persistence guide were compared with source bytes.

| Archive      | SHA-256                                                            |
| ------------ | ------------------------------------------------------------------ |
| Angular      | `73768ba732a4f4ac84cb672d3333104f8d8ad6c3ebd39931318a06faa215a6b3` |
| HTML         | `78bde900a0211b3c04ad7985daedbf57b4b6c8853424969285d43429afae35e8` |
| HTML Angular | `ed72a5697a06367fbeb6022a288415ed81f1d93a36a42155aaf245f743bf7ab1` |

Artifacts remain under `dist/editorjs-packed-{inputs,results}/si676-final2`,
`dist/editorjs-renderer-{inputs,results}/si676-display` and
`dist/test-results/editorjs-html-angular`. Final result manifests were verified.
Fresh npm lookups returned 404 for Angular/HTML Angular, there are no remote
Editor.js tags, and none of the 102 GitHub Releases distributes Editor.js.
The exact public project scope is `editorjs-angular`, with non-bumping `init`
intent; manifests remain 0.0.1. No CI was inspected or monitored, no hosted job
was requested, and #677 has not been started. G02 is implemented; G03–G09 and
their separately authorized evidence gates retain their owners.

Reproduce the focused authoring matrix with a new run ID:

```sh
export NX_NO_CLOUD=true EDITORJS_PACKED_RUN_ID=your-new-run-id
for cell in angular22-minimum angular22-reference angular22-current; do
  yarn nx run "editorjs-angular-e2e:packed-csr-$cell-prepare" --runId="$EDITORJS_PACKED_RUN_ID" --skipSync
  yarn nx run-many -p editorjs-angular-e2e -t "packed-csr-$cell-interop,packed-csr-$cell-csr-editor,packed-csr-$cell-csr-forms,packed-csr-$cell-csr-upload,packed-csr-$cell-csr-forms-upload" --runId="$EDITORJS_PACKED_RUN_ID" --parallel=2 --skipSync
done
```

### #676 packed CI follow-up

The maintainer requested a one-off investigation of
[CI run 42005176287](https://github.com/anarchitects/anarchitecture-community/actions/runs/42005176287)
at `3468fc707ddcb16d5ff0b2cd7a0d533e2ce1bae7`. The packed DTE job executed all
89 atoms: 84 passed and five failed. The failures were in the validation harness,
not worker startup: two CSR Forms atoms in SSR snapshots and the three guarded
SSR atoms. This inspection does not authorize monitoring or hosted retries.

The Forms journey incorrectly expected a direct model replacement to clear an
already-dirty field. It now waits for the edit to reach native state, checks that
replacement preserves dirty state, then uses the actual reset action to prove
that reset clears it. Stored display remains independent throughout. No timeout
or retry change is involved.
The old test could pass before the debounced editor notification marked the field
dirty; observing both the field state and model removes that timing dependency.

The guarded SSR failure reproduced locally as HTTP 500 on the upload route.
The old provenance classifier forbade every `examples/notebook/` input,
including the neutral codec now sharing a chunk with the display observer.
The classifier now identifies emitted editor/tool implementations, including
both archived custom-tool directories. A regression covers neutral/shared
chunks, tool-bearing chunks and tree-shaken inputs. Negative import controls
now attempt every emitted copy of Callout/Marker/FlagTune/Code, including both
notebook and custom recipe copies, rather than only the first matching chunk.
The runtime import hook, browser-global guards and request-isolation assertions
remain enforced.

The complete ADR inventories were checked again and remain unchanged from the
review above; Meta0015 and the Forms/SSR/testing guides govern this correction.
Only validator/test code and this evidence record change; consumer snapshots
remain valid, while the project-default task inputs invalidate their test results.

Local validation with Cloud disabled and `CI=true` passes the guarded `ssr` and
`csr-forms` atoms in all three SSR cells (54 browser tests total), including all
emitted custom-tool import negative controls. Minimum/current SSR snapshots were
prepared fresh; reference reused its unchanged snapshot. The focused harness,
lint and typecheck pass, and all six final atom evidence manifests were verified.
No hosted rerun or ongoing monitoring was requested; this is a local correction
on PR #702, not a claim that the subsequent CI run has passed.

## SI-75.4 SSR, hydration and delivery composition (#677)

Reviewed 2026-11-05 from merged baseline
`19def4e5be20612ccaff818d68cc04f63cbb6967`. Re-enumerated and read all 18 Meta
ADRs at `47e75544673037d25665c8c9305c809802b58261` and all nine local ADRs,
including proposed and historical material. Read the Modern Angular index,
repository application, architecture, providers, reactivity, Forms, rendering,
SSR, testing and validation guides. Applicable constraints remain Community0008
(normal Angular binding, independent renderer, strict/preview and alt semantics),
Modern Angular A03/A07/A09/A10 (scoped state, native Forms, hydration and actual
consumer evidence), Community0004/0007 and Meta0013/0015 (packed documentation,
non-bumping initialization, accurate inputs/outputs). Meta0008/0009/0010 and
Community0005/0006 preserve the existing Nest 12.3.2 native Node reference and
Fastify support; no adapter or version changes are made. No accepted decision
conflicts with this slice; governance proposals remain proposals.

### Joined coverage

- The existing packed SSR host gains a private lazy `/display` route. It passes
  saved common/aliased/custom/Flag/Code/image data through the same archived
  `encodeRaw`/`decodeRaw` codec and `PackedDisplay` used in #676. Both Angular
  surfaces are checked before bootstrap and after hydration against headless
  results, including literal Code, ordered-list metadata, separate caption and
  authored/decorative alt. Server checks interleave request markers, verify
  independent output and observe actual request-owner destruction with zero
  editor loader/construction calls.
- The display journey checks the emitted production closure, network requests,
  executed modules, styles and owner probes before authoring. The fixture's
  existing upload provider override now lives in its lazy upload route instead
  of pulling the authoring Angular adapter into the public entry. Its override
  behavior is retained. After actual authoring/edit/disposal, returning to the
  display must show stored content, no unsaved draft and no new authoring fetch.
  Existing runtime preload and eager runtime/tool/style controls remain active.
  This fixture change is not a new public host or package API.
- Archived standalone and native Forms notebook hydration now checks the empty
  prehydration display, the loaded record, unchanged display during unsaved edits,
  acknowledged save output and fresh record after owner disposal/re-entry.
- The independent renderer consumer extracts the real shipped core persistence
  codec, verifies its source against the guide and renders detached stored data
  under its existing request/route/element/instance policies. It still installs
  no authoring packages or Forms requirement. Existing CSR, SSR and prerender
  behavior, updates and failure recovery remain in their original atoms.
- The existing 1,169-case semantic/security corpus now also runs at
  `/corpus-server`, without creating another compatibility matrix or copying the
  corpus. Bootstrap scripts are held while the test compares both parsed SSR
  surfaces with headless results, then released to check the same meaning and
  retained renderer hosts/containers after hydration. Browser errors, hydration
  warnings, execution sentinels and unexpected requests fail the check. Existing
  semantic and missing/authored/decorative-alt controls remain. HTML, browser
  request/error records and traces are retained for each CSR/SSR corpus route.

### Local evidence and limits

Renderer run `si677-ref` completed all **16 existing atoms** in all seven exact
cells and the uncached completeness collector. Four headless cells cover Node
22.12.0, 22.22.3, 24.15.0 and 26.0.0. Three Angular cells pair 22.0.0/22.22.3,
22.1.4/24.15.0 and 22.2.2/26.0.0. Each Angular cell passed build, behavior, corpus
and isolation, including the deliberately imported real authoring/runtime/tool
negative control. Each corpus route checks 1,169 cases and two surfaces; SSR
parity additionally compares prebootstrap and hydrated DOM. Actual Chromium was
156.0.8078.4. Renderer source identity:
`d0efda3f1d56a336dc3b928368adbbc7cd613917ef571d0623d39ed785d2f91d`.
Evidence: `dist/editorjs-renderer-results/si677-ref/complete.json` and the per-cell
records, locks and artifacts under `dist/editorjs-renderer-inputs/si677-ref`.

The reference corpus output directory was moved aside, then restored by an Nx
local cache hit, including both new traces and HTML records. The uncached
collector subsequently verified all sixteen artifact manifests. This is local
cache evidence, not remote reuse or hosted distribution proof. The new packed
`display-page.txt` is explicitly included in authoring preparation's source
fingerprint; normal task inputs include changed assertions and validators.
Fresh preparations and collectors remain uncached; no task/worker count or
hosted orchestration changes are introduced.

Local lint, type checks and both packed-harness targets passed. Package builds
used by preparation passed. Authoring's final three-cell SSR/hydration evidence is
recorded below. Workspace browser/SSR runs are distinct from
these actual packed consumers; neither the full 89-atom authoring collector nor
new Nest/HTTP/browser support is claimed.

The local Nx coordinator briefly stalled before task execution while its native
`getDefaultMaxCacheSize` probed mounted volumes. A stack sample identified
`sysinfo`/`CFURLCopyResourcePropertiesForKeys`/`getattrlist`, and the local system
reported an unavailable SMB backup mount. Only this task's stalled processes
were stopped. `NX_MAX_CACHE_SIZE=10GB`, verified against installed Nx 23.2.1,
avoided that probe. This session-only setting does not disable caching, alter a
test timeout or change repository/CI configuration. Keep it separate from the
historical browser idle investigation.

Fresh npm reads returned 404 for core, authoring Angular, HTML and HTML Angular;
remote Editor.js tags were absent and none of 102 GitHub releases was Editor.js.
Use non-bumping `init` with an exact Nx project scope. No publication, merge,
CI inspection/monitoring, hosted retry or capacity change is authorized by this
record. #678 remains the next maintainer-started slice.

### Final authoring run and bounded idle disposition

Run `si677-final` used three fresh SSR preparations. All **42 selected atoms**
passed: four build profiles, guarded SSR, all eight hydration files and isolation
in each existing cell. This includes **750 browser executions** (250 per cell),
all existing eager/deferred/incremental Forms-absent/present journeys and their
failure/disposal controls. The server import hook rejected all emitted custom
Callout/Marker/Flag/Code copies used as negative controls, while the stored
display and neutral codec remained importable. All 42 retained artifact
manifests were independently verified. This is focused SSR/hydration evidence,
not the whole authoring collector or a claim about subsequent hosted CI.

Reproduction uses the existing `editorjs-angular-e2e:packed-ssr-angular22-<cell>-<phase>`
targets with `--runId=si677-final`, `EDITORJS_PACKED_RUN_ID=si677-final`,
`CI=true`, `NG_BUILD_MAX_WORKERS=2` and `NX_NO_CLOUD=true`. Prepare each of
`minimum`, `reference`, `current` first. Selected phases are `ssr`, `isolation`,
`hydration-common`, `hydration-registry`, `hydration-standalone`, `hydration-forms`,
`hydration-upload`, `hydration-forms-upload`, `hydration-deferred` and
`hydration-forms-deferred`; Nx adds their four build prerequisites. A future
source change requires a fresh run ID/preparation. The existing unrelated Nest
project-reference sync discrepancy was kept outside this slice with the scoped
`--skipSync` used in preceding validation; no reference files were rewritten.

Authoring source identity:
`82c73b532d2f2116aeb23212f7620cd753ea12016e539c07f3e9c60780fa75f6`.
Actual archives retain their #676 hashes, because this slice changes private
consumers/assertions and contributor evidence, not shipped implementation:

| Artifact                | SHA-256                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| Authoring Angular       | `73768ba732a4f4ac84cb672d3333104f8d8ad6c3ebd39931318a06faa215a6b3` |
| HTML                    | `78bde900a0211b3c04ad7985daedbf57b4b6c8853424969285d43429afae35e8` |
| HTML Angular            | `ed72a5697a06367fbeb6022a288415ed81f1d93a36a42155aaf245f743bf7ab1` |
| Minimum consumer lock   | `3a174643c87892098474ed1c6ca6f5142dd669d81df84a4f22909e6818f0a0c1` |
| Reference consumer lock | `258484eea1c5b9a8d10977227e8aa5d545172d60cb3333e0109a809fcbf094ea` |
| Current consumer lock   | `bbecd7c86790a4365fa5793f12bdde93c0ee7dda353a090593013204f82c84d3` |

Evidence lives under `dist/editorjs-packed-inputs/si677-final/ssr` and
`dist/editorjs-packed-results/si677-final/ssr`, including snapshot/archive/lock
identities, server HTML/lifetime logs, build provenance, browser reports and
attached delivery/execution/idle records. Preparations verified the actual packed
READMEs/licenses and extracted recipes. No workspace-source substitution is used.

**G03a disposition: not reproduced locally; hosted cause remains unresolved.**
The current helper already supplies a 1,000ms idle deadline and retains a separate
1,000ms observation window between callbacks. No timeout, retry, skip or
activation-policy change was made. A new `idle-start` attachment records URL and
wall-clock time before the awaited browser evaluation, so a future stall retains
evidence even if its completion attachment cannot be produced.

In the final run, `/` and `/sample/public` are still the first two tests of each
isolated packed isolation worker. All six cold-load/client-navigation tests
passed in **2.273–2.450s**. Across all three isolation suites, **138 idle callbacks**
completed; three used the existing deadline (one in each new stored-display
journey, **1000.5–1000.7ms**), and the other callbacks reported ordinary idle
completion. This proves the current bounded path ran, not the cause of the
historical 30s `page.evaluate` stall. The six original cold-route journeys,
preload-without-evaluation and eager-evaluation negative controls all passed.

Community maintainers retain ownership of the hosted lead. Reopen causal
investigation if it recurs, using the exact commit/cell/worker/runtime, retained
Playwright trace, `idle-start`/completion records and worker/event-loop evidence.
Server `data-rendered=true` alone cannot prove browser scheduling health. A
separately authorized inspection is still needed for hosted evidence; local
success does not classify the earlier failure as fixed, environmental or flaky.
G03 is implemented; G03a has this bounded unresolved disposition. #678 and the
remaining cache/admission/protection/candidate gates stay in their established
sequence.

## SI-75.5 existing host and recipe gates (#678)

Reviewed on 5 November 2026 from #677's merged baseline `4a4c166`. The resolved
Nx graph and checked-in CI commands already select every existing host above,
including the minimal joined fixtures. This slice strengthens recipe validation;
it does not add a duplicate matrix or a new showcase. Hosted CI was not inspected
or rerun. CI wiring below describes checked-in execution, not a green hosted run.

### Install-to-result mapping

Packed target names use `editorjs-angular-e2e:packed-<mode>-angular22-<cell>-<phase>`
for authoring (`cell`: minimum/reference/current). Renderer names use
`editorjs-html-angular:packed--<cell>--<phase>` (`cell`: four `headless-*` and three
`angular-*` cells). The existing target selectors request every required atom;
build dependencies are supplied by Nx, not duplicated by this table.

| Consumer path                                                                                      | Build/type/dependency proof                                                                                                                                                                              | Interaction proof and CI owner                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace editor and optional native Signal Forms; upload variants                                 | Host `build` and `typecheck` in `main`; `e2e` depends on package/host builds                                                                                                                             | `editorjs-angular-e2e:e2e` and `editorjs-upload-fetch:test-browser` in browser job; real edit/save/focus/dispose and controlled HTTP/abort behavior                                                                                                                                                                                                               |
| Workspace public/authoring SSR, prerender, deferred/full/incremental Forms/upload routes           | `build-ssr` compiles server/browser templates; `build-hydration` and `build-isolation` supply matching variants                                                                                          | SSR job's `test-ssr`, `e2e-hydration`, `e2e-isolation`; serial workspace ownership, request isolation, pre-hydration and delivery controls                                                                                                                                                                                                                        |
| Core README and custom Callout/Marker/Flag/Code recipes                                            | Packed `prepare` checks archived assets; `portable` compiles public imports in an Angular-free consumer, `interop` verifies Angular consumption                                                          | All CSR cells in packed DTE job; real browser interactions and literal Code/alias/tune behavior                                                                                                                                                                                                                                                                   |
| Neutral raw/envelope persistence, migrations and service composition                               | Core `test` in main/neutral-floor jobs checks installed guides; packed preparation requires the eight named persistence/service sources; `portable` compiles NodeNext/Bundler with no ambient frameworks | Packed `portable` runs saved-data/service behavior, including Node 22.12.0 in reference cell; the independent Nest application-context test is DI proof only, not an HTTP persistence endpoint                                                                                                                                                                    |
| Angular README default/full recipes and optional Forms                                             | Packed extraction checks shipped sources and Forms-absent module evaluation; SSR `readme-default` and `readme-full` compile independent consumers                                                        | All three packed SSR cells run real server/browser recipe checks; ordinary/full hydration remain distinct                                                                                                                                                                                                                                                         |
| Notebook editor and Forms save/load plus private joined display                                    | Packed `build-csr` includes exact installed core/Angular persistence sources and private `PackedDisplay`; SSR builds include notebook/display routes                                                     | `csr-editor`, `csr-forms`, `csr-upload`, `csr-forms-upload` select `persistence/cases.ts` and `display-cases.ts`; SSR `ssr`, `hydration-*`, `isolation` select stored display and notebook cases from #677. Invalid/unsafe replacement clears display, draft edits do not replace acknowledged stored content, informative/decorative/missing alt remain distinct |
| Native Node and Fastify upload references                                                          | Installed `upload-fetch/nest-example.md`, exact Nest 12.3.2 dependencies and independent build                                                                                                           | Reference CSR `nest-upload-node` and `nest-upload-fastify` in packed DTE job; controlled local HTTP reference hosts, no deployed service or credentials                                                                                                                                                                                                           |
| Headless README quick start, preview, list/image, configuration, alias, custom block/tune          | Four renderer `headless` atoms compile all six exact named files under NodeNext and Bundler; installed README/LICENSE/dependencies/exports compared with intended artifacts                              | Execute every example and assert its observable result, including escaped Code and image alt. Existing guarded imports, browser corpus and dependency checks prove authoring/Angular absence. SSR job selects all four cells                                                                                                                                      |
| Angular renderer component, preview, directive, element/route configuration, browser/SSR bootstrap | Each renderer `build` compiles all seven exact named README files with strict Angular templates, then builds the independent application                                                                 | Each cell's `behavior` exercises component/directive/provider states and CSR/SSR/prerender/hydration; `corpus` checks both surfaces against headless on CSR and server routes; `isolation` rejects authoring delivery with a real negative control. SSR job selects all three cells                                                                               |

The composed fixture is intentionally private. It combines archived public-import
recipes with a test observer, rather than advertising a newly shipped blog/demo.
The existing headless persistence consumer also extracts the installed core codec;
renderer SSR uses that same archived codec. No source alias replaces a package
inside these independent installations.

The optional Nest service recipe in core's `service.md` is extracted by
`nest-persistence.mjs` and executed by the reference CSR `nest-upload-node` atom
after its HTTP upload checks. Its separate application context proves DI and
service behavior; only the upload reference exposes a tested HTTP endpoint.

### Missing-asset and failure enforcement

Headless extraction previously accepted any nonempty set of TypeScript fences;
Angular extraction accepted seven matches even when a duplicate silently replaced
a file. Both now require the exact named inventory before writing sources. Empty,
missing, renamed, duplicate and unmarked recipes fail. The renderer harness tests
mutate every required file and include the duplicate-at-the-same-count case.
`packed-harness-test` is already a dependency of every fresh renderer preparation;
its inputs now include the shared headless extractor and README it reads.

The six headless examples additionally check expected rendered values in both
module-resolution modes, rather than treating a successful Node exit alone as
proof of their documented result. Packed reports retain recipe filenames alongside
the existing count. Strict rejection/preview, URL/HTML safety, alt policy and
custom callback sanitization remain covered by the existing adversarial/corpus
and joined behavior suites; no safety relaxation or compatibility change is made.

A failed compile/assertion makes its Nx atom fail. Authoring `packed-results.mjs`
and renderer `packed-collect` require complete, matching file manifests and reject
missing, failed or corrupted evidence; the ordinary job result also preserves
failed prerequisite/worker outcomes. Existing seven-day artifact uploads retain
build/process logs, SSR HTML, browser diagnostics and traces. Fresh installation
stays uncached, deterministic outputs stay isolated by run/cell/phase, and local
cache success is not evidence of hosted restoration or DTE equivalence.

All future public basic-editor, Forms, SSR and Nest-upload showcases remain #78.
Before advertising one, provide its own owner, public imports/assets, exact
compatibility cells, Nx build/typecheck and appropriate interaction/SSR gate,
failure artifacts, isolated resources and graph dependencies for admission. No
nonexistent route or future Bricks/FitOverForty adoption is reported as tested.

### Architecture and local validation

Preflight enumerated/read all 18 canonical Meta ADRs at `47e7554` and all nine
Community ADRs, plus the Modern Angular index, repository application and relevant
architecture/provider/reactivity/forms/rendering/SSR/testing/validation guides.
The adjacent Meta branch `d465ea1` adds 0016–0020; these were also read, with their
“effective when the adopting PR is merged” condition respected. They were not on
canonical main during review. No accepted decision conflict was found.
Community0004/0008 govern packed documentation and safe neutral/Angular rendering;
Modern Angular preserves native Forms and SSR ownership. Meta0008–0012 and local
0005/0006 preserve explicit HTTP/neutral boundaries. Meta0013/local0007 require
fresh release history and non-bumping initialization; Meta0015 requires complete
inputs and honest local/remote evidence. Proposed governance models remain proposals.

Focused local reproduction (use a new run ID; preparation is immutable):

```sh
export NX_NO_CLOUD=true NX_MAX_CACHE_SIZE=10GB NG_BUILD_MAX_WORKERS=2 CI=true
export EDITORJS_RENDERER_RUN_ID=si678-recipes
# The harness runs automatically before each prepare; it can also run alone.
yarn nx run editorjs-html-angular:packed-harness-test
yarn nx run-many -p editorjs-html-angular -t packed--headless-floor--prepare,packed--headless-reference--prepare,packed--angular-reference--prepare --parallel=2
yarn nx run-many -p editorjs-html-angular -t packed--headless-floor--headless,packed--headless-reference--headless,packed--angular-reference--behavior,packed--angular-reference--corpus,packed--angular-reference--isolation --runId="$EDITORJS_RENDERER_RUN_ID" --parallel=2
```

The full CI renderer entrypoint remains `packed-prepare`, all targets emitted by
`tools/packed/run.mjs targets`, then `packed-collect`. The focused command above
intentionally does not satisfy that all-sixteen completeness gate. See preceding
SI-75.3/4 records for the unchanged composed fixture's full-matrix evidence.

Local results for `si678-recipes`: three fresh preparations and all **six selected
atoms passed** (two headless plus Angular reference build/behavior/corpus/isolation),
with no atom cache hits. The six harness tests passed, including recipe mutation
controls; both renderer lint/typecheck targets passed. Actual browser was Chromium
156.0.8078.4. Each headless cell ran all six archived examples in both resolution
modes, 756 attack cases, 30 omission cases and 22 neutral persistence checks.
Angular reference compiled all seven recipes and passed CSR/SSR/hydration and
provider checks with no errors, both 1,169-case corpus routes and isolation with
its authoring negative control.

Source identity: `c348ddaf6962baafe525245bed1f58f29297d48841f9841b6ee1b506c09022bf`.
Evidence is retained under `dist/editorjs-renderer-inputs/si678-recipes` and
`dist/editorjs-renderer-results/si678-recipes`, including exact archive/lock hashes,
recipe inventories, build logs, HTML, traces and result manifests. Local validation
used `NX_DAEMON=false`, `NX_ISOLATE_PLUGINS=false` and the existing narrowly scoped
`--skipSync` exception for unrelated Nest references. No workspace/authoring matrix,
additional platform, full renderer collector or hosted DTE outcome is newly claimed.

Fresh release-history checks on 5 November returned npm E404 for core, Angular,
HTML and HTML Angular; remote Editor.js tags and all 102 GitHub Releases contained
no Editor.js release. The two affected exact Nx projects remain in non-bumping
`init` development. No package version, dependency, public API or support claim
changes. #695 owns affected admission, #679 caching/DTE optimization, #696 main
protection, and #680 integrated acceptance; their remaining work is not completed
by this recipe gate review.

### CI follow-up: a stale expected value in the display assertion

The maintainer supplied a failure from
`packed-ssr-angular22-minimum-csr-editor`: 24/25 passed, with a repeat failure in
`persistence/cases.ts:114`. That line is **after Reload notebook**, where “Another
writer” is the intended result. The failure arose inside `displayResult`, before
its caller's text assertion: the helper captured the old headless “Retain on
failure” once, then polled updated Angular results against that frozen object.
The recipe awaits editor rendering before assigning its loaded record; observing
the editor's new text does not guarantee the display effect has already run.

A deterministic browser regression in `src/editor.spec.ts` uses real locators and
advances all result elements immediately after the first headless read. Against
the old helper it reproduced the same expected/received HTML and failure at
`display.ts:20`, without relying on load or sleeps. The corrected helper refreshes
all three results on each comparison attempt, within the existing five-second
assertion allowance. `displayText` waits for the requested surface text before
checking result parity. Draft/conflict expectations, product code, task retries
and test timeouts are unchanged; a persistent result mismatch still fails.

Local verification: regression failed before/passed after; e2e lint/typecheck
passed. Fresh minimum SSR preparation `si678-display-race` and its CSR build,
`csr-editor` (**26 tests**) and `csr-forms` (**18 tests**) passed, with no retries
or atom cache hits. Both retain the original stale-write test. Snapshot SHA-256:
`0ff8f9e196a1cfc8a6eba0e510b3db83dc220939eccfdac7a659487c6ad0f4dc`.
Evidence is under `dist/editorjs-packed-results/si678-display-race/ssr/angular22-minimum`.
This proves the assertion race and its correction locally; it does not claim a
hosted rerun or classify every possible persistence failure.

The follow-up preflight re-enumerated the ADR sources: all nine local records and
the original Meta records are unchanged from the earlier reading. Canonical Meta
is now `09d4fc8` with 24 records: 0016–0020 have merged, 0016/0018 were refined,
and new 0021 defines consumer applications/public upstream reuse. The changed
records were read in full and the testing guide rechecked. No policy conflict or
new application/shared-package boundary is introduced by this private test fix.

## SI-75.8 evidence: affected admission before runner allocation (#695)

Implemented against merged #678 (`8500efd`) on 5 November 2026. Preflight
enumerated both ADR sources and confirmed the full readings remain current:
24 canonical Meta records at `09d4fc8` and all nine Community records. Meta0015
governs affected admission, caching and DTE; Meta0008–0012 and local0005/0006
preserve Nest adapter/security/compatibility boundaries. Local0004/0008 preserve
the published Editor.js validation contract. No accepted decision conflicts were
found. Proposed records do not override accepted decisions. This changes private
CI configuration, not package versions, public APIs or advertised support.

### Admission and dependency ownership

The workflow now has ten job definitions: the original eight workloads (the old
`main` workload is named `workspace`), an initial Ubuntu `selection` job, and a
final Ubuntu `main` aggregate. Full admission expands to fourteen runners, versus
the previous twelve. Selection runs before any workload job or packed DTE worker
is allocated. Job-level `if` conditions also gate both existing Nest matrices;
the macOS case-insensitive guard-bypass proof and all compatibility cells remain.

`tools/ci/selection.mjs` maps job IDs to Nx project owners, not package-path
filters. Neutral baseline owns its eight neutral packages; Better Auth owns its
adapter; browser owns authoring e2e/upload-fetch; SSR owns authoring e2e/Angular
renderer; packed owns authoring e2e. Nx follows the actual dependency graph to
select consumers. The general workspace job runs `nx affected -t lint test build
typecheck` for a verified PR comparison, and retains the complete existing
`run-many` invocation for broad runs. Its Nest split and Better Auth integration
steps follow the same family admission as their compatibility jobs.

The root project owns all four Nest consumer-lifecycle/consumer/matrix/split
targets and the aggregate release wrappers. It now explicitly depends on the
Nest package, CJS/ESM consumers and both split fixture projects. This models the
files copied by the root validators, including the frontend without a package
import. Root-owned security scripts, compatibility JSON and split shared config
therefore select Nest verification. Root release/governance wrappers remain
explicit manual release gates, outside the ordinary workflow.

Root ownership is deliberately conservative: unrelated root documentation/tooling
can also select Nest checks. It does not propagate unrelated Editor.js package
changes into that family. #679 owns revisiting finer target ownership if measured
overhead warrants it; narrowing must preserve the tested fixture dependencies.

Nx `sharedGlobals` now includes CI and worker configuration, admission tooling,
root package/lock/package-manager files, root TypeScript/lint/test configuration
and Git/Nx ignore rules. These are real common validation inputs and select broad
verification. Nx still handles project definitions, source ownership and transitive
dependencies. No separate package-path matrix is maintained in the selector.

The Python governance host's test target makes its existing default/dependency
inputs explicit. Nx's affected locator only expands declared target inputs; that
project previously missed shared CI changes even though task hashing used default
inputs. The graph regression requires **all 28 projects**, including the Python
host, for shared configuration changes. Local0001/0003 governance boundaries are
unchanged; this is validation metadata, not a package or runtime change.

### Git comparison and fail-closed result

Selection checks out full history. PR base is the event's exact base SHA; head is
`GITHUB_SHA`, the actual checked-out candidate merge commit. Both base and PR
source head must be valid, available commits ancestral to that checkout. Shallow,
missing, zero/invalid or unrelated revisions and checkout mismatch fall back to
all required jobs. A failed affected query also selects all when the complete
project inventory is available. Broken graphs, missing expected projects and
invalid output fail selection; they never produce a green empty result.

Main pushes verify `event.before`/`GITHUB_SHA` when available but retain full
integration validation: the previous push is not proof of a successful baseline.
This avoids silently omitting earlier failures or querying hosted run history.
First pushes and unavailable history use the same broad fallback. `merge_group`
is supported with full validation if a merge queue is enabled later; no repository
queue setting is changed. Release workflows and release gates are unchanged.

The required check identity remains **`main`**. It runs with `always()` and needs
selection plus every workload, including both complete matrix results. A valid
selection and success for every selected job are required. An unselected job must
be `skipped`; selected skipped/failed/cancelled/missing jobs, failed selection,
malformed plans and incomplete dependency lists fail the aggregate. Missing the
aggregate itself cannot supply a successful required context. The workflow tests
also require every workload to have an admission condition and an aggregate edge.

#696 must reconcile this exact check identity with effective protection and its
integration ID, then apply/read back any authorized settings changes. The dated
#674 protection inventory above is unchanged; no new protection inspection or
mutation was performed here. This implementation addresses the earlier G08
independent-success problem but does not complete #696.

### Local verification and remaining evidence

Run the focused gate through Nx:

```sh
NX_NO_CLOUD=true NX_DAEMON=false NX_MAX_CACHE_SIZE=10GB \
  yarn nx run @anarchitecture-community/source:test-ci-selection
```

The gate exercises actual installed Nx graph selection, temporary Git histories,
fallback paths, aggregate outcomes and workflow wiring/YAML syntax. It is uncached
because it verifies the current graph and Git environment; no hosted cache/DTE
claim follows from it. #679 owns reviewing that exclusion if selection overhead
becomes material. The selector prints exact projects, SHAs, mode and reason; the
Actions summary records required versus intentionally skipped jobs.

All seven local tests passed, including 23 graph scenarios; lint and formatting
checks also passed. The full graph/test gate took approximately 31 seconds locally,
excluding dependency installation and hosted runner startup. This duration is
selection-validation overhead, not a hosted pipeline benchmark.

Local graph scenarios cover unrelated Angular/headless source; Nest source,
CJS/ESM and both split fixtures, shared fixture config, security harness and matrix
data; package/lock/toolchain/CI/worker configuration; and deleted project metadata.
Unrelated Angular source selected four workload jobs and skipped eight expanded
runners, including all five Nest cells. With selection and aggregate, that is six
planned runners versus the prior twelve. Headless changes also selected the
neutral runtime floor. Shared configuration selected every family. These are
graph-derived admission counts, not measured hosted savings.

Local tests also require rejection of every missing/failed/cancelled selected job,
unexpected skip/success, invalid plan and failed selection. Real temporary Git
histories test checkout mismatch, missing revisions, unrelated history, PR
ancestry and the full main/queue baseline. No product tests, timeouts, existing
packed atom lists, DTE capacity or supported matrices were changed.

G05 now has implementation and local evidence; hosted runner admission, aggregate
identity and matrix-result behavior still need separately permitted evidence.
#679 follows this slice for cache/restoration and full-family review; #696 owns
protection; #680 owns the integrated candidate. No hosted CI inspection,
monitoring, rerun or paid capacity experiment was performed. Selection startup,
total duration and runner/worker consumption must be measured separately from
cache hits and DTE gains when that evidence is authorized.

### CI follow-up: wait for README editor readiness before typing

At the maintainer's request, a bounded inspection of
[run 42084692672](https://github.com/anarchitects/anarchitecture-community/actions/runs/42084692672)
found 87/89 packed atoms passed. Only minimum SSR `readme-default` and `readme-full`
failed: `/sample/edit` expected “Edited” but observed “Loading editor”, then
“Ready”. All other workload jobs passed. Selection succeeded and the `main`
aggregate correctly rejected `editorjs-angular-packed: expected success, received
failure`. This supplies hosted failure-propagation evidence for the initial
candidate, not green evidence for the corrected candidate or unaffected-job skips.

The README test filled the paragraph as soon as its DOM existed. Editor.js renders
blocks before enabling change observation and resolving `isReady`; the component
then emits its public `ready` event. The README explicitly instructs consumers to
wait for “Ready” before editing. The test now observes that state before its first
edit on the standalone editor routes, then still requires “Edited”, hydration
holder identity, clean browser diagnostics and disposal on navigation. Runtime
code, Forms behavior, retries and assertion timeouts are unchanged.

The preflight re-enumerated both ADR sources: the 24 Meta records at `09d4fc8` and
nine local records remain unchanged from their full readings. Local0004 and the
accepted Modern Angular decision require truthful packed-recipe/hydration proof;
Meta0015 requires preserving verification. The Angular repository application,
SSR and testing guides were rechecked; no decision conflict was found.

Fresh local preparation `si695-readme-ready` used Angular22.0.0, Editor.js2.31.7
and Node22.22.3. Both README production builds and all **13 browser tests** passed
(seven default, six full), with no retries or atom cache hits. E2e lint/typecheck
also passed. Evidence is under `dist/editorjs-packed-results/si695-readme-ready`.
No hosted rerun, ongoing monitoring or capacity change was performed.
