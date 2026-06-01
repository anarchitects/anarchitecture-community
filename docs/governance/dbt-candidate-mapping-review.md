# dbt Candidate Mapping Review

Status:
Architecture review for GitHub issue #204. This document uses the planned dbt adapter as a concrete stress test for the current Governance Core implementation and canonical model. It does not implement the adapter and does not decide the target model.

## Purpose

This review evaluates whether dbt concepts can be mapped into the current `@anarchitects/governance-core` workspace, project, dependency, diagnostics, capability, rule, metric, signal, and assessment model.

The review also checks whether a dbt-driven mapping approach would generalize to other ecosystems, or whether it exposes evidence for broader Core model work in #205 and #206.

Out of scope:

- implementing `@anarchitects/governance-adapter-dbt`
- changing production behavior
- changing Core contracts
- introducing new canonical types
- changing rules, metrics, signals, scoring, diagnostics, adapters, CLI, extensions, or tests
- implementing Phase 1 changes from #201
- finalizing the target Core model for #206

Sources reviewed:

- GitHub issue #143, `Epic: dbt Governance Adapter`
- `docs/governance/core-implementation-audit.md`
- `packages/governance/core/src/core/models.ts`
- `packages/governance/core/src/core/adapter.ts`
- `packages/governance/core/src/core/rules.ts`
- `packages/governance/core/src/core/built-in-rules.ts`
- `packages/governance/core/src/core/metrics.ts`
- `packages/governance/core/src/core/signals.ts`
- `packages/governance/core/src/core/signal-builders.ts`
- `packages/governance/core/src/core/assessment-artifacts.ts`
- `packages/governance/core/src/core/health.ts`
- `packages/governance/core/src/extensions/contracts.ts`
- `packages/governance/core/src/extensions/capabilities.ts`
- `packages/governance/core/src/extensions/diagnostics.ts`
- `packages/governance/adapter-typescript/README.md`
- `packages/governance/cli/README.md`
- dbt docs for models, seeds, data tests, metrics, semantic models, artifacts, and artifact schemas

External dbt references reviewed:

- `https://docs.getdbt.com/docs/build/models`
- `https://docs.getdbt.com/docs/build/seeds`
- `https://docs.getdbt.com/docs/build/snapshots`
- `https://docs.getdbt.com/docs/build/exposures`
- `https://docs.getdbt.com/docs/build/data-tests`
- `https://docs.getdbt.com/docs/build/metrics-overview`
- `https://docs.getdbt.com/docs/build/semantic-models`
- `https://docs.getdbt.com/docs/build/groups`
- `https://docs.getdbt.com/docs/build/jinja-macros`
- `https://docs.getdbt.com/docs/build/packages`
- `https://docs.getdbt.com/reference/artifacts/manifest-json`
- `https://docs.getdbt.com/reference/artifacts/catalog-json`
- `https://docs.getdbt.com/reference/artifacts/run-results-json`
- `https://docs.getdbt.com/reference/artifacts/sources-json`
- `https://docs.getdbt.com/reference/artifacts/sl-manifest`
- `https://schemas.getdbt.com/`

## Context

Issue #143 proposes `@anarchitects/governance-adapter-dbt` under `packages/governance/adapter-dbt`.

The proposed architectural split is:

- `governance-core` owns canonical workspace/project/dependency contracts.
- `governance-adapter-dbt` owns dbt project/artifact discovery and normalization.
- `governance-extension-dbt` owns dbt-specific governance signals, metrics, rules, diagnostics, and recommendations.

The issue explicitly frames the adapter as deterministic and local-first. Initial sources are `manifest.json` and `dbt_project.yml`, with `catalog.json`, `run_results.json`, and `sources.json` as optional follow-up artifacts.

The issue's candidate mapping is:

| dbt Concept                             | Governance Concept                         |
| --------------------------------------- | ------------------------------------------ |
| dbt project                             | Governance workspace                       |
| dbt model/source/seed/snapshot/exposure | Governance project or asset node           |
| `ref()` / `source()` dependencies       | Governance dependency                      |
| tags/meta/group/owner/path              | project metadata, domain, layer, ownership |
| materialization                         | project metadata                           |
| tests/contracts/docs                    | project metadata/capabilities              |

