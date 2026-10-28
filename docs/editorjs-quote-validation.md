# Quote implementation and validation

Issue: [#613](https://github.com/anarchitects/anarchitecture-community/issues/613).
Follows merged #612 and the [common tools contract](editorjs-common-tools-design.md).
Combined certification remains #615.

## Architecture preflight

On 28 October 2026, all eight Community ADRs and all eighteen Meta records were
enumerated and read, including proposed/historical content. Community started
clean at `c2697837223cfa86043f41ffbd66ee868760ae58`; Meta was at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`, with the remote ADR directory checked.
Only `docs/adr` was found locally. The complete inventory in the
[registry review](editorjs-tool-registry-design.md#architecture-review-and-authority)
remains applicable. Modern Angular index, repository application, architecture,
providers/routing, reactivity, Forms, rendering, SSR/builds, testing/migration,
validation and API ledger were reviewed. Nx workspace/generation/linking/tasks
and Angular skills, Angular MCP best practices and Nx MCP caching guidance were
consulted.

Applicable decisions: packed consumer documentation (local 0004), neutral public
contracts, public imports and explicit browser/provider ownership (Modern Angular),
actual distribution and exact Nx scope (local 0007/Meta0013), and accurate cache
inputs, outputs and distribution boundaries (Meta0015). No accepted-decision
conflict or exception is needed. Governance proposals remain proposed. No HTTP,
Nest, auth, schema-framework, Forms or framework-version migration is introduced.

## Reviewed artifact and contract

Downloaded `@editorjs/quote@2.7.6` and verified its registry SHA-512:
`D01KUMSDj2r+6Z+xjDkQqI+y6URpeHCvj0+P4pah+GtkG040lWjFb2H4pgHFXuol2cbfyAoraYSw85fuPheCvw==`.
Inspected its declarations, emitted runtime, package metadata and MIT license.
The package depends on this exact version and peers with Editor.js 2.31.7.
Repository-owned files remain Apache-2.0; no upstream code is vendored. Yarn linked
core and the host dependency, adding quote and its required transitive packages
without changing existing locked versions.

The pure root owns `left | center` alignment, config/data types, inert definitions
and structural validation through core's bounded JSON inspection. Required text,
caption and alignment are distinct from initialization defaults. Empty strings and
additional JSON are structurally accepted without mutation; invalid values fail
with relative paths, prefixed by core when composed at document level. Unknown
extension acceptance is not an upstream editing-preservation promise.

The browser entry re-exports the real upstream constructor with a public Editor.js
constructability check. Upstream's alignment enum is private; root declarations
never import it. The documented definition/map path accepts our string-union
config unchanged through Editor.js's public tool contract. Packed browser example
compilation and runtime behavior are the boundary evidence, while the root is
checked under both NodeNext and Bundler with ES2022-only libraries.

Upstream chooses saved valid alignment before config, then defaults to left.
Placeholders default to `Enter a quote` / `Enter a caption`; explicit empty strings
suppress them. Alignment menus update the saved value and active item, without
changing editing CSS. This is also described in the
[upstream documentation](https://github.com/editor-js/quote#tools-settings).
Both text and caption honor read-only mode. Hosts own safe public rendering,
including alignment styling, persistence and migration of incomplete saved data.

## Validation and Nx evidence

Local checks passed:

- Quote build, typecheck, lint and all 40 tests on Node 22.12.0 and 24.22.1.
  Packed tests verify root runtime purity, ES2022-only NodeNext/Bundler
  declarations, alias/constructor inference, invalid public types, README identity,
  exports, dependency metadata and license presence.
- Affected Angular host/e2e typecheck and lint, with existing warnings only;
  formatting and whitespace checks passed.
- Final packed reference preparation (`quote-613-b`) compiled all four extracted
  README examples, including Angular without Forms. Production CSR build passed.
- All seven portable Chromium cases and all nine Angular editor cases passed.
  Quote coverage includes real text/caption editing, custom toolbox title,
  placeholder defaults/empty overrides, saved alignment precedence, both alignment
  choices and active settings, unchanged editing CSS, save/render, read-only
  text/caption and independent owners after teardown.
- All seven packed-harness tests passed, including task-graph eligibility,
  isolated ports, concurrent README preparation and failure propagation.

The reference consumer uses Angular 22.1.4, Node 24.15.0, TypeScript 6.0.3 and
Editor.js 2.31.7 on macOS arm64/Chromium. Local orchestration uses Node 24.22.1;
the separate neutral minimum-runtime check uses Node 22.12.0. These results do not
extend browser or framework compatibility beyond the documented evidence.

The new library uses the existing Nx generator, Vite multi-entry build, Vitest
and package-manager linking. Resolved build output is `{projectRoot}/dist` with
upstream build prerequisites. All three inferred test atoms depend on build;
the aggregate retains every atom. Inputs include source/dependency source, TS and
build configuration, lockfile, runtime version/platform/architecture, NODE_OPTIONS
and CI for tests. Preparation builds and packs quote; source/manifest/README/
license/build-config fingerprints and the real host dependency extend affected
selection and immutable snapshots. Fresh installation stays uncached outside DTE;
the existing isolated packed validation phases remain intact. No cache bypass,
manual CI partition or workspace-wide tooling migration is introduced.

The resolved graph retains 66 cacheable packed phases and six uncached
preparations. TypeScript workspace sync passes without bypasses.

Local cache restoration recovered all eight build files byte-for-byte, checked
with SHA-256 after moving the generated directory aside. Warm, restored and
reverted builds all hit hash `16635115433710573069`. Individual temporary input
changes produced these cache misses:

| Input                    | Build hash             |
| ------------------------ | ---------------------- |
| Quote source             | `1667356660607392231`  |
| Quote Vite configuration | `8467543068647659022`  |
| Core dependency source   | `8024060280752401900`  |
| Lockfile                 | `14073706154777517239` |
| `NODE_OPTIONS`           | `17351017123816802030` |

All probes were reverted and the original hash recovered. Local restoration and
invalidation do not by themselves establish remote cache reuse or Nx Cloud DTE.

## Distribution

The npm name returned 404, matching remote tags were absent, and no entry in 102
GitHub releases matched the quote package. Use `init(editorjs-tool-quote)` and
initial manifest 0.0.1. This slice does not merge, publish, bump existing versions
or start #614. Remote cache reuse, distributed-worker equivalence, the full matrix
and combined/accessibility certification remain hosted CI/#615/#616 evidence.
