# Portable Editor.js registry validation

Issue [#597](https://github.com/anarchitects/anarchitecture-community/issues/597)
extends the existing private `editorjs-angular-host` and `editorjs-angular-e2e`
fixtures. It exercises the public registry APIs implemented through #596. No
publishable package API, dependency, peer range or release status changes.

The subsequent [registry readiness review](editorjs-tool-registry-release-readiness.md)
consolidates #598's public examples, archive checks, fresh matrix results and
release-history decision. The local run record below remains #597's dated evidence.

## Architecture review

Preflight enumerated and read all eight Community ADRs and all 18 Meta records at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`, including proposed and historical
records. The Modern Angular guide, repository application and applicable topic
guides were reviewed. The [registry design](editorjs-tool-registry-design.md)
records the applicable decisions: framework-neutral, DOM-free core; public
Angular composition and per-owner lifetime; request-safe SSR; bounded versions;
and contributor evidence separate from public documentation. Accepted Meta
ADR 0015 governs the [packed task graph](editorjs-angular-packed-dte.md).
Proposals do not replace accepted decisions. No conflict or exception is needed.

## Executable evidence

| Boundary                          | Fixture and assertions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same generic definitions          | `angular-host/src/registry/definitions.ts` supplies lazy block, inline and tune registrations to the direct and Angular hosts. Selection omits `unused`; explicit same-kind replacement removes the original `card` loader. Both rejected paths point to an observable browser-only module.                                                                                                                                                                                                             |
| Real editor behavior              | Shared `angular-e2e/portable/assertions.ts` edits a custom block, applies the inline marker, toggles and saves a tune, checks configured labels, saves the default paragraph, applies built-in bold and reorders blocks with the built-in move-up tune. Two editors retain distinct documents.                                                                                                                                                                                                          |
| Non-Angular packed browser        | `tools/portable-consumer.mjs` freshly installs the core tarball, pinned Editor.js, TypeScript and esbuild into an independent external root. It proves Angular core, Forms and the Angular wrapper cannot resolve; composes/resolves through the packed core API; typechecks and bundles the direct host. Build metadata proves packed provenance and no Angular inputs. Browser requests prove selected tool delivery and no unselected tool fetch; module probes prove evaluation.                    |
| Core without browser dependencies | Existing core package tests retain the separate Node/ES2022-only import/declaration fixture without Angular, Editor.js or DOM ambient types. The portable browser fixture has DOM types and Editor.js intentionally; it does not replace that contract.                                                                                                                                                                                                                                                 |
| Angular without Forms             | Each packed preparation compiles the root registry editor before installing Forms. The registry route uses `provideEditorJsTools` and the public registry token; each editor owns its normal resolver/lifecycle.                                                                                                                                                                                                                                                                                        |
| Failure and lifetime              | Shared browser assertions reject a tool load, remove an owner during a held load, release it, recreate the editor, and assert actual raw creation/destruction counts and an unaffected second editor. Module evaluation is counted separately from editor creation.                                                                                                                                                                                                                                     |
| SSR and hydration                 | `/registry` and `/registry/forms` render empty holders. Sequential and genuinely overlapping HTTP applications receive distinct request-local configuration labels recorded by each registry definition factory, dispose their request owners and create no editors. A fresh label token alone cannot satisfy the factory observation. The server import guard includes emitted browser-only tool modules. Hydration retains the original holder nodes across production, diagnostic and full profiles. |
| Opt-in Forms                      | The same selected registry enters `EditorJsControl` through native Signal Forms. Hydration is pristine/untouched; real editing updates the saved document and dirty state; route removal destroys the editor. Existing broader Forms suites remain required.                                                                                                                                                                                                                                            |
| Public-route isolation            | Emitted dependency closures, cold requests/responses, preload hints and V8 coverage include tool modules as well as Editor.js. Public routes remain isolated during idle observation; registry activation delivers and evaluates selected tools. Unselected modules remain absent. The eager negative control deliberately evaluates Editor.js and the card tool. Re-entry creates new editors using cached modules.                                                                                    |

All executable hosts and concrete fixture tools remain outside the publishable
libraries. Probe state belongs to each browser page; SSR only evaluates inert
definitions, never the tool classes. Configuration labels are synthetic test
data. No persistence, backend, tool package family or broader demo is introduced.

## Commands and retained evidence

```sh
yarn nx run editorjs-core:test
yarn nx run-many -p editorjs-angular-host,editorjs-angular-e2e -t typecheck,lint
yarn nx run editorjs-angular-e2e:test-packed-harness
yarn nx run editorjs-angular-e2e:test-ssr
yarn nx run editorjs-angular-e2e:e2e-hydration --args='--grep=registry'
yarn nx run editorjs-angular-e2e:e2e-isolation
yarn nx run editorjs-angular-e2e:e2e-packed
yarn nx run editorjs-angular-e2e:e2e-packed-ssr
```

The existing CI coordinator discovers the added phases automatically: five CSR
and seventeen SSR atoms per cell, 66 total. Fresh preparation remains uncached
and outside DTE. The portable install is archived with the immutable snapshot;
its preparation helper participates in the source fingerprint. Its atom restores
into a separate temporary root and retains its build graph and browser reports.
The registry hydration atom depends on all three hydration builds. Each atom has
the existing run-scoped inputs, isolated outputs and uncached completeness gate.

Reports under `dist/editorjs-packed-results/<runId>/<mode>/<cell>` contain phase
results, commands, traces and build metadata. Preparation evidence includes the
portable npm lock as well as the Angular locks and boundary checks. The portable
phase adds `portable-build.json`, `portable-graph.json` and a browser delivery
attachment. SSR reports retain request HTML and import-guard diagnostics;
isolation reports retain dependency and browser observations.

## Local validation record

On 27 October 2026, macOS arm64 with Node 24.22.1 orchestrating the pinned
consumer runtimes:

- All 15 packed CSR atoms passed, including the three separate non-Angular
  consumers, under run `553e24aa-badf-48b4-88f6-9c38ab4f92da`.
- All 51 packed SSR atoms passed under run
  `b80d918f-243a-4f75-86ed-2e347c1d10ee`, including registry hydration in all
  three profiles per cell and sequential/overlapping registry HTTP requests.
- The core's 216 tests and the seven packed-harness tests passed.
- Host/e2e typechecking, host SSR typechecking and lint passed. Existing lint
  warnings remain; the added files introduce no warnings.
- Workspace production SSR, all nine registry hydration cases and all eleven
  isolation cases passed. The final factory-observation adjustment was checked
  again by workspace production SSR and the packed matrix.

Local commands used `NX_NO_CLOUD=true`, `NX_DAEMON=false`,
`NX_ISOLATE_PLUGINS=false` and `NG_BUILD_MAX_WORKERS=2`. These execution settings
are not committed workspace policy. Packed preparation was fresh and the atom
results were checked by the uncached completeness gate. Required hosted CI on
the eventual release commit remains separate evidence.

## Limits

The matrix remains Angular 22.0.0/22.1.4/22.2.2, Node
22.22.3/24.15.0/26.0.0 respectively, TypeScript 6.0.3 and Editor.js 2.31.7.
Browser evidence is Chromium only. The portable bundler is pinned to esbuild
0.28.2; this is a validation dependency, not a package support promise. The
fixture tools prove representative behavior, not third-party tool compatibility.

Isolation assumes the fixture's documented absence of authoring-route preloading
and external prefetch/service-worker policies. An unselected tool may exist in
the build output while remaining undelivered and unevaluated. Destruction releases
editor ownership; it does not unload cached JavaScript modules. Local Nx execution
does not establish new hosted DTE performance, restoration or cost evidence.
The separate #598 readiness review retains the required release-commit CI gate.
