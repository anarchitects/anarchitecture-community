# Editor.js custom-tool integration contract

Contributor design for [#642](https://github.com/anarchitects/anarchitecture-community/issues/642),
the first slice of epic #73. It fixes the scope and evidence required in
#643–#648. The implementation increment below records #643's delivered block
example. Inline/tune, external Code and Angular recipes remain later slices;
the planning tables do not certify those implementations.

## Framework-neutral block increment (#643)

The [shipped custom-tool guide](../packages/editorjs/core/custom-tools.md) now
contains the complete CalloutTool, its neutral validator, direct/eager/lazy
registrations, an explicit editor owner and a runnable page. Core has no new
runtime export, dependency or schema. The guide is explicitly included in the
package archive and linked from its README.

Preflight used merged #642 at Community `8558c32637d7248ed2d04575d7f500b58ab93568`.
All eight local ADRs and eighteen Meta ADRs had been read in this session; this
slice re-enumerated the sources and verified that the local ADRs, engineering
guides and agent instructions are unchanged. The freshly fetched Meta tree still
matches the reviewed clean checkout at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. The complete inventory and applicable
constraints below remain in force; no accepted conflict or exception arose.

The package test compares archived guide bytes and compiles its neutral example
under NodeNext and Bundler with ES2022-only libraries and no ambient types. The
existing portable preparation extracts the guide's actual named TypeScript and
HTML fences, compiles the concrete browser classes, and builds the working page.
Private probes add instrumentation only; they inherit the archived class and
never substitute a second implementation. The existing portable registry spec
owns the additional editing/settings/reload/validation/lifetime cases.

Editor.js 2.31.7 does not export `MenuConfig` by name from its root. The example
derives that type from its exported `BlockTool.renderSettings` signature, keeping
imports public. Text allows attribute-free `b`, `mark` and structural `br`; no
marker authoring implementation is implied. Empty sanitizer attribute maps are
intentional: upstream's `true` tag rule preserves attributes. The browser test
checks removed event/style attributes, excluded image requests and saved HTML.
Browser-only empty `br` scaffolding saves as an empty string without losing the
block or tone. The closed document boundary rejects
unknown tools and saved tunes. Empty text stays valid; a deliberate upstream
validate-false control demonstrates omitted content cannot be recovered by
validating the resulting document.

Resolved core and e2e tasks retain their existing caching and dependencies. The
guide and private probe are added to the explicit packed source fingerprint.
Preparation remains uncached, browser/build work remains in the existing portable
atoms for each CSR cell, and completeness/remote-restoration checks remain intact.
No new project, atom or DTE topology is introduced. Local task checks precede
packing; typechecks emit only their isolated build-info output. This slice's
evidence does not replace #647's broader custom-tool matrix and DTE measurements.

Local validation on 30 October 2026 passed core build/test/lint/typecheck and
e2e lint/typecheck through Nx, plus fresh reference preparation and the existing
portable atom (`si643-local4`). All 21 browser cases passed, including eight new
custom-block cases, in 19.6 seconds of Playwright execution. The consumer used
Node 24.15.0 / TypeScript 6.0.3 / Editor.js 2.31.7 without Angular installed;
the local Nx coordinator used Node 26.13.0. The extracted working page passed
keyboard tone selection, safe restored HTML, empty saves, readonly toggling and
listener teardown. Instrumented cases passed configured direct/eager/alias names,
pre-load rejection, pending-owner disposal, explicit settings notification and
stale-callback guards. Hosted minimum/current cells and remote-cache evidence
remain CI gates; local passing results are not represented as hosted DTE proof.

Fresh history checks on 30 October 2026 returned npm 404 for core, no remote
Editor.js tag refs, and no Editor.js distribution among all 102 GitHub Releases.
The package remains unreleased at 0.0.1; use the exact non-bumping scope
`init(editorjs-core,editorjs-angular-e2e)`. No version bump or publication occurs.

## Architecture review and baseline

Reviewed on 30 October 2026 against Community
`f2e995d80aeb30198aa42b20c8afe52a1af3a0ce`, the merged #72 completion PR #641.
All eight local ADRs and eighteen Meta ADRs were enumerated and read during the
#73 planning review in this session. The #642 preflight re-enumerated the local
locations, verified that local ADRs/guides are unchanged, and refreshed the remote
Meta tree: its ADR blobs still match the reviewed clean checkout at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. The inventories and statuses are listed
in the [registry design](editorjs-tool-registry-design.md#architecture-review-and-authority).
No additional repository ADR location or nested agent instruction was found.

The Modern Angular index, repository application, architecture, provider,
reactivity, rendering, Forms, SSR/build and testing guides inform this design.
Accepted constraints apply as follows:

| Decision                                                    | Application                                                                                                                                                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Community ADR0004                                           | Complete public examples belong with the owning package and must ship in its archive; contributor planning and test chronology stay here.                                                                                 |
| Modern Angular A01/A02/A03/A05/A07/A09/A10                  | Preserve neutral contracts, explicit ownership, standalone composition, optional native Forms, bounded compatibility, SSR isolation and actual consumer proof.                                                            |
| Meta0015                                                    | Reuse the existing atom graph; model new guide/fixture/dependency inputs and restorable outputs. Fresh installs and completeness checks remain uncached. Distinguish local hits from remote restoration and measured DTE. |
| Meta0013 / Community0007                                    | Check real release history, use exact Nx scopes, retain independent release intent and first distribution at 0.0.1.                                                                                                       |
| Meta HTTP/Nest/auth/contracts decisions; Community0005/0006 | No HTTP contract, adapter default, Nest support or authentication change. #72's Nest 12.3.2 reference remains bounded evidence.                                                                                           |
| Governance ADRs and Meta proposals                          | Preserve their scope and status; proposed Governance models do not become Editor.js requirements.                                                                                                                         |

No accepted-ADR conflict or exception is proposed. The upstream inline API
documentation discrepancy below is an evidence distinction, not an ADR conflict.
Repeat the full ADR/guide preflight before each implementation slice and if scope
changes. This design does not authorize starting the next issue automatically.

## Existing implementation and remaining gaps

The [core README](../packages/editorjs/core/README.md) and
[Angular README](../packages/editorjs/angular/README.md) remain authoritative for
current public behavior. Reuse the registry, common-tool and upload designs;
do not reopen their accepted contracts.

| Existing surface/evidence                                                              | Already implemented                                                                                                                         | Remaining #73 work                                                                                                             |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Core `ToolRegistration`, `ToolConfiguration`, `ToolDefinition` and `ToolRegistryTools` | Preserve constructor, config, toolbox-data and literal-name types without defining a browser lifecycle.                                     | Complete authoring examples with concrete validated data/config; positive and negative type cases.                             |
| `composeToolRegistry`, `selectToolRegistry`, `validateToolReferences`, `createToolMap` | Three kinds, explicit whole-definition replacement, reference checks, immutable containers and opaque identities.                           | Demonstrate these APIs with the complete examples; no new registry algorithm.                                                  |
| `createToolResolver`                                                                   | Inert creation, selected-only lazy loading, owner-local cache, joined attempts, explicit retry and logical disposal.                        | Reuse failure/lifetime coverage; add third-party export mapping and example delivery checks.                                   |
| `parseOutputData`, `validateOutputData`, `ToolDataValidator`                           | Structure/JSON checks and synchronous host-owned block-data validation.                                                                     | Complete neutral validators, unknown-tool policy and explicit tune validation at the host boundary.                            |
| Angular root providers/component and `/forms`                                          | Direct-map precedence, environment snapshots, per-editor resolvers, optional native Forms and owner cleanup.                                | Same tools/configuration in usable standalone and Forms recipes; no parallel Angular engine.                                   |
| `src/registry/tools/{card,marker,flag}.ts` in the private host                         | Real but deliberately small browser probes.                                                                                                 | Consumer-quality block/inline/tune authoring, validation, state indication, readonly/keyboard behavior and lifecycle guidance. |
| `portable/registry.spec.ts`, shared `portable/assertions.ts`, hydration registry tests | Actual block editing, inline application, tune activation/save, built-in coexistence, independent owners, failed/held loads and recreation. | Reload, inline removal/state, malformed data, readonly capabilities and third-party behavior not established by those probes.  |
| Packed harness / #72 readiness                                                         | Neutral consumers, Forms-absent installs, exact Angular cells, SSR/hydration, production delivery and DTE infrastructure.                   | Extend its meaningful cases and input inventory; do not duplicate equivalent atoms under new names.                            |

See the [registry validation record](editorjs-tool-registry-validation.md) and
[upload readiness record](editorjs-upload-release-readiness.md) for historical
executed evidence. Their passing results do not certify the new examples.

## Selected references and delivery ownership

Use one small editorial family, with these illustrative host-owned schemas:

| Reference                                            | Planned contract and bounded behavior                                                                                                                                                                                                                 | Owner |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `CalloutTool`, registration `callout`                | Data has `text: string` and `tone: 'info' \| 'warning'`; config has a label. Editable text allows only the documented formatting subset. Tone changes through block settings. Empty text remains representable rather than silently dropping a block. | #643  |
| `MarkerTool`, registration `marker`                  | Toggle a bounded selected range into/out of `mark` formatting, report active state, and save through the enclosing block's text. No independent block data.                                                                                           | #644  |
| `FlagTune`, registration `flag`                      | Per-block `{ flagged: boolean }`, initially false when absent; toggle settings, render a wrapper indication and retain the saved tune on reload.                                                                                                      | #644  |
| External `@editorjs/code@2.9.4`, registration `code` | Code textarea with explicit placeholder config and `{ code: string }` data. Treat saved code as literal content, never executable or trusted HTML.                                                                                                    | #645  |

These are examples of consumer-owned schemas, not new canonical document types.
Reuse or refactor the existing card/marker/flag probes where practical; keep
instrumentation in the private host. Do not promote the existing partial probes
as complete public examples. No new first-party tool package, all-tools bundle,
Angular component-tool bridge, marketplace or generic plugin SDK is needed.

Planned consumer delivery:

- `packages/editorjs/core/custom-tools.md` contains complete original source
  examples, neutral validators, direct/registry/lazy browser bootstrapping and
  teardown, plus the external Code recipe. The core README links it and retains
  a sufficient quick start. #643 explicitly includes this guide in the package
  `files` allowlist; the current allowlist includes only `dist` and will not ship
  an arbitrary new Markdown guide automatically.
- Keep browser examples in named fenced files in that guide, extracted and
  compiled by the package/packed-consumer checks. They are copyable application
  code, not new core runtime exports. Neutral validators compile independently
  with ES2022-only libraries and no ambient Angular, DOM or Node declarations.
- #646 adds complete Angular direct/provider/Forms composition in the Angular
  README, referencing the same neutral definitions and browser implementations.
  Angular bindings do not fork the tool algorithms or saved-data schemas.
- The existing private host/e2e harness owns executable integration and probes.
  Test the actual archived examples, not a second hand-maintained approximation.
  Package checks verify guide bytes, expected example filenames and public-only
  imports. Keep source/test/build-info leakage checks intact.

No missing generic runtime helper has been demonstrated. Start with existing
public APIs. A later concrete gap requires a narrow rationale, neutral ownership,
regression tests and a design amendment in the implementing PR; it is not
permission to add a speculative helper now.

## Exact upstream lifecycle boundary

The installed Editor.js **2.31.7** declarations and pinned upstream source were
inspected alongside the official [Tools API](https://editorjs.io/tools-api/),
[Inline Tools API](https://editorjs.io/inline-tools-api-1/) and
[Block Tunes API](https://editorjs.io/block-tunes-api/). Implementation must follow
the exact supported runtime when living documentation is ambiguous.

| Surface                            | Versioned boundary and reference decision                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Block constructor                  | Receives data, API, config, block API and readonly state. Validate/normalize host input explicitly. Avoid global subscriptions, timers or network work in constructors: upstream can construct tools for capability/paste discovery without rendering them.                                                                        |
| Block `render`, `save`, `validate` | Render the owned element and return saved data. Upstream saving awaits extraction/validation; a false validation result omits that block, not a field error or whole-document rejection. Validate untrusted input before rendering and validate the final document before submission.                                              |
| Block settings/change              | `renderSettings()` returns `MenuConfig` for tone selection. Use `block.dispatchChange()` for internal state changes the editor cannot observe; verify exactly the intended saved change, not just menu appearance.                                                                                                                 |
| Block lifecycle                    | `destroy` is a block-instance cleanup seam; `rendered`, `updated`, `removed` and `moved` are separate notifications. Keep cleanup idempotent and resource ownership local. Do not assume removal notification substitutes for destruction in every flow.                                                                           |
| Inline declaration/render          | `isInline` declares the kind; prefer `render()` returning `MenuConfig` with `onActivate` and `isActive`. The 2.31.7 declarations deprecate legacy `surround`, `checkState` and `renderActions`; the living API summary still labels some required. Runtime accepts `render` as the required method and handles menu configuration. |
| Inline lifetime/readonly           | No generic instance `destroy` contract is promised. Toolbar closure calls legacy `clear` where present; it is not a universal disposal hook. Keep the reference free of global resources and retained ranges outside its toolbar lifetime. Do not advertise readonly support for a mutating marker.                                |
| Tune constructor/menu/save         | `isTune`, `render`, optional `wrap` and `save`; constructor gets API, block, config and saved tune data. Flag mutation dispatches a block change explicitly. The saved map is keyed by the configured tune name.                                                                                                                   |
| Tune cleanup                       | Static `prepare`/`reset` exist; there is no general per-instance tune `destroy` contract in the inspected interface. Avoid class-global mutable state or resources needing that hook. Do not treat a static reset as ownership of all editors; reference tune needs neither static hook.                                           |
| Sanitization                       | Tool/inline rules control editor formatting retention. Schema validation and the public renderer's safety policy are separate. Restrict callout input before DOM insertion using the supported sanitizer, with a narrow documented allowlist; do not trust raw `innerHTML`.                                                        |

Pinned source/type references:
[block tools](https://github.com/codex-team/editor.js/blob/v2.31.7/types/tools/block-tool.d.ts),
[inline tools](https://github.com/codex-team/editor.js/blob/v2.31.7/types/tools/inline-tool.d.ts),
[tunes](https://github.com/codex-team/editor.js/blob/v2.31.7/types/block-tunes/block-tune.d.ts),
[menu config](https://github.com/codex-team/editor.js/blob/v2.31.7/types/tools/menu-config.d.ts),
[BlockAPI](https://github.com/codex-team/editor.js/blob/v2.31.7/types/api/block.d.ts),
[block runtime](https://github.com/codex-team/editor.js/blob/v2.31.7/src/components/block/index.ts),
[saver](https://github.com/codex-team/editor.js/blob/v2.31.7/src/components/modules/saver.ts),
[inline toolbar](https://github.com/codex-team/editor.js/blob/v2.31.7/src/components/modules/toolbar/inline.ts),
[tool lifecycle](https://github.com/codex-team/editor.js/blob/v2.31.7/src/components/tools/base.ts)
and [tool preparation](https://github.com/codex-team/editor.js/blob/v2.31.7/src/components/modules/tools.ts).

Callout supports block settings and ordinary text editing; custom paste
substitutions, conversion, merge, shortcuts and asynchronous rendering are outside
its reference contract. Marker supports a non-collapsed selection within one
editable callout, including apply/remove and active-state checks; cross-block,
overlapping arbitrary nested selections and custom popup actions are excluded.
Flag supports per-block state and wrapper display; static preparation, external
resources and programmatic mutation in readonly mode are excluded. Code's
upstream paste/Tab behavior is recorded below; broad paste/conversion parity is
not a prerequisite or an implied support claim.

## Validation, types and owner semantics

1. Preserve constructor/config/toolbox-data types through direct registrations
   and literal registry tuples. Dynamic name arrays remain broader unions.
   `OutputBlockDataFor` describes already validated data; neither it nor a cast
   proves a runtime schema. Select all named inline/tune dependencies explicitly.
2. Names are host configuration and saved identity. A callout registered under
   another name saves that name; its validator map must use the same key. No name
   rewriting, persistence migration or application envelope is introduced.
3. Registry checks validate descriptor structure and references only. They do
   not instantiate classes, inspect static capability hooks or validate opaque
   config, HTML, saved data or browser behavior. Tool authors/hosts own those
   checks; preserve core's existing diagnostics and replacement semantics.
4. The callout validator accepts unknown data, checks its string and tone fields,
   and reports field-relative errors through `ToolDataValidator`. Config has its
   own explicit validation. Malformed incoming state is rejected before editor
   creation; absent new-block data receives documented defaults. Test false
   upstream validation/omission separately so submission cannot silently treat
   missing blocks as validated content.
5. `validateOutputData` passes only each block's data to its tool callback.
   Validate `blocks[*].tunes.flag` separately in a neutral host-owned document
   boundary, preserving useful paths; do not claim the existing callback checks
   tune payloads. Choose explicit unknown-tool/tune handling for the example.
   No core validator extension is needed merely for this one schema.
6. Callout text allows a small documented formatting subset (bold and the marker
   element); use safe text handling for labels/tone, sanitize permitted rich text
   before insertion, and test hostile markup plus allowed-format round trips.
   Core validation does not become a sanitizer or certify an adopting renderer.
7. Config objects/services retain identity; frozen registry containers do not
   deep-freeze them. Build separate definitions for mutable per-editor/request
   state. Never put credentials, stateful tool instances or saved documents into
   module-level caches or SSR transfer state.
8. Lazy loaders return the constructor, not a namespace or instance. Core owns
   resolver-attempt semantics; the host checks lifetime before creating Editor.js
   and separately destroys the editor. Disposal cannot unload code or reverse
   module side effects. Angular initialization failure requires a fresh component
   (and corrected environment for a failed DI factory), not implicit retry.
9. Angular uses the same tools and validators. Preserve explicit `config.tools`
   full-map precedence, initialization-only config and provider-owner teardown.
   Optional Forms uses the existing native control path. Dirty/touched/reset,
   validation pending, editor errors, upload activity and submitting retain
   separate owners and meanings.

## Third-party selection and archive evidence

Select **`@editorjs/code@2.9.4`** for #645. It is outside the five #71 adapters,
has a small observable saved-data shape and exercises a real package default
export plus injected styles without a new backend or account. It is an external
package relative to Community, maintained by the Editor.js ecosystem itself;
this selection does not imply testing every independent vendor's tool.

The [npm version metadata](https://registry.npmjs.org/@editorjs%2fcode/2.9.4)
and its actual tarball were retrieved on 30 October 2026 without installation
scripts or workspace dependency changes. Registry integrity matched the downloaded
bytes. The eight archive entries include directory entries, package metadata,
README, MIT LICENSE, ESM/UMD distributions and declarations.

| Property       | Observed archive/metadata                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version/date   | 2.9.4; published 19 December 2025; selected exact version, not a floating latest recipe                                                                                                                                                                                   |
| License        | MIT, with LICENSE in archive; upstream documentation/source remain attributed                                                                                                                                                                                             |
| Public exports | Import `./dist/code.mjs`, require `./dist/code.umd.js`, types `./dist/index.d.ts`; default class export                                                                                                                                                                   |
| Dependencies   | Declares `@codexteam/icons: ^0.3.2`; no declared peers or engines. Installed Editor.js is still required by the consumer/declarations. Absence of peers is not proof of compatibility.                                                                                    |
| Config/data    | Placeholder config; string code data. Supply placeholder explicitly to match the declaration. Runtime defaults do not establish a wider public schema.                                                                                                                    |
| Readonly       | Declares support; renders a disabled textarea when readonly. Real host toggling and disabled behavior remain #645/#647 runtime gates.                                                                                                                                     |
| Styles/assets  | ESM injects a style element at module evaluation when a document exists. No separate CSS file, external font or asset fetch appears in that distribution. Lazy activation must include style delivery; no strict-CSP or alternate-document claim.                         |
| Limits         | No instance destroy method in the archive; keydown listener is attached to the owned textarea. Tab handling changes its value; change notification must be checked. Paste handles preformatted HTML. Saved code can contain markup and must be displayed as literal text. |
| SHA-256        | `eb421d04f48628f6776d1243b76a92689dbfdc629ddcee9ba086b3ca2a31a334`                                                                                                                                                                                                        |
| npm integrity  | `sha512-c0zyWodNqjL/0WI67sZvACIOFU9IAHG0UeeIpjss8pZGGNBum+UWkh7nKULK0SYvaOrdPdlWWqjuFU1TFA5jUA==`                                                                                                                                                                         |

Static inspection establishes an available, bounded candidate, **not** executed
compatibility. #645 must install its transitive dependency graph with a recorded
lock, compile the actual public recipe and test editing/save/reload, styles,
readonly and cleanup. Preserve the exact package export shape; test TypeScript
Bundler import/dynamic-import resolution without blanket constructor casts.
Record NodeNext interoperability separately rather than promising that a
CommonJS-declared package's dynamic default is constructable in every mode.

The neutral validators/core remain NodeNext and Bundler consumers independently.
The Code browser recipe targets Bundler initially; Node execution of the tool,
UMD/CDN consumption, CSP nonce adaptation, cross-document styles and paste/Tab
parity beyond the tested interactions are outside its initial claim. If the
selected runtime/type path fails, #645 must report the precise blocker and amend
this decision before changing the version or adding an adapter. Do not silently
substitute another package, widen core or hide failures with casts/timeouts.

## Required compatibility and evidence

Preserve the existing matrix; these are required future checks for the new
examples, not newly passing results from #642.

| Consumer                | Exact cell and required boundary                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Neutral core/validators | Node 22.12.0 minimum gate; TypeScript 6.0.3, ES2022-only, no ambient DOM/Node/Angular, NodeNext and Bundler declarations |
| Neutral browser         | Editor.js 2.31.7 and Code 2.9.4, real bundled browser host; Angular, Forms and Nest absent from the isolated install     |
| Angular minimum         | Angular 22.0.0 / Node 22.22.3 / TypeScript 6.0.3 / Editor.js 2.31.7                                                      |
| Angular reference       | Angular 22.1.4 / Node 24.15.0 / TypeScript 6.0.3 / Editor.js 2.31.7                                                      |
| Angular current fixture | Angular 22.2.2 / Node 26.0.0 / TypeScript 6.0.3 / Editor.js 2.31.7; “current” names the fixture, not future releases     |
| Browser engine          | Existing Playwright 1.64.0 / Chromium 156.0.8078.4 (revision 1248); broader browser certification is not implied         |

For each Angular cell, require standalone Forms-absent installation, optional
native Forms compilation/runtime, CSR and the established SSR/hydration profiles.
Keep the existing neutral browser checks in each CSR packed cell where already
scheduled; do not manufacture extra duplicate projects. The exact external tool
is shared by these consumers. Preserve existing #71/#72 regressions and the
bounded Nest reference, without adding Nest to generic custom-tool consumption.

| Slice | Incremental evidence and completion gate                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #643  | Archived complete block/validator examples; neutral typing and malformed-data cases; actual editing, settings notification, save/reload, readonly and cleanup.                                    |
| #644  | Inline apply/remove/state and allowed-markup reload; tune save/reload/change signal, isolated state, readonly/keyboard behavior; host tune validation.                                            |
| #645  | Clean external-package install, export/types and production styles; real Code editing/save/reload, disabled/readonly, notification and documented limits.                                         |
| #646  | Same implementations/config in direct/provider Angular and optional Forms; public input/output, DI ownership, recovery, validation/reset/submission and Forms-absent proof.                       |
| #647  | Exact matrix, SSR request/import safety, hydration, no stale activation, public-route/unselected-tool delivery checks, meaningful atom results, cache invalidation and hosted remote restoration. |
| #648  | Complete consumer-path review, actual archive contents/hashes, independent release history, final limitations and configured green CI on the eventual release commit.                             |

## Nx ownership and validation plan

Resolved `nx show project --json` configurations were inspected for
`editorjs-core`, `editorjs-angular` and `editorjs-angular-e2e`; the latter currently
has 105 targets. Package build/test/lint/typecheck work is cacheable. The existing
six packed prepare targets are uncached and own isolated compatibility snapshots;
distributed file/build atoms own separate result directories. Keep uncached
collection/completeness and strict remote-output restoration.

Before adding the public guide or copying new example sources, extend the exact
`sourceFingerprint` inventory in `packed-artifacts.mjs` and any relevant task
inputs. That inventory explicitly names files: a new core guide is not
automatically covered merely because other core sources are hashed. Include
external package versions/lock/archive identities in snapshots, preserve runtime,
environment and run-ID inputs, and ensure tasks restore everything consumers need.
Keep fresh registry resolution outside cached/DTE work.

Prefer extending the existing portable/registry, CSR registry and hydration
registry cases, splitting only material independent work. Maintain deterministic
result completeness, failure propagation and port/path isolation. #647 records
cold/warm durations, critical-path effects, remote hits and restored-file equality;
any exclusion needs an owner and revisit condition. Do not copy the prior
89-task count or three-worker measurement as proof of the future graph.

Run emitting checks before the final build/pack; never let concurrent writers
produce ambiguous release artifacts. This documentation slice changes no target,
cache input, generated artifact or DTE topology. Format/link/whitespace review and
configured CI are its checks; no new runtime suite is represented as executed.

## Release intent and remaining boundaries

Fresh npm reads for core and Angular returned 404. Remote `editorjs` tag refs
were empty; all 102 GitHub Releases contained no Editor.js distribution. Both
packages remain independently unreleased at 0.0.1, so this design uses
`init(editorjs-core,editorjs-angular)` without changing versions. Repeat actual
history checks in subsequent slices; manifest versions alone are not evidence.

The remaining gates are the implementations and runtime/type/archive evidence
assigned above, especially external Code notification/styles, complete marker
behavior, readonly composition and tune validation. There is no missing-access
blocker or accepted-ADR exception at this design stage. Package selection is not
an assertion that those gates have passed.

Preserve #71's independent caption, authored alt, deliberate decorative empty alt
and missing alt, plus #72's Blob/File, upload-method, host metadata/error,
operation-owner and submission policies. Custom tools do not generate alt or
complete a production blog. Persistence/migrations remain #74; broader demos and
testing remain #75/#78; publication remains #76. No public renderer, storage
schema, consumer migration, framework upgrade, release or automatic merge is
authorized here.
