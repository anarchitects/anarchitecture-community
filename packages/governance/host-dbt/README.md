# anarchitecture-dbt-governance

`anarchitecture-dbt-governance` is the scaffold for a future dbt-native
Governance host. The current implementation resolves a dbt project, manages the
artifact lifecycle for `check`, and stops before runtime composition or
artifact normalization.

The Nx project is registered as `governance-host-dbt` and follows the workspace
`@nxlv/python` setup with `uv` configured in [`nx.json`](../../../nx.json).

## CLI

The package exposes `dbt-governance` with these commands:

- `check`
- `setup`
- `doctor`
- `init`
- `report`

`setup`, `doctor`, `init`, and `report` remain placeholders.

`check` supports:

- `--project-dir`
- `--profiles-dir`
- `--target`
- `--target-path`
- `--config`
- `--use-existing-artifacts`
- `--parse`

Artifact lookup behavior:

- `--project-dir` overrides the current working directory.
- `dbt_project.yml` must exist in the resolved project directory.
- `manifest.json` is resolved from `--target-path` when provided, otherwise
  from `target/manifest.json`.
- Existing `manifest.json` is always preferred and used without invoking dbt.
- Optional `catalog.json`, `run_results.json`, and `sources.json` are detected
  and carried forward when present.

`--parse` behavior:

- if `manifest.json` is missing and `--parse` is set, the host invokes
  `dbt parse`
- if `manifest.json` is missing and `--parse` is not set, the host returns a
  clear diagnostic and fails

`--use-existing-artifacts` behavior:

- when this flag is set, the host never invokes dbt
- if `manifest.json` is missing, the command fails with a clear host
  diagnostic instead of falling back to `dbt parse`

Boundary:

- the host manages dbt-native artifact lifecycle orchestration
- the host only performs lightweight path existence and readability checks
- the host does not normalize dbt artifacts
- the host does not compute governance results
- the host does not invoke the runtime composition boundary yet

## Boundary Rules

This scaffold must not:

- depend on `@anarchitects/governance-core`
- depend on `@anarchitects/governance-adapter-dbt`
- depend on `@anarchitects/governance-extension-dbt`
- implement dbt artifact normalization
- implement governance evaluation
- implement runtime composition
- semantically parse manifest content in Python

Package boundaries follow
[ADR 0001](../../../docs/adr/0001-governance-package-boundaries.md) and
[ADR 0003](../../../docs/adr/0003-governance-core-adapter-extension-host-boundaries.md).
Practical contributor guidance lives in
[`docs/governance-boundary-contributor-guide.md`](../../../docs/governance-boundary-contributor-guide.md).

## Local Development

```bash
yarn nx run governance-host-dbt:lint
yarn nx run governance-host-dbt:test
yarn nx run governance-host-dbt:e2e
yarn nx run governance-host-dbt:build
```

If `uv` is installed locally, the CLI entrypoint can be exercised with:

```bash
cd packages/governance/host-dbt
uv run dbt-governance --help
uv run dbt-governance check --project-dir ./path/to/dbt/project
uv run dbt-governance check --project-dir ./path/to/dbt/project --parse
```
