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
  buildGovernanceAssessment,
  buildGovernanceWorkspace,
  buildMetricSnapshot,
  compareSnapshots,
  coreBuiltInRulePack,
  evaluateRulePack,
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
- adapter contract and normalization helpers such as `GovernanceWorkspaceAdapter` and `buildGovernanceWorkspace(...)`
- AI analysis and handoff payload contracts

### Deterministic logic

Deterministic helpers include:

- `buildGovernanceAssessment(...)`
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
  buildGovernanceAssessment,
  coreBuiltInRulePack,
  evaluateRulePack,
  normalizeGovernanceProfile,
  type GovernanceWorkspace,
} from '@anarchitects/governance-core';

const workspace: GovernanceWorkspace = {
  id: 'demo',
  name: 'demo',
  root: '.',
  projects: [],
  dependencies: [],
};

const profile = normalizeGovernanceProfile({
  name: 'default',
  boundaryPolicySource: 'governance',
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

const ruleResult = await evaluateRulePack(coreBuiltInRulePack, {
  workspace,
  profile,
});

const assessment = buildGovernanceAssessment({
  workspace,
  profile: profile.name,
  violations: ruleResult.violations,
  measurements: [],
  signals: [],
  warnings: [],
  exceptions: {
    summary: {
      declaredCount: 0,
      matchedCount: 0,
      suppressedPolicyViolationCount: 0,
      suppressedConformanceFindingCount: 0,
      unusedExceptionCount: 0,
      activeExceptionCount: 0,
      staleExceptionCount: 0,
      expiredExceptionCount: 0,
      reactivatedPolicyViolationCount: 0,
      reactivatedConformanceFindingCount: 0,
    },
    used: [],
    unused: [],
    suppressedFindings: [],
    reactivatedFindings: [],
  },
  health: {
    score: 100,
    status: 'good',
    grade: 'A',
    reasons: [],
    hotspots: {
      metrics: [],
      projects: [],
    },
    explainability: {
      topIssues: [],
      metrics: [],
      projects: [],
    },
  },
  recommendations: [],
});
```

## Package Boundaries

`@anarchitects/governance-core` is platform-independent.

That means:

- no Nx runtime assumptions
- no dependency on concrete adapters
- no dependency on CLI runtime concerns
- no dependency on executor, generator, or plugin infrastructure

Concrete adapters should emit canonical Core-owned contracts. Hosts and CLIs should orchestrate Core APIs without moving canonical model ownership out of this package.

## Related Packages

- `@anarchitects/governance-adapter-typescript` discovers TypeScript workspaces and maps them into Core-owned contracts
- `@anarchitects/governance-cli` provides a standalone host/runtime surface over Core APIs
- `@anarchitects/governance-extension-*` packages should plug into Core-owned extension contracts