The definition of done for #143 requires the adapter to detect a dbt Core project, load local dbt artifacts, emit `GovernanceWorkspaceAdapterResult`, represent dbt DAG dependencies as Governance dependencies, preserve dbt metadata, work with the existing CLI adapter loading model, and include representative fixtures.

This review treats that candidate adapter as a stress test for the current Core model rather than as implementation work.

## Relevant dbt Concepts

dbt project:

- a project is the top-level dbt workspace context, configured by `dbt_project.yml`
- project files include models and resource configurations
- project-level settings include paths, package name, model configs, profile settings, and macro/materialization behavior

Model:

- a model is a dbt transformation resource
- models are commonly SQL files and can also be Python models
- models can depend on other models through `ref()`
- models materialize into warehouse relations such as tables, views, incremental models, or ephemeral transformations

Source:

- a source represents raw/input data already present in the warehouse or platform
- models can depend on sources through `source()`
- source metadata can include database, schema, table, freshness, loaded-at fields, descriptions, and tests

Seed:

- a seed is a CSV file in a dbt project
- dbt can load seeds into the data warehouse
- seeds can participate in the DAG and can be referenced by models

Snapshot:

- a dbt snapshot captures slowly changing records over time
- it is a dbt resource and DAG node
- its name collides with Governance Core snapshot terminology, which currently means serialized assessment history

Exposure:

- an exposure represents downstream use of dbt resources, such as dashboards, notebooks, applications, ML models, or analyses
- exposures are useful for impact analysis and consumer visibility
- exposures are not transformation projects in the current Governance Core sense

Metric:

- a dbt metric is a semantic metric definition, not a Governance Core `Measurement`
- dbt metrics can be simple, cumulative, derived, ratio, or conversion metrics
- metrics depend on semantic models and other metric definitions

Semantic model:

- semantic models define semantic layer entities, dimensions, measures, and time dimensions
- they sit between physical model data and metrics

Test:

- dbt data tests are assertions over models and other resources
- singular tests are SQL files
- generic tests are reusable parameterized assertions
- test run status lives in run results when executed

Macro:

- a macro is reusable Jinja logic
- generic data tests are implemented using test blocks that behave like macros
- macros are part of the manifest but do not naturally map to project dependencies

Package:

- packages are external or internal dbt dependencies installed through dbt package mechanisms
- packages can contribute models, macros, tests, and other resources

Dependencies:

- dbt lineage includes `ref()` model dependencies and `source()` source dependencies
- manifest metadata includes `depends_on.nodes`, plus `parent_map` and `child_map`
- dependencies can cross package boundaries

Materialization:

- materialization describes how dbt builds a resource in the warehouse
- examples include table, view, incremental, ephemeral, seed, snapshot, or adapter-specific strategies

Tags, meta, group, owner:

- tags are dbt resource labels
- `meta` is open structured metadata
- groups organize resources and can carry ownership concepts
- owner-like fields can appear through groups, metadata, catalog metadata, or project conventions

Artifacts:

- `manifest.json` contains a full representation of parsed project resources, including nodes, sources, metrics, exposures, groups, macros, docs, parent/child maps, selectors, and disabled resources
- `catalog.json` contains warehouse metadata for dbt models, seeds, snapshots, and sources, including columns and relation metadata
- `run_results.json` contains status, timing, adapter response, and execution metadata for executed nodes only
- `sources.json` contains source freshness results
- semantic manifest artifacts represent semantic layer metadata

## Current Governance Core Concepts

Current Core concepts relevant to dbt mapping:

- `GovernanceWorkspace`: one inventory boundary with id, name, root, projects, and dependencies
- `GovernanceProject`: the primary governable unit with id, name, root, type, tags, domain, layer, ownership, and metadata
- `GovernanceDependency`: a directed source-to-target relationship with type and optional source file
- `GovernanceWorkspaceAdapterResult`: adapter result containing workspace parts, projects, dependencies, diagnostics, capabilities, and metadata
- `GovernanceDiagnostic`: generic code/message/source/details diagnostic
- `GovernanceCapability`: generic id/version/data capability envelope
- `GovernanceRule`: evaluates a workspace and can emit violations, signals, and measurements
- built-in rules: domain boundary, layer boundary, ownership presence, project name convention, tag convention, missing domain, and missing layer
- `Measurement`: scored metric output, not semantic business metric definition
- `GovernanceSignal`: finding/event stream keyed around source project, target project, and related project ids
- `GovernanceAssessment`: aggregate workspace assessment output
- `HealthScore`: weighted score from measurements, with status, grade, hotspots, and explainability

