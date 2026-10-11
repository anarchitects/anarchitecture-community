# Editor.js Angular package development

Nx project: `editorjs-angular`. Package: `@anarchitects/editorjs-angular`.
Consumer-facing behavior is documented in the
[package README](../packages/editorjs/angular/README.md).

## Implementation boundary

Issue #533 established packaging and artifact checks. #534 adds typed configuration,
shared controls/events and the lazy loader/provider seam. No component or control
facade implementation ships yet; lifecycle/data/operation implementation remains
#535–#538. Do not advertise those capabilities as implemented.

Core owns framework-neutral controls/events and data algorithms. Angular re-exports
the shared event/control types and consumes `normalizeOutputData` at the creation
boundary. Editor.js configuration (which references browser types), Angular DI,
platform checks and holder binding stay here. The loader returns a synchronous
factory so an owner can check for destruction after awaiting code loading and
before constructing an editor. Factory calls create separate instances, reserve
holder/data/callback ownership, and propagate failures; no instance lives in DI.

The contracts choose initialization-only configuration, serialized accepted data
replacements/commands, coalesced automatic saves with stale-result suppression,
and no programmatic-write feedback. Implement generic coordination in core behind
non-DOM driver contracts as #536/#537 introduce it; Angular owns signal observation,
outputs and component disposal. No generic queue or parser is duplicated here.

All five repository ADRs were reviewed: Governance ADRs 0001–0003 retain their
Governance scope; the accepted Modern Angular ADR and ADR 0004 apply to this
package. Relevant architecture, reactivity, providers, forms, SSR/builds and testing
guides were reviewed. The wrapper follows the core's contracts; existing consumers
own adaptations. Forms and full SSR/hydration validation remain #68/#69.

The Angular MCP best-practices endpoint failed during this scaffold work; official
[Angular guidance](https://angular.dev/ai/develop-with-ai) and the local accepted
guides were used. The live guidance now relies on Angular 22's default OnPush,
whereas the accepted local guide requires it explicitly. Follow the local explicit
setting in Angular fixtures/components. No runtime component is shipped here.

## Generator and TypeScript configuration

The installed `@nx/angular:library` generator was inspected and dry-run before
generation. Nx 23.2.1 rejects this repository's TypeScript solution setup by
default; its documented `NX_IGNORE_UNSUPPORTED_TS_SETUP=true` override was used
only for generation, with `--skipTsConfig` so it introduced no source path aliases.

Angular compilation uses `composite: false`, no project references, and no source
custom resolution conditions. Only this package is excluded from inferred
`@nx/js/typescript` targets; it has explicit `ngc`/test-typechecking tasks instead.
Its library tsconfig tells Nx sync not to add a core project reference. Nx build
dependencies still build core first; Angular resolves the built core declarations.
The repository's other projects retain their TypeScript solution configuration.

The package source export condition is for workspace tooling only. Consumers use
the generated APF `types` and `default` entry points. Do not enable the source
condition when testing or installing a packed artifact.

## Dependencies and linting

Angular core/common remain peers. Editor.js is a `^2.31.7` peer with exactly
`2.31.7` as the development reference; it is never imported eagerly. The core
dependency is added through Yarn and uses a semver range that links the local
workspace package while remaining valid in the generated publish manifest.
`ng-packagr` is allowed to retain that specific non-peer dependency and supplies
its standard `tslib` dependency.

The generator adds ng-packagr, Angular ESLint and stylesheet build prerequisites
as workspace development tooling. The ESLint utility is aligned with the existing
8.68.0 TypeScript ESLint toolchain; its older transitive copy is deduplicated to
avoid an incompatible TypeScript peer requirement. Runtime dependencies are checked
without scaffold exemptions. Test-only imports
and Vitest configuration are excluded from runtime dependency checks.

## Validation

From the repository root:

```sh
yarn nx run-many -p editorjs-angular editorjs-core -t build typecheck test lint
yarn nx format:check --projects=editorjs-angular
```

- `build` uses `@nx/angular:package` / ng-packagr in partial compilation mode and
  produces `dist/packages/editorjs/angular` with FESM2022 and bundled declarations.
- `typecheck` runs Angular compilation with no emit plus strict test typechecking.
- `test` depends on build, packs the generated Angular artifact and core package,
  then unpacks them into an isolated temporary consumer without source aliases.
- The packed import runs in Node with Angular peers installed and Editor.js absent.
  Angular peers initialize before browser-global guards (Angular itself probes
  optional globals); the wrapper must introduce no further access. This checks
  module evaluation, not a complete SSR rendering contract.
- A separate consumer links the installed Angular 22.1.4 peers and compiler
  prerequisites, compiles a standalone host with strict templates against the
  packed wrapper/core, and verifies Angular compilation output. Editor.js declarations
  are supplied by the pinned peer; custom configuration, shared controls/events and
  forbidden ownership fields are type-checked. Core separately compiles its full
  public API in an ES2022-only consumer without Angular, Editor.js or DOM types.
- Loader tests exercise actual Angular DI/platform selection, override scope,
  deferred loading/construction, independent factories, protected options, core
  normalization and error propagation. They use a fake Editor.js module; real
  browser behavior remains #538.
- Artifact tests check public paths, portable dependencies, current README and
  Apache-2.0 license, and exclusion of source/test files. Keep the package LICENSE
  synchronized with the repository license.

The main Node 24 CI `run-many` discovers these targets. The core's separate Node
22.12 job remains core-only: the Angular toolchain requires a newer Node baseline.
The scaffold does not establish a runtime/browser/Angular-minor compatibility
matrix for an editor that has not yet been implemented.

## Release configuration

The project participates in independent Nx release configuration with
`editorjs-angular@<version>` tags. Source and generated package manifests are both
updated during versioning, and publishing targets the generated APF directory.
Dist manifests remove local dependency protocols. Core must be available at a
compatible version before an external consumer can install the wrapper.

Use `init:` for this new package scaffold. The existing manual release workflow
uses `--skip-publish`; creating or merging the scaffold does not publish it. Keep
the README's component/facade limitation until those implementations exist, and
complete #67's release-readiness checks before advertising a working editor.
