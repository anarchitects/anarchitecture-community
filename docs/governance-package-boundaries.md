# Governance Package Boundaries

This document defines public API and dependency-boundary conventions for future Governance packages in `anarchitects/anarchitecture-community`.

Status:
Target-state guidance for future package extraction and creation work. It does not mean the Governance packages already exist in this repository.

## Public API Expectations

Governance packages should expose explicit and intentional public APIs.

Use these rules:

- export only supported public contracts
- keep public entry points small and stable
- require consumers to use exported contracts only
- avoid deep imports into package internals
- avoid cross-package imports from `src/internal`, `lib/internal`, or similar implementation paths
- keep canonical Governance contracts in `@anarchitects/governance-core`

Adapters and hosts normalize into canonical Governance Core contracts. Core must not become aware of host or adapter implementation details.

## Internal Module Expectations

Internal implementation modules should remain internal to their owning package.

That means:

- internal helpers should not be treated as shared APIs
- implementation details may change without becoming cross-package contracts
- packages should not depend on another package's internal file layout
- if a consumer needs a contract, it should be promoted intentionally into the owning package's public exports

## Dependency Direction

Allowed:

- `@anarchitects/governance-cli` -> `@anarchitects/governance-core`
- `@anarchitects/governance-adapter-typescript` -> `@anarchitects/governance-core`
- `@anarchitects/governance-extension-*` -> `@anarchitects/governance-core`
- published packages in `anarchitecture-plugins` -> published Governance packages from `anarchitecture-community`

Forbidden:

- `@anarchitects/governance-core` -> CLI packages
- `@anarchitects/governance-core` -> adapter packages
- `@anarchitects/governance-core` -> extension runtime implementations
- any Community Governance package -> Nx APIs
- any Community Governance package -> `@anarchitects/governance-adapter-nx`
- any Community Governance package -> `@anarchitects/nx-governance`

## Governance Core Boundary Rules

`@anarchitects/governance-core`:

- owns canonical contracts
- owns deterministic governance logic
- must remain platform-independent
- must not know about Nx
- must not know about CLI runtime concerns
- must not know about TypeScript workspace scanning internals

Core is the canonical model layer. It should define the shapes that adapters and hosts normalize into, not consume host-specific extraction models.

## CLI Boundary Rules

`@anarchitects/governance-cli`:

- owns standalone runtime orchestration
- may depend on Core
- may accept concrete adapters only through Core-owned contracts
- may format output and handle process exit behavior
- must not become a source of canonical Governance contracts
- must not depend directly on concrete adapter packages

If the CLI needs a reusable contract, that contract belongs in Core rather than in CLI-specific modules.

## Adapter Boundary Rules

`@anarchitects/governance-adapter-typescript`:

- owns TypeScript workspace extraction logic
- may depend on Governance Core contracts
- must normalize into canonical `GovernanceWorkspace` structures
- must not leak adapter-specific models into Core

The adapter may perform host-specific parsing and discovery internally, but its public output should align with canonical Core contracts rather than custom transport shapes.

## Extension Boundary Rules

`@anarchitects/governance-extension-*`:

- may extend Governance behavior
- may contribute rules, signals, presets, and diagnostics
- must remain platform-independent unless explicitly documented otherwise
- must not own Nx runtime behavior

Extensions should plug into Core contracts and extension points rather than inventing parallel models.

## Forbidden Dependencies

Community Governance packages must not depend on:

- Nx graph loading
- Nx metadata extraction
- Nx plugin runtime behavior
- Nx executors
- Nx generators
- `@anarchitects/governance-adapter-nx`
- `@anarchitects/nx-governance`

Nx-specific packages may consume published Community packages, but that dependency direction must not reverse.

## Nx Isolation Principles

Community Governance packages must remain reusable outside Nx.

Practical implications:

- Nx graph loading belongs outside Community packages
- Nx metadata extraction belongs outside Community packages
- Nx plugin runtime behavior belongs outside Community packages
- Nx executors and generators belong outside Community packages
- any Nx compatibility layer belongs outside Community packages

If a feature requires Nx runtime knowledge to function, it belongs in `anarchitecture-plugins`, not in a Community-owned Governance package.

## Dependency Direction Examples

Preferred:

- a CLI command accepts or is given an adapter implementation through Core-owned contracts and evaluates rules through `@anarchitects/governance-core`
- an extension contributes rule definitions or diagnostics through Core extension points
- an Nx-specific package consumes published Core contracts and normalizes Nx data into those contracts outside this repository

Avoid:

- teaching Core how Nx graphs are loaded
- exporting adapter-private parsing models as cross-package contracts
- importing internal adapter modules directly from CLI or extensions
