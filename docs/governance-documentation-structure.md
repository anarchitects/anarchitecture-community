# Governance Documentation Structure

This document defines how documentation for future platform-independent Governance packages should be structured in `anarchitects/anarchitecture-community`.

Status:
Target-state guidance for future package extraction and documentation work. It does not mean the physical package split has already happened.

## Governance Documentation Philosophy

Canonical Governance concepts should have a single authoritative documentation source. Package documentation should focus on package-specific responsibilities and usage.

Use these rules:

- document canonical Governance concepts once
- keep package READMEs focused and package-specific
- separate architecture guidance from package usage guidance
- distinguish the current transitional state from the target architecture in migration docs
- keep Community Governance documentation reusable outside Nx
- write documentation so it is useful for both humans and AI-assisted migration work

## Documentation Hierarchy

The Governance documentation set should stay split between repository-level Governance docs and package-level READMEs.

Suggested structure:

```text
docs/
  governance-package-layout.md
  governance-package-conventions.md
  governance-package-boundaries.md
  governance-release-conventions.md
  governance-documentation-structure.md
packages/governance/*/README.md
```

Repository-level Governance docs should own shared concepts, ownership boundaries, dependency direction, release sequencing, and documentation structure guidance.

Package-level READMEs should own package-specific purpose, usage, configuration, compatibility notes, and links back to the shared Governance docs where needed.

## Package README Expectations

Each future Governance package should have a focused package-level `README.md`.

Each package README should cover:

- package purpose
- public entry points and usage
- package-specific configuration expectations
- package-specific compatibility notes
- links to the shared Governance docs for canonical concepts and repository-wide conventions

Package READMEs should not redefine canonical Governance concepts that already have an authoritative repository-level source.

## Core Documentation Expectations

`@anarchitects/governance-core` documentation should cover:

- canonical contracts
- `GovernanceWorkspace` model
- rule and policy concepts
- metrics, signals, and violations concepts
- deterministic governance principles
- extension contracts and capabilities where applicable
- platform-independence guarantees

Canonical Governance concepts should be documented once and then referenced from other package docs rather than re-explained package by package.

## CLI Documentation Expectations

`@anarchitects/governance-cli` documentation should cover:

- CLI commands
- standalone execution
- output formats
- runtime orchestration
- configuration expectations
- migration guidance from Nx-centered workflows where relevant

CLI documentation should focus on host/runtime usage rather than redefining Core contracts.

## Adapter Documentation Expectations

`@anarchitects/governance-adapter-typescript` documentation should cover:

- TypeScript workspace discovery
- package-manager workspace support
- `tsconfig` and path alias parsing
- static import graph extraction
- normalization into canonical `GovernanceWorkspace` structures
- supported and non-supported assumptions

Adapter documentation should explain how host-specific extraction maps into canonical Core contracts rather than introducing a second conceptual model.

## Extension Documentation Expectations

`@anarchitects/governance-extension-*` documentation should cover:

- extension purpose
- contributed rules, signals, presets, or diagnostics
- extension registration expectations
- platform-independence expectations
- compatibility expectations

Extension documentation should stay specific to the extension and link back to the canonical Governance concepts documented elsewhere.

## Architecture Documentation Placement

Architecture-level Governance documentation belongs under `docs/`.

That includes:

- package layout and ownership
- workspace and packaging conventions
- package boundaries and dependency direction
- release and versioning conventions
- documentation structure guidance
- cross-package architectural concepts that should not be duplicated in package READMEs

Package READMEs should reference these documents instead of rehosting them.

## Migration Documentation Expectations

Migration documentation should distinguish clearly between:

- the current transitional state
- the future extracted package model

Migration docs should explain what is stable already, what is target-state guidance, and what remains Nx-specific in `anarchitecture-plugins`.

If a migration note depends on Nx runtime behavior, that runtime-specific documentation belongs outside this repository.

## Compatibility Documentation Expectations

Compatibility notes should exist at the narrowest useful level.

Use these rules:

- shared compatibility principles belong in repository-level Governance docs
- package-specific compatibility expectations belong in package READMEs
- transitional compatibility notes should call out whether they apply before or after extraction
- Community docs should describe compatibility without assuming Nx runtime ownership

## Examples And Tutorials

Examples and tutorials should be placed according to scope.

Use these rules:

- package-specific usage examples belong in the relevant package README or package-local docs when the package exists
- shared conceptual examples belong under `docs/`
- migration-oriented walkthroughs belong under `docs/`
- large manual validation fixtures should remain separate from package documentation and publishable package contents

Examples should reinforce canonical contracts and package boundaries rather than encouraging deep internal imports or Nx-specific assumptions.

## Package Ownership And Dependency Direction Documentation

Ownership boundaries and dependency direction should remain documented at the repository level rather than repeated independently in every package README.

Package docs should link to the shared Governance docs for:

- Community package ownership boundaries
- forbidden Nx-specific responsibilities
- allowed and forbidden dependency direction
- Community-first release direction

## Cross-Repository References

Cross-repository references should stay minimal and role-based.

Use these rules:

- Community docs may reference `anarchitecture-plugins` as the home for Nx-specific Governance integration
- Community docs should not depend on detailed Plugins implementation knowledge
- Community docs should describe the Community side as the source of platform-independent Governance contracts

## Nx Isolation Expectations

Community Governance docs should avoid Nx runtime assumptions.

Practical implications:

- Nx executor, generator, and plugin-runtime documentation belongs in `anarchitecture-plugins`
- Nx-specific migration steps belong in `anarchitecture-plugins`
- Community Governance documentation should remain reusable outside Nx

If a documentation topic only makes sense in terms of Nx runtime behavior, it should not be treated as Community-owned Governance documentation.
