# Editor.js core development and release readiness

The consumer guide is the package [README](../packages/editorjs/core/README.md).
This document covers repository checks and release preparation for Nx project
`editorjs-core` (`@anarchitects/editorjs-core`).

The [tool registry implementation contract](editorjs-tool-registry-design.md)
defines the composition and lazy-resolution work for #70. #593 implements
composition and #594 implements the core resolver; Angular sections remain planned.

## Lazy resolution increment

Before #594 implementation, the full ADR inventory was re-enumerated against
Community `f28bd3c` and Meta `823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`.
All eight local and eighteen Meta records read for the preceding slices remain
unchanged, including proposals and historical records. The complete status table
in the registry design still applies. The architecture and testing guides require
explicit async ownership and package evidence; local ADR0004 requires public
documentation and packed examples, local ADR0007 / Meta0013 govern release intent,
and Meta0015 governs the existing Nx check contracts. There is no accepted-ADR
conflict. No Angular, DOM, concrete-tool, HTTP or dependency change is needed.

The resolver owns one selection, immutable reference context and one attempt/cache.
Failure invalidates the entire attempt, explicit retry starts all selected lazy
definitions again, and disposal promptly rejects waiters and clears owner state.
Constructors are retained only after full success; every caller receives fresh
map/settings containers using the same copying rules as eager materialization.
The resolver rejects direct-class eager `then` registrations before invoking any
loader, preventing Promise assimilation from invoking a tool. The design and
consumer guide document the configured-registration alternative.

Validation on Node 24.22.1 passes core build, typecheck, lint and all 216 tests,
including 25 resolver cases and dependency-free packed imports/declarations and
README examples. Downstream Angular build, typecheck and all 138 tests pass.
Core lint retains only the pre-existing `_time` warning. Browser/network matrix
validation remains #597. The package has no release tags and npm returns E404, so
this unpublished increment uses `init(editorjs-core)` without a version bump.

## Registry composition increment

