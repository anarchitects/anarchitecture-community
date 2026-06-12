# Governance Core Implementation Audit

Status:
Audit for GitHub issue #203. This document records the current `@anarchitects/governance-core` implementation before multi-technology Core refactor work. It does not define a target model.

## Purpose

This audit reviews the current Core implementation, not only the canonical model. It documents the current concepts, implementation areas, assumptions, technology-neutral seams, codebase-oriented seams, TypeScript/Nx-influenced seams, and risks of keeping the implementation unchanged.

Out of scope:

- implementing Phase 1 changes from issue #201
- introducing new canonical types
- changing production behavior
- changing Core contracts
- changing rule behavior
- changing metrics, signals, scoring, diagnostics, adapters, CLI, extensions, or tests
- deciding the target model for issue #206
- mapping dbt semantics for issue #204

Primary files reviewed:

- `packages/governance/core/src/core/models.ts`
- `packages/governance/core/src/core/adapter.ts`
- `packages/governance/core/src/core/rules.ts`
- `packages/governance/core/src/core/rule-engine.ts`
- `packages/governance/core/src/core/built-in-rules.ts`
- `packages/governance/core/src/core/built-in-rule-pack.ts`
- `packages/governance/core/src/core/profile.ts`
- `packages/governance/core/src/core/metrics.ts`
- `packages/governance/core/src/core/health.ts`
- `packages/governance/core/src/core/signals.ts`
- `packages/governance/core/src/core/signal-builders.ts`
- `packages/governance/core/src/core/assessment.ts`
- `packages/governance/core/src/core/assessment-artifacts.ts`
- `packages/governance/core/src/core/exceptions.ts`
- `packages/governance/core/src/core/exception-runtime.ts`
- `packages/governance/core/src/core/snapshots.ts`
- `packages/governance/core/src/core/drift.ts`
- `packages/governance/core/src/core/project-matching.ts`
- `packages/governance/core/src/core/delivery-impact.ts`
- `packages/governance/core/src/core/ai-context.ts`
- `packages/governance/core/src/core/ai-payload.ts`
- `packages/governance/core/src/extensions/contracts.ts`
- `packages/governance/core/src/extensions/capabilities.ts`
- `packages/governance/core/src/extensions/diagnostics.ts`
- `packages/governance/core/src/extensions/runtime.ts`
- `packages/governance/adapter-typescript/src/workspace-adapter.ts`
- `packages/governance/adapter-typescript/src/project-discovery.ts`
- `packages/governance/adapter-typescript/src/import-graph.ts`
- `packages/governance/adapter-typescript/src/map-imports-to-projects.ts`
- `packages/governance/adapter-typescript/src/extract-package-governance-metadata.ts`
- `packages/governance/adapter-typescript/src/types.ts`
- `packages/governance/cli/src/check.ts`
- `packages/governance/cli/src/workspace-validate.ts`
- `packages/governance/cli/src/profile-validate.ts`
- `packages/governance/cli/src/agov.ts`
- `packages/governance/cli/src/render-report.ts`
- `packages/governance/cli/src/internal/manual-workspace/load-workspace.ts`
- `packages/governance/cli/src/internal/profile/load-standalone-profile.ts`
- `packages/governance/core/README.md`
- `packages/governance/adapter-typescript/README.md`
- `packages/governance/cli/README.md`
- `docs/adr/0001-governance-package-boundaries.md`
- `docs/governance-package-boundaries.md`
- `docs/governance-package-layout.md`
- `docs/governance-documentation-structure.md`

Related audit:

- `docs/governance/core-canonical-model-audit.md`

## Current Core Surface

`@anarchitects/governance-core` exports the public Core surface from `packages/governance/core/src/index.ts` and `packages/governance/core/src/core/index.ts`. The package README describes Core as the owner of canonical contracts, deterministic evaluation logic, and portable extension APIs.

Current Core surface areas include:

