# Custom Editor.js tool validation

This contributor record covers #647 at the merged #646 baseline
`c3a03b1e1aa3739985893648572718c824196bcf`. The architecture preflight and constraints
are recorded in the [custom-tool design](editorjs-custom-tools-design.md#packed-validation-increment-647).
Consumer guidance remains in the archived core and Angular custom-tool guides.
The [final documentation review](#documentation-and-release-readiness-review-648)
records #648's changes and the completed #647 hosted evidence separately from
the eventual release gate.

## Required evidence and ownership

| Consumer/boundary                          | Existing atom and evidence                                                                                                                                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neutral browser, Angular/Forms/Nest absent | CSR `portable`: actual archived callout/marker/flag and pinned external Code recipes, typing, styles, save/reload, readonly, lifecycle and delivery controls                                                    |
| Standalone Angular, Forms absent           | Uncached preparation: actual archived sources compile and import with browser globals trapped before Forms is installed                                                                                         |
| Native Forms and standalone CSR            | `interop`, `csr-editor`, `csr-forms`: actual archived recipes, public provider/control APIs and existing regression cases                                                                                       |
| SSR import/request isolation               | `ssr`: guarded emitted modules with individual custom-tool negative controls; sequential and truly overlapping requests; deterministic inert HTML and owner disposal                                            |
| Hydration and delayed activation           | `hydration-registry`: archived standalone/Forms consumers in production, diagnostic and full profiles; pre-bootstrap inert markup, fresh owners and late Code delivery after navigation                         |
| Production delivery                        | `isolation`: emitted graph provenance, browser requests/responses/executed coverage, selected Code CSS, unselected tools and eager negative controls                                                            |
| Five-tool/upload regressions               | Original common, upload, Forms-upload, deferred, README and two reference Nest adapter atoms                                                                                                                    |
| Cache restoration                          | Uncached `packed-cache-audit.mjs`: remove shared CSR build/upload/custom editor/Forms outputs, compare every restored file; remote mode requires an empty local cache/database and explicit remote-hit statuses |

The six snapshots use Angular 22.0.0 / Node 22.22.3, Angular 22.1.4 / Node
24.15.0 and Angular 22.2.2 / Node 26.0.0 independently for CSR and SSR.
TypeScript is 6.0.3, Editor.js 2.31.7 and Code 2.9.4. Playwright is 1.64.0;
the pinned Chromium revision is 1248 (156.0.8078.4). These exact fixtures do not
certify future versions or other browsers. Core's existing Node 22.12.0 neutral
gate and Code's documented NodeNext declaration limitation remain unchanged.

## Graph and cache contract

Resolved configuration has 105 e2e targets: 89 cacheable validation atoms and six
uncached preparation targets, plus existing workspace commands. No new atom or
project is added. Preparations own isolated immutable snapshots; build outputs
are prerequisites of their browser/server atoms. Ports, extraction directories
and reports remain isolated. Collection is uncached and fails for missing,
failed or mismatched results.

The existing fingerprint inventory covers both public guides, the custom/SSR
extraction helpers, copied host files, dependency manifests/lock and TypeScript
configuration. Nx additionally hashes project test/tool sources, inferred graph
configuration, snapshot/platform/run identity, orchestration Node and relevant
environment values. Snapshot archive and package-lock identities are retained;
fresh registry resolution stays outside DTE and cannot be substituted by a
previous attempt's cached pass.

## Retained input identities

Local run `si647-matrix`, source fingerprint
`ad515b1d625f8767f2806c85f8e885e6d99f1ffce04682d99b4fb23a2709dd78`. All package archives are version 0.0.1;
the SHA-256 identities agree wherever an archive is included. Upload-fetch is
packed only for the reference CSR Nest consumers.

| Archive                                        | SHA-256                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| anarchitects-editorjs-core-0.0.1.tgz           | `369f730bbe99968ef36ab94e41768c8965fa8e3dcc99491b196ffab2ee6f5ced` |
| anarchitects-editorjs-tool-header-0.0.1.tgz    | `2a98929815b82b9f5216fa04f8b12bd3e8c5c9cc6426e002683bd0cf80471c03` |
| anarchitects-editorjs-tool-list-0.0.1.tgz      | `2fda3ac1801a20a39e89cfe8a14d04f360e55868ce7fe08a589cd2b97485dc3c` |
| anarchitects-editorjs-tool-quote-0.0.1.tgz     | `4f6a775b9c1ed62bb26d8dd582c937f986a5eb208730b9982cc0f29e290b0428` |
| anarchitects-editorjs-tool-image-0.0.1.tgz     | `22bd9cafe4905cab6099fd4278f4ccf009f2c5ab0ca04293e873d95d480c0e84` |
| anarchitects-editorjs-tool-paragraph-0.0.1.tgz | `5c504467baa6682a4693e57eedf12376f297bcb96838ee70dba76b7897c277ea` |
| anarchitects-editorjs-angular-0.0.1.tgz        | `f97315c64c0a19e7b6cfbaa0e9334391e1fca792b0b8891ae5624b1083970b6e` |
| anarchitects-editorjs-upload-fetch-0.0.1.tgz   | `2cb0e493fd17757669c26197e98c2ed5544ca06feeedece7ce164ea3c6defa4c` |

Each immutable consumer includes its complete lockfile, registry integrity values,
archive manifests and preparation command evidence. Snapshot and main consumer
lockfile SHA-256 identities are:

| Mode / cell     | Snapshot archive                                                   | package-lock.json                                                  |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| csr / minimum   | `8f313c315249194e0c54073ccf4b130c0176c86786840d66ad16f6c74e51ee49` | `74992264a1bb4d66a267c609f65788330c7c37b0513cc9dc737e05b01bdafe30` |
| csr / reference | `7bd699758b454fedaa9397a706fe3f745fecfb6febacd06ed73e9ceacfbb54d7` | `5ec9cf0fb811d6d8a97b47b01dc97acb7bd04494ac2066694d3f8de7bd89e138` |
| csr / current   | `a857159f0a406d8983a1f6abc05af6ead68bccf4e514093ae1321a46e4b1202e` | `8c570729b7459ec84ac52ec142fe6c9fc5b1916b1472b1bc9507578b121fa035` |
| ssr / minimum   | `9bdd1161eacb4aa249f2fc0c662be0cb7566f26413a79b5f10be76dcb637592a` | `63b4c3e1b0796d009f823adadd0fda6f99a860bc3dd00e766a845348c492e5bc` |
| ssr / reference | `a20ff6343796ef54477020683d88a8ecda18fd3ee5a7a99ee1b0d70bf0d6d5c1` | `132e6ea4a9052fff398a803c9210530f94dfbe3bfcc15271eca0b372224187dc` |
| ssr / current   | `89940fa11efa421082fd088540af4190a46b4e9d5f8640c026e06d01cddb3895` | `b08d76e5f2453de4fc46e481112b5163886ac1bf6facd53c98a5eb5781d50b19` |

Code 2.9.4 resolves to `https://registry.npmjs.org/@editorjs/code/-/code-2.9.4.tgz` with integrity
`sha512-c0zyWodNqjL/0WI67sZvACIOFU9IAHG0UeeIpjss8pZGGNBum+UWkh7nKULK0SYvaOrdPdlWWqjuFU1TFA5jUA==`. Its MIT license and dependency metadata are retained in
preparation evidence, alongside the root-only, portable, individual-tool and Nest
consumer lockfiles.

## Execution record

Local validation completed on 30 October 2026. Hosted DTE, coordinator restoration
and cold/warm cost evidence require explicit maintainer authorization. Local
results do not satisfy that hosted gate.

All local Nx commands use `NX_NO_CLOUD=true`, `NX_DAEMON=false` and
`NX_ISOLATE_PLUGINS=false`; matrix tasks additionally use
`EDITORJS_PACKED_RUN_ID=si647-matrix` and `NG_BUILD_MAX_WORKERS=2`.
The coordinator is macOS arm64 / Node 26.13.0 / Yarn 4.18.0. Each snapshot still
executes consumer compilation and runtime checks with its own matrix Node.
The complete target list comes from `packed-targets.mjs`, with local task
parallelism three. This is a local capacity measurement, not hosted worker time.

The existing seven harness tests passed through Nx alongside scoped lint and
typecheck. They cover graph/output isolation, disjoint ports, concurrent README
profiles, retained failed prerequisites and an uncached failing collection gate,
command/spawn failure, cancellation and cleanup. This establishes local failure
handling only; it does not prove worker failure or remote diagnostics delivery.

| Gate                                       | Result / local measurement                                                                                                                                                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh preparations                         | Six passed; 2m 36s wall time, parallelism three. Individual preparation records: CSR minimum/reference/current 65.227 / 63.013 / 65.667 s; SSR 64.109 / 53.864 / 84.419 s. Eight prerequisite package builds were local cache hits; preparation itself was uncached. |
| Cold validation matrix                     | 89/89 passed, zero validation cache hits; 9m 12s Nx wall time, reported critical path 1m 1s. Sum of atom durations 1,626.069 s, including extraction and cleanup.                                                                                                    |
| Consumer completeness                      | CSR minimum/reference/current 7 / 9 / 7 atoms; SSR 22 / 22 / 22 atoms. All six uncached collection gates passed.                                                                                                                                                     |
| Browser executions                         | 1,158 passed across existing atoms, including 90 neutral-browser, 54 registry hydration and 42 delivery/isolation cases. These are executions across matrix/profile/mode combinations, not 1,158 distinct behaviors.                                                 |
| Clean local restoration                    | Reference CSR build/upload/editor/Forms directories removed; 4/4 cache hits and all 31 files restored byte-for-byte. Nx wall time 502 ms; audit subprocess including startup 2.812 s. Cold durations for these atoms were 10.595 / 9.730 / 16.218 / 16.879 s.        |
| Guide invalidation and failure propagation | A temporary archived Angular guide change made the previously cached Nx build fail with a stale-snapshot diagnostic; Nx skipped the dependent editor task and returned 130. The real failed record made uncached collection return 1.                                |
| Dependency/configuration invalidation      | Temporarily changing the prepared Code pin from 2.9.4 to 2.9.3, then the shared TypeScript target from es2022 to es2021, independently made the Nx runtime hash command reject the snapshot (exit 1).                                                                |
| Environment invalidation                   | Setting previously unset `PLAYWRIGHT_BROWSERS_PATH` explicitly to the same installed browser directory caused 0/2 cache hits. The reference CSR build/editor reran successfully: 23.4 s Nx wall time, 24.492 s subprocess time.                                      |

All temporary source changes were restored byte-for-byte. Negative-probe records
are kept separately under `invalidation/`; the original successful cold outputs
were restored and all six completeness gates checked again. The environment
probe retains its separate results without replacing cold matrix evidence.
These failures are intentional evidence probes, not failures of the final code.

Local evidence is under `dist/editorjs-packed-inputs/si647-matrix/` and
`dist/editorjs-packed-results/si647-matrix/`, including per-command logs/timings,
Playwright traces and attachments, build metadata, import negative controls,
collected phase records, cache audit manifests and invalidation diagnostics.
Generated evidence and archives are not committed. The focused reference SSR
smoke run `si647-reference` also passed its seven tasks before the full matrix;
it is not included in the cold matrix counts above.

## Owned exclusions and remaining gate

Repository maintainers own the conservative run/snapshot boundary on validation
cache reuse. Revisit cross-run reuse only when a reviewed dependency-content
identity preserves fresh-install evidence and native/runtime compatibility.
Package build reuse remains independent of this exclusion.

The existing three-worker hosted configuration remains an initial capacity
choice. This change makes no optimum or invoiced-savings claim. At #647's local
handoff, hosted evidence was pending; the completed run is reviewed below.
Per-worker utilization, a full cold/warm CI comparison and invoiced cost remain
maintainer-owned measurements to revisit before changing capacity. CI monitoring
and additional hosted runs remain subject to the maintainer's credit constraint.

## Completed #647 hosted evidence reviewed for #648

This is a one-time inspection of completed evidence, not a new CI run or monitoring
session. [PR #656](https://github.com/anarchitects/anarchitecture-community/pull/656)
merged at `c3c7232850e2beecbf53c2e40e28687737278cce`. Its head
`5cb79493baa504e67c38d7e5521c247092519629` passed all twelve jobs in
[Actions run 41101061258](https://github.com/anarchitects/anarchitecture-community/actions/runs/41101061258),
including the Node 22.12.0 neutral-package gate. The run's
[packed evidence artifact](https://github.com/anarchitects/anarchitecture-community/actions/runs/41101061258/artifacts/12999657881)
was downloaded and inspected on 30 October 2026. Its configured retention is seven
days; these recorded observations do not extend artifact retention.

| Evidence                   | Observed result                                                                                                                                                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distributed invocation     | [Nx run mLPPgTDDdf](https://cloud.nx.app/runs/mLPPgTDDdf), summary [LLL4xoYkrC](https://cloud.nx.app/run-end/LLL4xoYkrC): 89 successful executed tasks, zero failures, zero cached tasks, three workers.                                                                                      |
| Coordinator results        | All 89 phase records and all six uncached collection records passed for `gh-41101061258-1`; no failed or missing result was found.                                                                                                                                                            |
| Strict remote restoration  | `cache-audit/result.json` passed for build-csr, csr-upload, csr-editor and csr-forms. `nx-run.json` records `remote-cache-hit` and status 0 for each. Before/after SHA-256 manifests agree for all 31 files after deleting their directories and using an empty private local cache/database. |
| Exact consumer environment | Linux x64; Angular 22.0.0 / 22.1.4 / 22.2.2, Node 22.22.3 / 24.15.0 / 26.0.0, Editor.js 2.31.7, Code 2.9.4, TypeScript 6.0.3; orchestration Node 24.22.1, Playwright 1.64.0 and pinned Chromium revision 1248.                                                                                |
| Coordinator durations      | Packed job 16m 31s including setup, preparation, distribution, audit and upload. Preparation's Nx invocation 3m 0s. Distributed-start to distributed-completed log timestamps: approximately 11m 40s, including worker startup/transfer/wait.                                                 |
| Work and replay durations  | Sum of retained atom durations 2,686.421 s, not billed worker time. Four-task remote audit subprocess 7.076 s; Nx reports 572 ms. This subset replay is not a warm rerun of the full CI matrix.                                                                                               |

The hosted reference archive SHA-256 identities are core
`730241626a2d25e4b0189ab8d4a991a1b5de5fda096ab6d4afbc5cc63c49de7a`
and Angular `c67d64b739f3cfa4619b3aa2d893ab9d24b106fb2df5b2fc63f4d3e5a6958194`.
They identify that Linux build, separately from the earlier local archives and
the documentation candidates below.

The success run does not establish controlled worker-failure propagation or
separate per-worker startup/transfer/utilization figures. Local failure and
collection probes above and the historical hosted failures recorded in the
[upload validation](editorjs-upload-validation.md#execution-record) remain
separate evidence for the unchanged failure/collection harness. Maintainers own
any further controlled hosted failure/cost experiment; none was launched here.

## Documentation and release-readiness review (#648)

Review baseline: merged #647 at `c3c7232850e2beecbf53c2e40e28687737278cce`.
The fresh preflight enumerated and read all eight local ADRs and eighteen Meta
ADRs, including proposed/historical records. Meta's clean adjacent checkout and
all ADR blob identities match the remote tree
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. Relevant Modern Angular guides were
reviewed again. Community0004 requires usable shipped documentation; A01/A02/A03/
A07/A09/A10 require bounded compatibility, neutral reuse, owner lifetimes and
actual consumers. Community0007/Meta0013 retain independent non-bumping release
intent; Meta0015 keeps cache/DTE proof and fresh-state gates distinct. No accepted
conflict, proposal override, HTTP adapter change or dependency upgrade is introduced.

The four owning README/guide files now promote complete install-to-result paths,
identify the copied source files needed by API sketches, explain prepublication
archive installation and distinguish structural, block-data, tune and rendering
validation. They summarize upstream lifecycle/configuration, readonly capability,
configured-name persistence, cleanup/recovery and SSR activation limits. All 62
fenced code blocks are byte-identical to the merged predecessor; public runtime
source, manifests, declarations and tests are unchanged.

| Consumer journey        | Reviewed public source and retained proof                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neutral block authoring | Core `custom-tools.md`: complete callout schema/class, direct/eager maps, lazy owner, HTML page and commands; actual archived sources compile and run without Angular/Forms/Nest/Nx.                                            |
| Inline and tune         | Same guide: bounded marker selection and readonly behavior; independent flag state with explicit tune-payload validation and configured names.                                                                                  |
| External Code           | Explicit 2.9.4 install, default-export selection, config/data guards, direct/lazy modes and CSS-on-evaluation; no all-tools package or new Community adapter.                                                                   |
| Standalone Angular      | Angular `custom-tools.md`: same seven core source files, fresh per-owner config, explicit-map precedence, provider environments and teardown; Forms-absent compilation/import guard.                                            |
| Optional Forms          | Native Signal Forms entry point and example, model validation, reset/touch/dirty, explicit snapshot review and submission; editor errors, upload activity and validation pending remain different states.                       |
| SSR/hydration/delivery  | #647's full exact matrix and hosted evidence above; no claim for arbitrary third-party tools, nested hydration, custom route reuse or every browser.                                                                            |
| #71/#72 compatibility   | Caption remains distinct from missing/authored/decorative alt. No generated alt or publication guarantee. Upload ports, Blob/File semantics, error/metadata ownership and explicit submission/teardown policy remain unchanged. |

### Package and release intent

Fresh npm lookups returned 404 for both affected packages; remote tags contain no
Editor.js releases, and neither package appears among all 102 GitHub Releases.
This review does not infer publication from a manifest. Resolved Nx project names
are `editorjs-core` and `editorjs-angular`; each retains independent release intent
at 0.0.1 and non-bumping `init` development. No manifest, dependency range or release
configuration changes are required. Core has no runtime dependencies/peers; Angular
depends on core `^0.0.1`, peers on core/common `^22.0.0` and Editor.js `^2.31.7`,
with Forms `^22.0.0` optional. The separate `/forms` entry remains optional.

The declared ranges exceed the exact verified cells. Core's Node baseline remains
22.12.0 and neutral ES2022/NodeNext/Bundler declarations. The Code recipe remains
Bundler-only: upstream NodeNext declarations, raw Node/UMD consumption, strict CSP
nonce handling, alternate documents and comprehensive accessibility are not
certified. Code's silent Tab/Shift+Tab edits require an explicit save; no blanket
autosave, third-party compatibility or blog-publication claim is added.

### Final artifact validation

On 30 October 2026, local run `si648-review` used macOS arm64 and Node 26.13.0
for orchestration, with `NX_NO_CLOUD=true` throughout:

- Scoped core/Angular test, lint and typecheck: **9 tasks passed**, no cache hits.
- Four fresh isolated preparations: all three CSR cells and reference SSR passed,
  including compilation of the actual archived guides with Forms absent/present.
  The first reference preparation was blocked behind an idle upload-fetch Vite
  build; that process was terminated and the reference preparation retried alone.
  The retry passed without a source change. This was not a clean first attempt.
- Focused packed run: **22 tasks passed**, no cache hits, in 2m44s. This comprises
  portable/interop/editor/Forms in each CSR cell and reference SSR,
  hydration-registry and isolation, with seven build prerequisites. Logs record
  **194 browser cases** and **120 interoperability assertions** passing.
- This is a focused rerun, not a new full 89-phase run or completeness collection.
  The unchanged runtime, fixtures and 62 public code blocks retain the separately
  identified full #647 evidence above. This PR's configured CI remains its own gate.
- After checks completed, both final Nx builds passed, followed by sequential
  `npm pack --ignore-scripts` operations with an isolated writable npm cache.
  Archive inspection confirmed owning README/guide/LICENSE bytes, Apache-2.0,
  ESM metadata, export/declaration targets, optional Forms and absence of source,
  test and build-info files. Angular also retains its generated `tslib` dependency
  (`^2.3.0`). No new browser asset is shipped; the independently installed Code
  package's license/integrity and runtime CSS remain covered by preparation and
  the browser cases. Generic installs remain free of Angular/Forms/Nest/Nx.

Final archives in `/tmp/si648-final-archives` are byte-identical to the archives
installed in **all four** tested snapshots:

| Archive                                              | SHA-256                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `anarchitects-editorjs-core-0.0.1.tgz` (37 files)    | `5fd4d9c534f8f3a909a51ee8abd5e2e08a8f0c36b78a52f397b9a60285564bb1` |
| `anarchitects-editorjs-angular-0.0.1.tgz` (10 files) | `a2384cd5c800bd51567be8ff0879d5c07b2b6fb5c97e1e4ca84d45707019b2f5` |

| Prepared consumer | Angular / Node   | Consumer snapshot SHA-256                                          |
| ----------------- | ---------------- | ------------------------------------------------------------------ |
| CSR minimum       | 22.0.0 / 22.22.3 | `be4877f9242759c48c1d2d862360a4652bfaddc1b690745cee7fdefc773b2a6f` |
| CSR reference     | 22.1.4 / 24.15.0 | `e3f696d37c71aa72dfdc8bb902e6723cb9e17aa6756de27d4bb06d1ef2a5ded2` |
| CSR current       | 22.2.2 / 26.0.0  | `830994c07e119b0509cb648e0415434f6d3182d455edafa105cf59eceb8518c6` |
| SSR reference     | 22.1.4 / 24.15.0 | `6950e6545c122966a94e0b7b69d8cd82dc6facbac165a5b09711b7e0eb6ddb95` |

All use TypeScript 6.0.3, Editor.js 2.31.7 and Code 2.9.4. Local preparation
metadata, exact lockfiles and archive evidence live under
`dist/editorjs-packed-inputs/si648-review`; phase results/logs live under
`dist/editorjs-packed-results/si648-review`. These generated files are not
committed or published. This local identity record does not certify a future
release commit or broaden the declared verified matrix.

### Release gate and follow-on ownership

This is a readiness review, not release authorization. Before publication, #76
must select the exact release commit, require **all configured CI checks green
for that commit**, complete checks before the final build/pack, inspect those
exact archives (README/LICENSE, exports/declarations, examples, assets, peers and
isolated install), and verify npm/tag/release history again. Do not publish a prior
candidate archive after changing its sources or assume a merged PR's CI covers a
later release commit. First distribution remains exactly 0.0.1 independently per
package. No version bump, tag, release or publication is performed by this review.

#74 retains persistence, schema evolution and migrations; #75/#78 retain broader
testing/demos; #76 retains publication. Hosts retain authorization, public rendering,
storage, credentials, dependency locks and consumer adoption. This review starts
none of those workstreams and does not automatically close #73 or its open gates.
