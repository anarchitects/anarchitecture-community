# Governance Package Boundaries

Authoritative accepted architecture decision:
[ADR 0001: Governance Package Boundaries for Core, CLI, Adapters, and Extensions](./adr/0001-governance-package-boundaries.md)

Additional accepted architecture decision:
[ADR 0003: Governance Boundaries for Canonical Core, Adapters, Extensions, and Hosts](./adr/0003-governance-core-adapter-extension-host-boundaries.md)

This document defines public API and dependency-boundary conventions for future Governance packages in `anarchitects/anarchitecture-community`.

Status:
Supporting guidance for Governance package boundary work. Accepted architectural source of truth lives in ADR 0001 and ADR 0003.

Practical contributor guide:
[`docs/governance-boundary-contributor-guide.md`](./governance-boundary-contributor-guide.md)

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
- `@anarchitects/governance-adapter-*` -> `@anarchitects/governance-core`
- `@anarchitects/governance-extension-*` -> `@anarchitects/governance-core`
- future Governance hosts or runtimes -> `@anarchitects/governance-core` plus
  the concrete adapters and extensions they intentionally orchestrate
- published packages in `anarchitecture-plugins` -> published Governance
  packages from `anarchitecture-community`

Forbidden:

- `@anarchitects/governance-core` -> CLI packages
- `@anarchitects/governance-core` -> adapter packages
- `@anarchitects/governance-core` -> extension runtime implementations
- `@anarchitects/governance-adapter-*` -> concrete extension implementation
  packages at runtime
- any Community Governance package -> Nx APIs
- any Community Governance package -> `@anarchitects/governance-adapter-nx`
- any Community Governance package -> `@anarchitects/nx-governance`

## Governance Core Boundary Rules

`@anarchitects/governance-core`:

- owns canonical contracts
- owns deterministic governance logic
- owns generic extension runtime and model expansion envelope contracts
- must remain platform-independent
- must not know about Nx
- must not know about CLI runtime concerns
- must not know about TypeScript, dbt, GitHub, Angular, or other
  technology-specific payload schemas
- must not own adapter extraction config, extension interpretation config, or
  host orchestration config

Core is the canonical model layer. It should define the shapes that adapters and hosts normalize into, not consume host-specific extraction models.

## CLI Boundary Rules

`@anarchitects/governance-cli`:

- owns standalone runtime orchestration
- may depend on Core
- may accept concrete adapters only through Core-owned contracts and
  host-routed package loading
- may format output and handle process exit behavior
- must not become a source of canonical Governance contracts
- must not depend directly on concrete adapter packages
- must not fold adapter or extension options into the canonical profile

If the CLI needs a reusable contract, that contract belongs in Core rather than in CLI-specific modules.

## Adapter Boundary Rules

`@anarchitects/governance-adapter-*`:

- own source extraction and normalization
- may depend on Governance Core contracts
- may emit extension-owned expansions through generic Core-owned envelopes
- must normalize into canonical Core structures
- must preserve source provenance when useful
- must not import concrete extension implementation packages at runtime
- must not runtime-depend on concrete extension implementation packages
- must not call extension factory functions
- must not move technology-specific payload fields into Core

Adapters may emit extension-owned data by protocol shape, but they must build
`GovernanceExtensionModelExpansion<TData>` envelopes through
`@anarchitects/governance-core` contracts only.

## Extension Boundary Rules

`@anarchitects/governance-extension-*`:

- may extend Governance behavior
- may contribute rules, signals, presets, and diagnostics
- own technology-specific expansion validation and versioning
- must remain platform-independent unless explicitly documented otherwise
- must not own source artifact loading
- must not own adapter extraction
- must not own host orchestration

Extensions should plug into Core contracts and extension points rather than inventing parallel models.

## Config Placement

Use the config split from ADR 0003 and the contributor guide:

- canonical profile: generic governance policy only
- adapter config: extraction, discovery, normalization, paths, validation mode
- extension config: interpretation, diagnostics, signals, metrics,
  recommendations
- host config: orchestration, loading, runtime context, reporting

Technology-specific options do not belong in the canonical profile.

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

If a feature requires Nx runtime knowledge to function, it belongs in `anarchitecture-plugins`, not in a Anarchitects Governance package.

## Dependency Direction Examples

Preferred:

- a CLI command accepts or is given an adapter implementation through Core-owned contracts and evaluates rules through `@anarchitects/governance-core`
- an extension contributes rule definitions or diagnostics through Core extension points
- an Nx-specific package consumes published Core contracts and normalizes Nx data into those contracts outside this repository

Avoid:

- teaching Core how Nx graphs are loaded
- exporting adapter-private parsing models as cross-package contracts
- importing internal adapter modules directly from CLI or extensions
