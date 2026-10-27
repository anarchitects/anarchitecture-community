# Editor.js tool registry implementation contract

This contributor design was established in #592, the first slice of epic #70. It
specifies the implementation and evidence required in #593–#598. The registry is
implemented through #597; #598 consolidates documentation and release evidence.
The increments below record the contract's evolution. Current consumer
contracts are the [core README](../packages/editorjs/core/README.md) and
[Angular README](../packages/editorjs/angular/README.md).

Implementation increment #593 adds core composition, selection, reference
validation, the metadata profile and diagnostics. It also adds `createToolMap`
for synchronous eager materialization: this additive refinement lets the
composition slice supply usable Editor.js maps before #594's asynchronous
resolver exists. Selected lazy definitions fail with `unresolved-tool` without
invoking loaders. Increment #594 implements `createToolResolver(registry, context?)`
and `ToolResolver`, with shared attempts, owner-local success caches, explicit
whole-attempt retry and logical disposal. Context containers are snapshotted at
construction; references are checked on resolution before loading. The diagnostic
codes are `load-failed`, `invalid-loaded-constructor` and `disposed`. Current core
signatures are in the core README.

Increment #595 implements `provideEditorJsTools`, `EDITOR_JS_TOOL_REGISTRY`,
`EditorJsToolContribution` and `EditorJsToolProviderOptions` at the Angular root.
Local contributions and explicit parent lookup delegate composition/selection to
core. An internal scope token shares the public snapshot and its actual owning
environment's `DestroyRef`. Provider options are copied at helper construction;
definitions are snapshotted at first token lookup. Component activation and
resolver/editor lifetime wiring remain #596; providers alone do not activate tools.

#594 also makes the async map boundary explicit: an eager direct class at the key
`then` is rejected by resolution before loading with `invalid-definition`, because
Promise assimilation would invoke it. A configured `{ class: Tool }` registration
or lazy definition with that name is safe. Eager synchronous materialization is
unchanged; the resolver never silently changes a registration's output type.

## Architecture review and authority

Reviewed on 2026-10-26 against Community `a64a11f` and Meta
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. All eight local ADRs and all eighteen
Meta ADR records were enumerated and read during the #70/#592 review, including
proposals and historical records. The inventory was refreshed for #592; the Meta
ADR blobs are unchanged from the epic planning review. No additional tracked local
ADR location was found beyond `docs/adr`.

| Local record                                                                                                                                                                                   | Status and application                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [0001](adr/0001-governance-package-boundaries.md), [0002](adr/0002-governance-core-multi-technology-canonical-model.md), [0003](adr/0003-governance-core-adapter-extension-host-boundaries.md) | Accepted; retain Governance scope. No Governance model or dependency changes.                                                                                        |
| [0004](adr/0004-public-package-documentation.md)                                                                                                                                               | Accepted; each API PR updates its consumer README and verifies the packed README. Planning and evidence stay in contributor docs.                                    |
| [0005](adr/0005-nest-angular-ssr-http-adapter-composition.md), [0006](adr/0006-nest12-ssr-compatibility-and-schema-boundaries.md)                                                              | Accepted; no Nest integration, HTTP adapter/default change or schema-framework dependency here.                                                                      |
| [0007](adr/0007-package-initial-release-and-nx-versioning.md)                                                                                                                                  | Accepted; actual distribution history determines commit/release intent. No publication in this epic's design slice.                                                  |
| [Modern Angular](adr/modern-angular-22-signal-forms.md)                                                                                                                                        | Accepted; especially A01/A02/A03/A05/A06/A07/A09/A10/A11: bounded versions, public seams, provider ownership, async lifetime, native Forms, SSR and packed evidence. |