Current Core constraints from the #203 implementation audit:

- the central entity is named project
- project roots and source files are first-class
- the central relation is project-to-project dependency
- dependency type is limited to `static`, `dynamic`, `implicit`, or `unknown`
- `scope` exists on adapter input but not canonical project
- dependency metadata exists on adapter input but is not retained in canonical dependencies
- built-in metrics assume project count and dependency count are meaningful
- built-in signals and rules assume project-to-project dependency governance
- capabilities and metadata are flexible but untyped

## Candidate Mapping

| dbt concept                | Current Governance concept                      | Fit                                       | Notes                                                                                                                                                                        |
| -------------------------- | ----------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dbt project                | `GovernanceWorkspace`                           | Natural fit                               | A dbt project is a coherent local inventory boundary with a root, name, config, and artifacts.                                                                               |
| dbt package root           | Workspace metadata or capability                | Acceptable but imperfect fit              | Package identity is important, but Core has no package boundary concept. Treating every package as a project would distort DAG nodes.                                        |
| dbt model                  | `GovernanceProjectInput`                        | Acceptable but imperfect fit              | A model is a DAG node with identity, path, tags, metadata, and dependencies. It is not a code project, so `type` would likely be `unknown` unless forced to `library`.       |
| SQL model file path        | `root` or `metadata.originalFilePath`           | Acceptable but imperfect fit              | The current project root expects a directory-like root. A model file is often a single SQL file under `models/`.                                                             |
| Python model file path     | `root` or metadata                              | Acceptable but imperfect fit              | Same shape as SQL model path, but language-specific details should remain metadata.                                                                                          |
| dbt source                 | `GovernanceProjectInput`                        | Forced fit                                | Sources are external input relations, not projects. Mapping them as projects allows lineage edges but weakens semantics.                                                     |
| dbt seed                   | `GovernanceProjectInput`                        | Acceptable but imperfect fit              | Seeds are file-backed data resources and can participate in lineage, but they are not projects.                                                                              |
| dbt snapshot resource      | `GovernanceProjectInput`                        | Acceptable but imperfect fit              | It is a DAG node, but the term snapshot conflicts with Core's assessment snapshot concept. Preserve `resource_type: snapshot`.                                               |
| dbt exposure               | `GovernanceProjectInput`                        | Forced fit                                | Exposures are downstream consumers or use cases, not buildable projects. They expose a missing consumer/usage abstraction.                                                   |
| dbt metric                 | Core `Measurement`                              | Forced fit                                | A dbt metric is a semantic definition. A Core `Measurement` is a calculated governance score. Treat dbt metrics as metadata or future semantic nodes, not Core measurements. |
| semantic model             | `GovernanceProjectInput`                        | Forced fit                                | It is a semantic-layer model, not a code project. It needs a model/entity abstraction if made first-class.                                                                   |
| data test                  | Metadata or extension finding input             | Should be handled by future dbt extension | Adapter can preserve test definitions and run results. Rule evaluation and signal generation belong in `governance-extension-dbt`.                                           |
| unit test                  | Metadata or extension finding input             | Should be handled by future dbt extension | Same as data tests; status and coverage can inform extension metrics/signals.                                                                                                |
| macro                      | Metadata or capability                          | Should remain dbt-specific metadata       | Macros are reusable implementation logic. They do not naturally fit projects or dependencies unless future analysis needs macro-level governance.                            |
| generic test macro         | Metadata or extension input                     | Should be handled by future dbt extension | Useful for test coverage/quality signals, not for Core adapter normalization.                                                                                                |
| dbt package dependency     | Capability or metadata                          | Missing abstraction                       | Package dependencies are not project DAG dependencies. They may need package/component relation support later.                                                               |
| `ref()` dependency         | `GovernanceDependencyInput`                     | Natural fit                               | A dbt ref is a directed lineage edge between dbt resources. Current dependency type would likely be `static`.                                                                |
| `source()` dependency      | `GovernanceDependencyInput`                     | Acceptable but imperfect fit              | The edge is natural, but the source endpoint is not a project unless forced.                                                                                                 |
| `depends_on.nodes`         | `GovernanceDependencyInput[]`                   | Natural fit                               | This is the best deterministic source for local DAG edges.                                                                                                                   |
| `parent_map` / `child_map` | Dependency derivation metadata                  | Natural fit                               | Useful for verification, but adapter should avoid duplicating edges if `depends_on.nodes` is already authoritative.                                                          |
| materialization            | Project metadata                                | Should remain dbt-specific metadata       | Materialization is important for dbt interpretation but should not become a Core project type.                                                                               |
| tags                       | `tags`                                          | Natural fit                               | dbt tags can map directly to Core tags. Prefix conventions may be optional.                                                                                                  |
| `meta`                     | `metadata.dbt.meta`                             | Should remain dbt-specific metadata       | `meta` is intentionally open and should be preserved without flattening.                                                                                                     |
| group                      | `domain`, `scope`, tags, ownership, or metadata | Acceptable but imperfect fit              | Group may map to ownership/domain in some organizations, but not universally. Preserve original group metadata.                                                              |
| owner                      | `ownership` and metadata                        | Acceptable but imperfect fit              | Owner may be group-level, catalog-level, or meta-convention based. Core ownership can represent team/contact but provenance must be preserved.                               |
| description/docs           | `metadata.documentation` and metadata           | Acceptable but imperfect fit              | Core has documentation completeness based on `metadata.documentation`; dbt has richer docs/description semantics.                                                            |
| contracts                  | Metadata or extension input                     | Should be handled by future dbt extension | Contracts can drive quality/conformance signals but should not be flattened into Core rules by the adapter.                                                                  |
| catalog columns            | Metadata or extension input                     | Should remain dbt-specific metadata       | Column metadata is too detailed for current project model but valuable for extension metrics.                                                                                |
| run result status          | Diagnostic, metadata, or extension input        | Should be handled by future dbt extension | Runtime status can produce operational findings; adapter should preserve, not evaluate.                                                                                      |
| source freshness result    | Diagnostic, metadata, or extension input        | Should be handled by future dbt extension | Freshness is source-specific operational governance, not a Core dependency concept.                                                                                          |
| disabled resources         | Diagnostics or metadata                         | Acceptable but imperfect fit              | Disabled resources can be reported or preserved, but mapping them as active projects would be misleading.                                                                    |
| dbt selectors              | Metadata or capability                          | Should remain dbt-specific metadata       | Selectors are dbt execution/view definitions, not Core profiles.                                                                                                             |
| manifest artifact version  | Capability and adapter metadata                 | Natural fit                               | The adapter should expose supported artifact versions and parsed version data.                                                                                               |
| catalog artifact version   | Capability and adapter metadata                 | Natural fit                               | Same as manifest version, especially when optional enrichment is present.                                                                                                    |
| semantic manifest          | Capability and metadata                         | Missing abstraction                       | Semantic-layer content points to broader model/entity abstractions.                                                                                                          |

