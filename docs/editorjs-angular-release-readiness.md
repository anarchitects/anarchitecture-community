# Editor.js Angular release readiness

This record reviews the standalone and opt-in Forms surfaces through #554.
Consumer installation, examples and support limits live in the
[package README](../packages/editorjs/angular/README.md). The
[development guide](editorjs-angular-development.md) records implementation evidence
and workspace fixture instructions; the [Forms design](editorjs-angular-forms-design.md)
records the accepted ownership contract. This review does not publish a release or
replace the requirement for green CI on the intended release commit.

## Reviewed decisions and public surface

All five ADRs were re-enumerated and remain unchanged since the implementation
reviews. Governance ADRs 0001–0003 retain their own scope. Accepted Modern Angular
A01/A02/A03/A05/A06/A09/A10/A11 require bounded compatibility, native form ownership,
explicit async semantics, cleanup, supported builders and public artifact evidence.
ADR0004 requires a current consumer README in the archive and keeps fixture/release
procedures in contributor documentation. No conflict or new runtime decision was
introduced. Nx workspace/task skills and the reviewed Angular guidance apply;
this final increment changes validation and documentation, not Angular runtime code.

| Surface                                   | Reviewed contract                                                                                                                                                                 | Evidence                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Root `EditorJs`                           | Immutable `config`/`data`, initialization-only configuration, payload-free `ready`, detached `change`, typed `error`.                                                             | Packed declarations, library contracts and standalone browser scenarios.                         |
| Root `api`, `invalidate()`, `reconcile()` | One core queue; save/render/clear/focus/read-only controls, readiness/disposal guards and explicit reconciliation.                                                                | Public fixtures, core/component tests and browser cases.                                         |
| Root loading and types                    | `EDITOR_JS_LOADER`, `provideEditorJsLoader`, config/tools/loading types and core event/control re-exports. `EditorJsOperationError` preserves core class identity.                | Exact runtime export checks, typed consumer fixture and real lazy-loader integration.            |
| `/forms` exports                          | Only runtime `EditorJsControl`; type-only `EditorJsControlConfig`; no CVA, fake NgControl or package-owned FormControl/FormGroup.                                                 | Exact secondary export checks, public declaration/example compilation and implementation review. |
| Forms value/config                        | Non-null `OutputData`, immutable initialization config; no separate `data` or `api`. Invalid input retains the requested model and reports an operational error.                  | Native binding, normalization and browser failure/recovery tests.                                |
| Forms state and outputs                   | `disabled`, `readonly`, `invalid`, `pending`, `touched`, `dirty`, `required`, `name`, `errors`; native `touch`, plus `ready`/`change`/`error`. Angular owns flags and validation. | Native contracts and keyboard/focus/availability browser assertions.                             |
| Forms `focus()`, `reset()`, `save()`      | Native focus/reset hooks and detached snapshots. Reset invalidates synchronously; superseded snapshots reject. Save does not publish value, mark dirty or run validation.         | Deterministic race tests and held real-editor snapshots in the browser.                          |
| Native migration bindings                 | Direct reactive controls, `compatForm` and `SignalFormControl.fieldTree` with bounded option/reset behavior. `ngModel` excluded from clean initialization/reset support.          | Forty interop cases per packed baseline; direct reactive browser scenario; compiled examples.    |
| Packaging                                 | APF/ESM root, `/forms` and `package.json`; core/tslib dependencies; optional Forms peer; no Forms dependency in core/root.                                                        | Two installation stages per matrix cell, export/dependency allowlists and guarded imports.       |

Core owns normalization, the shared queue, coalescing, invalidation and disposal
checks. Angular owns signals, DI/platform adaptation and holder/component lifetime.
The Forms adapter consumes Angular's native field state; it introduces no second
operation queue or application form model. Non-Angular hosts can use the neutral
core coordinator with their own driver, readiness and teardown.

## Compatibility matrix and reproduction

The executable cells live in
[compatibility-matrix.json](../apps/editorjs/angular-e2e/tools/compatibility-matrix.json).
These pinned reference cells do not track `latest` or claim every patch permutation.