- adapter contracts and workspace normalization
- canonical workspace, project, dependency, ownership, violation, measurement, health, assessment, snapshot, drift, signal, recommendation, exception, delivery-impact, and AI-analysis models
- profile normalization and rule configuration
- built-in policy rules and rule packs
- rule execution helpers
- assessment artifact assembly
- graph, conformance, and policy signal builders
- metric calculation and health scoring
- deterministic recommendation generation
- exception lifecycle and suppression handling
- snapshot creation and comparison
- drift summarization
- affected-project matching
- delivery-impact and AI handoff helpers
- extension contracts, capability registry, diagnostics, and runtime registration/execution helpers

The package boundary is technology-neutral at dependency level. Core does not import the TypeScript adapter, Governance CLI, Nx APIs, or concrete host code. The implementation is still centered on projects, dependencies, domains, layers, ownership, and codebase-style health signals.

## Current Canonical Model

The central inventory model is `GovernanceWorkspace` in `packages/governance/core/src/core/models.ts`.

`GovernanceWorkspace` represents one governance inventory:

- `id`: workspace identifier
- `name`: workspace display name
- `root`: workspace root string
- `projects`: canonical `GovernanceProject[]`
- `dependencies`: canonical `GovernanceDependency[]`

`GovernanceProject` represents the primary governable unit:

- `id`: project identifier
- `name`: project name
- `root`: project root string
- `type`: `application`, `library`, `tool`, or `unknown`
- `tags`: generic string tags
- `domain`: optional first-class domain
- `layer`: optional first-class architectural layer
- `ownership`: optional `Ownership`
- `metadata`: generic `Record<string, unknown>`

`GovernanceDependency` represents a directional project relation:

- `source`: source project identifier string
- `target`: target project identifier string
- `type`: `static`, `dynamic`, `implicit`, or `unknown`
- `sourceFile`: optional source path

`Ownership` represents project ownership:

- `team`
- `contacts`
- `source`: `project-metadata`, `codeowners`, `merged`, or `none`

`Violation` represents a policy or extension finding:

- `id`, `ruleId`, `project`, `severity`, `category`, and `message`
- optional `details`, `recommendation`, and `sourcePluginId`

`Measurement` represents a metric:

- `id`, `name`, `family`, `value`, `score`, `maxScore`, and `unit`
- optional `sourcePluginId`

`GovernanceAssessment` represents the aggregate report:

- workspace, profile, warnings, exceptions, violations, measurements, signal breakdown, metric breakdown, top issues, health, and recommendations

Stable/generic parts:

- inventory boundary, identity, metadata, diagnostics, capabilities, rule execution, extension contribution, findings, metrics, health, assessment, snapshots, and drift are generic as contract shapes
- most public contracts avoid direct Nx or TypeScript imports
- extension APIs allow outside behavior to contribute enrichers, rules, signals, and measurements

Codebase/project-oriented parts:

- the primary entity is named `project`
- the primary relation is named `dependency`
- project roots and source files are first-class
- domain/layer dependency policies are first-class
- metrics, built-in signals, and delivery-impact drivers are derived from project and dependency graphs

## Current Adapter Result Model

Core adapter contracts live in `packages/governance/core/src/core/adapter.ts`.

`GovernanceWorkspaceAdapter<TInput>` exposes:

- `id`
- optional `probe(input)`
- `loadWorkspace(input)`

`GovernanceWorkspaceAdapterResult` can carry:

- a complete `workspace`
- workspace id/name/root fields
- `projects`
- `dependencies`
- `capabilities`
- `diagnostics`
- `metadata`

`GovernanceProjectInput` contains:

- `id`, `name`, `root`, `type`
- `domain`, `layer`, `scope`
- `tags`
- `ownership`
- `metadata`

`GovernanceDependencyInput` contains:

- `sourceProjectId`
- `targetProjectId`
- `type`
- `sourceFile`
- `metadata`

`buildGovernanceWorkspace(...)` normalizes adapter output into canonical Core contracts:

