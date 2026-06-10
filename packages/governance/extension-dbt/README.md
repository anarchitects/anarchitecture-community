# @anarchitects/governance-extension-dbt

## Overview

`@anarchitects/governance-extension-dbt` interprets canonical dbt workspace
data from `@anarchitects/governance-core`. It consumes `workspace.nodes` and
`workspace.relations`, reads dbt-specific facts from namespaced metadata such
as `metadata.dbt`, and emits deterministic diagnostics, signals, rule results,
measurements, and recommendations.

Package boundaries follow
[ADR 0001](../../../docs/adr/0001-governance-package-boundaries.md).

## Public API

Primary registration exports:

- `dbtGovernanceExtension`
- `governanceDbtExtension`
- `createDbtGovernanceExtension(...)`
- `registerDbtGovernanceExtension(...)`
- `registerDbtGovernanceExtensionContributions(...)`

Built-in providers and helpers include:

- diagnostics via `dbtGovernanceDiagnosticsProvider` and
  `buildDbtGovernanceDiagnostics(...)`
- signals via `dbtGovernanceSignalProvider` and
  `buildDbtGovernanceSignals(...)`
- rule packs via `dbtArchitectureBasicRulePack` and
  `evaluateDbtArchitectureViolations(...)`
- metrics via `dbtGovernanceMetricProvider` and
  `buildDbtGovernanceMetrics(...)`
- recommendations via `dbtGovernanceRecommendationProvider` and
  `buildDbtGovernanceRecommendations(...)`
- resolvers such as `resolveDbtGovernanceMetadata(...)`,
  `resolveDbtLayer(...)`, `resolveDbtDomain(...)`, and
  `resolveDbtPublicInterface(...)`

## Canonical Input

This package consumes normalized workspace input through Core extension
contracts:

- `workspace.id`
- `workspace.name`
- `workspace.root`
- `workspace.nodes`
- `workspace.relations`
- `profile`
- `context`

The extension selects dbt artifacts from canonical node and relation data using
fields such as:

- `node.technology === 'dbt'`
- `node.sourceSystem === 'dbt'`
- dbt node kinds such as `dbt-model`, `dbt-source`, and `dbt-test`
- dbt metadata under `node.metadata.dbt` and `relation.metadata.dbt`

## Canonical Output

Diagnostics, findings, signals, recommendations, and measurements use
canonical references. Typical references look like:

```ts
{
  reference: {
    nodeId: 'model.analytics.orders',
    relatedNodeIds: ['source.analytics.raw.orders'],
  },
}

{
  reference: {
    relationId: 'dbt:lineage:model.analytics.orders->source.analytics.raw.orders',
    relatedNodeIds: [
      'model.analytics.orders',
      'source.analytics.raw.orders',
    ],
    relatedRelationIds: [
      'dbt:lineage:model.analytics.orders->source.analytics.raw.orders',
    ],
  },
}
```

## Registration Example

```ts
import {
  DefaultGovernanceCapabilityRegistry,
  registerLoadedGovernanceExtensionsWithDiagnostics,
  type GovernanceExtensionHostContext,
} from '@anarchitects/governance-core';
import { dbtGovernanceExtension } from '@anarchitects/governance-extension-dbt';

const context: GovernanceExtensionHostContext = {
  workspaceRoot,
  profileName: 'dbt',
  options: {},
  inventory: workspace,
  capabilities: new DefaultGovernanceCapabilityRegistry(),
};

await registerLoadedGovernanceExtensionsWithDiagnostics(context, [
  {
    sourceSpecifier: '@anarchitects/governance-extension-dbt',
    moduleSpecifier: '@anarchitects/governance-extension-dbt',
    definition: dbtGovernanceExtension,
  },
]);
```

## Related Packages

- `@anarchitects/governance-core` owns the canonical node/relation contracts.
- `@anarchitects/governance-adapter-dbt` emits the dbt nodes and relations
  consumed by this extension.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
