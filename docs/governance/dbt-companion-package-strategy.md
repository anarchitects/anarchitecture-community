# dbt Governance Companion Package Strategy

## Context

The current public dbt Governance tooling split is:

```text
dbt project
  -> dbt artifacts
  -> dbt-governance Python host
  -> dbt-governance-runtime process/JSON boundary
  -> governance adapter/extension/core
  -> governance report
```

Today the authoritative execution path is outside dbt:

- `anarchitecture-dbt-governance` is the Python host and CLI.
- `@anarchitects/governance-runtime-dbt` is the pinned runtime composition layer.
- `@anarchitects/governance-adapter-dbt` owns dbt artifact extraction and normalization.
- `@anarchitects/governance-extension-dbt` owns dbt-specific interpretation.
- `@anarchitects/governance-core` owns canonical contracts and generic governance evaluation.

The proposed companion dbt package is a separate concern. It would live inside a dbt project and be installed through `dbt deps` as a dbt package. Its role is to help dbt projects produce governance-friendly metadata and documentation without duplicating the runtime or pretending that dbt package installation also installs the Python CLI.

Relationship summary:

- `governance-host-dbt` = outside dbt, runs governance checks
- companion dbt package = inside dbt, helps projects produce governance-friendly metadata

That boundary must stay explicit:

- the Python host remains the authoritative evaluator
- the companion dbt package must not implement a second policy engine in Jinja
- the companion dbt package must not wrap or invoke `dbt-governance`
- `dbt deps` must not be used to install Python or Node tooling

## Naming Recommendation

Evaluated candidates:

- `anarchitects_governance`
- `anarchitects_dbt_governance`
- `dbt_anarchitects_governance`

Recommendation:

- `anarchitects_governance`

Rationale:

- dbt package names conventionally use underscores
- it reads cleanly in `packages.yml`
- it leaves room for macros, docs blocks, and tests without implying that the package is the CLI or runtime
- it avoids direct name collision with the PyPI package `anarchitecture-dbt-governance`

Rejected alternatives:

- `anarchitects_dbt_governance`: clearer for dbt searchability, but too close to the Python distribution name and therefore easier to confuse with the host CLI/runtime path
- `dbt_anarchitects_governance`: explicit, but awkward in `packages.yml` and less aligned with dbt package naming norms

## Location Recommendation

Evaluated locations:

- inside this monorepo
- separate public dbt package repository

Recommendation:

- start in this monorepo at `packages/governance/dbt-package/`

Rationale:

- it keeps strategy, adapter, extension, runtime, and host docs aligned during early development
- it matches the epic's proposed package structure
- it makes early integration and demo work easier while the metadata contract is still settling

Trade-offs:

- monorepo development makes boundary discipline more important because the package will sit near the runtime/host code it must not duplicate
- a separate repository may become cleaner later for dbt-native release/distribution workflows
- monorepo ownership is the better initial fit while the package strategy and metadata convention are still evolving

Recommended future posture:

- keep the first implementation in-repo
- split to a dedicated public dbt package repository only if release/distribution needs justify the extra operational overhead

## Package Boundary

The companion dbt package may own:

- dbt metadata convention documentation
- dbt docs blocks that explain Anarchitects governance concepts
- lightweight helper macros
- dbt-native generic tests for early developer feedback
- `run-operation` helpers that print templates or lightly inspect metadata

The companion dbt package must not own:

- governance runtime evaluation
- graph-level governance checks as an independent evaluation engine
- adapter, runtime, extension, or core logic
- Python CLI installation
- Node runtime installation
- a full policy engine
- hidden invocation of `dbt-governance`

Boundary fit by layer:

- Core owns canonical contracts and generic governance semantics.
- dbt adapter owns dbt artifact extraction and normalization.
- dbt extension owns dbt-specific interpretation.
- Python host owns CLI orchestration and reporting.
- companion dbt package owns dbt-native documentation, conventions, helper macros, and eventually lightweight dbt-native tests.

## Recommended Metadata Convention

Recommended primary convention:

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

Recommendation details:

- `meta.anarchitects.governance` is the primary documented namespace
- `layer` is required for governed resources
- `domain` is required for governed resources
- `owner.team` is the recommended accountable team field
- `owner.contacts` may be added later, but should be treated as future-facing until adapter/extension support is explicit
- `criticality` is the recommended risk/importance marker
- `publicInterface` marks resources intended as governed public interfaces
- `crossDomainApproved` is the recommended approval marker for intentional cross-domain use

Documentation and contract expectations:

- dbt `description` remains the primary documentation evidence
- `config.contract.enforced: true` remains the primary contract evidence for models where contracts apply
- the companion package should document these expectations, not redefine them

Compatibility note:

- flat metadata aliases may exist for backward compatibility
- they should not be the primary documented convention for new adopters
- this convention is Anarchitects-specific guidance, not a dbt default
- extension resolution should prefer `meta.anarchitects.governance.*` over legacy flat dbt metadata paths
- legacy paths remain compatibility fallbacks, and adapter/runtime integration coverage still needs to be verified separately

## Mapping To Canonical Governance Concepts

| dbt metadata                                       | Canonical concept                                    | Notes                                            |
| -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| `meta.anarchitects.governance.layer`               | `classification.layer`                               | e.g. `staging`, `intermediate`, `marts`          |
| `meta.anarchitects.governance.domain`              | `classification.domain`                              | business or data domain                          |
| `meta.anarchitects.governance.owner.team`          | `ownership.team`                                     | accountable team                                 |
| `meta.anarchitects.governance.owner.contacts[*]`   | `ownership.contacts[*]`                              | future-oriented unless explicit support is added |
| `meta.anarchitects.governance.criticality`         | dbt governance metadata / criticality interpretation | extension-owned semantics                        |
| `meta.anarchitects.governance.publicInterface`     | public/governed interface interpretation             | dbt extension semantics                          |
| `meta.anarchitects.governance.crossDomainApproved` | cross-domain approval evidence                       | used by dbt-specific approval rules when present |
| dbt `description`                                  | documentation evidence                               | dbt-native documentation                         |
| `config.contract.enforced`                         | contract evidence                                    | dbt-native contract config                       |

Conceptual canonical output example:

```json
{
  "classification": {
    "layer": "marts",
    "domain": "sales"
  },
  "ownership": {
    "team": "analytics"
  },
  "metadata": {
    "criticality": "high",
    "publicInterface": true,
    "documentation": true
  }
}
```

Important ownership note:

- canonical `classification.*` and `ownership.*` belong in Core fields after adapter normalization
- `criticality`, `publicInterface`, and cross-domain approval interpretation remain dbt-extension concerns even when sourced from dbt metadata

## Current Support Vs Future Support

This section is intentionally conservative and reflects the current repository code, not the proposed future convention.

### Already Supported Today

- The host/runtime/adapter/extension/core split is implemented and documented.
- Canonical `classification.layer` and `classification.domain` are already normalized from current dbt metadata conventions such as `meta.governance.layer`, `meta.governance.domain`, flat `meta.layer`, and flat `meta.domain`.
- For dbt sources, source-level metadata precedence is already normalized through `source_meta`, including `source_meta.governance.*` and flat `source_meta.*`.
- Canonical `ownership.team` is already derived from current manifest shapes such as top-level `owner`, `group`, `config.meta.governance.owner`, `config.meta.owner`, `meta.governance.owner`, and flat `meta.owner`.
- Documentation evidence is already derived from dbt descriptions/docs metadata.
- Contract evidence is already derived from dbt contract metadata such as `config.contract`.
- Public interface interpretation is already supported through current signals in `meta.public`, `meta.governed`, and `public`/`governed` tags.
- Criticality interpretation is already supported from current metadata paths such as `meta.criticality` and source metadata normalization.
- dbt-specific rules already exist today for layer dependency, mart-to-mart dependency, critical models requiring owner/tests, public models requiring description/contract, and cross-domain dependencies requiring approval.

### Partially Supported Today