- defaults missing workspace id/name to `workspace`
- defaults missing workspace root and project roots to empty strings
- defaults project name to project id
- maps project type aliases `app` and `lib`
- maps unsupported project and dependency types to `unknown`
- derives `domain` from project overrides, explicit domain, `domain:` tags, or `scope:` tags
- derives `layer` from project overrides, explicit layer, or `layer:` tags
- reads ownership team from `metadata.ownership` or `metadata.ownership.team`
- merges profile override ownership, metadata ownership, and adapter ownership

Notable adapter-result observations:

- `scope` is present on adapter input but not on canonical `GovernanceProject`
- dependency input `metadata` is not retained on canonical `GovernanceDependency`
- adapter result `metadata`, `capabilities`, and `diagnostics` are preserved in assessment artifacts when supplied, but not embedded in the canonical workspace
- dependency endpoints are stored as strings, while some built-in rules resolve them through project names

## Current Rule Engine

Rule contracts live in `packages/governance/core/src/core/rules.ts`. Execution helpers live in `packages/governance/core/src/core/rule-engine.ts`.

`GovernanceRuleContext` provides:

- `workspace`
- optional `profile`
- optional `options`
- optional `capabilities`
- optional `diagnostics`

`GovernanceRuleResult` can return:

- `violations`
- `signals`
- `measurements`

`evaluateRules(...)` executes rules sequentially and appends returned violations, signals, and measurements. `evaluateRulePack(...)` delegates to `evaluateRules(...)`.

Technology-neutral parts:

- rule execution is generic and asynchronous
- rules can emit violations, signals, and measurements
- rule packs are simple containers
- rule context can receive capabilities and diagnostics

Current limitations and assumptions:

- built-in policy evaluation mostly uses `workspace.projects` and `workspace.dependencies`
- the built-in rule implementation resolves dependency endpoints through project names
- rule categories include architecture, boundary, ownership, metadata, convention, structure, snapshot, drift, and AI categories, but built-in behavior is concentrated on project boundaries and metadata
- rule context capabilities and diagnostics are available in the contract but not central to built-in rules

## Current Built-In Rules

Built-in rules live in `packages/governance/core/src/core/built-in-rules.ts`.

Current built-in policy rules:

- `domain-boundary`
- `layer-boundary`
- `ownership-presence`
- `project-name-convention`
- `tag-convention`
- `missing-domain`
- `missing-layer`

`domain-boundary`:

- evaluates dependencies between source and target projects
- requires both projects to have domains
- emits a violation when source and target domains differ and the profile does not allow that dependency
- uses `allowedDomainDependencies`

`layer-boundary`:

- evaluates dependencies between source and target projects
- requires both projects to have layers declared in profile layers
- emits a violation when the layer dependency is not allowed
- uses `allowedLayerDependencies` or derives allowed dependencies from layer order

`ownership-presence`:

- evaluates projects
- emits a violation when ownership is required and the project has no team or contacts

`project-name-convention`:

- evaluates project names against a configured regular expression

`tag-convention`:

- evaluates project tags against required prefixes, allowed prefixes, and value pattern

`missing-domain` and `missing-layer`:

- evaluate project metadata presence when explicitly configured

Technology-neutral parts:

- rules are deterministic and profile-configured
- convention and metadata rules can apply to any entity that has names and tags, if that entity is represented as a project

Codebase-oriented parts:

- boundary rules are explicitly project-to-project dependency rules
- domain and layer are first-class policy axes
- recommendations use refactoring and dependency language
- ownership messaging should align on canonical ownership wording

## Current Profiles And Configuration

Profile contracts live in `packages/governance/core/src/core/profile.ts`. CLI standalone profile validation lives in `packages/governance/cli/src/internal/profile/load-standalone-profile.ts`.

`GovernanceProfile` includes:

- `name`
- optional `description`
- `boundaryPolicySource`: `profile` or `eslint`
- `layers`
- optional `rules`
- optional `allowedLayerDependencies`
- required `allowedDomainDependencies`
- `ownership.required`
- `health.statusThresholds`
- metric weights by measurement id

`normalizeGovernanceProfile(...)` builds compatibility rule configuration for:

- domain boundaries
- layer boundaries
- ownership presence

It also derives layer dependencies from layer order when explicit layer dependencies are absent.

Profile override support includes:

- project-level `domain`
- project-level `layer`
- project-level `ownershipTeam`
- project-level `documentation`

Standalone CLI profile validation rejects Nx runtime-only profile fields:

- `projectOverrides`
- `exceptions`
- `eslint`
- legacy Nx metric weight keys

Technology-neutral parts:

- profile as a policy/scoring configuration is generic
- rule config with `enabled`, `severity`, and `options` is generic
- metric weights and health thresholds are generic

Codebase-oriented and Nx-influenced parts:

- `boundaryPolicySource` includes `eslint`
- layers and layer dependency order are first-class
- allowed domain dependencies are required
- project overrides are project-specific
- standalone validation has explicit Nx runtime compatibility rejection

## Current Metrics And Measurements

Metric contracts live in `packages/governance/core/src/core/models.ts`. Calculation lives in `packages/governance/core/src/core/metrics.ts`.

Current built-in metric families:

- `architecture`
- `boundaries`
- `ownership`
- `documentation`

Current built-in measurements:

- `architectural-entropy`
- `dependency-complexity`
- `domain-integrity`
- `ownership-coverage`
- `documentation-completeness`
- `layer-integrity`

Current metric inputs:

- workspace dependency count
- workspace project count
- graph/policy/conformance/extension signals
- ownership fields on projects
- `project.metadata.documentation`

Current metric behavior:

- structural dependency signal count can override canonical dependency count for dependency-based calculations
- entropy penalty comes from cross-domain dependencies, missing domain context, and circular dependency signals
- boundary penalties come from domain and layer violation signal weights
- ownership coverage is owned projects divided by project count
- documentation completeness is documented projects divided by project count
- metric values are normalized ratios
- metric scores are on a 0-100 scale

Technology-neutral parts:

- `Measurement` is generic and accepts open metric families
- extension metric providers can contribute additional measurements
- weighted scoring can consume arbitrary measurement ids

Codebase-oriented parts:

- the built-in metrics assume project count and dependency count are meaningful denominators
- dependency complexity and architectural entropy assume a graph of project dependencies
- ownership and documentation are measured per project
- metric family ordering is biased toward architecture, boundaries, ownership, and documentation

## Current Signals And Findings

Signal contracts live in `packages/governance/core/src/core/signals.ts`. Signal builders live in `packages/governance/core/src/core/signal-builders.ts`.

Current signal sources:

- `graph`
- `conformance`
- `policy`
- `extension`

Known signal types:

- `structural-dependency`
- `cross-domain-dependency`
- `missing-domain-context`
- `circular-dependency`
- `conformance-violation`
- `domain-boundary-violation`
- `layer-boundary-violation`
- `ownership-gap`

Signal categories:

- `boundary`
- `ownership`
- `dependency`
- `compliance`
- `unknown`
- `structure`

`buildGovernanceGraphSignals(...)` creates:

- one `structural-dependency` signal per graph dependency
- a `cross-domain-dependency` signal when dependency endpoints have different domains
- a `missing-domain-context` signal when either endpoint lacks domain context

`buildGovernancePolicySignals(...)` maps only selected built-in policy rule ids:

- `domain-boundary` to `domain-boundary-violation`
- `layer-boundary` to `layer-boundary-violation`
- `ownership-presence` to `ownership-gap`

`buildGovernanceConformanceSignals(...)` maps conformance findings into conformance violation signals.

Technology-neutral parts:

- signal shape is generic and extensible through string extension types
- related projects are represented as arrays
- extension providers can emit signals

Codebase-oriented parts:

- graph signals assume project dependency edges
- most known signal types are architectural dependency or ownership findings
- related entities are named `relatedProjectIds`
- signal builders use `sourceProjectId` and `targetProjectId`

## Current Assessment And Scoring Model

