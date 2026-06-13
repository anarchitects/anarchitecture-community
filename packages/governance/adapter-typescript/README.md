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
[ADR 0001](../../../docs/adr/0001-governance-package-boundaries.md) and
[ADR 0003](../../../docs/adr/0003-governance-core-adapter-extension-host-boundaries.md).
Practical contributor guidance lives in
[`docs/governance-boundary-contributor-guide.md`](../../../docs/governance-boundary-contributor-guide.md).

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

The adapter runtime depends on `@anarchitects/governance-core` and local
parsing libraries only. Hosts that validate or interpret TypeScript-specific
expansion data also need `@anarchitects/governance-extension-typescript`.

## Quick Start

```ts
import { createGovernanceWorkspaceAdapter } from '@anarchitects/governance-adapter-typescript';

const adapter = createGovernanceWorkspaceAdapter();
const probe = adapter.probe(process.cwd());

if (probe.supported) {
  const result = adapter.loadWorkspace(process.cwd());

  console.log(result.nodes);
  console.log(result.relations);
  console.log(result.extensions);
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
- `GovernanceWorkspaceAdapterResult.extensions`

Canonical governance facts are emitted as first-class Core fields when they are
genuinely generic:

- `classification.domain`
- `classification.layer`
- `classification.scope`
- `ownership`
- canonical node and relation kinds such as `project`, `resource`,
  `dependency`, and `traceability`

TypeScript-specific extraction facts are emitted through the
`governance-extension:typescript` model expansion surface owned by
`@anarchitects/governance-extension-typescript`. The adapter emits those
envelopes by protocol shape only:

- `extensionId`
- `contractVersion`
- `data`
- optional `diagnostics`
- optional `metadata`

Validation, versioning, and semantic interpretation remain extension-owned.
The adapter does not keep TypeScript semantics in canonical metadata as the
primary contract surface and does not import the TypeScript extension runtime.

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

### Discovery Rule Projections

Discovery rules can project canonical governance facts directly onto discovered
projects. Use `projection` for first-class classification such as `domain`,
`layer`, `scope`, project `kind`, adapter-specific `type`, and selected
discovery metadata. Keep `tags` as supplemental hints rather than the primary
classification mechanism.

```ts
import { createGovernanceWorkspaceAdapter } from '@anarchitects/governance-adapter-typescript';

const adapter = createGovernanceWorkspaceAdapter({
  discoveryConfig: {
    projects: [
      {
        pattern: 'apps/*',
        name: '{segment:1}',
        tags: ['type:app'],
        projection: {
          kind: 'application',
          type: 'frontend-app',
          domain: 'commerce',
          layer: 'app',
          scope: '{segment:1}',
          metadata: {
            runtime: 'browser',
          },
        },
      },
      {
        pattern: 'libs/*/*',
        name: '{segment:1}-{segment:2}',
        projection: {
          kind: 'library',
          domain: '{segment:1}',
          layer: '{segment:2}',
        },
      },
    ],
  },
});
```

Projection precedence is deterministic:

- The first matching discovery rule still wins for project identity.
- Within a matched rule, explicit `projection` values win over classification
  inferred from discovery tags.
- Package governance metadata still wins over discovery-derived defaults for
  `domain`, `layer`, `scope`, and ownership when both are present.

### Normalization Boundary

The adapter owns extraction and deterministic normalization only.

- Generic governance facts map into canonical Core fields.
- TypeScript-specific facts such as `tsconfig`, import evidence, package
  manager dependency details, and path alias resolution map into the
  TypeScript extension expansion surface using Core-owned generic model
  expansion envelopes.
- Adapter-specific extraction config remains adapter/host-owned and does not
  expand the canonical Governance profile.

Adapter contributor rules:

- do not import `@anarchitects/governance-extension-typescript` at runtime
- do not add a runtime dependency on the TypeScript extension package
- do not call extension factory helpers from the adapter
- emit TypeScript expansion data through Core-owned generic envelope contracts

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
