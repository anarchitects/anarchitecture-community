# @anarchitects/governance-adapter-dbt

## Overview

`@anarchitects/governance-adapter-dbt` translates dbt discovery artifacts into
canonical `@anarchitects/governance-core` adapter results. It owns discovery,
loading, validation, normalization, and dbt metadata preservation. It does not
evaluate governance rules, compute scores, or implement dbt host behavior.

Package boundaries follow
[ADR 0001](../../../docs/adr/0001-governance-package-boundaries.md) and
[ADR 0003](../../../docs/adr/0003-governance-core-adapter-extension-host-boundaries.md).
Practical contributor guidance lives in
[`docs/governance-boundary-contributor-guide.md`](../../../docs/governance-boundary-contributor-guide.md).

## Public API

Common exports include:

- `detectDbtProject`
- `resolveDbtProjectContext`
- `loadDbtArtifacts`
- `loadDbtManifest`
- `loadDbtProjectConfig`
- `validateDbtManifest`
- `normalizeDbtArtifacts`
- `DBT_ADAPTER_VALIDATION_MODES`
- `isDbtAdapterValidationMode`
- `DBT_GOVERNANCE_ADAPTER_ID`
- `dbtGovernanceAdapterMetadata`

Relevant types include:

- `DbtGovernanceAdapterInput`
- `DbtArtifactPaths`
- `DbtAdapterOptions`
- `DbtAdapterResult`
- `DbtAdapterDiagnostic`
- `DbtArtifacts`
- `DbtManifest`
- `DbtProjectConfig`

## Usage

```ts
import {
  detectDbtProject,
  loadDbtArtifacts,
  normalizeDbtArtifacts,
  type DbtAdapterResult,
  type DbtGovernanceAdapterInput,
} from '@anarchitects/governance-adapter-dbt';

const input: DbtGovernanceAdapterInput = {
  paths: {
    projectDir: '/repo/analytics',
    dbtProjectPath: '/repo/analytics/dbt_project.yml',
    manifestPath: '/repo/analytics/target/manifest.json',
  },
  options: {
    validationMode: 'strict',
  },
};

const detected = detectDbtProject(input);
if (!detected.context) {
  throw new Error('dbt project could not be resolved');
}

const loaded = loadDbtArtifacts(detected.context);
if (!loaded.artifacts) {
  throw new Error('dbt artifacts could not be loaded');
}

const result: DbtAdapterResult = normalizeDbtArtifacts(
  detected.context,
  loaded.artifacts,
);

console.log(result.workspaceName);
console.log(result.nodes?.map((node) => node.id));
console.log(result.relations?.map((relation) => relation.id));
console.log(result.extensions?.['governance-extension:dbt']);
```

## Output Contract

`DbtAdapterResult` extends `GovernanceWorkspaceAdapterResult` from
`@anarchitects/governance-core`.

The canonical adapter output is:

- `workspaceId`, `workspaceName`, `workspaceRoot`
- `nodes`
- `relations`
- `capabilities`
- `diagnostics`
- `metadata`
- `metadata.dbt`
- `extensions`

Canonical governance facts stay in first-class Core fields when they are
genuinely generic:

- `classification.domain`
- `classification.layer`
- `classification.scope`
- `ownership`
- generic node kinds such as `project` and `resource`
- generic relation kinds such as `dependency` and `traceability`

dbt-specific artifact facts are emitted through the
`governance-extension:dbt` model expansion surface owned by
`@anarchitects/governance-extension-dbt`. The adapter emits those envelopes by
protocol shape only:

- `extensionId`
- `contractVersion`
- `data`
- optional `diagnostics`
- optional `metadata`

The adapter is responsible for deterministic extraction and normalization, not
for dbt semantic interpretation. Validation, versioning, and semantic
ownership remain with the dbt extension.

## Input Contract

Hosts and runtimes must pass explicit local paths. Supported path inputs are:

- `projectDir`
- `dbtProjectPath`
- `manifestPath`
- `catalogPath`
- `runResultsPath`
- `sourcesPath`

Options:

- `validationMode: 'strict' | 'lenient'`

Rules:

- either `projectDir` or `dbtProjectPath` must be provided
- if `manifestPath` is omitted, the adapter resolves
  `projectDir/target/manifest.json`
- `catalog.json`, `run_results.json`, and `sources.json` are optional and do
  not change the canonical Core contract

## Boundary Guidance

The dbt adapter owns:

- dbt project detection
- artifact loading and validation
- normalization of generic governance facts into canonical Core fields
- projection of dbt-specific facts into the dbt extension expansion surface
  using Core-owned generic model expansion envelopes

The dbt adapter does not own:

- dbt governance interpretation
- dbt-specific rules, metrics, diagnostics, or recommendations
- runtime composition
- host UX, CI orchestration, or dbt command execution

Adapter contributor rules:

- do not import `@anarchitects/governance-extension-dbt` at runtime
- do not add a runtime dependency on the dbt extension package
- do not call extension factory helpers from the adapter
- emit dbt extension data through Core-owned generic envelope contracts

Future `@anarchitects/governance-runtime-dbt` should compose:

- canonical governance profile config
- dbt adapter config
- dbt extension config
- runtime invocation context

Future dbt host packages should own:

- dbt-native UX and commands
- artifact lifecycle orchestration
- environment setup and CI ergonomics
- human-facing reporting

They should route configuration to the canonical profile, adapter, and
extension layers instead of collapsing everything into one profile surface.

## Flow Example

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

In that flow:

- dbt artifacts enter through adapter/runtime config
- canonical ownership, domain, layer, and scope land in Core fields
- dbt artifact identity, validation, docs, and lineage details land in the dbt
  extension expansion
- `@anarchitects/governance-extension-dbt` performs dbt-specific interpretation

## Related Packages

- `@anarchitects/governance-core` owns the canonical node/relation contracts
  emitted by this adapter.
- `@anarchitects/governance-extension-dbt` interprets dbt-specific expansion
  data and emits canonical findings, signals, measurements, and
  recommendations. Hosts that need that interpretation install the extension;
  the adapter itself does not depend on the extension runtime package.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
