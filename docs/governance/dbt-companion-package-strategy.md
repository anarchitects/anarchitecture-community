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
- legacy paths remain compatibility fallbacks
- the adapter already projects supported nested governance metadata into canonical ownership/domain/layer/documentation fields for governed dbt assets
- dbt-specific semantics such as public interface and cross-domain approval remain extension-owned even when sourced from the nested convention

## Mapping To Canonical Governance Concepts

| dbt metadata                                       | Canonical concept                                    | Notes                                                                    |
| -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `meta.anarchitects.governance.layer`               | `classification.layer`                               | e.g. `staging`, `intermediate`, `marts`                                  |
| `meta.anarchitects.governance.domain`              | `classification.domain`                              | business or data domain                                                  |
| `meta.anarchitects.governance.owner.team`          | `ownership.team`                                     | supported                                                                |
| `meta.anarchitects.governance.owner.name`          | `ownership.team`                                     | supported as a team/name fallback                                        |
| `meta.anarchitects.governance.owner`               | `ownership.team`                                     | supported when supplied as a string                                      |
| `meta.anarchitects.governance.owner.email`         | `ownership.contacts[*]`                              | supported as canonical ownership contact data                            |
| `meta.anarchitects.governance.criticality`         | dbt governance metadata / criticality interpretation | extension-owned semantics                                                |
| `meta.anarchitects.governance.publicInterface`     | public/governed interface interpretation             | resolved into dbt extension metadata/provenance, not a Core field        |
| `meta.anarchitects.governance.crossDomainApproved` | cross-domain approval evidence                       | resolved into dbt extension metadata/provenance; relation projection TBD |
| dbt `description`                                  | documentation evidence                               | projected into canonical governed asset documentation support            |
| `config.contract.enforced`                         | contract evidence                                    | dbt-native contract config                                               |

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

## dbt Resource Role Contract

The dbt adapter and dbt extension now implement an explicit resource-role contract.
Core remains dbt-agnostic and only receives generic canonical nodes, relations,
and metadata markers.

| dbt resource     | role              | canonical node | canonical relation       | extension representation             |
| ---------------- | ----------------- | -------------: | ------------------------ | ------------------------------------ |
| `model`          | data asset        |            yes | data lineage             | node expansion                       |
| `source`         | data asset        |            yes | data lineage             | node expansion                       |
| `seed`           | data asset        |            yes | data lineage             | node expansion                       |
| `snapshot`       | data asset        |            yes | data lineage             | node expansion                       |
| `metric`         | semantic asset    |            yes | no data-lineage relation | `semanticResources` + node expansion |
| `semantic_model` | semantic asset    |            yes | no data-lineage relation | `semanticResources` + node expansion |
| `saved_query`    | semantic asset    |            yes | no data-lineage relation | `semanticResources` + node expansion |
| `exposure`       | consumer context  |             no | no canonical dependency  | `semanticResources`                  |
| `test`           | evidence          |             no | no canonical relation    | `testEvidence`                       |
| `project`        | workspace context |             no | no canonical relation    | workspace project context            |

### Canonical data assets

- `model`, `source`, `seed`, and `snapshot` normalize as canonical governed
  assets.
- They carry `metadata.governance.kind = "asset"` and
  `metadata.governance.assetKind = "data"`.
- Canonical data lineage remains limited to data-asset to data-asset
  dependencies.

### Canonical semantic assets

- `metric`, `semantic_model`, and `saved_query` normalize as canonical governed
  semantic assets.
- They are intentionally distinguishable from data assets through
  `metadata.governance.assetKind = "semantic"`.
- Their dbt-native metadata and dependencies are also preserved in
  extension-owned `semanticResources`.

### Evidence and context

- dbt `test` resources are evidence, not governed assets. They are preserved in
  `testEvidence`.
- dbt `project` data is workspace context, not a governed asset node.
- dbt `exposure` resources are consumer/interface context preserved in
  `semanticResources`.
- Non-canonical does not mean lost. Evidence and context stay available through
  the dbt extension contract.

### Dependency semantics

- Canonical relations are reserved for data lineage between canonical data
  assets.
- Semantic resource dependencies are preserved in
  `semanticResources.dependsOnNodeIds`.
- Semantic dependencies are not emitted as canonical data-lineage relations.
- Exposure dependencies are not emitted as ordinary canonical dependencies.
- Future canonical semantic relations would need a separate generic relation
  contract.

