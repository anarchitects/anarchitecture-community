# anarchitects_governance

`anarchitects_governance` is the companion dbt package for Anarchitects dbt Governance projects. It is installed with `dbt deps` and helps teams document and produce governance-friendly metadata consistently inside dbt projects.

Initial scope:

- dbt docs blocks for governance concepts
- safe helper macros that print recommended metadata and profile templates
- optional tag helper macros for consistent tag naming

Planned later scope:

- lightweight dbt-native generic tests for early feedback inside dbt projects

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

## Installation

Install this package through `packages.yml`.

Local development example:

```yaml
packages:
  - local: ../anarchitecture-community/packages/governance/dbt-package
```

Then install and parse:

```bash
dbt deps
dbt parse
dbt docs generate
```

Future public distribution may support Git-based installation, but that is not the current release model. Until then, prefer local monorepo or explicit Git checkout workflows.

Future Git tag and GitHub release based distribution example:

```yaml
packages:
  - git: 'https://github.com/anarchitects/anarchitecture-community.git'
    revision: '<tag>'
    subdirectory: 'packages/governance/dbt-package'
```

That flow is not configured by this package scaffold. Git tag and GitHub release support is tracked separately in [#461](https://github.com/anarchitects/anarchitecture-community/issues/461). dbt Hub publication is also not available yet and is tracked separately in [#462](https://github.com/anarchitects/anarchitecture-community/issues/462).

## Basic Usage

Suggested manual validation from a consuming dbt project:

```bash
dbt deps
dbt parse
dbt docs generate
dbt run-operation governance_print_metadata_template
dbt run-operation governance_print_profile_template
```

If you prefer explicit package qualification when invoking a macro from an installed package:

```bash
dbt run-operation anarchitects_governance.governance_print_metadata_template
dbt run-operation anarchitects_governance.governance_print_profile_template
```

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

Assemble a distributable copy under `dist/packages/governance/dbt-package`:

```bash
yarn nx run governance-dbt-package:pack
```

Target behavior:

- `validate` checks that the expected scaffold files and directories exist
- `pack` assembles the dbt package under `dist/packages/governance/dbt-package`
- `pack` does not publish anything
- Git tag and GitHub release support is tracked by [#461](https://github.com/anarchitects/anarchitecture-community/issues/461)
- dbt Hub publication is tracked by [#462](https://github.com/anarchitects/anarchitecture-community/issues/462)

## Related Work

- [Companion package strategy](../../../docs/governance/dbt-companion-package-strategy.md)
- [Parent epic #422](https://github.com/anarchitects/anarchitecture-community/issues/422)
- [This scaffold issue #426](https://github.com/anarchitects/anarchitecture-community/issues/426)
- [Follow-up adapter support #457](https://github.com/anarchitects/anarchitecture-community/issues/457)
- [Follow-up extension support #458](https://github.com/anarchitects/anarchitecture-community/issues/458)
- [Follow-up runtime coverage #459](https://github.com/anarchitects/anarchitecture-community/issues/459)
- [Follow-up docs alignment #460](https://github.com/anarchitects/anarchitecture-community/issues/460)
- [Follow-up Git tag and GitHub release flow #461](https://github.com/anarchitects/anarchitecture-community/issues/461)
- [Follow-up dbt Hub publication flow #462](https://github.com/anarchitects/anarchitecture-community/issues/462)

## Boundary Reminder

This package must stay on the dbt side of the boundary:

- it does not run `dbt-governance`
- it does not install the Python CLI
- it does not install the Node runtime
- it does not duplicate governance core, runtime, adapter, or extension logic

Use it to document and standardize metadata inside dbt. Use `dbt-governance check` to evaluate and report governance outcomes.