Assessment assembly spans `packages/governance/core/src/core/assessment-artifacts.ts`, `assessment.ts`, `health.ts`, `snapshots.ts`, `drift.ts`, `delivery-impact.ts`, and AI helper modules.

`buildGovernanceAssessmentArtifacts(...)` orchestrates:

- workspace resolution from a canonical workspace or adapter result
- optional extension enrichers
- built-in policy evaluation
- exception application
- optional extension rule packs
- graph, conformance, policy, and extension signal collection
- built-in and extension metric collection
- top issue aggregation
- deterministic recommendation generation
- health calculation
- final `GovernanceAssessment` construction

`buildGovernanceAssessment(...)` creates filtered assessment output and breakdowns:

- filters by report type for health, boundaries, ownership, and architecture
- builds signal breakdown by source, type, and severity
- builds metric breakdown by family
- builds top issues from signals

`calculateGovernanceHealth(...)`:

- computes weighted average score from measurements and profile metric weights
- maps score to grade A/B/C/D/F
- maps score to status `good`, `warning`, or `critical`
- identifies metric hotspots below 60
- identifies project hotspots from top issues
- creates explainability summary strings

`buildGovernanceRecommendations(...)`:

- recommends reducing cross-domain dependencies when domain boundary violations exist
- recommends improving ownership coverage when ownership violations exist
- recommends reducing dependency complexity when that metric score is low

Snapshot support:

- `buildMetricSnapshot(...)` serializes metrics, scores, violations, health, signal breakdowns, metric breakdowns, top issues, and optional delivery-impact summary
- snapshot metadata includes `repo`, `branch`, `commitSha`, `pluginVersion`, and `metricSchemaVersion`

Drift support:

- `compareSnapshots(...)` diffs metric maps, score maps, violations, health, signal breakdowns, metric families, top issues, and delivery-impact indices
- `summarizeDrift(...)` creates drift signals for workspace health, metric scores, metric families, signal sources, signal types, signal severities, top issues, and violation footprint
- known drift orders are hard-coded around current signal sources, signal types, and metric families

Delivery-impact and AI helpers:

- delivery-impact indices are built from current governance metrics and top issues
- PR impact, cognitive-load, onboarding, refactoring, and scoped AI payload helpers use projects, domains, dependencies, violations, snapshots, and changed file counts

Technology-neutral parts:

- deterministic orchestration is generic
- health score, snapshots, drift deltas, and payload slicing are reusable patterns
- extension measurements and signals can participate in assessments

Codebase-oriented parts:

- built-in scoring and recommendations assume dependency governance
- project hotspots are derived from project-related top issues
- delivery-impact drivers use domain integrity, layer integrity, ownership coverage, dependency complexity, architectural entropy, and documentation completeness
- AI contexts use affected projects, affected domains, scoped dependencies, fanout, hotspot projects, and changed files

## Current Diagnostics And Capabilities

Core diagnostics and capabilities are intentionally small.

`GovernanceDiagnostic` in `packages/governance/core/src/core/adapter.ts`:

- `code`
- `message`
- optional `source`
- optional `details`

`GovernanceCapability`:

- `id`
- optional `version`
- optional `data`

`DefaultGovernanceCapabilityRegistry`:

- freezes capabilities
- rejects duplicate capability ids
- supports `has`, `get`, and `list`

Extension diagnostics in `packages/governance/core/src/extensions/diagnostics.ts` have:

- typed extension diagnostic codes
- severity `notice`, `warning`, or `error`
- optional package, module, extension id, and legacy fields

Extension runtime:

- registers enrichers, rule packs, signal providers, and metric providers
- stamps extension-provided violations, signals, and measurements with `sourcePluginId`
- forces extension signal source to `extension`
- rejects duplicate extension ids

Technology-neutral parts:

- diagnostics and capabilities are generic envelopes
- extension diagnostics are independent from TypeScript and Nx
- extension execution can enrich workspaces and add rules/signals/metrics

Narrow or unclear parts:

- generic diagnostics have no standard severity field
- generic diagnostics have no standard location/path field
- capability data is untyped, which preserves flexibility but weakens cross-adapter semantics
- adapter capabilities are collected but not used by built-in Core behavior

## Current Adapter And Host Usage

TypeScript adapter:

- implements `GovernanceWorkspaceAdapter<string>`
- probes workspace support based on package-manager and TypeScript indicators
- parses `pnpm-workspace.yaml` and `package.json#workspaces`
- discovers package roots using configured patterns
- extracts package governance metadata from `package.json#governance`
- derives `domain`, `layer`, and `scope` tags
- builds import graph from TypeScript/JavaScript source files
- maps imports and path aliases to project dependencies
- emits Core project and dependency input contracts
- emits adapter diagnostics with source `governance.typescript_adapter`

Governance CLI:

- is adapter-agnostic at package dependency level
- accepts canonical workspace files or explicit/dynamic adapters
- calls `buildGovernanceAssessmentArtifacts(...)` with profile and adapter result
- validates manual workspace files into Core adapter results
- validates standalone profiles into Core `GovernanceProfile`
- renders assessment, metrics, violations, recommendations, signals, dependencies, inspect, profile validation, and workspace validation reports

Manual workspace host schema:

- requires `workspace`, `projects`, and `dependencies`
- validates project names, roots, tags, types, and metadata
- validates dependency source/target/type and cross-references by project name
- validates normalized relative paths
- restricts project types to `application`, `library`, `tool`, and `unknown`
- restricts dependency types to `static`, `dynamic`, `implicit`, and `unknown`
- disallows multiple `domain:`, `scope:`, or `layer:` tags on one project
- emits a manual workspace capability

Documentation:

- package and repository docs consistently state that Core owns canonical contracts and adapters normalize into them
- package-boundary docs prohibit Core dependencies on concrete adapters, CLI, Nx, or plugin runtimes
- TypeScript adapter docs state that it maps TypeScript workspace discovery and static imports into Core contracts
- CLI docs describe adapter discovery, canonical workspace document mode, and output formats

## Technology-Neutral Areas

The following areas are genuinely technology-neutral at the current implementation level:

- package dependency direction and boundary isolation
- adapter contract shape and probe/load abstraction
- rule execution mechanism
- generic rule result shape
- generic violation shape
- generic measurement shape
- generic diagnostic and capability envelopes
- extension contribution mechanism
- assessment artifact orchestration as a deterministic pipeline
- health scoring as weighted measurement aggregation
- snapshot and drift mechanics for numeric maps and finding lists
- profile rule config shape with `enabled`, `severity`, and `options`
- extension-provided signals and measurements

These areas can support future technologies, but some are currently fed by codebase-oriented built-ins.

## Codebase-Oriented Areas

The following areas are codebase-governance-specific but reusable for code-oriented adapters:

- project inventory
- project roots
- project tags
- project ownership
- project-to-project dependencies
- domain and layer boundary policies
- dependency complexity
- architectural entropy
- ownership and documentation coverage per project
- source-file-backed dependency traces
- affected-project matching from changed files
- PR impact and cognitive-load helpers based on affected projects and fanout
- CLI filters for project, domain, layer, dependency type, signal type, and metric family

These are useful for TypeScript, Nx, and other codebase adapters, but they should not be treated as proven sufficient for all future governance sources.

## TypeScript/Nx-Biased Areas

The following areas are specifically TypeScript/Nx-influenced:

- TypeScript adapter workspace detection through `package.json`, `pnpm-workspace.yaml`, `package.json#workspaces`, `tsconfig.json`, and `tsconfig.base.json`
- TypeScript adapter project discovery from package-manager workspace package roots
- TypeScript adapter import graph based on relative imports, package-name imports, path aliases, `baseUrl`, re-exports, and dynamic imports
- TypeScript adapter metadata extraction from package-level `package.json#governance`
- `boundaryPolicySource` includes `eslint`
- standalone CLI profile validation explicitly rejects Nx runtime-only profile fields
- package docs and ADRs repeatedly frame Nx isolation as a boundary requirement
- manual workspace schema mirrors current project/dependency enums and classification tag conventions

