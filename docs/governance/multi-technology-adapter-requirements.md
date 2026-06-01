# Multi-Technology Governance Requirements

Status:
Requirements and architecture review for GitHub issue #205. This document evaluates multi-technology requirements and architectural ownership boundaries. It does not define the final target model for #206.

## Purpose

This document identifies requirements a technology-neutral Governance Core must satisfy across implementation ecosystems, governance platforms, business architecture platforms, software architecture platforms, and delivery platforms.

It also defines architectural ownership expectations for:

- Governance Core
- adapters
- extensions
- hosts

The goal is to provide evidence and requirements for #206, not to implement or finalize a target model.

Out of scope:

- changing production behavior
- refactoring Core
- introducing new canonical types
- implementing adapters
- implementing extensions
- changing rules, metrics, signals, assessments, diagnostics, adapters, CLI, hosts, plugins, or tests
- final target model design

## Inputs

Primary inputs:

- GitHub issue #205 and its architecture-boundary comment
- `docs/governance/core-implementation-audit.md`
- `docs/governance/dbt-candidate-mapping-review.md`
- `packages/governance/core/src/core/models.ts`
- `packages/governance/core/src/core/adapter.ts`
- `packages/governance/core/src/core/rules.ts`
- `packages/governance/core/src/core/metrics.ts`
- `packages/governance/core/src/core/signals.ts`
- `packages/governance/core/src/core/assessment-artifacts.ts`
- `packages/governance/core/src/extensions/contracts.ts`
- `packages/governance/core/src/extensions/runtime.ts`
- `packages/governance/adapter-typescript/README.md`
- `packages/governance/cli/README.md`

Key findings inherited from #203:

- Current Core is package-boundary neutral but implementation-biased toward projects, dependencies, roots, domains, layers, ownership, and codebase-style health.
- Rule execution is generic, but built-in rules evaluate project-to-project dependency governance.
- Metrics and signals are extensible, but built-in metrics assume project count and dependency count are meaningful denominators.
- Diagnostics and capabilities are generic but under-specified for severity, location, confidence, and authority.
- Capabilities are collected but not currently used by built-in behavior to select rule or metric families.

Key findings inherited from #204:

- dbt can be mapped into current Core, but many concepts become imperfect or forced fits.
- A dbt project maps naturally to a Governance workspace, and dbt lineage maps naturally to dependencies.
- dbt sources, exposures, semantic models, metrics, tests, packages, and runtime artifacts expose likely needs for generic assets, typed relations, source-of-truth, perspective, authority, and metadata preservation.
- Adapter and extension responsibilities should remain separate: adapters discover/normalize/preserve facts; extensions interpret/evaluate those facts.

## Ecosystem Review

### Execution Ecosystems

TypeScript / Nx:

- Entities/assets: workspace, project, package, app, library, tool, source file, target/task, dependency graph node, package manifest.
- Relationships: static imports, dynamic imports, package dependencies, project graph edges, task dependencies, ownership coverage, boundary policy.
- Ownership concepts: project metadata, CODEOWNERS, package ownership, team metadata.
- Classification concepts: project type, tags, domain, layer, scope, package name, source root.
- Lifecycle concepts: generated/inferred projects, build/test/lint targets, releases, affected changes, CI status.
- Metadata concepts: package.json, project config, tsconfig, tags, target metadata, dependency metadata.
- Traceability concepts: source file to project, changed file to affected project, import to dependency, target to output.
- Governance concepts: boundary policy, ownership presence, documentation coverage, dependency complexity, architectural entropy.
- Rule concepts: project naming, tag conventions, domain/layer boundaries, ownership, metadata completeness.
- Metric concepts: dependency complexity, ownership coverage, documentation completeness, architectural health.
- Signal concepts: structural dependency, cross-domain dependency, layer violation, ownership gap.
- Ownership boundary: Core should own stable project/dependency compatibility semantics; adapters should extract workspace and graph facts; extensions should interpret technology-specific graph and target metadata; hosts should compose profiles, adapters, extensions, and reporting.

dbt:

- Entities/assets: dbt project, model, source, seed, snapshot resource, exposure, metric, semantic model, test, macro, package, docs block, group.
- Relationships: `ref()`, `source()`, manifest parent/child maps, metric-to-semantic-model, exposure-to-resource, package contribution, test-to-resource.
- Ownership concepts: groups, owner fields, meta conventions, catalog owner metadata.
- Classification concepts: resource type, tags, meta, group, materialization, package, database/schema, domain conventions.
- Lifecycle concepts: parsed resources, disabled resources, materialized resources, run status, freshness, catalog generation, semantic manifest generation.
- Metadata concepts: manifest, catalog, run results, sources freshness, semantic manifest, descriptions, tests, contracts, columns.
- Traceability concepts: manifest unique ids, original file paths, warehouse relation names, run result unique ids, source freshness references.
- Governance concepts: lineage, documentation coverage, test coverage, freshness, contract coverage, semantic-model coverage, exposure impact.
- Rule concepts: dbt-specific resource coverage, test assertions, contract enforcement, freshness thresholds, exposure documentation.
- Metric concepts: data-quality coverage, documentation coverage, freshness status, failed tests, model runtime, semantic model coverage.
- Signal concepts: stale source, failed model run, missing tests, missing description, unowned resource, undocumented exposure.
- Ownership boundary: Core should not become dbt-specific; adapter should preserve manifest/catalog/run facts; extension should produce dbt-specific rules, metrics, signals, assessments, and recommendations.

