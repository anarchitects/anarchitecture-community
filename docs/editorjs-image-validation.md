# Image implementation and validation

Issue: [#614](https://github.com/anarchitects/anarchitecture-community/issues/614).
Follows merged #613 and the [common tools contract](editorjs-common-tools-design.md).
The bounded alt-authoring/preview amendment is included for review in this slice.

## Architecture preflight

On 28 October 2026, Community started clean at
`979e2aa1053b4d9080c57d6f158469018733a500`; #613 / PR #622 was merged.
The complete eight-record local and eighteen-record Meta inventories were checked
against the full ADR review earlier in this session. Local ADRs and engineering
guides were unchanged; the remote Meta ADR hashes matched the reviewed adjacent
checkout at `823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. Only `docs/adr` was found
locally. All accepted, proposed, historical and superseded text from that review
remains applicable; the full inventory is linked from the
[registry architecture review](editorjs-tool-registry-design.md#architecture-review-and-authority).
Modern Angular index, repository application and linked architecture, providers,
reactivity, Forms, rendering, SSR/build, testing, validation and API guidance apply
to the affected standalone fixtures. Nx generation/workspace/linking/task skills
and Angular skill/MCP guidance were applied.

Relevant constraints are neutral package roots and explicit browser/provider
ownership, public imports, consumer-focused packed documentation (local 0004),
actual distribution history and exact project scope (local 0007/Meta0013), and
accurate cache inputs, dependency edges, restorable outputs and distribution
boundaries (Meta0015). No accepted ADR conflict or exception is required.
Governance proposals remain proposals; no HTTP/Nest/auth/schema migration or
Forms API/state change is introduced.

## Upstream and adapter boundary

Inspected the npm archive, declarations, emitted runtime, package metadata and MIT
license for `@editorjs/image@2.10.3`. Its registry SHA-512 was verified:
`ekCsGICZOIdghF/U2T34H7CItqaWAoJDXbkRD+x8l/LIo/7Ozf7KovYm21qz+CluArgV4RurVFHqwlz+O0vfJA==`.
The package pins that version and peers with Editor.js 2.31.7. No upstream source
is vendored; repository-owned adapter code remains Apache-2.0.

The root has no browser/Angular/upstream imports or declarations. It exports
inert eager/lazy definitions, config over core `ImageUploader`, JSON saved-data
contracts and a nonmutating structural validator. Both uploader capabilities are
required. Browser input is Blob (including File), host receiver semantics are
preserved, synchronous throws become promise rejections, failure responses retain
the host cause, and malformed success/file metadata is rejected. Additional JSON
file metadata survives the bridge and Editor.js save/render. Hosts retain file,
URL, HTML and publication policy.

Upstream has no alt-authoring control. The adapter composes public constructor,
render, save, settings, paste and append methods. Native labelled controls express
unset (missing alt), description (nonblank string) and deliberately decorative
(empty string) independently of caption and uploader metadata. Native editing
keys do not invoke Editor.js block shortcuts. Alt remains literal plain text;
file metadata and alt bypass HTML cleaning, while caption inherits enabled inline
tool sanitizer rules. The README explains host renderer assignment and unset
publication policy without adding a renderer.

A real browser test exposed upstream's fast-upload/FileReader-preview race: late
preview work hid the completed image or left a failed upload stuck in its preloader. Upload outcomes now snapshot current
caption/settings and rebuild the upstream view through public methods, leaving
old preview/result callbacks attached to detached UI. Alt controls stay in place;
a caption selection may be lost. No private handler/state is accessed or patched,
and no timeout increase or never-settling promise conceals the race.

Own listeners and observer are released by removed/destroy hooks. A per-instance
public notifier delegate suppresses late notifications. Already-started uploads,
blob fetches, previews and detached UI work can complete; host mutations are not
canceled. This is not a general abort/retry/transport framework. #72 still owns
shared upload infrastructure and optional upload-state composition.

## Validation

Passed on the final implementation:

- Image build, typecheck, lint and all 43 tests on Node 22.12.0 and 24.22.1.
  The package tests pack real artifacts, verify exports/dependencies/license and
  README identity, import the root with poisoned browser globals and no upstream
  or Angular dependencies, and compile ES2022-only NodeNext/Bundler consumers.
- Affected Angular host/e2e typecheck and lint, with only the existing eight host
  and 48 e2e warnings. Image adds no lint warnings. Formatting, TypeScript sync
  and whitespace checks pass.
- Final isolated preparation `image-614-e`: all four actual packed README
  examples compile, including standalone Angular without Forms. The generic host
  has no Angular installation. Production Angular CSR build passes.
- All ten portable and ten Angular Chromium cases pass. Image coverage includes
  lazy delivery/upstream provenance, eager alias composition, native keyboard
  multiline alt editing, unset/decorative/description semantics, independent
  caption and all three display settings, literal host metadata, real file and
  URL uploading, save/render, read-only transitions and independent owners.
- Controlled uploaders cover success:0, synchronous throw, rejection, malformed
  data, and held completion after removal. Delayed FileReader regressions cover
  success and failure; a real fast file failure leaves the selection button
  visible. No timeouts were loosened or assertions disabled.
- All seven packed-harness checks pass, including graph eligibility, isolated
  ports, concurrent documentation preparation and failure propagation.

The packed reference consumer uses Angular 22.1.4, Node 24.15.0, TypeScript 6.0.3
and Editor.js 2.31.7 on macOS arm64/Chromium. Local orchestration uses Node
24.22.1; the independent minimum-runtime check uses Node 22.12.0. These checks do
not certify other browsers, the complete matrix, hosted DTE or publication.

## Nx cache and distribution evidence

The library was generated through Nx after a dry run; Yarn linked core and the
host and installed the exact upstream version. Existing locked versions were not
changed. Build/typecheck/lint/test use established Vite/TypeScript/Vitest targets.
The three test atoms depend on build and include runtime/platform/architecture,
NODE_OPTIONS, CI, lockfile and TS configuration inputs. Build and typecheck retain
source/dependency/config inputs and restorable `{projectRoot}/dist` outputs.

Preparation builds and packs image, compiles the actual packed README examples,
and includes source, manifest, license, README and build configuration in immutable
snapshot fingerprints. Real host imports and project references carry affected
selection. Fresh registry installation remains uncached outside DTE; existing
isolated ports, per-atom reports and collection gates are preserved.

The resolved graph retains 66 cacheable packed phases and six uncached
preparations. TypeScript sync passes; an image source change selects image, the
Angular host and its e2e project as affected.

Local cache restoration recovered all nine build files byte-for-byte (SHA-256).
Warm, restored and reverted builds hit `2131240480399372246`. Independent probes
produced cache misses:

| Input                  | Build hash             |
| ---------------------- | ---------------------- |
| Image source           | `593937722753274454`   |
| Vite configuration     | `15964433567965519318` |
| Core dependency source | `9837805748324519644`  |
| Lockfile               | `17715824085854412839` |
| NODE_OPTIONS           | `6665993935767398959`  |

All probes were reverted and the original hash recovered. This is local cache
restoration/invalidation evidence, not remote reuse or hosted DTE certification.
The full matrix and combined accessibility/SSR/distributed-worker evidence remain
#615/#616 and hosted CI gates.

The npm name returned 404; matching remote tags were absent; none of the 102
GitHub releases matched this package. Initial manifest is 0.0.1 and the commit
scope/type is `init(editorjs-tool-image)`. This slice does not merge, bump existing
versions, publish, or start #615.
