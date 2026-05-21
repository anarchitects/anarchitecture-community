# Governance Package Layout

This document defines the target package layout for Community-owned Governance packages in `anarchitects/anarchitecture-community`.

Status:
Target state only. The physical package split described here may not exist yet. This document is intended to guide later extraction and package creation work.

## Repository Ownership

`anarchitects/anarchitecture-community` owns the platform-independent Governance ecosystem:

- `@anarchitects/governance-core`
- `@anarchitects/governance-cli`
- `@anarchitects/governance-adapter-typescript`
- `@anarchitects/governance-extension-*`

`anarchitects/anarchitecture-plugins` owns the Nx-specific Governance integration ecosystem:

- `@anarchitects/governance-adapter-nx`
- `@anarchitects/nx-governance`

Community packages must remain platform-independent. Nx-specific behavior stays in `anarchitecture-plugins`.

## Target Layout

This repository currently organizes packages under `packages/<domain>/<package>`. Future Community-owned Governance packages should follow that convention:

```text
packages/
  governance/
    core/
      package: @anarchitects/governance-core
    cli/
      package: @anarchitects/governance-cli
    adapters/
      typescript/
        package: @anarchitects/governance-adapter-typescript
    extensions/
      <name>/
        package pattern: @anarchitects/governance-extension-*
```

This target layout only defines `core`, `cli`, the TypeScript adapter, and platform-independent extensions. It does not define additional adapter families yet.

Within the current Nx and Yarn workspace, concrete package roots should still follow the repository's existing `packages/*/*` convention. See `docs/governance-package-conventions.md` for the workspace-specific packaging rules.

## Package Responsibilities

### `@anarchitects/governance-core`

Owns the canonical platform-independent Governance model:

- canonical workspace, project, and dependency contracts
- governance rule contracts
- policy evaluation
- metrics
- health and scoring
- signals, violations, and measurements
- deterministic assessment and report models
- platform-independent extension and capability contracts where applicable

### `@anarchitects/governance-cli`

Owns standalone execution outside Nx:

- standalone non-Nx execution
- CLI command surface
- CLI output formatting
- file and stdout output routing
- process exit behavior
- host runtime wiring outside Nx

### `@anarchitects/governance-adapter-typescript`

Owns non-Nx TypeScript workspace analysis:

- non-Nx TypeScript workspace detection
- package-manager workspace parsing
- `tsconfig` and path alias parsing
- project discovery and Governance tag mapping
- static import graph analysis
- mapping imports to canonical `GovernanceWorkspace` dependencies

### `@anarchitects/governance-extension-*`

Owns platform-independent enrichers and add-on capabilities:

- framework-specific or language-specific enrichers that do not require Nx
- rule packs
- signal providers
- metric providers
- presets
- diagnostics

Extensions must not own Nx-specific discovery or runtime behavior.

## Ownership Boundaries

Community packages must not own the following:

- Nx project graph loading
- Nx metadata extraction
- Nx executors
- Nx generators
- Project Crystal inference
- Nx plugin runtime
- Nx compatibility behavior
- Nx-specific configuration reading

Those responsibilities belong in `anarchitecture-plugins`.

## Dependency Direction

Allowed:

- `@anarchitects/governance-cli` -> `@anarchitects/governance-core`
- `@anarchitects/governance-adapter-typescript` -> `@anarchitects/governance-core`
- `@anarchitects/governance-extension-*` -> `@anarchitects/governance-core`
- packages in `anarchitecture-plugins` -> published Governance packages from `anarchitecture-community`

Forbidden:

- `@anarchitects/governance-core` -> `@anarchitects/governance-cli`
- `@anarchitects/governance-core` -> `@anarchitects/governance-adapter-typescript`
- any Community package -> `@anarchitects/nx-governance`
- any Community package -> `@anarchitects/governance-adapter-nx`
- any Community package -> Nx APIs
- `anarchitecture-community` -> `anarchitecture-plugins`

## Practical Rule

If a Governance capability requires Nx runtime knowledge, Nx configuration semantics, or Nx project graph behavior, it does not belong in a Community-owned Governance package.