Microsoft Fabric:

- Entities/assets: workspace, lakehouse, warehouse, data pipeline, dataflow, notebook, semantic model, report, dashboard, deployment pipeline, item, capacity.
- Relationships: pipeline dependencies, dataset/report dependencies, lakehouse/table lineage, notebook reads/writes, deployment promotion, workspace membership.
- Ownership concepts: workspace admins, item owners, Microsoft Entra groups, capacity ownership, stewardship metadata.
- Classification concepts: workspace, domain, item type, sensitivity labels, endorsement/certification, environment.
- Lifecycle concepts: draft/published items, deployment stages, refresh status, pipeline run status, endorsement state.
- Metadata concepts: item metadata, lineage, refresh history, permissions, sensitivity labels, capacity and workspace settings.
- Traceability concepts: item lineage, deployment pipeline history, refresh/run results, report-to-semantic-model links.
- Governance concepts: data lineage, access governance, certification, sensitivity, refresh reliability, deployment promotion.
- Rule concepts: certified asset coverage, owner coverage, sensitivity label coverage, stale refreshes, broken lineage.
- Metric concepts: certified assets, failed refreshes, lineage completeness, ownership coverage, environment promotion health.
- Signal concepts: failed pipeline, stale semantic model, uncertified report, missing owner, missing sensitivity label.
- Ownership boundary: adapter should extract Fabric facts and preserve item-specific metadata; extension should interpret Fabric governance semantics; host should manage credentials, tenant/workspace selection, and API execution.

Snowflake:

- Entities/assets: account, organization, database, schema, table, view, dynamic table, stream, task, warehouse, role, share, tag, masking policy, row access policy.
- Relationships: object lineage, view dependencies, task graph dependencies, grants, role hierarchy, policy attachments, data sharing.
- Ownership concepts: object owner role, grants, role hierarchy, stewardship tags, database/schema owners.
- Classification concepts: object type, database/schema, tags, domains, sensitivity, environment, retention.
- Lifecycle concepts: created/altered/dropped, clone state, task run state, data freshness, policy lifecycle.
- Metadata concepts: information schema, account usage, object metadata, query history, access history, tags, policies.
- Traceability concepts: query lineage, access history, object dependencies, grants, task histories.
- Governance concepts: access control, data classification, policy enforcement, lineage, cost, freshness, data sharing.
- Rule concepts: sensitive data policy coverage, excessive grants, unowned objects, stale tasks, missing tags.
- Metric concepts: policy coverage, access-risk count, stale object count, failed task rate, classification coverage.
- Signal concepts: unclassified table, missing masking policy, failed task, privileged grant, stale object.
- Ownership boundary: adapter should extract object graph and metadata; extension should evaluate Snowflake-specific governance; host should handle connection, credentials, and query execution boundaries.

Maven / Gradle / Java:

- Entities/assets: multi-module build, module, artifact, dependency, plugin, task, source set, package, class, publication, repository.
- Relationships: compile/runtime/test/provided dependencies, plugin applications, task graph edges, project dependencies, publication dependencies.
- Ownership concepts: module owner, package owner, repository owner, CODEOWNERS, artifact maintainer.
- Classification concepts: group id, artifact id, version, module type, source set, package namespace, tags.
- Lifecycle concepts: build lifecycle, release versions, snapshot versions, test status, publication state, dependency freshness.
- Metadata concepts: POM, Gradle build files, lockfiles, generated dependency graphs, test reports, coverage reports.
- Traceability concepts: dependency path, module-to-artifact, source set to task, changed file to module, release to artifact.
- Governance concepts: dependency hygiene, license/security policy, module boundaries, build reliability, ownership.
- Rule concepts: forbidden dependencies, outdated dependencies, forbidden scopes, missing owners, package naming.
- Metric concepts: dependency freshness, build health, test coverage, module complexity, ownership coverage.
- Signal concepts: vulnerable dependency, forbidden transitive dependency, failed build, stale dependency, unowned module.
- Ownership boundary: adapter should extract module/build graph facts; extensions should evaluate Java/build-specific policy; Core should not encode Maven or Gradle scopes as primitives.

GitHub:

