# dbt Adapter Fixtures

These fixtures are deterministic, local-only dbt project and artifact samples
for `@anarchitects/governance-adapter-dbt`.

They are intentionally small and curated:

- no warehouse access
- no dbt Cloud
- no `profiles.yml`
- no dbt command execution
- no generated large artifacts

## Layout

- `artifacts/simple-project`
  - smallest valid dbt project/artifact pair
  - useful for detection and basic artifact loading
- `artifacts/layered-project`
  - layered staging/intermediate/marts-style DAG
  - includes source, model-to-model, fan-in/fan-out, seed, and snapshot cases
- `artifacts/metadata-rich`
  - focused on tags, `meta`, owner/group, tests, contracts, documented and
    undocumented models
  - includes minimal placeholder future artifacts: `catalog.json`,
    `run_results.json`, and `sources.json`
- `artifacts/unresolved-dependency`
  - valid manifest shape with an unresolved dependency target for diagnostics
- `artifacts/valid-project`
  - existing integration-heavy fixture used by current adapter behavior tests
- `artifacts/missing-manifest`
  - valid project config with missing `manifest.json`
- `artifacts/missing-project-config`
  - valid manifest with missing `dbt_project.yml`
- `artifacts/malformed-manifest`
  - intentionally malformed JSON
- `artifacts/malformed-project-config`
  - intentionally malformed YAML
- `artifacts/unsupported-manifest`
  - manifest with unsupported top-level shape
- `artifacts/incomplete-manifest`
  - manifest missing required supported fields
- `detection/*`
  - focused project-detection fixtures

## Coverage

These fixtures collectively cover:

- simple dbt project
- layered project structure
- model-to-model dependencies
- model-to-source dependencies
- fan-in/fan-out DAG
- seeds
- snapshots
- tagged models
- models with `meta`
- owner/group metadata
- tests
- contracts
- documented and undocumented models
- unresolved dependency diagnostics
- missing artifact cases
- malformed artifact cases

Semantic interpretation is intentionally out of scope here. These fixtures only
preserve deterministic dbt facts for adapter tests.
