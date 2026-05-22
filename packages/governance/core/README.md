# `@anarchitects/governance-core`

Platform-independent Governance Core contracts and deterministic logic owned by `anarchitects/anarchitecture-community`.

This package is part of the Governance split and now owns the extracted Core public API from `anarchitects/anarchitecture-plugins/packages/governance/src/core`.

Public entrypoint:

```ts
import {
  buildGovernanceAssessment,
  buildMetricSnapshot,
  compareSnapshots,
  coreBuiltInRulePack,
  evaluateRulePack,
  normalizeGovernanceException,
  normalizeGovernanceProfile,
} from '@anarchitects/governance-core';
```

Current migration status:

- Core contracts and deterministic logic are extracted here.
- Nx-specific Governance integration remains in `anarchitects/anarchitecture-plugins`.
- Portable extension contracts are deferred to the dedicated follow-up slice.

This package must remain platform-independent:

- no Nx runtime dependencies
- no imports from `anarchitects/anarchitecture-plugins`
- no reverse dependency on Nx-specific Governance packages

`anarchitects/anarchitecture-community` must not depend on `anarchitects/anarchitecture-plugins`.

Nx-specific Governance integration remains in `anarchitects/anarchitecture-plugins`.

Shared package guidance lives in:

- [`docs/governance-package-conventions.md`](../../../docs/governance-package-conventions.md)
- [`docs/governance-package-boundaries.md`](../../../docs/governance-package-boundaries.md)
- [`docs/governance-release-conventions.md`](../../../docs/governance-release-conventions.md)
- [`docs/governance-documentation-structure.md`](../../../docs/governance-documentation-structure.md)