| Cell                  | Angular core/common/compiler/platform-browser/Forms/CLI/build | Editor.js | Consumer Node | TypeScript |
| --------------------- | ------------------------------------------------------------- | --------- | ------------- | ---------- |
| `angular22-minimum`   | 22.0.0                                                        | 2.31.7    | 22.22.3       | 6.0.3      |
| `angular22-reference` | 22.1.4                                                        | 2.31.7    | 24.15.0       | 6.0.3      |
| `angular22-current`   | 22.2.2                                                        | 2.31.7    | 26.0.0        | 6.0.3      |

Angular peers remain `^22.0.0`; Forms must match the application's other Angular
packages. Editor.js remains `^2.31.7`, with 2.31.7 pinned in the fixtures/install
examples. Angular tooling is bounded to `^22.22.3 || ^24.15.0 || ^26.0.0`;
future Angular/Editor.js majors and Node 27+ are not promised. Core retains its
independent Node >=22.12.0 baseline. Chromium/macOS local evidence and Linux CI
jobs do not constitute a full browser, OS or Windows-tooling certification.

```sh
yarn nx run editorjs-angular-e2e:install-browsers
yarn nx run-many -p editorjs-core editorjs-angular editorjs-angular-host editorjs-angular-e2e -t build typecheck test lint e2e
yarn nx run editorjs-angular-e2e:e2e-packed
# Re-run one cell:
yarn nx run editorjs-angular-e2e:e2e-packed --cell=angular22-minimum
```

`e2e-packed` packs both libraries and installs them in an owned temporary directory
outside the workspace, using fresh exact peers and a cell-specific Node binary.
It asserts actual versions and paths, without workspace aliases, peer symlinks or
Nx installed in the consumer. Each cell performs two installation stages:

1. **Forms absent:** install the archives and root prerequisites; require resolution
   of `@angular/forms` to fail; import the root under browser-global guards; compile
   the standalone public declaration fixture with the cell's Angular compiler.
2. **Forms installed:** install the exact matching Forms peer, recheck all dependency
   versions/paths, and assert root/secondary exports and blocked private subpaths.
   Both imports remain guarded against package-introduced browser-global access.
   Compile every TypeScript block from the installed README and both public contract
   fixtures, run forty native interop cases, build the consumer with its Angular CLI,
   and run thirteen Chromium scenarios (five standalone, eight Forms).

Each stage also checks the optional peer metadata, Angular's core/tslib dependency
allowlist and core's empty runtime/peer/optional dependency set. Exact packed README
bytes must match the source. The documented custom-tool import is supplied by a
small consumer-owned fixture; validation/submission example endpoints remain
application responsibilities. The ordinary library package test additionally checks
root imports and an empty-holder server render without Editor.js installed.

Reports in `apps/editorjs/angular-e2e/test-output/compatibility/<cell>` include
`root-only-package-lock.json`, the final `package-lock.json`, `versions.json`,
`package-boundaries.json`, browser HTML reports and failure traces/screenshots.
The boundary record certifies its listed stages only; later browser failures still
fail the Nx target. Temporary applications are removed on success or failure.
The target is deliberately networked and uncached; review retained locks when
comparing runs. Packed servers use port 4318, workspace browser tests use 4317.

## Documentation review

The packed README covers purpose, prerequisites/install, standalone and Signal Forms
quick starts, native state/focus/reset, current-snapshot submission, validation and
operational errors, deferred save limitations, supported migration paths, public
exports, ownership and troubleshooting. All TypeScript examples compile on every
cell; both installation stages exercise the optional-peer contract. Contributor-only
fixture descriptions were removed from the public README under ADR0004.

The supported reset model is explicitly non-null. Legacy controls require the
editor reset hook when reset/write can overtake editor work; `SignalFormControl`
dispatches it natively. Legacy `updateOn` modes do not defer saved publications,
`compatForm` silent writes are unobserved until an event, and compatibility control
availability/validation belongs to native schema rules. Direct `ngModel` has a
transient-null diagnostic and a simultaneous reset/write stale-view limitation.
No blanket legacy-option parity or automatic save-on-submit is promised.

## Release gates and evidence limits

