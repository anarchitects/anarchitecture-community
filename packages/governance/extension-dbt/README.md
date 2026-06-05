# @anarchitects/governance-extension-dbt

## Purpose

`@anarchitects/governance-extension-dbt` provides the dbt Governance extension
package boundary for dbt-specific governance interpretation over normalized
adapter output.

This package interprets normalized dbt governance data.
This package does not load raw dbt artifacts.
This package does not normalize dbt resources.
This package does not run dbt commands.
This package does not compose runtime packages.
This package does not implement Python host behavior.

Parent epic: `#144`

## Location

- Package root: `packages/governance/extension-dbt`
- Nx project name: `governance-extension-dbt`
- npm package name: `@anarchitects/governance-extension-dbt`
- normalized fixtures: `packages/governance/extension-dbt/fixtures/normalized`

## Local Commands

Expected Nx commands:

- `nx build governance-extension-dbt`
- `nx test governance-extension-dbt`
- `nx lint governance-extension-dbt`

In this workspace, run them via the package manager:

```bash
yarn nx build governance-extension-dbt
yarn nx test governance-extension-dbt
yarn nx lint governance-extension-dbt
```

Curated normalized dbt workspace fixtures live under
`packages/governance/extension-dbt/fixtures/normalized`. They are deterministic
`GovernanceWorkspace` JSON fixtures with preserved `metadata.dbt` and do not
require dbt, adapter execution, runtime composition, or host behavior.

## Boundary

```text
Adapter = discovery, loading, validation, normalization, metadata preservation.
Extension = dbt-specific governance meaning.
Runtime = TypeScript composition boundary.
Host = dbt-native Python developer experience.
```

This package owns only the `Extension` line. It interprets normalized adapter
output and does not depend on adapter, runtime, or host package
implementations.

## Registration

This package exports a Core-compatible extension registration surface:

```ts
import {
  createDbtGovernanceExtension,
  dbtGovernanceExtension,
  governanceDbtExtension,
  registerDbtGovernanceExtension,
  registerDbtGovernanceExtensionContributions,
} from '@anarchitects/governance-extension-dbt';
```

Runtime packages should load the extension through the public package API and
pass it to `@anarchitects/governance-core` extension registration.

Rule packs, signal providers, and metric providers register through existing
Core extension host contracts. Diagnostic providers and recommendation
providers are exposed through Core capability registration so a future
`governance-runtime-dbt` can discover and execute them without requiring this
package to depend on the runtime package.

The default extension registration includes a built-in dbt diagnostics
provider, a built-in dbt signal provider, a built-in dbt metric provider, a
built-in dbt recommendation provider, and a built-in dbt architecture rule
pack. Runtime packages should execute registered dbt diagnostic providers,
signal providers, metric providers, recommendation providers, and rule packs
against normalized workspace data, dbt metadata resolver outputs, and the
active governance profile.

## Input Expectations

All dbt extension contracts consume normalized Governance workspace data from
adapter output. They do not receive raw dbt artifacts, manifest files, catalog
files, project YAML, or command execution state.

The extension consumes normalized adapter output, not raw artifacts.

## Architectural Boundary

Dependency direction:

```text
@anarchitects/governance-extension-dbt
  -> @anarchitects/governance-core
```

The extension only owns dbt-specific governance interpretation over normalized
adapter output.

## Runtime Usage

The intended flow is:

```text
governance-adapter-dbt
  -> normalized Governance workspace data
  -> governance-runtime-dbt loads @anarchitects/governance-extension-dbt
  -> governance-core registers extension contributions
  -> dbt-specific diagnostics, signals, rule packs, metrics, and recommendations
```

This package defines registration and contracts only. It does not compose the
runtime package, does not load adapter packages, and does not implement Python
host behavior.

## Diagnostics

This package owns dbt extension diagnostics for governance interpretation
quality over normalized adapter output. These diagnostics remain factual and
traceable. They describe incomplete or invalid governance metadata, not
architectural rule violations.

Current MVP diagnostic codes:

- `DBT_LAYER_UNRESOLVED`
- `DBT_DOMAIN_UNRESOLVED`
- `DBT_OWNER_MISSING`
- `DBT_OWNER_INVALID`
- `DBT_CRITICALITY_INVALID`
- `DBT_PUBLIC_MARKER_INVALID`
- `DBT_RULE_SKIPPED_MISSING_METADATA`
- `DBT_GOVERNANCE_PROFILE_INVALID`

Extension diagnostics own:

- insufficient governance metadata
- unsupported governance interpretation patterns
- ambiguous domain or layer interpretation
- invalid governance profile interpretation
- skipped or partial governance analysis

Extension diagnostics do not own:

- missing or malformed dbt artifacts
- unresolved artifact-derived dependencies
- Node, npm, Python, dbt invocation, or environment setup failures
- runtime package compatibility problems
- governance rule violations