- Entities/assets: organization, repository, issue, pull request, project, workflow, job, run, environment, branch, ruleset, release, package.
- Relationships: issue links, PR closes issue, PR touches files, workflow runs for commit, branch protection applies to branch, repository belongs to team, project item links to issue/PR.
- Ownership concepts: organization owners, repository admins, teams, CODEOWNERS, assignees, reviewers, maintainers.
- Classification concepts: labels, topics, repository visibility, project fields, environments, branch names, rulesets.
- Lifecycle concepts: issue state, PR state, review state, check status, workflow status, release lifecycle, environment deployment state.
- Metadata concepts: labels, milestones, projects, review decisions, status checks, branch rules, Actions logs, security alerts.
- Traceability concepts: commit-to-PR, PR-to-issue, issue-to-project, workflow-to-commit, release-to-tag, deployment-to-environment.
- Governance concepts: delivery workflow compliance, review coverage, CI reliability, repository ownership, security alerts, branch protection.
- Rule concepts: required reviewers, stale PRs, missing CODEOWNERS, failing required checks, untriaged issues, missing labels.
- Metric concepts: review latency, CI pass rate, open vulnerability count, issue age, deployment frequency, ownership coverage.
- Signal concepts: failed workflow, missing review, stale issue, policy bypass, unowned repository, unprotected branch.
- Ownership boundary: adapter should extract repository and workflow facts; extension should evaluate GitHub-specific delivery governance; host should manage GitHub auth, pagination, rate limits, and selected organizations/repositories.

Atlassian:

- Entities/assets: Jira project, issue, epic, component, version, board, sprint, Confluence space, page, Bitbucket repository, pull request, Bamboo plan, build, deployment.
- Relationships: issue hierarchy, issue links, commit/PR links, release/version membership, page links, repository-to-project links, build-to-deployment links.
- Ownership concepts: project leads, component leads, assignees, reporters, space admins, repository owners, plan owners.
- Classification concepts: issue type, status, labels, components, priority, fix version, space, page hierarchy, repository/project key.
- Lifecycle concepts: issue workflow, sprint state, release state, page publishing, PR state, build/deployment status.
- Metadata concepts: custom fields, labels, workflow statuses, permissions, page metadata, build logs, deployment records.
- Traceability concepts: requirement-to-issue, issue-to-commit, issue-to-PR, issue-to-release, page-to-issue, build-to-deployment.
- Governance concepts: delivery traceability, documentation coverage, workflow compliance, release readiness, build quality.
- Rule concepts: missing acceptance criteria, stale issues, missing documentation, unresolved blocker, failed build, missing release evidence.
- Metric concepts: cycle time, blocked age, documentation coverage, build success rate, release readiness, traceability coverage.
- Signal concepts: stale ticket, missing owner, undocumented decision, failed build, release risk, unresolved dependency.
- Ownership boundary: adapters should extract product-specific facts; extensions should evaluate Jira/Confluence/Bitbucket/Bamboo-specific rules; hosts should compose multi-product credentials and scopes.

### Governance Platforms

Collibra:

- Entities/assets: community, domain, asset, business term, data set, policy, rule, stewardship assignment, data product.
- Relationships: asset-to-term, asset-to-policy, lineage, ownership/stewardship, approval workflow, certification.
- Ownership concepts: data owner, data steward, custodian, responsibility assignment, domain ownership.
- Classification concepts: asset type, domain, glossary term, classification, status, criticality, policy category.
- Lifecycle concepts: draft/proposed/approved/deprecated, certification state, workflow state.
- Metadata concepts: attributes, relations, responsibilities, ratings, workflows, comments.
- Traceability concepts: business term to data asset, policy to asset, lineage to technical source, stewardship assignments.
- Governance concepts: glossary governance, stewardship, certification, policy compliance, issue management.
- Rule/metric/signal concepts: unassigned steward, uncertified critical asset, policy gap, stale glossary term, lineage gap.
- Ownership boundary: adapter should extract authoritative governance facts; extension should evaluate Collibra governance maturity and conformance; Core should represent generic ownership/classification/relation requirements.

Microsoft Purview:

- Entities/assets: data asset, collection, glossary term, classification, lineage process, scan, data product, policy.
- Relationships: asset lineage, glossary assignment, classification assignment, collection hierarchy, scan source to asset.
- Ownership concepts: collection admins, asset owners, data stewards, contacts.
- Classification concepts: classifications, sensitivity labels, glossary terms, collections, asset types.
- Lifecycle concepts: scan status, asset update status, glossary term lifecycle, policy lifecycle.
- Metadata concepts: technical metadata, classifications, glossary annotations, lineage, scan metadata.
- Traceability concepts: scan-to-asset, lineage, glossary-to-asset, collection-to-asset.
- Governance concepts: catalog coverage, classification coverage, lineage, data estate ownership, policy coverage.
- Rule/metric/signal concepts: unclassified asset, missing owner, stale scan, missing lineage, glossary coverage gap.
- Ownership boundary: adapter extracts catalog facts; extension evaluates Purview-specific governance state; host manages tenant/auth/scope.