- Layer inference from path segments already exists in the dbt extension resolver.
- Domain inference from path segments exists in resolver code when enabled through resolver options, but the stable runtime-exposed configuration surface for that convention should be treated as to verify.
- Canonical ownership contacts can already be derived from top-level manifest `owner` objects with fields such as `name` and `email`, but this is not the same as supporting the proposed `meta.anarchitects.governance.owner.contacts` convention.
- The cross-domain approval rule exists today, but it currently checks relation metadata paths such as `dbt.lineage.*`; the adapter does not yet project the proposed resource-level `meta.anarchitects.governance.crossDomainApproved` field into those relation-level facts.

### Requires Future Adapter/Runtime/Extension Support

- Direct support for the recommended nested namespace `meta.anarchitects.governance.*`
- Support for nested `owner.team` under that namespace
- Support for nested `owner.contacts` under that namespace
- Support for `publicInterface` from the recommended namespace instead of today's `meta.public` / `meta.governed` conventions
- Support for `crossDomainApproved` from the recommended namespace, including any required projection from resource metadata to relation-level approval evidence
- Any dbt-native tests or helper macros that validate the new convention before the external host runs
- Clear documentation for `profile.path` plus `profile.document` precedence when both are used

Bottom line:

- the recommended convention is a forward-looking contract for the companion package
- the current adapter/extension path is close enough to map the same concepts
- it does not yet natively support the exact proposed nested namespace

## Relationship To `governance.profile.yml`

Project metadata and governance profile configuration have different responsibilities:

- dbt metadata describes resources
- the governance profile describes intended governance policy and architecture rules

Examples:

- `layer`, `domain`, and `owner` describe the resource
- allowed layer dependencies, allowed domain dependencies, ownership requirements, and rule configuration describe policy

Important clarification:

- `staging -> intermediate -> marts` is an Anarchitects governance convention, not a dbt default
- `allowedLayerDependencies`, `allowedDomainDependencies`, ownership requirements, and rule config belong in the governance profile / host-runtime configuration path, not in the companion dbt package itself

Current host behavior:

- `profile.path` can point at a separate YAML or JSON governance profile file
- `profile.document` can overlay that file for explicitly provided fields

Practical recommendation:

- teams may keep a `governance.profile.yml` file as their intended policy document
- use `profile.document` only for inline overrides or small environment-specific adjustments

Starter profile example aligned with the current host-dbt documentation:

```yaml
name: dbt
layers:
  - staging
  - intermediate
  - marts
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
          - intermediate
          - marts
```

Additional policy fields that belong with the profile rather than dbt resource metadata include:

- `allowedDomainDependencies`
- `ownership.required`
- health thresholds
- rule enablement/severity/options

## Release/Distribution Strategy

Initial recommendation:

- develop the companion package in this monorepo first
- publish later as a dbt package only when the metadata contract and helper surface are stable
- keep Python CLI installation separate from dbt package installation
- document local installation for demos before deciding on a public registry release path

Example local `packages.yml` for demos:

```yaml
packages:
  - local: ../anarchitecture-community/packages/governance/dbt-package
```

Release constraints:

- do not imply that `dbt deps` installs `anarchitecture-dbt-governance`
- do not imply a public dbt package registry release before that decision exists
- keep the PyPI package and dbt package as separate deliverables with separate installation instructions

## Follow-Up Issues

Proposed follow-up implementation issues:

- Scaffold the initial companion dbt package at `packages/governance/dbt-package/`
- Add docs blocks for governance metadata concepts and examples
- Add safe helper macros and `run-operation` template printers
- Add generic dbt metadata tests for the recommended convention
- Add DuckDB-backed demo project integration
- Add adapter/extension support for `meta.anarchitects.governance.*`
- Add relation-level approval projection for cross-domain approval evidence if the rule should read that metadata
- Document combined installation and usage alongside `anarchitecture-dbt-governance`
- Decide the long-term release/distribution model

## Acceptance Criteria

This strategy document satisfies issue #425 when:

- a package name recommendation exists
- a package location recommendation exists
- the dbt metadata convention is documented
- the mapping to canonical governance concepts is documented
- known implementation gaps are identified
- the relationship to `governance.profile.yml` is clear
- boundaries with `governance-host-dbt`, runtime, adapter, extension, and core are explicit
- no unsupported behavior is claimed
