# TypeScript Governance Metrics And Recommendations Migration

## Purpose

This document records the #239 review of current Governance metrics, signals,
measurements, scoring contributions, and recommendations before moving
TypeScript-specific implementation into
`@anarchitects/governance-extension-typescript`.

The intent of #239 is architectural relocation, not redesign. Implementation
should move only when it is tied to TypeScript semantics such as `tsconfig`,
imports, exports, path aliases, module structure, barrels, circular imports, or
other TypeScript-specific facts.

## Current Metric Inventory

Current Core metric calculation lives in
`packages/governance/core/src/core/evaluation/metrics.ts`. The CLI also has a
host-side metric helper in
`packages/governance/cli/src/internal/metric-engine/calculate-metrics.ts`.

| Metric id                    | Classification | Current owner   | Reason                                                                                                                                          |
| ---------------------------- | -------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `architectural-entropy`      | Generic        | Governance Core | Aggregates generic graph, conformance, and policy signals. It does not inspect TypeScript source, imports, `tsconfig`, or path aliases.         |
| `dependency-complexity`      | Generic        | Governance Core | Counts project-to-project dependencies in the current compatibility workspace model. It is project/dependency-oriented but not TypeScript-only. |
| `domain-integrity`           | Generic        | Governance Core | Uses generic domain-boundary signal weights. It is based on declared domain metadata rather than TypeScript module semantics.                   |
| `ownership-coverage`         | Generic        | Governance Core | Counts projects with generic ownership metadata. It is not tied to TypeScript extraction.                                                       |
| `documentation-completeness` | Generic        | Governance Core | Counts projects with generic documentation metadata. It is not tied to TypeScript extraction.                                                   |
| `layer-integrity`            | Generic        | Governance Core | Uses generic layer-boundary signal weights. It is based on declared layer metadata rather than TypeScript module semantics.                     |

## Current Signal Inventory

Core signal building lives in
`packages/governance/core/src/core/evaluation/signal-builders.ts` and signal
contracts live in `packages/governance/core/src/core/evaluation/signals.ts`.
The CLI also has host-side signal helpers under
`packages/governance/cli/src/internal/signal-engine/`.

| Signal type                 | Classification   | Current owner   | Reason                                                                                                                                |
| --------------------------- | ---------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `structural-dependency`     | Generic          | Governance Core | Represents a generic project-to-project relation from the workspace graph. It is not derived from TypeScript-only facts in Core.      |
| `cross-domain-dependency`   | Generic          | Governance Core | Represents generic domain metadata crossing on dependencies. It is not TypeScript-specific.                                           |
| `missing-domain-context`    | Generic          | Governance Core | Represents missing generic domain metadata. It is not TypeScript-specific.                                                            |
| `conformance-violation`     | Generic          | Governance Core | Maps generic conformance findings into signals.                                                                                       |
| `domain-boundary-violation` | Generic          | Governance Core | Maps the generic `domain-boundary` rule result into a signal.                                                                         |
| `layer-boundary-violation`  | Generic          | Governance Core | Maps the generic `layer-boundary` rule result into a signal.                                                                          |
| `ownership-gap`             | Generic          | Governance Core | Maps the generic `ownership-presence` rule result into a signal.                                                                      |
| Extension-provided signals  | Generic contract | Governance Core | Core owns the extension signal provider contract and source attribution. Concrete TypeScript signal providers do not currently exist. |

## Current Recommendation Inventory

Current Core recommendation generation lives in
`packages/governance/core/src/core/evaluation/health.ts`. CLI recommendation
output lives in `packages/governance/cli/src/recommendations.ts`.

| Recommendation id                    | Classification | Current owner   | Reason                                                                                                                          |
| ------------------------------------ | -------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `reduce-cross-domain-dependencies`   | Generic        | Governance Core | Triggered by generic `domain-boundary` violations. It is not tied to TypeScript imports or module resolution.                   |
| `improve-ownership-coverage`         | Generic        | Governance Core | Triggered by generic `ownership-presence` violations. It is not TypeScript-specific.                                            |
| `reduce-dependency-complexity`       | Generic        | Governance Core | Triggered by the generic dependency complexity metric. It is project/dependency-oriented but not TypeScript-only.               |
| CLI recommendation filtering/summary | Host behavior  | Governance CLI  | Sorts, filters, and summarizes recommendations already produced by assessment. It does not interpret TypeScript-specific facts. |

