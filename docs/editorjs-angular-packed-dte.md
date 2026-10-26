# Packed EditorJS validation with Nx DTE

## Architecture and scope

The packed CSR and SSR release checks use fresh dependency resolution followed by
an explicit, cacheable Nx graph. Nx Cloud schedules build and file atoms across
workers; GitHub Actions no longer partitions the validation by version cell.

Preflight for this change enumerated and read all eight Community ADRs and all
18 Meta records at `823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`, including the
proposed governance records. Applicable accepted decisions are Meta ADR 0015
(caching, DTE, truthful inputs and restorable outputs), Modern Angular A01/A09/A10
(exact compatibility, SSR isolation and packed-consumer evidence), and Community
ADR 0004 (actual packed README validation). Meta HTTP/Nest policies and Community
ADR 0005/0006 do not authorize changing the fixture's supported runtime. No
package API, peer range, HTTP adapter, release policy or proposed ADR is changed.

The previous blanket uncached packed harness is refined into uncached fresh
preparation, cacheable validation atoms, and an uncached evidence-completeness gate. Fresh
checks still execute for each workflow attempt. This applies ADR 0015 without
letting a prior workflow's cached success certify a new release check.

## Graph and artifact contract

`packed-plugin.mjs` infers targets only for `editorjs-angular-e2e`, using the
compatibility matrix and the phase definitions. Graph discovery never imports a
prepared Playwright configuration, runs npm, or requires a consumer directory.

For each of the three version cells, independently for CSR and SSR:

1. `packed-<mode>-<cell>-prepare` runs **outside DTE**, uncached. Its library build
   prerequisites retain their normal Nx caching. Preparation installs the actual
   archives, proves root imports/declarations with Forms absent, installs matched
   Forms, checks all versions/paths/exports, and compiles README/declaration
   examples. It retains both locks and produces a consumer snapshot.
2. Build/evidence atoms consume that immutable snapshot. CSR has four atoms:
   native Forms interoperability, one application build, and two browser files.
   SSR has sixteen: the same four plus four SSR builds, server validation, four
   hydration files, isolation, and two independently rooted README build/test
   recipes. Each application build executes once per snapshot, not per spec.
3. Browser/server atoms depend explicitly on the builds they consume. Build
   archives and result directories are declared outputs and can be restored on
   another worker. CI requests every atom explicitly so their reports return to
   the coordinator, including intermediate build evidence.
4. The coordinator runs `packed-results.mjs` without caching. Any failed, missing,
   mismatched or incomplete atom result fails the job. It collects all available
   evidence even after failures or skipped dependants. The public aggregate
   commands enforce the same gate locally.

The full graph contains **60 cacheable atoms**, plus six uncached
preparation targets outside the distributed invocation. Preparations keep CSR
without SSR peers independent from SSR's embedded CSR checks.

Snapshots live under `dist/editorjs-packed-inputs/<runId>/<mode>/<cell>` and
contain `consumer.tar.gz`, its SHA-256/platform/source manifest, and preparation
evidence. Package archive references are relative; no former temporary directory
is needed. The snapshot includes installed native dependencies, so restoration
requires matching OS, architecture and libc. CI prepares on Ubuntu 22.04 and
uses the matching worker image with Node 24.22.1 as the orchestration runtime.
Consumer Node versions remain those in the compatibility matrix.

Every atom extracts into a new external temporary directory. Dependencies resolve
within that consumer, never through workspace ancestors or peer symlinks. CSR,
SSR and README configurations have separate working directories. Browser atoms
lease independent ports, refuse server reuse, and have separate reports. Process
groups are terminated on timeout/cancellation, and each atom removes its consumer
and releases its port leases. Concurrent runs have different run IDs and output
paths. Preparation and atom locks reject duplicate writers for the same identity.

