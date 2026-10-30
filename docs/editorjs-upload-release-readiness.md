# Editor.js uploads: documentation and release-readiness review

Review for [#633](https://github.com/anarchitects/anarchitecture-community/issues/633)
and [epic #72](https://github.com/anarchitects/anarchitecture-community/issues/72),
30 October 2026. Baseline: merged [#640](https://github.com/anarchitects/anarchitecture-community/pull/640)
at `bc994697ee53ca685ce93b30bf1df2336058d535`.
This is a bounded package-readiness record, not certification of an eventual
release commit or a production blog. Publication remains a separate operation.

## Architecture review

All eight Community ADRs and all eighteen Meta ADRs were enumerated and read,
including proposed and historical records. Meta's remote tree and every ADR blob
match the clean checkout at `823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`.
The Modern Angular index, repository application, architecture, providers,
reactivity, Forms, rendering, SSR/builds, testing/migration, validation and API
ledger guides were reviewed.

- Community 0004 requires install-to-result consumer READMEs in the actual
  archives. This contributor record carries chronology, fixture and release
  evidence; ordinary package use does not depend on reading it.
- Modern Angular A02/A03/A07/A09/A10 preserves neutral core ports, per-editor
  ownership, optional native Forms, safe SSR/hydration and packed public examples.
- Meta 0008–0012 and Community 0005/0006 preserve HTTP presentation boundaries,
  host-owned identity/policy and existing Nest 11 SSR support. The optional Nest
  12.3.2 upload examples do not promote native Node to an ecosystem default.
- Meta 0013 / Community 0007 require actual per-package distribution history,
  exact Nx project scopes, independent version intent and initial distribution
  at 0.0.1. Meta 0015 requires truthful cache inputs and measured DTE.
- Governance proposals remain proposed. No accepted-decision conflict or
  exception was identified. Changes cover consumer documentation and a missing
  core archive license with its packaging check/fingerprint. Public APIs,
  manifests, dependency/peer ranges, runtime code and task topology are unchanged.

## Consumer path and acceptance

The four owning READMEs were reviewed against their public contracts and examples.
They now link the generic, HTTP, Angular and native Forms choices directly;
Angular installation correctly identifies upstream Image Tool as the tool
package's pinned dependency, and the Fetch README includes its license.

Actual tarball inspection found that core omitted `LICENSE`. Core now includes
the same Apache-2.0 license as the repository; its existing package test compares
the archived bytes with the source license. The immutable snapshot fingerprint
also includes this new artifact input. The initial inspection archives are
superseded by fresh preparation after this correction.

| Consumer need          | Owning guidance and proof                                                                                                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic custom backend | [Core upload ports/composition](../packages/editorjs/core/README.md#upload-boundaries): preserve receiver, host-defined metadata/errors and both image methods; ES2022-only archived examples compile without framework/DOM types.                                            |
| Browser HTTP           | [Fetch quick start](../packages/editorjs/upload-fetch/README.md#quick-start-a-custom-backend): explicit request construction and unknown-JSON mapping, named File or nameless Blob, URL submission, expected failure versus rejection.                                        |
| Standalone Angular     | [Upload owner](../packages/editorjs/angular/README.md#optional-upload-ownership): existing backend via DI, per-component owner, safe error state, no Forms requirement, reset/disposal and late-result fencing.                                                               |
| Native Forms           | [Submission recipe](../packages/editorjs/angular/README.md#uploads-with-native-signal-forms): block active uploads, guard snapshot capture, preserve validation pending/submitting, acknowledge failures and recreate the complete session on reset.                          |
| Optional backend       | [Archived Nest example](../packages/editorjs/upload-fetch/nest-example.md): independently installed Fastify and native Node, bounded local policy, explicit application/storage seams.                                                                                        |
| Retry and cancellation | Core single attempt by default; opt-in replay-safe classification/scheduler; Fetch-owned timeout/AbortSignal. Logical stop, transport abort and remote rollback are different guarantees.                                                                                     |
| Image data             | [Image Tool contract](../packages/editorjs/tool-image/README.md#alternative-text-and-saved-data): independent caption, literal authored alt, deliberately decorative empty alt and missing/unset alt. Both uploader methods remain required even for read-only configuration. |

No all-tools dependency is introduced. Core has no runtime/peer dependency;
Fetch depends only on core; each tool depends on core and its own upstream tool.
Angular consumes the same ports and keeps Forms in its optional secondary entry.
No generic consumer needs Angular, Nest, Forms or Nx at runtime.

## Evidence and exact compatibility

| Consumer cell | Angular runtime/compiler/build | Consumer Node | TypeScript | Editor.js |
| ------------- | ------------------------------ | ------------- | ---------- | --------- |
| minimum       | 22.0.0                         | 22.22.3       | 6.0.3      | 2.31.7    |
| reference     | 22.1.4                         | 24.15.0       | 6.0.3      | 2.31.7    |
| current       | 22.2.2                         | 26.0.0        | 6.0.3      | 2.31.7    |

The browser is Chromium 156.0.8078.4, revision 1248, through Playwright 1.64.0.
Upstream tools are paragraph 2.11.7, header 2.8.9, list 2.0.9, quote 2.7.6 and
image 2.10.3. Neutral-package CI also exercises declared Node minimum 22.12.0.
These exact cells are evidence, not every permutation allowed by the declared
Angular `^22.0.0`, wrapper Editor.js `^2.31.7` or engine ranges. Tool peers remain
exact Editor.js 2.31.7. No support range is widened here.

Both optional Nest examples use common/core/platform 12.3.2, Node 24.15.0,
TypeScript 6.0.3, RxJS 7.8.2, reflect-metadata 0.2.2, Zod 4.6.7 and Node types
24.10.1. Fastify uses 5.12.7 with multipart 10.1.6; native Node uses bundled
Multer 2.5.0. [Nest evidence](editorjs-nest-upload-validation.md) records the
16 scenario groups per platform and their bounded application responsibilities.

| Layer                            | Consolidated evidence                                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic unit/types               | Core operation/composition tests: expected failures and exceptions, receiver/type preservation, concurrency, bounded retries, stop and malformed envelopes; packed NodeNext/Bundler examples.                             |
| HTTP and browser                 | Fetch unit/package checks and 21 controlled browser cases: mapping, malformed JSON/schema, HTTP failure, abort/timeout, File/Blob/URL and ambiguous committed response with explicit idempotent retry.                    |
| Angular and Forms                | [Upload design](editorjs-upload-design.md), [Forms validation](editorjs-forms-upload-validation.md) and packed upload cases: independent owners, native state, submission, reset, disposal and late completion.           |
| SSR, hydration and delivery      | [Integrated validation](editorjs-upload-validation.md): overlapping request markers, no credentials/upload state transfer, inert SSR, pre-hydration click/Enter safety, positive authoring and eager negative controls.   |
| Individual tools and alt         | [Common-tools review](editorjs-common-tools-release-readiness.md) and [image validation](editorjs-image-validation.md): independent selection, preserved metadata/caption/alt, browser assets and public-route isolation. |
| Actual examples and installation | Existing packed checks extract the archived README units and Nest guide; compiles standalone before Forms is installed, then optional Forms and SSR; independently installs each tool and the Nest/browser consumers.     |

### Hosted DTE and cache evidence

The predecessor's [workflow 40947715057](https://github.com/anarchitects/anarchitecture-community/actions/runs/40947715057)
passed all twelve jobs on source commit `b1ebe596c4688986e915067aebbac9b78b48e8ea`.
[Nx run 1unuepAW6u](https://cloud.nx.app/runs/1unuepAW6u) executed **89/89** atoms,
zero cached, across three workers. All six uncached collection gates passed.
After explicit DTE completion, an empty coordinator cache and workspace database
received **two remote-cache hits**, restoring **15 files byte-for-byte** in a
5.784-second replay subprocess. The full packed job took about 16m26s; distributed
execution about 12m02s. [PR #640](https://github.com/anarchitects/anarchitecture-community/pull/640)
retains the detailed timestamps and evidence artifact hashes.

The [integrated record](editorjs-upload-validation.md) separately records local
output restoration and source/dependency/config/environment invalidation.
Fresh installs and completeness gates remain uncached. All 89 atoms keep isolated
outputs and declared source/config/archive/runtime/environment identity. The
resolved project still has 105 targets; no new validation task is added here.

Remote replay proves reuse within one immutable invocation. Fresh workflow
attempts have new run/snapshot identities and deliberately do not reuse older
validation passes. Maintainers own revisiting this exclusion when a reviewed
content identity preserves fresh-install evidence. Three workers remain a
measured starting capacity, not an optimum: task-active/init/download splits,
capacity tuning and invoiced cost remain maintainer-owned follow-up measurements.
The previous full-window allocation envelope was 36.4 worker-minutes plus about
16.4 coordinator runner-minutes; it is not an invoice or a cost-saving claim.

### This review's archive validation

Local verification on macOS arm64 used orchestration Node 24.22.2, Nx 23.2.1
and Yarn 4.18.0; consumer versions remain the exact matrix above. Hosted
orchestration remains Node 24.22.1 on Ubuntu x64.

- All four affected packages passed test/typecheck/lint: **553 tests** (core 269,
  Angular 196, image 43, Fetch 45), including actual archived README compilation
  ([Nx run](https://cloud.nx.app/runs/b4LTn7Vyzp), 16 tasks, zero hits, 13.9s).
- The existing Fetch/ImageTool suite passed **21 browser scenarios**
  ([Nx run](https://cloud.nx.app/runs/TyFabfo8u7), browser task executed; three
  prerequisite build hits, 9.2s).
- After the missing-license correction, all **269 core tests**, the **seven
  packed harness tests**, core/e2e lint and typechecks passed again
  ([Nx run](https://cloud.nx.app/runs/Y3tkarouZx), seven tasks, zero hits, 5.9s).
- Final fresh preparation `si633-readiness-final` passed **all six cells** in
  **2m53s** ([Nx run](https://cloud.nx.app/runs/8oejQIbP2I)). All six preparation
  tasks executed; one of eight prerequisite package builds was a cache hit.
  Checks completed before these final builds/archives. Generic, standalone
  Forms-absent and optional Forms examples compile from the revised archives;
  both isolated Nest guides/clients compile. SSR examples are prepared for the
  hosted execution phase. No older snapshot substitutes for this preparation.
- Direct inspection of all **43 archive copies** passed: source-identical
  README/LICENSE (and Nest guide), expected public export targets/declarations,
  dependency/peer/side-effect metadata and no source/tests/build-info files.
  All seven shared package hashes agree across all six cells; Fetch is packed
  only for reference CSR. Angular's generated archive additionally depends on
  `tslib ^2.3.0`, and keeps Forms optional. The two Angular FESM entries and each
  tool's explicit browser entry are present; global tool styles come from the
  separately installed upstream modules and are checked by delivery tests.
- Changed-document local links/anchors, formatting and whitespace checks pass.

The full 89-atom runtime/DTE matrix is delegated to this PR's configured hosted
CI; this local review does not relabel preparation as 89 executed validations.
The predecessor's green run remains prior evidence. The focused #633 PR records
this commit's immutable hosted run, collection and remote-restoration result.

| Reviewed archive (all 0.0.1) | Files | Bytes | SHA-256                                                            |
| ---------------------------- | ----- | ----- | ------------------------------------------------------------------ |
| editorjs-core                | 36    | 48723 | `6faa79c3478f7ff23f020588e52d17926159933e4539d6c218a466750842ee52` |
| editorjs-angular             | 9     | 64831 | `2446daad914ba2b3eab33be325e4ae3d93d4ee51227067f9bedf2e0217d30e24` |
| editorjs-tool-paragraph      | 11    | 11304 | `5c504467baa6682a4693e57eedf12376f297bcb96838ee70dba76b7897c277ea` |
| editorjs-tool-header         | 11    | 11842 | `2a98929815b82b9f5216fa04f8b12bd3e8c5c9cc6426e002683bd0cf80471c03` |
| editorjs-tool-list           | 11    | 13763 | `2fda3ac1801a20a39e89cfe8a14d04f360e55868ce7fe08a589cd2b97485dc3c` |
| editorjs-tool-quote          | 11    | 11891 | `4f6a775b9c1ed62bb26d8dd582c937f986a5eb208730b9982cc0f29e290b0428` |
| editorjs-tool-image          | 12    | 15687 | `22bd9cafe4905cab6099fd4278f4ccf009f2c5ab0ca04293e873d95d480c0e84` |
| editorjs-upload-fetch        | 11    | 20729 | `2cb0e493fd17757669c26197e98c2ed5544ca06feeedece7ce164ea3c6defa4c` |

These are local reviewed archive identities, not publication artifacts. Retain
new hashes for the actual release commit after its checks and final builds.
Preparation artifacts/locks live under
`dist/editorjs-packed-inputs/si633-readiness-final`; the inspection record is
`dist/editorjs-upload-readiness/si633/archive-review.json`. All six share source
fingerprint `e6d05d18aa23c69d135d5bf0cc8ba7c1afa839c72af442ee047103d72eab4fe5`.

| Cell                    | Consumer snapshot SHA-256                                          | Installed lock SHA-256                                             |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| csr/angular22-current   | `4d150362a819b1ee438e10b3c402f6db0267330a26d38cfa7461a11c418d20da` | `cf0b94d3bc197ac7bd0f84c2a65ed6fdac0ea7f1460ba776bfa58a0b52cbc82c` |
| csr/angular22-minimum   | `d3cf0011b1c13e89b17bea5c1b3cab23d784f278ec867fc80f986bb80338c6e2` | `f2bc6aef19eda58f67b366db98554e285d2d5990898df84616d3fe3a03488317` |
| csr/angular22-reference | `b66999d2079836f910a8f63ab299c031628ffed6a1b93f93c32534532eac1799` | `83e0265dbccef003ea95963773879efb51d62dd019bb396e474957e6c369cf55` |
| ssr/angular22-current   | `d546f104761932218c12dfe1c80256de7049a3703f18cbe8b076116411ad5b0b` | `23fa66183ae83a30423ef620b877ed21ef31eef604c5f8126c82fc43b4f89f7f` |
| ssr/angular22-minimum   | `e7027276c742592e980535db7167f736410c9631449c9883d7074cfd23656a5f` | `c852ce3c23be483e9654eae4600ac5d8bab2191eab4573b1691c909014494c70` |
| ssr/angular22-reference | `619aa4b51eca2827f3f9039e5898b63f4dd5d0adb6a0b8e8642009b427ba0b7e` | `256851a9e64daaf7ef2796c7123cde4ba1fe4f9020a65c0226e004c2504d9bef` |

## Independent distribution history and version intent

On 30 October 2026, every registry endpoint below returned **404**. GitHub's
remote `refs/tags/editorjs*` inventory was empty, and all 102 GitHub Releases
(100 plus two on the second page) contained no Editor.js package release.
Manifest versions alone were not used to infer release status. Recheck this
external state before publication.

| Exact Nx project / npm suffix after `@anarchitects/` | npm history                                                               | Matching tag/release | Development / first distribution        |
| ---------------------------------------------------- | ------------------------------------------------------------------------- | -------------------- | --------------------------------------- |
| editorjs-core                                        | [404](https://registry.npmjs.org/@anarchitects%2Feditorjs-core)           | none                 | `init(editorjs-core)` / 0.0.1           |
| editorjs-upload-fetch                                | [404](https://registry.npmjs.org/@anarchitects%2Feditorjs-upload-fetch)   | none                 | `init(editorjs-upload-fetch)` / 0.0.1   |
| editorjs-angular                                     | [404](https://registry.npmjs.org/@anarchitects%2Feditorjs-angular)        | none                 | `init(editorjs-angular)` / 0.0.1        |
| editorjs-tool-paragraph                              | [404](https://registry.npmjs.org/@anarchitects%2Feditorjs-tool-paragraph) | none                 | `init(editorjs-tool-paragraph)` / 0.0.1 |
| editorjs-tool-header                                 | [404](https://registry.npmjs.org/@anarchitects%2Feditorjs-tool-header)    | none                 | `init(editorjs-tool-header)` / 0.0.1    |
| editorjs-tool-list                                   | [404](https://registry.npmjs.org/@anarchitects%2Feditorjs-tool-list)      | none                 | `init(editorjs-tool-list)` / 0.0.1      |
| editorjs-tool-quote                                  | [404](https://registry.npmjs.org/@anarchitects%2Feditorjs-tool-quote)     | none                 | `init(editorjs-tool-quote)` / 0.0.1     |
| editorjs-tool-image                                  | [404](https://registry.npmjs.org/@anarchitects%2Feditorjs-tool-image)     | none                 | `init(editorjs-tool-image)` / 0.0.1     |

The active Nx graph confirms these exact scopes. Nx Release uses independent
relationships, Conventional Commits, non-bumping `init` and
`{projectName}@{version}` tags. All eight manifests remain 0.0.1; dependents use
core `^0.0.1`. Equal initial numbers do not create lockstep versioning. Core must
be available before consumers can install its dependents from the registry.
Angular and individual tools remain optional choices; publication ordering must
not turn them into mandatory dependencies. Existing released packages elsewhere
in this workspace keep their own ordinary Conventional Commit semantics.

## Required release-commit gates

The release owner must perform these checks on the **eventual release commit**;
neither this record, a prior green PR nor today's local archives can substitute:

1. Recheck npm, tags and release history for each selected package. Review its
   independent proposed version/dependency changes, compatibility and release
   notes; first official distribution must be exactly 0.0.1 where still unreleased.
2. Require every configured CI check green on that exact commit, including neutral
   Node minimum, packed CSR/SSR/hydration/Forms/Nest consumers, DTE collection and
   strict remote restoration. Preserve exact resolved locks and tool versions.
3. Complete checks, then final builds and packaging. Core/tools/Fetch have separate
   non-emitting typecheck outputs after #632; still avoid independent overlapping
   writers to the same build/pack directory. Review the actual final archives.
4. Verify source-current package README/LICENSE and Nest guide where applicable,
   complete public exports/declarations, browser/style delivery, dependencies,
   optional peers and absence of source/test/build-info leakage. Recompile examples
   extracted from those archives and install consumers in isolation without source
   aliases or undeclared framework/tool dependencies.
5. Retain SHA-256, file inventory, resolved locks, commit SHA and CI evidence for
   the exact artifacts selected for distribution. Normal CI artifacts expire
   (packed inputs one day, evidence seven days); preserve release evidence before
   expiry. Do not rebuild after review and silently publish different bytes.
6. Obtain the separately authorized release operation; verify published metadata,
   archive integrity and installation afterward. No bump, publish, tag or automatic
   merge is authorized by this readiness review.

## Remaining host and compatibility boundaries

An adopting application owns durable document/assets, publication rules for unset
alt, safe HTML/URL rendering and migrations. Uploading neither creates alt text nor
turns missing alt into decorative empty text. Preserve literal authored alt and
caption independently; structural validation is not publication approval.

Production identity/authorization, CSRF/CORS, upload/content limits, scanning,
storage keys, quotas, media access/expiry, durable idempotency, cleanup and network
policy remain host work. The Nest example's one-PNG/loopback/in-memory policy is
not production storage or a remote URL proxy. Local abort or disposal cannot prove
that a server mutation was undone. Retrying needs a verified replay contract.

Chromium evidence does not certify Firefox/WebKit, Windows, strict-CSP deployments,
shadow roots, alternate documents or comprehensive accessibility. Node HTTP
execution of the browser Fetch adapter is not certified. The tools' browser
declarations require Bundler resolution where upstream NodeNext types differ;
Fetch transport-only declarations support both. Global upstream styles can remain
after removal, and an upload completion can replace the caption view and lose its
selection. The host must validate its own deployment and user experience.

The upload acceptance of #72 is supported by the bounded evidence above. #73
retains arbitrary/custom tools, #74 persistence/migrations, #75/#78 broader demos
and testing, and #76 publication. This review does not start those workstreams or
certify a complete blog editor.
