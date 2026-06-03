# Governance Phase 2 Deprecation Strategy

## Purpose

This document closes the community-side Phase 2 migration by defining the
canonical-first model, compatibility guarantees, deprecation policy, migration
guidance, and source-organization conventions for Governance packages.

It follows ADR 0002 and the Phase 2 migration work in #236 through #241.

## Canonical-First Architecture

Governance packages are now canonical graph first.

Primary adapter artifacts:

- `nodes`
- `relations`
- `capabilities`
- `diagnostics`

Primary runtime and reporting artifacts:

- findings
- signals
- measurements
- scores
- recommendations
- diagnostics

`GovernanceNodeInput` and `GovernanceRelationInput` are the long-term adapter
output model for governed items and relationships. They are technology-neutral
and are intended for TypeScript, dbt, data-platform, GitHub, Atlassian,
governance-platform, and architecture-platform adapters.

## Compatibility Architecture

The project/dependency model remains supported as a compatibility view.

Compatibility contracts:

- `GovernanceProject`
- `GovernanceProjectInput`
- `GovernanceDependency`
- `GovernanceDependencyInput`
- `GovernanceWorkspace.projects`
- `GovernanceWorkspace.dependencies`
- `GovernanceWorkspaceAdapterResult.projects`
- `GovernanceWorkspaceAdapterResult.dependencies`

Compatibility helpers remain supported:

- `projectToNode(...)`
- `projectsToNodes(...)`
- `dependencyToRelation(...)`
- `dependenciesToRelations(...)`
- `buildGovernanceWorkspace(...)`
- `normalizeGovernanceGraph(...)` mixed legacy/canonical normalization

These contracts remain functional because existing Core rules, metrics,
assessment outputs, CLI commands, first-party consumers, and downstream
repositories still rely on them.

## Deprecation Policy

The compatibility contracts are deprecated for new adapter output but are not
removed.

Deprecation means:

- New adapters should emit `nodes` and `relations` as primary output.
- Existing adapters may continue emitting `projects` and `dependencies`.
- Migrated adapters should emit both canonical and compatibility output while
  compatibility consumers exist.
- Hosts and reporting should prefer canonical graph artifacts when available.
- Rules and metrics may continue using compatibility workspaces until a scoped
  graph-native replacement exists.

Deprecation does not mean:

- Public API removal.
- Runtime behavior changes.
- Breaking existing workspace documents.
- Removing project/dependency CLI output.
- Requiring downstream repositories to migrate immediately.

Removal is only allowed in a future major release after:

- all known first-party consumers are migrated
- downstream plugin cleanup is complete
- compatibility usage is audited
- a breaking-change plan is accepted
- migration documentation exists

## Migration Guidance

Adapter migration:

- Emit `GovernanceNodeInput[]` through `GovernanceWorkspaceAdapterResult.nodes`.
- Emit `GovernanceRelationInput[]` through
  `GovernanceWorkspaceAdapterResult.relations`.
- Continue emitting `GovernanceProjectInput[]` and
  `GovernanceDependencyInput[]` when existing consumers need them.
- Preserve source-specific details in metadata, capabilities, diagnostics,
  source, evidence, authority, and confidence fields where available.
- Do not depend on extension packages.

Host migration:

- Normalize graph output with `normalizeGovernanceGraph(...)`.
- Preserve compatibility workspace paths where assessment APIs still require
  them.
- Compose adapters and extensions through Core-owned capability and extension
  contracts.
- Do not reinterpret diagnostics into findings or recommendations.

Reporting migration:

- Treat canonical nodes and relations as primary inventory artifacts.
- Keep project/dependency report fields as compatibility output.
- Render `GovernanceDiagnostic` records directly.
- Shape focused reports through report scope/filtering instead of suppressing
  findings globally.

Extension migration:

- Consume Core-owned extension contracts only.
- Use adapter capabilities to determine whether technology-specific
  interpretation can run.
- Do not import adapter internals.

## Current Compatibility Guarantees

The following remain guaranteed during the current migration period:

- Legacy adapter results with only `projects` and `dependencies` still build a
  workspace.
- Legacy adapter results normalize into canonical nodes and relations.
- Mixed adapter results prefer explicit canonical nodes and relations when ids
  overlap.
- Existing assessment APIs remain project/dependency compatible.
- Existing CLI commands remain available.
- Existing JSON report fields remain present unless a future versioned change is
  explicitly accepted.

## Safe Cleanup Completed

Community-side cleanup removed unused CLI-internal execution engines that
duplicated Core-owned behavior:

- internal policy evaluation wrapper
- internal metric calculation wrapper
- internal health/recommendation calculation wrapper
- internal signal builders and signal types

These files were not imported by first-party code. Core remains the owner of
deterministic policy, signal, metric, health, and recommendation primitives.

CLI reporting helpers were also split by bounded context:

- canonical graph detail formatting
- focused report-scope rendering
- command report orchestration

This keeps presentation code organized without changing command behavior or
public output compatibility.

## Current Removal Candidates

Candidates for future review, not removal in this phase:

- project/dependency-specific assessment fields
- project/dependency-specific built-in rule implementations
- project/dependency-specific metric formulas
- project/dependency-specific signal snapshots
- compatibility project/dependency report sections
- legacy manual workspace document shape

These remain in place until graph-native equivalents and downstream migration
coverage are complete.

## Source Organization Conventions

Governance packages should organize internals by bounded context and cohesive
responsibility.

Recommended contexts:

- `adapter`: adapter contracts, adapter results, workspace normalization
- `model`: workspace, inventory, findings, metrics, scores, assessments
- `graph`: canonical node/relation normalization
- `compatibility`: legacy project/dependency mapping
- `evaluation`: profiles, rules, metrics, health, recommendations, signals
- `diagnostics`: diagnostics, exceptions, snapshots, drift
- `reporting`: report shaping and rendering helpers
- `extensions`: extension contracts, capabilities, registration, runtime
- `discovery`: source-system detection and extraction
- `mapping`: source facts to Core-owned contracts
- `runtime`: host orchestration and registration
- `cli`: parsing, resolution, IO, command execution, rendering

Do not split files only because they are large. Split when a cohesive bounded
context becomes clearer or when migrated legacy coupling can be removed without
changing behavior.

## Package Boundary Summary

Core owns:

- canonical contracts
- compatibility contracts
- deterministic evaluation primitives
- extension contracts
- reporting data contracts

Adapters own:

- extraction
- source validation
- canonical node/relation output
- compatibility output while required
- capabilities and diagnostics

Extensions own:

- technology-specific interpretation
- capability-aware rules, metrics, signals, recommendations, and enrichers

CLI/hosts own:

- adapter loading
- extension loading
- execution orchestration
- output routing
- process exit behavior
- report presentation

Plugins-side cleanup is out of scope for community #242 and remains tracked by
`anarchitects/anarchitecture-plugins#402`.

## Conclusion

Canonical nodes and relations are now the primary direction for community
Governance packages. Project and dependency contracts remain supported
compatibility contracts. Cleanup should continue incrementally, but public
compatibility is preserved until an explicit future breaking-change plan is
accepted.
