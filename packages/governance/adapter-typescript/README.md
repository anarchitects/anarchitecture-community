# `@anarchitects/governance-adapter-typescript`

Platform-independent TypeScript workspace discovery and normalization for Governance.

## Overview

`@anarchitects/governance-adapter-typescript` reads a TypeScript-oriented workspace as plain files and maps the result into contracts owned by `@anarchitects/governance-core`.

The package focuses on discovery and normalization, not on owning the canonical Governance model. It is intended for hosts that need to inspect a TypeScript workspace from repository files and then feed the normalized result into Governance Core.

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
- external project-graph APIs
- framework-specific metadata extraction
- plugin runtime behavior
- executor or generator ownership

## Supported Assumptions

The current implementation assumes:

- workspace detection based on plain package-manager files such as `pnpm-workspace.yaml` and `package.json#workspaces`
- `tsconfig` parsing through root `tsconfig.json`, `tsconfig.base.json`, and deterministic `extends` chains
- static analysis of relative imports, package-name imports, `compilerOptions.paths`, `baseUrl`, re-exports, and string-literal dynamic imports
- project discovery from package-manager workspace roots

## Public API

The public package surface is intentionally adapter-oriented:

```ts
import {
  buildTypeScriptImportGraph,
  createGovernanceWorkspaceAdapter,
  createTypeScriptWorkspaceAdapter,
  detectTypeScriptWorkspace,
  discoverTypeScriptProjects,
  deriveProjectTags,
  mapTypeScriptImportsToGovernanceDependencies,
  normalizeTypeScriptPathAliases,
  parsePackageManagerWorkspace,
  parseTsconfig,
  parseTsConfigResolution,
  resolveTsconfigExtends,
  resolveWorkspacePackages,
  type TsConfigResolutionModel,
  type TypeScriptImportGraph,
  type TypeScriptProjectDiscoveryResult,
  type TypeScriptWorkspaceDetectionResult,
  type WorkspacePackageResolution,
} from '@anarchitects/governance-adapter-typescript';
```

The root export currently includes:

- `createTypeScriptWorkspaceAdapter(...)`
- `createGovernanceWorkspaceAdapter(...)`
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
- exported adapter result and diagnostic types from `types.ts`

The current API is a set of composable adapter primitives. It does not expose a single all-in-one host runner.

Parity already covered inside this package includes:

- workspace detection and probe-style support heuristics
- package-manager workspace parsing
- TypeScript project discovery and tag derivation
- `tsconfig` / path-alias resolution
- static import graph extraction
- normalization into Governance Core adapter result inputs

The package-root API now exposes the exact reusable parity helpers that host
packages can consume directly:

- `detectTypeScriptWorkspace(...)`
- `parseTsconfig(...)`
- `resolveTsconfigExtends(...)`
- `normalizeTypeScriptPathAliases(...)`
- `parsePackageManagerWorkspace(...)`
- `resolveWorkspacePackages(...)`
- `discoverTypeScriptProjects(...)`
- `buildTypeScriptImportGraph(...)`
- `mapTypeScriptImportsToGovernanceDependencies(...)`

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
  parseTsconfig,
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
const tsconfig = parseTsconfig(detection.workspaceRoot);
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

## Package Governance Metadata

The adapter can read governance metadata from each discovered package
`package.json` and merge it into the discovered `GovernanceProjectInput`.

### Default `package.json` Shape

By default, metadata is read from `package.json#governance`.

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

### Configurable Metadata Path

The default metadata path is:

- `governance`

You can configure a nested path, for example:

- `anarchitects.governance`

### Configurable Field Mapping

Default field mapping:

- `domain -> domain`
- `layer -> layer`
- `scope -> scope`
- `owner -> owner`

Custom field mapping example:

- `domain -> boundedContext`
- `layer -> architecturalLayer`
- `scope -> moduleScope`
- `owner -> owningTeam`

### Mapping Into `GovernanceProjectInput`

Extracted metadata is mapped as follows:

- metadata `domain` -> `project.domain`
- metadata `layer` -> `project.layer`
- metadata `scope` -> `project.scope`
- metadata `owner` -> `project.metadata.owner`

### Generated Tags

After governance values are resolved, tags are generated from:

- `domain:<value>`
- `layer:<value>`
- `scope:<value>`

`owner` is stored in `project.metadata.owner` and is not converted into a tag.

### Precedence Rules

Resolution is deterministic:

- package metadata overrides discovery-derived `domain`, `layer`, and `scope`
  when metadata values are present
- discovery-derived values remain fallback when package metadata is absent
- partial package metadata overrides only the fields that are present
- generated governance tags reflect the final resolved
  `domain`/`layer`/`scope` values

### Diagnostics Behavior

The adapter reports deterministic diagnostics for metadata problems while still
returning discovery results where possible.

- invalid metadata structures produce diagnostics
- invalid metadata paths produce diagnostics
- invalid field mappings produce diagnostics
- discovery continues where possible, including when a package has metadata
  diagnostics
- packages without governance metadata are valid and do not emit metadata
  diagnostics

### Configuration Examples

Default configuration:

```ts
import { createGovernanceWorkspaceAdapter } from '@anarchitects/governance-adapter-typescript';

const adapter = createGovernanceWorkspaceAdapter();
```

Custom metadata path:

```ts
import { createGovernanceWorkspaceAdapter } from '@anarchitects/governance-adapter-typescript';

const adapter = createGovernanceWorkspaceAdapter({
  packageGovernanceMetadataConfig: {
    sourceFile: 'package.json',
    path: ['anarchitects', 'governance'],
    fields: {
      domain: 'domain',
      layer: 'layer',
      scope: 'scope',
      owner: 'owner',
    },
  },
});
```

Custom field mapping:

```ts
import { createGovernanceWorkspaceAdapter } from '@anarchitects/governance-adapter-typescript';

const adapter = createGovernanceWorkspaceAdapter({
  packageGovernanceMetadataConfig: {
    sourceFile: 'package.json',
    path: ['governance'],
    fields: {
      domain: 'boundedContext',
      layer: 'architecturalLayer',
      scope: 'moduleScope',
      owner: 'owningTeam',
    },
  },
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

`@anarchitects/governance-adapter-typescript` is framework-independent.

That means:

- no framework-specific devkit dependency
- no framework-specific CLI dependency
- no external project-graph loading dependency
- no framework plugin runtime assumptions
- no executor or generator ownership

The package reads repository files directly and stays usable in plain TypeScript or mixed monorepo environments.

For detailed package-boundary rules and the adapter ownership model, see
[ADR 0001: Governance Package Boundaries for Core, CLI, Adapters, and Extensions](../../../docs/adr/0001-governance-package-boundaries.md).

## Related Packages

- `@anarchitects/governance-core` owns the canonical Governance contracts and deterministic evaluation logic
- `@anarchitects/governance-cli` is a separate host/runtime package and should not be treated as part of this adapter’s public API
