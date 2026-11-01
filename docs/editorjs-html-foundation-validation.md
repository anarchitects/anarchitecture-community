# Editor.js HTML foundation validation

Evidence for [#682](https://github.com/anarchitects/anarchitecture-community/issues/682),
recorded **1 November 2026**. This implements the first profile in accepted
[ADR0008](adr/0008-editorjs-html-rendering.md). The public contract and runnable
examples live in the [package README](../packages/editorjs/html/README.md).

## Architecture and package preflight

Before code generation, enumerated and read all **nine** Community ADRs, including
the named Modern Angular record, and all **eighteen** Meta ADRs, including duplicate
numeric prefixes, proposals and historical records. Community baseline was
`a0139648c5c59dd5b68b802afcc10bd8fd024103` (merged #689). Meta's recursive remote
inventory matched the clean adjacent checkout at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. No additional repository ADR locations
were found. This is a fresh implementation preflight, not reliance on #681's read.

Applicable constraints:

- Community0008 owns the renderer, strict/preview result, sanitizer, initial
  paragraph/header/quote profile, resource limits and framework-free runtime.
- Community0004 requires the owning README, public imports and actual archive
  documentation/type checks. Community0007/Meta0013 require independent initial
  `0.0.1`, fresh history checks and the exact generated `editorjs-html` commit scope.
- Meta0015 requires correct resolved task inputs, prerequisites, outputs and
  separate local versus remote/DTE evidence. Fresh npm installation is uncached.
- Community0002/0003 and Meta contract ownership keep host policy separate from
  neutral contracts. Governance proposals retain their status. The accepted
  Nest/HTTP and Angular decisions do not authorize framework changes here.

Read the Editor.js core development guide, Modern Angular index and repository
application, and linked architecture, SSR/build and testing/migration guides.
No accepted decision conflicts with this slice; no proposal overrides one.

Used installed `@nx/js:library` with publishable/Vite/Vitest/ESLint options after
generator discovery and dry run. Linked dependencies through Yarn workspace
commands. Added the generated project to independent Nx releases, without a
version bump. Fresh npm lookup for `@anarchitects/editorjs-html` returned 404;
remote matching tags and inspected GitHub releases contained no renderer release.

The only production dependencies are core and exact `sanitize-html@2.18.1`.
Neutral tool validators and their Editor.js peer are **development dependencies**
for conformance tests, never imported by renderer source or declarations. No
third-party renderer code is copied. The sanitizer remains MIT; Community code
and the shipped LICENSE are Apache-2.0. Its maintained source has moved to the
[Apostrophe monorepo](https://github.com/apostrophecms/apostrophe/tree/main/packages/sanitize-html);
the old standalone repository now directs readers there. The selected npm version
is unchanged from the accepted decision; lockfile integrity pins its archive.

## Implementation and safety proof

The pipeline bounds/detaches JSON using descriptors, delegates envelope/ID
validation to core, applies narrow `ToolDataValidator` guards, formats semantic
HTML and sanitizes every fragment. The same private sanitizer adapter handles
inline fields and final output. Parser hooks detect disallowed tags/attributes,
URLs, implied element repairs and sanitizer attribute removals; harmless
serialization changes are not detected by raw-string comparison.

Strict failures have no HTML property, including after a successful prefix.
Explicit previews skip unsupported/invalid blocks or return sanitized inline
remainders with diagnostics. Limits and invalid envelopes fail both modes.
Instances snapshot configuration and retain no document/request state. Quote
caption/text diagnostics use path order before the diagnostic cap is applied.

The **90 tests** comprise 31 semantic/result/limit tests, 37 adversarial/policy
tests and 22 public-neutral-validator conformance tests. They cover exact heading
levels, separate quote captions, input immutability, repeated calls, configuration
isolation, unknown/prototype names, tunes, duplicate IDs, accessors/cycles,
resource ceilings, scripts/events/namespaces, encoded/disallowed URLs, host policy
narrowing, unsafe captions and benign normalization. Structural validators may
accept inline HTML that the renderer correctly refuses to publish.

## Executed consumer checks

All checks below ran locally on macOS arm64, with Nx Cloud disabled. Both exact
Node **22.12.0** and **24.22.2** passed build, typecheck, lint and all 90 tests.
TypeScript was **6.0.3**, Nx **23.2.1**, Yarn **4.18.0**, Vite **8.0.9** and
Vitest **4.0.18**.

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true \
  yarn nx run-many -p editorjs-html -t build typecheck test lint
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true \
  yarn nx run editorjs-html:packed-smoke
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true \
  yarn nx run editorjs-html:packed-smoke:browser
```

Run the first two under each selected Node binary; the browser configuration was
executed on Node 24.22.2. The harness packs the real core and HTML builds with
Yarn, installs those archives into a fresh temporary npm consumer and checks:

- Public ESM execution with throwing browser-global getters, strict failure
  behavior and rejection of private package subpaths.
- Identical README/LICENSE in the archive, absence of source/tests/tools, the
  packed core version range and exactly the intended runtime dependencies.
- All **three README examples**, compiled and executed under both NodeNext and
  Bundler resolution using strict ES2022 declarations with no DOM/Node ambient
  types. Every exported public type is consumed; negative type checks require
  failure HTML, sanitizer bypass and implicit fallback mode to remain unavailable.
- An independently installed dependency tree and browser bundle containing no
  Angular, Nest, Nx, Editor.js browser runtime or authoring tools.

The Chromium run used Playwright **1.64.0**, Chromium **156.0.8078.4** and esbuild
**0.28.2**. An unsafe image/event plus encoded script link produced sanitized
preview DOM, no image, no href, no execution marker and **zero requests**. A raw
unsafe control then executed the marker and attempted one intercepted request,
proving the harness could observe both. The minified renderer plus dependency
bundle measured **174,031 bytes** before compression. This is a bounded execution
probe, not a proof against every delayed payload or an application-size benchmark.

Final archive and fresh consumer lock SHA-256 values:

| Runtime      | Core archive                                                       | HTML archive                                                       | Consumer lock                                                      |
| ------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Node 22.12.0 | `520109a794427793a2370fe73bfe74ef5a95a4cd51fec04a1992e2803a9e2a13` | `902fe224d7b753ebd640c061c1ac77f5a6e55c8a06968a38311bd8374ab086ea` | `f628d6e18d073c78b37888228b98cc83ad312d71cfd9d0091eb2dc15e447c0d4` |
| Node 24.22.2 | `af9c399df59a106dc03a03dca40c91a524afb2fc404b25a0f0ad9d0cb1867c22` | `5a7dfbbc0063890093305df11a6d8b78dd883cb4f45a11955be1d56eb10e6f60` | `be9a8f2344c703a61dd2443801e5e667b38870475d47bde9ac0502796c4593aa` |

These identify the executed artifacts, not a promise of byte-identical packaging
across runtimes. The harness prints fresh hashes and removes temporary consumers.

## Nx graph, cache and CI boundaries

Inspected the resolved `editorjs-html` configuration. Build, lint, typecheck and
tests are cacheable. Inputs include package source/configuration, dependency
inputs, workspace TypeScript configuration, `yarn.lock`, exact Node version,
platform/architecture and `NODE_OPTIONS`; tests also include `CI`. Lint includes
root ESLint rules. Build restores `dist`; typecheck restores its build-info output.
Build depends on dependency builds; tests depend on build; typecheck also depends
on dependency typechecks. Development validator packages are graph prerequisites,
not installed production dependencies. Inferred per-file `test-ci` atoms exist
for all three suites, with explicit build prerequisites and runtime inputs.

Cold validation produced **0/12 cache hits** for each runtime. Changing renderer
source invalidated its four checks while retaining **8/12** dependency hits. A
warm Node 24 build restored **13 byte-identical dist files** after its output
directory was moved aside; all **5/5** prerequisite/build tasks hit local cache.
This proves local restoration, not remote reuse or distributed scheduling.

`nx sync` also removed stale workspace-source references from the two existing
standalone Nest packed consumers. Their validation harness already invokes sync
before installing the archive; neither fixture declares the source package as a
workspace dependency. Retaining the generated cleanup keeps the committed graph
in sync. No Nest runtime or adapter behavior was changed.

The existing Node 22.12 baseline CI job now includes this package and its fresh
packed smoke. Existing general validation discovers the package automatically.
The packed target is intentionally **uncached** because it resolves dependencies
fresh, and remains outside the distributed invocation. It uses unique temporary
directories and no server ports. No new hosted matrix or browser CI job was added.

Remaining rollout work belongs to #687/Community maintainers: measure broader
runtime/framework cells and real browser application cost, then assess remote
cache/DTE with explicit spending permission. Revisit the uncached preparation
split if a pinned reusable consumer snapshot is introduced. The small three-file
suite does not justify an unmeasured worker allocation. No hosted experiments,
CI reruns or monitoring were performed for this slice.

List/image/custom/alias/tune rendering remains #683; the expanded adversarial
corpus is #684. Angular display components, directives, SSR/hydration and the
broader compatibility matrix remain #685–#687. This increment advertises neither
native CommonJS nor untested browser/framework cells and is not a full security
audit. Publication and version release remain separate work.
