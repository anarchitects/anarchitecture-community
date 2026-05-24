# ADR 0001: Governance Package Boundaries for Core, CLI, Adapters, and Extensions

Status: Accepted

## Context

The Governance package family in `anarchitects/anarchitecture-community` is being prepared as an independently releasable, platform-independent package set.

That package set currently includes:

- `@anarchitects/governance-core`
- `@anarchitects/governance-cli`
- `@anarchitects/governance-adapter-typescript`

It is also expected to grow with future packages such as:

- `@anarchitects/governance-adapter-*`
- `@anarchitects/governance-extension-*`

The architecture has been described across issue threads, package READMEs, and validation work, but that is not sufficient as a long-term source of truth.

A concrete boundary leak during and after Governance CLI executable work showed the risk clearly: `@anarchitects/governance-cli` started to become aware of `@anarchitects/governance-adapter-typescript` implementation details. That is the wrong dependency direction. The CLI must remain adapter-agnostic.

Future contributors and agents need one authoritative architectural reference that defines:

- allowed and forbidden dependency direction
- package responsibilities and non-responsibilities
- runtime interaction between Core, CLI, adapters, and extensions
- validation expectations that can be enforced automatically

This ADR is that authoritative reference.

## Decision

The Governance package family uses a Core-centered plugin architecture.

`@anarchitects/governance-core` owns canonical Governance contracts and platform-independent deterministic logic.

`@anarchitects/governance-cli` is an executable and runtime host that orchestrates checks through Core-owned contracts.

Concrete adapters implement Core-owned adapter contracts and normalize source-specific workspace models into Core-owned canonical models.

Extensions implement Core-owned extension contracts and contribute behavior through Core-owned extension points.

Nx-specific Governance integration belongs outside `anarchitects/anarchitecture-community`.

## Dependency Direction

Allowed:

- `@anarchitects/governance-cli` -> `@anarchitects/governance-core`
- `@anarchitects/governance-adapter-typescript` -> `@anarchitects/governance-core`
- `@anarchitects/governance-adapter-*` -> `@anarchitects/governance-core`
- `@anarchitects/governance-extension-*` -> `@anarchitects/governance-core`

Forbidden:

- `@anarchitects/governance-cli` -> `@anarchitects/governance-adapter-typescript`
- `@anarchitects/governance-cli` -> `@anarchitects/governance-adapter-*`
- `@anarchitects/governance-core` -> `@anarchitects/governance-adapter-*`
- `@anarchitects/governance-core` -> `@anarchitects/governance-cli`
- `@anarchitects/governance-adapter-*` -> `@anarchitects/governance-cli`
- `@anarchitects/governance-extension-*` -> `@anarchitects/governance-cli`

All Anarchitects Governance packages must not depend on:

- `@nx/devkit`
- `nx`
- `@anarchitects/governance-adapter-nx`
- `@anarchitects/nx-governance`
- source paths from `anarchitects/anarchitecture-plugins`

That prohibition stands unless a future ADR explicitly defines a new boundary.

## Package Responsibilities

### `@anarchitects/governance-core`

Core owns:

- canonical Governance contracts
- workspace, project, dependency, ownership, and violation models
- rule and policy contracts
- signal, metric, health, diagnostic, snapshot, drift, and assessment contracts where present
- generic adapter contracts
- generic adapter probe and capability contracts
- generic extension contracts
- deterministic governance evaluation logic
- platform-independent orchestration primitives where appropriate

Core must not own:

- concrete adapter implementations
- CLI argument parsing
- executable command behavior
- concrete adapter discovery heuristics
- Nx graph loading
- Nx metadata extraction
- Nx executors, generators, or plugin runtime behavior

Core is the canonical model layer. Other packages normalize into its contracts. Core does not import concrete adapters, hosts, or Nx-specific runtime logic.

### `@anarchitects/governance-cli`

CLI owns:

- executable command surface
- argument parsing
- config loading
- option precedence and runtime orchestration
- dynamic adapter loading by package name
- output formatting
- process exit code mapping
- host-side command orchestration through Core-owned contracts

CLI must not own:

- canonical Governance contracts
- concrete adapter implementations
- concrete adapter-specific workspace detection heuristics
- TypeScript-specific detection rules
- Nx graph loading
- Nx plugin runtime behavior

The CLI is a thin runtime host. It may load or accept adapters, but it must not accumulate package-specific detection logic that belongs in concrete adapters.

### `@anarchitects/governance-adapter-typescript`

The TypeScript adapter owns:

- TypeScript workspace discovery
- TypeScript-specific workspace detection heuristics
- package-manager workspace parsing where implemented
- `tsconfig` and path-alias parsing where implemented
- static import graph extraction where implemented
- normalization into Core-owned contracts
- implementation of the Core-owned adapter and probe contracts

The TypeScript adapter must not own:

- canonical Governance contracts
- CLI command behavior
- Nx graph loading
- Nx plugin runtime behavior

