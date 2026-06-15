# governance-host-dbt e2e fixtures

These fixtures are deterministic, local-only dbt host samples for
`anarchitecture-dbt-governance` end-to-end coverage.

Rules:

- no warehouse access
- no secrets
- no dbt Cloud
- no network access for the main e2e suite
- copied to temporary directories before tests run
- never mutated in-place by tests

Fixture strategy:

- reuse checked-in adapter fixtures when existing `manifest.json` coverage is
  sufficient
- keep host-local fixtures minimal for parse/no-manifest/config scenarios
- use fake `dbt`, `node`, `npm`, and `dbt-governance-runtime` executables to
  exercise the host lifecycle and process/JSON boundary hermetically

Current host-local fixtures:

- `parseable-project`
  - minimal dbt project without `target/manifest.json`
  - used for missing-artifact and `--parse` lifecycle coverage
