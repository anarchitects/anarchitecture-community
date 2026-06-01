# Target Canonical Governance Model

Status:
Architecture design for GitHub issue #206. This document defines the target direction for the canonical Governance Core model. It is documentation-only and does not implement the model.

## Purpose

This document designs the target canonical Governance Core model and architecture direction based on the review outputs from #203, #204, and #205.

The target direction is intended to guide:

- #201 Phase 1 additive Core evolution
- #202 Phase 2 adapter and host migration
- #143 dbt adapter sequencing

This document does not change production behavior, introduce code contracts, or finalize every type signature. It defines the design direction, compatibility strategy, migration strategy, and decisions that should become implementation or ADR work.

## Inputs

Primary review inputs:

- `docs/governance/core-implementation-audit.md`
- `docs/governance/dbt-candidate-mapping-review.md`
- `docs/governance/multi-technology-adapter-requirements.md`
- GitHub issue #200, `Epic: Review Governance Core implementation for multi-technology and multi-perspective governance`
- GitHub issue #201, `Epic: Phase 1 - Additive Governance Core evolution`
- GitHub issue #202, `Epic: Phase 2 - Governance adapter and host migration`
- GitHub issue #203, `Review Core: audit current canonical governance model`
- GitHub issue #204, `Review Core: validate dbt candidate mapping against canonical model`
- GitHub issue #205, `Review Core: evaluate multi-technology adapter requirements`
- GitHub issue #206, `Review Core: design target canonical governance model`
- GitHub issue #143, `Epic: dbt Governance Adapter`

Current package inputs:

- `packages/governance/core/README.md`
- `packages/governance/core/src/core/models.ts`
- `packages/governance/core/src/core/adapter.ts`
- `packages/governance/core/src/core/rules.ts`
- `packages/governance/core/src/core/rule-engine.ts`
- `packages/governance/core/src/core/built-in-rules.ts`
- `packages/governance/core/src/core/metrics.ts`
- `packages/governance/core/src/core/signals.ts`
- `packages/governance/core/src/core/assessment-artifacts.ts`
- `packages/governance/core/src/extensions/contracts.ts`
- `packages/governance/core/src/extensions/runtime.ts`
- `packages/governance/adapter-typescript/README.md`
- `packages/governance/cli/README.md`

## Summary Of Prior Findings

Findings from #203:

- Current Core has good package-boundary discipline: Core does not import concrete adapters, CLI runtime code, or Nx APIs.
- The public surface already includes generic-looking contracts for adapters, diagnostics, capabilities, rule execution, metrics, signals, assessments, snapshots, drift, and extensions.
- The implementation is still strongly project/dependency oriented.
- Built-in rules evaluate project-to-project dependency boundaries, ownership presence, tag conventions, and domain/layer metadata.
- Built-in metrics assume project count, dependency count, ownership coverage, documentation coverage, domain integrity, layer integrity, architectural entropy, and dependency complexity are meaningful.
- Signals and findings currently use project-specific fields such as source project, target project, and related project ids.
- Diagnostics and capabilities are generic but under-specified for severity, location, source authority, confidence, and evidence.

Findings from #204:

- dbt is close enough to fit the current model but rich enough to expose its limits.
- A dbt project maps naturally to a Governance workspace.
- dbt lineage maps naturally to dependencies.
- dbt models, seeds, and snapshots can be mapped to projects, but only imperfectly.
- dbt sources, exposures, semantic models, metrics, tests, packages, catalog metadata, and run results expose missing abstractions.
- The adapter should discover, normalize, and preserve facts; a dbt extension should interpret tests, freshness, contracts, catalog data, run results, and dbt-specific scoring.
- Dependency metadata preservation is a concrete gap because `GovernanceDependencyInput.metadata` is not retained in canonical dependencies.

Findings from #205:

- Multi-technology governance requires generic assets/nodes and relations beyond code projects and dependencies.
- Core should own stable governance semantics, not platform-specific object models.
- Adapters should extract and normalize facts.
- Extensions should interpret, enrich, evaluate, score, and recommend.
- Hosts should compose adapters, extensions, profiles, credentials, execution, and output.
- Adapter-to-extension dependencies should generally be avoided.
- Capability-based integration should connect adapter facts to extension interpretation.
- The model must support multiple perspectives: intent, documented reality, implemented reality, and runtime evidence.
- Drift and conformance require source-of-truth, authority, confidence, evidence timestamps, and traceability.

