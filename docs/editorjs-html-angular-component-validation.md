# Editor.js Angular HTML component validation

Evidence for [#685](https://github.com/anarchitects/anarchitecture-community/issues/685),
4 November 2026, based on merged #684 at
`a214c59fa7324101d2f65d19fa1bc8d605cc8df3`.
The public contract is the [packaged README](../packages/editorjs/html-angular/README.md).

## Architecture preflight

Before generation, freshly enumerated and read all nine Community ADRs and all
18 Meta ADRs, including proposals, historical content and duplicate prefixes.
No additional local ADR location or nested AGENTS file was found. Meta's remote
recursive inventory matched the clean adjacent checkout at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`.

Community inventory: 0001 governance package boundaries; 0002 canonical model;
0003 core/adapter/extension/host ownership; 0004 public package documentation;
0005 Nest/Angular SSR HTTP composition; 0006 Nest12 SSR compatibility;
0007 independent initial versions; 0008 HTML rendering; and the named Modern
Angular 22 signal-forms ADR. All are accepted.

Meta inventory: both 0001 records (cooperative governance and two core styles),
0002 modulith, 0003 AI enablement, 0004 landscape ownership, 0005 hierarchy,
0006 Archi, 0007 layering, both 0008 records (HTTP independence and modern Angular),
0009 native Node candidate, 0010 Nest dependency policy, 0011 auth compatibility,
0012 public contracts, 0013 independent versions, 0014 dependency maintenance,
0015 Nx caching/DTE and ADR-0001 landscape. Cooperative governance, hierarchy,
Archi and layering remain proposals; they do not override accepted policy.

Read the Modern Angular index, repository application, architecture, reactivity,
rendering/elements, providers/routing/HTTP, SSR/build and testing/migration guides,
plus the applicable Editor.js Angular development/packaging guidance. Consulted
Angular MCP best practices and installed Angular binding/compiler contracts.

Applicable decisions and boundaries:

- Community0008 requires shared headless validation/rendering, ordinary Angular
  sanitization, a dedicated non-projecting container, current result/output,
  identity-driven recomputation, immutable configuration snapshots and clearing
  old HTML on invalid replacements. No trust bypass, DOM-writing implementation,
  authoring runtime, Forms or automatic hydration providers.
- Angular A01/A02/A05/A06/A09/A10 require the exact verified Angular baseline,
  standalone public seams, computed derived state, signal input/output APIs,
  host-owned hydration and actual packed/DOM evidence. The effect performs only
  external result notification; callbacks and subscribers are untracked.
- Community0004 requires complete archive documentation and executable public
  examples. Community0007/Meta0013 keep the new distribution independently at
  0.0.1 with exact `init(editorjs-html-angular)` scope. Fresh npm returned E404;
  none of 117 remote tags or 102 Releases identifies this package.
- Meta0015 requires explicit prerequisites, inputs, outputs, independent test
  atoms and uncached installs. Local proof does not establish remote cache/DTE.
- #686 owns the directive and scoped DI token/provider/configuration precedence;
  #687 broadens the integrated compatibility matrix. No HTTP/Nest defaults,
  authoring packages or existing supported Angular ranges change in this slice.

No accepted conflict or policy exception was identified. The generator's
TypeScript setup accommodation below follows the existing Angular package's
isolation pattern; it is not a new supported runtime or public alias.

## Generation and package boundary

Used installed `@nx/angular:library` after schema/source discovery and dry run:

```sh
NX_IGNORE_UNSUPPORTED_TS_SETUP=true yarn nx g @nx/angular:library \
  packages/editorjs/html-angular --name=editorjs-html-angular --publishable \
  --importPath=@anarchitects/editorjs-html-angular --selector=aa-editorjs-html \
  --prefix=aa --flat --inlineTemplate --inlineStyle --changeDetection=OnPush \
  --unitTestRunner=none --skipTests --skipTsConfig --skipPackageJson \
  --skipFormat --linter=eslint --tags=npm:public,scope:editorjs,type:angular \
  --no-interactive
```

`NX_IGNORE_UNSUPPORTED_TS_SETUP` is generation-only, as documented for the
existing authoring adapter: Angular/ng-packagr remains outside the repository's
TypeScript solution references. It has composite disabled, cleared source
conditions and explicit ngc/typecheck targets. No root path mapping is introduced.
Linked the renderer with `yarn workspace @anarchitects/editorjs-html-angular add
'@anarchitects/editorjs-html@^0.0.1'`. Only the new workspace entries changed in the
lockfile. ng-packagr publishes partial APF with renderer and tslib dependencies,
exact Angular core 22.1.4 peer, README and Apache-2.0 LICENSE. Root exports comprise
the component and three documented headless types; there is no deep entry point.

Core/headless tarballs use Yarn pack to rewrite their workspace protocol ranges;
the APF output uses npm pack. npm then installs only actual archives in a fresh
temporary consumer outside the workspace, with scripts disabled and its own cache.
No authoring or `@editorjs/*` package is installed. The adapter's runtime bundle
has no Forms, router, hydration-provider or browser-editor imports; SSR host
routing/hydration dependencies belong exclusively to the consumer fixture.

## Test design and observed behavior

Compiled-APF TestBed tests exercise actual Angular signal metadata and jsdom
binding: defaults, raw JSON, empty data, five invalid replacement cases, clearing
and recovery, preview diagnostics, immutable option snapshots, two instances,
identity/coalescing semantics, untracked callbacks/subscribers, teardown, explicit
built-in override and callback failure, unsafe callback rejection, headings,
links, ordered-list counter attributes, captions and authored image alt text.
Public type checks cover generic options, readonly results and typed outputs;
package assertions check the intentional APF surface and dependencies.

The packed harness extracts all four complete README TypeScript recipes from the
installed archive and compiles their templates with ngc. It builds optimized
browser/server bundles with Angular's application builder and starts a native
Node fixture host. Concurrent SSR requests carry independent transferred state;
JavaScript-disabled Chromium checks meaningful server output. A script gate
captures server nodes before the client runs, then proves host/container reuse
and equal HTML after real hydration. Angular's ordinary binding can replace the
innerHTML descendants: their identity is deliberately not advertised. Installed
Angular's `setDomProperty` applies its sanitizer then renderer.setProperty, which
explains this observed rebind; no trust bypass or hydration opt-out is introduced.

Browser checks cover list numbering, heading/image accessible names, captions,
compiled README custom rendering, option/data updates, two-instance isolation,
strict invalid clearing, no event execution or rejected `/x` image request,
recovery, explicit preview and empty output. Page errors, console errors and
hydration mismatch diagnostics fail the run. This is a baseline component proof,
not the full headless attack corpus or a universal browser claim.

## Nx execution contract

The APF build depends on upstream builds and restores
`packages/editorjs/html-angular/dist`. Build/typecheck/lint/test inputs include
project and dependency inputs, root TypeScript configuration, lockfile, exact
Node/platform/architecture and NODE_OPTIONS; test inputs also include CI. Lint
includes shared rules. All inferred Vitest aliases require the APF build.
`test-ci--tests/component.spec.ts` and `test-ci--tests/package.spec.ts` are separate
inferred atoms with explicit build dependencies and complete runtime inputs.
The aggregate is orchestration; packed-smoke is a single uncached fresh-install
proof with evidence under `dist/test-results/editorjs-html-angular`.

Local commands use Node 24.22.2, Yarn 4.18.0, Nx 23.2.1, TypeScript 6.0.3,
Vitest 4.0.18 and jsdom 22.1.0. In this environment, task execution sets
`NX_NATIVE_COMMAND_RUNNER=false NX_DAEMON=false NX_ISOLATE_PLUGINS=false
NX_NO_CLOUD=true`; these local socket/runtime accommodations are not CI changes.

## Executed results

Build, Angular/TypeScript typecheck, ESLint and all **15** tests passed. Both test
files also ran as individual Nx atoms. The packed smoke passed on Node 24.22.2,
Angular core/compiler 22.1.4, CLI/build/SSR 22.1.6, TypeScript 6.0.3 and Chromium
156.0.8078.4: four extracted README examples, two independent SSR requests,
JavaScript-disabled output, real hydration and all post-hydration interactions.
The observation was `hostReused: true`, `containerReused: true`,
`htmlIdentical: true`, `headingReused: false`, with zero browser/hydration errors.

Archive SHA-256 values from the successful fresh consumer:

| Archive          | SHA-256                                                            |
| ---------------- | ------------------------------------------------------------------ |
| core             | `af9c399df59a106dc03a03dca40c91a524afb2fc404b25a0f0ad9d0cb1867c22` |
| html             | `0981a3584bb22506ed17ffa3bae04666bd0dbe7001a601779e447fa7a14c3f34` |
| html-angular APF | `1da7149c1aeedb4a129a89d79e72cfe9b2f0f43724b48fff829b6d5c8559a7fc` |

Moving the APF directory aside and rerunning its build restored all **six** files
byte-for-byte from local Nx cache. The fresh packed target remained uncached.
Its report directory contains the archive/version summary, both SSR responses,
installation/build/server logs and isolated package lock; these generated files
are not committed.

An initial full dependency build and local typecheck/lint/tests succeeded.
A later Nx metadata stall was isolated to this invocation (only its identified
processes were terminated). Retrying with
`NX_WORKSPACE_DATA_DIRECTORY=/private/tmp/685-nx-data` exposed the existing
Nest consumer reference drift described in the preceding renderer validation
records. `nx sync:check` also reports non-composite Angular projects as missing
before filtering them out. This slice does not rewrite unrelated fixture
references or claim a clean workspace-wide sync check. Final focused checks used
`--excludeTaskDependencies` against already built/verified prerequisites; the
committed targets retain their build dependencies. No repository-wide sync
bypass was configured.

No CI monitoring, hosted rerun, remote-cache/DTE experiment, publication or
version bump was performed. The general existing CI discovery can validate the
new project; this change adds no hosted job or paid matrix. Scoped providers and
the host directive remain #686, and the expanded matrix remains #687.
