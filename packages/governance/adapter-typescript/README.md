# @anarchitects/governance-adapter-typescript

## Overview

`@anarchitects/governance-adapter-typescript` discovers facts from a
TypeScript-oriented workspace and emits `@anarchitects/governance-core` adapter
results. It reads repository files directly and maps discovered packages,
imports, path aliases, tags, metadata, and diagnostics into Core-owned
contracts.

Use this package when you need Governance workspace facts from a TypeScript,
JavaScript, or mixed monorepo without depending on a framework-specific project
graph.

## Key Concepts

- Workspace detection identifies whether a directory contains TypeScript
  workspace indicators.
- Package-manager workspace parsing resolves package roots from
  `pnpm-workspace.yaml` and `package.json#workspaces`.
- Project discovery maps package roots into Governance project and node facts.
- `tsconfig` parsing resolves base config files, `baseUrl`, and path aliases.
- Import graph extraction captures static imports, re-exports, and
  string-literal dynamic imports.
- Dependency mapping converts discovered imports into Governance dependency and
  relation facts.
- Package governance metadata can provide domain, layer, scope, and owner
  values.

## Installation

```bash
npm install @anarchitects/governance-adapter-typescript
```

Hosts that evaluate the result also need `@anarchitects/governance-core`.

## Quick Start

```ts
import { createGovernanceWorkspaceAdapter } from '@anarchitects/governance-adapter-typescript';

const adapter = createGovernanceWorkspaceAdapter();
const probe = adapter.probe(process.cwd());

if (probe.supported) {
  const result = adapter.loadWorkspace(process.cwd());

  console.log(result.nodes);
  console.log(result.relations);
}
```

## Architecture

```text
TypeScript workspace files
  -> workspace detection
  -> package and tsconfig discovery
  -> import graph extraction
  -> GovernanceWorkspaceAdapterResult
  -> Governance Core or a host such as agov
```

The adapter emits canonical graph output and project/dependency compatibility
output from the same discovered workspace facts.

## Responsibilities

This package owns:

- TypeScript workspace detection
- package-manager workspace parsing
- TypeScript project discovery from package roots
- `tsconfig` and path-alias resolution
- static TypeScript import graph extraction
- mapping discovered projects into `GovernanceNodeInput`
- mapping discovered dependencies into `GovernanceRelationInput`
- preserving `GovernanceProjectInput` and `GovernanceDependencyInput` output
- adapter-owned diagnostics for discovery, metadata, config, and mapping
  problems

This package does not own:

- canonical Governance contracts
- rule evaluation
- metrics, recommendations, signals, or scoring
- CLI command behavior
- report rendering
- TypeScript-specific extension behavior
- framework-specific project graph APIs
- workspace generators, executors, or plugin runtime behavior

## Public API

The package publishes one root entrypoint. Common adapter APIs include:

- `createGovernanceWorkspaceAdapter(...)`
- `createTypeScriptWorkspaceAdapter(...)`
- `governanceWorkspaceAdapter`
- `detectTypeScriptWorkspace(...)`
- `parsePackageManagerWorkspace(...)`
- `resolveWorkspacePackages(...)`
- `parseTsConfigResolution(...)`
- `parseTsconfig(...)`
- `resolveTsConfigExtendsChain(...)`
- `resolveTsconfigExtends(...)`
- `normalizePathAliasesFromConfigs(...)`
- `normalizeTypeScriptPathAliases(...)`
- `discoverTypeScriptProjects(...)`
- `buildTypeScriptImportGraph(...)`
- `mapTypeScriptImportsToGovernanceDependencies(...)`
- `deriveProjectTags(...)`

The root entrypoint also exports adapter option types, discovery result types,
diagnostic types, import graph types, workspace package types, and metadata
configuration types.

```ts
import {
  createGovernanceWorkspaceAdapter,
  detectTypeScriptWorkspace,
  type TypeScriptImportGraph,
  type TypeScriptProjectDiscoveryResult,
} from '@anarchitects/governance-adapter-typescript';
```

## Usage

### Adapter Mode

