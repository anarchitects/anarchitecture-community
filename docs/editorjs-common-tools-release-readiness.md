# Common Editor.js tools: release-readiness review

Review for [#616](https://github.com/anarchitects/anarchitecture-community/issues/616),
28 October 2026, after [#615 / PR #624](https://github.com/anarchitects/anarchitecture-community/pull/624)
merged at `51fbdb756582d21ee95b599bd3df1c325a860fa1`.
This records evidence for [epic #71](https://github.com/anarchitects/anarchitecture-community/issues/71).
It does not authorize publication or certify an eventual release commit.

## Architecture review

Read all eight Community ADRs under `docs/adr` and all eighteen Meta ADRs at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`, including proposed and historical
records. The remote Meta inventory matched the reviewed checkout. Read the Modern
Angular index, repository application, architecture, providers, reactivity, Forms,
rendering, SSR/builds, testing, validation and API ledger guides.

Community ADR 0004 requires complete consumer guidance in the actual archives;
history and fixture instructions remain here. Modern Angular requires public
entry points, native optional Signal Forms, request-owned state and bounded
compatibility evidence. Meta 0013 / Community 0007 require independent distribution
history, exact Nx commit scopes and first releases at 0.0.1. Meta 0015 requires
accurate cache inputs, outputs, dependencies and measured DTE. Governance proposals
remain proposed; HTTP/Nest decisions preserve existing runtime behavior. No accepted
decision conflict or amendment is needed. No API, manifest, dependency, supported
range, task topology or runtime implementation changes in this review.

## Consumer contract review

Each package README contains installation, direct Editor.js and standalone Angular
examples, inert lazy definitions, typed config/defaults, saved-data validation,
owner cleanup and failure recovery. The revised guidance makes the exact tested
combinations and mixed-document validator policy explicit. Image guidance explains
mount/save/destroy, Angular startup and retry ownership. Each README remains useful
without this contributor record.

| Package / exact Nx project | Upstream dependency          | Contract requiring particular attention                                                                                                                                                  |
| -------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editorjs-tool-paragraph`  | `@editorjs/paragraph@2.11.7` | Editor.js already has a paragraph. Explicit `replace: true` selects the package implementation; aliases require matching default-block references. Blank retention is configurable.      |
| `editorjs-tool-header`     | `@editorjs/header@2.8.9`     | Levels are integers 1–6; a restricted level set requires an included explicit default. Hosts own the document outline.                                                                   |
| `editorjs-tool-list`       | `@editorjs/list@2.0.9`       | Only nested 2.x data with required metadata is validated. Legacy conversion is host-owned. Structurally valid empty root items cannot be mounted by this upstream version.               |
| `editorjs-tool-quote`      | `@editorjs/quote@2.7.6`      | Saved alignment is left/center; upstream's editing appearance does not reflect centered alignment. Hosts style published output.                                                         |
| `editorjs-tool-image`      | `@editorjs/image@2.10.3`     | Both core uploader methods are required; browser input is Blob, including File. No endpoint fallback, transport, retries or automatic Forms upload state. Alt is independently authored. |

All five have DOM-free roots and explicit DOM/browser entries. Browser declarations
are verified with Bundler resolution; pure roots also support NodeNext with ES2022
and no DOM libraries. Upstream browser NodeNext declarations remain a known limit.
Browser evaluation installs global CSS; there is no separate CSS import or promise
to unload styles. No Angular/Forms dependency, all-tools barrel or per-tool Angular
provider/control is required. `config.tools`, including `{}`, still overrides the
Angular provider's entire map. Definitions do not install data validators.

Core validators are structural, bounded and nonmutating. Hosts still own HTML and
URL policy, persisted-data generation/migration, publication and public rendering.
Adding validators for every permitted block is necessary when rejecting unknown
tools, including the built-in paragraph in mixed documents.

## Image alt and blog readiness

[#614](https://github.com/anarchitects/anarchitecture-community/issues/614)'s
[image workflow evidence](editorjs-image-validation.md#validation) covers native
keyboard authoring, uploads, literal metadata, caption/display independence,
save/render, read-only behavior, failure recovery and completion after removal.
[#615](https://github.com/anarchitects/anarchitecture-community/issues/615)'s
[combined evidence](editorjs-common-tools-validation.md#consumer-and-delivery-contract)
extends this to generic hosts, standalone Angular, native Forms and hydrated
owners, including a controlled image projection.

The [public image contract](../packages/editorjs/tool-image/README.md#alternative-text-and-saved-data)
distinguishes visible caption/attribution from alternative text:

- Missing `alt` means unset, including legacy data and an empty description. It is
  preserved as missing until the author makes a choice; structural validation
  does not impose publication completeness.
- A nonblank string is literal authored text. Filenames, captions and upload
  metadata never supply it implicitly.
- Only an explicit Decorative choice creates `alt: ""`. Null, nonstrings and
  whitespace-only descriptions are invalid saved data.
- Hosts assign present alt through DOM properties or escaped framework bindings,
  preserving the deliberate empty string. Missing alt needs an explicit editorial
  policy; it must not silently become decorative.

The bounded authoring/round-trip requirement is demonstrated. **A complete blog
is not certified:** its renderer and publication validation must enforce that
policy; storage/migration and production upload security remain host work. These
are blog-readiness blockers until the adopting application demonstrates them.
Comprehensive accessibility, non-Chromium browsers, strict CSP, shadow roots and
alternate documents remain unverified. Upload completion can replace the caption
view and lose its selection; disposal cannot cancel already-started host uploads,
FileReader work or blob fetches. None of these limits is hidden by the alt tests.

## Exact validation baseline

| Consumer cell | Angular runtime/compiler/build | Node    | TypeScript | Editor.js |
| ------------- | ------------------------------ | ------- | ---------- | --------- |
| minimum       | 22.0.0                         | 22.22.3 | 6.0.3      | 2.31.7    |
| reference     | 22.1.4                         | 24.15.0 | 6.0.3      | 2.31.7    |
| current       | 22.2.2                         | 26.0.0  | 6.0.3      | 2.31.7    |

These are the matrix's exact tested combinations, not every permitted Node or
Angular peer version. Neutral-package CI additionally checks Node 22.12.0, the
declared minimum. Local orchestration uses Node 24.22.1 on macOS arm64; hosted
packed orchestration uses Node 24.22.1 on Ubuntu 22.04 x64. The locked browser
runner is Playwright 1.64.0 with Chromium/headless-shell 156.0.8078.4, revision 1248. Nx is 23.2.1; Yarn is 4.18.0. Upstream versions are listed separately above.
The five tool manifests, core and Angular wrapper are 0.0.1.

| Layer                            | Evidence and practical limit                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/config/data/types/artifacts | Per-package [paragraph](editorjs-paragraph-validation.md), [header](editorjs-header-validation.md), [list](editorjs-list-validation.md), [quote](editorjs-quote-validation.md) and [image](editorjs-image-validation.md) records; package tests inspect real tarballs and compile pure public declarations without Angular or upstream installed. |
| Independent installation         | Fresh CSR preparation installs each tool separately with core and Editor.js, asserting that Angular and the other four tools cannot resolve: 15 independent roots across three cells.                                                                                                                                                             |
| Actual public examples           | Preparation extracts marked examples from each packed README, compiles direct-browser examples and Angular examples before Forms is installed. Each package contributes four units; fixtures do not substitute for their text.                                                                                                                    |
| Generic and Angular              | #615's full matrix retains individual-tool tests and adds 39 combined/portable cases, standalone consumers and native Forms dirty/touched/reset/disabled/readonly behavior.                                                                                                                                                                       |
| SSR/hydration                    | Empty real SSR holders, server import guards for actual browser tools, sequential/concurrent request isolation, disposal, and 27 combined hydration cases across three hydration profiles and version cells.                                                                                                                                      |
| Production delivery              | 36 isolation cases with upstream/browser-entry provenance, CSS/request/evaluation checks, cold public navigation, paragraph-only selection, positive authoring and eager negative controls.                                                                                                                                                       |
| Cache correctness                | #615's final local cold/replay proof: 5 misses, then 5 hits restoring 415 files byte-for-byte. Source/dependency/config/helper/environment invalidation and failed-output propagation are recorded [with their limits](editorjs-common-tools-validation.md#local-cache-and-invalidation).                                                         |

### Hosted DTE evidence

The complete configured [#615 CI run 40692061932](https://github.com/anarchitects/anarchitecture-community/actions/runs/40692061932)
passed all 12 jobs on source commit `e8f36d4657aa033c7cfa40e5cfe0034a4e013d73`.
The [packed job](https://github.com/anarchitects/anarchitecture-community/actions/runs/40692061932/job/122829115190)
records **69 successful tasks, 0 cached tasks and 3 workers**, with distributed
completion at 13:10:11 UTC. All six uncached coordinator collection gates passed,
then `complete-ci-run` completed. [Nx Cloud run CY0D4BDc90](https://cloud.nx.app/runs/CY0D4BDc90)
contains task details. Job duration including provisioning/preparation/upload was
13m35s; this is an observation, not a comparison proving optimal cost or capacity.

The workflow keeps six fresh installs outside DTE and requests every atom so
intermediate artifacts and results return to the coordinator. The successful
completeness gates establish usable distributed outputs. This run had no cache
hits: it does **not** establish cross-run remote reuse, clean hosted warm replay or
remote failed-output restoration. CI maintainers own that remaining Meta0015
measurement before claiming those guarantees or a cost/performance improvement.
The earlier missing-unzip worker-init failure is historical and did not block this
run. Evidence artifact `editorjs-angular-packed-evidence` was uploaded as
`12819230173`; retention is seven days, so preserve release evidence separately.

## Independent release history and intent

On 28 October 2026 each npm registry endpoint was queried independently. Remote
Git tags were enumerated (234 refs including annotated dereferences), and all 102
GitHub Releases were inspected across both pages. No Editor.js package had a
matching tag/release. This absence check is dated evidence and must be repeated
before publication; a manifest version alone never proves distribution history.

| npm name (`@anarchitects/` prefix) | npm result    | Matching tag / release | Development intent / initial distribution |
| ---------------------------------- | ------------- | ---------------------- | ----------------------------------------- |
| `editorjs-tool-paragraph`          | 404 Not found | none / none            | `init(editorjs-tool-paragraph)` / 0.0.1   |
| `editorjs-tool-header`             | 404 Not found | none / none            | `init(editorjs-tool-header)` / 0.0.1      |
| `editorjs-tool-list`               | 404 Not found | none / none            | `init(editorjs-tool-list)` / 0.0.1        |
| `editorjs-tool-quote`              | 404 Not found | none / none            | `init(editorjs-tool-quote)` / 0.0.1       |
| `editorjs-tool-image`              | 404 Not found | none / none            | `init(editorjs-tool-image)` / 0.0.1       |
| `editorjs-core`                    | 404 Not found | none / none            | `init(editorjs-core)` / 0.0.1             |
| `editorjs-angular`                 | 404 Not found | none / none            | `init(editorjs-angular)` / 0.0.1          |

Nx lists these exact project names, uses independent relationships, tags
`{projectName}@{version}`, Conventional Commits and non-bumping `init`. Each tool
depends on core `^0.0.1`, its exact upstream version and Editor.js peer `2.31.7`.
No tool depends on another tool or Angular. Core must be available for public
installation; Angular is separately optional. Shared starting versions do not
create lockstep releases. Existing published packages elsewhere in the workspace
retain their own histories and ordinary Conventional Commit semantics.

## Final archive and release gates

The #616 verification below is completed against the revised public README bytes;
its hashes identify reviewed local archives, not already published artifacts.

Fresh preparation `tools-616` passed all six CSR/SSR cells in 148 seconds with
three local task slots. All 15 independent installations passed; the 20 marked
public tool example units compile in the packed generic/Angular preparations.
The five packages' Nx test, typecheck and lint targets passed, including their
archive and ES2022-only public-declaration checks (22 tasks with prerequisites,
two cache hits). Browser runtime identification confirmed Chromium 156.0.8078.4.
The full #616 matrix passed all 69 atoms (0 cache hits) in 7m55s, followed by
all six uncached completeness gates. This includes the retained individual-tool,
README, native Forms, SSR and lifecycle tests and the combined #615 cases.
Formatting, relative documentation links and whitespace checks also passed.
Hosted results for this documentation commit belong to the #616 PR checks;
the completed #615 hosted run above is prior evidence, not a substitute.

Every reviewed tool archive contains byte-identical source README and LICENSE,
expected JS/declarations and public exports; exact upstream and core dependencies,
Editor.js peer and browser side-effect metadata match the contract. No src/tests
or tsbuildinfo entries are packed. Browser modules reference the separately
installed upstream distribution; global styles/assets are covered by the production
delivery checks, not assumed from the archive file list.

| Reference CSR tool archive (0.0.1) | Files | Bytes | SHA-256                                                            |
| ---------------------------------- | ----- | ----- | ------------------------------------------------------------------ |
| paragraph                          | 11    | 11209 | `1d3cda4402e83fddad9375388da46a6ff8d25ea4bfc01782bb995e5488b7add0` |
| header                             | 11    | 11732 | `098d8ba39ca9ad404b226434fd61a0a1fc41718696a2f0580b54de3cbf7a7308` |
| list                               | 11    | 13620 | `246aed4b788bd1216e12fe7ca3897e62abb2d2cd133021c1400cbf18d6f92b5a` |
| quote                              | 11    | 11779 | `e157d434b0a2b420e300baa900e67d24a1ffec134a7c09665ef372d6f0503769` |
| image                              | 12    | 15269 | `e49e7712708c3af2f155578cca34c2846f228b09478763cf56c9c569326370c3` |

The table identifies the reference CSR archives (also used by reference/current
SSR). The minimum/current CSR and minimum SSR preparations captured another
valid declaration emitter output while the separate local typecheck invocation
was completing. Tar-member comparison found declaration import/quote formatting and comment
changes; runtime JS, README and manifest bytes agree. Both variants passed their
packed example compilation. This is not a claim of byte-reproducible builds across
`build` and declaration-emitting `typecheck`. All six cells were inspected, and
snapshot/cache keys retain their own actual archive digests. The second set is:

| Tool      | Minimum/current CSR and minimum SSR SHA-256                        |
| --------- | ------------------------------------------------------------------ |
| paragraph | `ad3ba0eda02651c40d1353d3cc01dd4eecf7ec71b05a16f253dc640ccedca19e` |
| header    | `67bc2525168e2b786b4a6c21fc3b979129d43a1ef570997fd8973f28d1eeecb0` |
| list      | `d0b1795f430d8320656583ef7f0420738427eda09511e8f09f831f6ec368ebc2` |
| quote     | `735dbe6ed5bbbf50ac99e6fa68e00437bc8715bbf82919a5962467dc04ccc84a` |
| image     | `1da48139967c545433fe72d5afbbc4b5d173c53ff527ece62d151b4479feaa58` |

Do not overlap typechecking/building with final release packaging. Complete checks,
then run the final build and pack/review its exact bytes; the release owner must
retain those new hashes rather than treating either local set as a published
artifact. CI maintainers should revisit separate declaration output ownership if
concurrent independent invocations become a supported workflow.

Archives and resolved locks are retained locally under
`dist/editorjs-packed-inputs/tools-616/{csr,ssr}/<cell>/evidence`; collected
reports are under `dist/editorjs-packed-results/tools-616`. These generated
artifacts are not committed.

To reproduce with the repository's pinned toolchain, run through Nx:

```sh
yarn nx run-many -p editorjs-tool-paragraph editorjs-tool-header editorjs-tool-list editorjs-tool-quote editorjs-tool-image -t test typecheck lint
yarn nx run editorjs-angular-e2e:e2e-packed --phaseParallel=3
yarn nx run editorjs-angular-e2e:e2e-packed-ssr --phaseParallel=3
```

The aggregates prepare fresh external installations, run the same atom graph and
collect completeness evidence. They require registry access and installed
Playwright browsers. Do not edit package or fixture inputs between preparation
and execution: source fingerprints deliberately reject stale snapshots.

Before any future release, maintainers must:

1. Repeat npm/tag/release history checks per selected package and verify the
   accepted first version, exact project scope and core dependency availability.
2. Require every configured CI check green on the **actual release commit**,
   including neutral packages, packed matrix, SSR/hydration and DTE collection.
   An earlier PR's green result is not that gate.
3. Review the exact archives to be distributed: README and Apache-2.0 LICENSE,
   root/browser JS and declarations, exports and resolution, embedded upstream
   assets/style behavior, upstream MIT licensing, dependencies/peers and absence
   of tests/source/build-state leaks. The workspace-only source export condition
   is not a consumer entry and must not be enabled by published consumers.
4. Recompile actual archived README examples and retain archive hashes, resolved
   locks, exact versions, browser reports and hosted run links beyond CI retention.
   Review explicit limitations and any remaining adopting-blog blockers.

Publication remains [#76](https://github.com/anarchitects/anarchitecture-community/issues/76)
and requires a separate instruction. #72 owns reusable uploads/retries/state;
#73 broader custom-tool integration; #74 persistence; #75/#78 broader demos/testing.
This issue does not start those workstreams, merge, bump versions or publish.
