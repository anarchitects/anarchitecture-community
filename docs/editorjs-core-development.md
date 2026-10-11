# Editor.js core development and release readiness

The consumer guide is the package [README](../packages/editorjs/core/README.md).
This document covers repository checks and release preparation for Nx project
`editorjs-core` (`@anarchitects/editorjs-core`).

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

Keep the dedicated minimum-runtime job and the main job green. The minimum-runtime
job bypasses Nx cache so it cannot reuse Node 24 results. Nx inputs include
README changes so packed documentation checks cannot reuse a stale test result.
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