Use the default adapter when a host expects the Core
`GovernanceWorkspaceAdapter` contract:

```ts
import { createGovernanceWorkspaceAdapter } from '@anarchitects/governance-adapter-typescript';

const adapter = createGovernanceWorkspaceAdapter();
const result = adapter.loadWorkspace('/path/to/workspace');
```

### Composable Discovery Helpers

Use lower-level helpers when a host needs direct control over discovery steps:

```ts
import {
  buildTypeScriptImportGraph,
  DEFAULT_TYPESCRIPT_PROJECT_DISCOVERY_CONFIG,
  detectTypeScriptWorkspace,
  discoverTypeScriptProjects,
  mapTypeScriptImportsToGovernanceDependencies,
  parsePackageManagerWorkspace,
  parseTsconfig,
} from '@anarchitects/governance-adapter-typescript';

const detection = detectTypeScriptWorkspace(process.cwd());
const workspace = parsePackageManagerWorkspace(detection.workspaceRoot);
const discovery = discoverTypeScriptProjects(
  workspace,
  DEFAULT_TYPESCRIPT_PROJECT_DISCOVERY_CONFIG,
);
const tsconfig = parseTsconfig(detection.workspaceRoot);
const importGraph = buildTypeScriptImportGraph({
  workspaceRoot: detection.workspaceRoot,
  projects: discovery.projects,
  tsconfig,
});
const mapping = mapTypeScriptImportsToGovernanceDependencies({
  workspaceRoot: detection.workspaceRoot,
  projects: discovery.projects,
  importGraph,
});
```

## Configuration

`createGovernanceWorkspaceAdapter(...)` accepts optional configuration:

- `discoveryConfig` controls project root patterns.
- `packageGovernanceMetadataConfig` controls how governance metadata is read
  from package files.
- `tsconfigPath` selects a TypeScript config file relative to the workspace
  root.
- `adapterId` overrides the adapter identifier.

Default project patterns include common `packages`, `apps`, `libs`, `services`,
and `tools` layouts.

Default governance metadata is read from `package.json#governance`:

```json
{
  "governance": {
    "domain": "booking",
    "layer": "domain",
    "scope": "booking",
    "owner": "booking-team"
  }
}
```

Custom metadata mapping example:

```ts
import { createGovernanceWorkspaceAdapter } from '@anarchitects/governance-adapter-typescript';

const adapter = createGovernanceWorkspaceAdapter({
  packageGovernanceMetadataConfig: {
    sourceFile: 'package.json',
    path: ['anarchitects', 'governance'],
    fields: {
      domain: 'boundedContext',
      layer: 'architecturalLayer',
      scope: 'moduleScope',
      owner: 'owningTeam',
    },
  },
});
```

## Extension Points

The adapter is intended to be consumed by hosts and Core normalization helpers.
It does not load extensions and does not depend on
`@anarchitects/governance-extension-typescript`. Hosts compose adapters and
extensions through public Core contracts.

## Related Packages

- `@anarchitects/governance-core` owns the contracts emitted by this adapter.
- `@anarchitects/governance-cli` can load this adapter by package name.
- `@anarchitects/governance-extension-typescript` owns TypeScript-specific
  interpretation contributions and is separate from workspace extraction.

## Compatibility

The adapter emits:

- `GovernanceWorkspaceAdapterResult.nodes`
- `GovernanceWorkspaceAdapterResult.relations`
- `GovernanceWorkspaceAdapterResult.projects`
- `GovernanceWorkspaceAdapterResult.dependencies`
- `GovernanceWorkspaceAdapterResult.diagnostics`

`nodes` and `relations` are the canonical graph output. `projects` and
`dependencies` remain populated for consumers that need project/dependency
views.

## FAQ

### Does this adapter evaluate Governance rules?

No. It only discovers workspace facts and emits Core adapter results.

### Does this adapter require Nx?

No. It reads package-manager workspace files, TypeScript config files, package
metadata, and source imports directly.

### Does this adapter load the TypeScript extension?

No. Hosts decide which adapters and extensions to load.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