## Current Scoring And Assessment Inventory

Health scoring and assessment composition live in
`packages/governance/core/src/core/evaluation/health.ts` and
`packages/governance/core/src/core/evaluation/assessment.ts`.

| Area                           | Classification | Current owner   | Reason                                                                                                               |
| ------------------------------ | -------------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Weighted health score          | Generic        | Governance Core | Calculates a weighted average from `Measurement[]` and profile thresholds. It is independent of TypeScript.          |
| Grade and health status        | Generic        | Governance Core | Maps numeric scores to generic health categories. It is independent of TypeScript.                                   |
| Metric hotspots                | Generic        | Governance Core | Selects weakest measurements by score. It is independent of TypeScript.                                              |
| Project hotspots               | Generic        | Governance Core | Uses current top issue project references. It is project-oriented, but not TypeScript-specific.                      |
| Signal and metric breakdowns   | Generic        | Governance Core | Groups provided signals and measurements by source, type, severity, and family. It is independent of TypeScript.     |
| Assessment report-type filters | Generic        | Governance Core | Filters by generic report dimensions such as boundaries, ownership, and architecture. It is not TypeScript-specific. |

## TypeScript-Specific Items Found

No existing Governance Core or CLI metric, signal, scoring, or recommendation
implementation is currently TypeScript-specific.

The review found no current implementation for:

- `tsconfig` quality metrics.
- import/export topology metrics.
- path alias metrics.
- barrel usage metrics or recommendations.
- circular TypeScript import metrics or recommendations.
- TypeScript module structure signals.
- TypeScript-specific recommendation generation.
- TypeScript-specific scoring contributions.

## Migration Outcome

No metric, signal, scoring, or recommendation implementation was moved in #239
because there is no current TypeScript-specific implementation to relocate.

The generic Core implementations remain in Core. This preserves existing
behavior and avoids moving generic governance semantics into a
technology-specific extension.

`@anarchitects/governance-extension-typescript` remains the target package for
future TypeScript-specific metrics, signals, measurements, scoring
contributions, and recommendations. When such contributions are introduced or
migrated, they should be registered through the Core extension contracts and
must not depend on `@anarchitects/governance-adapter-typescript`,
`@anarchitects/governance-cli`, or reporting internals.

## Behavior Preservation

Because no existing implementation moved:

- Existing metric identifiers remain unchanged.
- Existing signal identifiers and signal types remain unchanged.
- Existing recommendation identifiers remain unchanged.
- Existing health scoring behavior remains unchanged.
- Existing CLI metrics, signals, and recommendations commands remain unchanged.
- The TypeScript extension does not duplicate generic Core signals or metrics.
- No adapter, CLI, reporting, or Core contract changes are required.

## Remaining Responsibilities

Governance Core retains:

- metric, signal, measurement, recommendation, assessment, and scoring
  contracts
- generic signal building
- generic metric calculation
- generic recommendation generation
- deterministic health scoring and assessment composition
- extension provider collection and attribution primitives

`@anarchitects/governance-extension-typescript` owns future:

- TypeScript-specific metric providers
- TypeScript-specific signal providers
- TypeScript-specific recommendation providers when supported by host/Core
  orchestration
- TypeScript-specific interpretation of canonical nodes, relations,
  capabilities, and diagnostics

Governance CLI remains responsible for current host-side command output,
filtering, and summaries until scoped follow-up issues change that boundary.

## Follow-Up

#240 and #241 remain follow-up work for host and reporting migration.

Future TypeScript-specific metrics, signals, scoring contributions, or
recommendations should be added to
`@anarchitects/governance-extension-typescript` rather than to Governance Core
or `@anarchitects/governance-adapter-typescript`.