The complete Meta inventory is recorded by filename under the
[reviewed ADR directory](https://github.com/anarchitects/anarchitecture-meta/tree/823568eeadb56d848c32e8a3d3b4adfae7b2a1c5/adr):

| Records                                                                                                                                                                                                                                        | Status and relevance                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ADR-0001.md`; `0001-two-core-implementation-styles.md`; `0002-modulith-first-ecosystem-position.md`; `0003-cross-repo-ai-enablement-model.md`; `0004-meta-owns-landscape-contracts.md`                                                        | Accepted; preserve repository ownership and ecosystem boundaries. No new cross-repository contract owner.                     |
| `0001-cooperative-governance-enrichment.md`; `0005-governance-hierarchy-and-policy-inheritance.md`; `0006-archi-as-reference-implementation-for-enterprise-architecture-governance.md`; `0007-governance-workspace-layering-model.md`          | Proposed; do not impose these Governance models on this registry.                                                             |
| `0008-http-platform-independence.md`; `0009-native-node-candidate-default.md`; `0010-nest-first-runtime-and-dependency-policy.md`; `0011-nest12-authn-authz-contracts-and-compatibility.md`; `0012-canonical-public-api-contract-ownership.md` | Accepted, with the native Node decision accepting evaluation only. No HTTP, authentication or canonical wire-contract change. |
| `0008-modern-angular-22-signal-forms.md`                                                                                                                                                                                                       | Accepted; applied through the local Modern Angular decision and guides.                                                       |
| `0013-package-initial-release-and-nx-versioning.md`                                                                                                                                                                                            | Accepted; same release discipline as local 0007.                                                                              |
| `0014-renovate-and-dependabot-dependency-management.md`                                                                                                                                                                                        | Accepted; no dependency upgrade or automation change. Historical rollout observations do not alter the current policy.        |
| `0015-nx-task-caching-and-distributed-execution.md`                                                                                                                                                                                            | Accepted; later validation tasks need accurate inputs, outputs and dependencies, safe caching and assessed distribution.      |

Read the [guide index](guides/modern-angular/README.md),
[repository application](guides/modern-angular/repository-application.md), and
architecture, providers/routing, reactivity, Forms, rendering/defer, SSR/build,
testing/migration and API-ledger topics with this design. Repeat the ADR preflight
before implementation and when scope changes.

No accepted-ADR conflict or exception is proposed. Generic Angular skill/MCP
advice about root singletons and forms does not override the accepted local
ownership and Signal Forms rules. This design deliberately avoids mutable root
registries and a new Forms implementation. Approval of this design does not
certify the future API or broaden the existing compatibility matrix.

## Existing surface and evidence

| Existing owner                                                                      | Surface and implication                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core [tool contracts](../packages/editorjs/core/src/lib/tool-configuration.ts)      | `ToolConstructor` is an opaque constructor reference. `ToolRegistration<Tool, Config, Data>` accepts a class or `ToolConfiguration`; the latter owns `class`, `config` and `ToolOptions`. `ToolboxEntry<Data>` preserves typed partial saved data. Reuse these contracts without widening them to arbitrary functions or module namespaces. |
| Core document APIs                                                                  | Parsing, normalization, saved-data validation, provenance and `EditorJsDocumentCoordinator` already exist. They neither register browser tools nor validate executable tool configuration.                                                                                                                                                  |
| Angular [configuration](../packages/editorjs/angular/src/lib/editorjs-contracts.ts) | `EditorJsTools` is a name-to-registration map. `EditorJsConfig` reserves holder/data/lifecycle callbacks and is initialization-only. No registry metadata needs to enter this type.                                                                                                                                                         |
| Angular [loader](../packages/editorjs/angular/src/lib/editorjs-loader.ts)           | `EDITOR_JS_LOADER` / `provideEditorJsLoader` return a promise of a synchronous `EditorJsFactory`. Loading code does not own an editor. The component owns holder, instance, readiness and destruction.                                                                                                                                      |
| Angular `/forms`                                                                    | `EditorJsControl` composes the root component and core coordinator. Registry use must follow that same path without another resolver or Forms requirement.                                                                                                                                                                                  |
| Core tests                                                                          | `tests/tool-upload.spec.ts` checks constructor/config/data inference and pinned upstream declaration compatibility. `tests/package.spec.ts` and `fixtures/type-only-consumer.ts` cover dependency-free ESM imports, ES2022-only declarations, NodeNext/Bundler consumers and packed README examples. Extend these gates.                    |
| Angular tests                                                                       | `tests/loader.spec.ts`, `component.spec.ts`, `forms.spec.ts` and `forms-interop.spec.ts` cover existing ownership. `tests/package.spec.ts` and its consumer/callout-tool fixtures cover exact exports, root without Forms and packed declarations/examples.                                                                                 |
| Private integration projects                                                        | `editorjs-angular-host` and `editorjs-angular-e2e` own browser, packed consumer, SSR, hydration and route-isolation evidence. Reuse the [SSR contract](editorjs-angular-ssr-design.md), [fixture record](editorjs-angular-ssr-fixture.md) and [release matrix](editorjs-angular-release-readiness.md).                                      |

Installed references at review are Angular 22.1.4 and Editor.js 2.31.7. Retain
the pinned Angular 22.0.0 / 22.1.4 / 22.2.2 cells with Node 22.22.3 / 24.15.0 /
26.0.0 respectively, Editor.js 2.31.7 and TypeScript 6.0.3. Core retains its
independent Node 22.12.0 minimum. Installed declarations and fixtures, rather than
the current Angular website alone, decide whether an API works on every cell.

## Package placement and planned API

Extend the existing core root entry point with neutral types and algorithms. Add
optional provider exports to the existing Angular root entry point; no new package
or secondary entry point is needed. Angular root remains importable without Forms.
Core never imports Angular, Editor.js runtime, browser globals or concrete tools.

| Planned surface                                        | Contract                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core `ToolDefinition`                                  | Typed descriptor with `name`, `kind` (`block`, `inline`, `tune`), explicit `source` (`eager`, `lazy`) and optional `replace: true`. Eager descriptors contain an existing typed `registration`; lazy descriptors contain `load` and optional `settings` with the same config/options types but no `class`. |
| Core `ToolRegistry`                                    | Immutable ordered snapshot of descriptors and a built-in profile; no editor, DI container, running loader, global registration or mutable add/remove API.                                                                                                                                                  |
| Core `composeToolRegistry`                             | Accept ordered groups of definitions and an explicit built-in profile. Check structure/conflicts and return a snapshot without evaluating tool code.                                                                                                                                                       |
| Core `selectToolRegistry`                              | Return a snapshot containing only explicitly named definitions, in requested order. Omission of selection means all definitions; an empty selection means no custom definitions.                                                                                                                           |
| Core `ToolReferenceContext` / `validateToolReferences` | Validate default-block and toolbar/tune name references against the selected definitions and built-in profile. Accept only the needed neutral fields, not upstream `EditorConfig` or an Angular type.                                                                                                      |
| Core `createToolResolver`                              | Create an owner-scoped resolver for one selected registry. Its `resolve()` returns a promise of the typed tools map; `dispose()` invalidates pending work and drops retained results.                                                                                                                      |
| Core `ToolRegistryError`                               | Structured diagnostic with stable code, tool name and input location where applicable, and the original cause for load failures. No Angular dependency.                                                                                                                                                    |
| Core `EDITOR_JS_2_31_7_TOOL_PROFILE`                   | Plain immutable metadata for the tested upstream built-ins/default block. No classes, imports or loaders. Explicit version in the name prevents a claim of universal upstream compatibility.                                                                                                               |
| Angular `provideEditorJsTools`                         | Accept definitions and optional scope/selection options; return `EnvironmentProviders`. Register inert contributions, not editors or an eagerly resolved tools map.                                                                                                                                        |
| Angular `EDITOR_JS_TOOL_REGISTRY`                      | Read-only token for the owning environment's composed snapshot. Optional to consumers; no implicit root mutable service or resolver cache.                                                                                                                                                                 |

Names above are the implementation target. #593 must prove generic inference and
declaration compatibility before publishing signatures: literal keys, constructor,
config and toolbox-data types survive composition, selection and lazy resolution.
Dynamic names may yield a broader record; do not claim compile-time validation of
runtime strings. Any necessary signature refinement must preserve this behavior
and update this design in the same PR, rather than silently dropping type safety.

No helper needs to expose a raw Editor.js instance. No saved-data validator is
implicitly registered from a tool definition. Application schemas remain separate.

`composeToolRegistry` also accepts an optional already composed base snapshot;
its profile must match the supplied profile. Base entries seed the ordered map
as resolved definitions, not as replacement commands to replay. Local definitions
then use the same conflict rules. `createToolResolver` receives a neutral reference
context (default empty) and snapshots its option arrays; its first resolution calls
`validateToolReferences`, which throws `ToolRegistryError` on invalid references.
Angular also validates before invoking the resolver to classify these as config
failures. A profile without a default requires an explicit valid default block in
that context; it cannot silently assume `paragraph` exists.

## Composition, names and selection

1. Traverse groups and definitions in supplied order. All tool kinds share one
   name namespace because upstream receives one `tools` map. Names are exact,
   case-sensitive strings, never trimmed or rewritten.
2. Reject empty/whitespace-only names, `__proto__`, `prototype`, `constructor`,
   and canonical array-index keys, whose JavaScript enumeration order would defeat
   the promised map order. Other nonempty names, including namespaced names, are
   preserved. Use own data properties and safe maps; inherited properties cannot
   introduce registrations. Reject accessors in registry-owned descriptor/settings
   fields instead of executing them during composition. Opaque config is not walked.
3. A duplicate custom name fails, even for the same class/descriptor identity.
   Replacement requires `replace: true` on the later definition. It must name an
   existing custom or replaceable built-in tool of the same kind; otherwise fail.
   Replacing a custom tool retains its original position. A built-in replacement
   enters the emitted custom map at its declaration position.
4. Replacement replaces the entire definition, including loader, class, config and
   options. There is no implicit last-wins, recursive merge, patch or concatenation.
   To change kind, construct a new registry without the old entry.
5. Selection occurs after structural validation and conflict resolution. Unknown
   or repeated selection names fail. Selection names refer to custom definitions,
   including explicit built-in replacements; implicit built-ins are not selectable
   imports. Selecting no custom tools leaves upstream built-ins available.
6. Do not auto-select dependencies or load a referenced but unselected tool. Check
   references against the final selection before loading. Structural errors and
   duplicate declarations remain errors even if a later selection excludes them;
   references in excluded definitions are not activation requirements.

Example outcomes in prose: two `image` definitions fail by default; a later
same-kind `image` with `replace: true` supplies its whole configuration, not a
blend. Selecting `heading` and `alignment` emits those two definitions in that
order. If `heading.tunes` references an unselected `alignment`, activation fails
before either loader runs. Omitting a replacement for `paragraph` restores the
upstream paragraph behavior; selection is not a way to remove internal tools.

### Configuration ownership

| Value                                                                                          | Copy/precedence rule                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Groups, definition records, selection and name lists                                           | Snapshot into library-owned containers; subsequent mutation of the caller's list cannot change the registry.                                                                                                  |
| Configured registration/settings shell                                                         | Copy own supported fields. Preserve absent versus explicit `false` and empty arrays. Produce a fresh mutable output shell for each successful `resolve()` call so upstream need not mutate registry metadata. |
| `inlineToolbar` / `tunes` name arrays; toolbox entry arrays and entry shells                   | Copy containers on input and output. Preserve order; never concatenate replacement lists.                                                                                                                     |
| `config`, nested config objects/arrays, toolbox `data`, functions, class and service instances | Opaque references retain identity. Do not JSON-normalize, recursively clone, freeze or merge caller values. Hosts must treat them as immutable for a registry's lifetime.                                     |
| Replaced definition                                                                            | Nothing is inherited from the displaced definition. Missing fields become absent and upstream applies its own defaults.                                                                                       |

This protects registry structure, not arbitrary third-party mutable configuration.
Hosts needing per-editor/request mutable service/config instances must create
separate definitions at that ownership boundary. Sharing an immutable class/module
reference is different from sharing mutable configuration. Registry code never
constructs tools, invokes their static lifecycle hooks or disposes host services.

The emitted map uses existing `ToolRegistration` values. Direct eager classes
remain classes; configured and lazy definitions produce the corresponding fresh
configuration shells. Lazy loaders return a constructor, never a complete config
or module namespace. The host's loader must select a named/default export itself.
Thus lazy settings are known before loading and cannot acquire hidden overrides
from a downloaded module.

## Built-ins and reference validation

The pinned Editor.js artifact includes `paragraph` and internal `stub` block tools;
`bold`, `italic`, `link` and internal `convertTo` inline tools; and `moveUp`,
`delete`, `moveDown` tunes. The profile records these names and kinds without
importing their classes. `stub` and `convertTo` are reserved implementation helpers:
the registry does not allow replacing or using them as an application default
block. `convertTo` may be a recognized inline reference. Other built-in replacements
require an explicit same-kind definition with `replace: true`.

Core composition receives a profile explicitly, including an empty one for a
custom host. Angular supplies the pinned profile for its supported Editor.js
integration. #597 must exercise it against the real pinned runtime. A future
upstream version/profile requires evidence; the profile does not certify every
version admitted by a peer range. Classless overrides of internal settings are
outside this first registry API; the existing `ToolRegistration` class requirement
is not silently relaxed to match upstream's broader `InternalToolSettings`.

Before resolution/creation, `validateToolReferences` checks:

- The effective default block, using upstream's existing truthy precedence:
  `defaultBlock`, then deprecated `initialBlock`, then profile default `paragraph`.
  It must be an available non-reserved block. Do not rename the deprecated field
  or silently change its precedence in existing callers.
- Explicit global and selected block `inlineToolbar` lists contain available
  inline names; explicit global and block `tunes` lists contain available tune
  names. Reject duplicate, missing or wrong-kind references with their field path.
  Validate explicit lists even if another setting currently disables their UI.
- Boolean/absent toolbar and per-block tune options retain upstream meaning;
  never expand `true` into the list of custom definitions. Global `tunes` remains
  a list, as in upstream config. Do not equate `tunes: []` with disabling internal
  tunes; upstream appends internal tunes unless the block disables tunes.

Pass these options through without rewriting upstream behavior. Registry order is
the custom map order, not a guarantee about the final toolbar: upstream owns
internal-tool ordering, conversion controls, defaults and class-level toolbox
merging. The registry's whole-definition replacement does not disable upstream's
own merging of internal defaults or class metadata.

Descriptor `kind` is declared metadata, not proof of runtime conformance. Validate
the supported config/options shapes, but do not execute constructors or static
getters to prove interfaces. Constructor-like values receive structural checks;
actual constructability, `isInline`/`isTune`, lifecycle methods and read-only support
remain upstream/host responsibilities, proved by fixtures. Content validation,
HTML sanitization and trust in executable tool code are separate concerns.

## Lazy resolution and lifetime

Use `source` to distinguish eager and lazy definitions. Both classes and loaders
are JavaScript functions; `typeof value === 'function'` is not a discriminator.
A lazy `load` is a zero-argument promise-returning function yielding the declared
constructor. Reject ambiguous descriptors containing both eager and lazy fields.
Imports, composition, selection, token lookup and resolver construction invoke no
loader. A non-Angular host explicitly calls `resolve()` after its browser/lifetime
checks; core has no platform detection or DOM-bearing cancellation type.

| Resolver state/event                                  | Required behavior                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idle, first `resolve()`                               | Validate selected references supplied by the host, then start selected lazy definitions in registry order, allowing their asynchronous work to overlap. Eager definitions never require instantiation.                                              |
| Concurrent `resolve()` calls                          | Join one internal attempt; each successful caller gets its own map/settings shells. No second loader invocation within that attempt. Output follows selection order, not completion order.                                                          |
| Success                                               | Retain resolved constructor references only for this resolver. Later calls rebuild fresh map shells without loading again. No global, injector-wide or cross-editor result cache.                                                                   |
| Synchronous loader throw, rejection or invalid result | Reject with `ToolRegistryError`, including definition name and original cause. Never return a partial map. A terminal failure invalidates the attempt; late siblings are observed but cannot populate a cache or produce unhandled rejections.      |
| Explicit retry after failure                          | A later `resolve()` starts a new complete attempt; no automatic retry, delay or retained partial success. Already running dynamic imports can still finish. Loaders must be side-effect-free code loaders; a new attempt may overlap an old import. |
| `dispose()`                                           | Idempotently invalidate the attempt and reject joined pending calls with a disposed diagnostic promptly, even if a loader never settles. Clear caches and prevent subsequent calls or late continuations from reviving the resolver.                |

Registry errors distinguish invalid definition/name/options, duplicate name,
invalid replacement, invalid selection/reference, load failure, invalid loaded
constructor and disposed owner. Deterministic synchronous validation reports the
first error in input/field order. With concurrent loads, the first observed failure
wins; do not promise deterministic failure order across asynchronous completion.
Preserve the underlying exception as `cause` without serializing host configuration.

Resolver disposal is logical cancellation. It cannot unload an imported module,
undo module side effects, abort native dynamic import or destroy an editor. Each
host owns its resolver and raw editor lifetime separately. Do not use the document
coordinator as a second tool-loading queue: tool resolution precedes editor creation.

## Angular provider scope and precedence

`provideEditorJsTools(definitions, options)` contributes inert definitions in an
application or route environment. Options are `inherit` (default `false`) and
`select` (default all). Environment providers do not belong in component
`providers`; use a child environment or direct component config for that boundary.
No asynchronous environment/app initializer is needed and bootstrap does not wait
for tools. The helper accepts either a definitions array or an explicit
`{ factory: () => definitions }` contribution. The latter runs once, synchronously,
in its owning environment's injection context when its registry is first resolved;
it may capture host services but must return inert definitions, not a promise or
browser-loaded code. This is distinct from each definition's asynchronous `load`.
Neither a bare function nor a class is accepted as a provider contribution.
`load` cannot call `inject()` after an await or assume any injection context.

| Situation                                | Resolution                                                                                                                                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No registry provider anywhere            | Existing direct configuration and loader behavior remain unchanged.                                                                                                                                                                       |
| Child has no local helper call           | Normal DI lookup sees the nearest ancestor snapshot. No new registration or resolver is created merely by lookup.                                                                                                                         |
| Local helper with `inherit: false`       | Compose only local contributions, hiding ancestor definitions. This is the default when a scope declares its own registry.                                                                                                                |
| Local helper with `inherit: true`        | Read the nearest parent snapshot explicitly using optional parent lookup; compose parent selected definitions first, then local contributions. Missing parent means empty. Apply local selection last.                                    |
| Repeated helper calls in one environment | Concatenate local definitions in provider order. All calls must have identical normalized options (including selection order); conflicting options fail rather than last-provider-wins. Duplicate tools still follow core conflict rules. |
| Sibling environments                     | Independent snapshots; child replacement never mutates parent or sibling state. Parent-excluded definitions cannot be recovered through child inheritance.                                                                                |

Collect local contributions with self-scoped lookup; do not assume Angular multi
providers concatenate through the injector hierarchy. Parent inheritance must
consume the already composed parent snapshot without replaying its original
replacement operations. Core must provide composition of a base snapshot plus
local definitions so Angular does not implement conflict logic itself.

Composition/token lookup can report synchronous configuration errors through the
normal DI failure path; it never invokes loaders. The component looks up the
registry only in the provider-default path below, so an explicit tools map is not
made dependent on an unused malformed registry. Capture the injector in the
synchronous injection context, then use its lookup API at initialization.

| Initial component config                           | Tool source                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config.tools` is defined, including `{}`          | Entire explicit map wins. Do not look up, merge, validate through the new registry or load provider tools. Preserve the existing direct path. `{}` still lets Editor.js provide built-ins. |
| `config.tools` omitted/undefined, registry present | Use the selected provider snapshot, validate references against this component's global options, and resolve it with a fresh component-owned resolver.                                     |
| `config.tools` omitted/undefined, no registry      | Preserve the current undefined tools/default built-in behavior.                                                                                                                            |

This is full-map precedence, not a per-key overlay. A host wanting a combination
uses core composition explicitly, or selects/configures provider contributions
and leaves `config.tools` absent. No new input or registry field is added to
`EditorJsConfig`; different editors can supply different direct maps. Unsupported
untyped values such as `tools: null` are not an opt-in to provider defaults.

The environment owns its snapshot and destruction notification, not editor state.
An internal Angular scope binding captures that environment's `DestroyRef` beside
the snapshot; public core snapshots never contain Angular lifecycle references.
The public snapshot token and component lookup must delegate to this same binding,
including inherited lookups, so cleanup follows the actual provider owner.
An active component resolver is disposed on either component destruction or
destruction of the environment that owns its provider snapshot. Remove registered
cleanup callbacks when the component dies first. Provider-owner destruction is a
terminal lifetime boundary for a consuming editor as well: dispose its coordinator
and raw instance through the existing owner path, with no late outputs. Do not
share resolvers to achieve this. Destroying a child must never destroy its parent.
Route exit alone is not proof of environment destruction; normal component teardown
must independently clean up, including when a route injector is retained for reuse.

## Browser initialization, custom loaders and errors

Retain the existing browser/platform and supported render/hydration activation
boundary. At most one initialization attempt runs per component:

1. Capture the original initialization config and mark initialization started.
   Select the direct path or provider-default path above. In the provider path,
   obtain the snapshot and validate selected references without loading anything.
2. Resolve tools in the component-owned resolver. Await completion and check both
   component and provider-owner lifetime before continuing. On direct/no-provider
   paths, skip this step entirely.
3. Invoke the already selected `EDITOR_JS_LOADER`, including a custom override,
   then await its factory. Check lifetime again. Load tools before the editor so a
   tool failure does not unnecessarily load the editor; do not replace or wrap the
   DI loader with another provider-order-dependent loader implementation.
4. Read and normalize the latest bound data through core, as today. Pass a fresh
   config shell with resolved `tools` only on the provider path. Keep the original
   config identity for initialization-only change detection. Preserve holder,
   callbacks, read-only settings and other host options.
5. Call the factory synchronously once, await raw readiness, reconcile the latest
   document and emit the existing payload-free ready event only for a live owner.
   Keep the existing destroy-before-readiness cleanup and coordinator behavior.

Changing input config during loading or after readiness emits the existing
`config-changed` diagnostic; it does not restart loading or change the captured
registry. A new component is required for reconfiguration or an Angular retry
after failed initialization. Core's explicit resolver retry does not introduce a
new component retry method. Data updates during loading still use the latest data
at creation and existing reconciliation afterward.

| Failure                                                                      | Angular error channel                                                                                                                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Registry composition/selection/reference error encountered by initialization | `operation: 'config'`, `code: 'operation-failed'`, original `ToolRegistryError` as cause. A host that resolves the token itself receives the ordinary DI error directly. |
| Tool load/rejected or invalid constructor                                    | `operation: 'load'`, `code: 'operation-failed'`, registry error retaining loader cause. Stop initialization; do not also report readiness failure.                       |
| Editor loader/factory/readiness failure                                      | Existing `load` / `create` / `ready` operation and cause semantics remain intact.                                                                                        |
| Owner disposal during asynchronous work                                      | Suppress outputs and prevent creation. Observe late failures; disposal is not a user-visible load failure.                                                               |
| Raw destruction fails after terminal owner teardown                          | Existing Angular `ErrorHandler` path, with no post-destruction component output.                                                                                         |

Do not widen the shared `EditorJsOperation` or error-code unions just to identify a
tool; its structured cause carries that context. No duplicate ready/change/error
outputs, second raw editor, second document coordinator or per-tool Forms control.
The optional Forms component inherits this behavior through its existing child;
loading does not manufacture field dirty/touched/validation state.

## SSR, delivery and isolation

Server root imports, provider creation, token lookup and rendering may compose
inert metadata but must never invoke a tool/editor loader or evaluate a browser
module. Preserve empty server holders and matching initial client DOM under #69's
bounded hydration profiles. Browser activation owns all tool/editor DOM.

Host definitions must also be server-safe: a static import of a browser-only tool
at a route/provider module's top level cannot be repaired by a lazy registry. Use
explicit lazy descriptors to keep those imports behind browser activation. Do not
serialize constructors, loaders, service instances or registry snapshots into
transfer state. Request-specific config belongs to request-owned environments,
never mutable module-level definitions or caches.

Non-authoring delivery is a host/bundler contract. Place provider definitions with
lazy authoring routes, retain the documented no-preloading baseline, and verify
production chunks, network requests and module-evaluation probes. A successful
server import alone proves none of those delivery properties. Module code may
remain cached after leaving the route; resolvers and editor state must not.

## Acceptance and evidence matrix

| Slice                         | Required evidence and owner                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #593: core composition        | Core unit/type tests for all kinds; literal inference; direct/configured class compatibility; group order; same/different-kind collisions; explicit/missing-target replacement; empty/unknown/repeated selection; safe keys/accessors; no constructor/loader/static-hook execution; immutable containers and opaque identity. Packed core remains ES2022-only and dependency-free.                                                      |
| #594: resolution              | Core deferred-promise tests for selected-only invocation, deterministic result order, concurrent callers, fresh output shells, synchronous throw/rejection/invalid constructor, partial failure, explicit retry and stale siblings. Dispose before/during/after loading, including never-settling imports; no unhandled rejection, shared cache or revived owner.                                                                       |
| #595: providers               | Angular DI tests for absent/local/inherited registries, default isolation, parent snapshot composition, repeated calls with matching/conflicting options, duplicate registration, siblings and actual environment destruction. Provider/token setup remains inert on server. Exact exports and root-without-Forms packed checks.                                                                                                        |
| #596: lifecycle               | Component/loader tests for full-map precedence, explicit `{}` bypass and unused malformed providers; custom loader receives resolved config and stays authoritative; correct `config`/`load` error causes; config change and latest data while loading; multiple editors; destruction at every await; retained route injector and provider-owner destruction; one ready/raw instance/coordinator. Optional Forms follows the same path. |
| #597: integration             | Real block/inline/tune behavior in a direct non-Angular packed browser consumer and Angular fixtures using equivalent registrations. Default paragraph, built-in inline/tunes, explicit same-kind replacement, toolbar/tune options, failed load and recreation need positive controls. Retain no-Angular and no-DOM core consumers as separate evidence.                                                                               |
| #597: SSR and artifacts       | Existing private host/e2e projects cover server import/render, distinct concurrent requests, hydration and real lifetime. Production bundle/network/evaluation assertions prove unselected-tool and non-authoring isolation, with authoring positive controls and an eager-import negative control. Extend pinned packed matrix, including root without Forms and bounded opt-in Forms coverage.                                        |
| #598: documentation/readiness | Reconcile incremental README/API examples, compile public examples from packed artifacts, verify README/exports/declarations/peers and record versioned evidence/limits. Required CI must be green on the eventual release commit; no automatic release.                                                                                                                                                                                |

Use resolved Nx targets, retaining library unit/contract tests with their owner and
executable integration hosts outside publishable libraries. A minimal non-Angular
packed browser consumer belongs to the existing integration harness unless a
separate build/lifecycle boundary justifies another private project. It must
actually install without Angular; an Angular host with an unused Angular import
does not prove that property. Do not block on #543 or expand its workspace audit.

Before adding validation targets, inspect existing inputs/outputs and CI ownership.
Cache deterministic preparation only with complete toolchain/configuration inputs
and restorable artifacts; isolate ports/output directories before distribution.
Document any required serialization or uncached fresh external check under Meta 0015. This design introduces no new tasks or cache policy.

## Review boundaries and implementation evidence

This design chooses replacement, selection, provider inheritance and failure
semantics; these are not deferred product decisions. The implementation slices
now supply type, unit, provider, packed-browser and SSR evidence, consolidated in
the [registry readiness record](editorjs-tool-registry-release-readiness.md).
Evidence remains bounded to the documented versions and host policies; required
CI must pass on the eventual release commit. If later evidence requires a
contract change, amend this document explicitly in
the affected PR before claiming compatibility. No undocumented fallback to weaker
typing, silent overrides, global caches or broader SSR exceptions is authorized.

Concrete tools (#71), uploads (#72), expanded custom-tool guidance (#73), persistence
(#74), broader demos/testing (#75/#78), publication (#76), live tool replacement,
server-side content rendering and application adoption remain outside this scope.
Follow #70's sequential PR workflow; completion does not authorize starting a
follow-on issue or publishing without the maintainer's instruction.

## Evidence references

- [Portable registry validation](editorjs-tool-registry-validation.md) records
  #597's shared browser tools, clean packed consumer, SSR/hydration, lazy delivery
  and Nx evidence boundaries.

- The installed 2.31.7 declarations and distribution were inspected without
  evaluating the browser module. Upstream pinned sources:
  [tool settings](https://github.com/codex-team/editor.js/blob/v2.31.7/types/tools/tool-settings.d.ts),
  [editor config](https://github.com/codex-team/editor.js/blob/v2.31.7/types/configs/editor-config.d.ts),
  [tools](https://github.com/codex-team/editor.js/blob/v2.31.7/src/components/modules/tools.ts).
- Angular MCP best-practices and
  [EnvironmentInjector](https://angular.dev/api/core/EnvironmentInjector)
  documentation were consulted. Injection is synchronous; an asynchronous loader
  must not assume an injection context survives an await. The local
  [API ledger](guides/modern-angular/api-ledger.md) supplies the version-bounded
  environment-provider and route-lifetime references.
- The design itself is not executable evidence. The linked validation and
  readiness records identify the actual tests, artifacts, versions and remaining
  limits for the implemented API.
