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

Validation is in progress for this PR. Final local matrix, invalidation and hosted
coordinator evidence will be recorded here after execution; no hosted result or
cost improvement is claimed by the implementation alone.

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
