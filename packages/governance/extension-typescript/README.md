# @anarchitects/governance-extension-typescript

TypeScript-specific Governance extension package for the Anarchitects Community
Governance runtime.

This package establishes the package boundary and registration surface for
TypeScript-specific Governance interpretation. #238 classified the current Core
rule implementations and found no existing TypeScript-specific rules to move.
#239 classified the current metrics, signals, scoring, and recommendations and
found no existing TypeScript-specific implementation to move.

## Purpose

`@anarchitects/governance-extension-typescript` is the future home for
TypeScript-specific Governance contributions:

- TypeScript-specific rules.
- TypeScript-specific metrics.
- TypeScript-specific recommendations.
- TypeScript-specific enrichers.

Current Core rules are generic project/dependency, metadata, ownership, and
convention rules, so they remain in `@anarchitects/governance-core`.
Current Core metrics, signals, scoring, and recommendations are also generic
Governance assessment primitives, so they remain in
`@anarchitects/governance-core`.

## Architecture Boundary

The dependency direction is:

```text
@anarchitects/governance-extension-typescript
  -> @anarchitects/governance-core
```

Allowed:

- The extension package depends on public Governance Core extension contracts.
- Future hosts may load and register this extension through Core extension
  runtime APIs.

Forbidden:

- Governance Core must not depend on this package.
- `@anarchitects/governance-adapter-typescript` must not depend on this package.
- This package must not depend on `@anarchitects/governance-adapter-typescript`.
- This package must not depend on `@anarchitects/governance-cli`.
- This package must not depend on reporting packages.

## Current Surface

The package exports:

- `governanceTypeScriptExtension`
- `createTypeScriptGovernanceExtension`
- `registerTypeScriptGovernanceExtension`
- `typescriptGovernanceExtensionMetadata`
- `TYPESCRIPT_GOVERNANCE_EXTENSION_ID`

Registration is currently a no-op. No rule packs, metric providers, signal
providers, or enrichers are registered because no current Core rule, metric,
signal, or recommendation implementation is TypeScript-specific.

## Migration Status

- #238 classified existing Core rule implementations.
- No existing Core rule moved because the current built-in rules are generic.
- Future TypeScript-specific rules should be implemented in this package.
- #239 classified existing metrics, signals, scoring, and recommendations.
- No existing metric, signal, scoring, or recommendation implementation moved
  because the current implementations are generic or host-owned.
- Future TypeScript-specific metrics, signals, and recommendations should be
  implemented in this package.
- #240 and #241 remain follow-up issues for host and reporting migration.

## Non-Responsibilities

This package does not own:

- TypeScript workspace extraction.
- Workspace discovery.
- `tsconfig` parsing.
- Dependency graph discovery.
- CLI orchestration.
- Reporting.
- Canonical Governance Core semantics.

Those responsibilities remain in their existing packages until a scoped follow-up
issue changes them.
