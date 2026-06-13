# @anarchitects/governance-extension-dbt

## Overview

`@anarchitects/governance-extension-dbt` interprets canonical dbt workspace
data from `@anarchitects/governance-core`. It consumes `workspace.nodes` and
`workspace.relations`, reads dbt-specific facts from the
`governance-extension:dbt` model expansion contract, and emits deterministic
diagnostics, signals, rule results, measurements, and recommendations.

Package boundaries follow
[ADR 0001](../../../docs/adr/0001-governance-package-boundaries.md) and
[ADR 0003](../../../docs/adr/0003-governance-core-adapter-extension-host-boundaries.md).
Practical contributor guidance lives in
[`docs/governance-boundary-contributor-guide.md`](../../../docs/governance-boundary-contributor-guide.md).

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
- the dbt extension-owned expansion envelope on workspace, node, and relation
  carriers
- legacy metadata fallback only where required for compatibility fixtures and
  tests

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

## dbt-Owned Model Expansions

This package owns the dbt expansion payload schema carried through Core's
generic `extensions` envelope:

```ts
{
  extensionId: 'governance-extension:dbt',
  contractVersion: '1',
  data: {
    kind: 'node' | 'relation' | 'workspace' | 'runtime-context',
    technology: 'dbt',
    // dbt-owned fields
  },
}
```

Ownership rules:

- Core owns the generic carrier and envelope shape.
- This package owns dbt payload validation and versioning.
- The dbt adapter may emit the payload by protocol shape without importing the
  extension runtime.
- Hosts route dbt-specific interpretation config separately through extension
  options or `GovernanceExtensionHostContext.options`.

## Related Packages

- `@anarchitects/governance-core` owns the canonical node/relation contracts.
- `@anarchitects/governance-adapter-dbt` emits canonical nodes/relations plus
  the dbt expansion data consumed by this extension.

## Boundary Guidance

This extension owns:

- dbt-specific model expansion validation and versioning
- dbt-specific metadata resolution
- dbt-specific diagnostics, signals, rule packs, metrics, and recommendations
- interpretation of normalized dbt artifact facts

This extension does not own:

- raw dbt artifact loading
- adapter extraction
- runtime composition
- dbt host concerns such as command UX, CI orchestration, or reporting shells
- adapter-private implementation details

Future `@anarchitects/governance-runtime-dbt` should compose Core, the dbt
adapter, and this extension. Future dbt host packages should own dbt-native
execution flow and route:

- canonical governance profile config
- dbt adapter config
- dbt extension config
- runtime invocation context

The canonical Core profile remains policy-only. dbt-specific adapter and
extension settings belong outside that profile.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
