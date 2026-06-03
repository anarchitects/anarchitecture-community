# @anarchitects/governance-core

## Overview

`@anarchitects/governance-core` provides the shared Governance contracts,
canonical graph model, deterministic assessment helpers, diagnostics, and
extension APIs used by the Anarchitects Governance package family.

Use this package when you are building:

- a Governance adapter that emits workspace facts
- a host that evaluates or reports Governance data
- an extension that contributes technology-specific interpretation
- tooling that needs stable Governance types without depending on a concrete
  adapter or CLI

## Key Concepts

- `GovernanceWorkspace` represents the normalized workspace view used by Core
  assessment helpers.
- `GovernanceNodeInput` represents a governed asset, item, or entity before
  normalization.
- `GovernanceRelationInput` represents a relationship between governed nodes
  before normalization.
- `GovernanceProjectInput` and `GovernanceDependencyInput` are supported
  project-oriented compatibility contracts for codebase consumers.
- `GovernanceWorkspaceAdapterResult` is the adapter result shape consumed by
  hosts and normalization helpers.
- `GovernanceDiagnostic` represents adapter-owned or host-owned diagnostic
  information.
- Governance profiles, rules, findings, signals, measurements, scores, and
  assessments describe deterministic evaluation output.
- Extension contracts let hosts register optional technology-specific
  contributions without creating adapter-to-extension dependencies.

## Installation

```bash
npm install @anarchitects/governance-core
```

## Quick Start

```ts
import {
  buildGovernanceWorkspace,
  type GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

const adapterResult: GovernanceWorkspaceAdapterResult = {
  workspaceId: 'example',
  workspaceName: 'Example Workspace',
  workspaceRoot: '.',
  nodes: [
    {
      id: 'package:api',
      name: 'api',
      kind: 'project',
      type: 'package',
      path: 'packages/api',
    },
  ],
  relations: [],
  projects: [],
  dependencies: [],
};

const workspace = buildGovernanceWorkspace(adapterResult);

console.log(workspace.nodes);
```

## Architecture

```text
Adapters
  -> GovernanceWorkspaceAdapterResult
  -> Governance Core normalization and evaluation
  -> Assessment artifacts
  -> Hosts, reports, and automation

Extensions
  -> Governance Core extension contracts
  -> Host registration
  -> Optional technology-specific contributions
```

Core owns shared contracts and deterministic logic. It does not own workspace
extraction, command-line orchestration, report rendering, or technology-specific
runtime behavior.

## Responsibilities

This package owns:

- canonical Governance contracts for workspaces, nodes, relations,
  classifications, ownership, diagnostics, profiles, rules, findings, signals,
  measurements, scores, and assessments
- adapter result contracts and workspace normalization helpers
- deterministic rule evaluation and assessment assembly primitives
- built-in generic Governance rule packs
- compatibility helpers for project/dependency-oriented consumers
- extension contracts, capability contracts, diagnostics, and registration
  helpers
- deterministic AI handoff payload builders that operate on Core assessment
  data

This package does not own:

- concrete adapter implementations
- TypeScript, Nx, dbt, GitHub, Atlassian, or other platform extraction logic
- CLI argument parsing or process exit behavior
- report rendering or dashboard presentation
- extension package implementations
- host-specific configuration discovery

## Public API

The package publishes one root entrypoint:

```ts
import {
  buildGovernanceWorkspace,
  buildGovernanceAssessment,
  buildGovernanceAssessmentArtifacts,
  calculateGovernanceHealth,
  calculateGovernanceMetrics,
  coreBuiltInRulePack,
  evaluateRulePack,
  normalizeGovernanceProfile,
  registerLoadedGovernanceExtensions,
  type GovernanceWorkspaceAdapter,
  type GovernanceWorkspaceAdapterResult,
  type GovernanceNodeInput,
  type GovernanceRelationInput,
  type GovernanceProjectInput,
  type GovernanceDependencyInput,
  type GovernanceDiagnostic,
  type GovernanceExtensionDefinition,
} from '@anarchitects/governance-core';
```

The public surface includes these export groups:

- adapter contracts and adapter result types
- canonical graph contracts and graph normalization helpers
- project/dependency compatibility contracts and mapping helpers
- workspace, profile, rule, finding, signal, metric, score, health, assessment,
  snapshot, drift, and exception contracts
- deterministic evaluation helpers such as `evaluateRulePack(...)`,
  `buildGovernanceAssessment(...)`, and
  `buildGovernanceAssessmentArtifacts(...)`
- generic built-in rule packs such as `coreBuiltInRulePack`
- extension contracts, capability contracts, diagnostics, and runtime helpers
- deterministic AI request, context, payload, and summary helpers

Internal source paths are not part of the public API. Import from
`@anarchitects/governance-core`.

## Usage

### Adapter Results

Adapters should emit `GovernanceWorkspaceAdapterResult`. New adapters should use
`nodes` and `relations` for canonical graph output. Codebase-oriented adapters
may also emit `projects` and `dependencies` for consumers that need
project/dependency views.

### Assessment Artifacts

Hosts can pass normalized workspace data into Core helpers to produce rule
results, findings, signals, measurements, recommendations, health scores, and
assessment artifacts.

### Extensions

Hosts can register extension definitions through Core extension runtime helpers.
Extensions consume public Core contracts and should not depend on concrete
adapter or CLI internals.

## Configuration

Core does not read configuration files directly. Profiles, adapter results,
exceptions, and extension definitions are supplied by hosts. This keeps the
package portable across CLIs, CI jobs, applications, and other automation.

## Extension Points

Core exposes extension contracts for packages that contribute optional
technology-specific interpretation. Extension packages can declare metadata,
register through a host, and use Core-owned capability and diagnostic contracts.

## Related Packages

- `@anarchitects/governance-cli` provides the `agov` executable and host APIs.
- `@anarchitects/governance-adapter-typescript` discovers TypeScript workspace
  facts and emits Core adapter results.
- `@anarchitects/governance-extension-typescript` provides the TypeScript
  extension package boundary and registration surface.

## Compatibility

`GovernanceNodeInput` and `GovernanceRelationInput` are the canonical graph
input contracts. `GovernanceProjectInput` and `GovernanceDependencyInput`
remain supported for project/dependency-oriented consumers and for packages that
need compatibility views.

Consumers should prefer the canonical graph fields when they need to model
assets or relationships that are broader than code projects and code
dependencies.

## FAQ

### Does Core discover workspaces?

No. Adapters discover workspace facts and emit Core-owned contracts.

### Does Core render CLI or UI reports?

No. Core provides renderer-agnostic assessment data. Hosts and reporting
packages decide how to present that data.

### Can extensions depend on adapters?

No. Extensions should depend on public Core contracts only. Hosts compose
adapters and extensions.

## License

MIT