### Extension-owned dbt payload

The dbt workspace expansion keeps dbt-native payload available for downstream
dbt-specific logic. In particular:

- `testEvidence` preserves dbt test evidence outside the canonical graph
- `semanticResources` preserves semantic resource identity, dependencies, and
  dbt-native payload
- workspace project context preserves dbt project-level metadata without
  treating the project as a governed asset
- canonical dbt asset nodes still keep dbt-specific node expansion data
  alongside canonical ownership/classification/documentation fields

## Current Support Vs Future Support

This section reflects the current repository code rather than an earlier
forward-looking proposal.

### Already Supported Today

- The host/runtime/adapter/extension/core split is implemented and documented.
- The adapter interprets the recommended nested namespace
  `meta.anarchitects.governance.*` for governed dbt assets.
- Canonical `classification.layer` and `classification.domain` are normalized
  from both the nested convention and legacy compatibility paths such as
  `meta.governance.layer`, `meta.governance.domain`, flat `meta.layer`, and
  flat `meta.domain`.
- For dbt sources, source-level metadata precedence is normalized through
  `source_meta`, including nested companion metadata and legacy compatibility
  paths.
- Canonical `ownership.team` is derived from top-level `owner`, `group`,
  nested companion owner fields, legacy governance metadata, and source-level
  fallbacks where applicable.
- Companion owner forms are supported for governed assets:
  string owner, `owner.name`, `owner.team`, and `owner.email`.
- Canonical ownership contacts are projected when supported owner metadata
  clearly supplies contact information such as email.
- Documentation evidence is already derived from dbt descriptions/docs metadata.
- Contract evidence is already derived from dbt contract metadata such as `config.contract`.
- Public interface interpretation is resolved into dbt extension metadata from
  nested companion metadata and compatibility paths.
- Criticality interpretation is already supported from nested/legacy metadata
  paths and source metadata normalization.
- Cross-domain approval metadata from the nested convention is resolved into dbt
  extension metadata/provenance.
- The dbt resource-role contract is explicit:
  data assets, semantic assets, evidence, consumer context, and workspace
  context are represented deliberately rather than through negative filtering.
- Canonical dbt data assets use `metadata.governance.assetKind = "data"`.
- Canonical dbt semantic assets use
  `metadata.governance.assetKind = "semantic"`.
- dbt `test` resources are preserved as extension-owned `testEvidence` and are
  not canonical nodes or canonical relations.
- dbt `project` data is preserved as workspace context and is not a canonical
  governed asset.
- dbt semantic resources preserve dbt-native payload and dependencies through
  extension-owned `semanticResources`.
- dbt-specific rules already exist today for layer dependency, mart-to-mart dependency, critical models requiring owner/tests, public models requiring description/contract, and cross-domain dependencies requiring approval.

### Partially Supported Today

- Layer inference from path segments already exists in the dbt extension resolver.
- Domain inference from path segments exists in resolver code when enabled through resolver options, but the stable runtime-exposed configuration surface for that convention should be treated as to verify.
- Relation-level approval projection is still narrower than the resource-level
  metadata contract. The cross-domain approval rule currently depends on
  relation metadata paths such as `dbt.lineage.*`; projecting
  `meta.anarchitects.governance.crossDomainApproved` into those relation-level
  facts remains follow-up work if that rule should consume the resource-level
  field directly.

### Requires Future Adapter/Runtime/Extension Support

- Canonical relation semantics for semantic-resource dependencies if Governance
  later needs them as first-class generic relations
- Richer semantic-resource-specific diagnostics, recommendations, and reporting
  on top of the current extension-owned `semanticResources` payload
- Support for a richer nested ownership contacts convention beyond the currently
  supported owner email/contact projection paths
- Support for `crossDomainApproved` projection from resource metadata into
  relation-level approval evidence if the rule should read that field directly
- Any dbt-native tests or helper macros that validate the new convention before the external host runs
- Clear documentation for `profile.path` plus `profile.document` precedence when both are used

Bottom line:

- the recommended convention is now implemented for governed dbt assets through
  the adapter/extension boundary
- legacy metadata paths remain compatibility fallbacks
- Core still receives only generic canonical assets and relations
- richer semantic relations and some rule-specific projections remain future
  work

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

Closing note:

- #484 establishes the canonical-versus-extension boundary for dbt artifacts.
- Richer semantic-resource diagnostics and any future canonical semantic
  relations are follow-up work, not part of the current contract.