### Future `@anarchitects/governance-adapter-*`

Each future adapter owns:

- its own source and workspace detection heuristics
- implementation of Core-owned adapter contracts
- normalization into Core-owned canonical models

Future adapters must not:

- depend on CLI
- move canonical Governance contracts out of Core
- require package-specific static imports from the CLI

### Future `@anarchitects/governance-extension-*`

Extensions own:

- behavior contributed through Core-owned extension contracts
- rules, signals, diagnostics, presets, or similar Governance capabilities

Extensions must not:

- depend on CLI
- depend on concrete adapter implementations
- introduce Nx-specific runtime behavior into Community packages

If an extension ever needs Nx-specific behavior, that behavior belongs outside Community packages unless a future ADR states otherwise.

## Adapter Inference Decision

This is the critical boundary decision for hosts and adapters.

The CLI may orchestrate adapter discovery and dynamic loading.

The CLI may resolve candidate adapter package names from:

- `--adapter <package>`
- `config.adapter`
- `config.adapters[]`
- generic package naming conventions or package metadata, if implemented later

The CLI may dynamically load candidate adapters.

The CLI may call a Core-owned probe or capability contract to ask adapters whether they support a workspace.

The CLI must not hardcode adapter-specific detection rules.

Forbidden CLI logic includes:

- checking `tsconfig.json` to infer `@anarchitects/governance-adapter-typescript`
- checking `tsconfig.base.json` to infer `@anarchitects/governance-adapter-typescript`
- scanning `.ts` files to infer `@anarchitects/governance-adapter-typescript`
- reading TypeScript package metadata to infer `@anarchitects/governance-adapter-typescript`

Those rules belong in `@anarchitects/governance-adapter-typescript`.

Preferred model:

CLI:

- discovers candidate adapter package names generically
- loads candidate adapters dynamically
- calls `adapter.probe(root)` or an equivalent Core-owned contract
- selects a supported adapter or fails with guidance

Concrete adapter:

- owns detection heuristics
- returns support, confidence, and reasons through a Core-owned contract
- loads workspace data into Core-owned canonical models

## Runtime Interaction

### A. CLI With Explicit Adapter

```text
@anarchitects/governance-cli
  -> dynamically loads adapter package named by --adapter
  -> validates adapter against @anarchitects/governance-core contract
  -> runs check through Core-owned contracts

@anarchitects/governance-adapter-typescript
  -> implements Core-owned adapter contract
  -> emits Core-owned workspace model

@anarchitects/governance-core
  -> evaluates canonical governance model
```

### B. CLI With Adapter Discovery

```text
@anarchitects/governance-cli
  -> discovers candidate adapter package names generically
  -> loads candidates
  -> calls Core-owned probe contract
  -> selects supported adapter or fails with guidance

@anarchitects/governance-adapter-*
  -> owns detection heuristics
  -> returns probe result
  -> emits Core-owned workspace model
```

### C. Extension Contribution

```text
@anarchitects/governance-extension-*
  -> implements Core-owned extension contract
  -> contributes rules, signals, diagnostics, presets, or related behavior

@anarchitects/governance-core
  -> owns extension contracts and execution model
```

## Consequences

This decision means:

- CLI can support future adapters without package dependency changes
- concrete adapters can evolve detection heuristics independently
- Core stays stable, canonical, and platform-independent
- dynamic loading and explicit contracts are preferred over static convenience imports
- package authors must be explicit about dependency direction
- validation is required to keep the architecture enforceable

This also means some convenience behavior may require configuration, registration, or dynamic loading rather than a direct package dependency.

## Validation Expectations

Validation must fail if:

- CLI declares a concrete adapter package dependency
- CLI statically imports a concrete adapter package
- CLI contains adapter-specific detection logic
- CLI contains TypeScript-specific detection rules
- Core declares or imports concrete adapters
- adapter packages import CLI
- extension packages import CLI
- Community packages import Nx-specific packages
- Community packages import source paths from `anarchitects/anarchitecture-plugins`

Examples of forbidden patterns to check:

- `@anarchitects/governance-adapter-typescript` in `@anarchitects/governance-cli` dependencies
- `@anarchitects/governance-adapter-typescript` in CLI runtime imports
- `tsconfig.json` or `tsconfig.base.json` detection in CLI runtime code for adapter inference
- `.ts` source scanning in CLI runtime code for adapter inference
- concrete adapter package imports from `@anarchitects/governance-core`

Release-gate and boundary-validation work should reference this ADR when deciding whether a package, import, or heuristic belongs in Core, CLI, an adapter, or an extension.

## Documentation Expectations

This ADR is the authoritative architectural reference for Governance package boundaries.

Package READMEs should remain consumer-facing and self-contained. They should not duplicate this ADR in full.

Repository-level docs and package READMEs should link here when detailed package-boundary rules are needed.
