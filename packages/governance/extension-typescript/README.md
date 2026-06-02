# @anarchitects/governance-extension-typescript

TypeScript-specific Governance extension package for the Anarchitects Community
Governance runtime.

This package establishes the package boundary and registration surface for
future TypeScript-specific Governance interpretation. It is intentionally a
minimal no-op extension in #237.

## Purpose

`@anarchitects/governance-extension-typescript` is the future home for
TypeScript-specific Governance contributions:

- TypeScript-specific rules.
- TypeScript-specific metrics.
- TypeScript-specific recommendations.
- TypeScript-specific enrichers.

Those contributions are not implemented in this package introduction.

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
providers, or enrichers are registered in #237.

## Future Responsibilities

- #238 moves TypeScript-specific rules into this package.
- #239 moves TypeScript-specific metrics and recommendations into this package.

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
