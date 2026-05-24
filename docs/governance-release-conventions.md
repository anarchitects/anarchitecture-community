# Governance Release Conventions

This document defines release sequencing and versioning expectations for future Anarchitects Governance packages in `anarchitects/anarchitecture-community`.

Status:
Target-state guidance for future extraction and release coordination work. It does not mean the physical package split has already happened.

## Governance Release Philosophy

Community Governance packages define the canonical contracts. Plugins packages consume those contracts intentionally and version explicitly against them.

Move stable seams into stable packages. Do not redesign architecture during package movement.

This repository already uses independent Nx releases. Future Governance packages should follow that existing release model rather than introducing a parallel release system.

## Manual Release Workflow

The manual GitHub release workflow accepts an optional Nx release specifier.

Use the `specifier` input for either:

- a semver bump keyword such as `patch`, `minor`, `major`, `prepatch`, `preminor`, `premajor`, or `prerelease`
- an exact version such as `0.0.1`

For first releases of the Governance packages, prefer an explicit version so the workflow does not derive a bump from repository-wide commit history.

## Cross-Repository Release Sequencing

Release direction is Community-first:

1. Release Community Governance packages.
2. Update the Plugins repository to consume the released Community versions.
3. Release Nx Governance packages.

Release sequencing must not reverse. Community packages must not wait for Nx-specific package releases to define their canonical contracts.

Community packages release first. Plugins packages consume released Community versions afterward.

## Semantic Versioning Expectations

Governance packages should follow semantic versioning.

Use these rules:

- breaking changes require explicit major-version treatment
- backward-compatible feature additions use minor versions
- fixes that preserve the public contract use patch versions
- package versions should always be explicit
- dependency ranges should be intentional rather than incidental

Community package releases should not silently break Nx Governance consumers. If a Community release changes a canonical contract in a breaking way, that break must be explicit in versioning and release notes.

## Governance Core Compatibility Expectations

`@anarchitects/governance-core` defines the canonical Governance contracts.

Compatibility expectations:

- breaking Core contract changes must be explicit
- contract-shape changes should be treated as compatibility events, not internal refactors
- Core export surfaces should remain stable and intentional
- downstream adapters, CLI flows, and Plugins packages should be able to version intentionally against released Core contracts

Core should be the most conservative package in the Governance set because other Governance packages normalize into its contracts.

## Adapter Compatibility Expectations

`@anarchitects/governance-adapter-typescript` should version intentionally against the Core contracts it emits.

Compatibility expectations:

- adapter output should stay aligned with the targeted Core contract version
- adapter compatibility expectations should be documented when Core contract changes matter
- runtime and peer dependency expectations should be explicit where applicable
- adapter releases must not invent parallel canonical models

If an adapter requires a new Core contract, that contract should be released in Community first and then consumed by the adapter intentionally.

## CLI Compatibility Expectations

`@anarchitects/governance-cli` should version intentionally against the Core and adapter versions it orchestrates.

Compatibility expectations:

- CLI compatibility with Governance Core should be explicit
- CLI runtime behavior should not become an implicit contract source
- Core-facing behavior changes that affect users should be versioned intentionally
- runtime dependency expectations should be explicit where applicable

If the CLI depends on a new Core capability, that capability should exist as a released Community contract before the CLI release depends on it.

## Published Artifact Validation

Published Governance packages should remain clean, minimal, and deterministic.

Before release:

- validate published contents with `npm pack --dry-run` or equivalent
- confirm fixtures and test data do not leak into npm artifacts
- confirm exports still point to the intended built files
- confirm published artifacts stay minimal
- confirm package outputs remain deterministic

Published artifact validation should happen before version publication, not after a release exposes a broken package boundary.

## Community Governance Release Gate

Anarchitects Governance packages should pass an explicit pre-release validation gate before publication or before Plugins-side consumption work starts.

That validation should enforce the accepted package-boundary rules from
[ADR 0001: Governance Package Boundaries for Core, CLI, Adapters, and Extensions](./adr/0001-governance-package-boundaries.md).

Run:

```bash
yarn validate:governance-packages
```

The release gate is expected to cover:

- build
- typecheck
- test
- lint
- package manifest dependency rules
- README readiness checks
- `npm pack --dry-run` validation of packed artifacts

That gate should pass for:

- `@anarchitects/governance-core`
- `@anarchitects/governance-adapter-typescript`
- `@anarchitects/governance-cli`

## Migration And Stabilization Guidance

Existing `@anarchitects/nx-governance` users should have a stable migration path.

Use these rules:

- establish a stabilization release before the physical split
- extract packages only after package boundaries and contracts are stable
- avoid redesigning the Governance architecture during extraction
- prefer explicit compatibility notes when migration-sensitive seams change

Community package releases should become independently releasable after the split, but the split itself should happen only after the seams are stable enough to support that independence.

## Nx Governance Consumer Considerations

Plugins-owned Governance packages should align with compatible released Community versions.

Practical implications:

- Plugins packages may depend on published Community Governance packages
- Community packages must not depend on Plugins packages
- Nx-specific releases should follow Community releases that define the contracts they consume
- Nx Governance consumers should not be forced onto unstable Community contracts by accident

When a Community release changes a contract used by Nx Governance, the follow-up Plugins release should update its dependency ranges and compatibility expectations explicitly.