These areas are not necessarily wrong. They are current implementation facts that matter before a multi-technology refactor.

## Implicit Assumptions

Workspace assumptions:

- one workspace root is enough to describe the inventory boundary
- workspaces contain projects and dependencies as top-level concepts
- missing workspace identifiers can default safely
- workspace roots can be represented as portable strings

Project assumptions:

- the main governable unit is a project
- every important governed item can have an id, name, root, type, tags, metadata, optional domain, optional layer, and optional ownership
- project names are stable enough for user-facing messages and rule lookup
- root paths are meaningful for affected-project matching and host validation
- project type can fit `application`, `library`, `tool`, or `unknown`

Dependency assumptions:

- important relationships can be modeled as source project to target project
- relation type can fit `static`, `dynamic`, `implicit`, or `unknown`
- self-dependencies are invalid in manual workspace schema
- duplicate source/target/type dependencies can be deduplicated or rejected
- a dependency can optionally be traced to a source file

Filesystem and path assumptions:

- project and workspace roots are normalized relative paths in manual workspace mode
- path containment maps changed files to affected projects
- TypeScript adapter can read repository files directly
- source files and package roots are the natural discovery substrate for the current adapter

Classification assumptions:

- domain and layer are first-class governance dimensions
- scope is adapter input and tag-derived, not a canonical project field
- classification can be carried through `domain:`, `layer:`, and `scope:` tag prefixes
- allowed domain dependencies and layer dependencies are sufficient for built-in boundary policy

Ownership assumptions:

- ownership belongs to projects
- ownership can be represented with team and contacts
- ownership source fits `project-metadata`, `codeowners`, `merged`, or `none`
- ownership presence is a meaningful health and policy signal
- Core ownership normalization reads `metadata.ownership` and adapter ownership, while the TypeScript adapter currently emits metadata owner as `metadata.owner`

Metadata and capability assumptions:

- future or adapter-specific semantics can be carried in metadata, details, or capability data
- untyped capability data is acceptable at the Core boundary
- adapter diagnostics can carry custom details without a standard Core severity or location shape

Rule evaluation assumptions:

- rules can evaluate a complete in-memory workspace
- built-in rules can resolve dependency endpoints to projects
- project-to-project boundary violations are core governance concerns
- missing domain/layer metadata is meaningful only when profiles enable those rules
- rule output can be merged by concatenating arrays

Metrics and scoring assumptions:

- project count and dependency count are meaningful denominators
- dependency count per project is meaningful as complexity pressure
- domain, layer, ownership, and documentation metrics are enough for current health scoring
- measurement scores are comparable on a 0-100 scale
- weighted average is an acceptable workspace health model
- metric hotspot threshold of 60 is generally meaningful

Signal and finding assumptions:

- graph, conformance, policy, and extension are enough as signal source families
- top issues can be grouped by signal type, source, severity, rule id, message, and projects
- policy violations can map to signals only for selected built-in rule ids
- related entities are project ids

Reporting/output assumptions:

- reports can be sliced by health, boundaries, ownership, architecture, metrics, violations, recommendations, signals, dependencies, and projects
- JSON, text, table, and Markdown are sufficient host output formats
- snapshot metadata uses repository, branch, commit SHA, plugin version, and metric schema version
- assessment summaries and delivery-impact summaries can be expressed in project/dependency governance language

## Risks Of Keeping The Current Implementation Unchanged

Forcing non-code assets into projects:

Future adapters for dbt, Fabric, GitHub, Atlassian, governance-platform sources, or other systems may have assets that are not naturally code projects with repository roots. Keeping the implementation unchanged may force those assets into `GovernanceProject` records and lose asset-specific meaning.

Forcing non-project relations into dependencies:

Lineage, ownership, documentation links, deployment relationships, repository membership, platform permissions, policy coverage, planning links, and data-product relationships may not fit current dependency types. Keeping only source/target project dependencies risks flattening relation semantics.