OpenMetadata:

- Entities/assets: service, database, schema, table, dashboard, pipeline, topic, ML model, glossary term, domain, data product, test case.
- Relationships: lineage, ownership, domain membership, glossary tagging, test-to-asset, service-to-asset.
- Ownership concepts: owner, team, user, domain owner, data product owner.
- Classification concepts: tags, glossary terms, tiers, domains, data products, service types.
- Lifecycle concepts: ingestion run, test status, asset status, version history, certification.
- Metadata concepts: schemas, columns, profiling, data quality tests, lineage, usage, tags.
- Traceability concepts: lineage graph, service source, ingestion provenance, test results, change history.
- Governance concepts: data quality, ownership, classification, usage, lineage, discovery completeness.
- Rule/metric/signal concepts: failing tests, missing owner, missing description, missing tier, lineage gaps.
- Ownership boundary: adapter extracts platform graph and metadata; extension interprets data-governance metrics and signals.

DataHub:

- Entities/assets: dataset, chart, dashboard, data flow, data job, ML model, glossary term, domain, data product, assertion.
- Relationships: lineage, ownership, glossary association, domain membership, assertion-to-asset, platform instance.
- Ownership concepts: owners, ownership type, groups, users, domain/data product ownership.
- Classification concepts: tags, glossary terms, domains, data products, platform, entity type.
- Lifecycle concepts: ingestion time, assertion status, deprecation status, operational status.
- Metadata concepts: aspects, schema metadata, usage, lineage, assertions, ownership, tags.
- Traceability concepts: platform source to entity, lineage graph, assertion results, metadata aspect history.
- Governance concepts: discoverability, ownership, data quality assertions, lineage, domain stewardship.
- Rule/metric/signal concepts: missing owner, failing assertion, stale metadata, untagged dataset, lineage break.
- Ownership boundary: adapter should extract entity/aspect facts; extension should evaluate DataHub-specific assertions and governance health.

### Business Architecture Platforms

LeanIX:

- Entities/assets: fact sheet, application, business capability, process, provider, interface, technology, initiative.
- Relationships: application supports capability, interface dependencies, lifecycle relations, ownership, initiative impacts.
- Ownership concepts: fact sheet owner, business owner, IT owner, responsible organization.
- Classification concepts: fact sheet type, lifecycle phase, business criticality, tags, domains.
- Lifecycle concepts: planned, phase-in, active, phase-out, end-of-life, transformation initiative state.
- Metadata concepts: subscriptions, surveys, tags, lifecycle, criticality, cost, technology fit.
- Traceability concepts: capability-to-application, application-to-interface, application-to-technology, initiative-to-impact.
- Governance concepts: application portfolio management, capability coverage, lifecycle risk, technology risk.
- Rule/metric/signal concepts: unsupported technology, owner gaps, lifecycle conflicts, capability gaps, interface risk.
- Ownership boundary: adapter extracts fact sheets and relations; extension interprets LeanIX-specific portfolio health.

Bizzdesign:

- Entities/assets: enterprise architecture elements, capabilities, processes, applications, data objects, technology nodes, requirements, principles.
- Relationships: ArchiMate-style structural, dependency, realization, serving, flow, assignment, access, influence relations.
- Ownership concepts: model owner, element owner, architecture domain owner, stakeholder.
- Classification concepts: architecture layer, viewpoint, element type, lifecycle, domain, capability.
- Lifecycle concepts: baseline, target, transition state, plateau, work package state.
- Metadata concepts: properties, viewpoints, models, roadmaps, assessments.
- Traceability concepts: motivation to requirements to architecture to implementation, baseline-to-target.
- Governance concepts: architecture compliance, target-state progress, capability realization, portfolio alignment.
- Rule/metric/signal concepts: missing realization, undocumented dependency, target-state drift, orphaned capability.
- Ownership boundary: adapter extracts architecture model facts; extension evaluates architecture-specific conformance and drift.

Ardoq:

- Entities/assets: components, references, workspaces, fields, surveys, presentations, viewpoints.
- Relationships: typed references between components, workspace-specific model relations, survey responses.
- Ownership concepts: component owner, workspace owner, respondent, team ownership.
- Classification concepts: component type, workspace type, fields, tags, lifecycle, domain.
- Lifecycle concepts: component lifecycle fields, survey freshness, roadmap state.
- Metadata concepts: custom fields, references, calculated fields, survey data.
- Traceability concepts: component references, survey evidence, model-to-report traceability.
- Governance concepts: data completeness, survey freshness, dependency analysis, lifecycle management.
- Rule/metric/signal concepts: stale survey, missing owner, missing required field, dependency risk.
- Ownership boundary: adapter preserves workspace/component/reference facts; extension evaluates Ardoq-specific completeness and governance.

Signavio:

- Entities/assets: process, process model, activity, decision, control, risk, system, role, dictionary item.
- Relationships: process hierarchy, activity-to-system, control-to-risk, role assignment, process-to-capability.
- Ownership concepts: process owner, role, risk/control owner, model owner.
- Classification concepts: process area, model type, risk/control category, lifecycle state.
- Lifecycle concepts: draft/review/published, process version, approval workflow.
- Metadata concepts: process attributes, dictionary attributes, model version, approval metadata.
- Traceability concepts: process to systems, controls, risks, roles, policies, capabilities.
- Governance concepts: process compliance, control coverage, risk traceability, process ownership.
- Rule/metric/signal concepts: unowned process, missing control, unpublished process, risk without mitigation.
- Ownership boundary: adapter extracts process model facts; extension evaluates process-governance and compliance semantics.

### Software Architecture Platforms

Structurizr:

- Entities/assets: workspace, software system, container, component, person, deployment node, view, decision record, documentation.
- Relationships: uses, depends on, deployment, container/component containment, views over model elements.
- Ownership concepts: system owner, team ownership, decision ownership through metadata or docs.
- Classification concepts: element type, tags, technology, group, view, deployment environment.
- Lifecycle concepts: documented architecture, deployment environments, architecture decision history.
- Metadata concepts: properties, tags, perspectives, documentation, decisions.
- Traceability concepts: person-to-system, system-to-container, container-to-component, deployment-to-runtime node, decision-to-element.
- Governance concepts: documented architecture completeness, dependency policy, decision traceability, deployment consistency.
- Rule/metric/signal concepts: undocumented system, missing owner, forbidden dependency, stale decision, view coverage gap.
- Ownership boundary: adapter extracts model and views; extension evaluates Structurizr-specific documentation and architecture conformance.

Sparx Enterprise Architect:

- Entities/assets: model, package, element, connector, diagram, requirement, component, interface, use case, deployment node.
- Relationships: UML/SysML/ArchiMate connectors, realization, dependency, association, composition, trace, allocation.
- Ownership concepts: package owner, element author, model owner, baseline owner.
- Classification concepts: element type, stereotype, package, diagram type, status, phase.
- Lifecycle concepts: element status, version, phase, baseline, model approval.
- Metadata concepts: tagged values, stereotypes, notes, constraints, scenarios, requirements.
- Traceability concepts: requirement-to-design-to-implementation traces, connector graph, diagram membership.
- Governance concepts: traceability, model completeness, architectural conformance, impact analysis.
- Rule/metric/signal concepts: missing trace, orphaned requirement, unapproved element, broken connector, stale baseline.
- Ownership boundary: adapter extracts model elements/connectors/metadata; extension evaluates modeling-method-specific rules.

Archi:

- Entities/assets: ArchiMate model, element, relationship, view, folder, property, viewpoint.
- Relationships: ArchiMate relation types such as composition, aggregation, assignment, realization, serving, access, flow, influence, triggering.
- Ownership concepts: model owner and element owner through properties or repository conventions.
- Classification concepts: ArchiMate layer, element type, relationship type, viewpoint, properties.
- Lifecycle concepts: model version, view publication, element lifecycle properties when modeled.
- Metadata concepts: element properties, documentation, view membership, model structure.
- Traceability concepts: relationship graph, view-to-element, motivation-to-implementation links.
- Governance concepts: architecture completeness, relation validity, viewpoint coverage, target-state drift.
- Rule/metric/signal concepts: invalid relation, missing documentation, orphaned element, unowned element, viewpoint gap.
- Ownership boundary: adapter extracts ArchiMate facts; extension evaluates ArchiMate-specific conformance.

## Shared Cross-Ecosystem Concepts

Stable cross-ecosystem concepts:

- asset/node/entity
- relationship/relation/edge
- ownership/responsibility
- classification
- domain
- lifecycle/state
- metadata
- source of truth
- source system
- provenance
- intent
- documented reality
- implemented reality
- runtime evidence
- confidence
- authority
- diagnostics
- capabilities
- conformance
- drift
- policy
- rule
- metric/measurement
- signal/finding
- recommendation
- traceability
- lineage
- dependency
- evidence timestamp
- perspective/viewpoint
- scope/boundary

Concepts that appear shared but need careful definition:

- project: common in code, Jira, and dbt, but overloaded across ecosystems.
- model: can mean dbt model, semantic model, architecture model, ML model, or data model.
- metric: can mean business semantic metric or Governance Core measurement.
- snapshot: can mean dbt snapshot, data snapshot, or Governance assessment snapshot.
- owner: can mean account owner, data owner, steward, assignee, reviewer, team, role, or admin.
- dependency: can mean code import, build dependency, lineage relation, architecture dependency, workflow relation, or issue dependency.

## Core Responsibilities

Core should own stable governance semantics that are not tied to a single technology.

Candidate Core responsibilities:

