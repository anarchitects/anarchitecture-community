# @anarchitects/governance-extension-dbt

## Purpose

`@anarchitects/governance-extension-dbt` is the dbt Governance extension
package for dbt-specific governance interpretation over normalized adapter
output.

The extension interprets normalized dbt governance data.
The extension does not load dbt artifacts.
The extension does not run dbt commands.
The extension does not normalize dbt resources.
The extension does not compose runtime packages.
The extension does not implement Python host behavior.
Diagnostics, signals, rule packs, metrics, and recommendations are
deterministic and traceable.
The extension consumes normalized adapter output, preferably through Core
contracts.
The runtime loads/composes the extension.
The host never calls extension internals directly.

Parent epic: `#144`  
Related epics: `#143 governance-adapter-dbt`, `#251 governance-runtime-dbt`,
`#252 governance-host-dbt`

## Location

- Package root: `packages/governance/extension-dbt`
- Nx project name: `governance-extension-dbt`
- npm package name: `@anarchitects/governance-extension-dbt`
- Fixtures: `packages/governance/extension-dbt/fixtures/normalized`

## Local Commands

Expected Nx commands:

- `nx build governance-extension-dbt`
- `nx test governance-extension-dbt`
- `nx lint governance-extension-dbt`

In this workspace:

```bash
yarn nx build governance-extension-dbt
yarn nx test governance-extension-dbt
yarn nx lint governance-extension-dbt
```

The current end-to-end extension flow tests run through the normal `test`
target, not a separate `e2e` target.

## Boundary

```text
Adapter = discovery, loading, validation, normalization, metadata preservation.
Extension = dbt-specific governance meaning.
Runtime = TypeScript composition boundary.
Host = dbt-native Python developer experience.
```

This package owns only the `Extension` line. It depends only on
`@anarchitects/governance-core`.

## Non-Goals

- Loading raw dbt artifacts
- Parsing `manifest.json`, `catalog.json`, or `run_results.json`
- Normalizing dbt resources
- Adapter logic
- Runtime composition
- Python host behavior
- Running dbt commands
- Node/npm runtime setup
- Depending on `@anarchitects/governance-adapter-dbt`
- Depending on `@anarchitects/governance-runtime-dbt`
- Depending on `@anarchitects/governance-host-dbt`

## Public API

Primary registration exports:

- `dbtGovernanceExtension`
- `governanceDbtExtension`
- `createDbtGovernanceExtension(...)`
- `registerDbtGovernanceExtension(...)`
- `registerDbtGovernanceExtensionContributions(...)`

Built-in providers and helpers:

- Diagnostics: `dbtGovernanceDiagnosticsProvider`,
  `createDbtGovernanceDiagnosticsProvider(...)`,
  `buildDbtGovernanceDiagnostics(...)`
- Signals: `dbtGovernanceSignalProvider`,
  `createDbtGovernanceSignalProvider(...)`,
  `buildDbtGovernanceSignals(...)`
- Rule pack: `dbtArchitectureBasicRulePack`,
  `createDbtArchitectureBasicRulePack(...)`,
  `evaluateDbtArchitectureViolations(...)`
- Metrics: `dbtGovernanceMetricProvider`,
  `createDbtGovernanceMetricProvider(...)`,
  `buildDbtGovernanceMetrics(...)`
- Recommendations: `dbtGovernanceRecommendationProvider`,
  `createDbtGovernanceRecommendationProvider(...)`,
  `buildDbtGovernanceRecommendations(...)`
- Resolvers: `resolveDbtGovernanceMetadata(...)`,
  `resolveDbtLayer(...)`, `resolveDbtDomain(...)`, `resolveDbtOwner(...)`,
  `resolveDbtCriticality(...)`, `resolveDbtPublicInterface(...)`,
  `resolveDbtMaterializationCategory(...)`,
  `resolveDbtDocumentationPresence(...)`,
  `resolveDbtTestPresence(...)`, `resolveDbtContractPresence(...)`

## Registration Example

Runtime packages should load the extension through the public package API and
register it through existing Core contracts:

