# List implementation and validation

Issue: [#612](https://github.com/anarchitects/anarchitecture-community/issues/612).
Follows the [common tools contract](editorjs-common-tools-design.md) and merged
header package. Combined certification remains #615.

## Architecture preflight

On 27 October 2026, all eight Community ADRs and all eighteen Meta ADRs were
enumerated and read, including proposed and historical records. Community started
clean at `43308943dca45435721c71a938e3d0795f2af9be`; Meta was at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. Only `docs/adr` was found locally.
The complete inventory in the [registry review](editorjs-tool-registry-design.md#architecture-review-and-authority)
remains applicable. Modern Angular index, repository application, architecture,
providers/routing, reactivity, Forms, rendering, SSR/builds, testing/migration,
validation and API ledger were reviewed. Nx generation/workspace/tasks/linking and
Angular skills and Angular/Nx MCP guidance informed implementation.

Applicable decisions: public packed README/examples (local 0004), neutral public
contracts and explicit browser/provider ownership (Modern Angular decisions),
actual package distribution and exact Nx scope (local 0007/Meta0013), and accurate
cache inputs, outputs and distribution boundaries (Meta0015). Governance proposals
remain proposed; no Governance, Nest, HTTP, auth or canonical wire schema changes
are introduced. No accepted-decision conflict or architecture exception is needed.

## Reviewed artifact and contract

Downloaded the published `@editorjs/list@2.0.9` archive and verified registry SHA-512:
`rUTgDSt5wygD3Dp24bNyp6vvye/Xf4UWju0ZuvWeP13Z4cu2z1Jb5JFSTEhCou72XUGuf4xVhtsd8cm/bwUS1g==`.
Inspected its declarations, metadata and emitted runtime, including normalization,
style conversion, keyboard nesting, counter menus, save and checklist read-only
behavior. Runtime dependency remains exactly 2.0.9; Editor.js peer is 2.31.7.
Upstream remains MIT; repository-owned files are Apache-2.0. No upstream source is
vendored. Yarn added core, list, Editor.js peer and host dependency; existing locked
versions are retained.

The root owns generic style-correlated nested types, inert definitions and
structural validation. All current root/item metadata is required. Ordered
start/counter metadata is optional but validated when supplied; checklist checked
state is required on items only. Additional JSON fields remain accepted. Known
fields are checked for their applicable style. JSON-depth protection is independent
of editor configuration. Legacy flat strings, old checklist items and missing
metadata are rejected without migration. Raw upstream normalization remains a
separate host migration risk, explicitly documented in the README.

Configuration validates styles, positive nesting limits and unique nonempty counter
subsets without inserting defaults or replacing object/array identities. Core owns
registry selection, conflicts, retry, disposal and document validation composition.
No per-tool Angular provider or Forms state is added.

Actual browser saving after unordered-to-ordered conversion exposed upstream own
undefined root `meta.start`/`meta.counterType` fields. Core correctly rejected
`blocks[0].data.meta.start` as non-JSON. A save-only subclass omits these two optional
fields when undefined. It neither inserts defaults nor repairs unrelated invalid
data, changes rendering, or migrates input. Unit tests preserve explicit counters,
input identity and strict invalid-extension rejection; direct browser tests save
before selecting counters as a regression check. The upstream constructor also throws on persisted `items: []` before API or DOM
use. A characterization test separates structural validity from this upstream
initialization limitation; the README instructs hosts to omit empty blocks when
starting an editor, rather than silently changing saved values. The common-tool design records
this bounded public-boundary adaptation; accepted ADR constraints remain unchanged.

## Evidence and remaining gates

Local checks passed:

- `editorjs-tool-list` build, typecheck, lint and all 53 tests on Node 22.12.0
  and 24.22.1. Packed tests check root runtime purity, ES2022-only declarations
  under NodeNext/Bundler, published metadata, README identity and browser exports.
- Host/e2e typecheck and lint, with only existing lint warnings; formatting and
  whitespace checks passed.
- Packed reference preparation (`list-612-d`), all four extracted public README
  examples, the independent Angular root without Forms, and production CSR build.
- All six portable Chromium cases and all eight Angular editor cases, including
  nested list editing, unnesting, nesting limits, counter configuration, three
  styles, save/render, read-only checklist behavior and owner isolation.
- All seven packed-harness tests, including distribution graph boundaries,
  isolated ports, parallel README preparation and failure evidence preservation.

The reference cell is Angular 22.1.4, consumer Node 24.15.0, Editor.js 2.31.7,
TypeScript 6.0.3 and Chromium on macOS arm64. Local orchestration uses Node 24.22.1;
the neutral minimum-runtime check uses Node 22.12.0. Other pinned cells, remote
cache reuse and multi-worker DTE equivalence remain hosted CI/#615 evidence.

Nx generation produced the publishable Vite package. Resolved build output is
`{projectRoot}/dist` with upstream build prerequisites. The three test atoms each
depend on build and include source, dependency source, runtime version/platform/
architecture, TypeScript configuration, lockfile, NODE_OPTIONS and CI inputs.
The collector retains all three prerequisites. Packed preparation builds/packs
list and fingerprints its source, metadata, README, license and build config.
The host dependency makes affected selection reach e2e. Fresh installation remains
uncached outside DTE; existing 66 packed atoms and isolated resources are retained.
No task/cache/CI bypass is introduced. Workspace TypeScript sync passes normally.

Local build cache experiments restored all eight generated files byte-for-byte
(SHA-256 comparisons) after moving the output directory aside. Warm, restored
and reverted builds all hit hash `12147160078038226872`. Individually adding a
temporary comment to each input produced a distinct cache miss:

| Input                  | Build hash             |
| ---------------------- | ---------------------- |
| List source            | `1288110376816352646`  |
| List Vite config       | `12752009397541387769` |
| Core dependency source | `324234313528545023`   |
| Lockfile               | `13498344597922281455` |

Every probe was reverted, and the original hash was recovered. These checks
demonstrate local invalidation and restoration; they do not establish remote
cache reuse or distributed-worker execution equivalence.

## Distribution

The npm registry returned 404 for `@anarchitects/editorjs-tool-list`, matching
remote tags were empty, and no entry in 102 GitHub releases mentioned the package.
Use `init(editorjs-tool-list)` with manifest 0.0.1. This work does not merge,
publish, bump versions or begin the next slice. Broad accessibility, combined
usage and full matrix certification remain the documented #615/#616 gates.
