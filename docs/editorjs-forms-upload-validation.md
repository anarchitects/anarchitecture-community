# Native Signal Forms upload composition (#630)

## Architecture preflight — 29 October 2026

Read all eight local ADRs and all eighteen Meta ADRs, including proposed and
historical records. The adjacent Meta checkout matches the remote ADR inventory.
Read the Modern Angular index, repository application and architecture, provider,
reactivity, Forms, rendering, SSR, testing, validation and API guides.

Applicable accepted constraints: Modern Angular A01–A12 require native Signal
Forms, explicit component lifetime, browser-only editor loading, public imports
and packed consumer evidence. Local ADR 0004 requires compiled consumer README
examples. Local 0001–0003 preserve neutral core ownership; 0005–0006 and Meta
0008–0012 preserve current Nest/Fastify compatibility and transport boundaries.
Meta 0013/local 0007 require exact Nx scopes and non-bumping initialization for
unreleased packages. Meta 0015 requires resolved cacheable atoms, complete
inputs, isolated outputs and cache restoration evidence. Meta governance
proposals remain proposals; no package/default/dependency migration is implied.

The Forms guide's earlier phrase “wait for validation” conflicts with the
installed/public Angular 22 submit contract: `ignoreValidators: 'none'` blocks
while pending. The guide is corrected; the recipe blocks and requires a new
attempt after completion. Upload activity never becomes validation pending.

The selected public surface is an optional host recipe using the existing upload
owner, `EditorJsControl`, `validate` and `submit`. No new Forms facade is needed.
Reset replaces the editor/tool/owner generation even when values are unchanged.
Logical disposal does not claim transport cancellation or storage rollback.

## Public composition and fixture ownership

The packaged README contains a complete `forms-upload-editor.ts` recipe, compiled
from the actual archive. It creates one owner per session, derives upload errors
with native `validate`, gates new DOM interactions and uploader calls before
snapshot capture, reconciles the authoritative snapshot and calls native `submit`.
The lock covers capture as well as the submission action; `pending` is untouched.
The example deliberately has no native HTML form, so pre-hydration click/Enter
cannot navigate. An ancestor form remains the adopting host's responsibility.

Native server errors retain Angular's lifecycle: errors on edited fields clear
when those fields change. Upload acknowledgement does not write the form model or
its errors. Manual retry success leaves earlier failures until acknowledgement;
the overflow summary remains blocking. Snapshot reconciliation is an explicit
model write, not a fabricated control-origin dirty event. Browser checks wait for
Editor.js's accepted debounced change before asserting dirty preservation.

The private fixture validates body content with a stable resource key, excluding
the save timestamp so repeated captures do not restart completed validation.
It adds controlled validation, snapshot and persistence gates
around the same public composition. Its page-owned backend is shared by two
independent Forms editors. It exercises actual Image Tool file/URL behavior and
retains the standalone fixture. Reset invokes native reset and invalidation, then
replaces the entire session using a tracked generation, including same-value reset.

Reset ordering is covered beyond form signals: all held success/failure/exception
cases assert that no old Image Tool notification appears after reset or removal.
The session becomes unavailable synchronously; its parent then removes the child
editor/tool before `DestroyRef` disposes the upload owner. Disposing the owner
inside the reset event before that removal produced a spurious upload-failed
notification during development, and is deliberately excluded from the recipe.

## Reproduction and bounded compatibility

Use Yarn 4.18.0 / Nx 23.2.1. The local driver is Node 24.22.2 with Angular 22.1.4
and TypeScript 6.0.3. The fresh consumers retain the approved exact cells:

| Cell      | Angular | Node    | TypeScript | Editor.js / Image |
| --------- | ------- | ------- | ---------- | ----------------- |
| minimum   | 22.0.0  | 22.22.3 | 6.0.3      | 2.31.7 / 2.10.3   |
| reference | 22.1.4  | 24.15.0 | 6.0.3      | 2.31.7 / 2.10.3   |
| current   | 22.2.2  | 26.0.0  | 6.0.3      | 2.31.7 / 2.10.3   |

Run `yarn nx run editorjs-angular-e2e:e2e-packed-ssr --cell=all --phaseParallel=2`
with `NG_BUILD_MAX_WORKERS=2`. Each SSR-mode cell also builds and tests CSR,
compiles the root without Forms before installing it, runs native interoperability,
and verifies README CSR/SSR recipes and public-route isolation. The new file
atoms are `csr-forms-upload` and `hydration-forms-upload`; the latter runs the
production, diagnostic and full hydration profiles. Browser evidence is Chromium
only (Playwright 1.64.0), not an all-browser claim. Generic portable upload/Fetch
behavior remains the earlier slices' evidence; this change adds no generic code.

