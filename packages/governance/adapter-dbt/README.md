# @anarchitects/governance-adapter-dbt

## Purpose

`@anarchitects/governance-adapter-dbt` defines the TypeScript contract boundary
for a dbt Governance adapter. It owns explicit input paths, adapter options,
Core-compatible output types, project detection, artifact loading, and dbt
adapter metadata contracts for discovery, loading, validation, normalization,
dependency mapping, and metadata preservation workflows.

This package does not implement runtime composition, dbt governance meaning,
or Python host behavior.

## Location

- Package root: `packages/governance/adapter-dbt`
- Nx project name: `governance-adapter-dbt`
- npm package name: `@anarchitects/governance-adapter-dbt`

## Nx Commands

```bash
yarn nx show project governance-adapter-dbt
yarn nx build governance-adapter-dbt
yarn nx test governance-adapter-dbt
yarn nx lint governance-adapter-dbt
```

## Input Contract

Hosts and runtimes must pass explicit local paths. Detection and contract
resolution do not read implicit shell state and do not assume `process.cwd()`
unless that directory is passed in explicitly as `projectDir`.

```ts
import type { DbtGovernanceAdapterInput } from '@anarchitects/governance-adapter-dbt';

const input: DbtGovernanceAdapterInput = {
  paths: {
    projectDir: '/repo/analytics',
    dbtProjectPath: '/repo/analytics/dbt_project.yml',
    catalogPath: '/repo/analytics/target/catalog.json',
    runResultsPath: '/repo/analytics/target/run_results.json',
    sourcesPath: '/repo/analytics/target/sources.json',
  },
  options: {
    validationMode: 'strict',
  },
  metadata: {
    dbt: {
      projectId: 'analytics',
    },
  },
};
```

`DbtArtifactPaths` requires:

- either `projectDir` or `dbtProjectPath`

When `manifestPath` is omitted, detection resolves the default local path:

- `projectDir/target/manifest.json`

Optional artifact paths:

- `projectDir`
- `dbtProjectPath`
- `manifestPath`
- `catalogPath`
- `runResultsPath`
- `sourcesPath`

## Detection Behavior

Use `detectDbtProject(...)` or `resolveDbtProjectContext(...)` to identify a
local dbt project from explicit inputs only.

- If `paths.dbtProjectPath` is provided, it must point to a file named
  `dbt_project.yml`.
- If `paths.projectDir` is provided without `paths.dbtProjectPath`, detection
  checks `projectDir/dbt_project.yml`.
- If both are provided, they must resolve to the same project directory.
- No dbt command is invoked.

```ts
import { detectDbtProject } from '@anarchitects/governance-adapter-dbt';

const detected = detectDbtProject({
  paths: {
    projectDir: '/repo/analytics',
  },
});

if (detected.supported) {
  console.log(detected.context.artifactPaths.manifestPath);
}
```

## Artifact Loading

Use `loadDbtArtifacts(...)` after detection to load:

- `dbt_project.yml`
- `manifest.json`

```ts
import {
  detectDbtProject,
  loadDbtArtifacts,
} from '@anarchitects/governance-adapter-dbt';

const detected = detectDbtProject({
  paths: {
    projectDir: '/repo/analytics',
  },
});

if (detected.context) {
  const loaded = loadDbtArtifacts(detected.context);

  if (loaded.artifacts) {
    console.log(loaded.artifacts.projectConfig.name);
    console.log(loaded.artifacts.manifest.metadata.project_name);
  }
}
```

Loading is:

- local-file based
- deterministic
- driven only by explicit paths or resolved project context
- non-throwing for expected user/configuration errors
- minimal by design so later normalization can safely consume the artifacts

Current validation includes:

- `manifest.json` presence and JSON parseability
- `dbt_project.yml` presence and YAML parseability
- minimum manifest requirements:
  - top-level object
  - `metadata`
  - `metadata.dbt_schema_version`
  - `metadata.project_name`
  - `nodes`
- useful dbt project config requirements:
  - top-level object
  - non-empty `name`
  - optional path arrays must be arrays of non-empty strings

Prepared but not implemented yet:

- `catalog.json`
- `run_results.json`
- `sources.json`

## Resource Normalization

Use `normalizeDbtArtifacts(...)` to convert loaded dbt resources into
Core-compatible governance workspace, project, and node inputs.

```ts
import {
  detectDbtProject,
  loadDbtArtifacts,
  normalizeDbtArtifacts,
} from '@anarchitects/governance-adapter-dbt';

const detected = detectDbtProject({
  paths: {
    projectDir: '/repo/analytics',
  },
});

if (detected.context) {
  const loaded = loadDbtArtifacts(detected.context);

  if (loaded.artifacts) {
    const normalized = normalizeDbtArtifacts(
      detected.context,
      loaded.artifacts,
    );

    console.log(normalized.workspaceName);
    console.log(normalized.nodes?.map((node) => node.id));
  }
}
```

Current resource support:

- `model`
- `source`
- `seed`
- `snapshot`
- `exposure`

Current mapping:

- dbt project -> governance workspace result
- dbt model/seed/snapshot -> governance compatibility project input plus
  governance `asset` node
- dbt source/exposure -> governance compatibility project input plus
  governance `resource` node

Preserved dbt metadata includes:

- `unique_id`
- `package_name`
- resource name and fully qualified identifier when present
- `resource_type`
- `materialization`
- `tags`
- `meta`
- `group`
- `owner`
- `path`
- `original_file_path`
- `database` / `schema` / `alias`
- `relation_name`
- `tests`
- `contract`
- description/docs presence hints