## Natural Fits

The most natural fits are:

- dbt project to `GovernanceWorkspace`
- manifest-based resource identity to project input identity
- `ref()` dependencies to directed Governance dependencies
- manifest `depends_on.nodes` to dependency extraction
- dbt tags to Core tags
- artifact parsing diagnostics to Core diagnostics
- artifact support/version information to capabilities
- high-level adapter metadata to `GovernanceWorkspaceAdapterResult.metadata`

These fit because they match existing Core concepts without changing their meaning.

## Imperfect Fits

Imperfect but workable mappings:

- dbt models as `GovernanceProjectInput`
- seeds as `GovernanceProjectInput`
- snapshots as `GovernanceProjectInput`
- source file paths as project roots
- dbt groups as domain/scope/ownership hints
- dbt owner-like metadata as Core ownership
- dbt docs/description completeness as `metadata.documentation`
- `source()` lineage as dependencies when source endpoints are represented as project inputs

These mappings are practical for an MVP but should be documented as semantic compromises. They preserve enough structure for current Core to evaluate dependencies and metadata, but they blur the difference between a code project and a data resource.

## Forced Fits

Forced mappings:

- sources as projects
- exposures as projects
- semantic models as projects
- dbt metrics as Core measurements
- package dependencies as project dependencies
- tests as Core rules or violations emitted directly by the adapter
- source freshness failures as Core built-in signals