## Design Principles

Principle 1: Core owns stable governance semantics.

- Core should define concepts that recur across ecosystems and can be explained without technology-specific leakage.

Principle 2: Keep the Core kernel small.

- Core should not become a catalog of every platform's object model.
- Core should provide a small set of stable primitives with explicit extension points.

Principle 3: Preserve semantics instead of flattening everything into metadata.

- Metadata remains necessary, but important cross-ecosystem semantics should have canonical fields once they are stable.

Principle 4: Model relationships as first-class facts.

- Governance reasoning depends on typed relationships, not only node metadata.

Principle 5: Separate perspectives.

- Intent, documented reality, implemented reality, and runtime evidence should be distinguishable.

Principle 6: Preserve source authority.

- Facts should carry enough evidence/provenance to determine their source, authority, confidence, and freshness.

Principle 7: Compatibility is explicit.

- Existing workspace/project/dependency contracts should remain supported during additive evolution and migration.

Principle 8: Evaluation is capability-aware.

- Rules, metrics, and signals should only evaluate when required facts and perspectives are available.

Principle 9: Technology-specific interpretation belongs in extensions.

- Adapter facts should be reusable without forcing technology-specific evaluation into Core or adapters.

Principle 10: Hosts compose; they do not define canonical semantics.

- CLI, CI, services, and plugins should orchestrate Core, adapters, extensions, profiles, credentials, and output.

## Target Architecture Direction

The target direction is a node/relation-centric canonical model with compatibility views for current project/dependency contracts.

Target architecture:

```text
Core
  owns canonical workspace, node, relation, perspective, evidence,
  classification, ownership, lifecycle, finding, signal, measurement,
  assessment, adapter, capability, diagnostic, and extension contracts

Adapter -> Core
  discovers, extracts, normalizes, preserves facts, emits capabilities

Extension -> Core
  interprets facts, enriches model, evaluates rules, emits findings,
  signals, measurements, recommendations

Host -> Core + Adapter + Extension
  composes runtime, profiles, credentials, adapter loading,
  extension loading, execution, reports, persistence
```

Target model shape:

- `GovernanceWorkspace` remains the inventory boundary.
- Additive Core evolution should introduce a generic node/asset/item concept.
- Additive Core evolution should introduce a generic relation concept.
- `GovernanceProject` should become a specialized compatibility view over nodes, not the only canonical entity.
- `GovernanceDependency` should become a specialized compatibility view over relations, not the only canonical relation.
- Findings, signals, metrics, and assessments should be able to reference generic nodes and relations.
- Capabilities should describe which adapter facts, perspectives, and evidence are present.
- Rule and metric execution should become capability/profile/perspective-aware.

Runtime/evaluation direction:

- Keep the generic rule engine.
- Separate generic Core rules from technology-specific extension rules.
- Avoid running codebase-oriented built-in rules against inventories that only use project compatibility mappings for non-project assets.
- Allow assessments to carry multiple score dimensions or perspectives when one global score would be misleading.

## Canonical Core Concepts

### Workspace

Purpose:

- Represents the governance inventory boundary for one assessment run or integrated view.

Core ownership:

- Belongs in Core.
- Existing `GovernanceWorkspace` is stable as a boundary concept.

Relationship to current contracts:

- Keep `GovernanceWorkspace`.
- Extend additively to support generic nodes and relations while retaining projects and dependencies during compatibility phase.

Status:

- Stable boundary concept.
- Shape should evolve additively in #201.

Design notes:

- Workspace should identify scope, source system set, root or endpoint when available, capabilities, diagnostics, and perspectives.
- Workspace should not imply a local filesystem root is always available.

### Node / Asset / Item

Purpose:

- Represents a governable thing: code project, dbt model, source table, GitHub repository, Jira issue, Confluence page, Snowflake table, Collibra asset, LeanIX application, Structurizr container, ArchiMate element, CI workflow, or business capability.

