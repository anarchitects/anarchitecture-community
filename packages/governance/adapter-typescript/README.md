# @anarchitects/governance-adapter-typescript

## Overview

`@anarchitects/governance-adapter-typescript` discovers facts from a
TypeScript-oriented workspace and emits canonical
`@anarchitects/governance-core` adapter results. It reads repository files
directly and maps discovered packages, imports, path aliases, tags, metadata,
and diagnostics into Core-owned contracts.

Use this package when you need Governance workspace facts from a TypeScript,
JavaScript, or mixed monorepo without depending on a framework-specific project
graph.

Package boundaries follow
[ADR 0001](../../../docs/adr/0001-governance-package-boundaries.md).

## Key Concepts

- Workspace detection identifies whether a directory contains TypeScript
  workspace indicators.
- Package-manager workspace parsing resolves package roots from
  `pnpm-workspace.yaml` and `package.json#workspaces`.
- Package and module discovery maps workspace roots into canonical Governance
  nodes.
- `tsconfig` parsing resolves base config files, `baseUrl`, and path aliases.
- Import graph extraction captures static imports, re-exports, and
  string-literal dynamic imports.
- Dependency mapping converts discovered imports into canonical Governance
  relations.
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
  console.log(result.metadata);
}
```

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

## Output Contract

The adapter emits:

- `GovernanceWorkspaceAdapterResult.nodes`
- `GovernanceWorkspaceAdapterResult.relations`
- `GovernanceWorkspaceAdapterResult.capabilities`
- `GovernanceWorkspaceAdapterResult.diagnostics`
- `GovernanceWorkspaceAdapterResult.metadata`

TypeScript and package-manager details stay under namespaced metadata such as
`metadata.typescript` and `metadata.packageManager`.

## Usage

### Adapter Mode

```ts
import { createGovernanceWorkspaceAdapter } from '@anarchitects/governance-adapter-typescript';

const adapter = createGovernanceWorkspaceAdapter();
const result = adapter.loadWorkspace('/path/to/workspace');
```

### Composable Discovery Helpers

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

## Related Packages

- `@anarchitects/governance-core` owns the canonical node/relation contracts
  emitted by this adapter.
- `@anarchitects/governance-cli` can load this adapter by package name.
- `@anarchitects/governance-extension-typescript` owns TypeScript-specific
  interpretation contributions and is separate from workspace extraction.

## FAQ

### Does this adapter evaluate Governance rules?

No. It only discovers workspace facts and emits Core adapter results.

### Does this adapter require Nx?

No. It reads package-manager workspace files, TypeScript config files, package
metadata, and source imports directly.