```ts
import {
  DefaultGovernanceCapabilityRegistry,
  collectGovernanceMeasurements,
  collectGovernanceSignals,
  evaluateGovernanceRulePacks,
  registerLoadedGovernanceExtensionsWithDiagnostics,
  type GovernanceExtensionHostContext,
  type GovernanceProfile,
} from '@anarchitects/governance-core';
import {
  collectDbtGovernanceDiagnostics,
  collectDbtGovernanceRecommendations,
  dbtGovernanceExtension,
  getDbtGovernanceDiagnosticProviders,
  getDbtGovernanceRecommendationProviders,
  resolveDbtGovernanceMetadata,
} from '@anarchitects/governance-extension-dbt';

const context: GovernanceExtensionHostContext = {
  workspaceRoot,
  profileName: 'dbt',
  options: {},
  inventory: workspace,
  capabilities: new DefaultGovernanceCapabilityRegistry(),
};

const registration = await registerLoadedGovernanceExtensionsWithDiagnostics(
  context,
  [
    {
      sourceSpecifier: '@anarchitects/governance-extension-dbt',
      moduleSpecifier: '@anarchitects/governance-extension-dbt',
      definition: dbtGovernanceExtension,
    },
  ],
);

const diagnosticProviders = getDbtGovernanceDiagnosticProviders({
  context,
  registerRulePack: () => undefined,
  registerSignalProvider: () => undefined,
  registerMetricProvider: () => undefined,
  registerEnricher: () => undefined,
});

const metadataResolutions = workspace.projects
  .filter((project) => typeof project.metadata?.dbt === 'object')
  .map((project) =>
    resolveDbtGovernanceMetadata({
      id: project.id,
      name: project.name,
      root: project.root,
      tags: project.tags,
      domain: project.domain,
      layer: project.layer,
      ownership: project.ownership,
      metadata: project.metadata,
    }),
  );

const diagnostics = await collectDbtGovernanceDiagnostics(diagnosticProviders, {
  workspace,
  profile,
  context,
  diagnostics: [],
  signals: [],
  measurements: [],
  violations: [],
  metadataResolutions,
});

const signals = await collectGovernanceSignals(registration.registry, {
  workspace,
  profile,
  context,
  diagnostics,
  signals: [],
  violations: [],
  metadataResolutions,
});

const violations = await evaluateGovernanceRulePacks(registration.registry, {
  workspace,
  profile,
  context,
  diagnostics,
  signals,
  metadataResolutions,
});

const measurements = await collectGovernanceMeasurements(
  registration.registry,
  {
    workspace,
    profile,
    context,
    diagnostics,
    signals,
    violations,
    measurements: [],
    metadataResolutions,
  },
);

const recommendationProviders = getDbtGovernanceRecommendationProviders({
  context,
  registerRulePack: () => undefined,
  registerSignalProvider: () => undefined,
  registerMetricProvider: () => undefined,
  registerEnricher: () => undefined,
});

const recommendations = await collectDbtGovernanceRecommendations(
  recommendationProviders,
  {
    workspace,
    profile,
    context,
    diagnostics,
    signals,
    violations,
    measurements,
    recommendations: [],
    metadataResolutions,
  },
);
```

The runtime composes this flow. The host should invoke the runtime, not this
package’s internals.

## Expected Normalized Input

This package consumes Core-compatible normalized workspace input through
`GovernanceExtensionExecutionInput`-derived contracts:

- `workspace.id`
- `workspace.name`
- `workspace.root`
- `workspace.projects`
- `workspace.dependencies`
- `profile`
- `context`

The current normalized fixture shape preserves dbt metadata under
`project.metadata.dbt`:

- `metadata.dbt.identity`
- `metadata.dbt.resource`
- `metadata.dbt.relation`
- `metadata.dbt.validation`
- `metadata.dbt.documentation`

The extension expects dbt metadata to already be preserved by the adapter. It
does not read raw dbt artifacts directly.

Current resolver/provider logic works from the legacy-compatible Core
`GovernanceWorkspace.projects` and `GovernanceWorkspace.dependencies` view.
That is a Core compatibility surface, not an adapter responsibility owned here.

## Metadata Resolver Behavior

Resolver output statuses:

- `resolved`
- `unresolved`
- `invalid`
- `ambiguous`

Resolver entrypoint:

- `resolveDbtGovernanceMetadata(...)`

Resolved concepts:

- layer
- domain
- owner
- criticality
- public/governed interface marker
- materialization category
- documentation presence
- test presence
- contract presence

Current conventions:

- Layer from `project.layer`
- Layer from `metadata.dbt.resource.meta.layer`
- Layer from tags with prefix `layer:`
- Layer from path segments like `staging`, `intermediate`, `marts`
- Domain from `project.domain`
- Domain from `metadata.dbt.resource.meta.domain`
- Domain from path when explicitly enabled
- Owner from `project.ownership.team`
- Owner from `metadata.dbt.resource.owner`
- Owner from `metadata.dbt.resource.group`
- Owner from `metadata.dbt.resource.meta.owner`
- Criticality from `metadata.dbt.resource.meta.criticality`
- Public/governed marker from `metadata.dbt.resource.meta.public`
- Public/governed marker from `metadata.dbt.resource.meta.governed`
- Public/governed marker from tags like `public`, `published`, `governed`
- Materialization from `metadata.dbt.resource.materialization`
- Documentation presence from `metadata.dbt.documentation`
- Test presence from `metadata.dbt.validation.tests`
- Contract presence from `metadata.dbt.validation.contract`

Resolvers are descriptive only. They do not emit rule violations, load
artifacts, invoke dbt, or compose runtime behavior.

## Diagnostics

Extension diagnostics describe interpretation quality over normalized input.
They are not rule violations.

Diagnostic ownership:

- insufficient governance metadata
- unsupported governance pattern
- ambiguous domain/layer inference
- invalid governance profile interpretation
- skipped or partial governance analysis

Not extension diagnostics:

- missing/malformed artifacts: adapter
- unresolved artifact-derived dependencies: adapter
- setup, Node/npm, Python, dbt invocation problems: host
- runtime package compatibility: runtime/host
- governance rule violations: extension/core rule results

Current codes:

- `DBT_LAYER_UNRESOLVED`
- `DBT_DOMAIN_UNRESOLVED`
- `DBT_OWNER_MISSING`
- `DBT_OWNER_INVALID`
- `DBT_CRITICALITY_INVALID`
- `DBT_PUBLIC_MARKER_INVALID`
- `DBT_RULE_SKIPPED_MISSING_METADATA`
- `DBT_GOVERNANCE_PROFILE_INVALID`

Common diagnostic fields:

- `code`
- `severity`
- `message`
- `recommendation`
- `details.governanceNodeId`
- `details.dbtUniqueId`
- `details.field`
- `details.resolution`
- `details.metadataPaths`
- `details.invalidMetadataPaths`
- `details.rawValues`

Examples:

- unresolved layer/domain
- missing or invalid owner
- invalid criticality
- skipped rule evaluation when required metadata could not be resolved

## Signals

Signals are interpreted architectural facts, not pass/fail results.

Current codes:

- `DBT_LAYER_RESOLVED`
- `DBT_LAYER_DEPENDENCY_DETECTED`
- `DBT_LAYER_DIRECTION_CANDIDATE`
- `DBT_LAYER_BYPASS_CANDIDATE`
- `DBT_DOMAIN_RESOLVED`
- `DBT_CROSS_DOMAIN_DEPENDENCY_DETECTED`
- `DBT_SHARED_MODEL_DEPENDENCY_CANDIDATE`
- `DBT_OWNER_RESOLVED`
- `DBT_OWNER_MISSING`
- `DBT_OWNER_INCONSISTENT_CANDIDATE`
- `DBT_DESCRIPTION_PRESENT`
- `DBT_DESCRIPTION_MISSING`
- `DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE`
- `DBT_TESTS_PRESENT`
- `DBT_TESTS_MISSING`
- `DBT_CRITICAL_MODEL_WITHOUT_TESTS_CANDIDATE`
- `DBT_CONTRACT_ENABLED`
- `DBT_CONTRACT_MISSING_FOR_PUBLIC_MODEL_CANDIDATE`
- `DBT_HIGH_FAN_IN`
- `DBT_HIGH_FAN_OUT`
- `DBT_ARCHITECTURAL_HOTSPOT_CANDIDATE`

