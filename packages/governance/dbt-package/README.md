# anarchitects_governance

`anarchitects_governance` is the companion dbt package for Anarchitects dbt Governance projects. It is installed with `dbt deps` and helps teams document and produce governance-friendly metadata consistently inside dbt projects.

Initial scope:

- dbt docs blocks for governance concepts
- safe helper macros that print recommended metadata and profile templates
- optional tag helper macros for consistent tag naming
- lightweight dbt-native generic tests for early feedback inside dbt projects

Planned later scope:

- broader dbt-native metadata test coverage as the package surface stabilizes

## What This Package Is

- a companion dbt package that lives inside a dbt project
- a dbt-side metadata enablement layer for `dbt-governance`
- a place for dbt-native documentation and safe helper macros
- a way to help teams adopt the Anarchitects metadata convention consistently

## What This Package Is Not

- not the Python CLI package `anarchitecture-dbt-governance`
- not the `dbt-governance` command
- not the TypeScript runtime
- not a governance evaluation engine
- not a replacement for `dbt-governance check`
- not responsible for installing Python or Node tooling

## How It Fits In The Flow

```text
dbt project
  -> companion dbt package helps metadata/docs/tests
  -> dbt artifacts
  -> dbt-governance Python host
  -> runtime/adapter/extension/core
  -> governance report
```

This package improves metadata consistency inside dbt. The authoritative evaluation and reporting path remains `dbt-governance check`.

## Two-Package Model

Use the companion package and the Python CLI as separate tools with separate installation paths.

Companion dbt package:

- installed through dbt `packages.yml` and `dbt deps`
- lives inside the dbt project
- provides dbt-native docs blocks, template macros, helper operations, and lightweight metadata tests
- helps teams author governance-friendly metadata consistently

Python CLI:

- installed with `pipx`, `uv tool`, or `pip`
- provides the `dbt-governance` command
- reads dbt artifacts
- invokes the governance runtime
- performs authoritative governance evaluation
- writes governance reports

Important boundary:

- `dbt deps` does not install `dbt-governance`
- this package does not install Python or Node tooling
- this package does not run governance evaluation
- install the CLI separately when you want governance checks and reports

## Installation

Install this package through `packages.yml`.

Local development example:

```yaml
packages:
  - local: ../anarchitecture-community/packages/governance/dbt-package
```

Git tag and GitHub release install model:

```yaml
packages:
  - git: 'https://github.com/anarchitects/anarchitecture-community.git'
    revision: 'governance-dbt-package@0.1.0'
    subdirectory: 'packages/governance/dbt-package'
```

This repo uses the existing Nx Release tag convention `<project>@<version>`. For the companion dbt package, that means tags such as `governance-dbt-package@0.1.0`.

Planned dbt Hub installation is documented in [docs/governance/dbt-companion-dbt-hub-publication.md](../../../docs/governance/dbt-companion-dbt-hub-publication.md). Do not treat dbt Hub installation as available yet.

If you want the full workflow, install the Python CLI separately. Recommended CLI installers:

```bash
pipx install anarchitecture-dbt-governance
```

```bash
uv tool install anarchitecture-dbt-governance
```

```bash
pip install anarchitecture-dbt-governance
```

Then install the dbt package and parse:

```bash
dbt deps
dbt parse
dbt docs generate
```

