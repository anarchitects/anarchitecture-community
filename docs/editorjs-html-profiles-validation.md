# Editor.js HTML profiles and extension validation

Evidence for #683, based on merged #682 (`8d86a6f`), reviewed on 4 November 2026.
The public consumer contract is the [package README](../packages/editorjs/html/README.md).

## Architecture preflight

Enumerated and read all nine Community ADRs under `docs/adr/**` and all eighteen
Meta ADRs under `adr/**`, including proposed and historical records. No additional
local ADR directory or nested agent instruction was found. The fresh remote Meta
inventory matches the clean adjacent checkout at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`.

Community0008 requires our own bounded semantic mapping with the private
sanitize-html adapter, independent neutral dependencies, strict publication,
explicit incomplete preview, separate alt states, configured saved names,
immutable registration snapshots and one safety policy for every callback result.
The new profile uses the approved list-v2 and image contracts; Callout, Marker,
FlagTune and Code remain consumer-owned demonstrations. No accepted conflict or
policy exception was identified. Governance proposals remain proposed; HTTP,
Nest, authentication and cross-repository wire contracts retain their scope.

Community0004 requires complete owning-package documentation and actual packed
examples. Community0007/Meta0013 require independent 0.0.1 initial releases and
exact Nx commit scopes. Fresh npm history returned E404 for editorjs-html; remote
package tag refs are empty and none of all 102 GitHub Releases contains an
Editor.js distribution. Use `init(editorjs-html)` without a version bump.

Meta0015 governs declared inputs, restorable outputs, independent atoms and
uncached fresh installs. The modern Angular index, repository application,
architecture and testing guides preserve neutral boundaries and actual consumer
proof; this slice adds no Angular implementation. The core development and
custom-tool integration guides were reviewed for validation ownership and the
existing saved contracts. Angular display, broader adversarial verification and
release certification remain later slices.

## Delivered behavior

- List 2.0.9 saved shape: ordered/unordered nesting, root and nested start/counter
  metadata, and read-only checklist state as visible `[Completed]` / `[Not completed]`
  text. Chromium accessibility snapshots expose these labels and no editable or
  focusable form controls are introduced. Labels are fixed English in the standard
  profile; custom replacement permits host localization. Mixed item styles,
  legacy flat generations and counters beyond HTML's signed integer range fail
  explicitly. JSON-depth and configurable list-depth ceilings both apply.
- Image 2.10.3 plus Community top-level alt: figure/img/caption, independent plain
  alt, explicit decorative empty alt, missing/blank-alt failure or preview omission,
  safe URLs and bounded classes for saved visual flags. Relative images need
  explicit opt-in independently of relative links. No server fetching or alt
  synthesis. Additional file metadata is never copied to HTML or mutated.
- Typed saved-name/data maps for guards and render callbacks, standard aliases,
  explicit whole built-in replacement and deterministic duplicate rejection.
  Private per-instance maps and detached deeply frozen JSON prevent source or
  cross-call mutation. Callback functions retain identity and must be pure for
  deterministic results; arbitrary callback JavaScript is not sandboxed.
- Separate tune guards, registration-order composition and explicit validated
  nonvisual tunes. Unknown/invalid tunes and callback failures omit the entire
  block in preview. Strict failure never exposes partial HTML. Custom output is
  checked before tune composition and after each tune; no later wrapper can erase
  a prior safety diagnostic. Code demonstrates escaped literal content.

The list/image fixtures track shapes asserted in the real packed authoring flows
`portable/list.spec.ts` and `portable/image.spec.ts`. Development conformance uses
`validateListData` and `validateImageData` from public package roots; these two
packages are development dependencies only. Runtime dependencies remain core and
sanitize-html 2.18.1. No existing renderer engine or browser tool is introduced.

## Local evidence

All checks use `NX_NO_CLOUD=true`, `NX_DAEMON=false`,
`NX_ISOLATE_PLUGINS=false` and the workspace Yarn 4.18.0. The local sandbox required
`NX_NATIVE_COMMAND_RUNNER=false` for task execution. Existing dependency versions
were preserved; the lockfile changes only the two intended workspace links.

| Gate                            | Result                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Node 22.12.0, macOS arm64       | Build, typecheck, lint and all 153 tests pass                                                                                             |
| Node 24.22.2, macOS arm64       | Build, typecheck, lint and all five per-file test atoms pass (153 tests)                                                                  |
| Tests                           | 29 foundation, 37 safety, 22 first-profile conformance, 32 list/image, 33 registration/composition cases                                  |
| Packed Node 22.12.0 and 24.22.2 | Fresh isolated archive installs, guarded ESM import, no framework/authoring dependency leakage, rejected private subpaths                 |
| Public declarations             | TypeScript 6.0.3, ES2022-only, no ambient frameworks/DOM/Node; NodeNext and Bundler positive/negative registration and readonly contracts |
| Public documentation            | All six TypeScript README examples compile and execute from actual archives; archived README/LICENSE equal source                         |
| Browser                         | Playwright 1.64.0, Chromium 156.0.8078.4; installed archive bundled with esbuild 0.28.2                                                   |

The browser checks compare actual ol start/type at both levels, checklist
accessibility text, literal Code, plain attribute-looking alt and caption DOM.
Only the explicitly permitted image requests a resource. Unsafe inline, custom,
override and tune output makes no unexpected requests and executes no handlers;
a raw unsafe-image negative control does execute, proving the observation harness.
The minified browser bundle is 181,481 bytes before compression. This is a neutral
Chromium check, not Angular sanitization, SSR/hydration or a complete security audit.

| Packed runtime | Core archive SHA-256                                               | HTML archive SHA-256                                               | Installed lock SHA-256                                             |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Node 22.12.0   | `520109a794427793a2370fe73bfe74ef5a95a4cd51fec04a1992e2803a9e2a13` | `bd01fa5858101d2ea76c8e4779a5996d1a640a907de5ccaf2e8646cbad080786` | `abd55cc25c4260d6d104f56cf6cca75eedce05a80902b47a1d7c7c20f8032a7d` |
| Node 24.22.2   | `af9c399df59a106dc03a03dca40c91a524afb2fc404b25a0f0ad9d0cb1867c22` | `10a949e3d4673533aab2071633e3d3880df30ba187c12b2361b8349dc788401a` | `a4300d64e26be7814fffaff488be3cab2fb27f0d1a54a3eaca30fff9983f827c` |

## Nx and remaining gates

Resolved configuration contains five independent `test-ci--tests/*.spec.ts` atoms.
The two new atoms preserve build prerequisites, source/dependency/lock/config
inputs, exact Node/platform/architecture and `NODE_OPTIONS`/`CI` hashing, and
separate output directories. Fresh `packed-smoke` installation stays uncached.
No hosted orchestration or worker allocation changes.

`nx sync` adds the list/image TypeScript references and restores the two existing
Nest consumer references after Yarn relinks the workspace packages. These are
mechanical project-reference changes; the packed Nest harness continues to own
its archive installs and sync step. No Nest source, adapter, peer or compatibility
change is made.

The aggregate `test-ci` target refuses execution with Nx Cloud disabled in this
installed Nx version. Individual inferred file targets were invoked directly;
Cloud remained disabled. The first final file-target/typecheck/lint run executed
all seven checks (13/20 prerequisite cache hits). The repeat file-target run
restored all twelve tasks from local cache. Removing the HTML build directory
and rerunning build restored all seventeen generated files byte-for-byte, with
7/7 local cache hits. The test-source increment from 151 to 153 cases invalidated
Node 22's test/typecheck/lint results while retaining 13 prerequisite hits;
Node 22 and Node 24 had separate runtime hashes.

These are local checks. They do not establish remote restoration, distributed
execution or CI status. CI monitoring, optional
hosted reruns, publication and subsequent issue implementation are not performed.
