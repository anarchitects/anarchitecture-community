# Governance Core Multi-Technology Roadmap

Status:
Implementation and migration roadmap for GitHub issue #207. This roadmap follows ADR 0002 and the target model design from `docs/governance/target-canonical-governance-model.md`.

## Purpose

This roadmap turns the Governance Core review phase into implementation and migration work.

It provides:

- implementation guidance for #201 Phase 1
- migration guidance for #202 Phase 2
- sequencing guidance for #143 dbt adapter
- compatibility strategy
- risk management
- suggested follow-up issues

This roadmap is documentation-only. It does not implement Core changes, adapters, extensions, hosts, or migrations.

## Decision Summary

ADR 0002 chooses this direction:

- Governance Core evolves toward a small technology-neutral canonical kernel.
- The kernel supports generic nodes/assets/items and typed relations, not only projects and dependencies.
- Current project/dependency contracts remain compatibility contracts and specializations during transition.
- Core owns stable governance semantics and generic execution contracts.
- Adapters extract, normalize, preserve metadata, emit evidence, diagnostics, and capabilities.
- Extensions interpret, enrich, evaluate, score, signal, and recommend.
- Hosts compose Core, adapters, extensions, profiles, credentials, execution, and output.
- Capability-based integration is preferred over adapter-to-extension dependencies.

## Phase 1: Additive Core Evolution

Reference: #201.

Goal:

- Add the target canonical abstractions without forcing immediate migration of existing adapters, hosts, plugins, or extensions.

Candidate implementation work:

1. Add target canonical abstractions additively.

- Add node/asset/item contracts.
- Add relation contracts.
- Add relation endpoint references.
- Add classification contracts.
- Add ownership assignment contracts.
- Add lifecycle/status contracts.
- Add perspective/viewpoint contracts.
- Add source/evidence/provenance contracts.

2. Preserve existing contracts.

- Keep `GovernanceWorkspace`.
- Keep `GovernanceProject`, `GovernanceProjectInput`, and project-oriented helpers.
- Keep `GovernanceDependency`, `GovernanceDependencyInput`, and dependency-oriented helpers.
- Keep existing `GovernanceWorkspaceAdapterResult` fields.
- Keep current assessment APIs operational.

3. Extend adapter result contracts additively.

- Add optional node inputs.
- Add optional relation inputs.
- Add optional perspective/evidence fields.
- Add optional target graph metadata.
- Preserve diagnostics, capabilities, and metadata.

4. Add compatibility mapping.

- Map `GovernanceProjectInput` to target nodes.
- Map `GovernanceDependencyInput` to target relations.
- Map project `domain`, `layer`, `scope`, and tags to classifications.
- Map project ownership to generic ownership assignments.
- Preserve dependency metadata in relation metadata.
- Preserve `sourceFile` as relation evidence/source location.

5. Add internal normalization if needed.

- Normalize mixed legacy and target adapter output deterministically.
- Detect duplicate node/relation identities.
- Preserve compatibility views for current rule and metric code.
- Avoid changing current observable behavior in Phase 1.

6. Preserve existing TypeScript adapter and CLI behavior.

- TypeScript adapter should continue emitting current project/dependency output.
- CLI should continue consuming current assessment output.
- Existing CLI commands should continue to work.
- Existing manual workspace files should continue to validate.

7. Preserve existing extensions and hosts.

- Keep existing extension contracts functional.
- Add target-model extension inputs as optional/additive alternatives if needed.
- Keep current host consumption paths working.

8. Introduce capability conventions.

- Document capability ids and data conventions.
- Let adapters describe available facts, source artifacts, versions, limitations, perspectives, and confidence.
- Let extensions check required/optional capabilities.

9. Add applicability safeguards.

- Add mechanisms for rules and metrics to declare applicability by capability, profile, inventory kind, or perspective.
- Do not silently apply project/dependency-specific built-ins to incompatible target inventories.

10. Document compatibility strategy.

- Update Core README after APIs are implemented.
- Link ADR 0002 and this roadmap from relevant Governance docs.
- Document old-to-new mapping behavior.

Phase 1 acceptance guidance:

- Existing adapters compile and run unchanged.
- Existing CLI behavior remains functionally equivalent.
- Existing extension behavior remains functional.
- Core can normalize both legacy and new adapter outputs.
- Target concepts are available for new adapters and extensions.
- No adapter migration is required to close #201.

## Phase 2: Adapter And Host Migration

