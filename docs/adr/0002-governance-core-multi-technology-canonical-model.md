# ADR 0002: Governance Core Multi-Technology Canonical Model

## Status

Proposed

## Context

Epic #200 reviewed whether the current `@anarchitects/governance-core` implementation is broad enough for multi-technology and multi-perspective governance.

The review found that the current package boundary is sound: Core owns canonical contracts and deterministic logic, adapters normalize into Core contracts, extensions plug into Core contracts, and hosts orchestrate execution. Core does not import concrete adapters, CLI runtime code, or Nx APIs.

The review also found that the current canonical implementation is too project/dependency-oriented to remain the only long-term abstraction:

- The central inventory unit is `GovernanceProject`.
- The central relation is `GovernanceDependency`.
- Built-in rules evaluate project-to-project dependency boundaries, ownership, tags, and domain/layer metadata.
- Built-in metrics assume project count and dependency count are meaningful.
- Current signal and violation models reference projects directly.
- Current dependency metadata is accepted in adapter input but not retained in canonical dependencies.

The dbt candidate mapping review in #204 created concrete pressure on the model. A dbt project maps naturally to a Governance workspace and dbt DAG lineage maps naturally to dependencies, but dbt sources, exposures, semantic models, metrics, tests, packages, catalog metadata, freshness, and run results are forced or lossy fits when represented only as projects and dependencies.

The multi-technology requirements review in #205 showed the same pressure across other ecosystems:

- execution platforms such as TypeScript/Nx, dbt, Fabric, Snowflake, Maven/Gradle/Java, GitHub, and Atlassian
- governance platforms such as Collibra, Microsoft Purview, OpenMetadata, and DataHub
- business architecture platforms such as LeanIX, Bizzdesign, Ardoq, and Signavio
- software architecture platforms such as Structurizr, Sparx Enterprise Architect, and Archi

These ecosystems need to represent not only implemented code or data graphs, but also domain intent, documented architecture, governance platform metadata, delivery workflow state, source-control state, CI/CD evidence, and runtime evidence.

The target model must support drift and conformance analysis between:

- intent
- documented reality
- implemented reality
- runtime evidence

The target model must also preserve source-of-truth, perspective/viewpoint, provenance, confidence, and authority so facts from architecture tools, source systems, data platforms, governance catalogs, VCS, CI/CD, and planning systems can be related without flattening their meaning into untyped metadata.

## Decision

Governance Core will evolve toward a small technology-neutral canonical kernel.

The kernel should support generic governable nodes/assets/items and typed relations rather than treating projects and dependencies as the only long-term canonical abstractions.

`GovernanceWorkspace` remains the canonical inventory boundary.

Current project/dependency concepts remain supported during transition:

- `GovernanceProject`, `GovernanceProjectInput`, and related project contracts remain compatibility contracts and project-specialized views.
- `GovernanceDependency`, `GovernanceDependencyInput`, and related dependency contracts remain compatibility contracts and dependency-specialized views.
- Existing adapters, hosts, and extensions must continue to work during Phase 1.

The target Core kernel should include or make room for these stable concepts:

- workspace
- node/asset/item
- relation
- classification
- ownership
- lifecycle/status
- perspective/viewpoint
- source/evidence/provenance
- capability
- diagnostic
- finding/signal
- metric/measurement
- assessment/score
- drift/conformance primitives

Core owns stable governance semantics and generic execution contracts.

Adapters own extraction:

- discovery
- source artifact/API loading
- source validation
- normalization into Core-owned adapter contracts
- metadata preservation
- evidence/provenance preservation
- capability emission
- extraction diagnostics

Extensions own interpretation:

- technology-specific rules
- technology-specific metrics
- technology-specific signals
- technology-specific findings
- technology-specific recommendations
- optional enrichers
- capability-aware evaluation

Hosts own composition:

- adapter loading
- extension loading
- profile selection
- credentials and runtime configuration
- execution orchestration
- report generation
- output routing
- persistence where needed

Preferred dependency direction:

```text
Adapter -> Core
Extension -> Core
Host -> Core + Adapter + Extension
```

Avoid by default:

```text
Adapter -> Extension
Extension -> Adapter
Core -> Adapter
Core -> Extension
Core -> Host
```

Capability-based integration is the preferred adapter/extension integration pattern:

- adapters emit capabilities describing available facts, artifact versions, source systems, evidence, limitations, and optional enrichments
- extensions declare required and optional capabilities
- hosts compose adapters and extensions
- extensions evaluate only when required capabilities and evidence are available

## Consequences

Positive consequences:

- Core can support code, data, governance catalog, delivery, architecture, and runtime perspectives without embedding platform-specific models.
- Existing project/dependency contracts can remain usable while Core gains a broader canonical graph.
- dbt and future adapters can preserve source semantics instead of forcing everything into project metadata.
- Architecture drift and conformance can compare intent, documented reality, implemented reality, and runtime evidence.
- Extensions can evolve technology-specific interpretation without coupling adapters to extension packages.
- Hosts can compose different adapter/extension/profile combinations for different runtime contexts.

Trade-offs:

- Core becomes more abstract and requires stronger documentation.
- The model needs careful naming to avoid overloaded terms such as project, model, metric, snapshot, owner, and dependency.
- Built-in rules and metrics need applicability checks so codebase-oriented behavior does not run against incompatible inventories.
- Compatibility layers add maintenance overhead during transition.
- Extensions must document capability requirements clearly.

Migration implications:

- Phase 1 must be additive and preserve existing public contracts.
- Core should normalize legacy project/dependency inputs into the target canonical graph internally.
- Existing TypeScript adapter and CLI behavior must remain unchanged during Phase 1.
- Phase 2 can migrate adapters, hosts, plugins, reports, and extensions to native target-model consumption.
- Legacy contracts should not be removed until all known consumers are migrated and an explicit deprecation decision is made.

Backward compatibility expectations:

- `GovernanceWorkspaceAdapterResult` continues to accept current `workspace`, `projects`, and `dependencies`.
- `GovernanceProjectInput` and `GovernanceDependencyInput` remain valid adapter outputs.
- Existing assessment APIs remain functional.
- Existing extension contracts remain functional or receive additive alternatives.
- Current CLI commands continue to work with current workspace/profile flows.

Risks:

- Over-generalization can make Core hard to use.
- Metadata dumping can avoid design decisions and weaken rule/metric consistency.
- Premature abstraction can slow adapter delivery.
- Direct adapter-to-extension dependencies can create versioning and ownership problems.
- A single universal health score can become misleading across incompatible perspectives.

## Alternatives Considered

### Keep current project/dependency model unchanged

Rejected as the long-term direction.

The current model is coherent for TypeScript/Nx and other code module graphs, but dbt, governance platforms, architecture platforms, GitHub, Atlassian, Fabric, and Snowflake expose assets and relations that are forced or lossy when represented only as projects and dependencies.

### Make everything dynamic metadata

Rejected.

Metadata is necessary for source-specific detail, but using metadata for every important concept would make rules, metrics, signals, drift analysis, and cross-ecosystem interpretation inconsistent and hard to validate.

### Build dbt-specific abstractions directly into Core

Rejected.

dbt is an important stress test, but dbt materializations, macros, selectors, tests, semantic manifests, and run results are technology-specific. Core should provide generic primitives that dbt can map into, while dbt-specific interpretation belongs in a dbt extension.

### Let adapters depend directly on technology-specific extensions

Rejected by default.

Adapters should extract reusable facts. Extensions should interpret facts. Direct dependencies would couple extraction to evaluation, complicate versioning, and reduce host composition flexibility. Capability-based integration is preferred.

### Fully break compatibility and migrate everything immediately

Rejected.

Existing TypeScript adapter, CLI, extensions, and external Nx/plugin consumers need a stable transition path. The migration should happen in two phases: additive Core evolution first, then adapter/host migration.

## Follow-Up Work

Primary follow-up epics/issues:

- #201 Phase 1: Additive Core evolution
- #202 Phase 2: Adapter and host migration
- #143 dbt Governance Adapter

Recommended #201 implementation issues:

- Add target node/asset and relation contracts additively.
- Extend adapter result contracts with optional target-model fields.
- Add compatibility normalization from projects/dependencies to nodes/relations.
- Preserve dependency metadata in target relation metadata.
- Add perspective/evidence/provenance contracts.
- Add capability conventions for artifact availability and evaluation applicability.
- Add generic finding/signal references for nodes and relations while preserving project fields.
- Add rule/metric applicability gating by profile, capability, inventory kind, or perspective.
- Update Core README and architecture docs after additive APIs exist.

Recommended #202 migration issues:

- Migrate TypeScript adapter to emit native target nodes/relations while retaining compatibility output.
- Migrate CLI internals and reports to understand target graph data.
- Migrate extensions to target node/relation references where needed.
- Migrate Nx adapter and Nx plugin/host in `anarchitecture-plugins`.
- Document deprecation policy and checkpoints for legacy contracts.

Recommended #143 sequencing:

- Prefer starting dbt adapter implementation after #201 target contracts exist.
- If dbt starts earlier, emit legacy project/dependency compatibility output and preserve dbt-specific graph metadata carefully.
- Keep dbt extraction in the adapter and dbt-specific interpretation in a separate extension.

Additional recommended ADRs:

- ADR for target canonical graph contract naming.
- ADR for perspective/evidence/source-of-truth semantics.
- ADR for built-in rule and metric applicability gating.
- ADR for legacy project/dependency deprecation policy.