#593 was reviewed against Community `f38aa16` and Meta
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5` on 2026-10-26. The eight local and
eighteen Meta ADR records read for #70/#592 were re-enumerated; their contents are
unchanged. The design's complete status inventory and applicable constraints
remain authoritative. ADR0004 requires the consumer README and packed examples;
Modern Angular's package boundaries keep this TypeScript implementation DOM-free.
Governance/Nest decisions retain their own scope; proposals do not override
accepted records. No conflict, framework dependency or compatibility widening was
introduced. Existing Nx targets and cache contracts are reused under Meta 0015.

Core now owns immutable composition/selection snapshots, explicit replacement,
inert eager/lazy definitions, built-in metadata and reference validation.
`createToolMap` is the documented design refinement for eager materialization;
it rejects lazy definitions without calling them. Async loading is covered by the
resolver increment above.
Typed tuples retain final replacement types; dynamic lists retain conservative
unions. Snapshot containers are frozen while opaque config/data identity remains
host-owned. Unit tests cover ordering, conflicts, safe properties, profile/default
handling, selection, identity and non-evaluation. Packed tests exercise all new
runtime exports and compile public types/README examples in dependency-free,
ES2022-only NodeNext and Bundler consumers.

Local validation on Node 24.22.1 passes core build, typecheck, lint and all 191
tests (including 39 registry cases and the packed consumers), plus the downstream
Angular build, typecheck and 138 tests. Lint retains the existing unused `_time`
warning in the document coordinator; this increment introduces no lint warnings.
This is package-level evidence, not the browser/network matrix assigned to #597.

## Architecture review

The complete local ADR inventory was reviewed for #524: Governance ADRs 0001–0003
are accepted and concern the Governance package family; their migration constraints
do not impose an existing application's model on Editor.js core. The accepted
[Modern Angular ADR](adr/modern-angular-22-signal-forms.md) and relevant architecture
and testing guides require neutral contracts to remain free of Angular and browser
initialization. Concrete Angular 22 / Signal Forms integration stays downstream.

[ADR 0004](adr/0004-public-package-documentation.md) was explicitly accepted by the
maintainer on 2026-10-11. Its consumer documentation and packed README requirements
apply here. No conflicting accepted decision was identified. Core defines the
portable contract; applications own adapters, storage mappings, compatibility
policy, and migrations. Named consumer adoption does not gate core release.

## Local checks

Use the repository's pinned Yarn toolchain and install dependencies with
`yarn install --immutable`. From the repository root:

```sh
yarn nx run-many -p editorjs-core -t build typecheck test lint
yarn nx format:check --projects=editorjs-core
git diff --check
```

The test target depends on build. The packed-package suite uses local `npm pack`
with scripts disabled and unpacks into a temporary consumer; it does not publish
or fetch a registry package. The consumer has no installed dependencies, workspace
resolution, Node/DOM ambient declarations, or Editor.js declarations. The workspace
TypeScript compiler runs against that consumer with `strict` and `skipLibCheck:
false`. The repository-only source condition must not be enabled in this consumer.

## Validation matrix

| Dimension        | Coverage                                                                                                            | Limit                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Node 22.12.0     | Dedicated CI job runs build, typecheck, tests, lint                                                                 | Declared minimum, not a browser engine matrix                                                   |
| Node 24          | Main CI job runs the same package targets in workspace `run-many`                                                   | Does not assert every intervening Node release                                                  |
| Published ESM    | Dependency-free import with browser globals guarded; all runtime exports exercised; deep imports rejected           | No CommonJS build                                                                               |
| TypeScript 6.0.3 | All public contracts and README TypeScript examples compile using NodeNext and Bundler resolution, ES2022-only libs | No claim that older compilers were tested                                                       |
| README artifact  | Packed README equals source README; quick start is compiled and executed                                            | Human review still checks clarity and completeness                                              |
| Editor.js 2.31.7 | Pinned dev-only declarations check document and tool-settings compatibility                                         | No editor instance, plugin runtime, or full Editor.js version matrix                            |
| Data and plugins | Parsing/normalization, IDs, synchronous tool validators, upload contracts, provenance and future versions           | No HTML sanitization, storage implementation, automatic migration, or concrete tool integration |

Keep the dedicated minimum-runtime job and the main job green. Core build,
typecheck, test and lint inputs hash the exact Node version, platform, architecture
and `NODE_OPTIONS`, so the minimum-runtime job can reuse Node 22 results without
accepting Node 24 evidence. Inputs also cover the lockfile, root TypeScript
configuration and README; lint includes the shared ESLint rules and tests hash
`CI`. Build inputs retain the production exclusions used by dependency checking.
Do not replace packed consumers with source-alias tests. Update the public export
table, type-only fixture, runtime export assertion, and examples together when an
intentional public API change is made.

## Version and release workflow

`nx.json` includes `editorjs-core` in the independent release group with tag pattern
`editorjs-core@<version>`. Conventional commits select changes: `feat` is a minor
bump, `fix` and `refactor` a patch, and `docs`, `test`, `ci`, and `chore` do not
trigger a bump. New package scaffolds use `init`, which also has no automatic bump.
Breaking changes must be explicitly identified and described with consumer migration
guidance; do not hide them in a documentation-only release. Review the selected
version against the package's documented pre-1.0/semver policy before release.

The existing manual [release workflow](../.github/workflows/release.yml) runs from
`main`, accepts `projects: editorjs-core`, an optional version specifier, and the
first-release flag. It generates release/version artifacts with `--skip-publish`;
this is **not npm publication**. GitHub project release notes are enabled and local
project changelog files are disabled in `nx.json`. Actual npm publication is a
separate maintainer action. Completing #524 does not bump a version, run the release
workflow, or publish the package.

Before release, verify the package-specific README in the packed artifact, the
documented exports and compatibility matrix, clean CI, and release-note accuracy.
Use a first-release setting only when no prior project release exists. Inspect the
release preview and chosen version rather than assuming the scaffold's manifest
version represents an already published release.

### Initial release-note content

Use this summary when preparing the first core release, adjusting it to the actual
selected version and any subsequent changes:

- Framework-neutral Editor.js document/block, tool registration, JSON, and upload
  contracts with no runtime or peer dependencies.
- Safe parsing and deterministic normalization that preserve supported unknown tool
  payloads and return structured diagnostics.
- Structural/ID validation with host-supplied synchronous tool validators.
- Optional provenance separating Editor.js, application schema, tool, and producer
  versions. Unknown versions are preserved without implicit migration.
- ESM/ES2022 output, Node 22.12+ baseline, published declarations and documented
  public exports. Editor.js 2.31.7 is a pinned development compatibility reference.
- Consumers own rendering safety, transport, persistence, version policy, and
  migration. Adoption requires mapping application records into the raw document
  contract; no particular application's storage envelope is required.

## Document coordination validation

`EditorJsDocumentCoordinator` is an additive runtime export introduced for #536.
Its save/render driver, queue, event sequencing and baseline comparison are neutral
and compile with ES2022-only declarations. The owner supplies readiness/disposal
and synchronous event sinks; Angular is only one consumer. The packed Node check
instantiates and exercises it with guarded browser globals and no dependencies.
Deterministic deferred-driver tests verify stale results, serialized work,
replacement feedback, recovery and late disposal independently of Angular.

#537 extends that same queue with a stable `api` facade and core-owned
`EditorJsOperationError`. Input replacements, automatic saves and imperative
operations remain serialized. The packed consumer exercises actual facade calls
and disposal rejection; all declarations stay DOM-free. Read-only baseline timing
is explicit because downstream Editor.js cannot save through its public API while
read-only. Active and queued imperative promises reject immediately on disposal,
without depending on eventual driver settlement. Optional driver capabilities and
actual mode reporting preserve portability for non-Angular owners.

## Downstream ownership

Wrappers and forms/SSR integrations belong to #67–#69, tool registries and concrete
tools to #70–#71 and #73, upload adapters to #72, and persistence patterns to #74.
Application integration belongs to its consumer repository. Create focused
follow-ups when a concrete adoption gap is discovered; core release readiness is
demonstrated by generic consumers rather than by migrating a named application.
