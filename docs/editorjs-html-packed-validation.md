# Packed renderer compatibility and Nx validation

Evidence for [#687](https://github.com/anarchitects/anarchitecture-community/issues/687),
4 November 2026, based on #686 merged at
`6cb241a56368b5dafeff52ae3cc833c4a99b8b71`.

## Architecture preflight

Freshly enumerated and read all nine Community ADRs and all 18 Meta ADRs before
implementation, including proposed, historical and superseded content. The remote
Meta recursive inventory matched the clean adjacent checkout at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. No additional local ADR directory or
nested AGENTS file was found.

Community inventory: 0001 governance boundaries, 0002 canonical model, 0003
core/adapter/extension/host ownership, 0004 public package documentation, 0005
SSR/HTTP composition, 0006 Nest12 SSR compatibility, 0007 independent versions,
0008 HTML rendering and the named Modern Angular 22 signal-forms ADR. All accepted.
Meta inventory: both 0001 records, 0002–0007, both 0008 records, 0009–0015 and
ADR-0001 landscape. Cooperative governance, hierarchy, Archi and layering remain
proposals; historical observations in 0014 do not override its accepted current
policy.

Read the Modern Angular index and repository application, architecture, providers,
reactivity, rendering, SSR/builds and testing/migration guides, relevant Editor.js
Angular packaging guidance, Angular skill testing/rendering references and Angular
MCP best practices. Used the installed Nx component generator after source/schema
and help inspection and dry run for the corpus consumer; no new workspace project.

Applicable decisions:

- Community0008 owns the exact proof cells, neutral runtime/declaration boundary,
  strict/preview safety contract, semantic fidelity, shared corpus, normal Angular
  binding, host-owned hydration and immutable scoped configuration. Browser-only
  authoring code must remain outside renderer consumers and display routes.
- Angular A01/A02/A03/A05/A06/A09/A10 require actual versioned packed evidence,
  explicit standalone imports/ownership, computed state, signal contracts,
  request isolation and real hydration. Ordinary provider arrays remain the
  accepted renderer-specific refinement; no new provider policy is introduced.
- Community0004 requires complete archive READMEs and compiled public recipes;
  implementation/evidence instructions remain outside consumer guidance.
- Community0007/Meta0013 retain independent 0.0.1 distributions and exact Nx init
  scopes. Fresh npm lookups returned E404 for both packages; remote tag/release
  inventories contain neither package. No publication/version bump is authorized.
- Meta0015 requires accurate inputs/prerequisites/outputs, cache restoration and
  invalidation, uncached fresh installation/completeness, and separate remote/DTE
  proof. No hosted monitoring, reruns or capacity experiments were authorized.
- HTTP/Nest policies and existing authoring support remain unchanged. #695 owns
  broader affected-aware CI selection; #696 owns branch-protection reconciliation.

No unresolved accepted-decision conflict was identified. This validation does not
introduce a new renderer, sanitizer, authoring dependency or browser/OS matrix.

## Consumer and task structure

The existing headless and Angular packed harnesses now support immutable preparation
and deterministic execution phases. A single checked-in matrix owns four neutral
Node cells (22.12.0, 22.22.3, 24.15.0, 26.0.0) and three Angular/Node pairs
(22.0.0/22.22.3, 22.1.4/24.15.0, 22.2.2/26.0.0). Angular compiler/CLI/build/SSR
match each cell exactly; TypeScript is 6.0.3. Native CommonJS is not advertised.
The Angular peer alternatives enumerate proven versions, without claiming a whole
minor range. Workspace authoring dependencies are not upgraded.

Fresh preparation installs actual core/headless/APF archives in independent
consumers, records locks and archives, provisions the exact Node binary outside
the neutral consumer, and seals the installation in a hashed tar snapshot. There
are no source aliases or dependency symlinks to workspace packages. The neutral
consumer's package closure excludes Angular, Forms, Nest, Nx, authoring packages,
TypeScript and Node ambient types. Tooling executes from outside that closure.

Nx infers 16 independently cached validation atoms: one complete neutral consumer
proof per Node cell, and separate build, behavior, corpus and isolation atoms per
Angular cell. Each Angular test depends on its corresponding production build;
that build output is restored and checked before execution in a fresh temporary
consumer. Files/ports are isolated; servers bind ephemeral loopback ports.

Preparation and required-evidence collection are uncached. Runtime inputs verify
source/configuration identity, selected versions, archive/lock identity, snapshot
integrity, the actual Chromium headless-shell installation, coordinator Node, OS/architecture/libc and
workspace location. Environment inputs include CI, NODE_OPTIONS, browser location,
build workers and run ID. Results include content manifests; the collector rejects
missing, extra, corrupt, failed, wrong-cell, wrong-phase or stale evidence. A prior
complete report is removed before collection starts.

Snapshot reuse is intentionally bounded to one preparation/run ID and compatible
machine identity. This establishes local replay/restoration; it does not claim
cross-run or cross-machine remote reuse. Transport/relocation and actual DTE
scheduling remain explicit rollout work. No new hosted job or hand-maintained
GitHub matrix was added: the existing SSR job invokes the inferred targets and
collector; the redundant single headless packed invocation is removed.

## Behavioral evidence

The neutral proof checks actual ESM imports without DOM/I/O access, public exports,
ES2022 declarations and all README recipes under NodeNext and Bundler resolution
without framework/DOM ambient types, production browser bundling, standard and
custom/tune semantics, and the existing shared adversarial browser corpus.

The Angular proof retains component/directive updates, failure clearing/recovery,
strict/preview/empty states, application/route/element/instance scopes, concurrent
request data and route-policy isolation, JavaScript-disabled SSR and script-gated initial DOM/host
hydration parity. It also exercises CSR and prerender routes.

The separate corpus route passes the same adversarial inputs through headless,
component and directive rendering and compares actual browser DOM/results. It
includes aliases, custom/override/tune/helper paths, default/narrowed URL policies,
invalid content models, authored/decorative/missing alt, nested list counters,
checklist text, quotation attribution and escaped literal code with a tune wrapper.

Isolation checks inspect production build inputs and actual public-route requests
through hydration/idle, with no authoring nodes or evaluation. A deliberately
loaded control bundle contains real Editor.js, Paragraph and the authoring Angular
APF; the same build detector rejects it and the browser observes its download and
export evaluation. This control is isolated from the installed renderer dependency
closure and is never a public-route production dependency. Bundle byte/gzip sizes
are recorded as measurements, not performance guarantees. Browser/page/hydration
errors fail their owning atom.

## Reproduction and results

Use the workspace's Node/Yarn toolchain and installed Playwright Chromium:

```sh
export EDITORJS_RENDERER_RUN_ID=renderer-review-unique
# Choose a new run ID for every fresh preparation or source change.
yarn nx run editorjs-html-angular:packed-prepare
yarn nx run-many -p editorjs-html-angular \
  -t "$(node packages/editorjs/html-angular/tools/packed/run.mjs targets)" \
  --runId="$EDITORJS_RENDERER_RUN_ID" --parallel=2
yarn nx run editorjs-html-angular:packed-collect
```

Generated input evidence lives under `dist/editorjs-renderer-inputs/<runId>`;
restorable builds, proof summaries and result manifests live under
`dist/editorjs-renderer-results/<runId>`. These artifacts are not committed.

Local run `si687-final` passed all seven fresh installations and all 16 proof
atoms (16 cache misses, 1m34s). Coordinator: Node 24.22.2, Yarn 4.18.0,
Nx 23.2.1, macOS arm64; every consumer executed its selected Node binary.
Build/typecheck/lint and 598 headless + 35 Angular unit tests passed; the three
harness integrity tests passed. Resolved targets contain seven uncached
preparations, 16 cached proofs and an uncached collector.

Each headless cell compiled six README recipes and passed 756 adversarial browser
cases plus 30 invalid-fragment omissions and accessibility checks. Each Angular
cell compiled seven README recipes and passed 1,169 shared corpus cases through
both component and directive, request/instance policy tests, CSR/SSR/prerender,
hydration DOM parity and the authoring isolation negative control. Browser and
hydration error collections were empty.

The tested source/configuration digest (independent of Git metadata) was
`58230a13bb7bfd0e86fff5594dff8c55dd0d5b7f9a6147fd9af0fe1106c00799`. All cells used identical package archives:

| Archive      | SHA-256                                                            |
| ------------ | ------------------------------------------------------------------ |
| core         | `af9c399df59a106dc03a03dca40c91a524afb2fc404b25a0f0ad9d0cb1867c22` |
| html         | `78bde900a0211b3c04ad7985daedbf57b4b6c8853424969285d43429afae35e8` |
| html-angular | `815efe3afb4d021a75ca4fa752a6be1db6e0b11f46a43c5ed3bdd7630f5fe9ef` |

Snapshot and consumer lock identities below identify the exact installations.
Each snapshot manifest additionally records its separate Node runtime lock.

| Cell               | Snapshot SHA-256                                                   | Consumer lock SHA-256                                              |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| angular-current    | `b9dd3902997b0bc51953096d0c2d34c65b21a4a82c504f339915c35e0491072d` | `08c5a5458b0df647da2268e2e278fc590048366d3f0d740f2038d0be5edd8fd3` |
| angular-minimum    | `89515174010b35c5423b3d494efd2a796b3f4824a0d0aea20880271be4385d78` | `f64c88ad352ef47f397bdb51c0898862da637a29e74d47bff0dfb7fcad993489` |
| angular-reference  | `1d20a398c7576f337577e57412b032d7bd67a345882bef7998c3a1266d7e05a3` | `6ee1c7b4a9783396af335805cebbbae71c05105436104c461855e848ab276c57` |
| headless-current   | `384217669aa9b3f59039b58e66ed53a006fa05ff4efccf844fed0568ab29ce02` | `4f0d42ac31ca9a9ffc800bf545b6b9ac0223d5c480ff8d63da0f17f9fafd2559` |
| headless-floor     | `1d25b49ece5bfac5afedc8e576e48954c7e61e3e9041d81f86fd8ca45a372c39` | `4f0d42ac31ca9a9ffc800bf545b6b9ac0223d5c480ff8d63da0f17f9fafd2559` |
| headless-minimum   | `8e1c5989695858a09ebcd1ee58738e08c255d4e4074310c9a1d2da08c0f8bb26` | `4f0d42ac31ca9a9ffc800bf545b6b9ac0223d5c480ff8d63da0f17f9fafd2559` |
| headless-reference | `888a032bc1d7a8b28f550d2667cd6bc6949c79151b4752a4b62a96d75604ce66` | `4f0d42ac31ca9a9ffc800bf545b6b9ac0223d5c480ff8d63da0f17f9fafd2559` |

Warm replay produced 16/16 local hits. After moving the entire result directory
away, a second replay produced 16/16 hits and restored all 134 files byte-for-byte;
the uncached collector then verified all 16 required results. Source and lock
mutations failed before execution; a changed snapshot byte failed integrity
validation. Missing/corrupt result artifacts and changed execution environment
failed the real collector, with every temporary mutation restored. Changing
NG_BUILD_MAX_WORKERS produced a cache miss; restoring the original environment
restored the original result from cache, and final collection passed. Harness unit
tests additionally reject failed, stale, empty, wrong-cell/phase and extra evidence.

Production browser bundle totals (including lazy corpus code) were 475,701 bytes /
159,880 gzip for Angular 22.0.0, 483,666 / 163,218 for 22.1.4 and 483,874 /
163,369 for 22.2.2. Per-file measurements remain in each isolation summary.

## CI headless-shell correction — 4 November 2026

[Run 41882030053](https://github.com/anarchitects/anarchitecture-community/actions/runs/41882030053/job/126756676051)
passed fresh installation but all seven initially runnable renderer atoms failed
before browser execution. The identity helper read `chromium.executablePath()`,
which points to full Chrome; CI intentionally installs `chromium --only-shell`.
The collector failed for the same reason. Other jobs in that run passed.

Repeated the complete nine-Community/18-Meta ADR review for this correction against
clean Meta checkout `47e75544673037d25665c8c9305c809802b58261`, including proposed
and historical records, and the relevant Angular testing/SSR guides. Community0008,
Angular A09/A10 and Meta0015 require real browser evidence and correct cache inputs;
Community0004 keeps this diagnosis in contributor documentation. No decision
conflict or package compatibility change is introduced.

The helper now obtains the selected headless-shell directory from the installed
Playwright CLI's read-only install plan and hashes its files, including executable
and runtime resources. It respects `PLAYWRIGHT_BROWSERS_PATH` and fails on missing,
empty or ambiguous installation evidence. It requires neither the full Chrome
installation nor private Playwright registry APIs. Existing CI installation and
browser launch settings remain unchanged.

Regression coverage checks shell-only layouts, executable/resource invalidation,
missing/empty installations and malformed/duplicate install plans. Local validation
uses a separate browser cache exposing only the installed headless shell; the old
full-Chrome read reproduces ENOENT there while headless launch succeeds.

Local run `si697-shell-fix` passed all seven fresh preparations and all 16 atoms
(16 cache misses, 1m41s), followed by the uncached completeness gate and a 16/16
cache-hit replay. The four harness tests and owning-project lint passed. Actual
Chromium remained 156.0.8078.4; no full Chrome executable existed in the selected
browser cache. Source/configuration digest:
`969b0bc161e75900e39dd68e77eb236f438d617946dfaf3d43f988a84a933973`.
Headless-shell installation digest:
`6a9517498194b18386aa1cd72e8efe5a774e313c739ccb77d4b5d9db0e828940`.
Per-cell snapshots, locks and results use the same artifact layout under this new
run ID. This is a local macOS reproduction of the installation layout; a successful
corrected Linux hosted run has not yet been claimed. No hosted rerun or monitoring
was initiated.

## Remaining hosted evidence

The subsequent [renderer readiness review](editorjs-html-release-readiness.md)
records the authorized one-off inspection of the corrected green CI candidate,
fresh packed evidence and the disposition of the remaining #679 exception. The
earlier observations above remain dated evidence rather than current CI status.

Remote restoration, actual worker scheduling/dependency ordering, failure
propagation and cross-machine artifact equivalence are not certified by local
atomization. Owner: Community maintainers; revisit when bounded hosted validation
is explicitly authorized, before #688/#679 disposition and final #75/#76 gates.
Keep this exception open; no CI monitoring or discretionary paid run is implied.
