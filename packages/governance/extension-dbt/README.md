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

## Non-Goals

- Loading raw dbt artifacts
- Normalizing dbt resources
- Adapter logic
- Runtime composition
- Python host behavior
- Running dbt commands
- npm runtime setup
- Concrete diagnostics
- Concrete signals
- Concrete rule packs
- Concrete metrics
- Concrete recommendations
- Depending on `@anarchitects/governance-adapter-dbt`
- Depending on `@anarchitects/governance-runtime-dbt`
- Depending on `@anarchitects/governance-host-dbt`
