# Editor.js Angular HTML directive and configuration validation

Evidence for [#686](https://github.com/anarchitects/anarchitecture-community/issues/686),
4 November 2026, based on merged #685 at
`25003490b19749ac1aa74fa777c3c230e17e826a`.
The public contract is the [packaged README](../packages/editorjs/html-angular/README.md).

## Architecture preflight

Freshly enumerated and read all nine Community and all 18 Meta ADRs before code
generation, including proposed, historical and superseded content. No additional
local ADR directory or nested AGENTS file was found. Meta's remote recursive
inventory matched the clean adjacent checkout at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`.

Community inventory: 0001 governance boundaries; 0002 canonical model;
0003 core/adapter/extension/host ownership; 0004 package documentation;
0005 Nest/Angular SSR composition; 0006 Nest12 SSR compatibility;
0007 independent versions; 0008 HTML rendering; and the named Modern Angular 22
signal-forms ADR. All are accepted.

Meta inventory: both 0001 records (cooperative governance and two core styles),
0002 modulith, 0003 AI enablement, 0004 landscape ownership, 0005 hierarchy,
0006 Archi, 0007 layering, both 0008 records (HTTP independence and modern Angular),
0009 native Node candidate, 0010 Nest dependency policy, 0011 auth compatibility,
0012 public contracts, 0013 independent versions, 0014 dependency maintenance,
0015 Nx caching/DTE and ADR-0001 landscape. Cooperative governance, hierarchy,
Archi and layering remain proposed and do not override accepted policy.

Read the Modern Angular index, repository application, architecture, reactivity,
providers/routing/HTTP, rendering/elements, SSR/build and testing/migration guides,
plus the applicable Editor.js Angular development/packaging guidance. Consulted
Angular MCP best practices, Angular skill references for host elements and
hierarchical providers, and installed framework/compiler contracts.

Applicable decisions:

- Community0008: normal Angular HTML binding, headless-owned validation and
  sanitization, directive child ownership, immutable option snapshots and
  component/directive behavior parity. No trust bypass, extra sanitizer,
  imperative pre-hydration writes or authoring dependencies.
- The accepted renderer-specific ordinary `Provider[]` helper is a deliberate
  local refinement of the general environment-provider guidance. It supports
  application, route and element scopes. Nearest configuration replaces the
  parent completely; defined instance fields overlay it. Nested objects and
  registries replace, without recursive merging or concatenation.
- Angular A01/A03/A05/A06/A09/A10: exact verified baseline, injector scope without
  promises about route destruction, computed rendering, signal inputs/outputs,
  host-owned SSR/hydration providers and compiled packed-consumer evidence.
- Community0004: complete public examples and consumer-focused archive README.
  Contributor commands, issue sequencing and fixture details live here.
- Community0007/Meta0013: retain independent 0.0.1 and exact
  `init(editorjs-html-angular)` commit scope. Fresh npm lookup returned E404;
  none of 117 remote tags or 102 Releases identifies the package.
- Meta0015: complete cache inputs, build prerequisites and independent test
  atoms; fresh installation proof stays uncached. Local evidence is not hosted
  DTE certification. Broader compatibility coverage remains #687.

No unresolved accepted-decision conflict or policy exception was identified.
HTTP/Nest defaults and advertised compatibility remain unchanged.

## Implementation and public ownership

After installed generator schema/source discovery and a matching dry run:

```sh
yarn nx g @nx/angular:directive packages/editorjs/html-angular/src/lib/editorjs-html.directive.ts \
  --name=EditorJsHtmlDirective --selector=aaEditorjsHtml \
  --skipTests --skipImport --skipFormat --no-interactive
```

The standalone directive restricts its selector to otherwise empty `div`,
`article` and `section` hosts. It binds only `innerHTML`, preserves unrelated
host attributes and exposes qualified template inputs/output plus `exportAs`.
Its programmatic data/options/result/resultChange API matches the component.
Conflicting child ownership and unsupported hosts are explicitly documented.

Both presentations use one per-owner computed rendering path. The effect only
notifies subscribers; callbacks/subscribers remain untracked. Strict failure
clears old HTML. Angular destroys the owner's reactive effects and subscriptions.
No request/document/result state lives in the DI configuration token.

Provider configuration is snapshotted when the helper runs; instance options
when input identity changes. Plain records/arrays are recursively copied and
frozen without invoking getters or freezing caller objects. Callbacks retain
identity. Structural limits are 32 levels, 1,000 array entries and 10,000 values.
Malformed structures go through the existing headless invalid-configuration
result path; semantic validation and safety ceilings remain headless-owned.
Unknown fields are retained for rejection, including undefined-valued fields;
the overlay uses a null-prototype record. Internal helpers are not APF exports.

## Local checks and packed proof

Build, Angular/TypeScript typecheck, ESLint and all **35 tests** passed. Each of
the four test files also passed as its individual Nx atom: 13 component,
12 directive, seven provider and three package tests.

Compiled-APF TestBed checks exercise strict/preview/failure/empty results,
replacement/recovery, immutable snapshots, coalescing, teardown, host attributes,
supported/unsupported selectors, semantics and component parity. An instrumented
public Angular `Sanitizer`/`DomSanitizer` binding proves both presentations pass
their HTML through Angular's HTML security context. Provider tests cover actual
root, route and element lookup, navigation, whole-value replacement, typed custom
registrations, malformed configuration and independent owners. Type/package tests
verify the public signal/output/provider contracts and intentional export surface.

The uncached packed consumer passed using actual core/headless/APF archives,
a fresh temporary npm installation/cache and a production SSR/client build.
All **seven** README examples were extracted from the installed archive and
compiled with ngc. Two concurrent SSR requests retained independent document
state; JavaScript-disabled Chromium displayed meaningful directive output.
Script-gated real hydration reused the directive host with identical HTML,
and reused the component host/container with identical HTML. Inner descendant
identity is not promised (the component heading was rebound).

Browser checks cover application, two route, element and per-instance policy;
compiled element-scoped README examples; component/directive result/HTML parity;
host-attribute preservation; heading/list/image-alt/caption semantics; updates,
clearing, recovery, preview and empty data. An inline-handler positive control
executes in the browser. Unsafe preview links/handlers and unsafe custom output
then fail the negative controls: no attack execution, rejected image request,
unsafe attribute or navigation. There were zero page/console/hydration errors.

Observed versions: Node 24.22.2, Yarn 4.18.0, Nx 23.2.1, Angular core/compiler
22.1.4, CLI/build/SSR 22.1.6, ng-packagr 22.1.1, TypeScript 6.0.3,
Vitest 4.0.18, jsdom 22.1.0 and Chromium 156.0.8078.4.

Archive SHA-256 values from the successful packed run:

| Archive          | SHA-256                                                            |
| ---------------- | ------------------------------------------------------------------ |
| core             | `af9c399df59a106dc03a03dca40c91a524afb2fc404b25a0f0ad9d0cb1867c22` |
| html             | `0981a3584bb22506ed17ffa3bae04666bd0dbe7001a601779e447fa7a14c3f34` |
| html-angular APF | `39744ec1c484bac63b3f32bb81baae7261ce0467c376d578db406538ff997aca` |

## Nx execution and reproduction

The two new inferred Vitest atoms retain `build` prerequisites and complete
project/dependency, root TypeScript/lockfile, Node/platform/architecture,
NODE_OPTIONS and CI inputs. All four atoms explicitly set `options.env: {}`:
installed Nx 23.2.1's Vitest plugin otherwise emits `env: undefined` on a cold
graph, which its run-commands schema rejects. Explicit empty environment objects
preserve inherited process variables and make cold/warm graph behavior consistent.
The resolved graph confirms separate cached commands and outputs for every atom.

After moving the APF output aside, the build restored all six files byte-for-byte
from local Nx cache; all eight build/prerequisite tasks were cache hits. The
fresh-install packed target remains uncached.

```sh
yarn nx run-many -p editorjs-html-angular -t build typecheck lint test
yarn nx run-many -p editorjs-html-angular \
  -t test-ci--tests/component.spec.ts test-ci--tests/directive.spec.ts \
  test-ci--tests/providers.spec.ts test-ci--tests/package.spec.ts
yarn nx run editorjs-html-angular:packed-smoke
```

Local execution used `NX_NATIVE_COMMAND_RUNNER=false NX_DAEMON=false
NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true` for this machine's socket/runtime
constraints, without changing CI configuration. Full checks included build
prerequisites. The packed invocation used `--excludeTaskDependencies` only after
the actual prerequisite build passed. Its committed target retains `build`.
The generated packed report is under `dist/test-results/editorjs-html-angular`;
logs, SSR responses, archive summary and isolated package lock are not committed.

No CI monitoring, hosted rerun, remote-cache/DTE experiment, new hosted matrix,
publication or version bump was performed.
