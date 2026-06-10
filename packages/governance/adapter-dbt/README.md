# @anarchitects/governance-adapter-dbt

## Overview

`@anarchitects/governance-adapter-dbt` translates dbt discovery artifacts into
canonical `@anarchitects/governance-core` adapter results. It owns discovery,
loading, validation, normalization, and dbt metadata preservation. It does not
evaluate governance rules, compute scores, or implement dbt host behavior.

Package boundaries follow
[ADR 0001](../../../docs/adr/0001-governance-package-boundaries.md).

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
console.log(result.metadata?.dbt);
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

Representative dbt artifacts are emitted as canonical nodes such as
`dbt-project`, `dbt-model`, `dbt-source`, `dbt-seed`, `dbt-snapshot`,
`dbt-exposure`, `dbt-semantic-model`, `dbt-metric`, and `dbt-test`.

Representative dbt relationships are emitted as canonical relations such as
`lineage`, `dependency`, `tests`, `exposes`, and `uses-package`.

Technology-specific details stay under namespaced metadata such as
`metadata.dbt`.

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

## Related Packages

- `@anarchitects/governance-core` owns the canonical node/relation contracts
  emitted by this adapter.
- `@anarchitects/governance-extension-dbt` interprets dbt-specific metadata and
  emits canonical findings, signals, measurements, and recommendations.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
