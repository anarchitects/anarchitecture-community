# `@anarchitects/governance-core`

Canonical Governance contracts, deterministic evaluation logic, and portable extension APIs.

## Overview

`@anarchitects/governance-core` is the package that defines the Governance model layer for the Community-owned Governance package family. It owns the public contracts that adapters, hosts, and extensions normalize into, plus the deterministic logic that evaluates those contracts.

Use this package when you need:

- canonical workspace, project, dependency, ownership, violation, measurement, health, assessment, snapshot, drift, signal, and AI-analysis contracts
- deterministic rule evaluation and assessment assembly
- built-in Governance rule packs
- portable adapter input contracts
- portable extension contracts, capability contracts, diagnostics, and runtime registration helpers

## Responsibilities

This package is responsible for:

- defining the canonical `GovernanceWorkspace` model and related result shapes
- defining adapter-facing input contracts such as `GovernanceProjectInput`, `GovernanceDependencyInput`, and `GovernanceWorkspaceAdapterResult`
- defining profile, rule, signal, exception, measurement, health, assessment, snapshot, and drift contracts
- providing deterministic helpers such as profile normalization, rule evaluation, assessment assembly, snapshot comparison, and AI handoff payload builders
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
  buildGovernanceAssessment,
  buildGovernanceAssessmentArtifacts,
  buildGovernanceConformanceSignals,
  buildGovernanceGraphSignals,
  buildGovernancePolicySignals,
  buildGovernanceRecommendations,
  buildGovernanceWorkspace,
  buildMetricSnapshot,
  calculateGovernanceHealth,
  calculateGovernanceMetrics,
  compareSnapshots,
  coreBuiltInRulePack,
  evaluateGovernancePolicies,
  evaluateRulePack,
  buildManagementInsightsAiRequest,
  normalizeGovernanceException,
  normalizeGovernanceProfile,
  registerLoadedGovernanceExtensions,
  type GovernanceWorkspaceAdapter,
  type GovernanceWorkspace,
  type GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';
```

The root export currently re-exports these API groups:

- `adapter`
- `assessment`
- `ai`
- `built-in-rule-pack`
- `built-in-rules`
- `drift`
- `models`
- `exceptions`
- `profile`
- `rule-engine`
- `rules`
- `signals`
- `snapshots`
- `extensions`

### Core contracts

Core contracts include:

- workspace, project, dependency, and ownership models
- violations, measurements, recommendations, health scores, and top issues
- Governance profiles and rule configuration
- Governance exceptions and exception reports
- signal contracts and signal breakdowns
- snapshot and drift contracts
- adapter input/result contracts for hosts and adapters
- adapter contract, probe, and normalization helpers such as `GovernanceWorkspaceAdapter`, `GovernanceWorkspaceAdapterProbeResult`, and `buildGovernanceWorkspace(...)`
- AI analysis and handoff payload contracts

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
- deterministic AI request builders and summarizers such as `buildRootCauseRequest(...)`, `buildPrImpactRequest(...)`, `buildScorecardRequest(...)`, `buildOnboardingRequest(...)`, `buildManagementInsightsAiRequest(...)`, `summarizeRootCause(...)`, `summarizePrImpact(...)`, `summarizeScorecard(...)`, `summarizeOnboarding(...)`, and `summarizeManagementInsights(...)`
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
