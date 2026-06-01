# `@anarchitects/governance-core`

Canonical Governance contracts, deterministic evaluation logic, and portable extension APIs.

## Overview

`@anarchitects/governance-core` is the package that defines the Governance model layer for the Anarchitects Governance package family. It owns the public contracts that adapters, hosts, and extensions normalize into, plus the deterministic logic that evaluates those contracts.

Use this package when you need:

- canonical workspace, node, relation, classification, ownership, perspective, source, evidence, finding, signal, metric, score, assessment, project, dependency, violation, measurement, health, snapshot, drift, and AI-analysis contracts
- deterministic rule evaluation and assessment assembly
- built-in Governance rule packs
- portable adapter input contracts
- portable extension contracts, capability contracts, diagnostics, and runtime registration helpers

## Responsibilities

This package is responsible for:

- defining the canonical `GovernanceWorkspace` model and related result shapes
- defining adapter-facing input contracts such as `GovernanceNodeInput`, `GovernanceRelationInput`, `GovernanceClassificationInput`, `GovernanceOwnershipInput`, `GovernancePerspective`, `GovernanceSource`, `GovernanceEvidence`, `GovernanceProjectInput`, `GovernanceDependencyInput`, and `GovernanceWorkspaceAdapterResult`
- defining profile, rule, finding, signal, exception, measurement, score, health, assessment, snapshot, and drift contracts
- providing deterministic helpers such as profile normalization, rule evaluation, assessment assembly, snapshot comparison, and AI handoff payload builders
- providing internal graph normalization infrastructure for legacy project/dependency inputs and additive node/relation inputs
- providing compatibility helpers that map legacy project/dependency inputs to canonical node/relation inputs during the migration period
- providing capability-based integration contracts so hosts can compose adapters and extensions without adapter-to-extension imports
- providing host-independent helpers that map changed files onto canonical `GovernanceProject` models and shape snapshot delivery-impact summaries
- providing portable extension contracts and runtime helpers that stay independent from Nx

This package is not responsible for:

- concrete adapter implementations
- CLI command behavior or argument parsing
- Nx runtime behavior
- Nx graph loading or metadata extraction
- Nx executors or generators
- plugin runtime behavior

## Public API

The package has a single public entrypoint:

```ts
import {
  buildDeliveryImpactAssessment,
  buildSnapshotDeliveryImpactSummary,
  buildCognitiveLoadContext,
  buildDriftInterpretationAnalysis,
  buildGovernanceAssessment,
  buildGovernanceAssessmentArtifacts,
  buildGovernancePayloadTruncationMetadata,
  buildGovernanceConformanceSignals,
  buildGovernanceGraphSignals,
  buildGovernancePolicySignals,
  buildGovernanceRecommendations,
  buildOnboardingContext,
  buildPersistentSmellSignals,
  buildPrImpactContext,
  buildRecommendationsTrendContext,
  resolveAffectedGovernanceProjects,
  buildRefactoringSuggestionsContext,
  buildGovernanceWorkspace,
  buildMetricSnapshot,
  projectToNode,
  dependencyToRelation,
  buildScopedDriftRequest,
  buildScopedRootCauseRequest,
  buildScopedScorecardRequest,
  calculateGovernanceHealth,
  calculateGovernanceMetrics,
  compareGovernanceViolationsForPriority,
  compareSnapshots,
  coreBuiltInRulePack,
  evaluateGovernancePolicies,
  evaluateRulePack,
  buildManagementInsightsAiRequest,
  normalizeGovernanceException,
  normalizeGovernanceProfile,
  registerLoadedGovernanceExtensions,
  scopeGovernanceDependencies,
  sliceGovernancePayloadItems,
  type GovernanceWorkspaceAdapter,
  type GovernanceNodeInput,
  type GovernanceRelationInput,
  type GovernanceClassificationInput,
  type GovernanceOwnershipInput,
  type GovernancePerspective,
  type GovernanceSource,
  type GovernanceEvidence,
  type GovernanceFinding,
  type GovernanceScore,
  type GovernanceAssessmentScope,
  type GovernanceWorkspace,
  type GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';
```

The root export preserves the package API while the implementation is organized
around bounded contexts:

- `adapter`: adapter contracts, adapter result contracts, and workspace normalization
- `model`: canonical workspace, project, dependency, finding, metric, score, and assessment models
- `graph`: canonical node/relation graph normalization
- `compatibility`: legacy project/dependency compatibility mapping and project matching
- `evaluation`: profiles, rules, rule engine, built-in rules, signals, metrics, health, and assessment assembly
- `diagnostics`: diagnostics, exceptions, reporting, snapshots, drift, and delivery-impact summaries
- `ai`: AI request/payload/context helpers built on top of Core assessment outputs
- `extensions`: portable extension, capability, diagnostic, and runtime contracts

### Core contracts

Core contracts include:

- workspace, node/relation input, classification input, ownership input, perspective, source/evidence, project, and dependency models
- findings, signals, measurements, recommendations, score dimensions, health scores, and top issues
- rule metadata, applicability, multi-perspective evaluation context, findings, conformance results, and drift results
- diagnostics, recommendations, and renderer-agnostic reporting primitives with optional evidence and perspective linkage
- Governance profiles and rule configuration
- Governance exceptions and exception reports
- signal contracts and signal breakdowns
- snapshot and drift contracts
- adapter input/result contracts for hosts and adapters, including additive node/relation result fields and legacy project/dependency inputs
- adapter contract, probe, capability, and normalization helpers such as `GovernanceWorkspaceAdapter`, `GovernanceWorkspaceAdapterProbeResult`, `GovernanceCapability`, and `buildGovernanceWorkspace(...)`
- AI analysis and handoff payload contracts

Perspective and evidence contracts are metadata-bearing primitives for future
traceability, conformance, and drift analysis. They are optional on node and
relation inputs and do not change current adapter, host, extension, rule, or
reporting behavior.

Runtime primitive contracts remain backward compatible while allowing generic
findings, signals, measurements, assessments, and score dimensions to reference
nodes, relations, perspectives, evidence, authority, confidence, and metadata.

Rule contracts also expose optional applicability and multi-perspective result
primitives. Existing rules can continue to return only violations, signals, and
measurements; future rules can opt into findings, recommendations, conformance,
and drift outputs without changing adapter, CLI, host, or extension behavior.

Reporting primitives are data contracts only. They can represent diagnostics,
recommendations, conformance reports, and drift reports across perspectives, but
Core does not render dashboards, CLI output, or UI views from them.

### Deterministic logic

Deterministic helpers include:

- `buildGovernanceAssessment(...)`
- `buildGovernanceAssessmentArtifacts(...)`
- `buildGovernanceWorkspace(...)`, `buildGovernanceInventory(...)`, and `buildGovernanceWorkspaceFromAdapterResult(...)`
- `buildGovernanceGraphSignals(...)`, `buildGovernanceConformanceSignals(...)`, `buildGovernancePolicySignals(...)`, and `mergeGovernanceSignals(...)`
- `calculateGovernanceMetrics(...)`
- `calculateGovernanceHealth(...)`
- `buildGovernanceRecommendations(...)`
- `applyGovernanceExceptions(...)`, `evaluateGovernanceExceptionLifecycle(...)`, and `buildGovernanceExceptionReport(...)`
- `buildDeliveryImpactAssessment(...)` and `summarizeDeliveryImpact(...)`
- `buildSnapshotDeliveryImpactSummary(...)`
- deterministic AI request builders and summarizers such as `buildRootCauseRequest(...)`, `buildPrImpactRequest(...)`, `buildScorecardRequest(...)`, `buildOnboardingRequest(...)`, `buildManagementInsightsAiRequest(...)`, `summarizeRootCause(...)`, `summarizePrImpact(...)`, `summarizeScorecard(...)`, `summarizeOnboarding(...)`, and `summarizeManagementInsights(...)`
- deterministic payload-scope helpers such as `buildGovernancePayloadTruncationMetadata(...)`, `sliceGovernancePayloadItems(...)`, `scopeGovernanceDependencies(...)`, and `compareGovernanceViolationsForPriority(...)`
- scoped AI handoff request helpers such as `buildScopedRootCauseRequest(...)`, `buildScopedDriftRequest(...)`, and `buildScopedScorecardRequest(...)`
- deterministic AI context builders such as `buildPrImpactContext(...)`, `buildCognitiveLoadContext(...)`, `buildRecommendationsTrendContext(...)`, `buildPersistentSmellSignals(...)`, `buildRefactoringSuggestionsContext(...)`, `buildOnboardingContext(...)`, and `buildDriftInterpretationAnalysis(...)`
- `resolveAffectedGovernanceProjects(...)`
- `projectToNode(...)`, `projectsToNodes(...)`, `dependencyToRelation(...)`, and `dependenciesToRelations(...)`
- `evaluateRules(...)` and `evaluateRulePack(...)`
- `normalizeGovernanceProfile(...)`
- `normalizeGovernanceException(...)`
- `buildMetricSnapshot(...)`
- `compareSnapshots(...)`, `summarizeDrift(...)`, and `buildDriftSummary(...)`
- `buildAiHandoffPayload(...)` and the specialized AI handoff helpers

### Built-in rule content

Built-in Governance rule content includes:

- `coreBuiltInRulePack`
- `coreBuiltInRulePacks`
- `coreBuiltInPolicyRules`
- `evaluateCoreBuiltInPolicyViolations(...)`
- `evaluateGovernancePolicies(...)`

### Extension APIs

Portable extension APIs include:

- extension contracts in `contracts`
- capability registry contracts in `capabilities`
- extension diagnostics in `diagnostics`
- runtime registration and execution helpers in `runtime`

Hosts compose Core, adapters, extensions, profiles, and execution. Adapters emit
Core-owned capabilities through adapter results; extensions declare and query
capability requirements through Core-owned contracts. Adapters should not import
technology-specific extension packages.

Notable extension exports include:

- `DefaultGovernanceCapabilityRegistry`
- `GovernanceExtensionHostContext`
- `GovernanceExtensionDefinition`
- `GovernanceWorkspaceEnricher`
- `GovernanceExtensionRulePack`
- `GovernanceSignalProvider`
- `GovernanceMetricProvider`
- `GovernanceExtensionDiagnostic`
- `registerLoadedGovernanceExtensions(...)`
- `applyGovernanceEnrichers(...)`
- `evaluateGovernanceRulePacks(...)`
- `collectGovernanceSignals(...)`
- `collectGovernanceMeasurements(...)`

## Usage

The package is designed to sit between concrete adapters and higher-level hosts:

```ts
import {
  buildGovernanceAssessmentArtifacts,
  normalizeGovernanceProfile,
  type GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

const adapterResult: GovernanceWorkspaceAdapterResult = {
  workspaceId: 'demo',
  workspaceName: 'demo',
  workspaceRoot: '.',
  projects: [],
  dependencies: [],
};

const profile = normalizeGovernanceProfile({
  name: 'default',
  boundaryPolicySource: 'profile',
  layers: ['app', 'domain', 'data'],
  allowedDomainDependencies: {},
  ownership: { required: false, metadataField: 'team' },
  health: {
    statusThresholds: {
      goodMinScore: 80,
      warningMinScore: 60,
    },
  },
  metrics: {},
});

const artifacts = await buildGovernanceAssessmentArtifacts({
  workspaceAdapterResult: adapterResult,
  profile,
  exceptions: [],
});

console.log(artifacts.assessment.health.status);
```

## Host Consumption Surface

Thin runtime hosts can consume the package in this order:

- normalize adapter output with `buildGovernanceWorkspace(...)` or `buildGovernanceAssessmentArtifacts(...)`
- evaluate built-in policies with `evaluateGovernancePolicies(...)`
- build canonical signals with `buildGovernanceGraphSignals(...)`, `buildGovernanceConformanceSignals(...)`, `buildGovernancePolicySignals(...)`, and `mergeGovernanceSignals(...)`
- calculate metrics and health with `calculateGovernanceMetrics(...)` and `calculateGovernanceHealth(...)`
- build recommendations with `buildGovernanceRecommendations(...)`
- apply exception lifecycle and suppression with `evaluateGovernanceExceptionLifecycle(...)`, `applyGovernanceExceptions(...)`, and `buildGovernanceExceptionReport(...)`
- build higher-level delivery and AI artifacts with `buildDeliveryImpactAssessment(...)`, `buildManagementInsightsAiRequest(...)`, `summarizeManagementInsights(...)`, and the other deterministic AI request/summarizer helpers

Hosts remain responsible for:

- collecting changed files from git or another host runtime
- resolving refs, workspace roots, and process execution
- discovering snapshot files and choosing baseline/current snapshot inputs
- persisting snapshots and other host-owned artifacts

Core also provides two small host-independent handoff helpers:

- `resolveAffectedGovernanceProjects(...)` maps host-supplied repo-relative changed file paths onto canonical `GovernanceProject` records. It normalizes Windows separators, trims trailing slashes from project roots, ignores empty changed-file entries, and treats `'.'` or `''` project roots as root-level projects that match any non-empty changed file.
- `buildSnapshotDeliveryImpactSummary(...)` shapes a `DeliveryImpactAssessment` into a `SnapshotDeliveryImpactSummary` by sorting indices by `id` and copying the first five delivery-impact drivers into the snapshot-safe summary contract.

## AI Host Helpers

Thin host packages can now keep AI handoff shaping in Core by composing:

- `scopeGovernanceDependencies(...)`
- `sliceGovernancePayloadItems(...)`
- `compareGovernanceViolationsForPriority(...)`
- `buildScopedRootCauseRequest(...)`
- `buildScopedDriftRequest(...)`
- `buildScopedScorecardRequest(...)`
- `buildDriftInterpretationAnalysis(...)`
- `buildPrImpactContext(...)`
- `buildCognitiveLoadContext(...)`
- `buildRecommendationsTrendContext(...)`
- `buildPersistentSmellSignals(...)`
- `buildRefactoringSuggestionsContext(...)`
- `buildOnboardingContext(...)`

These helpers are deterministic and host-independent. Hosts still own file IO,
git diffing, workspace-root path resolution, output rendering, and persistence.

## Package Boundaries

`@anarchitects/governance-core` is platform-independent.

That means:

- no Nx runtime assumptions
- no dependency on concrete adapters
- no dependency on CLI runtime concerns
- no dependency on executor, generator, or plugin infrastructure

Concrete adapters should emit canonical Core-owned contracts. Hosts and CLIs should orchestrate Core APIs without moving canonical model ownership out of this package.

For detailed package-boundary rules and allowed dependency direction, see
[ADR 0001: Governance Package Boundaries for Core, CLI, Adapters, and Extensions](../../../docs/adr/0001-governance-package-boundaries.md).

## Related Packages

- `@anarchitects/governance-adapter-typescript` discovers TypeScript workspaces and maps them into Core-owned contracts
- `@anarchitects/governance-cli` provides a standalone host/runtime surface over Core APIs
- `@anarchitects/governance-extension-*` packages should plug into Core-owned extension contracts