CLI installation, packaging, and public usage guidance for `anarchitecture-dbt-governance` are tracked alongside [#421](https://github.com/anarchitects/anarchitecture-community/issues/421) and documented in [packages/governance/host-dbt/README.md](../host-dbt/README.md).

## Basic Usage

Suggested manual validation from a consuming dbt project:

```bash
dbt deps
dbt parse
dbt docs generate
dbt test
dbt run-operation governance_print_metadata_template
dbt run-operation governance_print_profile_template
dbt run-operation governance_validate_metadata
```

If you prefer explicit package qualification when invoking a macro from an installed package:

```bash
dbt run-operation anarchitects_governance.governance_print_metadata_template
dbt run-operation anarchitects_governance.governance_print_profile_template
dbt run-operation anarchitects_governance.governance_validate_metadata
```

The Nx `test` target uses a tiny local DuckDB-backed fixture project under [tests/fixtures/smoke](./tests/fixtures/smoke). It requires a local dbt installation with a DuckDB adapter such as `dbt-duckdb`; it does not install dbt for you. A plain Homebrew `dbt-fusion` preview install without a working DuckDB driver is not sufficient for this target.

## When To Use Which Package

Use only `dbt-governance` when:

- you want to evaluate an existing dbt project from artifacts
- you do not want dbt-side helpers, macros, or tests in the project
- you only need governance checks and reports

Use `dbt-governance` plus this companion dbt package when:

- you want dbt-native metadata templates
- you want docs blocks for governance conventions
- you want lightweight dbt generic tests for metadata presence and allowed values
- you want onboarding help for teams authoring governance metadata inside dbt

The companion package is optional. The CLI remains the authoritative evaluator in both cases.

## Run-Operation Helpers

These helpers support onboarding and local setup:

- they print templates only
- they do not mutate files
- they do not install Python or Node dependencies
- they do not run `dbt-governance`
- they do not perform full governance policy evaluation

You still need to install and run the Python CLI separately for authoritative governance reports.

### `dbt run-operation governance_print_metadata_template`

Command:

```bash
dbt run-operation governance_print_metadata_template
```

Optional args:

```bash
dbt run-operation governance_print_metadata_template --args '{model_name: fct_orders, layer: marts, domain: sales, owner_team: analytics}'
```

Supported args:

- `model_name`
- `description`
- `layer`
- `domain`
- `owner_team`
- `criticality`
- `public_interface`
- `cross_domain_approved`
- `contract_enforced`

Sample output:

```yaml
models:
  - name: fct_orders
    description: 'Fact table for order analytics.'
    config:
      contract:
        enforced: true
    meta:
      anarchitects:
        governance:
          layer: marts
          domain: sales
          owner:
            team: analytics
          criticality: high
          publicInterface: true
          crossDomainApproved: false
```

Intended use:

- bootstrap a model properties snippet that follows the recommended convention

Limitations:

- prints text only
- does not inspect the project
- does not apply the template automatically

Relationship to `dbt-governance check`:

- helpful for authoring metadata
- not an evaluator

### `dbt run-operation governance_print_profile_template`

Command:

```bash
dbt run-operation governance_print_profile_template
```

Optional args:

```bash
dbt run-operation governance_print_profile_template --args '{profile_name: dbt, layers: [staging, intermediate, marts], require_ownership: true, require_documentation: true}'
```

Supported args:

- `profile_name`
- `layers`
- `require_ownership`
- `require_documentation`

Sample output:

```yaml
# Starter Anarchitects governance.profile.yml content
# Mirror this into governance.yml -> profile.document today when using dbt-governance.
name: dbt
layers:
  - staging
  - intermediate
  - marts
allowedDomainDependencies: {}
ownership:
  required: true
health:
  statusThresholds:
    goodMinScore: 85
    warningMinScore: 70
metrics: {}
rules:
  dbt/no-disallowed-layer-dependency:
    enabled: true
    severity: error
    options:
      allowedUpstreamByLayer:
        staging:
          - staging
        intermediate:
          - staging
          - intermediate
        marts:
          - staging
          - intermediate
          - marts
```

Intended use:

- bootstrap a starter Anarchitects governance profile template aligned with the current host-dbt docs

Limitations:

- this is a starter template, not an exhaustive schema reference
- it is consumed by `dbt-governance`, not by dbt itself
- it is not automatically written to `governance.profile.yml`

Relationship to `dbt-governance check`:

- helpful for starting profile configuration
- not a runtime validator

### `dbt run-operation governance_validate_metadata`

Command:

```bash
dbt parse
dbt run-operation governance_validate_metadata
```

Optional args:

```bash
dbt run-operation governance_validate_metadata --args '{allowed_layers: [staging, intermediate, marts], allowed_criticality_values: [low, medium, high, critical], required: [layer, domain, owner], fail_on_error: false}'
```

Supported args:

- `allowed_layers`
- `allowed_criticality_values`
- `required`
- `fail_on_error`

Intended use:

- lightweight local metadata linting against the recommended nested convention

What it checks:

- missing `meta.anarchitects.governance.layer`
- missing `meta.anarchitects.governance.domain`
- missing `meta.anarchitects.governance.owner.team`
- optional criticality presence and allowed-value checks
- optional allowed-layer checks

Limitations:

- inspects dbt graph metadata only
- does not execute SQL
- does not evaluate lineage or cross-model policy
- does not replace generic tests or `dbt-governance check`

Relationship to `dbt-governance check`:

- convenience lint helper for local metadata quality
- not authoritative governance evaluation

Full runtime interpretation of `meta.anarchitects.governance.*` still depends on [#457](https://github.com/anarchitects/anarchitecture-community/issues/457), [#458](https://github.com/anarchitects/anarchitecture-community/issues/458), and [#459](https://github.com/anarchitects/anarchitecture-community/issues/459).

## Generic Metadata Tests

Feasibility note:

- dbt generic tests receive the target `model` plus explicit test arguments
- these tests do not inspect row data
- they use dbt graph metadata and Jinja inspection at test execution time
- dbt documents that `graph` is incomplete during parsing, so the implementation only reads graph metadata when `execute` is true
- on success they render synthetic zero-row SQL
- on failure they render one synthetic failing row

That keeps the tests lightweight and adapter-neutral while staying inside the dbt package boundary.

Implemented tests:

### `has_governance_layer`

Purpose:

- verifies that `meta.anarchitects.governance.layer` exists and is a non-empty string

Example:

```yaml
models:
  - name: fct_orders
    data_tests:
      - anarchitects_governance.has_governance_layer
```

What it checks:

- local dbt metadata presence for the recommended nested layer field

What it does not check:

- whether the layer value is valid for your architecture
- graph-level layer dependency rules

### `has_governance_domain`

Purpose:

- verifies that `meta.anarchitects.governance.domain` exists and is a non-empty string

Example:

```yaml
models:
  - name: fct_orders
    data_tests:
      - anarchitects_governance.has_governance_domain
```

What it checks:

- local dbt metadata presence for the recommended nested domain field

What it does not check:

- cross-domain lineage policy

### `has_governance_owner`

Purpose:

- verifies that `meta.anarchitects.governance.owner.team` exists and is a non-empty string

Example:

```yaml
models:
  - name: fct_orders
    data_tests:
      - anarchitects_governance.has_governance_owner
```

What it checks:

- local dbt metadata presence for the recommended nested owner team field

What it does not check:

- broader ownership coverage or graph-level ownership rules

### `has_governance_criticality`

Purpose:

- verifies that `meta.anarchitects.governance.criticality` exists and is a non-empty string

Example:

```yaml
models:
  - name: fct_orders
    data_tests:
      - anarchitects_governance.has_governance_criticality
```

What it checks:

- local dbt metadata presence for the criticality field

What it does not check:

- whether the value belongs to an approved set

### `has_allowed_governance_layer`

Purpose:

- verifies that the governance layer exists and is one of the configured allowed values

Example:

```yaml
models:
  - name: fct_orders
    data_tests:
      - anarchitects_governance.has_allowed_governance_layer:
          arguments:
            allowed_layers:
              - staging
              - intermediate
              - marts
```

What it checks:

- local dbt metadata value validation for `meta.anarchitects.governance.layer`

What it does not check:

- whether upstream or downstream dependencies obey layer policy

### `has_allowed_criticality`

Purpose:

- verifies that `meta.anarchitects.governance.criticality`, when present or required, is one of the configured allowed values

Example:

```yaml
models:
  - name: fct_orders
    data_tests:
      - anarchitects_governance.has_allowed_criticality:
          arguments:
            allowed_values:
              - low
              - medium
              - high
              - critical
            required: false
```

Behavior:

- with `required: false`, missing criticality passes and present criticality must be in `allowed_values`
- with `required: true`, missing criticality fails

What it does not check:

- criticality-driven graph rules
- test coverage expectations for critical models

Boundary reminder for all generic tests:

- these tests provide early developer feedback only
- they do not evaluate cross-model graph governance
- they do not replace `dbt-governance check`
- they do not guarantee full compliance

## Recommended Metadata Convention

Use the strategy document's recommended nested convention:

```yaml
models:
  - name: fct_orders
    description: Fact table for order analytics.
    config:
      contract:
        enforced: true
    meta:
      anarchitects:
        governance:
          layer: marts
          domain: sales
          owner:
            team: analytics
          criticality: high
          publicInterface: true
          crossDomainApproved: false
```

Meaning of the recommended fields:

- `layer`: the architectural layer for the resource, for example `staging`, `intermediate`, or `marts`
- `domain`: the accountable business or data domain
- `owner.team`: the accountable team for the resource
- `criticality`: the importance or risk level used by dbt Governance interpretation
- `publicInterface`: whether the resource is intended as a public or governed interface
- `crossDomainApproved`: whether intentional cross-domain use has been explicitly approved
- dbt `description`: the primary dbt-native documentation evidence
- `config.contract.enforced`: the primary dbt-native contract evidence where model contracts apply

## Tag Helper Macros

This package also provides optional convenience helpers:

- `governance_layer_tag(layer)`
- `governance_domain_tag(domain)`
- `governance_scope_tag(scope)`

These return tags such as `layer:marts`, `domain:sales`, and `scope:public`.

Important boundary:

- the recommended canonical convention is nested `meta.anarchitects.governance`
- tag helpers are optional convenience only
- tags do not replace the metadata convention
- macros cannot inject tags into existing YAML automatically

## Known Support Gap

This package documents and helps produce the recommended convention. Full end-to-end support in `dbt-governance check` still depends on follow-up runtime work:

- [#457](https://github.com/anarchitects/anarchitecture-community/issues/457) for adapter-dbt support for `meta.anarchitects.governance.*`
- [#458](https://github.com/anarchitects/anarchitecture-community/issues/458) for extension-dbt resolver support for `meta.anarchitects.governance.*`
- [#459](https://github.com/anarchitects/anarchitecture-community/issues/459) for runtime-dbt integration coverage

Do not assume the nested convention is already fully interpreted by the runtime path just because this package documents it.

## Nx Targets

This package is registered as a lightweight Nx project named `governance-dbt-package`.

Validate the scaffold:

```bash
yarn nx run governance-dbt-package:validate
```

Run the local dbt smoke test fixture:

```bash
yarn nx run governance-dbt-package:test
```

Assemble a distributable copy under `packages/governance/dbt-package/dist`:

```bash
yarn nx run governance-dbt-package:pack
```

Target behavior:

- `validate` checks that the expected scaffold files and directories exist
- `test` runs `dbt deps`, `dbt parse`, `dbt test`, and the helper `run-operation` macros against a tiny local DuckDB fixture
- `pack` assembles the dbt package under `packages/governance/dbt-package/dist`
- `pack` does not publish anything
- Git tag and GitHub release support is implemented through the repo's Nx Release flow and documented in [RELEASE.md](./RELEASE.md)
- dbt Hub publication is tracked by [#462](https://github.com/anarchitects/anarchitecture-community/issues/462)

## Release And Distribution

Staged release model:

1. Local development install via `packages.yml` with `local:`
2. Git tag and GitHub release install via repository subdirectory using tags such as `governance-dbt-package@0.1.0`
3. dbt Hub publication, tracked in [#462](https://github.com/anarchitects/anarchitecture-community/issues/462)

Guidance:

- this dbt package has its own version in [dbt_project.yml](./dbt_project.yml)
- its version should not be confused with the Python CLI package version
- compatibility may be coordinated across the CLI, runtime, and companion package, but installation remains separate
- GitHub releases are the first public distribution target
- dbt Hub should not be documented as available until publication is real
- the detailed release steps live in [RELEASE.md](./RELEASE.md)
- the planned dbt Hub repository model is documented in [docs/governance/dbt-companion-dbt-hub-publication.md](../../../docs/governance/dbt-companion-dbt-hub-publication.md)

Distribution summary:

- Current stable distribution: Git tag and GitHub release from this monorepo, consumed through `git` plus `subdirectory`
- Planned distribution: dbt Hub publication after the repository model in [docs/governance/dbt-companion-dbt-hub-publication.md](../../../docs/governance/dbt-companion-dbt-hub-publication.md) is implemented

Important note:

- dbt itself supports `git` plus `subdirectory` installs from a monorepo
- current dbt Hub ingestion appears repository-oriented and semver-tag-oriented
- until dbt Hub publication is real, install this package through a released Git tag or a local path

## Release Checklist

- Validate the dbt package project.
- Confirm the `dbt_project.yml` version.
- Confirm README install examples still match the supported release stage.
- Confirm docs examples parse where feasible.
- Confirm companion package demo references point to the correct repo.
- Confirm compatibility notes with `anarchitecture-dbt-governance`.
- Confirm Git tag and GitHub release notes for the current stage.
- Confirm host docs link back to companion package docs.
- Confirm dbt Hub docs are updated only after publication.

The detailed release flow is documented in [RELEASE.md](./RELEASE.md). dbt Hub publication remains separate future work under [#462](https://github.com/anarchitects/anarchitecture-community/issues/462).

## Related Work

- [Companion package strategy](../../../docs/governance/dbt-companion-package-strategy.md)
- [dbt Hub publication decision](../../../docs/governance/dbt-companion-dbt-hub-publication.md)
- [Release guide](./RELEASE.md)
- [Python CLI and host package docs](../host-dbt/README.md)
- [Governance host behavior reference](../../../docs/governance/dbt-governance-host.md)
- Current governance profile input guidance lives in the `governance.profile.yml Reference` section of [packages/governance/host-dbt/README.md](../host-dbt/README.md)
- [Parent epic #422](https://github.com/anarchitects/anarchitecture-community/issues/422)
- [Python CLI package story #421](https://github.com/anarchitects/anarchitecture-community/issues/421)
- [This scaffold issue #426](https://github.com/anarchitects/anarchitecture-community/issues/426)
- [Run-operation helpers issue #428](https://github.com/anarchitects/anarchitecture-community/issues/428)
- [Follow-up adapter support #457](https://github.com/anarchitects/anarchitecture-community/issues/457)
- [Follow-up extension support #458](https://github.com/anarchitects/anarchitecture-community/issues/458)
- [Follow-up runtime coverage #459](https://github.com/anarchitects/anarchitecture-community/issues/459)
- [Follow-up docs alignment #460](https://github.com/anarchitects/anarchitecture-community/issues/460)
- [Follow-up Git tag and GitHub release flow #461](https://github.com/anarchitects/anarchitecture-community/issues/461)
- [Follow-up dbt Hub publication flow #462](https://github.com/anarchitects/anarchitecture-community/issues/462)
- [Demo tracking reference #429](https://github.com/anarchitects/anarchitecture-community/issues/429)
- [Demo implementation issue](https://github.com/anarchitects/governance-demo-dbt-governance/issues/5)

## Boundary Reminder

This package must stay on the dbt side of the boundary:

- it does not run `dbt-governance`
- it does not install the Python CLI
- it does not install the Node runtime
- it does not duplicate governance core, runtime, adapter, or extension logic

Use it to document and standardize metadata inside dbt. Use `dbt-governance check` to evaluate and report governance outcomes.
