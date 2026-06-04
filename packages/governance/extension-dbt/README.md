# @anarchitects/governance-extension-dbt

## Purpose

`@anarchitects/governance-extension-dbt` provides the dbt Governance extension
package boundary for dbt-specific governance interpretation over normalized
adapter output.

This package interprets normalized dbt governance data.
This package does not load raw dbt artifacts.
This package does not normalize dbt resources.
This package does not run dbt commands.
This package does not compose runtime packages.
This package does not implement Python host behavior.

Parent epic: `#144`

## Location

- Package root: `packages/governance/extension-dbt`
- Nx project name: `governance-extension-dbt`
- npm package name: `@anarchitects/governance-extension-dbt`

## Local Commands

Expected Nx commands:

- `nx build governance-extension-dbt`
- `nx test governance-extension-dbt`
- `nx lint governance-extension-dbt`

In this workspace, run them via the package manager:

```bash
yarn nx build governance-extension-dbt
yarn nx test governance-extension-dbt
yarn nx lint governance-extension-dbt
```

## Boundary

```text
Adapter = discovery, loading, validation, normalization, metadata preservation.
Extension = dbt-specific governance meaning.
Runtime = TypeScript composition boundary.
Host = dbt-native Python developer experience.
```

This package owns only the `Extension` line. It interprets normalized adapter
output and does not depend on adapter, runtime, or host package
implementations.

## Registration

This package exports a Core-compatible extension registration surface:

```ts
import {
  createDbtGovernanceExtension,
  dbtGovernanceExtension,
  governanceDbtExtension,
  registerDbtGovernanceExtension,
  registerDbtGovernanceExtensionContributions,
} from '@anarchitects/governance-extension-dbt';
```

Runtime packages should load the extension through the public package API and
pass it to `@anarchitects/governance-core` extension registration.

Rule packs, signal providers, and metric providers register through existing
Core extension host contracts. Diagnostic providers and recommendation
providers are exposed through Core capability registration so a future
`governance-runtime-dbt` can discover and execute them without requiring this
package to depend on the runtime package.

The default extension registration includes a built-in dbt diagnostics
provider. Runtime packages should execute registered dbt diagnostic providers
against normalized workspace data, dbt metadata resolver outputs, and the
active governance profile.

## Input Expectations

All dbt extension contracts consume normalized Governance workspace data from
adapter output. They do not receive raw dbt artifacts, manifest files, catalog
files, project YAML, or command execution state.

The extension consumes normalized adapter output, not raw artifacts.

## Architectural Boundary

Dependency direction:

```text
@anarchitects/governance-extension-dbt
  -> @anarchitects/governance-core
```

The extension only owns dbt-specific governance interpretation over normalized
adapter output.

## Runtime Usage

The intended flow is:

```text
governance-adapter-dbt
  -> normalized Governance workspace data
  -> governance-runtime-dbt loads @anarchitects/governance-extension-dbt
  -> governance-core registers extension contributions
  -> dbt-specific diagnostics, signals, rule packs, metrics, and recommendations
```

This package defines registration and contracts only. It does not compose the
runtime package, does not load adapter packages, and does not implement Python
host behavior.

## Diagnostics

This package owns dbt extension diagnostics for governance interpretation
quality over normalized adapter output. These diagnostics remain factual and
traceable. They describe incomplete or invalid governance metadata, not
architectural rule violations.

Current MVP diagnostic codes:

- `DBT_LAYER_UNRESOLVED`
- `DBT_DOMAIN_UNRESOLVED`
- `DBT_OWNER_MISSING`
- `DBT_OWNER_INVALID`
- `DBT_CRITICALITY_INVALID`
- `DBT_PUBLIC_MARKER_INVALID`
- `DBT_RULE_SKIPPED_MISSING_METADATA`
- `DBT_GOVERNANCE_PROFILE_INVALID`

Extension diagnostics own:

- insufficient governance metadata
- unsupported governance interpretation patterns
- ambiguous domain or layer interpretation
- invalid governance profile interpretation
- skipped or partial governance analysis

Extension diagnostics do not own:

- missing or malformed dbt artifacts
- unresolved artifact-derived dependencies
- Node, npm, Python, dbt invocation, or environment setup failures
- runtime package compatibility problems
- governance rule violations

## Resolver Concepts

This package also exports pure metadata resolvers that interpret normalized
Governance inventory metadata into dbt-specific extension concepts.

Resolvers consume normalized governance inputs plus preserved `metadata.dbt`
fields. They do not load dbt artifacts, parse manifests, run dbt commands, or
evaluate rules.

Resolver entrypoints:

```ts
import {
  resolveDbtGovernanceMetadata,
  resolveDbtLayer,
  resolveDbtDomain,
  resolveDbtOwner,
  resolveDbtCriticality,
  resolveDbtPublicInterface,
} from '@anarchitects/governance-extension-dbt';
```

Resolver outputs distinguish:

- `resolved`
- `unresolved`
- `invalid`
- `ambiguous`

Each resolution preserves traceability through the Governance node ID, dbt
unique ID when available, and source metadata field paths.

## Supported Conventions

Current MVP resolver conventions:

- layer from `project.layer`
- layer from `metadata.dbt.resource.meta.layer`
- layer from tags such as `layer:marts`
- layer from path segments such as `models/staging`, `models/intermediate`,
  `models/marts`
- domain from `project.domain`
- domain from `metadata.dbt.resource.meta.domain`
- domain from path when explicitly enabled
- owner from `project.ownership.team`
- owner from `metadata.dbt.resource.owner`
- owner from `metadata.dbt.resource.group`
- owner from `metadata.dbt.resource.meta.owner`
- criticality from `metadata.dbt.resource.meta.criticality`
- public/governed interface markers from `metadata.dbt.resource.meta.public`
  and `metadata.dbt.resource.meta.governed`
- public/governed interface markers from tags such as `public`, `published`,
  and `governed`
- materialization category from `metadata.dbt.resource.materialization`
- documentation presence from `metadata.dbt.documentation.description`,
  `hasDescription`, and `hasDocs`
- test presence from `metadata.dbt.validation.tests`
- contract presence from `metadata.dbt.validation.contract`

These resolvers stay descriptive only. Missing metadata is not treated as a
rule violation here, and invalid or ambiguous metadata is surfaced for
extension diagnostics and later signal, rule, metric, and recommendation
issues.

## Non-Goals

- Loading raw dbt artifacts
- Normalizing dbt resources
- Adapter logic
- Runtime composition
- Python host behavior
- Running dbt commands
- npm runtime setup
- Concrete signals
- Concrete rule packs
- Concrete metrics
- Concrete recommendations
- Depending on `@anarchitects/governance-adapter-dbt`
- Depending on `@anarchitects/governance-runtime-dbt`
- Depending on `@anarchitects/governance-host-dbt`
