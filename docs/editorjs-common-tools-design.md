# Common Editor.js tool package contract

This is the contributor design for [#609](https://github.com/anarchitects/anarchitecture-community/issues/609),
the first slice of epic #71. It specifies the work in #610–#616; the package names
and exports below are **planned**, not currently available APIs. Review/merge of
this contract does not certify the future packages, start the next slice or
authorize publication. Existing core and Angular contracts remain unchanged.

## Architecture review and authority

Reviewed on 27 October 2026 against Community `1d33cb9` and Meta
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. All eight local ADRs and all eighteen
Meta records were enumerated and read in full, including proposed and historical
content. The only local ADR directory found was `docs/adr`. The complete filename
inventory and status mapping in the [registry design](editorjs-tool-registry-design.md#architecture-review-and-authority)
is unchanged at these revisions.

The Modern Angular guide index, repository application, architecture, providers/
routing, reactivity, Forms, rendering, SSR/builds, testing/migration, validation
and API ledger were reviewed. Nx workspace guidance, resolved e2e targets and Nx
MCP caching/output guidance informed the validation design.

| Decisions                                                | Application                                                                                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local 0001–0003; proposed Meta governance records        | Preserve their Governance scope. They do not introduce a Governance model or dependency into these tools. Proposals do not override accepted records. |
| Local 0004                                               | Every tool/API slice includes a complete consumer README and checks its actual archive. Design history and fixture instructions stay here.            |
| Local Modern Angular; Meta Modern Angular                | Neutral packages, public exports, explicit browser/provider ownership, native optional Forms, request-safe SSR, bounded versions and packed evidence. |
| Local 0005–0006; Meta HTTP/Nest/auth/contracts decisions | No Nest integration, transport model, mandatory Zod dependency, HTTP adapter or supported-default change.                                             |
| Local 0007 / Meta0013                                    | Actual per-package release history determines commit/version intent; exact Nx scopes and independent releases.                                        |
| Meta0014 / Meta0015                                      | Reviewed dependency updates and manual merging; accurate task graph, safe caching, restoration, distribution and fresh external-state checks.         |
| Other accepted Meta landscape records                    | Community owns package implementation; preserve repository roles and both implementation styles.                                                      |

There is no accepted-decision conflict or requested exception. Upstream limitations
below constrain implementation claims; they do not relax the ADRs. Repeat this
preflight before each implementation slice and when scope changes.

## Baseline and chosen approach

Reuse core `ToolDefinition`, `ToolRegistration`, `ToolConfiguration`, `ToolOptions`,
`ToolDataValidator`, `validateOutputData`, upload ports and registry/resolver APIs.
The [completed registry contract](editorjs-tool-registry-design.md) owns naming,
selection, conflicts, replacement, attempt retry and disposal. Angular already
provides `provideEditorJsTools`, full-map `config.tools` precedence and the editor
lifecycle; `/forms` already adapts native Signal Forms.

Build narrow typed integrations around the five reviewed upstream packages.
Do not fork their editors, copy their rendering implementations, introduce a
second registry, or add a common-tools runtime aggregate. The package value is
typed, validated composition and saved-data contracts over those implementations.
Image needs a small browser adapter for the existing core upload result contract;
the other browser exports initially expose the upstream constructors unchanged.

| Planned npm package                     | Planned Nx name           | Location                           | Upstream candidate           | Slice |
| --------------------------------------- | ------------------------- | ---------------------------------- | ---------------------------- | ----- |
| `@anarchitects/editorjs-tool-paragraph` | `editorjs-tool-paragraph` | `packages/editorjs/tool-paragraph` | `@editorjs/paragraph` 2.11.7 | #610  |
| `@anarchitects/editorjs-tool-header`    | `editorjs-tool-header`    | `packages/editorjs/tool-header`    | `@editorjs/header` 2.8.9     | #611  |
| `@anarchitects/editorjs-tool-list`      | `editorjs-tool-list`      | `packages/editorjs/tool-list`      | `@editorjs/list` 2.0.9       | #612  |
| `@anarchitects/editorjs-tool-quote`     | `editorjs-tool-quote`     | `packages/editorjs/tool-quote`     | `@editorjs/quote` 2.7.6      | #613  |
| `@anarchitects/editorjs-tool-image`     | `editorjs-tool-image`     | `packages/editorjs/tool-image`     | `@editorjs/image` 2.10.3     | #614  |

These names do not yet exist in the Nx graph. Use the repository's generator and
package-manager linking workflows when implementing them, then verify resolved
names/targets. Do not add an empty project simply to obtain a commit scope.

## Package and dependency boundaries

Each package has three supported exports: `.`, `./browser` and `./package.json`.
Start with ESM, explicit declaration exports and `type: module`; no CJS, UMD or
CDN distribution promise. Keep builds independent and externalize core, Editor.js
and the upstream tool rather than vendoring their implementations.

- **Root:** own configuration/data types, a definition helper and a structural
  validator. Runtime imports may use core; neither runtime nor declaration imports
  may lead to upstream tools, Editor.js, DOM, Node or Angular declarations. Compile
  this surface with ES2022-only libraries in both NodeNext and Bundler modes.
- **Browser:** the named constructor, and image's browser-specific uploader
  specialization. DOM and Editor.js declarations are intentional here. Initial
  support is a browser bundler with TypeScript Bundler resolution; do not claim
  NodeNext browser declaration compatibility from the root's passing checks.
- **Dependencies:** core follows the existing package-family dependency policy
  (initially `^0.0.1`, coordinated with the actual release artifacts). Each tool
  package owns its corresponding upstream implementation as an **exact-version
  normal dependency**, using the candidate in the table after its slice's gates
  pass. Editor.js is an application-owned peer, initially exactly `2.31.7` for
  these new tool packages. No Angular/Forms peer, dependency or sibling-tool
  dependency is added.

Exact upstream dependencies make the shipped constructor, CSS and saved-data
generation reviewable. A host-supplied loader remains possible, but using another
implementation/version is host compatibility work, not automatic certification.
Future peer/version widening requires new evidence. This narrower initial tool
peer does not change core/Angular's existing manifests or advertised ranges.

Installing a tool package can install browser-oriented dependencies even when a
server uses only its root validator. In particular, header's upstream package
itself depends on Editor.js. **Root import/declaration purity is not a promise
that Editor.js is absent from that installation.** Core retains its separate,
stronger no-Editor.js/no-DOM/no-Angular contract.

All five upstream ESM bundles inject global CSS during evaluation. The image
bundle additionally accesses `window` at module evaluation. Mark the emitted
browser entry as side-effectful, matching its actual output filename; only the
pure root is eligible for a side-effect-free claim. Do not ship a blanket
`sideEffects: false` that lets consumers discard required styling. No separate
upstream stylesheet is present in the inspected archives. Styles/module code may
remain after editor disposal. Strict CSP, shadow roots and alternate documents
need separate evidence and are not initially certified.

## Root API and configuration rules

Use the following uniform names; all return/accept existing core contracts:

| Tool      | Root runtime exports                           | Root types                                                                                 | Browser constructor |
| --------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------- |
| Paragraph | `defineParagraphTool`, `validateParagraphData` | `ParagraphConfig`, `ParagraphData`, `ParagraphToolOptions`                                 | `ParagraphTool`     |
| Header    | `defineHeaderTool`, `validateHeaderData`       | `HeaderConfig`, `HeaderData`, `HeadingLevel`, `HeaderToolOptions`                          | `HeaderTool`        |
| List      | `defineListTool`, `validateListData`           | `ListConfig`, `ListData`, `ListItem`, `ListStyle`, `ListCounterType`, `ListToolOptions`    | `ListTool`          |
| Quote     | `defineQuoteTool`, `validateQuoteData`         | `QuoteConfig`, `QuoteData`, `QuoteAlignment`, `QuoteToolOptions`                           | `QuoteTool`         |
| Image     | `defineImageTool`, `validateImageData`         | `ImageConfig<Input, FileData>`, `ImageData<FileData>`, `ImageFeatures`, `ImageToolOptions` | `ImageTool`         |

Definition options specialize core's eager/lazy discriminated union for each
tool's config and data, omitting `kind` (always `block`) and making `name` optional
with its canonical tool name as default. Preserve an explicitly supplied literal
name and inferred constructor/loader type in the returned `ToolDefinition`.
Do not erase them to a generic string/map or invent an incompatible registration
shape. The implementation must prove inference with public declaration tests.

An eager definition supplies `registration` (a class or configured registration);
a lazy definition supplies `load` and optional `settings`, exactly as core does.
The caller supplies the loader: for the packaged tool it dynamically imports the
owning `/browser` entry and returns the named constructor. The root helper has
**no default upstream import and no declaration reference to `/browser`**.
Image requires a configured uploader in either form and does not accept a bare
class registration through its helper.

Helpers create inert definitions; they do not construct tools, import browser
code, invoke loaders/uploaders, register providers or allocate mutable global
state. Core still checks names, duplicates, selection and references during
composition/resolution. Config errors belonging to the tool helper throw
`TypeError` synchronously before returning a definition; do not mislabel these as
core registry diagnostics. Angular contribution factories should capture services
synchronously, then create definitions with ordinary host-owned callbacks.

Configuration is validated, not silently repaired. Preserve the supplied config
object, callbacks, uploader/service objects and nested opaque identities; do not
JSON-clone or deep-freeze them. Copy definition/settings containers as core does.
Defaults in the next section describe upstream behavior when a setting is absent;
helpers do not materialize those defaults into a mutated config. Unknown config
keys outside the documented supported subset fail explicitly, without invoking
host callback bodies. Tool-specific config ownership does not change core's
opaque-config policy.

Replacement remains whole-definition replacement with explicit `replace: true`.
There is no deep merge, appended toolbar array, inherited partial config or
automatic selection of referenced inline tools/tunes. Treat config as immutable
for the registry/editor lifetime. Mutable per-editor/request state needs separate
host-owned configuration; a shared module constructor is not shared tool state.

## Supported configuration and saved data

| Tool      | Initial configuration subset and validation                                                                                                                                                                                                                                                                         | Saved-data validation                                                                                                                                                                                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paragraph | Optional string `placeholder`; boolean `preserveBlank` (upstream default false).                                                                                                                                                                                                                                    | Required string `text`; an empty string is structurally valid. Upstream's save-time blank-block omission is a separate policy.                                                                                                                                                                                                               |
| Header    | Optional string `placeholder`; levels are unique integers 1–6. If `levels` is supplied it is nonempty and requires an explicit `defaultLevel` included in that set. Without levels, an explicit default must still be 1–6; otherwise upstream defaults to 2.                                                        | Required string `text` and integer `level` 1–6. No parsing of numeric strings or fallback rewriting. Configuration-specific allowed levels are a separate host rule.                                                                                                                                                                         |
| List      | `defaultStyle`: ordered/unordered/checklist (upstream default unordered); `maxLevel`: positive integer when supplied (omitted is unbounded); `counterTypes`: nonempty unique list of numeric/upper-roman/lower-roman/upper-alpha/lower-alpha when supplied (omitted allows all).                                    | Current nested generation: root `style`, `meta` object and `items` array; every item has string `content`, `meta` object and recursive `items`. Checklist item metadata requires boolean `checked`; ordered metadata validates optional positive integer `start` and supported `counterType`. The checklist root does not require `checked`. |
| Quote     | Optional string `quotePlaceholder`, `captionPlaceholder`; `defaultAlignment`: left/center, default left.                                                                                                                                                                                                            | Required strings `text`, `caption` and alignment left/center. No HTML interpretation or rewriting.                                                                                                                                                                                                                                           |
| Image     | Required core uploader supporting both file and URL workflows; optional string `types`, `captionPlaceholder`, `buttonContent`; `features` border/background/stretch booleans and caption boolean or `optional`. No endpoints, headers, request-body options or custom action/tune callbacks in this initial subset. | Required `file.url` nonblank string, string `caption`, boolean `withBorder`, `withBackground`, `stretched`. Additional JSON file metadata is retained and remains host-owned. A temporary empty upload placeholder is not a valid saved image.                                                                                               |

The header rule avoids an observed upstream edge case: its fallback selects the
second available level, which does not exist for a one-level subset without an
explicit default. Upstream filters levels in numeric order; do not promise that
the configuration array reorders its UI. Quote's upstream declarations use a
non-exported alignment enum; our pure types use the documented string union and
need boundary compatibility checks, not a deep import of that private enum.

Each `validateXData` implements core `ToolDataValidator`, returning synchronous
`ToolValidationResult` with paths relative to the block's data. It neither casts
an entire document to a generic type nor registers itself globally. A host maps
the **configured tool name**, including aliases, to the validator passed into
`validateOutputData`. Registry selection alone does not install validators.

Validate unknown inputs defensively without mutation; accept additional JSON
data properties as extensions, checking the known fields above. Core's document
parser owns JSON/structure checks. Standalone validator calls must also fail
cleanly for malformed structures, cycles and invalid nested items rather than
overflow or throw incidental property-access errors. Validation does not promise
that an upstream editor preserves unknown fields in a save/render round trip;
image's file metadata has a separate positive preservation test.

Text/caption fields may contain inline HTML. Structural success is not XSS
sanitization, an accessibility certificate, a remote-resource check or permission
to render HTML. No common schema framework, public article renderer or persistence
envelope is introduced. Hosts still own rendering safety and data migration.

### List generation policy

Support the current 2.0.9 nested saved shape only. The validator rejects legacy
flat strings, old checklist `{text, checked}` items and records missing required
current metadata. It does not call upstream's normalization function. That
function accepts legacy shapes and fills metadata, so passing arbitrary old data
straight into the raw class is **not** our migration contract.

Before editing persisted content, hosts explicitly validate and migrate old data
outside the tool package. No converter is exported in this initial slice. Omitted
new-block data is upstream editor initialization, distinct from validating a saved
document. Rendering old data without that host gate can still trigger upstream
coercion; document this limitation rather than claiming the class rejects it.

### Paragraph and default-block policy

The helper's default name is `paragraph`, but it never adds `replace: true`.
With `EDITOR_JS_2_31_7_TOOL_PROFILE`, replacing the built-in therefore requires
the caller's explicit same-kind replacement. Alternatively choose a new name and
set the same name as the host's `defaultBlock` and resolver reference context.
Do not change the core profile or infer host defaults from a selected definition.
Omitting the package continues to use Editor.js's built-in paragraph.

The paragraph slice must prove delivery and construction of the packaged class
and a configured behavioral difference, alongside an untouched built-in control.
A passing empty-editor test alone cannot count as one of the five packaged tools.

## Image upload boundary and lifetime

The pure root uses `ImageConfig<Input, FileData>` over core
`ImageUploader<Input, FileData>`; it imports no `File`/`Blob` declaration. The
browser specialization uses **Blob**, which also accepts File instances: the
inspected upstream tool converts pasted `blob:` images into Blob values. A
File-only uploader must be deliberately adapted by its host (for example by
supplying a filename); silently asserting every input is File is incorrect.

Require both uploader methods. A host can explicitly reject an unavailable
capability; omission must not activate upstream endpoint fallback. The browser
adapter supplies an empty endpoints shell only to satisfy upstream construction
and always installs both custom methods. It owns no HTTP client, credentials,
URL-fetch service, retry loop, storage policy or Forms state.

The adapter invokes the original methods with their receiver preserved, observes
synchronous throws as rejected promises and awaits each result. Accept only
`success: 1` with a usable string URL and JSON-compatible file metadata. Preserve
successful file metadata; reject malformed results. Translate `success: 0` into
the upstream rejection path with an Error retaining the host cause when present;
do not fabricate a successful file or widen core's result union. This resolves
the mismatch between upstream's required-file declaration and core's failure
variant without publishing a second upload port.

Upstream handles its upload failures through its notifier. That is not an
`EditorJs` initialization error output and does not automatically mark a native
FormField pending/invalid. #72 owns shared retry/transport and optional Angular
upload-state composition. Ordinary image display and upstream local `blob:`
preview handling remain browser behavior, not a guarantee of zero network I/O.

Keep the bridge per tool/editor owner. It must not create module-global uploader
caches or retain one editor's state for another. The inspected upstream exposes
no destroy/cancel hook, keeps preview/read promises, and declares upload-result
handlers private. Do not patch private methods or claim a canceled upload on
editor destruction. #614 must characterize late completion and prove no revived
live editor, cross-owner state or unhandled work in the supported path; detached
upstream UI/preview work and already-started host mutations may still complete.
If that minimum cannot be established through public seams, #614 must bring a
bounded upstream fix/version/contract amendment back for review before claiming
support. Never hide it with a never-settling promise or disabled assertions.

## Consumer composition

These are workflows for the planned exports, not runnable examples of shipped
packages. Each implementation PR supplies complete, compiled README examples.

1. **Direct eager browser:** import the desired constructor from that package's
   `/browser`, supply it and typed config to `defineXTool`, compose with the core
   profile, select tools explicitly and call `createToolMap`. Pass the map to a
   live browser Editor.js owner. Static browser imports are intentionally eager.
2. **Direct lazy browser:** import only root helpers/config/data/validators into
   inert definitions. Each `load` dynamically imports its own `/browser` and
   returns the named constructor. Resolve the selected registry with a per-editor
   `createToolResolver`, then construct Editor.js after the holder exists. Use
   the existing [browser ownership recipe](../packages/editorjs/core/README.md#direct-browser-integration)
   and dispose on removal. Loader failures follow core's explicit retry rules.
3. **Angular standalone:** pass those same definitions to `provideEditorJsTools`
   at the application/route environment; omit `config.tools` on `EditorJs`.
   A contribution factory can capture injected services before forming loaders.
   Explicit `config.tools`, including `{}`, retains full-map precedence. Custom
   editor loaders receive resolved tools; no per-tool Angular provider is needed.
4. **Optional Forms:** use `EditorJsControl` from `/forms` and native `[formField]`
   over the same registry. Existing control ownership, value/reset/touch/dirty
   semantics remain authoritative. No per-tool form controls, CVAs or parallel
   form state are introduced.
5. **Saved content:** associate validators with configured names and call core
   `validateOutputData` before rendering persisted data or accepting it for
   persistence. Application policy remains separate from editor configuration.

SSR imports only pure roots and inert definitions; it neither resolves browser
loaders nor renders saved blocks. Hosts own hydration providers, request-local
state, lazy authoring routes and preloading policy. Provider visibility is not a
route-destruction guarantee. Changing config after initialization does not replace
tools; remount with a new owner. Disposal releases ownership, not downloaded code
or injected styles.

## Evidence, Nx tasks and delivery ownership

The [upstream review](editorjs-common-tools-upstream-review.md) records what was
actually inspected/probed for #609. It is not a five-tool browser certification.
Keep the existing Angular 22.0.0 / 22.1.4 / 22.2.2 cells paired with Node
22.22.3 / 24.15.0 / 26.0.0, Editor.js 2.31.7 and TypeScript 6.0.3. Keep core's
independent baseline. Initial tool-package engine targets follow core's
`>=22.12.0` only after their pure artifacts pass that minimum; Angular cells do
not by themselves prove it. Browser evidence starts with Chromium, not every
browser or all combinations allowed by a future range.

| Slice                    | Required evidence                                                                                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #610 paragraph           | Establish independent package build/pack/type/unit pattern, ES2022-only root declarations/import guards, explicit paragraph activation/control, real direct/Angular behavior and public examples.                                                          |
| #611 header              | Add level/default negatives, singleton-level case, real heading edits/selection/round trips and the same package/README gates.                                                                                                                             |
| #612 list                | Prove current recursive data, styles/metadata, legacy rejection, malformed/deep inputs, actual nesting and saved round trips; no implicit migration claim.                                                                                                 |
| #613 quote               | Prove pure alignment types versus upstream boundary, text/caption/alignment saves, readonly behavior and the same independent package gates.                                                                                                               |
| #614 image               | Prove Blob/File inputs, both uploader methods, result validation, failure/rejection, metadata preservation, pending removal/late completion and documented limitations using deterministic local assets.                                                   |
| #615 combined validation | Install each tarball independently and all five together; absent Angular in generic host, root Angular without Forms, optional native Forms, multiple owners, SSR/request isolation/hydration, network/evaluation/CSS controls and the full pinned matrix. |
| #616 readiness           | Compile actual packed README examples; verify README/license/exports/types/assets/dependency metadata, exact versions, release history and remaining limitations. Require configured CI green on the eventual release commit.                              |

Package slices retain their own tests and documentation; #615 is not a reason to
defer first-use browser evidence. Each package build/typecheck/lint/unit/pack
target needs accurate resolved inputs, dependency edges and restorable outputs.
Reuse supported Nx/Vite/TypeScript tooling; no bespoke second test orchestrator.

The current resolved e2e graph has 66 cacheable validation atoms and six uncached
preparations, plus uncached collection gates. Preserve its
[snapshot/atom contract](editorjs-angular-packed-dte.md). Add each tool's source,
manifest, README, build config, archive bytes and dependency locks to the relevant
preparation fingerprints and Nx inputs. Add real host/e2e project dependencies
so affected selection sees tool changes. Include CSS/assets and declarations in
restorable build outputs. Update every affected prepare/copy/pack/verify path,
not only the workspace host imports.

Fresh registry resolution stays uncached outside DTE. Consumers must restore
relative immutable snapshots into isolated roots with matching platform/native
dependencies; browser tasks retain isolated ports and reports. Extend or split
atoms only where measured workload warrants it; preserve failure propagation and
the completeness gate. Do not invent a new fixed atom count for future tools.

#610–#615 must verify representative miss/hit, clean output restoration and
invalidation for changed source/dependency/config inputs. #615 records remote
reuse/distributed equivalence separately, including prerequisites, missing/failed
outputs and cleanup. Document any blocked hosted proof with owner/revisit condition;
local parallel execution alone is not DTE evidence. Avoid a workspace-wide CI
redesign or disabling caching to conceal missing inputs.

## Release and remaining boundaries

On this review date, all five proposed Anarchitects npm names returned 404; no
`editorjs-tool-*` tag refs or matching entries in the 102 repository releases
were found. These proposed projects are not yet distributed. Recheck actual
history during each implementation/release slice. Once projects exist,
package-specific work uses non-bumping `init` with their exact Nx names; first
distribution follows the independent `0.0.1` policy. This cross-package design
uses an unscoped documentation commit, not a nonexistent project scope.

#609 changes contributor documentation only. No manifest, dependency, runtime API
or support range changes. #72 remains upload infrastructure, #73 broad custom-tool
guidance, #74 persistence, #75/#78 broader demos/testing and #76 publication.
Maintainer instruction and predecessor merge are required before starting #610.
