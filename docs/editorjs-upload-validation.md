# Packed upload validation — SI-72.7

Contributor evidence for [#632](https://github.com/anarchitects/anarchitecture-community/issues/632).
This consolidates #627–#631 without changing a public API, supported range,
release version or HTTP adapter default. #633 remains a separate readiness review.

## Architecture preflight

All eight Community ADRs and all eighteen Meta ADRs were enumerated and read,
including proposed and historical records. Meta's remote inventory matches
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`; Community starts at merged #639,
`8df1a7d39b5489643c7dab59ad68a5ad17fc8d6e`.
Modern Angular's index, repository application and applicable architecture,
providers, reactivity, Forms, rendering, SSR and testing guides were reviewed.

Meta0015 requires truthful inputs, portable outputs, meaningful task boundaries
and measured DTE. Modern Angular A02/A07/A09/A10 preserve the framework-neutral
core, native opt-in Forms, request ownership and actual-archive validation.
Community0004 keeps this report separate from the archived consumer READMEs.
Meta0008/0009/0010/0011/0012 and Community0005/0006 preserve HTTP presentation
boundaries: the Nest 12 references do not upgrade the workspace's Nest 11 SSR
runtime or certify native Node as its default. Meta0013/Community0007 preserve
unreleased `init` delivery. No proposal overrides an accepted decision; no
accepted-decision conflict was identified.

## Coverage and exact compatibility

| Consumer/seam               | Evidence                                                                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Angular-free custom backend | CSR `portable` atom: packed public core and five tool exports, independent selection, file/URL uploads, failures, concurrent owners, late completion, metadata, caption and authored/decorative/unset alt                    |
| Standalone Angular          | Fresh preparation compiles root imports with Forms absent; CSR upload files exercise owner-scoped composition, retry, errors and disposal                                                                                    |
| Native Forms                | `interop`, `csr-forms-upload`, `hydration-forms-upload`: native state, pending versus upload activity, safe submit, reset and late-result fencing                                                                            |
| Fetch transport             | `editorjs-upload-fetch:test` and `test-browser`: real packed exports, malformed JSON/schema/results, abort/timeouts, File/Blob/URL, default single attempt and explicit idempotent retry after a committed-but-lost response |
| Nest reference              | Reference CSR `nest-upload-fastify` and `nest-upload-node`: independently installed/compiled packed guide, 16 scenario groups per platform, principal scope, input bounds, storage failure, replay/conflict and cleanup      |
| SSR and hydration           | All three cells and three hydration profiles: server import guard, deterministic request state, inert uploads, pre-hydration click/Enter safety and owner teardown                                                           |
| Public delivery             | Production graph, browser requests, preload hints and evaluation coverage; explicit upload-backend positive/eager negative controls and fresh state after authoring re-entry                                                 |

The additional SSR cases send distinct synthetic authorization/cookie values
through sequential and genuinely overlapping upload requests. They verify
request-specific markers, empty editor holders, zero backend calls/completions,
inert owners, absent credential/error data and actual disposal callbacks. The
fixture's optional marker factory executes in the page's injection context;
the shared CSR page does not acquire a router dependency. Backend state remains
page-owned. These checks do not claim that the demo authenticates a real user.

| Cell      | Angular | Consumer Node | TypeScript | Editor.js |
| --------- | ------- | ------------- | ---------- | --------- |
| minimum   | 22.0.0  | 22.22.3       | 6.0.3      | 2.31.7    |
| reference | 22.1.4  | 24.15.0       | 6.0.3      | 2.31.7    |
| current   | 22.2.2  | 26.0.0        | 6.0.3      | 2.31.7    |

Playwright remains 1.64.0 with Chromium 156.0.8078.4 (revision 1248); image
upstream remains 2.10.3. Other upstream versions and all resolved transitives
are retained in each consumer lock/version record. Both optional Nest cells
remain 12.3.2 on Node 24.15.0; their exact adapter-specific dependencies are
recorded in [the Nest reference report](editorjs-nest-upload-validation.md).

## Graph, invalidation and output ownership

There are still **89 cacheable validation atoms**: seven CSR and twenty-two SSR
per version cell, plus two Nest reference atoms. New checks extend existing
files rather than creating tiny tasks. Six fresh-install preparations stay
uncached and outside DTE. They depend on completed package builds. Core and the five tool packages now
use explicit non-emitting typecheck targets with private `out-tsc/typecheck`
build-info outputs and a build prerequisite, matching the Fetch package.
Builds alone own package `dist`; concurrent checking cannot add or replace
files while preparation packs the completed artifact. All six new checks pass.
Registry lookups return 404 and remote tags contain no Editor.js releases;
these packages remain unreleased and require non-bumping `init` intent.
Preparation now compares source fingerprints before packing and after snapshot
creation, rejecting source changes during that interval.

Resolved atom inputs include project/dependency sources, workspace lock/config,
worker configuration, fixture and preparation helpers, actual immutable archive
digest/platform, orchestration Node, CI, invocation ID, build-worker count and
`PLAYWRIGHT_BROWSERS_PATH`. The browser-location input now applies to every
packed atom instead of only the Nest references. Tests assert this contract.
Build edges forward the same invocation identity; outputs, restored temporary
consumers and leased/listen-zero ports remain isolated.

The uncached collection gate requires every expected phase with matching
identity/snapshot and successful status. Missing, skipped, stale and failed
work cannot pass. The existing harness tests retain their failure/interruption,
descendant cleanup and archive-integrity controls.

`packed-cache-audit.mjs` is an uncached coordinator audit. After cold validation,
it records SHA-256 for every file in the reference CSR build/upload outputs,
removes those outputs, repeats the identical Nx invocation, and compares every
restored byte. Remote mode creates an empty private Nx cache **and** workspace
database and additionally requires Nx's remote-cache status for both tasks.
It retains logs, before/after manifests, duration and a failing result on any
miss. Original cold evidence is preserved even when the audit fails; this does
not turn a failed audit into success. CI runs it after explicit DTE completion,
so workers need not remain allocated for the proof.

Run the ordinary fresh coordinators with:

```sh
yarn nx run editorjs-angular-e2e:e2e-packed
yarn nx run editorjs-angular-e2e:e2e-packed-ssr
```

For a shared six-cell run, use the explicit prepare/atom/collection commands in
`.github/workflows/ci.yml`, with a unique `EDITORJS_PACKED_RUN_ID` and matching
`--runId`. Once collection passes, reuse that exact environment and identity:

```sh
node apps/editorjs/angular-e2e/tools/packed-cache-audit.mjs "$EDITORJS_PACKED_RUN_ID" local
node apps/editorjs/angular-e2e/tools/packed-cache-audit.mjs "$EDITORJS_PACKED_RUN_ID" remote
```

Only replay an unchanged snapshot. Source/dependency/preparation changes require
fresh preparation. Keep the uncached completeness gate for full-matrix claims.

## Execution record

Local validation on 29 October 2026 used macOS arm64 and orchestration Node
24.22.2 (CI remains pinned to 24.22.1):

- Fixture lint/typechecks and all seven harness tests pass. The six non-emitting
  core/tool checks pass ([Nx run](https://cloud.nx.app/runs/PRq5JHHiUJ)).
- Fetch unit/packed checks and 21 controlled browser scenarios pass
  ([Nx run](https://cloud.nx.app/runs/Wt85gloyPq)).
- Fresh six-cell preparation took **2m48s**. The first 89-atom invocation took
  **9m52s**, with no hits: **86 passed**, and the three SSR checks caught a test
  assertion comparing rendered `waiting` to `waiting`. The assertion now trims
  surrounding whitespace; the state/credential/lifetime assertions remain.
  [Initial run](https://cloud.nx.app/runs/Yjf8k2cDwN).
- All three corrected packed SSR checks and their builds pass
  ([36.9s correction run](https://cloud.nx.app/runs/PriOV1uwM6)); the workspace
  SSR check passes too ([Nx run](https://cloud.nx.app/runs/DmpUy77vX4)).
  All **89 required phase results** and all **six uncached completeness gates**
  now pass. This is a full matrix plus the focused assertion correction, not a
  claim that the first invocation was entirely green.
- The original local output-removal replay restored all **15 files byte-for-byte**
  with **2/2 hits**, Nx **353ms** / replay subprocess **3.96s**
  ([Nx replay](https://cloud.nx.app/runs/R6lSQzgkCW)).
- Independent temporary changes to core source, the ImageTool dependency version
  and shared TypeScript configuration each caused Nx's runtime hash guard to
  reject the old snapshot before execution. Every original file was restored.
  A source change during an earlier preparation was also rejected by the new
  before/after fingerprint guard. Logs are retained under `invalidation`.
- Changing only `PLAYWRIGHT_BROWSERS_PATH` to the explicit existing browser
  location caused **0/2 hits** and both tasks passed in **17.8s**
  ([environment probe](https://cloud.nx.app/runs/TrWP1QrJ4S)); its unchanged-code
  baseline passed cold in 18.2s. This exercises the newly declared environment
  input, not a broad `skipNxCache` bypass.

An isolated local **remote** replay used exactly the same task hashes as its
cold seed but received **0/2 remote hits**. The audit correctly failed and restored
its saved cold evidence; no remote success is inferred from a normal local hit.
Local remote-cache availability is separate from CI's authenticated DTE cache.
The audit retains the remote `nx-run.json`, including hashes and cache statuses,
rather than relying on elapsed time or a successful re-execution. Local cache
locations may be per-user in Nx 23; the audit does not assume `.nx/cache` is the
active local store.

Hosted run links, actual worker execution, coordinator collection, restoration
results and measured durations are recorded in the focused
[PR #640](https://github.com/anarchitects/anarchitecture-community/pull/640)
validation record once CI completes. The CI artifact
`editorjs-angular-packed-evidence` retains all six collections and the strict
remote restoration audit. The first hosted run also exposed the whitespace
assertion and correctly failed the SSR completeness gates while retaining the
successful and failed atom diagnostics. Two hosted isolation atoms also reproduced the earlier cold public-page stall
inside the helper's unbounded `requestIdleCallback` waits. The helper now gives
both callbacks a one-second deadline and retains their `didTimeout`/elapsed
observations as Playwright attachments. This follows the
[API scheduling contract](https://www.w3.org/TR/requestidlecallback/): idle
periods are not guaranteed. The 30-second test timeout, one-second observation
interval, production dependency-graph checks, request/preload/evaluation checks,
positive controls and eager negative controls remain. A deadline observation is
not labeled proof that the browser was actually idle. Application scheduling is
unchanged. All three corrected isolation cells pass
([Nx run](https://cloud.nx.app/runs/c3m0Ksx9Gl)); final lint/typecheck/harness
checks pass. Final local restoration again returns **2/2 hits** and restores
all **15 files**, with Nx reporting **7ms** and the complete replay subprocess
**12.06s** ([Nx run](https://cloud.nx.app/runs/OjzQCVFkBM)). Runtime hashing,
startup and transfer overhead must not be confused with task execution time.
All six completeness gates pass again afterward. No cost improvement is inferred
from the implementation.

## Cache and cost boundary

Remote restoration within one immutable invocation is distinct from cross-run
reuse. Every workflow attempt resolves fresh dependencies and receives a new
run/snapshot identity; validation atoms deliberately cannot certify a later
attempt from an older cached pass. Stable package-build caches can still be
reused independently. Repository maintainers own this conservative exclusion
under Meta0015. Revisit it when a reviewed dependency-content identity preserves
fresh-install evidence and measurements justify the added complexity.

Three medium workers remain the configured starting capacity. This PR does not
claim a throughput optimum, invoiced savings, or equivalence to the old smaller
matrix. Compare coordinator time, worker initialization/active duration and
snapshot transfer separately. Capacity/cost tuning remains owned by repository
maintainers after representative hosted measurements; no silent DTE exemption
or cache bypass is introduced.

## Local artifact identities

Prepared run `si632-matrix-v3`, macOS arm64, orchestration Node 24.22.2.
Fresh preparation took 2m48s ([Nx run](https://cloud.nx.app/runs/QfQMcTdJZW)).
All six snapshots share source fingerprint
`3016457ec18ae02e4303f7566caabeaed2f605765805b63a1ff009b416fb9b3a`.

| Mode/cell     | Snapshot SHA-256                                                   | Installed lock SHA-256                                             |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| csr/minimum   | `dc62a9b5aaae1815fdfe6deb987bb4b0c78edb8f68f870ef84c7978e1df0254d` | `6870d7e9c3b699079713907dafe60e35207992b2d6a3f42ec02c8340fe5e0ce6` |
| csr/reference | `b2153715c07885ac59a30701130a072a8f10cb95b67674a7a3ab644fd3199d3c` | `6c18e139820ee67e932dc17ce6594f01a34ba7f1ed0dfa07aa3ad68b2d92ddf1` |
| csr/current   | `53985bbe8297cf599199fe7f96a356a7953930738bacb4b2edb38301a3f612ed` | `180518ff298a97e93017048789502aa2e332d612961f47e1e563c59499ad4460` |
| ssr/minimum   | `627be6d91c3aaaef6a929ec8a1209375b7c7d217fdf595e2fd51276fe734fe54` | `1f402cdf0edff856e758a5fdd47a8229d01d8ad089fb11ad59ea4a678075a7ea` |
| ssr/reference | `874c73386ece64b2f196193fa2374adf0535a13a14c404f804bb28dca2b551fd` | `9f544ee1a8a4a0e14b0a24745ca818cec1b4db370b539311572096ab1b270962` |
| ssr/current   | `be816cca3ca8b6082836892f1c8abc9b1e7206437bbddb968731c5740224003c` | `0ea78f308d9fbf70d1aaf08182cd12a0b08e801999a22a22650e990cf594391b` |

| Actual package archive                | SHA-256                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| @anarchitects/editorjs-core           | `226312e2251e29c9bf583257d6293b5e3e530285eb20a2d324b226772548944d` |
| @anarchitects/editorjs-tool-header    | `2a98929815b82b9f5216fa04f8b12bd3e8c5c9cc6426e002683bd0cf80471c03` |
| @anarchitects/editorjs-tool-list      | `2fda3ac1801a20a39e89cfe8a14d04f360e55868ce7fe08a589cd2b97485dc3c` |
| @anarchitects/editorjs-tool-quote     | `4f6a775b9c1ed62bb26d8dd582c937f986a5eb208730b9982cc0f29e290b0428` |
| @anarchitects/editorjs-tool-image     | `c88f312358e3bc66320e81e9aa1a1885cbda26f6de4a2f0c40210468dfe875b5` |
| @anarchitects/editorjs-tool-paragraph | `5c504467baa6682a4693e57eedf12376f297bcb96838ee70dba76b7897c277ea` |
| @anarchitects/editorjs-angular        | `3f83bc8360a84b6927221d5650f029f538d73d4fffaf88dc6052f0683965abea` |
| @anarchitects/editorjs-upload-fetch   | `1b9ac5c6c9b1837159e6acf8746c7637a2d44c6707f2a4a168bbd6618355068f` |

The retained `snapshot.json` records archive names, platform and selected versions.
Preparation evidence also includes Forms-absent and installed locks, independently
installed portable/Nest consumers and version-resolution records. These generated
artifacts remain outside Git; CI retains its own Linux snapshots/locks and reports.