## Signals

This package also owns dbt extension signals for small, composable
architectural observations over normalized adapter output. These signals are
factual and traceable. They do not decide pass/fail, do not implement
recommendations, and do not replace governance rules.

Current MVP signal codes:

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

Signal categories cover:

- layering observations over resolved dbt layers
- cross-domain dependency and shared-model candidates
- ownership presence and same-domain ownership inconsistency candidates
- documentation, tests, and contract presence observations
- DAG fan-in, fan-out, and hotspot candidates

Semantic distinction:

- A signal says: `we observed this architectural condition`
- A rule says: `this condition is allowed or forbidden under this profile`
- A recommendation says: `take this action`

The built-in signal provider uses these default thresholds:

- high fan-in threshold: `3`
- high fan-out threshold: `3`
- architectural hotspot combined threshold: `5`
- criticality values requiring tests: `high`, `critical`

## Rule Pack

This package now also exports the built-in dbt architecture rule pack:

- rule pack id: `dbt-architecture-basic`
- export: `dbtArchitectureBasicRulePack`
- factory: `createDbtArchitectureBasicRulePack(...)`

Current MVP rule IDs:

- `dbt/no-disallowed-layer-dependency`
- `dbt/no-mart-to-mart-dependency`
- `dbt/critical-models-require-owner`
- `dbt/public-models-require-description`
- `dbt/critical-models-require-tests`
- `dbt/public-models-require-contract`
- `dbt/cross-domain-dependencies-require-approval`

These rules consume normalized workspace data plus dbt resolver output,
extension diagnostics, and dbt signals. The extension contract returns only
violations, so pass means `no violation emitted` and metadata-driven skips are
explained through diagnostics instead of a separate skip result object.

## Metrics

This package also exports the built-in dbt raw metric provider:

- export: `dbtGovernanceMetricProvider`
- factory: `createDbtGovernanceMetricProvider(...)`
- builder: `buildDbtGovernanceMetrics(...)`

The metric provider consumes normalized workspace input, dbt resolver output,
extension diagnostics, dbt signals, and rule results. It prefers raw counts
and ratios over calibrated scores in the MVP.

Current MVP metric IDs:

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

Metric behavior:

- `dbt-model-count` counts normalized dbt model resources and excludes sources,
  seeds, and snapshots.
- `dbt-dependency-count` counts normalized model-to-model dependencies relevant
  to dbt governance.
- `dbt-cross-domain-dependency-count` prefers cross-domain dependency signals
  and otherwise derives the count from resolved domain metadata.
- `dbt-layer-violation-count` prefers rule results and counts
  `dbt/no-disallowed-layer-dependency` violations.
- coverage/adoption ratios count resources with resolved metadata over the
  total eligible model resource set.
- `dbt-hotspot-count` counts unique resources flagged by high fan-in, high
  fan-out, or hotspot candidate signals.
- unresolved counts come from resolver output and remain traceable to matching
  extension diagnostics.

Ratio metrics handle denominator `0` explicitly and consistently:

```json
{
  "id": "dbt-documentation-coverage-ratio",
  "value": 0,
  "unit": "ratio",
  "metadata": {
    "numerator": 0,
    "denominator": 0,
    "ratio": 0,
    "zeroDenominator": true
  }
}
```

Example raw count metric:

```json
{
  "id": "dbt-cross-domain-dependency-count",
  "value": 2,
  "unit": "count",
  "metadata": {
    "count": 2,
    "countedDependencyKeys": [
      "model.analytics.orders->model.finance.customers",
      "model.analytics.revenue->model.sales.accounts"
    ]
  }
}
```

## Recommendations

This package also exports the built-in dbt recommendation provider:

- export: `dbtGovernanceRecommendationProvider`
- factory: `createDbtGovernanceRecommendationProvider(...)`
- builder: `buildDbtGovernanceRecommendations(...)`

The recommendation provider is deterministic and template-based. It consumes
existing extension diagnostics, signals, rule violations, and metrics. It does
not implement AI generation, artifact loading, or new governance inference.

Current MVP recommendation codes:

- `ADD_OWNER`
- `ADD_DESCRIPTION`
- `ADD_TESTS`
- `ENABLE_CONTRACT`
- `REVIEW_CROSS_DOMAIN_DEPENDENCY`
- `REDUCE_HIGH_FAN_IN`
- `FIX_LAYER_DEPENDENCY`

Trigger mapping:

- `ADD_OWNER` from owner-missing diagnostics, owner-missing signals, or
  `dbt/critical-models-require-owner` violations
- `ADD_DESCRIPTION` from description-missing signals or
  `dbt/public-models-require-description` violations
- `ADD_TESTS` from missing-tests signals or
  `dbt/critical-models-require-tests` violations