- canonical identity and reference patterns
- canonical ownership concepts
- canonical classification concepts
- canonical lifecycle/state concepts where stable enough
- generic asset/node and relation requirements for #206 consideration
- generic diagnostics and capabilities contracts
- generic adapter contracts
- generic extension contracts
- generic rule execution contracts
- generic metric/measurement contracts
- generic signal/finding contracts
- generic assessment assembly contracts
- generic profile and policy configuration contracts
- source-of-truth, provenance, confidence, authority, and perspective requirements if adopted in #206
- drift and conformance semantics that apply across documented/implemented/runtime realities

Core should not own:

- TypeScript import parsing
- Nx project graph extraction
- dbt artifact parsing
- Fabric API behavior
- Snowflake account queries
- GitHub workflow interpretation
- Jira workflow semantics
- Collibra/Purview/OpenMetadata/DataHub-specific asset models
- ArchiMate/UML/BPMN-specific metamodel rules
- technology-specific scoring formulas
- technology-specific recommendations
- technology-specific report layouts

Rationale:

- Core should be stable and conservative because adapters and extensions normalize into it.
- Core should own concepts only when they are shared across multiple ecosystems and can be defined without losing source semantics.
- Core should avoid becoming a catalog of every platform's object model.

## Adapter Responsibilities

Adapters should extract and normalize facts from a source technology or platform.

Adapters should do:

- detect supported inputs or platforms
- load source artifacts or query source APIs
- validate source artifact/API responses
- normalize source facts into Core-owned adapter contracts
- preserve source-specific metadata for extensions
- expose capabilities describing supported artifacts, sources, versions, and optional enrichments
- emit deterministic diagnostics for extraction and normalization issues
- preserve provenance, source paths, source ids, timestamps, and artifact versions where available
- avoid destructive writes unless a future adapter explicitly owns write behavior and the host authorizes it

Adapters should not do:

- evaluate governance policy
- own Core canonical contracts
- emit technology-specific recommendations as adapter behavior
- calculate technology-specific health scores
- depend on technology-specific extensions by default
- require a host to install a matching extension unless documented as an optional composition
- hide important semantics only in unstructured metadata when a stable Core concept exists

Rationale:

- Adapter output should be reusable by multiple hosts and extensions.
- Adapters should make facts available; interpretation should be delegated to Core generic behavior or extensions.
- Avoiding adapter-to-extension dependencies keeps extraction reusable and prevents circular ownership.

## Extension Responsibilities

Extensions should interpret, enrich, and evaluate technology-specific facts through Core-owned extension contracts.

Extensions should do:

- contribute technology-specific rules
- contribute technology-specific metrics
- contribute technology-specific signals
- contribute technology-specific recommendations
- enrich normalized workspaces or future canonical graphs where appropriate
- interpret adapter capabilities and metadata
- define technology-specific finding categories where Core allows extension strings
- evaluate source-specific governance semantics, such as dbt freshness, GitHub review policy, Snowflake masking coverage, or ArchiMate relation validity
- document required adapter capabilities and metadata assumptions

Extensions should not do:

- own source extraction
- require Core to import extension code
- require adapters to import extension code
- replace Core canonical contracts with parallel extension-only models
- mutate host/runtime state unless explicitly designed as a host action
- become the only place where stable cross-ecosystem semantics are defined

Rationale:

- Extensions are the right place for technology-specific interpretation.
- Extensions can evolve faster than Core while still using Core contracts.
- Extensions should consume capabilities and metadata rather than coupling directly to adapter internals.

## Host Responsibilities

Hosts compose Core, adapters, extensions, profiles, credentials, and execution.

Hosts should do:

- load adapters
- load extensions
- select profiles
- select workspace/platform scope
- provide credentials and runtime configuration
- orchestrate execution
- pass adapter results into Core
- register extensions with Core
- route capabilities and diagnostics
- decide report formats and destinations
- handle process exit behavior
- handle pagination, retries, API rate limits, caching, and persistence when needed
- decide which adapter/extension combinations are enabled

Hosts should not do:

- own canonical Governance contracts
- hardcode technology-specific detection rules that belong in adapters
- evaluate technology-specific governance rules that belong in extensions
- bypass Core assessment contracts for reusable governance output
- become the source of truth for adapter-specific source models

Rationale:

- Hosts are runtime composition layers.
- Hosts can be CLI, CI, platform service, or integration runtime.
- Keeping hosts thin preserves adapter and extension reuse.

## Dependency Direction Analysis

Preferred dependency direction:

```text
Core <- Adapter
Core <- Extension
Host -> Adapter + Extension + Core
```

Meaning:

- adapters depend on Core contracts
- extensions depend on Core contracts
- hosts depend on Core and dynamically or explicitly compose adapters and extensions
- Core depends on neither adapters nor extensions
- adapters and extensions should generally not depend on each other

Adapter-to-extension dependencies should generally be avoided.