Core ownership:

- Belongs in Core as a generic primitive.

Relationship to current contracts:

- `GovernanceProject` should map to a node specialization.
- `GovernanceProjectInput` should remain accepted as legacy adapter input and be normalized into nodes internally.
- Existing project fields map approximately as:
  - `id` -> node id
  - `name` -> node name
  - `root` -> location/evidence/source path
  - `type` -> compatibility node kind or project subtype
  - `tags`, `domain`, `layer`, `ownership`, `metadata` -> classification, ownership, and metadata

Status:

- Target stable concept.
- Additive in #201.

Design notes:

- The preferred term should be decided by ADR. `GovernanceNode` is graph-neutral; `GovernanceAsset` is governance/catalog-friendly; `GovernanceItem` is broad but less precise.
- This document recommends `GovernanceNode` or `GovernanceAsset`; avoid overloading `Project` as the generic term.

### Relation

Purpose:

- Represents a typed relationship between nodes, such as depends-on, lineage, owns, implements, documents, realizes, deployed-to, tests, governs, classifies, references, part-of, or triggers.

Core ownership:

- Belongs in Core as a generic primitive.

Relationship to current contracts:

- `GovernanceDependency` should map to a relation specialization.
- `GovernanceDependencyInput` should remain accepted and be normalized into relations internally.
- Existing dependency fields map approximately as:
  - `source` or `sourceProjectId` -> relation source node reference
  - `target` or `targetProjectId` -> relation target node reference
  - `type` -> compatibility dependency relation kind
  - `sourceFile` -> relation evidence/source location
  - dependency metadata should be preserved in relation metadata

Status:

- Target stable concept.
- Additive in #201.

Design notes:

- Relation kinds should be extensible.
- Core should define a small common vocabulary and allow technology-specific relation kinds.
- Relation metadata preservation is required to avoid dbt and governance-platform semantic loss.

### Classification

Purpose:

- Represents stable ways to categorize nodes and relations: domain, layer, scope, kind, tag, lifecycle class, sensitivity, glossary term, capability, environment, platform, product, or viewpoint.

Core ownership:

- Belongs partly in Core.
- Core should own generic classification mechanics and a few stable classification dimensions.
- Technology-specific classification schemes belong in adapters/extensions.

Relationship to current contracts:

- Current `domain`, `layer`, `scope`, and `tags` should become compatibility projections into classification entries.
- `scope` should stop being an adapter-only field if it remains important; otherwise it should be a classification entry rather than a special project field.

Status:

- Stable as a concept.
- Specific vocabulary should be conservative and extensible.

Design notes:

- Classification should record source, confidence, and authority when classifications come from multiple systems.
- Tags should remain low-friction but should not be the only structured classification mechanism.

### Ownership

Purpose:

- Represents responsibility, accountability, stewardship, or operational ownership for nodes, relations, policies, or perspectives.

Core ownership:

- Belongs in Core.

Relationship to current contracts:

- Current `Ownership` should evolve from project-only ownership to a more generic ownership assignment model.
- Existing `Ownership.team`, `contacts`, and `source` should remain mappable.

Status:

- Stable concept.
- Current shape is transitional and project-biased.

Design notes:

- Ownership should support owner type or role, such as team, user, role, steward, custodian, assignee, reviewer, admin, or accountable party.
- Ownership should preserve source, authority, and confidence.

### Perspective / Viewpoint

Purpose:

- Distinguishes which reality a fact belongs to: intent, documented reality, implemented reality, runtime evidence, governance catalog, delivery workflow, or source-control evidence.

Core ownership:

- Belongs in Core.

Relationship to current contracts:

- Current model has no explicit perspective.
- Current snapshots and drift compare assessment outputs, but not facts across perspectives.

Status:

- Target stable concept.
- Needs ADR detail before implementation.

Design notes:

- Perspective is required for architectural drift and conformance.
- Example perspectives:
  - domain intent
  - business architecture
  - enterprise architecture
  - software architecture
  - data architecture
  - governance platform metadata
  - delivery planning
  - version control
  - CI/CD
  - implemented runtime

### Source / Evidence

