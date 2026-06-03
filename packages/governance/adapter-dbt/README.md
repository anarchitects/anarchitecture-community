# @anarchitects/governance-adapter-dbt

## Purpose

`@anarchitects/governance-adapter-dbt` defines the TypeScript contract boundary
for a dbt Governance adapter. It owns explicit input paths, adapter options,
Core-compatible output types, and dbt adapter metadata contracts for discovery,
loading, validation, normalization, and metadata preservation workflows.

This package does not implement dbt artifact loading, manifest parsing,
normalization logic, dependency mapping, runtime composition, or Python host
behavior.

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
- No manifest file is parsed or loaded.

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

## Runtime And Host Boundary

- Runtime is responsible for TypeScript composition and for passing a fully
  explicit `DbtGovernanceAdapterInput`.
- Host is responsible for the dbt-native developer experience and for
  resolving concrete filesystem paths before invoking the adapter contract.
- This package detects the dbt project from explicit local inputs only.
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

- Implementing dbt artifact loading
- Implementing manifest parsing
- Implementing dbt normalization
- Implementing dbt dependency mapping
- Implementing dbt rules, metrics, scores, or recommendations
- Adding dependencies on `@anarchitects/governance-extension-dbt`
- Adding dependencies on `@anarchitects/governance-runtime-dbt`
- Adding dependencies on `@anarchitects/governance-host-dbt`
- Implementing Python code
- Invoking dbt commands
- Adding npm runtime setup logic
