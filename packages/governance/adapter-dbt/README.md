# @anarchitects/governance-adapter-dbt

## Purpose

`@anarchitects/governance-adapter-dbt` translates dbt project and artifact
metadata into Core-compatible Governance workspace inputs.

It owns:

- discovery
- loading
- validation
- normalization
- metadata preservation

It does not decide whether the architecture is good or bad. It does not
evaluate governance rules, compute scores, generate recommendations, run dbt
commands, parse SQL/Jinja lineage, manage Node/npm runtime setup, or implement
Python host behavior.

Parent epic: `#143`

Related epics:

- `#144` `governance-extension-dbt`
- `#251` `governance-runtime-dbt`
- `#252` `governance-host-dbt`

## Location

- Package root: `packages/governance/adapter-dbt`
- Nx project name: `governance-adapter-dbt`
- npm package name: `@anarchitects/governance-adapter-dbt`

## Local Commands

Expected Nx commands:

- `nx build governance-adapter-dbt`
- `nx test governance-adapter-dbt`
- `nx lint governance-adapter-dbt`

In this workspace, run them via the package manager:

```bash
yarn nx build governance-adapter-dbt
yarn nx test governance-adapter-dbt
yarn nx lint governance-adapter-dbt
```

Adapter-level end-to-end coverage runs inside the normal Vitest target. There
is no separate `governance-adapter-dbt:e2e` target.

## Boundary

```text
Adapter = discovery, loading, validation, normalization, metadata preservation.
Extension = dbt-specific governance meaning.
Runtime = TypeScript composition boundary.
Host = dbt-native Python developer experience.
```

This package owns only the `Adapter` line.

## Non-Goals

- Evaluating governance rules
- Computing governance scores
- Generating recommendations
- Interpreting metadata as governance compliance
- Deciding whether the architecture is good or bad
- Running dbt commands
- Parsing SQL or Jinja lineage
- Managing Node/npm runtime setup
- Implementing Python host behavior
- Depending on `@anarchitects/governance-extension-dbt`
- Depending on `@anarchitects/governance-runtime-dbt`
- Depending on `@anarchitects/governance-host-dbt`

## Public API

Public exports used in the current implementation:

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

Relevant public types:

- `DbtGovernanceAdapterInput`
- `DbtArtifactPaths`
- `DbtAdapterOptions`
- `DbtAdapterResult`
- `DbtAdapterDiagnostic`
- `DbtProjectDetectionResult`
- `DbtArtifactLoadResult`
- `DbtArtifacts`
- `DbtManifest`
- `DbtProjectConfig`
- `ResolvedDbtArtifactPaths`

## Usage