Results live under
`dist/editorjs-packed-results/<runId>/<mode>/<cell>/<phase>`. Each contains command
logs/timings and a result record; build atoms also declare `build.tar.gz` and its
checksum. The coordinator retains all phase evidence, including traces, screenshots,
build metadata, negative controls and preparation locks. The artifact uploaded
by CI is `editorjs-angular-packed-evidence`; inputs have one-day retention.

## Caching and failure semantics

All distributed targets have `cache: true` and complete source/toolchain inputs,
including the verified snapshot digest, source fingerprint, orchestration Node,
CI/build-worker settings, lockfile and invocation ID. The workflow ID includes
`github.run_attempt`; local aggregate commands generate a UUID. A new attempt
cannot reuse older validation records. Within an attempt, Nx can transfer and
restore outputs between workers and reuse completed evidence. Package/fixture
changes reject old snapshots before executing validation.

Failed assertions return a nonzero process status: Nx and CI report the atom as
failed. The packed invocation enables the installed Nx version's supported
`NX_CACHE_FAILURES=true` setting to retain failed-task outputs as well as passes.
It is scoped to this workflow and local packed invocation; the attempt identity
prevents a cached failure from contaminating a new validation attempt. Independent
atoms continue with `--stop-workers-on-failure=false`; failed build dependants
remain skipped. The uncached coordinator gate collects available evidence and
fails for every failed, missing, mismatched or skipped required atom. It does not
rerun missing checks or turn incomplete evidence into a pass. Infrastructure
failures still fail Nx directly. Failed-output remote restoration requires the
same hosted verification as successful outputs.

Fresh npm resolution remains uncached because it observes the registry. The
immutable snapshot makes downstream work controlled and transferable. Build
caching is currently bounded by the snapshot/run identity as well; extracting a
stable cross-run dependency-content identity is a future optimization, not a
reason to omit native/toolchain or fresh-evidence inputs. Repository maintainers
own this exclusion and should revisit it if snapshot hashing/transfer becomes
the measured bottleneck.

## Local commands and CI lifecycle

The existing commands remain supported:

```sh
yarn nx run editorjs-angular-e2e:e2e-packed --cell=angular22-reference
yarn nx run editorjs-angular-e2e:e2e-packed-ssr --cell=angular22-reference
```

Omit `--cell` to run all cells. `--phaseParallel=1` serializes the local graph;
the default is two, with an explicit limit of eight. Local wrappers create fresh
snapshots and run the graph locally. CI invokes the inferred targets directly
with its shared run ID, rather than distributing the uncached wrappers.

CI prepares all six snapshots, uploads them, then calls `nx-cloud start-ci-run`.
The custom launch template installs the pinned orchestration Node and workspace
packages, installs matching Chromium/OS dependencies, and downloads/verifies the
same input artifact before accepting tasks. The artifact token uses the existing
read-only Actions permission; it is not written into consumer snapshots or logs.
The worker count/template can be changed through `EDITORJS_PACKED_DISTRIBUTION`;
`3 editorjs-packed` is an initial capacity choice, not a measured optimum.

The coordinator requests all 60 atoms in one Nx invocation. Nx owns task
assignment and prerequisite ordering. Explicit completion runs with `always()`
after worker startup, including failure/cancellation paths. The final uncached
gate and retained evidence apply to all cells, even when the distributed invocation
fails. The independent workspace SSR job
remains a separate check.

## Validation and performance evidence

Local baseline on 26 October 2026, macOS arm64, reference cell, prerequisite
library cache warm: the original serial SSR harness passed in **177.90 s**.
The first portable-artifact/file-atom run passed all reference-cell assertions:
**39.0 s** fresh preparation and **152.92 s** local execution with two task slots.
Nx reported a **49.9 s** graph critical path. This is not a distributed timing
measurement or a speedup claim; extraction, worker startup, transfer and runner
cost must be included in hosted comparisons. The abandoned local-only phase
prototype is not DTE evidence.

