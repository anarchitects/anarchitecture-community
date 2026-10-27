# Header implementation and validation

Issue: [#611](https://github.com/anarchitects/anarchitecture-community/issues/611).
This slice follows the [common tools contract](editorjs-common-tools-design.md)
and merged paragraph package (#618). Combined five-tool certification remains #615.

## Architecture preflight

On 27 October 2026, before generation or edits, all eight Community ADRs and all
eighteen Meta ADRs were enumerated and read, including proposed and historical
records. Community started clean at `37ffc2cb527a2eacae4b6d0b84597106f516a25c`;
Meta was at `823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. The only local ADR directory
found was `docs/adr`. The complete inventory in the
[registry review](editorjs-tool-registry-design.md#architecture-review-and-authority)
remains applicable.

The Modern Angular index, repository application, architecture, providers/routing,
reactivity, Forms, rendering, SSR/builds, testing/migration, validation and API
ledger were reviewed, along with Nx generation/workspace/task/linking skills and
Angular guidance. The Nx JS library generator scaffolded the package; Yarn
workspace commands added the core/upstream dependencies, Editor.js peer and host
dependency. Project references were synchronized for the affected projects.

Applicable constraints: neutral packages and explicit browser activation; public
registry/validation contracts; existing standalone Angular composition and optional
native Forms; packed consumer/documentation evidence (local 0004 and Modern Angular
decisions); exact Nx scope and actual distribution history (local 0007/Meta0013);
and accurate task inputs, outputs and distribution boundaries (Meta0015).
Governance proposals and HTTP/Nest decisions retain their original scope. No
accepted decision conflicts with this implementation and no exception is requested.

## Public seam and bounded behavior

- Exact upstream header 2.8.9 and Editor.js 2.31.7 peer, TypeScript 6.0.3. Header's
  upstream dependency on Editor.js is disclosed separately from root import purity.
- `/browser` exports the actual upstream constructor, checked against Editor.js's
  public block constructor contract. Unlike paragraph, no constructor adapter is
  needed. Read-only support and constructor identity are checked independently.
- Root configuration uses `HeadingLevel` and accepts readonly level arrays without
  changing caller identity. Supplying levels requires a nonempty unique set from
  1–6 and an explicit included default. Defaults remain upstream-owned, including
  level 2 when both level settings are absent. Single-level subsets have a positive
  browser case. Level menu order follows upstream numeric order.
- Structural saved-data validation requires string text and integer level 1–6,
  checks additional JSON data through core's bounded parser, and does not coerce or
  mutate input. Numeric-string normalization by the raw upstream editor is
  documented separately. Config-specific level policy, HTML sanitization, document
  hierarchy, persistence and public rendering remain host responsibilities.

## Validation evidence

The package has 41 tests across configuration/registry/data behavior, browser
constructor identity and packed exports/declarations. Build, typecheck, lint and
tests pass on Node 22.12.0; the CI minimum-runtime job now includes header. Generic
package tests require no Angular. The packed root imports with poisoned DOM globals
and without Editor.js, upstream header or Angular installed. Strict ES2022-only
declarations compile in NodeNext and Bundler modes with library checking enabled.

Fresh packed preparation installs the artifacts into independent direct and Angular
consumers, compiles all four README examples, verifies README identity and checks
Angular root composition without Forms. The reference cell uses Angular 22.1.4,
consumer Node 24.15.0, Editor.js 2.31.7 and TypeScript 6.0.3 on macOS arm64. Local
orchestration uses Node 24.22.1. Generated evidence and locks live under
`dist/editorjs-packed-inputs/header-611-a/csr/angular22-reference/evidence`, with
phase reports under the matching `dist/editorjs-packed-results` path.

The portable fixture and Angular host share one inert lazy definition. The browser
suite checks upstream module provenance, absence from the initial import closure,
cold request exclusion, positive post-mount requests and constructor instrumentation.
Direct behavior covers heading editing, inline HTML, level selection/order,
save/render, blank omission, placeholder, toolbox title, read-only, singleton/default
configuration and removal. Angular uses the existing provider and tests editing,
save/render/clear/read-only and independent owners. Existing paragraph and registry
cases continue to run in those atoms.

The final browser runs pass all five portable cases and all seven Angular editor
cases. The packed harness also passes all seven tests. Package build, typecheck,
lint and all 41 tests pass on both Node 22.12.0 and Node 24.22.1; affected host and
e2e typecheck/lint pass with existing warnings only.

## Nx cache and distribution assessment

The resolved project is `editorjs-tool-header`. Build restores `{projectRoot}/dist`
and depends on upstream builds. Test targets and three inferred test atoms include
Node version/platform/architecture, Node options, source, dependency source,
TypeScript configuration and lockfile inputs; each atom depends on build. The
collector retains all three test prerequisites. No public runtime dependency on Nx
is introduced.

The graph contains `editorjs-angular-e2e -> editorjs-angular-host ->
editorjs-tool-header`. Uncached packed preparation builds/packs header and includes
its source, manifest, README, license and TypeScript/Vite configuration in source
fingerprints. Archive and consumer-lock integrity remain in the immutable snapshot.
The existing 66 packed atoms remain unchanged in count; short header cases extend
the portable and CSR editor atoms. Fresh registry installation remains outside DTE.

Local build cache checks on Node 24.22.1 produced these task hashes:

| Input state                           | Hash                   | Result          |
| ------------------------------------- | ---------------------- | --------------- |
| Baseline, warm, restored and reverted | `6804689453100780620`  | Local cache hit |
| Header source changed                 | `5927867019632941059`  | Cache miss      |
| Vite configuration changed            | `18102430526016603196` | Cache miss      |
| Core dependency source changed        | `16263986080603839906` | Cache miss      |
| Lockfile changed                      | `18395878436512678904` | Cache miss      |

Removing the generated output before the restoration run restored all eight files
with matching content hashes. All temporary input changes were reverted, and the
original hash was recovered. Local reuse does not establish remote cache reuse or
equivalent execution on multiple workers.
The existing hosted workflow and #615 own that proof, including failure propagation,
resource isolation and cleanup. Revisit on this PR's hosted run; do not infer hosted
success from local parallelism.

Local environment note: after Yarn relinking, workspace-wide TypeScript sync also
proposed removing pre-existing references in the unrelated Nest CJS/ESM consumers.
Those generated changes are excluded from this slice. Scoped validation uses the
supported `--skipSync` flag after checking the affected Editor.js references; cache
and task dependencies remain enabled. No sync bypass is added to CI or committed
workspace configuration. Maintainers should revisit the fixture-specific sync
behavior if it reproduces in the clean hosted environment.

## Distribution and remaining gates

The registry returned 404 for `@anarchitects/editorjs-tool-header`, remote matching
tags were empty, and none of 102 GitHub releases mentioned the package. It therefore
uses non-bumping `init(editorjs-tool-header)` with manifest version 0.0.1. No merge,
publication, version bump or next slice is authorized by this work.

Local browser evidence is bounded to the reference cell and Chromium. Other pinned
cells and hosted DTE remain CI verification; combined tools and comprehensive
accessibility remain #615/#616. Browser evaluation injects global CSS and the raw
upstream constructor has narrower mutable-array types than the pure definition
config. Public examples use the supported registry/map boundary. Root imports and
declarations remain DOM-free.
