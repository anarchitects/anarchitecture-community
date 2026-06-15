# Governance Boundary Contributor Guide

Authoritative decision record:
[ADR 0003: Governance Boundaries for Canonical Core, Adapters, Extensions, and Hosts](./adr/0003-governance-core-adapter-extension-host-boundaries.md)

Use this guide for practical implementation rules. Keep ADR 0003 as the
authoritative architectural source of truth.

## Boundary Model

Governance uses four ownership layers:

- `@anarchitects/governance-core` owns canonical contracts, canonical profile
  policy contracts, generic extension runtime contracts, generic
  extension-owned model expansion envelope contracts, and deterministic
  evaluation semantics.
- governance adapters own source extraction, parsing, normalization of
  genuinely generic facts into Core fields, and emission of extension-owned
  expansion envelopes.
- governance extensions own technology-specific interpretation, expansion
  validation, contract versioning, diagnostics, rule packs, signals, metrics,
  recommendations, and optional extension config.
- governance hosts own orchestration, package loading, config routing, runtime
  context, and output/reporting behavior.

## Core Rules

`@anarchitects/governance-core` owns:

- canonical governance model contracts
- canonical profile policy contracts
- generic extension runtime contracts
- generic extension-owned model expansion envelope contracts
- deterministic governance evaluation semantics

`@anarchitects/governance-core` must not own:

- TypeScript-specific fields
- dbt-specific fields
- Angular-specific fields
- GitHub-specific fields
- Nx-specific fields
- adapter extraction config
- extension interpretation config
- host or runtime orchestration config

## Adapter Rules

Adapters own extraction and normalization.

Adapters may:

- read source-system facts
- normalize genuinely generic facts into Core-owned canonical fields
- emit extension-owned expansion envelopes using generic Core contracts
- preserve source provenance and evidence

Adapters must not:

- own extension semantic interpretation
- import concrete extension implementation packages at runtime
- runtime-depend on concrete extension packages
- call extension factory functions
- put technology-specific config into the canonical profile
- move technology-specific payload fields into Core canonical contracts

`#371` rule:
Adapters may emit extension-owned data by protocol shape, but they must build
generic `GovernanceExtensionModelExpansion<TData>` envelopes through
`@anarchitects/governance-core` contracts only.

## Extension Rules

Extensions own:

- technology-specific interpretation
- extension-owned model expansion validation
- extension-owned contract versioning
- extension-owned diagnostics, rule packs, signals, metrics, and
  recommendations
- optional extension config

Extensions must not:

- own source artifact loading
- own adapter extraction
- own host orchestration
- require adapter-private implementation details
- require Core to become technology-specific

## Host Rules

Hosts own orchestration and routing.

Hosts may:

- load canonical profiles
- load adapters
- load extensions
- route adapter config to adapter factories
- route extension config to extension factories
- pass host or runtime context separately
- compose Core, adapters, and extensions

Hosts must not:

- put adapter config into canonical profile policy
- put extension config into canonical profile policy
- duplicate Core rules or evaluation logic
- duplicate adapter extraction logic
- duplicate extension interpretation logic

The current standalone CLI is a host. Future dbt-specific runtimes or hosts
should follow the same ownership split.

For the implemented dbt-native host behavior, see
[`docs/governance/dbt-governance-host.md`](./governance/dbt-governance-host.md).

## Config Placement

Canonical profile:

- generic governance policy only
- technology-neutral rules, policy, and assessment configuration

Adapter config:

- extraction, discovery, and normalization options
- source artifact paths
- parser or discovery options
- adapter-specific validation modes

Extension config:

- interpretation options
- technology-specific diagnostics, signals, metrics, and recommendation
  provider options
- extension-owned semantic tuning

Host or runtime config:

- root paths
- profile path
- package loading
- adapter selection
- extension selection
- output, reporting, and CI invocation behavior

## Extension-Owned Expansion Envelopes

Core owns the envelope shape:

```ts
type GovernanceExtensionModelExpansion<TData> = {
  extensionId: string;
  contractVersion: string;
  data: TData;
  diagnostics?: readonly GovernanceExtensionContractIssue[];
  metadata?: Record<string, unknown>;
};
```

Practical rules:

- Core owns the envelope and generic carriers such as `workspace.extensions`.
- The extension owns the payload schema, semantics, validation, and versioning.
- The adapter may emit the payload by agreed protocol shape.
- The host may route extension config separately.
- Core treats the extension-owned `data` payload as opaque unless a generic
  Core contract explicitly says otherwise.

## TypeScript Example

Canonical profile:

```json
{
  "name": "frontend-policy",
  "rules": {
    "layering": {
      "enabled": true
    }
  }
}
```

Host config:

```json
{
  "profile": "./governance.profile.json",
  "adapter": "@anarchitects/governance-adapter-typescript",
  "extensions": ["@anarchitects/governance-extension-typescript"],
  "adapterOptions": {
    "@anarchitects/governance-adapter-typescript": {
      "discoveryConfig": {
        "projects": [{ "pattern": "packages/*" }]
      }
    }
  },
  "extensionOptions": {
    "@anarchitects/governance-extension-typescript": {
      "signals": {
        "importGraph": {
          "enabled": true
        }
      }
    }
  }
}
```

Adapter-emitted extension envelope:

```ts
import type { GovernanceExtensionModelExpansion } from '@anarchitects/governance-core';

const expansion: GovernanceExtensionModelExpansion<{
  kind: 'node';
  technology: 'typescript';
  nodeKind: 'workspace-project';
}> = {
  extensionId: 'governance-extension:typescript',
  contractVersion: '1',
  data: {
    kind: 'node',
    technology: 'typescript',
    nodeKind: 'workspace-project',
  },
};
```

Contributor note:
The adapter emits the TypeScript payload shape without importing
`@anarchitects/governance-extension-typescript`.

## dbt Example

Canonical profile:

```json
{
  "name": "dbt-policy",
  "rules": {
    "ownership-required": {
      "enabled": true
    }
  }
}
```

Runtime or host config:

```json
{
  "profile": "./governance.profile.json",
  "adapter": "@anarchitects/governance-adapter-dbt",
  "extensions": ["@anarchitects/governance-extension-dbt"],
  "adapterOptions": {
    "@anarchitects/governance-adapter-dbt": {
      "paths": {
        "projectDir": "./analytics",
        "manifestPath": "./analytics/target/manifest.json"
      },
      "validationMode": "strict"
    }
  },
  "extensionOptions": {
    "@anarchitects/governance-extension-dbt": {
      "signals": {},
      "metrics": {}
    }
  }
}
```

dbt adapter envelope:

```ts
import type { GovernanceExtensionModelExpansion } from '@anarchitects/governance-core';

const expansion: GovernanceExtensionModelExpansion<{
  kind: 'workspace';
  technology: 'dbt';
  projectName: string;
}> = {
  extensionId: 'governance-extension:dbt',
  contractVersion: '1',
  data: {
    kind: 'workspace',
    technology: 'dbt',
    projectName: 'analytics',
  },
};
```

Contributor notes:

- The dbt adapter emits dbt extension-owned envelopes without importing
  `@anarchitects/governance-extension-dbt`.
- A future `governance-runtime-dbt` should compose Core, the dbt adapter, and
  the dbt extension.
- A future dbt host should own dbt-native UX and artifact lifecycle
  orchestration instead of moving those concerns into Core, the adapter, or
  the extension.