- `ENABLE_CONTRACT` from missing-contract signals or
  `dbt/public-models-require-contract` violations
- `REVIEW_CROSS_DOMAIN_DEPENDENCY` from cross-domain dependency signals or
  `dbt/cross-domain-dependencies-require-approval` violations
- `REDUCE_HIGH_FAN_IN` from high fan-in or hotspot signals, with hotspot
  metric linkage when available
- `FIX_LAYER_DEPENDENCY` from layer-bypass signals or
  `dbt/no-disallowed-layer-dependency` violations

Recommendations are deduplicated by recommendation code plus target identity,
then merged so related diagnostic ids, signal ids, violation ids, and
measurement ids stay attached to a single output.

Example recommendation shape:

```json
{
  "id": "dbt-recommendation-2f77f2a4f5cbdab7",
  "title": "Enable dbt contract",
  "priority": "high",
  "reason": "A public/governed dbt model is missing an enforced contract.",
  "description": "Enable and define a dbt contract for the public/governed model so downstream interfaces stay explicit.",
  "reference": {
    "nodeId": "model.analytics.orders",
    "projectId": "model.analytics.orders",
    "relatedProjectIds": ["model.analytics.orders"]
  },
  "metadata": {
    "code": "ENABLE_CONTRACT",
    "dbtUniqueId": "model.analytics.orders",
    "triggerSignalCodes": ["DBT_CONTRACT_MISSING_FOR_PUBLIC_MODEL_CANDIDATE"]
  }
}
```

Minimal profile-driven config uses `profile.rules[ruleId].options`. Current
options are:

```ts
{
  'dbt/no-disallowed-layer-dependency': {
    options: {
      allowedUpstreamByLayer: {
        staging: ['staging'],
        intermediate: ['staging', 'intermediate'],
        marts: ['intermediate', 'marts'],
      },
    },
  },
  'dbt/no-mart-to-mart-dependency': {
    options: {
      martLayers: ['marts'],
    },
  },
  'dbt/critical-models-require-owner': {
    options: {
      criticalityLevels: ['high', 'critical'],
      requireExplicitCriticality: false,
    },
  },
  'dbt/critical-models-require-tests': {
    options: {
      criticalityLevels: ['high', 'critical'],
      requireExplicitCriticality: false,
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
}
```

## Resolver Concepts

This package also exports pure metadata resolvers that interpret normalized
Governance inventory metadata into dbt-specific extension concepts.

Resolvers consume normalized governance inputs plus preserved `metadata.dbt`
fields. They do not load dbt artifacts, parse manifests, run dbt commands, or
evaluate rules.

Resolver entrypoints:

```ts
import {
  resolveDbtGovernanceMetadata,
  resolveDbtLayer,
  resolveDbtDomain,
  resolveDbtOwner,
  resolveDbtCriticality,
  resolveDbtPublicInterface,
} from '@anarchitects/governance-extension-dbt';
```

Resolver outputs distinguish:

- `resolved`
- `unresolved`
- `invalid`
- `ambiguous`

Each resolution preserves traceability through the Governance node ID, dbt
unique ID when available, and source metadata field paths.

## Supported Conventions

Current MVP resolver conventions:

- layer from `project.layer`
- layer from `metadata.dbt.resource.meta.layer`
- layer from tags such as `layer:marts`
- layer from path segments such as `models/staging`, `models/intermediate`,
  `models/marts`
- domain from `project.domain`
- domain from `metadata.dbt.resource.meta.domain`
- domain from path when explicitly enabled
- owner from `project.ownership.team`
- owner from `metadata.dbt.resource.owner`
- owner from `metadata.dbt.resource.group`
- owner from `metadata.dbt.resource.meta.owner`
- criticality from `metadata.dbt.resource.meta.criticality`
- public/governed interface markers from `metadata.dbt.resource.meta.public`
  and `metadata.dbt.resource.meta.governed`
- public/governed interface markers from tags such as `public`, `published`,
  and `governed`
- materialization category from `metadata.dbt.resource.materialization`
- documentation presence from `metadata.dbt.documentation.description`,
  `hasDescription`, and `hasDocs`
- test presence from `metadata.dbt.validation.tests`
- contract presence from `metadata.dbt.validation.contract`

These resolvers stay descriptive only. Missing metadata is not treated as a
rule violation here, and invalid or ambiguous metadata is surfaced for
extension diagnostics and later signal, rule, metric, and recommendation
issues.

## Non-Goals

- Loading raw dbt artifacts
- Normalizing dbt resources
- Adapter logic
- Runtime composition
- Python host behavior
- Running dbt commands
- npm runtime setup
- Depending on `@anarchitects/governance-adapter-dbt`
- Depending on `@anarchitects/governance-runtime-dbt`
- Depending on `@anarchitects/governance-host-dbt`
