# dbt Extension Fixtures

These fixtures are deterministic, local-only normalized Governance workspace
samples for `@anarchitects/governance-extension-dbt`.

They are intentionally small and reviewable:

- no raw dbt artifacts
- no dbt installation
- no warehouse
- no dbt Cloud
- no adapter execution
- no runtime or host behavior

## Layout

- `normalized/simple-valid.workspace.json`
  - smallest representative valid workspace
  - includes one source, one staging model, and one mart model
- `normalized/layered.workspace.json`
  - source -> staging -> intermediate -> marts progression
  - useful for layer-aware extension checks
- `normalized/cross-domain.workspace.json`
  - dependency across two domains
  - useful for cross-domain signals, rule violations, metrics, and recommendations
- `normalized/missing-owner.workspace.json`
  - critical/public model without owner metadata
- `normalized/invalid-owner.workspace.json`
  - owner metadata present in an invalid shape
- `normalized/missing-docs-tests-contracts.workspace.json`
  - public/critical model missing description, tests, and contract metadata
- `normalized/public-critical.workspace.json`
  - public/governed and critical model combinations
  - includes a layer-violation candidate
- `normalized/hotspot.workspace.json`
  - high fan-in and high fan-out shape around a central model
- `normalized/unresolved-metadata.workspace.json`
  - resources where layer/domain cannot be resolved

## Contract Shape

Each fixture file is a serialized canonical `GovernanceWorkspace`
shape:

- `id`
- `name`
- `root`
- `nodes`
- `relations`

Nodes preserve dbt metadata under the adapter namespace:

- `metadata.dbt.identity`
- `metadata.dbt.resource`
- `metadata.dbt.relation`
- `metadata.dbt.validation`
- `metadata.dbt.documentation`

These fixtures are normalized extension inputs only. They are not raw
`manifest.json`, `catalog.json`, or `run_results.json` files.

## Coverage

These fixtures collectively cover:

- simple valid workspace input
- layered staging/intermediate/marts progression
- cross-domain dependency
- missing owner metadata
- invalid owner metadata
- missing documentation
- missing tests
- missing contracts
- public/governed model
- critical model
- high fan-in model
- high fan-out model
- layer violation candidate
- unresolved layer
- unresolved domain

The fixtures are curated for deterministic development and smoke coverage of
dbt extension resolvers, diagnostics, signals, rule packs, metrics, and
recommendations.