The complete matrix also passed locally: all 60 validation atoms across the six
CSR/SSR cells, with **113.97 s** fresh preparation (three slots) and **351.91 s**
local execution (three slots). Nx reported a **57.7 s** critical path and zero
cache hits. These timings include the earlier six cacheable collection tasks,
subsequently replaced by uncached coordinator collection so failed checks retain
normal Nx failure status. Harness tests cover failures, interruption, descendant
cleanup, port isolation, snapshot integrity and graph boundaries.

Local cache verification used the final failure-propagation design:

- Reference CSR build + editor browser file: miss **23.7 s**, then **247 ms** with
  **2/2 hits** after moving both output directories away. All 15 restored files
  matched the original bytes.
- Changing `NG_BUILD_MAX_WORKERS` from 2 to 1 produced **0/2 hits**. Changes to
  package source, `yarn.lock` and `tsconfig.base.json` rejected the stale snapshot;
  a new run ID could not consume an older attempt's inputs.
- An intentionally invalid archive failed its atom. After removing its report,
  replay restored the failed diagnostics byte-for-byte in **170 ms** and still
  returned exit status 1. This verifies local failed-task caching, not remote
  failure-artifact transfer.

The prior successful main-branch [CI run 40326962009](https://github.com/anarchitects/anarchitecture-community/actions/runs/40326962009)
at baseline commit `18211130b1ae653cdd8e76d5256deb90322c19c6` provides the hosted
six-job baseline. Durations below are GitHub job/step timestamps, not local timings:

| Consumer      | Whole job | Validation step |
| ------------- | --------: | --------------: |
| CSR minimum   |     543 s |            65 s |
| CSR reference |     444 s |            68 s |
| CSR current   |     268 s |            69 s |
| SSR minimum   |     315 s |           244 s |
| SSR reference |     276 s |           206 s |
| SSR current   |     298 s |           216 s |

The six packed jobs total **35.73 runner-minutes**, with a **543 s** longest job.
Setup/cache-restore variance is substantial. These are resource-duration measures,
not an invoiced cost; GitHub allowances and Nx Cloud worker pricing differ.
Compare both coordinator and worker time, including snapshot transfer and startup,
before choosing capacity or claiming savings. The supported reference CSR local
aggregate also passed with fresh preparation in **83 s** after the final graph change.

Before declaring hosted rollout complete, retain a cold distributed run and a
same-attempt restoration run, verify actual worker assignment and artifact
transfer, then compare end-to-end duration and compute cost against the previous
six-job matrix. Account separately for npm resolution, snapshot transfer,
browser/OS setup, builds, tests and collection. Run-level and per-command timings
are retained to support this comparison.

### Hosted rollout blocker (26 October 2026)

Draft [PR #604](https://github.com/anarchitects/anarchitecture-community/pull/604),
commit `d7188c60cf2f5c8df9cac1ad679bc553c4c7690e`, ran in
[GitHub Actions 40350033641](https://github.com/anarchitects/anarchitecture-community/actions/runs/40350033641).
Harness contracts, worker-template validation, all six fresh snapshots and their
upload passed. The [distributed invocation](https://cloud.nx.app/runs/ju5Ve8MwWB)
started at 15:34:51 UTC and terminated at 15:38:21 UTC with
`One or more workflows failed`. No atom outputs reached the coordinator. The
uncached completeness check failed all six cells for missing evidence; explicit
worker completion and diagnostic artifact upload succeeded. Other GitHub jobs
passed.

The worker log supplied by the maintainer identifies `spawn unzip ENOENT` during
snapshot restoration. The base image lacks the ZIP utility used by the input
downloader. The launch template now installs `unzip` explicitly before restoring
the artifact. This is an initialization prerequisite; validation assertions and
cache contracts are unchanged. Hosted atom execution, remote artifact/failure
restoration and DTE performance/cost remain **unverified** until the corrected
worker run succeeds. Keep the PR in draft until the hosted checks pass.
