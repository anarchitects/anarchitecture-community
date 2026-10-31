# Editor.js HTML rendering: adoption research

Research for [#681](https://github.com/anarchitects/anarchitecture-community/issues/681),
the design gate of [#650](https://github.com/anarchitects/anarchitecture-community/issues/650).
Baseline: Community `1e888cacdc287a7eaf94908d1498a7cd4dfee5e3`.
Registry and upstream inspection: 31 October 2026. The recommendation was
accepted by Johan Vrolix on 31 October 2026 in ADR0008. It is an architecture
decision, not a shipped renderer or completed compatibility certification.

## Recommendation

Build a narrow saved-block-to-HTML renderer behind our own typed API, using core
structural validation and a maintained HTML sanitizer. Do not adopt an existing
renderer as the engine or write an HTML parser/sanitizer ourselves. Select
`sanitize-html@2.18.1` behind a private policy adapter, as accepted in
[ADR0008](adr/0008-editorjs-html-rendering.md).

The strongest candidate, `editorjs-parser@3.2.1`, has working neutral declarations,
dual module exports and current maintenance evidence. However, matching our image
alt, list metadata, strict diagnostics, tune and isolation contracts would replace
substantial behavior around its dispatch/formatting. `editorjs-html@4.0.5` is
smaller but additionally emits Code content as active HTML and its declarations
require an undeclared Editor.js dependency. Sanitizing either engine's output
does not recover lost alt or list semantics. This is a contract-fit decision,
not a claim that either upstream promises our security or publishing model.

## Evidence and reproducibility

The [research directory](../tools/research/editorjs-html/README.md) contains the
executable probe, 21 saved-data fixtures, exact disposable-consumer manifest and
lock, registry metadata, raw results and advisory snapshot. No candidate or
sanitizer was added to the workspace's production dependencies. No third-party
implementation was copied into a Community package.

The final probe ran on macOS arm64, Node **24.22.2**, TypeScript **6.0.3**,
esbuild **0.28.2**, Playwright **1.64.0**, Chromium **156.0.8078.4**. Package
imports use the public published entries in an independently installed consumer.
Declarations are checked with `strict`, `skipLibCheck: false`, ES2022-only libs,
no ambient types, both NodeNext and Bundler resolution. Node ESM and CJS imports
and rendering are exercised in separate processes, with both absent browser
globals and a stronger diagnostic getter trap. Browser bundles use public entries.

For each fixture, the probe retains raw output/error, actual parsed DOM,
execution marker, image/link/list attributes, repeat-call determinism and mutation
observations. All browser requests are aborted; malicious examples only set a
local marker. A 50 ms observation window demonstrates observed execution, **not**
the absence of all possible delayed execution. This is a bounded comparison,
not a complete security audit, performance benchmark or Angular SSR test.

The fixture validation probe separately bundles **public neutral** core/tool
entries under the existing repository source condition. Its recorded input graph
has no browser tool entry. It reuses `validateOutputData`, `validateParagraphData`,
`validateHeaderData`, `validateQuoteData`, `validateListData` and `validateImageData`.
That proves agreement with current source contracts, not packed distribution
compatibility. The renderer candidates use published packages, not source aliases.

## Candidate inventory

The bounded search covered the requested two engines, a third small generic
renderer, and one viewer screened at metadata level. Framework-bound React/Vue
components are not substitutes for the neutral engine. The
[upstream ecosystem list](https://github.com/editor-js/awesome-editorjs) and npm
search informed selection; this is not an exhaustive market survey.

| Candidate                                                                    | Exact release / npm publication UTC | License / runtime dependencies and peers    | Packaging and observed portability                                                                                                                                                                                            |
| ---------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [editorjs-parser](https://github.com/miadabdi/editorjs-parser)               | 3.2.1 / 2026-09-10                  | MIT; none; Node >=18                        | Explicit import/require/types exports; ESM/CJS, both declaration modes and all fixture Node/browser parity pass. No import CSS.                                                                                               |
| [editorjs-html](https://github.com/pavittarx/editorjs-html)                  | 4.0.5 / 2025-01-19                  | MIT; no declared runtime dependencies/peers | CJS main, no export map; Node 24 ESM interop and CJS work; fixture parity passes. Both declaration modes fail TS2307 for undeclared `@editorjs/editorjs`. No import CSS.                                                      |
| [editorjs-to-html](https://github.com/vorjyga/editorjs-to-html)              | 1.0.4 / 2023-04-10                  | MIT; none declared                          | ESM-syntax main without package module type; Node 24 ESM/CJS paragraph works, but quote rendering fails `document is not defined`. Advertised `build/index.d.ts` is absent: TS7016. Browser import inserts 14 style elements. |
| [editorjs-html-viewer](https://github.com/yazanqwaider/editorjs-html-viewer) | 1.5.7 / 2023-09-09                  | MIT; runtime `typescript ^4.8.4`            | Metadata screening only; `dist/index.js`. Not executed or included in the reproduction install. No claim of tested SSR, types or safety.                                                                                      |

Fresh GitHub metadata showed all four repositories unarchived; last push dates
were respectively 2026-09-10, 2026-01-20, 2024-01-27 and 2023-09-09. These are
activity indicators, not promises of responsiveness or a basis for labeling an
older project abandoned. Published npm archives, integrity strings and `gitHead`
values in [metadata.json](../tools/research/editorjs-html/metadata.json) identify
the tested releases; mutable repository HEAD is not used as their implementation.
The `editorjs-html` manifest lacks a repository field; its linked upstream is
recorded separately rather than inventing manifest metadata.

All three installed renderers include MIT LICENSE files; hashes are retained in
results. `editorjs-parser`'s notice credits Michael Jones (2020), so a future fork
or copied implementation must preserve the actual notice, not substitute a
repository owner's name. This spike vendors no such code. Distribution of any
future dependencies must include applicable notices in the package/archive review.

## Saved-data and output matrix

Source contracts are the public entries in
[core](../packages/editorjs/core/src/index.ts),
[paragraph](../packages/editorjs/tool-paragraph/src/index.ts),
[header](../packages/editorjs/tool-header/src/index.ts),
[quote](../packages/editorjs/tool-quote/src/index.ts),
[list](../packages/editorjs/tool-list/src/index.ts) and
[image](../packages/editorjs/tool-image/src/index.ts), together with the
[#73 custom-tool design](editorjs-custom-tools-design.md) and
[#74 persistence design](editorjs-persistence-design.md).

| Fixture / contract                                 | Required semantics                                                                             | Observed candidate behavior                                                                                                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paragraph / header / quote                         | Inline formatting, level 1–6; caption separate from quote; left/center presentation            | Main two preserve ordinary inline formatting. Invalid level 99 becomes h6 in parser, h99 in html/to-html. To-html quote requires a DOM.                                                                                   |
| List 2.0.9 nested ordered                          | Recursive items `{content, meta, items}`; root/nested `start` and `counterType`                | Main two retain nesting but discard start/counter metadata. Renderer must translate numeric/roman/alpha semantics explicitly.                                                                                             |
| List v2 checklist                                  | Item `meta.checked`, nested structure; accessible read-only state                              | Parser emits CSS-dependent divs; html treats checklist as an ordered list and loses checked state.                                                                                                                        |
| Legacy flat strings                                | Outside the current local list validator; host migration/profile choice                        | Core/tool contract rejects missing v2 metadata. A candidate accepting it is not proof of current contract support; to-html even emits a `HELLO` prefix.                                                                   |
| Image authored / decorative / unset                | Top-level `alt` string / empty string / absent; independent caption                            | Parser and html replace all three with caption text. To-html reads `file.alt`, producing empty alt for all three fixtures.                                                                                                |
| Configured `heading` alias                         | Saved key is chosen by the host, not necessarily `header`                                      | Source validator explicitly maps alias to header and passes. Unregistered candidate alias is dropped, rejected or replaced with a placeholder. No automatic alias discovery is assumed.                                   |
| Callout / Marker / FlagTune                        | Callout `{text,tone}`; inline `<mark>` inside text; tune keyed by configured name, `{flagged}` | Unregistered Callout is unsupported. Custom callback text reaches output; flag and unknown tune data are not validated by the candidates. Marker is inline markup, not a separate block type.                             |
| Literal Code                                       | `{code:string}` escaped as text in semantic pre/code                                           | Parser escapes the fixture; html executes its image handler. To-html uses a disabled textarea, not pre/code.                                                                                                              |
| Unknown, null data, prototype name, mixed document | Explicit errors, no publishable partial result, own-key lookup                                 | Parser drops unknown/null, including the middle of a mixed document. Html strict mode rejects ordinary unknowns but both main engines render inherited `toString` as `[object Object]`. To-html inserts placeholder text. |
| Unsafe inline / image attribute / custom output    | Same safety boundary on every path                                                             | **All three execute the local marker** for each of these three fixtures in Chromium.                                                                                                                                      |

The exact outputs and errors, including differences not summarized above, are
retained in [results.json](../tools/research/editorjs-html/results.json).
Successful repeated calls were deterministic and did not mutate fixture data in
the observed cases. That is weaker than configuration isolation: mutating one
`editorjs-parser` instance's paragraph class changed a second instance's output.
The separate instance probe records this shared nested-configuration behavior.

The `editorjs-html` probe enables its strict option; default strictness is not
assumed. Candidate callback adapters intentionally return the same hostile text
without a caller-provided sanitizer. They test the engine's boundary, not the
safety of every possible integration. `editorjs-parser` callbacks receive data
and configuration; html callbacks receive the block. Neither substitutes for a
typed saved-name/tune registry with validated, detached inputs and immutable policy.

Current neutral validators intentionally accept the unsafe inline/image fixtures
and missing alt: saved-data shape validity is **not** HTML safety or publishability.
Custom Callout and Code have no validator registered in this bounded core probe,
so its `unknown_tool` results do not assert invalid custom data. Unknown tunes
also need a separate rendering policy; core does not validate them here.

## Sanitizer evaluation and cost

| Candidate                                                       | Exact release / license                               | Dependency and runtime implications                                                                                                                                                                     | Bounded result                                                                                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [sanitize-html](https://github.com/apostrophecms/sanitize-html) | 2.18.1 / MIT / published 2026-10-14                   | CJS; manifest Node >=22.12.0. Direct dependencies: escape-string-regexp, htmlparser2, is-plain-object, launder, parse-srcset, postcss. Browser bundling is supported upstream; no DOM adapter required. | Explicit p/b/a/img policy strips the handler and encoded javascript href identically in Node/browser. Minified probe bundle **157,142 bytes**.                           |
| [DOMPurify](https://github.com/cure53/DOMPurify)                | 3.4.17 / MPL-2.0 OR Apache-2.0 / published 2026-10-12 | Dual exports/types; optional `@types/trusted-types`. Bare Node import has no usable sanitize method; server operation requires an additional DOM implementation.                                        | Browser default policy removes active content from the same fragment. Minified browser probe **31,165 bytes**; server DOM dependency and performance were not evaluated. |

Policies in this comparison are deliberately **not equivalent**; one fragment
cannot rank security comprehensively. The proposal favors one DOM-independent
Node/browser implementation over adding a server DOM adapter, while accepting a
material browser bundle cost. No lightweight-bundle claim is made. Measure full
production route cost in #687, and revisit this choice if it exceeds the agreed
consumer budget. Do not replace it with hand-written regex sanitization or
unsupported dependency subpath imports to reduce size.

The exact transitive tree, integrity and declared license for all 21 installed
packages are retained in `consumer-lock.json`: MIT, BSD-2-Clause, BSD-3-Clause,
ISC and DOMPurify's dual license. The three tested renderers add no dependencies;
sanitizer dependencies account for the remaining tree. `npm ci --ignore-scripts`
reproduced this lock. The retained `npm audit` snapshot reports zero known
advisories for that tree on the inspection date; it is neither an audit of these
renderers' output contracts nor evidence against the observed execution cases.

## Build, adopt or contribute

| Option                                            | Benefit                                                                                                      | Cost / disposition                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adopt parser behind our adapter                   | Current activity, good declarations/module exports, useful basic formatting                                  | Replace image/list/strict dispatch/tune policy, isolate mutable config, sanitize all output. Little justified engine value remains for our deliberately small profile. Not recommended. |
| Adopt html behind our adapter                     | Very small renderer and block callbacks                                                                      | Fix declaration closure, Code safety, list/alt contracts, prototype dispatch and diagnostics in addition to the common boundary. Not recommended.                                       |
| Adopt a viewer                                    | Existing editor-like styles                                                                                  | DOM/CSS ownership and broader runtime concerns conflict with a neutral semantic package. Screened or measured limitations above. Not recommended.                                       |
| Contribute upstream first                         | Could improve reusable defects such as declaration closure or isolation                                      | Maintainer acceptance/timing and different compatibility goals cannot gate this release. A later narrowly scoped upstream report/PR is possible only when instructed; none sent.        |
| Narrow Community formatter + maintained sanitizer | Own exact saved profiles, strict results and extension lifetime; reuse established HTML parsing/sanitization | Own mapping/diagnostic correctness and dependency maintenance; measure sanitizer cost. Selected in the accepted ADR.                                                                    |

## Architecture review and limitations

Before generating the executable spike, all eight existing Community ADRs and
all eighteen Meta ADR documents were enumerated and read, including proposals
and historical material. The adjacent clean Meta checkout matches freshly
verified remote tree `823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. ADR0008
was proposed after that preflight and subsequently accepted by Johan Vrolix on
31 October 2026; it adds a decision to the reviewed baseline. Modern
Angular index, repository application, architecture, rendering, reactivity,
providers, SSR/builds, testing/migration and validation guidance informed the seams.

Accepted Community0002/0003 and Meta layering decisions keep framework concerns
out of neutral contracts. Community0004 requires complete owning-package docs
with each future API. Community0007/Meta0013 require independent release intent
and real Nx scopes; this research adds no project, version or release change.
Accepted Angular guidance requires supported bindings, signal-first adapters,
host-owned providers and actual SSR proof. Meta0012 does not turn an illustrative
TypeScript result into a new shared application wire schema. HTTP decisions and
Community0005/0006 remain unchanged. Proposed governance/Archi records do not
override accepted policy. No accepted-ADR conflict is identified.

Meta0015 applies to future package tasks. This one-off external-state research
is uncached and claims no Nx Cloud, DTE or CI result. The preferred `nx exec`
wrapper first exposed dependency-project working directories; adding the
documented `--excludeTaskDependencies` addressed that. The sandbox prevented
Chromium startup; the escalated Nx wrapper subsequently stalled before launching
the probe. It was stopped, and the bounded probe ran directly with local browser
permission. No Nx configuration was changed to accommodate the experiment.
No CI monitoring, hosted rerun, publication or upstream contribution was started.

Johan Vrolix accepted ADR0008's policy, package seams, dependency/bundle tradeoff
and target proof matrix on 31 October 2026 and requested PR #689 be made ready
for review. #681's design-approval gate is resolved. #682 still requires the
predecessor to merge and an explicit instruction to start. #682–#688 implement
and prove the chosen design, then #75 validates the integrated family, #76 owns
publication and #651 follows release.
