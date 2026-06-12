# @anarchitects/governance-core

## Overview

`@anarchitects/governance-core` defines the canonical Governance model for the
community package set. The normalized workspace shape is
`GovernanceWorkspace` with `nodes` and `relations`; adapters emit those facts,
Core evaluates them, and hosts render the resulting artifacts.

Use this package when you are building:

- a Governance adapter that emits canonical workspace facts
- a host that evaluates, reports, or automates Governance assessments
- an extension that contributes technology-specific interpretation
- tooling that needs stable Governance contracts without depending on a
  concrete adapter or CLI

Package boundaries follow
[ADR 0001](../../../docs/adr/0001-governance-package-boundaries.md) and
[ADR 0003](../../../docs/adr/0003-governance-core-adapter-extension-host-boundaries.md).

## Key Concepts

- `GovernanceWorkspace` is the normalized inventory boundary with `id`, `name`,
  `root`, `nodes`, `relations`, `capabilities`, `diagnostics`, and `metadata`.
- `GovernanceNodeInput` and `GovernanceRelationInput` are adapter-facing input
  contracts for canonical graph data.
- `GovernanceNode` and `GovernanceRelation` are the normalized runtime
  contracts used by rules, metrics, health, and assessment assembly.
- `GovernanceRuntimeReference` uses canonical references such as `nodeId`,
  `relationId`, `relatedNodeIds`, and `relatedRelationIds`.
- `GovernanceWorkspaceAdapterResult` is the adapter result shape consumed by
  normalization helpers and hosts.
- `GovernanceDiagnostic` represents adapter-owned or host-owned diagnostics.
- `GovernanceProfile` is a canonical policy contract only. Adapter config,
  extension config, and host runtime config stay outside Core.

## Installation

```bash
npm install @anarchitects/governance-core
```

## Quick Start

```ts
import {
  buildGovernanceWorkspace,
  type GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

const adapterResult: GovernanceWorkspaceAdapterResult = {
  workspaceId: 'example',
  workspaceName: 'Example Workspace',
  workspaceRoot: '.',
  nodes: [
    {
      id: 'package:api',
      name: 'api',
      kind: 'service',
      technology: 'typescript',
      sourceSystem: 'pnpm',
      root: 'packages/api',
      path: 'packages/api',
      tags: ['domain:commerce'],
      metadata: {},
    },
  ],
  relations: [
    {
      sourceNodeId: 'package:api',
      targetNodeId: 'package:shared',
      kind: 'dependency',
      metadata: {},
    },
  ],
};

const workspace = buildGovernanceWorkspace(adapterResult);

console.log(workspace.nodes[0].id);
console.log(workspace.relations[0].kind);
```

## Public API

Import from the package root:

```ts
import {
  buildGovernanceWorkspace,
  buildGovernanceAssessment,
  buildGovernanceAssessmentArtifacts,
  calculateGovernanceHealth,
  calculateGovernanceMetrics,
  coreBuiltInRulePack,
  evaluateRulePack,
  normalizeGovernanceProfile,
  registerLoadedGovernanceExtensions,
  type GovernanceWorkspace,
  type GovernanceWorkspaceAdapter,
  type GovernanceWorkspaceAdapterProbeResult,
  type GovernanceWorkspaceAdapterResult,
  type GovernanceNode,
  type GovernanceRelation,
  type GovernanceNodeInput,
  type GovernanceRelationInput,
  type GovernanceRuntimeReference,
  type GovernanceDiagnostic,
  type GovernanceExtensionDefinition,
} from '@anarchitects/governance-core';
```

The public surface includes:

- adapter contracts and workspace normalization helpers
- canonical graph contracts for workspaces, nodes, relations, diagnostics, and
  runtime references
- profile, rule, finding, signal, metric, score, health, snapshot, exception,
  and assessment contracts
- deterministic evaluation helpers such as `evaluateRulePack(...)`,
  `buildGovernanceAssessment(...)`, and
  `buildGovernanceAssessmentArtifacts(...)`
- extension contracts, capability contracts, diagnostics, and runtime helpers
- deterministic AI request, context, payload, and summary helpers

Internal source paths are not part of the public API.

## Responsibilities

This package owns:

- the canonical `nodes` and `relations` workspace model
- adapter result contracts and workspace normalization
- deterministic rule evaluation, metrics, health, and assessment assembly
- generic built-in rule packs
- extension contracts, capability contracts, and registration helpers
- deterministic AI handoff payload builders over canonical assessment data

This package does not own:

- concrete adapter implementations
- TypeScript, Nx, dbt, GitHub, Atlassian, or other platform extraction logic
- CLI argument parsing or process exit behavior
- report rendering or dashboard presentation
- extension package implementations
- host-specific configuration discovery
- adapter-specific extraction or normalization configuration
- extension-specific interpretation configuration

## Boundary Model

Core owns the canonical baseline model and generic Governance semantics. The
canonical `GovernanceProfile` is intentionally limited to policy that applies
across ecosystems, such as layer order, allowed dependencies, ownership
requirements, health thresholds, and metric weights.

Adapters discover source-system facts and normalize only genuinely canonical
facts into Core contracts. Extensions own any explicit model expansion beyond
the canonical baseline. Hosts orchestrate those layers and route configuration
to the right owner instead of collapsing adapter or extension options into the
Core profile.

When technology-specific or source-specific facts still need to travel through
Core contracts, they should remain opaque in `metadata`, capability payloads,
or extension host `options` until a stable generic Core contract exists.

## Usage

### Adapter Results

Adapters should emit `GovernanceWorkspaceAdapterResult` with canonical `nodes`
and `relations`. `buildGovernanceWorkspace(...)` normalizes those inputs and
applies deterministic defaults.

### Assessment Artifacts

Hosts can pass normalized workspaces into Core helpers to produce findings,
signals, measurements, recommendations, health scores, and complete assessment
artifacts.

### Built-in Documentation Semantics

Core includes a built-in `documentation-gap` rule. It evaluates canonical
`GovernanceNode` metadata and emits deterministic node-referenced warning
violations when required documentation metadata is missing.

By default, documentation presence is determined from `metadata.documentation`
and a node counts as documented when that value is `true` or `'true'`. The
`documentation-completeness` metric uses the same predicate, so low
documentation scores and `documentation-gap` findings stay aligned.

Hosts can configure the rule through the normal profile rule map:

```ts
const profile = {
  // ...
  rules: {
    'documentation-gap': {
      enabled: true,
      severity: 'warning',
      options: {
        metadataKeys: ['documentation'],
        requireAny: true,
      },
    },
  },
};
```

Set `enabled: false` to suppress `documentation-gap` findings without disabling
the underlying documentation completeness metric.

### Extensions

Hosts register extension definitions through Core runtime helpers. Extensions
consume public Core contracts only and should emit canonical node/relation
references. Extension-owned expansion data may ride along in metadata,
capabilities, and host-routed extension options, but its schema and semantics
remain owned by the extension rather than Core.

## Related Packages

- `@anarchitects/governance-cli` provides the `agov` executable and host APIs.
- `@anarchitects/governance-adapter-typescript` discovers TypeScript workspace
  facts and emits canonical adapter results.
- `@anarchitects/governance-extension-typescript` contributes TypeScript
  interpretation over canonical Core contracts.

## FAQ

### Does Core discover workspaces?

No. Adapters discover workspace facts and emit Core-owned contracts.

### Does Core render CLI or UI reports?

No. Core provides renderer-agnostic assessment data. Hosts and reporting
packages decide how to present that data.

### Can extensions depend on adapters?

No. Extensions should depend on public Core contracts only. Hosts compose
adapters and extensions.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