Examples:

- cross-domain dependency
- layer dependency or layer bypass candidate
- missing or resolved owner
- missing or present docs, tests, and contracts
- high fan-in
- high fan-out

Default thresholds:

- high fan-in: `3`
- high fan-out: `3`
- hotspot combined threshold: `5`
- criticality values requiring tests: `high`, `critical`

## Rule Pack

Built-in rule pack:

- id: `dbt-architecture-basic`
- export: `dbtArchitectureBasicRulePack`
- factory: `createDbtArchitectureBasicRulePack(...)`

Rule IDs and purpose:

- `dbt/no-disallowed-layer-dependency`
  Checks whether a model depends on a layer that is not allowed upstream for
  its resolved layer.
- `dbt/no-mart-to-mart-dependency`
  Flags dependencies between mart layers configured as terminal presentation
  layers.
- `dbt/critical-models-require-owner`
  Requires ownership for models interpreted as critical.
- `dbt/public-models-require-description`
  Requires documentation for public/governed models.
- `dbt/critical-models-require-tests`
  Requires tests for models interpreted as critical.
- `dbt/public-models-require-contract`
  Requires enforced contracts for public/governed models.
- `dbt/cross-domain-dependencies-require-approval`
  Requires explicit approval metadata for cross-domain dependencies.

Behavior:

- Pass: no violation emitted.
- Warn/fail/info: controlled by `profile.rules[ruleId].severity`.
- Disabled: `profile.rules[ruleId].enabled === false`.
- Skipped: missing metadata yields no violation and is explained through
  diagnostics such as `DBT_RULE_SKIPPED_MISSING_METADATA`.

## Raw Metrics

Built-in metric provider:

- export: `dbtGovernanceMetricProvider`
- factory: `createDbtGovernanceMetricProvider(...)`
- builder: `buildDbtGovernanceMetrics(...)`

Metric IDs:

- `dbt-model-count`
- `dbt-dependency-count`
- `dbt-cross-domain-dependency-count`
- `dbt-layer-violation-count`
- `dbt-ownership-completeness-ratio`
- `dbt-documentation-coverage-ratio`
- `dbt-test-coverage-ratio`
- `dbt-contract-adoption-ratio`
- `dbt-hotspot-count`
- `dbt-unresolved-layer-count`
- `dbt-unresolved-domain-count`

Behavior:

- Count metrics emit `unit: 'count'`.
- Ratio metrics emit `unit: 'ratio'` with `value === score` and `maxScore: 1`.
- Zero denominators return `0` and set `metadata.zeroDenominator: true`.
- Metrics stay traceable through counted resource ids, dependency keys, signal
  ids, diagnostic ids/codes, or violation ids where available.

Inputs used:

- normalized workspace projects and dependencies
- metadata resolver output
- diagnostics
- signals
- rule violations

## Recommendations

Built-in recommendation provider:

- export: `dbtGovernanceRecommendationProvider`
- factory: `createDbtGovernanceRecommendationProvider(...)`
- builder: `buildDbtGovernanceRecommendations(...)`

Recommendation codes:

- `ADD_OWNER`
- `ADD_DESCRIPTION`
- `ADD_TESTS`
- `ENABLE_CONTRACT`
- `REVIEW_CROSS_DOMAIN_DEPENDENCY`
- `REDUCE_HIGH_FAN_IN`
- `FIX_LAYER_DEPENDENCY`

Triggers:

- `ADD_OWNER` from owner-missing diagnostics/signals and critical-owner
  violations
- `ADD_DESCRIPTION` from missing-description signals and public-description
  violations
- `ADD_TESTS` from missing-tests signals and critical-test violations
- `ENABLE_CONTRACT` from missing-contract signals and public-contract
  violations
- `REVIEW_CROSS_DOMAIN_DEPENDENCY` from cross-domain signals and approval rule
  violations
- `REDUCE_HIGH_FAN_IN` from high fan-in or hotspot signals, with hotspot
  metric linkage when present
