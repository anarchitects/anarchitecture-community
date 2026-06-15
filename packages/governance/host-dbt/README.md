# anarchitecture-dbt-governance

`anarchitecture-dbt-governance` is the scaffold for a future dbt-native
Governance host. This package is intentionally limited to Python/Nx packaging,
CLI surface setup, and placeholder runtime modules for issue #399.

The Nx project is registered as `governance-host-dbt` and follows the workspace
`@nxlv/python` setup with `uv` configured in [`nx.json`](../../../nx.json).

## CLI

The package exposes `dbt-governance` with placeholder commands:

- `check`
- `setup`
- `doctor`
- `init`
- `report`

Each command currently prints a clear "not implemented yet" message and exits
successfully.

## Boundary Rules

This scaffold must not:

- depend on `@anarchitects/governance-core`
- depend on `@anarchitects/governance-adapter-dbt`
- depend on `@anarchitects/governance-extension-dbt`
- implement dbt artifact normalization
- implement governance evaluation
- implement runtime composition

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
```