The common problem is that current Core only has projects and dependencies as inventory primitives. dbt has data resources, external sources, downstream consumers, semantic definitions, quality assertions, packages, and runtime results. Forcing all of these into projects/dependencies would produce technically valid Core data but weaker governance semantics.

## Missing Abstractions

The dbt mapping exposes likely missing abstractions for target-model discussion:

- generic asset/entity node beyond `GovernanceProject`
- relation abstraction beyond `GovernanceDependency`
- relation type vocabulary broader than `static`, `dynamic`, `implicit`, and `unknown`
- typed endpoint references instead of unqualified source/target strings
- resource kind or asset kind as a stable field
- source-of-truth and artifact provenance
- perspective/viewpoint distinction, such as intended model, documented model, implemented DAG, and runtime result
- confidence/authority for data from manifest, catalog, run results, source freshness, and adapter inference
- first-class consumer/use-case concepts for exposures
- semantic definition concepts for metrics and semantic models
- package/component concepts that are separate from DAG resources
- preservation of relationship metadata in canonical relations
- capability-aware rule/metric/signal selection

These are implications, not final design decisions.

## Adapter Versus Extension Responsibilities

Adapter responsibilities for a future dbt adapter:

- detect dbt projects and local artifacts
- load and validate supported artifact versions
- emit `GovernanceWorkspaceAdapterResult`
- map manifest resources into project inputs only where needed for current Core compatibility
- map manifest DAG edges into dependency inputs
- preserve dbt metadata under stable dbt-specific metadata keys
- emit deterministic diagnostics for missing, unsupported, or invalid artifacts
- emit capabilities describing artifact support and optional metadata enrichment
- avoid rule evaluation and scoring

Extension responsibilities for a future dbt extension:

- evaluate dbt-specific rules
- emit dbt-specific signals
- emit dbt-specific measurements
- interpret tests, contracts, docs, freshness, catalog metadata, and run results
- produce dbt-aware recommendations
- decide how to score data-quality, documentation, freshness, semantic-model, and exposure coverage
- use preserved adapter metadata and capabilities as inputs

Core responsibilities that should not move into the dbt adapter:

- generic adapter contract ownership
- canonical assessment construction
- generic rule engine
- generic extension runtime
- generic health/scoring mechanics

Boundary observation:

- Issue #143's adapter/extension split is sound. The adapter should normalize and preserve; the extension should interpret.

## Metadata Preservation Requirements

The adapter should avoid flattening dbt-specific semantics into generic strings when preserving source metadata.

Minimum metadata to preserve per mapped resource:

- `unique_id`
- `resource_type`
- `package_name`
- `path`
- `original_file_path`
- `database`
- `schema`
- `alias`
- `name`
- `tags`
- `meta`
- `group`
- owner-related fields where present
- `materialized` or materialization config
- model language when available
- descriptions/docs presence
- contracts presence and key settings
- tests associated with the resource
- catalog column metadata when catalog artifact is available
- run status/timing when run-results artifact is available
- source freshness status when sources artifact is available

Metadata to preserve at workspace or adapter-result level:

- dbt project name
- dbt project root
- dbt project version/config version where available
- artifact paths
- artifact schema versions
- adapter package id/version
- parsed package names
- supported artifact capability ids
- parse/load diagnostics

Important preservation gap in current Core:

- `GovernanceDependencyInput.metadata` is available at adapter input level but is not retained in canonical `GovernanceDependency`. If dbt dependency metadata needs to survive normalization, it must currently be duplicated elsewhere, such as project metadata, workspace metadata, or extension-specific side input. This is a concrete stress-test finding for #206.

## Cross-Ecosystem Stress Test

### Maven / Gradle / Java

What maps similarly:

- build root or multi-module build can map to `GovernanceWorkspace`
- modules can map to `GovernanceProjectInput`
- module dependencies can map to `GovernanceDependencyInput`
- group/artifact/version and plugin metadata can be preserved in metadata
- package ownership and tags can map through metadata and tags

Where the dbt mapping generalizes:

- module graphs are closer to TypeScript package graphs than dbt resource graphs
- project/dependency terminology is acceptable for code modules
- dependency types still need more nuance for compile/runtime/test/provided/plugin dependencies

Where the dbt mapping does not generalize cleanly:

- Maven/Gradle have dependency scopes, configurations, plugins, tasks, publications, and external artifacts
- current dependency type vocabulary is too narrow
- build outputs and runtime dependencies are not the same as architectural dependencies

Stress-test result:

- Current Core is workable for Java build modules, but relation metadata and relation type richness would matter quickly.

### GitHub

What maps similarly:

- an organization, repository set, or repository could map to `GovernanceWorkspace`
- repositories might map to `GovernanceProjectInput`
- repository dependencies, submodules, workflow dependencies, or issue links might map to dependencies
- labels, topics, CODEOWNERS, teams, and branch protection can map to tags, ownership, metadata, diagnostics, or extension inputs

Where the dbt mapping generalizes:

- preserving platform-specific metadata for extension interpretation is clearly necessary
- adapter versus extension split remains useful

Where the dbt mapping breaks:

- issues, pull requests, projects, Actions workflows, environments, deployments, branch protections, and reviews are not projects
- relationships are not just dependencies; they include ownership, review, workflow execution, policy enforcement, references, status checks, and planning hierarchy
- runtime state and intended policy state need different perspectives

Stress-test result:

- Mapping GitHub into projects/dependencies would be forced except for repositories-as-projects. A node/relation model or multiple inventory perspectives would likely generalize better.

### Atlassian

What maps similarly:

- Jira projects, Confluence spaces, Bitbucket repositories, or Bamboo plans could map to workspaces or projects depending on adapter scope
- links and references can be represented as relationships
- labels, components, owners, teams, and permissions can be metadata or tags

Where the dbt mapping generalizes:

- platform-specific metadata should be preserved and interpreted by extensions
- diagnostics and capabilities can describe which products/artifacts were available

Where the dbt mapping breaks:

- Jira issues, epics, components, releases, Confluence pages, Bitbucket PRs, and Bamboo plans do not share one project abstraction
- relationships include planning hierarchy, documentation links, source links, deployment links, approval state, and workflow state
- project-to-project dependency rules are not the natural governance primitive

Stress-test result:

- Current Core can represent a small subset but would force most Atlassian concepts into metadata or fake projects.

### Governance Platforms

Examples:

- Collibra
- Microsoft Purview
- OpenMetadata
- DataHub

What maps similarly:

- a catalog tenant, domain, data product, or platform export could map to `GovernanceWorkspace`
- data assets can be forced into `GovernanceProjectInput`
- lineage can map to dependencies
- domains, owners, classifications, glossary terms, tags, and policies can map partly to tags/ownership/metadata

Where the dbt mapping generalizes:

- data lineage resembles dbt DAG edges
- metadata preservation is essential
- extension-owned metrics/signals are likely needed

Where the dbt mapping breaks:

- governance platforms already have richer asset, relation, term, policy, stewardship, certification, classification, and lineage models
- forcing assets into projects weakens the source platform's semantics
- source-of-truth and authority matter because governance platforms may be authoritative over ownership/classification while dbt may be authoritative over implemented transformations

Stress-test result:

- The dbt mapping points directly toward generic nodes/assets, typed relations, authority, and perspective concepts.

### Architecture Platforms

Examples:

- LeanIX
- Bizzdesign
- Ardoq
- Structurizr
- Archi

What maps similarly:

- a workspace/model/export can map to `GovernanceWorkspace`
- systems, applications, components, containers, interfaces, or architecture elements can be forced into projects
- relationships can be forced into dependencies
- tags, domains, layers, owners, lifecycle, and criticality can be metadata or classifications

Where the dbt mapping generalizes:

- a graph of typed elements and relationships can be evaluated by governance rules
- documentation and ownership signals can be useful

Where the dbt mapping breaks:

- architecture platforms model intent and documented architecture, not just implemented dependency graphs
- relationships have rich semantics such as realizes, serves, depends on, flows to, owns, uses, exposes, and is documented by
- viewpoints and model authority are central
- current Core cannot distinguish intended architecture from implemented reality or runtime evidence

Stress-test result:

- Architecture platforms expose the need for perspective/viewpoint and intent-versus-reality abstractions. Current project/dependency mapping is too narrow for serious use.

## Implications For Target Core Model

Evidence from dbt suggests:

- `GovernanceProjectInput` is probably too narrow as the only primary inventory input.
- `GovernanceDependencyInput` is probably too narrow as the only relation input.
- A node/relation-style abstraction may be needed for future adapters.
- The current `project` abstraction remains useful for code projects and can remain a compatibility surface, but it should not necessarily be the only canonical entity.
- The current `dependency` abstraction remains useful for code and lineage edges, but relation type and relation metadata need deeper treatment.
- Adapter output may need to preserve both normalized canonical graph data and source-specific graph data without relying only on untyped metadata.
- Intent, documented reality, implemented reality, and runtime reality appear as distinct perspectives across dbt, GitHub, Atlassian, governance platforms, and architecture platforms.
- Source-of-truth, viewpoint, confidence, and authority concepts may be needed when the same asset is described by dbt, a catalog, a repository, and an architecture platform.
- Rule evaluation may need to become capability-aware or inventory-kind-aware to avoid running project dependency rules against non-project inventories.
- Metrics and scoring may need adapter/extension-selected families so Core does not imply codebase health from data-platform or workflow-platform inventories.
- Signals may need generic entity/relation fields in addition to project-specific fields.
- Diagnostics may need standard severity and location fields across adapters.
- Dependency metadata preservation is a concrete near-term issue because dbt edge semantics can matter.

These are target-model implications for #206, not decisions in this review.

## Follow-Up Questions For #205

- Do other planned adapters show the same pressure toward generic assets/entities?
- Which current Core areas can remain compatibility surfaces without becoming the only model?
- Which concepts are shared across dbt, GitHub, Atlassian, governance catalogs, and architecture platforms?
- Which concepts should remain extension-specific rather than canonical?
- Which current metrics would be misleading for dbt and other non-code inventories?
- How should adapter capabilities influence rule, metric, and signal selection?
- Are there existing internal or external consumers that depend on project/dependency names remaining central?
- Should #205 compare dbt mapping against at least one code ecosystem and one platform ecosystem in more detail?

## Follow-Up Questions For #206

- Should Core introduce a generic node/entity/asset contract?
- Should Core introduce typed relation contracts with metadata preservation?
- Should `GovernanceProject` become a specialized node type, a compatibility view, or remain the canonical unit?
- Should `GovernanceDependency` become a specialized relation type, a compatibility view, or remain canonical?
- Should Core model source-of-truth, confidence, authority, or perspective?
- Should Core distinguish intended architecture, documented architecture, implemented architecture, and runtime evidence?
- Should signals and findings reference generic entities instead of project ids?
- Should built-in rules and metrics become capability-gated?
- Should adapter results support richer source graph payloads for extensions without forcing all data through project metadata?
- Should dbt metrics and Core measurements be renamed or clarified to avoid semantic collision?

## Conclusion

dbt is a useful first stress test because it is close enough to the current model to be mapped, but rich enough to expose the model's limits.

Natural fits exist: a dbt project can map to a Governance workspace, dbt DAG edges can map to dependencies, tags can map to tags, and artifacts can produce diagnostics and capabilities. An MVP adapter could emit Core-compatible `GovernanceWorkspaceAdapterResult` without changing production behavior.

The fit becomes imperfect or forced when dbt resources are not code projects. Sources, exposures, semantic models, metrics, tests, packages, catalog metadata, and run results expose missing concepts: asset kinds, typed relations, relation metadata, source authority, runtime evidence, semantic definitions, and extension-owned interpretation.

The adapter/extension split from issue #143 remains the right boundary for the current architecture review: the adapter should discover, normalize, and preserve; a future dbt extension should interpret and score. #205 and #206 should use this review as evidence when evaluating broader Core abstractions and target model changes.