The resolved graph has 87 cacheable atoms: seven CSR and twenty-two SSR atoms per
cell. The nine additional atoms reuse the immutable snapshot, existing build
prerequisites, leased ports, unique reports and failure-preserving collection.
Fresh installs and completeness gates remain uncached and outside DTE. No CI
worker provisioning or concurrency setting changes in this slice.

## Release check — 29 October 2026

The public npm registry returned 404 for `@anarchitects/editorjs-angular`; all
117 repository tag references and 102 GitHub releases contained no Editor.js
release. Its manifest remains `0.0.1`, and Nx config explicitly maps `init` to
no bump. Use `init(editorjs-angular)` for the unreleased package recipe; private
fixture/test work can use the exact `editorjs-angular-e2e` project scope. No versions,
dependencies, exports or runtime package implementation change.

## Validation — 29 October 2026

Package/host/e2e lint and type checks (including the SSR host) pass. The Angular
suite passes all 196 tests, including packed exports, the compiled public recipe
and the root consumer with Forms absent. The packed harness's seven tests pass.

Packed run `d94ccc80-1fd5-4199-a26b-d10900ed4098` passes all 66 validation atoms
and all three completeness gates. Fresh preparation took 1m57s, the 66 cold atoms
10m00s, and the full local coordinator 12m03s. Existing native/legacy Forms,
standalone uploads, deferred hydration, SSR imports, public delivery isolation,
and compiled/executed README profiles pass alongside the new coverage.

The new Forms upload atoms pass
in every cell: 17 CSR cases and 18 cases in each of three hydration profiles,
**213 browser checks** total. Coverage includes concurrent owners, retry/failure
aggregation, safe error mapping, required/server error composition, native async
body validation, snapshot and submission locks, overflow acknowledgement,
dirty/touched, disabled/readonly, real file/URL uploads, caption/metadata/all three
alt states, reset/removal with held outcomes, stale snapshot fencing and no-JS
pre-hydration click/Enter behavior. Browser errors, unhandled rejections and
hydration diagnostics remain test failures.

This is local macOS/arm64 evidence. Remote cache reuse, hosted agent equivalence
and CI duration/resource measurements remain separate #632 evidence gates; this
record does not claim new hosted DTE measurements.

## Local cache verification

A direct six-task invocation (the two reference Forms-upload atoms and their four
build prerequisites) passed cold in 1m03s. Repeating that exact invocation used
6/6 local cache hits in 442ms. Before replay, both generated test report directories
were removed; all 26 files were restored byte-for-byte. The first direct invocation
was a cache miss despite the earlier coordinator run; only the identical-invocation
replay is claimed as cache restoration evidence.

For environment invalidation, the reference CSR upload atom and build first
replayed 2/2 hits (228ms). Changing only declared `NG_BUILD_MAX_WORKERS` from 2 to
1 produced 0/2 hits and passed both tasks (21.5s). Restoring 2 replayed the original
2/2 hits (214ms). Runtime/source/archive correctness checks remain in the existing
snapshot fingerprint and harness; no broad cache bypass was introduced.

## CI correction — 29 October 2026

GitHub Actions run `40875135136` failed all three CSR-only `build-csr` atoms:
the shared upload page imported `ActivatedRoute`, while those fresh consumers
deliberately do not install `@angular/router`. The earlier SSR-mode matrix
installed that peer and therefore did not expose the missing boundary. This was
a fixture dependency regression, not a DTE worker or cache failure.

The shared page now uses only its `forms` input. The SSR host enables Angular's
route-to-input binding and supplies explicit `forms: true` / `forms: false` route
data. The CSR host continues supplying the input directly. No peer is added and
no check, cache input, output or task dependency is weakened.

The correction re-enumerated and read all eight Community and eighteen Meta ADRs;
the Meta inventory still matches `823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`.
Modern Angular A02/A04/A09/A10 require explicit host composition and independent
consumer/build evidence. Meta 0015 requires preserving accurate cache/DTE
boundaries; local 0004 keeps this fixture diagnosis outside the package README.
No accepted-decision conflict or exception is introduced.

Correction validation passes host lint and CSR/SSR typechecks. CSR-only run
`26baee40-d279-4c54-b5ba-d52e18983502` passes all three fresh compatibility cells,
all 21 validation atoms and all three completeness gates (5m26s). This includes
the three previously failing builds, with the router still absent. Reference
SSR run `8ea59d43-a5b7-4ec3-8dca-932cb94dfacc` passes all 22 validation atoms and
its completeness gate (4m53s), including both upload routes in all three
hydration profiles, no-JS behavior and public-route isolation.