Purpose:

- Captures provenance: where a fact came from, when it was extracted, which artifact/API/version supplied it, and how authoritative or confident it is.

Core ownership:

- Belongs in Core as a generic evidence/provenance concept.

Relationship to current contracts:

- Current diagnostics, capabilities, `sourceFile`, snapshot metadata, and adapter metadata cover fragments of this.
- They do not provide a consistent fact-level evidence model.

Status:

- Target stable concept.

Design notes:

- Evidence should distinguish source system, source id, source path or endpoint, extraction timestamp, schema/artifact version, confidence, and authority.
- Evidence should allow missing evidence to be distinguished from negative evidence.

### Lifecycle / Status

Purpose:

- Represents state over time: active, deprecated, proposed, approved, draft, published, failed, stale, certified, end-of-life, planned, target, baseline, or runtime state.

Core ownership:

- Belongs in Core as a generic lifecycle/status mechanism.
- Specific status vocabularies should remain technology-specific unless broadly shared.

Relationship to current contracts:

- Current health status, exception lifecycle status, snapshot drift status, and issue severity are separate concepts.
- There is no generic lifecycle/status for nodes or relations.

Status:

- Target stable mechanism with extensible values.

Design notes:

- Lifecycle should record source and perspective.
- Avoid forcing all platform states into one enum.

### Capability

Purpose:

- Describes available adapter facts, extension expectations, artifact/API versions, optional enrichments, limitations, and supported perspectives.

Core ownership:

- Belongs in Core.
- Existing `GovernanceCapability` is a stable starting point.

Relationship to current contracts:

- Keep current capability envelope.
- Consider adding conventions or typed helper capabilities additively.

Status:

- Stable concept, current shape is minimal.

Design notes:

- Capabilities should enable extension behavior without adapter-to-extension dependencies.
- Capability data should include source, version, limitations, extraction scope, and confidence where useful.

### Diagnostic

Purpose:

- Represents extraction, normalization, evaluation, extension, or host issues.

Core ownership:

- Belongs in Core.

Relationship to current contracts:

- Current `GovernanceDiagnostic` has code, message, source, and details.
- Extension diagnostics have severity and extension metadata.

Status:

- Stable concept, current generic shape is under-specified.

Design notes:

- Target diagnostics should standardize severity and location.
- Diagnostics should be able to reference evidence, nodes, relations, capabilities, or host context.

### Finding / Signal

Purpose:

- Represents a governance observation, violation, conformance issue, policy result, runtime signal, or extension finding.

Core ownership:

- Belongs in Core as generic primitives.

Relationship to current contracts:

- Current `Violation` and `GovernanceSignal` are useful but project-biased.
- Future findings/signals should reference generic nodes and relations, with project compatibility fields retained during migration.

Status:

- Stable concept, current shapes are transitional.

Design notes:

- A finding should carry rule id, severity, category, message, evidence, affected node/relation refs, source plugin, confidence, and recommendation linkage.
- Signals should remain suitable for aggregation, trend, and drift.

### Metric / Measurement

Purpose:

- Represents a calculated governance measurement or score.

Core ownership:

- Belongs in Core as a generic output primitive.

Relationship to current contracts:

- Current `Measurement` is a good base shape.
- Avoid naming conflicts with source-domain concepts like dbt metric by being explicit that Core measurement is a governance measurement.

Status:

- Stable concept, current built-in metric set is codebase-oriented.

Design notes:

- Metric families should be selected by profile/capability/perspective.
- Core should avoid one universal score implying equal meaning across code, data, delivery, process, and architecture platforms.

### Assessment / Score

Purpose:

- Represents aggregate governance output for a workspace and selected profile/perspectives.

Core ownership:

- Belongs in Core.

Relationship to current contracts:

- Current `GovernanceAssessment` remains useful.
- Future assessment should be able to include generic graph summaries, multiple score dimensions, perspective-specific findings, and compatibility project/dependency views.

Status:

- Stable aggregate concept, current shape is transitional.

Design notes:

- Support separate score dimensions when measurements are not comparable.
- Preserve compatibility with current health score while allowing target-model scoring to evolve.

## Core Responsibilities