Overusing metadata:

The current implementation relies on `metadata`, `details`, and capability `data` as escape hatches. Future adapters could hide important semantics in untyped records, making them hard for rules, metrics, reports, and extensions to use consistently.

Weakening future adapter semantics:

Adapters may have to translate source concepts into project/dependency/codebase terms before Core sees them. That can make future adapters technically compatible but semantically weak.

Awkward dbt, Fabric, GitHub, Atlassian, and governance-platform integrations:

Those integrations may need canonical semantics for assets, relations, ownership, classification, policy coverage, platform state, workflow state, or organizational structures. Without broader Core concepts, integrations may rely on conventions, tags, `unknown` types, and metadata.

Rule evaluation depending on codebase-specific assumptions:

Built-in rules assume project-to-project dependency governance. Future non-code adapters may need rules over entities, relationships, policy coverage, lineage, lifecycle, or workflow objects rather than project dependencies.

Metrics, signals, and scoring becoming less meaningful outside TypeScript/Nx contexts:

Built-in metrics and signals are meaningful for codebase governance, but dependency complexity, architectural entropy, domain integrity, layer integrity, ownership coverage, and documentation completeness may not represent health for every future source.

Id/name ambiguity:

Built-in rules resolve dependencies through project names while canonical dependencies store endpoint strings. The current TypeScript adapter keeps ids and names aligned. Future adapters with distinct stable ids and display names may need stricter conventions or could produce confusing evaluations.

Path-root coupling:

Affected-project matching, manual workspace validation, TypeScript adapter discovery, and source-file tracing all assume file-backed roots. Remote, virtual, generated, or API-backed assets may not fit this model.

Capability underuse:

Capabilities can describe adapter support, but current built-in Core behavior does not use them to select metric families, rule families, or scoring semantics. Future adapters may need capability-aware evaluation to avoid misleading built-in outputs.

Diagnostic inconsistency:

Generic diagnostics lack standard severity and location fields. Adapter and CLI diagnostics add path-like fields through extension interfaces. Future adapters may produce inconsistent diagnostic output unless conventions are clarified later.

## Candidate Follow-Up Questions

- Should Core keep `project` as the only primary governable unit?
- Should Core distinguish generic assets/entities from code projects?
- Should relations be first-class beyond `GovernanceDependency`?
- Should dependency endpoints be explicitly ids, names, or typed references?
- Should Core preserve adapter dependency metadata?
- Should `scope` become canonical, remain tag-only, or be replaced by broader classification?
- Should Core ownership normalization recognize the TypeScript adapter `metadata.owner` convention?
- Should built-in rule evaluation remain always-on for every adapter, or become capability/profile dependent?
- Should metrics and scoring be selected by adapter capabilities or inventory kind?
- Should signal fields use project terminology, generic entity terminology, or both?
- Should diagnostics standardize severity and location?
- Should delivery-impact and AI helpers stay in Core if they remain project/dependency heavy?
- Which findings belong in issue #204 dbt mapping, issue #205 broader review, and issue #206 target-model design?

These are candidate questions only. This audit does not answer them.

## Conclusion

The current Core implementation is package-boundary neutral: it avoids concrete adapter, CLI, and Nx dependencies, and it exposes generic contracts for adapters, rules, diagnostics, capabilities, extensions, assessments, snapshots, and drift.

The implementation is also strongly shaped by codebase governance. The central inventory is projects and dependencies; built-in rules evaluate project-to-project dependency boundaries; built-in metrics score dependency complexity, architectural entropy, domain/layer integrity, ownership coverage, and documentation completeness; signal and AI helper fields refer to projects and dependencies throughout.

For the current TypeScript adapter and standalone CLI, that implementation is coherent. Before multi-technology refactor work, the main risk is not a package-boundary violation but semantic narrowing: future adapters may fit only by flattening richer governance sources into projects, dependencies, tags, and metadata. Issues #204, #205, and #206 should remain follow-up work for source-specific mapping, broader analysis, and target model decisions.
