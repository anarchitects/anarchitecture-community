# Packed persistence validation

This contributor record covers #663 at the merged #662 baseline
`f6050941055668dc3109ab94e3b46f139276d078`. Consumer instructions remain in the
archived core `persistence.md` / `service.md` and Angular `persistence.md`.
The [persistence design](editorjs-persistence-design.md) records the preceding
codec, evolution, service and notebook increments.

## Architecture and release preflight

On 31 October 2026, all eight Community ADRs and all eighteen Meta ADRs were
enumerated and read, including historical, proposed and superseded records.
Meta was checked at `823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. The Modern Angular
index, repository application, architecture, reactivity, forms, SSR/builds,
testing/migration and validation guides were also reviewed.

Community0004 requires usable owning-package guidance and actual archive proof.
Community0001–0003 and the accepted Angular decisions retain shared neutral
policy, optional native Signal Forms, explicit browser activation and owner
isolation. Meta0008–0010 and Community0005–0006 retain the established Nest
adapter behavior; Meta0012 retains canonical HTTP contract ownership. This
slice adds no HTTP API, adapter default, persistence engine or public API.
Meta0015 requires complete cache inputs, restorable evidence, uncached fresh
installs and a clear distinction between local reuse and hosted DTE. No
accepted-decision conflict or exception was identified.

Fresh registry queries returned 404 for both core and Angular; remote tags and
all 102 GitHub Releases contained no Editor.js release. Under Community0007 /
Meta0013 the exact scopes are `editorjs-core`, `editorjs-angular` and
`editorjs-angular-e2e`, with non-bumping `init` intent and versions unchanged at
0.0.1. #76 retains publication and final release-commit authority.

## Evidence ownership

| Boundary                                           | Existing workload                                                                                                                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Neutral raw/envelope codec, migrations and service | CSR `portable`: extract the eight actual archived source files, compile NodeNext and Bundler with ES2022-only libraries, run all three entry points and reuse the existing preservation suites                                       |
| Framework independence                             | A separate installation contains only the core archive and TypeScript (plus the reference minimum-Node executable). Fixtures assert Angular/Forms/Nest/Nx/Editor.js cannot resolve and trap browser globals before module evaluation |
| Angular composition, Forms absent/present          | Uncached preparation copies the same core implementation and compiles/evaluates standalone sources before Forms installation; `interop` checks the public control contracts                                                          |
| Reload, no-write failures and concurrent editing   | CSR `csr-editor` and `csr-forms`: archived notebook sources, explicit save/reload, failed-write retry, revision conflict, duplicate-save guard, unsupported/migrated content, edits during writes and superseding loads              |
| SSR and pre-hydration ownership                    | SSR `hydration-registry`, with production/diagnostic/full build prerequisites: inert server content, pre-bootstrap events, hydration, disposal during a held write and fresh owner state                                             |
| Nest composition                                   | Reference CSR `nest-upload-node`: actual core service recipe and established Nest 12.3.2 native Node composition, alongside existing upload boundary cases                                                                           |
| Required evidence                                  | Uncached collector verifies identity, passing status, snapshot and every retained file hash; prerequisites verify manifests before consuming build archives                                                                          |

Exact Angular / Node cells remain 22.0.0 / 22.22.3, 22.1.4 / 24.15.0 and
22.2.2 / 26.0.0, with TypeScript 6.0.3 and Editor.js 2.31.7. The reference neutral
consumer additionally executes with core's independent minimum Node 22.12.0.
Browser coverage uses pinned Playwright 1.64.0 / Chromium revision 1248. These
fixtures do not certify arbitrary future versions, browsers or storage drivers.

## Nx boundaries

Resolved e2e configuration still has 105 targets, including 89 cacheable
validation atoms and six uncached preparations. No target, project or hosted
capacity is added. Neutral checks join the existing portable atom. Fresh npm
resolution stays in preparation; immutable snapshots are the DTE inputs.
Reports remain isolated by run/mode/cell/phase, with temporary installations,
port leases and cleanup owned by each invocation.

The source fingerprint covers public guides, extraction helpers, the three
reused neutral fixtures, copied host sources, manifests, lockfile and shared
TypeScript configuration. Nx inputs additionally cover project sources,
dependency production inputs, worker configuration, matrix snapshot/platform
identity, orchestration Node, `CI`, `EDITORJS_PACKED_RUN_ID`,
`NG_BUILD_MAX_WORKERS` and `PLAYWRIGHT_BROWSERS_PATH`. Build prerequisites feed
browser atoms; fresh preparation is not a prerequisite inside a distributed
graph. Every phase output now records a sorted SHA-256 manifest. Command logs
are flushed before hashing, and collection rejects missing, additional or
changed files even when a cached result says it passed.

The required collector remains uncached and inspects every required phase.
Its harness regression exercises passing collection, deleted and altered
artifacts, exact restoration and a failed behavioral result with retained
diagnostics. Existing tests cover failed builds/skipped dependants, process
failure, cancellation and resource isolation.

## Execution and artifact record

Validation ran on 31 October 2026, on macOS arm64 / Node 24.22.2 / Yarn 4.18.0,
with Nx 23.2.1. All commands used `NX_NO_CLOUD=true`, `NX_DAEMON=false` and
`NX_ISOLATE_PLUGINS=false`. Packed commands additionally used
`EDITORJS_PACKED_RUN_ID=si663-local`, `--runId=si663-local` and
`NG_BUILD_MAX_WORKERS=2`. Each consumer executes with its matrix Node. Fresh
preparation used parallelism two; the main validation batch used two and the
reference CSR batch one, overlapping only independent outputs.

Core's 271 tests, Angular's 196 tests, all eight harness tests and scoped
lint/typechecks passed (12 Nx tasks, 15.5 s, no cache hits). All six fresh
preparations passed, with eight prerequisite package builds (7m 47s wall time,
no cache hits). CSR minimum/reference/current preparation durations were
88.176 / 273.407 / 95.064 s; SSR durations were 104.359 / 104.635 / 78.720 s.
These include fresh registry/install and archive work and are local measurements,
not hosted worker cost.

The source fingerprint was
`0280492719e571e653c9689b365def9a03984ded06f0b1613e54ad126fcf5d73`.
After package checks and build writers finished, the final core archive (39
files) and Angular archive (11 files) were inspected. All shipped guides and
licenses match source, JavaScript/declarations are present, and source/tests/
build-info are absent. Package metadata, exports, dependencies and optional
Forms peer are unchanged from #662. The final archive SHA-256 identities match
all six independently prepared consumers:

| Archive                                 | SHA-256                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| anarchitects-editorjs-core-0.0.1.tgz    | `e112748eb411154325d2be3c5091ac9d338d21787f6ec8d55ffa15a72d6217fd` |
| anarchitects-editorjs-angular-0.0.1.tgz | `c044c5a5637c140b5dddd4934ca1c30128a083f17e2ea45e462a194117b6dc9a` |

| Mode / cell     | Snapshot SHA-256                                                   | Main consumer lockfile SHA-256                                     |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| CSR / minimum   | `b6e81ceb836efbf4d1e639eb2bbb8f6a654bb6ccf440a004a0d7c2651f68fe85` | `a5e8f9e1f07d6fd20a6c1b9b493037254e236b86761b1217e5d1128207d7ec89` |
| CSR / reference | `dec0d70a7692a30d5b95ee220e26f30f50efdc873d2f3a518016f97863735cb7` | `a8b71684da52d07aa5f77e2684127f4cc177b9794e46eef91a1bf67ef1f27517` |
| CSR / current   | `426dface804e9f554ff6411380b5e09f525f44bd0ee3d36e57791fa64da531b9` | `e2f762a04e639d115416d29c4a412fd0776e9026da20fa02cadd102fdebb509a` |
| SSR / minimum   | `8ccfab34f6385b597cd0101ec78c13af7c00aa431ddec7780fb9aa20907e0e01` | `870b391fc6311543e52fbb3f4fff3cfc49c4bc39775b5875a9467d1b31368fad` |
| SSR / reference | `464c1a45e044c8de77b0768c98b24668447426c85bb7f42f2d1a606b39e3fdfc` | `5ae99c98615ac0a9972fb3db360a123d86403305d1cbfc5b79cf51f22c89c46f` |
| SSR / current   | `9b360c5d24967bc3ff17c295a9ff5bee031956189962074806a5cef4e174d8b0` | `fe3c3c624a619b3f1929af87a45f8efb239767320763c98b63c452e5a43ffa78` |

The three separate neutral lockfile SHA-256 values (minimum/reference/current)
are `6f6a21a86f0446eaaced3cc0300453bc7d4a7206e0edb4144abbd9f71ca288a7`,
`232d4508c2531cc5a8ec76f10d5837f476ceed3830a09412ba9918b58a4e62f2` and
`a86ae36b9882fb86973e07c20c12d9e899402cd6f3aac940572c1f2a363592ad`.
Their reports retain guide identities and 34 passing behavior checks per
declaration mode/runtime: 272 executions across four exact Node versions and
two modes. All three archived entry points also passed in each combination.

| Gate                          | Local result                                                                                                                                                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selected cold validation      | 28/28 atoms passed, zero cache hits; sum of recorded atom durations 618.183 s. Minimum portable smoke: 43.8 s wall time; main 21-task batch: 3m 43s; reference six-task batch: 2m 19s. Batches overlap, so their wall times are not additive elapsed time.                                              |
| Browser executions            | 267 passed: 90 portable, 57 standalone, 48 Forms and 72 hydration executions across the exact matrix/profile combinations. These are executions, not 267 distinct behaviors.                                                                                                                            |
| Neutral and native interop    | 272 neutral preservation/failure checks plus three entry points per mode/runtime passed; all three existing interop atoms passed.                                                                                                                                                                       |
| Reference Nest native Node    | Shared save/load, invalid input, stale revision, forbidden and failed-write cases passed, alongside all 16 existing upload scenario groups.                                                                                                                                                             |
| Clean local cache restoration | Reference portable/build/editor/Forms output directories removed; 4/4 local hits restored all 61 files byte-for-byte, including result records, neutral reports, lockfiles, build archive and browser evidence. Nx wall time 556 ms; subprocess including startup 3.767 s.                              |
| Source invalidation           | Seven independent temporary newline probes to core/Angular guides, reused service fixture, neutral extractor, core manifest, yarn.lock and shared tsconfig each made the actual Nx runtime-input command reject the stale snapshot (exit 1). Every file and baseline hash output were restored exactly. |
| Environment invalidation      | Changing NG_BUILD_MAX_WORKERS from 2 to 1 caused 0/1 hits and a successful CSR build (12.9 s Nx wall time). Original cold outputs are retained separately from this intentional probe.                                                                                                                  |
| Required-gate failure         | The eight-test harness run exercises the actual uncached collector with controlled complete records: missing/changed reports and a failed behavioral record return 1; exact restoration returns 0, and failure diagnostics survive collection.                                                          |

This is a scoped 28-atom execution, not a fresh 89-atom run or six complete
production collection gates. The collector's complete-record regression is
controlled harness evidence, not a claim that unrun production atoms passed.
Unchanged workload evidence is identified below. The source/runtime-input
probes and cache manifests are retained under `invalidation/` and `cache-proof/`.

To reproduce the scoped run with a fresh run ID, run the six
`packed-{csr,ssr}-angular22-{minimum,reference,current}-prepare` targets after
package checks/builds. Then run CSR `portable`, `interop`, `csr-editor` and
`csr-forms` for each cell, SSR `hydration-registry` for each cell, and reference
CSR `nest-upload-node`. Nx adds the twelve required builds. Use the environment
above and forward the same `--runId` only to packed targets. A fresh ID requires
fresh preparation. For a cache restoration probe, hash every file (including
`result.json`) in the four reference output directories, back them up, remove
only those directories, rerun the identical four targets and compare all files.
Do not substitute a cache hit counter for artifact equivalence.

Generated archives, complete lockfiles (including registry integrity), logs,
command timings, build metadata and browser reports remain under
`dist/editorjs-packed-inputs/si663-local` and
`dist/editorjs-packed-results/si663-local`; they are not committed or shipped.

## Reused evidence and owned exclusions

The unchanged five-tool, upload, custom-tool delivery, eager negative controls,
README profiles, standalone SSR import/request isolation and Fastify adapter
contracts reuse the dated #73 [validation record](editorjs-custom-tools-validation.md)
and the #661/#662 records in the persistence design. Newly executed browser
atoms also retain their existing custom-tool regressions. Prior hosted results
are not proof of the changed harness or new persistence workloads.

Repository maintainers own remote restoration, hosted DTE scheduling and
worker-failure evidence for these changed tasks. They remain pending an
authorized run; no optional hosted experiment, CI monitoring or capacity change
was initiated. Local measurements cannot establish remote hit rates or hosted
cost. #664 owns the final documentation/compatibility review, and #76 owns the
publication gate. Cross-run snapshot reuse remains deliberately excluded until
a reviewed identity preserves fresh dependency and native-runtime evidence.
Databases, durable browser storage, authentication, HTTP APIs and broader
#75/#78 work remain outside this slice.
