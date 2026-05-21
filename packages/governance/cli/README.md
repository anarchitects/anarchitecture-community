# `@anarchitects/governance-cli`

This package is prepared as part of the Governance split in `anarchitects/anarchitecture-community`.

The current state is package foundation only. Standalone CLI implementation will be migrated later as follow-up extraction work.

This package must remain platform-independent with respect to Governance ownership:

- no Nx runtime dependencies
- no imports from `anarchitects/anarchitecture-plugins`
- no reverse dependency on Nx-specific Governance packages

Nx-specific Governance integration remains in `anarchitects/anarchitecture-plugins`.

Shared package guidance lives in:

- [`docs/governance-package-conventions.md`](../../../docs/governance-package-conventions.md)
- [`docs/governance-package-boundaries.md`](../../../docs/governance-package-boundaries.md)
- [`docs/governance-release-conventions.md`](../../../docs/governance-release-conventions.md)
- [`docs/governance-documentation-structure.md`](../../../docs/governance-documentation-structure.md)