Reference: #202.

Goal:

- Move adapters, hosts, plugins, and extensions from compatibility mode toward native target-model usage.

Candidate migration work:

1. Migrate TypeScript adapter.

- Emit native target nodes for packages/projects.
- Emit native target relations for imports/package edges.
- Continue emitting compatibility projects/dependencies during transition.
- Preserve TypeScript-specific metadata through structured metadata and capabilities.

2. Migrate Governance CLI.

- Read target graph output where available.
- Preserve current project/dependency commands.
- Add target-model inspection/reporting slices where useful.
- Keep output compatibility unless a versioned change is explicitly planned.

3. Migrate extensions where needed.

- Update extension inputs to consume target nodes/relations.
- Preserve sourcePluginId and capability-aware behavior.
- Keep existing extension contracts as compatibility paths until deprecation.

4. Migrate Nx adapter in `anarchitecture-plugins`.

- Map Nx project graph nodes to target nodes.
- Map Nx graph edges to target relations.
- Preserve Nx-specific metadata and capabilities.
- Keep Nx-specific enrichment outside Community Core.

5. Migrate Nx plugin/host in `anarchitecture-plugins`.

- Consume target model where available.
- Align executors, renderers, artifacts, profile handling, and report output.
- Preserve user-facing behavior where practical.

6. Migrate reports, renderers, and artifacts where needed.

- Decide which reports stay project/dependency oriented.
- Add node/relation reporting when useful.
- Keep assessment outputs stable where compatibility requires it.

7. Document deprecation strategy.

- Define which legacy contracts remain indefinitely as convenience specializations.
- Define which legacy contracts are candidates for deprecation.
- Define versioning expectations.
- Define migration checkpoints and consumer communication.

Phase 2 acceptance guidance:

- TypeScript adapter supports the target model.
- CLI supports target model consumption.
- Extensions can consume target node/relation references.
- Nx adapter/plugin migration path is documented and implemented in `anarchitecture-plugins`.
- Existing governance outputs remain functionally equivalent unless intentionally versioned.

## dbt Adapter Sequencing

Reference: #143.

Preferred sequence:

1. Complete ADR 0002 and this roadmap.
2. Implement #201 additive target model contracts.
3. Start dbt adapter against target node/relation/evidence/perspective contracts.
4. Build dbt-specific extension interpretation separately from adapter extraction.

dbt adapter should use the target canonical model direction:

- dbt project maps to workspace.
- dbt models, sources, seeds, snapshots, exposures, semantic models, and metrics should be represented as target nodes/assets where appropriate.
- `ref()` and `source()` lineage should be represented as typed target relations.
- manifest/catalog/run-results/sources artifacts should be represented through evidence, metadata, diagnostics, and capabilities.
- dbt-specific concepts such as materialization, tests, contracts, source freshness, macros, selectors, and semantic manifests should be preserved and interpreted by extensions.

dbt should not be forced into the legacy project/dependency-only model:

- Forcing dbt sources, exposures, semantic models, and metrics into projects is a known semantic compromise.
- If #143 must start before #201 completes, the adapter may emit compatibility projects/dependencies but should preserve dbt source graph metadata carefully.

dbt may validate the new model before full migration of existing adapters:

- dbt is a useful first non-code stress test.
- It can validate relation metadata, evidence, perspectives, and capability-aware extension behavior.
- It should not block TypeScript/Nx compatibility preservation.

## Compatibility Strategy

Old contracts retained during transition:

- `GovernanceWorkspace`
- `GovernanceProject`
- `GovernanceProjectInput`
- `GovernanceDependency`
- `GovernanceDependencyInput`
- `GovernanceWorkspaceAdapterResult`
- existing assessment, signal, metric, rule, extension, and CLI consumption paths

Compatibility helpers:

- project input to target node normalization
- dependency input to target relation normalization
- target node/relation to project/dependency compatibility views where feasible
- mixed legacy/target adapter output normalization
- diagnostics for ambiguous or lossy compatibility mappings

Deprecation policy:

- Do not deprecate legacy contracts during #201.
- During #202, document which contracts are compatibility conveniences versus migration targets.
- Remove or hard-deprecate only after all known consumers are migrated and a versioned breaking-change plan is accepted.

Migration checkpoints:

- checkpoint 1: Core accepts target node/relation output while old adapters still work
- checkpoint 2: TypeScript adapter emits target output
- checkpoint 3: CLI consumes target output where available
- checkpoint 4: Nx adapter/plugin migration in `anarchitecture-plugins`
- checkpoint 5: extension migration to target references
- checkpoint 6: deprecation review for legacy contracts

