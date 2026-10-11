# ADR 0004: Public Package Documentation Policy

## Status

Proposed

## Context

Users discover packages through npm, GitHub, and package search results. A package README is often their first and only source for deciding whether a package fits their needs and how to use it. Documentation quality is therefore part of package quality and release readiness.

`anarchitects/anarchitecture-community` hosts public packages and plugins with distinct responsibilities and consumer workflows. Users need a consistent documentation standard regardless of package family, implementation technology, or publication channel. Internal engineering notes and repository-specific assumptions cannot substitute for installation and usage guidance.

Existing documentation guidance separates shared architecture concepts from package-specific usage. A repository-wide policy extends a common quality baseline to every current and future public package, rather than tying it to one integration, package family, or release.

## Decision

Every publishable public package/plugin must have its own public-facing `README.md`. This policy applies to all current and future public packages/plugins in this repository and their package-facing documentation. The README is part of the supported public package experience and must be suitable for npm, GitHub, and other applicable package-registry users without access to contributor discussions or a repository checkout.

### Required README Content

Each package README must cover:

- **Purpose and scope:** what the package does, who it is for, and when to use it.
- **Installation:** the published package name, supported installation commands for its ecosystem, and required initialization or configuration.
- **Compatibility and prerequisites:** supported runtimes, frameworks, relevant peer dependencies, platform requirements, and limitations; include Nx compatibility only when Nx is part of the public contract.
- **Quick start:** a minimal, complete path from installation to a working result, with commands, required configuration, and the expected outcome.
- **Usage:** the primary workflows, configuration options, defaults, and precedence rules that affect users.
- **Public surface:** supported entry points, exports, contracts, CLI commands, or extension points as applicable. For packages exposing Nx plugin functionality, document generators, executors, and inferred behavior where provided. Describe only surfaces the package actually offers.
- **Examples:** practical, copyable examples for common use cases and supported modes, using public commands and imports.
- **Troubleshooting and common cases:** common setup failures, actionable remedies, important limitations, and how to obtain support.
- **Ownership and boundaries:** what the package owns, what upstream frameworks or companion packages own, what the consumer must configure, and which optional integrations are needed. Explain these boundaries in terms of user choices and observable behavior.

Section names and depth may fit the package, but none of these applicable topics may be silently omitted. Do not invent generators, executors, or Nx runtime requirements for a package that does not expose them. Shared compatibility tables and detailed public API references may be linked, but links must work from the registry and GitHub and the README must remain sufficient to install and complete the quick start.

### Public Documentation Boundaries

Package READMEs and supporting package-facing documentation must describe the supported package as users consume it. They must not read like engineering notes or contain:

- PR/issue chronology, epic/subissue language, or implementation progress reports
- internal implementation history, abandoned approaches, or delivery sequencing
- test fixture details or repository-only validation instructions
- source-internal architecture, helper modules, private imports, or contributor implementation constraints unless they are explicitly part of the supported public API contract

Internal rationale, contributor constraints, fixture instructions, and historical records belong in contributor or architecture documentation. A short link to such material is acceptable; following it must not be necessary for ordinary package use. A support link is not a substitute for troubleshooting guidance.

Document public ownership boundaries and architectural guarantees where they help consumers select, configure, or compose packages. Keep shared concepts authoritative in the existing repository-level documentation and summarize only the consumer-relevant responsibilities in each README. This preserves the separation described in [Governance Documentation Structure](../governance-documentation-structure.md) without restricting the policy to Governance packages or changing existing package boundaries.

Describe current supported behavior accurately; do not present planned functionality as available. User-facing migration guidance should explain actions and compatibility effects, without recounting internal delivery history.

### Enforcement Expectations

- New publishable public packages/plugins must ship a compliant package README before they are considered release-ready. A repository root README, generated placeholder, or link-only stub does not satisfy this requirement.
- Material changes to the public API or behavior must update the README in the same PR, including changes to exports, contracts, commands, plugin surfaces, configuration, defaults, compatibility, and ownership boundaries. Related package-facing docs, examples, and references must remain consistent.
- Authors must check the documentation against the package's actual supported commands and public surface. Reviewers must assess completeness, usable examples, working links, and the separation of consumer guidance from engineering notes before approving affected changes.
- Release validation must verify that the intended package-specific README is present and current in the actual packed artifact and is published with the package where applicable. Check the publish output after any build/copy transformations, not merely the source tree; a missing, stale, or wrong-package README must block release readiness. For publication formats that use rendered package metadata, verify that the public description uses the intended README content.
- Existing packages are in scope. Maintainers must address documentation gaps as part of preparing affected packages for release; prior publication is not an exemption.
- Maintainers may automate structural and packaging checks, but human review remains necessary for accuracy and usability. Until automated checks exist, PR review and release validation must perform these checks explicitly.

## Consequences

Positive consequences:

- Package discovery through npm, GitHub, and other registries leads to actionable installation and usage guidance across the repository.
- Consumers can understand compatibility and ownership boundaries without learning repository internals or assuming Nx is a runtime dependency.
- Documentation evolves with the public contract, and artifact validation prevents a correct source README from being lost or replaced during publication.

Trade-offs:

- Authors and reviewers must budget documentation work alongside public changes, including improvements to existing READMEs.
- Examples, compatibility statements, and linked references require ongoing maintenance across different package ecosystems.
- Releases may be delayed by incomplete documentation or incorrect packaging even when implementation checks pass.

## Implementation Expectations

Apply this policy through package creation, PR review, and release validation. This ADR establishes the requirements; adopting it does not by itself certify existing READMEs or introduce automated checks. Package documentation improvements and any automation should be implemented in focused follow-up changes.
