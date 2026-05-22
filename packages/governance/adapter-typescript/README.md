# `@anarchitects/governance-adapter-typescript`

Platform-independent TypeScript workspace discovery and normalization for Governance.

## Overview

`@anarchitects/governance-adapter-typescript` reads a TypeScript-oriented workspace as plain files and maps the result into contracts owned by `@anarchitects/governance-core`.

The package focuses on discovery and normalization, not on owning the canonical Governance model. It is intended for hosts that need to inspect a TypeScript workspace outside Nx and then feed the normalized result into Governance Core.

## Responsibilities

This package is responsible for:

- detecting whether a repository looks like a supported TypeScript workspace
- parsing package-manager workspace configuration
- parsing `tsconfig.json` and `tsconfig.base.json` resolution state
- discovering TypeScript projects from workspace package roots
- building a static TypeScript import graph
- mapping discovered imports into Core-owned dependency inputs
- deriving project tags from naming and path rules

This package is not responsible for:

- CLI command behavior
- canonical Governance contracts
- Nx graph loading
- Nx metadata extraction
- Nx plugin runtime behavior
- Nx executors or generators

## Supported Assumptions

The current implementation assumes:

- workspace detection based on plain package-manager files such as `pnpm-workspace.yaml` and `package.json#workspaces`
- `tsconfig` parsing through root `tsconfig.json`, `tsconfig.base.json`, and deterministic `extends` chains
- static analysis of relative imports, package-name imports, `compilerOptions.paths`, `baseUrl`, re-exports, and string-literal dynamic imports
- project discovery from package-manager workspace roots rather than from Nx graph APIs

## Public API

The public package surface is intentionally adapter-oriented:

```ts
import {
  buildTypeScriptImportGraph,
  createTypeScriptWorkspaceAdapter,
  detectTypeScriptWorkspace,
  discoverTypeScriptProjects,
  deriveProjectTags,
  mapTypeScriptImportsToGovernanceDependencies,
  parsePackageManagerWorkspace,
  parseTsConfigResolution,
  type TsConfigResolutionModel,
  type TypeScriptImportGraph,
  type TypeScriptProjectDiscoveryResult,
  type TypeScriptWorkspaceDetectionResult,
  type WorkspacePackageResolution,
} from '@anarchitects/governance-adapter-typescript';
```

The root export currently includes:

- `createTypeScriptWorkspaceAdapter(...)`
- `detectTypeScriptWorkspace(...)`
- `parsePackageManagerWorkspace(...)`
- `parseTsConfigResolution(...)`
- `discoverTypeScriptProjects(...)`
- `buildTypeScriptImportGraph(...)`
- `mapTypeScriptImportsToGovernanceDependencies(...)`
- `deriveProjectTags(...)`
- exported adapter result and diagnostic types from `types.ts`

The current API is a set of composable adapter primitives. It does not expose a single all-in-one host runner.

## Usage

The typical workflow is:

1. detect a supported workspace
2. resolve workspace package roots
3. discover projects
4. resolve TypeScript path aliases
5. build a static import graph
6. map that graph into Core-owned dependency inputs

```ts
import {
  buildTypeScriptImportGraph,
  detectTypeScriptWorkspace,
  discoverTypeScriptProjects,
  mapTypeScriptImportsToGovernanceDependencies,
  parsePackageManagerWorkspace,
  parseTsConfigResolution,
} from '@anarchitects/governance-adapter-typescript';

const detection = detectTypeScriptWorkspace(process.cwd());

if (!detection.supported) {
  throw new Error('Unsupported TypeScript workspace.');
}

const workspacePackages = parsePackageManagerWorkspace(detection.workspaceRoot);
const projectDiscovery = discoverTypeScriptProjects({
  workspaceRoot: workspacePackages.workspaceRoot,
  packageRoots: workspacePackages.packageRoots,
});
const tsconfig = parseTsConfigResolution(detection.workspaceRoot);
const importGraph = buildTypeScriptImportGraph({
  workspaceRoot: detection.workspaceRoot,
  projects: projectDiscovery.projects,
  tsconfig,
});
const dependencyMapping = mapTypeScriptImportsToGovernanceDependencies({
  projects: projectDiscovery.projects,
  importGraph,
});
```

## Normalization into Governance Core

This adapter normalizes into `@anarchitects/governance-core` contracts rather than defining a parallel model.

In practice:

- project discovery produces `GovernanceProjectInput` values
- dependency mapping produces `GovernanceDependencyInput` values
- diagnostics align with Core-owned diagnostic shapes where the exported types reference them

Hosts can combine these results with Core-owned assessment, rule, signal, and extension APIs.

## Package Boundaries

`@anarchitects/governance-adapter-typescript` is explicitly non-Nx.

That means:

- no `@nx/devkit`
- no `nx`
- no Nx graph loading
- no Nx plugin runtime assumptions
- no executor or generator ownership

The package reads repository files directly and stays usable in plain TypeScript or mixed monorepo environments without requiring Nx.

## Related Packages

- `@anarchitects/governance-core` owns the canonical Governance contracts and deterministic evaluation logic
- `@anarchitects/governance-cli` is a separate host/runtime package and should not be treated as part of this adapter’s public API