## Risk Management

Over-generalization risk:

- Keep Core kernel small.
- Promote concepts only when they appear across multiple ecosystems.
- Leave platform-specific semantics in extensions.

Metadata dumping risk:

- Preserve source metadata, but do not use metadata as the only place for stable semantics.
- Promote stable cross-ecosystem concepts to canonical fields.

Premature abstraction risk:

- Implement additively.
- Validate with TypeScript/Nx compatibility and dbt as the first non-code adapter.
- Defer uncertain vocabulary to ADRs.

Breaking consumers risk:

- Preserve current contracts in #201.
- Add compatibility normalization.
- Keep CLI and TypeScript adapter behavior unchanged until #202.

Adapter-extension coupling risk:

- Prefer capabilities.
- Keep adapters independent from extension packages.
- Let hosts compose compatible packages.

Misleading scoring risk:

- Gate rules and metrics by capability/profile/perspective.
- Avoid one universal health score for incompatible inventories.
- Allow technology-specific metrics in extensions.

Terminology collision risk:

- Clarify overloaded terms such as project, model, metric, snapshot, owner, dependency, and source.
- Use target terminology consistently once ADR naming is accepted.

## Suggested Follow-Up Issues

Candidate #201 implementation issues:

- Add target node/asset contracts to Core.
- Add target relation contracts to Core.
- Add relation endpoint reference and relation metadata preservation.
- Add perspective/viewpoint contracts.
- Add source/evidence/provenance contracts.
- Add classification and ownership assignment abstractions.
- Extend `GovernanceWorkspaceAdapterResult` additively.
- Add compatibility normalization from projects/dependencies to nodes/relations.
- Add capability conventions and capability-aware evaluation hooks.
- Add generic finding/signal references for nodes/relations.
- Add rule/metric applicability gating.
- Update Core README and public API documentation for additive model support.

Candidate #202 migration issues:

- Migrate TypeScript adapter to emit target nodes/relations.
- Migrate CLI inspect/dependencies/metrics/signals/violations flows to understand target graph data.
- Migrate extension inputs to target graph references.
- Migrate Nx adapter in `anarchitecture-plugins`.
- Migrate Nx plugin/host in `anarchitecture-plugins`.
- Migrate report renderers and artifacts where target graph output matters.
- Document deprecation checkpoints for legacy project/dependency contracts.

Candidate #143 dbt issues:

- Scaffold `@anarchitects/governance-adapter-dbt`.
- Implement dbt project/artifact detection.
- Load and validate `manifest.json` and `dbt_project.yml`.
- Map dbt resources to target nodes where available.
- Map dbt DAG edges to target relations where available.
- Preserve manifest/catalog/run-results/source freshness metadata.
- Emit dbt artifact capabilities.
- Keep dbt-specific rules, metrics, signals, and recommendations in a separate extension.

Additional recommended ADR issues:

- Decide target generic entity name: node, asset, or item.
- Decide relation kind vocabulary and extension policy.
- Decide evidence/source-of-truth model.
- Decide built-in rule/metric applicability model.
- Decide compatibility and deprecation policy for project/dependency contracts.

## Epic #200 Closure Readiness

Epic #200 can be considered ready to close after #207 if ADR 0002 and this roadmap are accepted.

Review outputs produced by #200:

- #203 documented current Core implementation limitations and technology-biased assumptions.
- #204 validated dbt as a concrete stress test and documented mapping gaps.
- #205 documented multi-technology requirements and Core/adapter/extension/host boundaries.
- #206 documented the target canonical Governance model direction.
- #207 records the architecture decision and implementation roadmap.

Implementation moves forward through:

- #201 for additive Core evolution
- #202 for adapter, host, plugin, and extension migration
- #143 for dbt adapter implementation after or alongside the target model sequencing

## Conclusion

The review phase concludes that Governance Core should evolve beyond project/dependency as the only canonical model while preserving those contracts as compatibility specializations.

The implementation path is intentionally two-phase:

- #201 adds the target Core model additively without requiring migrations.
- #202 migrates adapters, hosts, plugins, extensions, reports, and artifacts.

The dbt adapter should follow the target model direction where possible and should keep extraction separate from dbt-specific interpretation. Epic #200 is ready to close once this ADR and roadmap are accepted.