Minimal TypeScript example using the actual exported API:

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
    catalogPath: '/repo/analytics/target/catalog.json',
    runResultsPath: '/repo/analytics/target/run_results.json',
    sourcesPath: '/repo/analytics/target/sources.json',
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
console.log(result.dependencies?.map((edge) => edge.sourceProjectId));
console.log(result.diagnostics);
```

## Input Contract

Hosts and runtimes must pass explicit local paths. The adapter does not depend
on implicit shell state or `process.cwd()` unless that directory is explicitly
provided as input.

Supported path inputs:

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
- `catalog.json`, `run_results.json`, and `sources.json` are optional future
  artifacts and are not currently loaded into the adapter result

## Artifact Requirements

Required artifacts:

- `dbt_project.yml`
- `manifest.json`

Optional future artifacts:

- `catalog.json`
- `run_results.json`
- `sources.json`

Current artifact expectations:

- artifacts must be local files
- artifacts must be deterministic test inputs
- artifacts must not require warehouse access
- artifacts must not require dbt Cloud
- artifacts must not require running dbt commands

## Project Detection

Use `detectDbtProject(...)` or `resolveDbtProjectContext(...)` to identify a
local dbt project from explicit inputs only.

Behavior:

- explicit `paths.dbtProjectPath` must point to a file named `dbt_project.yml`
- `paths.projectDir` without `paths.dbtProjectPath` resolves
  `projectDir/dbt_project.yml`
- `projectDir` and `dbtProjectPath` must resolve to the same project
- detection resolves default manifest path when needed
- detection returns structured diagnostics for expected project-path problems

## Artifact Loading And Validation

Use `loadDbtArtifacts(...)` after detection.

Current loading scope:

- `dbt_project.yml`
- `manifest.json`

Current validation scope:

- file presence
- JSON parseability
- YAML parseability
- minimum supported `manifest.json` object structure
- minimum useful `dbt_project.yml` structure

The adapter does not load or normalize `catalog.json`, `run_results.json`, or
`sources.json` yet.

## Output Contract

`DbtAdapterResult` extends
`GovernanceWorkspaceAdapterResult` from
`@anarchitects/governance-core`.

Current result shape may include:

- workspace identity
- compatibility `projects`
- compatibility `dependencies`
- canonical `nodes`
- canonical `relations`
- namespaced dbt metadata
- structured diagnostics

The adapter returns Core-compatible workspace/project/asset/resource inputs. It
does not produce rules, scores, recommendations, or extension semantics.

## Resource Normalization

`normalizeDbtArtifacts(...)` maps dbt resources into Governance inputs.

Current supported dbt resource types:

- `model`
- `source`
- `seed`
- `snapshot`
- `exposure`

Current mapping:

- dbt project -> Governance workspace result
- dbt model/seed/snapshot -> compatibility project plus canonical `asset` node
- dbt source/exposure -> compatibility project plus canonical `resource` node

Normalization properties:

- deterministic
- artifact-driven
- factual
- non-judgmental

Unsupported resource types are skipped with diagnostics rather than normalized
silently.

## Dependency Mapping

The adapter also maps dbt DAG edges into Core-compatible dependency and
relation inputs.

Current dependency sources:

- `depends_on.nodes`
- target manifest metadata for `ref()`-style lineage hints
- target manifest metadata for `source()`-style lineage hints

Current supported patterns:

- model-to-model
- model-to-source
- fan-in and fan-out DAG shapes
- seed dependencies represented in `depends_on.nodes`
- snapshot dependencies represented in `depends_on.nodes`
- exposure dependencies represented in `depends_on.nodes`

The adapter does not parse SQL or Jinja and does not infer generic lineage.

## Preserved dbt Metadata

dbt-specific metadata is namespaced under `metadata.dbt`.

Resource/node/project metadata structure:

- `metadata.dbt.identity`
- `metadata.dbt.resource`
- `metadata.dbt.relation`
- `metadata.dbt.validation`
- `metadata.dbt.documentation`

Dependency metadata structure:

- `metadata.dbt.source`
- `metadata.dbt.target`
- `metadata.dbt.lineage`

Current preserved fields include:

- resource type
- materialization
- tags
- meta
- group
- owner
- package name
- path
- original file path
- database
- schema
- alias
- tests
- contracts
- docs and description status
- dbt unique ID
- fully qualified identifier metadata
- relation naming metadata

Missing metadata is not fabricated. The adapter preserves what is present in
the artifacts and emits informational diagnostics when extension-relevant facts
are incomplete.

## Diagnostics

`DbtAdapterDiagnostic` reuses `GovernanceDiagnostic` and adds:

- `path`
- `inputField`
- `dbtUniqueId`

Stable diagnostic fields used by this package:

- `code`
- `severity`
- `kind`
- `category`
- `message`
- `source`
- `path`
- `inputField`
- `dbtUniqueId`
- `details`
- `recommendation`

Severity conventions:

- `error` = hard adapter-domain failures such as missing files or malformed
  artifacts
- `warning` = partial analysis issues such as skipped resources or unresolved
  dependencies
- `info` = factual notices such as incomplete extension-relevant metadata

Adapter diagnostics cover:

- artifact shape
- missing or unsupported metadata
- normalization issues
- unresolved artifact-derived dependencies

Not adapter diagnostics:

- setup, Node/npm, Python, and dbt invocation problems: host
- governance metadata interpretation: extension
- runtime package compatibility: runtime/host
- governance rule violations: extension/core

Representative adapter diagnostics:

- missing `dbt_project.yml`
- missing `manifest.json`
- malformed JSON
- malformed YAML
- unsupported manifest structure
- incomplete manifest structure
- skipped resource types
- missing resource identity
- incomplete extension-relevant metadata
- unresolved dependency targets
- dependency targets present in the manifest but not normalized
- partial normalization
- partial dependency mapping

## Fixtures And Tests

Fixture documentation lives at
[tests/fixtures/README.md](/Users/johanvrolix/Anarchitects/anarchitecture-community/packages/governance/adapter-dbt/tests/fixtures/README.md:1).

Current fixture-backed coverage includes:

- project detection
- artifact loading and validation
- resource normalization
- dependency mapping
- metadata preservation
- diagnostics
- adapter-flow end-to-end tests

Tests run through the normal package target:

```bash
yarn nx test governance-adapter-dbt
```

## Handoff To governance-extension-dbt

`@anarchitects/governance-extension-dbt` should consume the adapter result as
factual dbt inventory and lineage input.

Expected handoff:

- normalized workspace/project/node/dependency inputs
- namespaced `metadata.dbt`
- structured adapter diagnostics

The extension is where dbt-specific governance meaning belongs:

- rule evaluation
- metrics
- scores
- recommendations
- semantic interpretation of dbt metadata

## Handoff To governance-runtime-dbt

`@anarchitects/governance-runtime-dbt` should treat this adapter as the
TypeScript composition boundary input source.

Expected runtime responsibilities:

- construct explicit adapter input
- call detection/loading/normalization in the right order
- combine adapter output with extension behavior
- coordinate reporting or workflow orchestration

The runtime should not reinterpret raw artifact shapes that the adapter already
translated into Core-compatible inputs.

## Relationship To governance-host-dbt

`@anarchitects/governance-host-dbt` is the dbt-native Python developer
experience layer.

Expected host responsibilities:

- dbt command invocation when needed by the broader system
- environment setup
- credential and profile handling
- local developer ergonomics
- cross-language integration concerns

This adapter does not own those concerns.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