- `FIX_LAYER_DEPENDENCY` from layer-bypass signals and disallowed-layer
  violations

Output shape stays template-based and traceable through `metadata` fields such
as:

- `code`
- `governanceNodeId`
- `dbtUniqueId`
- `dependencyKey`
- `triggerDiagnosticCodes`
- `triggerDiagnosticIds`
- `triggerSignalCodes`
- `triggerSignalIds`
- `triggerViolationIds`
- `triggerMeasurementIds`

## Profile and Configuration

This package follows Core `GovernanceProfile` conventions. The current dbt
extension configuration surface is real but still narrow:

- `profile.layers`
- `profile.allowedDomainDependencies`
- `profile.ownership`
- `profile.health.statusThresholds`
- `profile.metrics`
- `profile.rules[ruleId]`
- `profile.rules[ruleId].enabled`
- `profile.rules[ruleId].severity`
- `profile.rules[ruleId].options`

Minimal example using actual implemented options:

```ts
import type { GovernanceProfile } from '@anarchitects/governance-core';

const profile: GovernanceProfile = {
  name: 'dbt',
  boundaryPolicySource: 'profile',
  layers: ['staging', 'intermediate', 'marts'],
  allowedDomainDependencies: {
    customer: ['customer'],
    finance: ['finance'],
    sales: ['sales'],
  },
  ownership: {
    required: true,
    metadataField: 'ownership.team',
  },
  health: {
    statusThresholds: {
      goodMinScore: 85,
      warningMinScore: 70,
    },
  },
  metrics: {},
  rules: {
    'dbt/no-disallowed-layer-dependency': {
      severity: 'error',
      options: {
        allowedUpstreamByLayer: {
          staging: ['staging'],
          intermediate: ['staging', 'intermediate'],
          marts: ['intermediate', 'marts'],
        },
      },
    },
    'dbt/public-models-require-description': {
      severity: 'error',
    },
    'dbt/critical-models-require-tests': {
      severity: 'warning',
      options: {
        criticalityLevels: ['high', 'critical'],
        requireExplicitCriticality: false,
      },
    },
    'dbt/no-mart-to-mart-dependency': {
      options: {
        martLayers: ['marts'],
      },
    },
    'dbt/cross-domain-dependencies-require-approval': {
      options: {
        approvalMetadataPaths: [
          'dbt.governance.crossDomainApproved',
          'dbt.lineage.crossDomainApproved',
          'dbt.lineage.approved',
        ],
      },
    },
  },
};
```

There is no separate final dbt-specific profile file format in this package
yet. Any broader runtime-side config convention remains a runtime concern.

## Fixtures and Tests

Normalized fixtures live under:

- `packages/governance/extension-dbt/fixtures/normalized`

Fixture docs:

- `packages/governance/extension-dbt/fixtures/README.md`

Test coverage:

- `src/fixture-smoke.spec.ts`
  Loads every normalized fixture and confirms the current extension helpers can
  consume them.
- `src/extension.e2e.spec.ts`
  Runs the full registration-driven extension flow over normalized fixtures.

Covered scenarios include:

- healthy layered project
- layer violation
- cross-domain dependency
- missing owner
- invalid criticality
- missing documentation
- missing tests
- missing contracts
- public/governed model checks
- critical model checks
- high fan-in and high fan-out hotspots
- skipped rule due to missing metadata

These are normalized extension fixtures, not raw dbt artifact fixtures.

## Runtime Integration Expectations

Expected handoff:

```text
governance-adapter-dbt
  -> normalized Governance workspace data with preserved metadata.dbt
  -> governance-runtime-dbt loads @anarchitects/governance-extension-dbt
  -> governance-core registers extension contributions
  -> runtime executes diagnostics, signals, rule packs, metrics, recommendations
  -> governance-host-dbt presents developer experience
```

Responsibilities by package family:

- Adapter discovers, loads, validates, normalizes, and preserves metadata.
- Extension interprets normalized dbt governance meaning.
- Runtime composes extension execution through Core contracts.
- Host owns dbt-native Python workflows and user-facing developer experience.

The runtime should load this package through its public exports. The host
should call the runtime, not this package’s provider helpers directly.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