Local validation on 2026-10-12 (macOS arm64) passed all fifteen relevant Nx tasks
across core, Angular, the browser host and e2e project; four tasks used valid cache
results. This includes build/typecheck/lint, 152 core tests, 138 Angular tests and
thirteen workspace Chromium scenarios. All three packed cells passed both peer
installation stages, declaration/README compilation, forty native interop cases
per cell (120 executions) and thirteen Chromium scenarios per cell (39 executions).
Retained locks confirm Forms is absent initially and exactly matched afterward.
Existing lint warnings remain: one in core, eleven in Angular and six in the
standalone browser spec; no lint errors. This is local evidence, without CI
monitoring, version changes or publication.

Required CI paths remain:

- Main workspace build/typecheck/test/lint job.
- Independent `editorjs-core` Node 22.12.0 baseline.
- Workspace Chromium job (`editorjs-angular-browser`).
- All three packed-consumer matrix jobs (`editorjs-angular-packed-consumers`).

Before release, require green checks for the exact release commit and review its
matrix artifacts and final tarballs after any version/manifest transforms. Local
success and merged implementation PRs are not hosted CI or publication evidence.
CI monitoring is intentionally omitted unless the maintainer requests it. Existing
workspace checks and branch protection remain in force.

Browser evidence includes value/flag synchronization, keyboard/composite focus,
availability, reset, validation/submission failure, independent controls and repeated
teardown. Save delivery can be held after a real capture to verify invalidation and
output silence. This is not proof of universal third-party leak freedom, tool
accessibility, screen-reader conformance or every browser combination. Guarded imports
and empty-holder server smoke checks do not establish SSR/hydration or non-authoring
route bundle isolation; those remain #69.

## Semver and release notes

No version, release tag or registry publication changes in #554. Working manifests
remain 0.0.1. `init` does not request a semver bump here and does not classify the
compatibility impact. Compare the intended release with the previously published
artifact, choose the version explicitly, publish a compatible core before Angular,
and verify that the generated core dependency range resolves from the registry.

During `0.x`, incompatible contract changes need an explicit minor release and
migration guidance; from `1.0`, use a major. Peer/runtime narrowing, accepted document
shape, loader obligations and event/error semantics are compatibility decisions.
The optional secondary entry is additive, but the core/root snapshot change is
material: later authoritative replacement/reset rejects pending snapshots with
`superseded`. Failed render/clear suspends publication until successful explicit
reconciliation. Do not describe the entire increment as automatically non-breaking.

Release notes should describe:

- Standalone Angular 22 editing, immutable configuration/data, typed outputs and
  per-owner controls backed by the generic core coordinator.
- Opt-in `@anarchitects/editorjs-angular/forms`, the matching optional Forms peer,
  `EditorJsControl`/`EditorJsControlConfig`, native value/state/touch/focus/reset and
  explicit snapshots; no CVA or separate package FormControl.
- Non-null models, superseded snapshot rejection and reset/reconciliation recovery;
  already-running upstream work cannot be forcibly cancelled.
- Native legacy support boundaries and migration actions above, including `ngModel`
  exclusion, immediate `updateOn` publication and explicit legacy reset hooks.
- Read-only save restrictions, asynchronous validation versus editor work, and the
  consumer's responsibility to capture and validate the exact persistence payload.
- Lazy loading, disposal, public APF exports and the exact tested combinations;
  no full SSR/hydration, tool registry/bundle, uploads or persistence implementation.

If earlier published metadata claimed unbounded Node 26+, also explain the bounded
Node 26 tooling range. Review the actual final README and exports after release
transforms rather than treating an unchanged source manifest as publication proof.

## Downstream ownership

The implemented Forms surface completes the package work reviewed under #68.
Maintainer merge/release approval remains separate. Further work stays downstream:

| Workstream | Ownership                                                   |
| ---------- | ----------------------------------------------------------- |
| #69        | Full SSR/hydration and non-authoring-route bundle evidence. |
| #70        | Registry composition.                                       |
| #71 / #73  | Concrete tools and their integration.                       |
| #72        | Upload transports and integration.                          |
| #74        | Persistence and application storage.                        |

Existing applications adapt to these generic packages; adoption does not gate this
release. No concrete consumer-adoption gap was found in this review. Track a newly
found gap separately rather than redesigning the package around an existing consumer.