Reasons:

- adapters should be usable without interpretation packages
- extensions should be able to consume facts from multiple compatible adapters
- host composition can choose whether a dbt adapter is paired with a dbt extension, a generic data-quality extension, or no extension
- direct coupling makes versioning harder and can force adapter releases for extension-only interpretation changes
- direct coupling can invert responsibility by making extraction aware of evaluation

Acceptable integration pattern:

- adapter emits capabilities and preserved metadata
- extension declares required or optional capabilities
- host loads both and lets Core pass capabilities and context
- extension checks capability availability before evaluating

Potential exception:

- a package may intentionally bundle an adapter and extension for convenience, but the internal dependency direction should still keep extraction and interpretation separated.

## Capability-Based Integration Patterns

Capabilities should describe available facts, not directly execute behavior.

Candidate capability examples:

- `governance.adapter.typescript.import_graph`
- `governance.adapter.typescript.package_metadata`
- `governance.adapter.dbt.manifest`
- `governance.adapter.dbt.catalog`
- `governance.adapter.dbt.run_results`
- `governance.adapter.dbt.source_freshness`
- `governance.adapter.github.actions`
- `governance.adapter.github.pull_requests`
- `governance.adapter.snowflake.access_history`
- `governance.adapter.purview.lineage`
- `governance.adapter.archimate.model`

Capability data may include:

- source system
- artifact/API version
- extraction timestamp
- source path or endpoint
- schema version
- confidence
- authority
- limitations
- counts
- optional feature flags

Extension capability behavior:

- required capabilities should be documented
- optional capabilities should degrade gracefully
- missing capabilities should produce diagnostics, not crashes, where possible
- extensions should avoid assuming metadata shape without a capability or version check

Core implications:

- current Core already has `GovernanceCapability`
- current Core does not yet use capabilities to gate built-in rules or metrics
- #206 should consider whether capability-aware evaluation is needed to avoid misleading built-in results on non-code inventories

## Technology-Specific Concepts

Concepts that should remain technology-specific unless cross-ecosystem evidence proves otherwise:

- TypeScript path aliases and import syntax
- Nx targets, Project Crystal inference, and project graph loader behavior
- dbt materializations, macros, selectors, packages, source freshness, and semantic manifest details
- Fabric item types, capacities, workspaces, refresh APIs, and endorsement details
- Snowflake warehouses, roles, grants, masking policies, row access policies, streams, tasks, shares, and account usage query details
- Maven scopes, Gradle configurations, plugins, tasks, and publications
- GitHub review states, Actions workflow syntax, branch rulesets, projects fields, and security alert details
- Jira workflows, issue types, custom fields, sprint semantics, and release/version fields
- Confluence page/version semantics
- Bitbucket and Bamboo product-specific build/deployment models
- Collibra communities/domains/workflows/responsibility details
- Purview collections/scans/classifications implementation details
- OpenMetadata services/tests/profiling implementation details
- DataHub aspects and metadata-change event details
- LeanIX fact sheet type internals
- Bizzdesign viewpoint/model repository internals
- Ardoq workspace/component/reference field configuration
- Signavio process modeling details
- Structurizr DSL/view syntax
- Sparx EA stereotypes/tagged values/diagram internals
- ArchiMate element and relationship type systems

Reason:

- These concepts are valuable, but they are platform semantics. Core should preserve and expose them through metadata/capabilities when needed, while extensions interpret them.

## Rule Engine Implications

Current rule engine strengths:

- generic rule context
- generic rule result shape
- async rule execution
- extension rule packs
- support for violations, signals, and measurements

Current limitations for multi-technology use:

- built-in rules assume project-to-project dependency governance
- built-in policy rules are always part of `buildGovernanceAssessmentArtifacts(...)`
- rule applicability is not capability-gated
- rule context uses workspace/project/dependency vocabulary
- violations reference a single `project`

Requirements for target-model discussion:

- rules need applicability conditions based on inventory kind, capabilities, profile, or perspective
- findings may need to reference generic assets/relations, not only projects
- rules should distinguish generic Core rules from technology-specific extension rules
- rule output should preserve source-of-truth and confidence where relevant
- rule evaluation should avoid producing misleading findings when the adapter maps non-project assets into compatibility projects

## Metrics And Signals Implications

Current strengths:

- `Measurement` is generic
- metric family is open to extension strings
- signals are extensible through string types
- extension metric and signal providers exist
- health scoring can include extension measurements

Current limitations:

- built-in metric families are architecture, boundaries, ownership, and documentation
- built-in metrics assume project and dependency counts
- known signals focus on structural dependency, cross-domain dependency, missing-domain context, boundary violation, conformance violation, and ownership gap
- signal fields use project-specific names
- health score uses a single weighted average over all measurements

Requirements for target-model discussion:

