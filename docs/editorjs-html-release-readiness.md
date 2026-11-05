# Editor.js renderer technical readiness

Review for [#688](https://github.com/anarchitects/anarchitecture-community/issues/688),
4 November 2026. This record hands the renderer implementation to
[#674](https://github.com/anarchitects/anarchitecture-community/issues/674) and
[#75](https://github.com/anarchitects/anarchitecture-community/issues/75).
It is not publication approval or whole-family stability acceptance.

The reviewed implementation is PR [#697](https://github.com/anarchitects/anarchitecture-community/pull/697)
at `b172a04853e23474b6b671c40a17680e6b16855c`, merged as
`fbe7ee976a8985944c183e05646641ddf4569f2b`. Their complete file trees are identical.
This readiness change adds contributor evidence only; the package files, consumer
READMEs, compatibility contracts and CI configuration are unchanged.

## Architecture and review boundary

All nine Community and eighteen Meta ADRs were read during this session, including
proposed, historical and superseded material. Re-enumeration for this review found
no additional ADR location or nested AGENTS file. Community's ADRs are unchanged
from the reviewed implementation; Meta's clean checkout remains
`47e75544673037d25665c8c9305c809802b58261`.

Community inventory: 0001–0008 and the named Modern Angular 22 signal-forms ADR,
all accepted. Meta inventory: both 0001 records, 0002–0007, both 0008 records,
0009–0015 and ADR-0001 landscape. Cooperative governance, hierarchy, Archi and
layering remain proposals; 0014's historical observations do not override its
accepted current policy. Relevant engineering guidance includes the Modern Angular
index, repository application, architecture, reactivity, providers, rendering,
SSR/builds, testing/migration and validation guides, and Editor.js package and
custom-tool guidance.

- [Community0008](adr/0008-editorjs-html-rendering.md) accepts our own narrow
  formatter, core contracts and `sanitize-html@2.18.1`; neither `editorjs-parser`
  nor `editorjs-html` is an implementation dependency. Exact supported shapes,
  semantic fidelity, alt policy, common sanitization and neutral ownership remain
  binding. No new renderer policy or compatibility range is introduced.
- [Community0004](adr/0004-public-package-documentation.md) requires complete
  owning-package guidance and inspection of actual archives. Contributor evidence
  stays here; the reviewed consumer instructions already cover the required paths.
- Angular A01/A02/A03/A05/A06/A09/A10 require explicit standalone ownership,
  immutable configuration, signal contracts and actual scoped/SSR/hydration proof.
  The accepted renderer refinement permits ordinary provider arrays; hosts own
  hydration providers and CSS. Normal Angular binding remains the rendering seam.
- Community0007/Meta0013 require independent release history and version intent.
  Both distributions remain unreleased `0.0.1`. This repository-only documentation
  change uses `docs:`; a future unreleased package change uses its exact Nx
  `init(editorjs-html)` or `init(editorjs-html-angular)` scope.
- Meta0015 requires accurate resolved task inputs, prerequisites and outputs,
  uncached preparation/completeness, and separate local/remote/distributed proof.
  A green authoring DTE job is not renderer DTE evidence. No monitoring, hosted
  rerun or capacity experiment was performed.

No accepted-decision conflict was found. HTTP/Nest support, authoring packages,
application persistence and publication policy retain their existing ownership.

## Consumer journey and package inventory

The owning [headless README](../packages/editorjs/html/README.md) and
[Angular README](../packages/editorjs/html-angular/README.md) were reviewed from
installation through observable results, including their actual packed copies.

| Journey                          | Consumer contract and proof                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Install and render               | Headless installation/quick start uses public imports and returns explicit HTML/results. Six complete TypeScript recipes compile under NodeNext and Bundler with ES2022-only libraries and no ambient types, and execute in all four neutral cells.                                                                                                                                                    |
| Standard shapes                  | Paragraph 2.11.7, Header 2.8.9, Quote 2.7.6, List 2.0.9 and Image 2.10.3 saved-data profiles; Community image alt extension is explicit. Nested ordered counters, read-only checklist text, quote attribution and literal Code customization retain their documented semantics. These are saved-shape contracts, not installed authoring runtimes.                                                     |
| Custom blocks, aliases and tunes | Typed guards/registrations, overrides, helper usage, alias keys and Code 2.9.4 example are complete public recipes. All callback output still passes the common policy; arbitrary host callback JavaScript is trusted and is not sandboxed.                                                                                                                                                            |
| Strict and preview               | Strict failure produces no publishable HTML; explicit preview can omit invalid/unsupported blocks with block-scoped diagnostics. Structural validity, HTML safety and host publication approval remain three separate decisions.                                                                                                                                                                       |
| Angular component and directive  | Seven extracted recipe files compile. Component and supported directive hosts exercise required data, identity updates, current results, failure clearing/recovery and preview. Public imports require no workspace aliases.                                                                                                                                                                           |
| Configuration and styling        | Instance/element/route/application precedence, whole-value replacement and immutable policy/registry configuration are documented and tested. Hosts own scoped global CSS; no hidden theme or `::ng-deep` requirement.                                                                                                                                                                                 |
| SSR/hydration                    | Complete browser/server bootstrap examples use matching data/configuration and host-owned hydration. Packed tests cover concurrent request and route-policy isolation, CSR, JavaScript-disabled SSR, prerender and initial DOM parity. Host/container reuse is proved; individual rendered descendants are not promised to retain identity.                                                            |
| Safety and accessibility         | URL/attribute/markup allowlists and resource limits are explicit. Missing/blank alt fails strict rendering and omits the entire image in preview; authored literal alt and explicit decorative empty alt are distinct. Browser corpus checks cover malicious/custom output and semantic omissions. Host-level keyboard/screen-reader behavior and publication decisions still require consumer review. |
| CSP and external assets          | Sanitization does not establish CSP compliance, resource availability, privacy, navigation approval or safe host CSS. Hosts choose these policies; the renderer does not fetch remote assets or install application policy.                                                                                                                                                                            |

| Package                                     | Distribution and public surface                                                                                                                                             | Runtime boundary                                                                                                                                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@anarchitects/editorjs-html@0.0.1`         | ESM, root and `package.json` exports; `renderEditorJsHtml`, `createEditorJsHtmlRenderer` and 18 public contract types. No advertised native CommonJS entry.                 | Core `^0.0.1` and exact `sanitize-html@2.18.1`; Node engine `>=22.12.0`. No Angular, Forms, Nest, Nx, authoring tools, TypeScript or Node ambient types in the isolated neutral production closure.                                      |
| `@anarchitects/editorjs-html-angular@0.0.1` | Angular Package Format with FESM2022 and declarations; component, directive, `EDITOR_JS_HTML_CONFIG`, `provideEditorJsHtml`, and three re-exported headless contract types. | Headless `^0.0.1`, emitted `tslib ^2.3.0`; exact alternative `@angular/core` peers `22.0.0 \|\| 22.1.4 \|\| 22.2.2`. Node engines `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0`. Host application builder/SSR packages remain host dependencies. |

The proof matrix is four neutral Node versions: **22.12.0, 22.22.3, 24.15.0,
26.0.0**; and Angular/Node pairs **22.0.0/22.22.3, 22.1.4/24.15.0,
22.2.2/26.0.0**. Angular compiler, CLI, builder and SSR match each cell;
TypeScript is **6.0.3**, package builder ng-packagr **22.1.1**, Playwright **1.64.0**
and Chromium **156.0.8078.4**. These observations do not certify every engine-range
patch, other Angular versions, Firefox/WebKit or other operating systems.

## Technical acceptance and downstream ownership

| #650 requirement                                                   | Implementation and evidence                                                                                             | Disposition                                                                                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Adoption, licensing and supported shapes                           | [Research](editorjs-html-research.md), accepted ADR0008; #681                                                           | Complete; own formatter plus maintained sanitizer selected.                                                                          |
| Neutral deterministic rendering, imports and declarations          | [Foundation](editorjs-html-foundation-validation.md); #682; four actual packed neutral consumers                        | Complete for the documented ESM/browser contract.                                                                                    |
| Standard/custom/tune semantics and diagnostics                     | [Profiles](editorjs-html-profiles-validation.md); #683; public recipes and packed corpus                                | Complete for supported shapes and strict/preview behavior.                                                                           |
| XSS, URL/attribute policy, unsafe overrides, alt and accessibility | [Adversarial evidence](editorjs-html-adversarial-validation.md); #684; shared corpus through both Angular presentations | Complete bounded regression evidence, not a guarantee against every attack or host accessibility defect.                             |
| Standalone Angular component                                       | [Component evidence](editorjs-html-angular-component-validation.md); #685                                               | Complete; signal inputs, observable results and real hydration.                                                                      |
| Host directive, scoped DI and styling                              | [Directive evidence](editorjs-html-angular-directive-validation.md); #686                                               | Complete; shared invocation, no global request state or sanitizer bypass.                                                            |
| Packed compatibility, SSR/hydration and authoring isolation        | [Packed evidence](editorjs-html-packed-validation.md); #687; exact artifacts below                                      | Complete in the seven approved cells, including a real authoring-bundle negative control.                                            |
| Nx caching, CI and distributed evidence                            | #687 resolved graph, local miss/hit/restoration/invalidation and fail-closed collector; green candidate CI below        | Local and CI proof established; remote restoration and actual renderer DTE remain an explicit #679 exception.                        |
| Consumer documentation and renderer readiness                      | Both packed READMEs, compiled examples and this #688 review                                                             | Ready for #674/#75 handoff when this PR merges; #680 owns integrated acceptance and #76 final release gates.                         |
| Ecosystem discoverability                                          | Existing #651                                                                                                           | Pending actual npm publication and separate instruction; upstream acceptance blocks neither technical readiness nor initial release. |

## Exact artifact and validation evidence

Build, typecheck, lint and tests for both renderer projects passed on this baseline
through Nx (20 tasks including dependencies, 18 cache hits). This includes **598
headless and 35 Angular unit tests**. Final package inspection occurs after those
writers finish. A fresh manual APF pack had different compressed bytes despite
identical six-file contents, so packed proof was repeated instead of treating the
old archive identity as sufficient.

Fresh local run `si688-readiness` passed all seven independent installations,
all **16 proof atoms** (zero cache hits, 1m34s), four harness integrity tests
(via their existing valid Nx cache), and the uncached completeness gate. The
coordinator was Node 24.22.2, Yarn 4.18.0 and Nx 23.2.1 on macOS arm64; every
consumer used its selected Node binary. The configured browser cache exposed
only Chromium headless shell. No hosted work was started.

Each neutral cell compiled/executed six README recipes and checked 756 browser
attack cases, 30 invalid-fragment omissions and accessibility semantics. Each
Angular cell compiled seven recipes and checked 1,169 corpus cases through both
presentations, scoped policy and request isolation, CSR/SSR/prerender/hydration,
and authoring isolation with a real negative control. Browser/hydration error
collections were empty. The fresh selected-runtime preparations reproduced these
same distribution hashes across every applicable cell:

| Archive              | SHA-256                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `core@0.0.1`         | `af9c399df59a106dc03a03dca40c91a524afb2fc404b25a0f0ad9d0cb1867c22` |
| `html@0.0.1`         | `78bde900a0211b3c04ad7985daedbf57b4b6c8853424969285d43429afae35e8` |
| `html-angular@0.0.1` | `815efe3afb4d021a75ca4fa752a6be1db6e0b11f46a43c5ed3bdd7630f5fe9ef` |

The final tested archives were inspected after all build/check writers completed:
20 files for headless, six for the Angular APF, and 39 for the core dependency.
Package-specific README and Apache-2.0 LICENSE bytes match their owning sources;
public default/types targets exist, declarations and complete examples compile,
workspace dependency ranges are resolved, and no dependency tree is bundled into
these archives. The two renderer sources have no separate NOTICE file or copied
third-party renderer implementation requiring an additional package notice.

The sealed neutral production installation retains license files for all 18
installed packages: Community's Apache-2.0 packages and MIT, BSD-2-Clause,
BSD-3-Clause and ISC dependencies, including sanitize-html's MIT license. The
Angular reference installation also retains Angular core's MIT license and
`tslib@2.9.1`'s 0BSD license and `CopyrightNotice.txt`. Dependencies remain external
package dependencies; downstream applications must retain notices when bundling.
No third-party license text was removed or represented as Community-owned code.

Source/configuration identity remains
`969b0bc161e75900e39dd68e77eb236f438d617946dfaf3d43f988a84a933973`;
the headless-shell installation identity is
`6a9517498194b18386aa1cd72e8efe5a774e313c739ccb77d4b5d9db0e828940`.
All sixteen result manifests and their complete output-file hashes were verified,
as were each snapshot archive and both consumer/runtime lock hashes.

| Cell               | Snapshot SHA-256                                                   | Consumer lock SHA-256                                              |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| angular-current    | `c650e0426c23921be72d7110dc7fd3e4d1727320be75db083f14bcab51999c2e` | `08c5a5458b0df647da2268e2e278fc590048366d3f0d740f2038d0be5edd8fd3` |
| angular-minimum    | `08818d440d768182c7170add931f6cef658814a38205f45ec33c8b2a68228107` | `f64c88ad352ef47f397bdb51c0898862da637a29e74d47bff0dfb7fcad993489` |
| angular-reference  | `1896c1ca661ba1dd18a67e91d3f721b1a71bc5f8043755b265f883e8d190e9f8` | `6ee1c7b4a9783396af335805cebbbae71c05105436104c461855e848ab276c57` |
| headless-current   | `dfa98b4c5f7c829eb35a4c706271b43abc70726e786425836c8e730f92719f5a` | `4f0d42ac31ca9a9ffc800bf545b6b9ac0223d5c480ff8d63da0f17f9fafd2559` |
| headless-floor     | `b26fde9d5034433240deb2f262a5f3792f7b16f4f6f3e2665b2712c6d4a04e04` | `4f0d42ac31ca9a9ffc800bf545b6b9ac0223d5c480ff8d63da0f17f9fafd2559` |
| headless-minimum   | `f4d2a5d000bc4ceaabe86cebf770419d2e4158a87a7404ebc6a18f206df91fce` | `4f0d42ac31ca9a9ffc800bf545b6b9ac0223d5c480ff8d63da0f17f9fafd2559` |
| headless-reference | `89877ebd78070b2269d26dd468d2109e10ad0f49b840fedcebd48e08886bed90` | `4f0d42ac31ca9a9ffc800bf545b6b9ac0223d5c480ff8d63da0f17f9fafd2559` |

The separate Node runtime locks are keyed by the exact runtime:

| Node    | Runtime lock SHA-256                                               |
| ------- | ------------------------------------------------------------------ |
| 22.12.0 | `5462b88e5b1b22009f9f397a5a17dcc8405334a956734c9b6f3c63b9ed8fd3e1` |
| 22.22.3 | `141f0d34e9f339bebd1c48b6f52a4f0c8876d45ea9ae01ac7069b81d1b5fc0b1` |
| 24.15.0 | `ee6652e2e799f5944c9a16d0f8c83d59e616c2dac8fdcde47da852954dbbfbb3` |
| 26.0.0  | `6b787ebfc52452f0f54f59d9fb82b159ced864d76e1c3d08382b4ebd67b87558` |

Ignored local evidence is retained under
`dist/editorjs-renderer-inputs/si688-readiness` (sealed consumers, manifests and
locks), `dist/editorjs-renderer-results/si688-readiness` (builds, summaries, logs,
file manifests and `complete.json`), and
`dist/editorjs-renderer-readiness/si688/inspection.json` (final archive/manifest,
lock and license inspection). The committed identities above provide the durable
review reference; these local artifacts are not published packages or a promise
of indefinite artifact retention.

The resolved graph has seven uncached preparation atoms, sixteen cacheable proof
atoms and an uncached collector. Each Angular behavior/corpus/isolation atom
depends on its matching restorable build. The earlier #687 record retains local
miss/hit, clean restoration and invalidation evidence; this review does not turn
that evidence into cross-machine reuse. Refer to its reproduction commands with
a fresh run ID after any source, policy, dependency, archive or environment change.

### Authorized CI inspection

One read-only inspection found all **12 configured jobs successful** for final
PR697 head `b172a04853e23474b6b671c40a17680e6b16855c` in
[CI run 41904896535](https://github.com/anarchitects/anarchitecture-community/actions/runs/41904896535).
The renderer matrix runs inside
[editorjs-angular SSR (Chromium)](https://github.com/anarchitects/anarchitecture-community/actions/runs/41904896535/job/126836805225).
The headless Node floor job also passed. The separate authoring packed DTE job's
success does not certify distribution of renderer atoms.

The merged baseline has the same complete file tree. Its separate
[main run 41911639032](https://github.com/anarchitects/anarchitecture-community/actions/runs/41911639032)
was still in progress at inspection and is not recorded as passed. No polling or
rerun followed. This evidence certifies the reviewed implementation candidate;
it does not pre-certify this documentation PR, later integrated work or a release
commit. Required PR checks remain normal merge gates.

## Independent release history and handoff gates

On 4 November 2026, separate public npm lookups returned **E404** for both
`@anarchitects/editorjs-html` and `@anarchitects/editorjs-html-angular`. Inspection
of all **234 remote tag references** and **102 GitHub releases** found no renderer
package release. Neither package has an observed prior public release; each
retains its independent initial `0.0.1`. No version or release configuration was
changed, and no package was published. Registry history must be checked again at
release time; the README install commands describe the prepared distribution,
not current public npm availability.

| Remaining gate                                        | Owner and revisit condition                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merge this technical handoff                          | #688, normal PR review/checks; #681–#687 are closed. Parent #650 stays open for #651.                                                                                                                                                                                                                                                                                                              |
| Whole-family coverage and integrated journeys         | #674 inventories this evidence; #675–#678 cover integrated author → save → persist/load → render, aliases/tunes/Code and failure paths. #680 accepts the complete family after remaining CI/protection work.                                                                                                                                                                                       |
| Renderer and existing authoring remote/DTE exceptions | Community maintainers via #679: separately authorized evidence must establish remote restoration, worker scheduling/dependency order, failure propagation and equivalent complete outputs. Snapshot reuse is currently bounded to one run and compatible machine identity. Keep this unresolved until proven or an explicit reviewed disposition is accepted before integrated/release acceptance. |
| Affected job selection and main protection            | #695 reconciles selection before expensive/platform job allocation; #696 reconciles actual checks, skip/failure semantics and effective branch protection. This record does not settle either audit.                                                                                                                                                                                               |
| Exact release-commit validation and publication       | #76, after #75/#680: refresh history, artifacts, locks, supported consumers, required CI and open exceptions on the eventual release commit; then publish under the repository's release procedure.                                                                                                                                                                                                |
| Post-release outreach                                 | #651, after verified public npm availability and explicit instruction. Recheck upstream guidance, duplicates and links then.                                                                                                                                                                                                                                                                       |

Broader onboarding/demo work belongs to #77/#78 and adoption to
[Bricks #481](https://github.com/anarchitects/anarchitecture-bricks-3tier/issues/481).
There is no FitOverForty-specific API, forced migration, mandatory storage
envelope, GrapesJS conversion or universal AST. The next sequencing step is #674
after this handoff merges and the maintainer starts it; no downstream issue is
started by this record.