Preserved metadata is namespaced under `metadata.dbt` and structured as:

- `metadata.dbt.identity`
- `metadata.dbt.resource`
- `metadata.dbt.relation`
- `metadata.dbt.validation`
- `metadata.dbt.documentation`

Unsupported resource types are skipped with diagnostics. Invalid resource
shapes emit diagnostics instead of being silently dropped.

Normalization is:

- deterministic
- artifact-driven
- limited to identity, classification hints, ownership hints, and factual dbt
  metadata preservation

## Dependency Mapping

`normalizeDbtArtifacts(...)` also maps manifest DAG edges into Core-compatible
governance dependency and relation inputs.

Dependency mapping uses only:

- `depends_on.nodes`
- target manifest metadata for `ref()`-style lineage
- target manifest metadata for `source()`-style lineage

Current dependency support:

- model-to-model
- model-to-source
- seed dependencies represented in `depends_on.nodes`
- snapshot dependencies represented in `depends_on.nodes`
- exposure dependencies represented in `depends_on.nodes`

Dependency metadata preserves:

- source endpoint metadata under `metadata.dbt.source`
- target endpoint metadata under `metadata.dbt.target`
- dependency lineage metadata under `metadata.dbt.lineage`
- source and target dbt `unique_id`
- dbt dependency kind: `ref` or `source`
- artifact-derived dependency kind: `depends_on.nodes`
- `ref` target hints when the target is a dbt node
- `source` target hints when the target is a dbt source

Dependency mapping is:

- deterministic
- artifact-driven
- limited to dbt manifest lineage facts
- non-inferential: no SQL parsing, no Jinja parsing, no generic lineage
- descriptive only: semantic interpretation belongs to
  `@anarchitects/governance-extension-dbt`

## Output Contract

`DbtAdapterResult` extends the existing
`GovernanceWorkspaceAdapterResult` contract from
`@anarchitects/governance-core`.

- Use `DbtAdapterResult` when you need a dbt-specific metadata envelope.
- Use `GovernanceWorkspaceAdapterResult` when you only need the shared Core
  adapter output shape.

The result metadata reserves space for dbt-specific values needed later by
runtime or extension layers:

```ts
import type { DbtAdapterResult } from '@anarchitects/governance-adapter-dbt';

const result: DbtAdapterResult = {
  workspaceId: 'analytics',
  workspaceName: 'analytics',
  workspaceRoot: '/repo/analytics',
  metadata: {
    adapter: 'dbt',
    validationMode: 'lenient',
    paths: {
      projectDir: '/repo/analytics',
      dbtProjectPath: '/repo/analytics/dbt_project.yml',
      manifestPath: '/repo/analytics/target/manifest.json',
    },
    dbt: {
      manifestVersion: 12,
    },
  },
};
```

## Diagnostics Strategy

`DbtAdapterDiagnostic` reuses `GovernanceDiagnostic` from
`@anarchitects/governance-core` and adds:

- `path` for the concrete file or directory involved
- `inputField` for the explicit input member, such as
  `paths.projectDir`, `paths.dbtProjectPath`, or `options.validationMode`

Validation mode is constrained to:

- `strict`
- `lenient`

Use `isDbtAdapterValidationMode(...)` when a runtime or host needs to validate
external configuration before constructing adapter input.

Artifact loading emits structured diagnostics for:

- missing artifact path
- missing artifact file
- malformed manifest JSON
- malformed dbt project YAML
- unsupported manifest shape
- incomplete required manifest fields
- skipped resource types
- unsupported resource shapes
- missing required resource identity fields
- partial normalization
- unresolved dependency targets
- dependency targets present in manifest but not normalized as governance nodes
- unsupported dependency metadata shape
- partial dependency mapping

## Runtime And Host Boundary

- Runtime is responsible for TypeScript composition and for passing a fully
  explicit `DbtGovernanceAdapterInput`.
- Host is responsible for the dbt-native developer experience and for
  resolving concrete filesystem paths before invoking the adapter contract.
- This package detects the dbt project from explicit local inputs only.
- This package loads only local artifact files passed through those explicit
  paths.
- This package normalizes dbt resources into Core-owned workspace/project/node
  inputs without evaluating architecture quality.
- This package maps dbt DAG edges into Core-owned dependency/relation inputs
  using manifest facts only.
- This package preserves dbt-specific facts so downstream extensions can
  compute dbt-aware signals, metrics, rules, diagnostics, and recommendations
  without rereading dbt artifacts.
- This package does not invoke dbt commands.

## Architectural Boundary

```text
Adapter = discovery, loading, validation, normalization, metadata preservation.
Extension = dbt-specific governance meaning.
Runtime = TypeScript composition boundary.
Host = dbt-native Python developer experience.
```

This package owns only the Adapter line. It must not depend on dbt extension,
runtime, or host packages.

## Non-Goals

- Implementing dbt rules, metrics, scores, or recommendations
- Evaluating whether a dbt architecture is good or bad
- Deciding governance meaning that belongs in an extension layer
- Computing dbt-aware governance semantics inside the adapter
- Inferring lineage from SQL or Jinja outside dbt manifest artifacts
- Adding dependencies on `@anarchitects/governance-extension-dbt`
- Adding dependencies on `@anarchitects/governance-runtime-dbt`
- Adding dependencies on `@anarchitects/governance-host-dbt`
- Implementing Python code
- Invoking dbt commands
- Adding npm runtime setup logic