Core owns:

- stable canonical model concepts
- adapter contracts
- extension contracts
- generic diagnostics and capabilities
- generic rule execution contracts
- generic findings, signals, measurements, and assessment primitives
- generic profile/policy configuration mechanics
- compatibility normalization between legacy project/dependency contracts and target node/relation contracts
- generic drift and conformance mechanics

Core does not own:

- concrete adapter implementations
- platform API clients
- TypeScript/Nx/dbt/Fabric/Snowflake/GitHub/Atlassian extraction logic
- Collibra/Purview/OpenMetadata/DataHub object models
- ArchiMate/UML/BPMN metamodel rules
- technology-specific metrics, signals, recommendations, and reports
- host runtime behavior, credentials, output routing, process exit behavior, or persistence

## Adapter Responsibilities

Adapters own:

- discovery
- extraction
- source artifact/API validation
- normalization into Core adapter result contracts
- metadata preservation
- capability emission
- diagnostics for extraction and normalization
- evidence/provenance preservation

Adapters do not own:

- canonical model definitions
- governance rule evaluation
- scoring
- recommendations
- host orchestration
- technology-specific extension interpretation
- direct dependencies on extensions by default

## Extension Responsibilities

Extensions own:

- technology-specific interpretation
- technology-specific rules
- technology-specific metrics
- technology-specific signals
- technology-specific recommendations
- optional enrichers
- optional technology-specific assessment slices
- capability requirement declarations and graceful degradation behavior

Extensions do not own:

- source extraction
- host runtime composition
- canonical model definitions
- adapter-private implementation details

## Host Responsibilities

Hosts own:

- composition
- profile selection
- adapter loading
- extension loading
- execution orchestration
- credentials and runtime configuration
- workspace/platform scope selection
- report generation
- output routing
- persistence where needed
- process exit behavior
- rate limiting, pagination, retries, and caching for API-backed runs

Hosts do not own:

- canonical Core contracts
- technology-specific detection rules that belong in adapters
- technology-specific evaluation rules that belong in extensions
- source-specific canonical models

## Dependency Direction

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

Rationale:

- Adapters should be reusable without extension packages.
- Extensions should consume Core contracts, capabilities, and metadata rather than adapter internals.
- Hosts should compose compatible adapters and extensions.
- Core must stay stable and technology-neutral.

Exception:

- Convenience bundles may include both adapter and extension packages, but internal package boundaries should preserve extraction/evaluation separation.

## Capability-Based Integration

Capabilities are the preferred integration point between adapters and extensions.

Adapter capabilities should describe:

- source system
- artifact or API version
- extraction scope
- supported node/relation families
- supported perspectives
- available metadata enrichments
- known limitations
- confidence and authority when available

Extensions should:

- declare required and optional capabilities in documentation
- check capability availability before evaluation
- emit diagnostics when required facts are absent
- avoid assuming adapter-private metadata without capability/version checks

Host role:

- load compatible adapters and extensions
- pass capabilities and context through Core
- decide whether missing capabilities are warnings, skipped rules, or failures

## Multi-Perspective Governance Support

The target model should represent and relate:

- Domain intent from DDD/UDE
- Business architecture
- Enterprise architecture
- Software architecture
- Data architecture
- Governance platform metadata
- Project and delivery planning systems
- Version control systems
- CI/CD systems
- Implemented reality

Support requirements:

- Facts must be attributable to a perspective.
- Multiple perspectives can describe the same real-world asset differently.
- Relationships can cross perspectives, such as a business capability realized by an application, implemented by repositories, deployed by CI/CD, and governed by catalog policies.
- Drift and conformance require comparison across perspectives.
- Authority can differ by field: Collibra may be authoritative for stewardship, GitHub for repository state, Structurizr for documented software architecture, and runtime telemetry for operational reality.

## Intent, Documented Reality And Implemented Reality

Intent:

- Target state, strategy, standards, policy, domain model, UDE/DDD model, planned architecture, or desired state.

Documented reality:

- Architecture tools, business architecture platforms, catalog metadata, process models, documentation, and governance platform declarations.

Implemented reality:

- Source code, dbt manifests, build graphs, infrastructure objects, data platform objects, repository structure, and deployed assets.

Runtime evidence:

- CI runs, deployments, refresh history, query/access history, source freshness, run results, incidents, usage, and operational telemetry.

Target model requirement:

- Do not collapse these into one undifferentiated graph.
- Allow conformance and drift checks between them.
- Preserve evidence and authority per fact.

## Drift And Conformance Support

Drift:

- A difference between expected, documented, implemented, or runtime state.

Conformance:

- A rule or policy evaluation that determines whether a fact or relation satisfies an expectation.

Target support:

- compare nodes and relations across perspectives
- detect missing implementation for documented intent
- detect undocumented implementation
- detect stale documentation
- detect policy coverage gaps
- detect runtime evidence contradicting intended or documented state
- attach findings to nodes, relations, perspectives, and evidence
- preserve confidence and authority in findings

Current snapshot/drift support:

- Current Core compares assessment snapshots and metric deltas.
- Target drift should extend beyond metric deltas into multi-perspective fact comparison.

## Compatibility Strategy

`GovernanceProjectInput`:

- Keep as a compatibility adapter input contract.
- Normalize into target node contracts internally in Phase 1.
- Treat as a project-specialized node input.
- Do not require existing adapters to migrate in Phase 1.

`GovernanceDependencyInput`:

- Keep as a compatibility adapter input contract.
- Normalize into target relation contracts internally in Phase 1.
- Treat as a dependency-specialized relation input.
- Preserve dependency metadata in target relation metadata when new relation contracts exist.

`GovernanceWorkspaceAdapterResult`:

- Extend additively.
- Continue supporting current `workspace`, `projects`, and `dependencies`.
- Add optional target node/relation/evidence/perspective fields in Phase 1.
- Preserve current diagnostics, capabilities, and metadata.

Existing TypeScript adapter output:

- Continue to emit current project/dependency inputs during Phase 1.
- Core compatibility normalization should map those into nodes/relations internally.
- Phase 2 can migrate the adapter to emit target node/relation inputs natively.

Existing CLI/host behavior:

- Continue to work with current workspace/profile flows during Phase 1.
- CLI output can remain project/dependency oriented until Phase 2 migration.
- New target-model views should be added without breaking current commands.

Existing extension behavior:

- Existing extension contracts should continue to work during Phase 1.
- New target-model extension inputs should be additive.
- Phase 2 can migrate extensions to native node/relation references.

Project/dependency future:

- Keep as compatibility contracts and convenience specializations.
- Map to nodes/relations internally.
- Consider deprecation only after Phase 2 migration and explicit ADR approval.
- Do not remove them in #201.

## Migration Strategy

### Phase 1: Additive Core Evolution

Purpose:

- Implement target abstractions additively while preserving all existing consumers.

Recommended order:

1. Add target node/relation/evidence/perspective contracts.
2. Extend adapter result contracts with optional target fields.
3. Add compatibility normalization from current projects/dependencies to target nodes/relations.
4. Preserve current `buildGovernanceWorkspace(...)` behavior.
5. Add target graph normalization helpers behind additive APIs.
6. Add generic findings/signals references that can point to nodes/relations while keeping project fields.
7. Add capability conventions for evaluation applicability.
8. Add tests proving current adapters, CLI, and extensions still work.
9. Document compatibility behavior in Core README and architecture docs.

Should remain deferred:

- adapter migrations
- CLI output redesign
- removing legacy contracts
- implementing dbt adapter
- technology-specific scoring redesign

### Phase 2: Adapter And Host Migration

Purpose:

- Move adapters, hosts, plugins, and extensions from compatibility mode to native target-model consumption.

Recommended order:

1. Migrate TypeScript adapter to emit target node/relation fields while retaining compatibility output.
2. Migrate CLI internals to consume target graph where useful.
3. Add target-model report slices without breaking existing commands.
4. Migrate extensions to native node/relation references.
5. Coordinate Nx adapter/plugin migration in `anarchitecture-plugins`.
6. Document deprecation strategy for legacy compatibility fields.
7. Only consider removal after all known consumers are migrated and versioning allows it.

### dbt Adapter Sequencing