- metrics should be selected by profile/capability/inventory kind
- technology-specific metrics should usually live in extensions
- Core should define how generic and extension metrics combine without implying false comparability
- signals may need generic entity/relation references
- signals may need source-of-truth, perspective, authority, confidence, and evidence timestamp
- health scoring may need multiple dimensions or perspectives rather than one universal score

## Architectural Drift Requirements

Multi-technology governance requires comparing at least four perspectives:

- intent: target architecture, policy, strategy, standards, or desired state
- documented reality: architecture tools, catalogs, process models, documentation, business capability maps
- implemented reality: source code, dbt DAG, build graph, infrastructure, data platform objects
- runtime evidence: CI runs, deployments, query history, refresh status, run results, incidents, freshness, usage

Drift requirements:

- compare source-specific facts across perspectives
- preserve source-of-truth and authority
- preserve extraction timestamp and artifact/API version
- distinguish missing evidence from negative evidence
- identify stale evidence
- trace relationships between intent and implementation
- support conformance and divergence signals
- support confidence levels when facts are inferred
- avoid treating every relation as a project dependency

Examples:

- LeanIX says application A uses capability C, but GitHub repositories do not map to that application.
- Structurizr documents service X depending on service Y, but TypeScript/Nx import graph shows a reverse dependency.
- dbt manifest shows model lineage, while Purview catalog shows missing or stale lineage.
- Snowflake shows sensitive tables without masking policies, while Collibra says the domain has a policy requiring masking.
- Jira release contains issues without linked PRs or deployment evidence.

## Candidate Canonical Modeling Principles

These are candidate principles for #206 consideration, not final design decisions.

Principle 1: Core owns stable governance semantics.

- Core should own concepts that appear across many ecosystems and can be defined without platform leakage.

Principle 2: Adapters extract and normalize facts.

- Adapters should be deterministic where possible and preserve source metadata, provenance, confidence, and capabilities.

Principle 3: Extensions interpret and evaluate.

- Technology-specific rules, metrics, signals, recommendations, and reports belong in extensions.

Principle 4: Hosts compose.

- Hosts select adapters, extensions, profiles, credentials, scopes, execution, and output.

Principle 5: Avoid semantic flattening.

- Do not force every asset into a project or every relation into a dependency if that loses important meaning.

Principle 6: Preserve source authority.

- Facts should carry enough provenance to determine which source is authoritative for ownership, classification, lifecycle, implementation, runtime evidence, or intent.

Principle 7: Keep compatibility surfaces explicit.

- Current project/dependency contracts may remain useful compatibility views, but #206 should decide whether they are canonical primitives or specialized views.

Principle 8: Capability-aware evaluation.

- Rules and metrics should know whether required facts exist before evaluating.

Principle 9: Separate generic from technology-specific health.

- A single codebase health score should not silently become a data-platform, GitHub, process, or architecture-platform health score.

Principle 10: Model relationships as first-class facts.

- Governance often depends as much on relation semantics as on node metadata.

## Follow-Up Questions For #206

- Should Core introduce generic asset/node contracts?
- Should Core introduce typed relation contracts with metadata preservation?
- Should current `GovernanceProject` become a specialized asset type, a compatibility view, or remain the primary canonical entity?
- Should current `GovernanceDependency` become a specialized relation type, a compatibility view, or remain the primary canonical relation?
- How should Core model ownership across teams, roles, users, stewards, assignees, reviewers, and admins?
- How should Core model classification across tags, domains, layers, glossary terms, sensitivity labels, lifecycle state, and architecture viewpoints?
- Should Core model source-of-truth, authority, confidence, and evidence timestamps?
- Should Core explicitly model intent, documented reality, implemented reality, and runtime evidence?
- Should Core support multiple health scores or score dimensions instead of one universal score?
- How should built-in rules be gated by capability or inventory kind?
- Should signals reference generic assets/relations instead of projects only?
- Should diagnostics standardize severity and location?
- How should extension-provided metrics combine with Core metrics?
- How should host composition declare compatible adapter/extension/profile sets?
- Should adapter-to-extension dependencies be prohibited by package-boundary validation?

## Conclusion

The current Core implementation is a strong starting point for codebase governance because it has stable adapter contracts, rule execution, measurements, signals, assessments, diagnostics, capabilities, and extension seams.

The multi-technology review shows that the current project/dependency-centered model is too narrow as the only long-term canonical shape. It works naturally for TypeScript/Nx and Maven/Gradle modules, partially for dbt and Snowflake lineage, and poorly for GitHub workflows, Atlassian delivery objects, governance catalog assets, business architecture models, and software architecture metamodels.

The main requirement for #206 is to preserve the existing strengths while separating stable Governance semantics from technology-specific source models. Core should own shared semantics and execution contracts. Adapters should extract and normalize facts. Extensions should interpret and evaluate technology-specific governance. Hosts should compose the runtime. Capability-based integration should be the default mechanism for connecting adapters and extensions without direct coupling.