Recommended sequencing:

1. Complete #206 design document.
2. Implement #201 additive Core evolution first.
3. Start #143 dbt adapter against the target adapter result shape if available.
4. If #143 must start before #201 completes, emit current project/dependency compatibility output and preserve dbt source graph metadata carefully.
5. Implement dbt extension work separately from the adapter so tests, freshness, contracts, catalog, and run results are interpreted outside extraction.
6. Avoid hardcoding dbt-specific rules, metrics, or scoring in the adapter.

## Risks

Risk: over-generalizing.

- A model that tries to represent every platform perfectly can become unusable.
- Mitigation: keep Core kernel small and let extensions own platform semantics.

Risk: making everything metadata.

- Metadata-only models are flexible but hard to evaluate consistently.
- Mitigation: promote cross-ecosystem stable concepts to Core and preserve platform-specific details in structured metadata.

Risk: premature abstraction.

- Introducing too many abstractions before implementation evidence may slow delivery.
- Mitigation: add concepts incrementally in #201 and validate with TypeScript, dbt, and at least one platform-style adapter.

Risk: breaking existing adapters.

- Current consumers depend on project/dependency contracts.
- Mitigation: keep compatibility contracts and normalize internally.

Risk: coupling adapters to extensions.

- Adapter-to-extension dependencies reduce reuse and complicate versioning.
- Mitigation: use capabilities and host composition.

Risk: misleading metrics.

- Codebase health metrics may not apply to data, workflow, governance, or architecture inventories.
- Mitigation: capability-gate metrics and separate score dimensions.

Risk: ambiguous terminology.

- Terms like project, model, metric, snapshot, owner, and dependency mean different things across ecosystems.
- Mitigation: use explicit target names and document compatibility mappings.

## Open Questions

- Should the generic entity be named `GovernanceNode`, `GovernanceAsset`, or `GovernanceItem`?
- Which relation kinds should Core define versus leave to extensions?
- How should Core represent multiple identifiers for the same real-world asset across systems?
- How should Core represent authority when different systems are authoritative for different fields?
- Should evidence be attached to every fact or only to facts that need drift/conformance comparison?
- Should Core support multiple simultaneous perspectives in one assessment, or should hosts compose separate perspective assessments?
- How should generic findings coexist with current `Violation`?
- Should `Measurement` be renamed or clarified to avoid collision with dbt metrics and semantic metrics?
- Should built-in project/dependency rules become opt-in, capability-gated, or profile-gated?
- How should existing snapshot/drift contracts evolve toward multi-perspective drift?

## Candidate ADR Decisions

Candidate ADRs:

- ADR: Target canonical graph model naming and scope.
- ADR: Project/dependency compatibility strategy.
- ADR: Relation metadata preservation and endpoint reference model.
- ADR: Perspective/evidence/source-of-truth model.
- ADR: Core versus adapter versus extension versus host responsibility boundaries.
- ADR: Capability-based adapter/extension integration.
- ADR: Built-in rule and metric applicability gating.
- ADR: Assessment scoring model for multi-perspective governance.
- ADR: Deprecation policy for legacy project/dependency contracts.

## Conclusion

The target canonical Governance model should move beyond project/dependency as the only canonical shape. The recommended direction is a small Core kernel centered on workspace, generic nodes/assets, typed relations, classification, ownership, lifecycle/status, perspective/viewpoint, source/evidence, diagnostics, capabilities, findings/signals, measurements, and assessments.

Existing project and dependency contracts should not be removed. They should remain compatibility contracts and convenience specializations, mapped internally to nodes and relations during additive Core evolution.

Core should own stable governance semantics and execution contracts. Adapters should discover, extract, normalize, preserve metadata, emit diagnostics, and expose capabilities. Extensions should interpret technology-specific facts and emit rules, metrics, signals, findings, recommendations, and enrichments. Hosts should compose Core, adapters, extensions, profiles, credentials, execution, and output.

#201 should implement the additive Core evolution. #202 should migrate adapters, hosts, plugins, and extensions after compatibility support exists. #143 should follow the target model sequencing where possible and should keep dbt extraction separate from dbt-specific extension interpretation.
