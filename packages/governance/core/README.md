# `@anarchitects/governance-core`

Platform-independent Governance Core contracts, deterministic logic, and portable extension APIs owned by `anarchitects/anarchitecture-community`.

This package is part of the Governance split and now owns the extracted Core public API from `anarchitects/anarchitecture-plugins/packages/governance/src/core`.
It also owns the portable Governance extension contracts and runtime registry from `anarchitects/anarchitecture-plugins/packages/governance/src/extensions`.

Public entrypoint:

```ts
import {
  DefaultGovernanceCapabilityRegistry,
  buildGovernanceAssessment,
  collectGovernanceSignals,
  buildMetricSnapshot,
  compareSnapshots,
  coreBuiltInRulePack,
  evaluateRulePack,
  registerLoadedGovernanceExtensions,
  normalizeGovernanceException,
  normalizeGovernanceProfile,
} from '@anarchitects/governance-core';
```

Current migration status:

- Core contracts and deterministic logic are extracted here.
- Portable extension contracts, capability contracts, diagnostics, and runtime registration are extracted here.
- Nx-specific Governance integration remains in `anarchitects/anarchitecture-plugins`.
- Nx-specific extension discovery, config loading, module loading, and plugin probing remain in `anarchitects/anarchitecture-plugins`.

Portable extension API ownership:

- `src/extensions/contracts.ts` owns extension registration and execution contracts.
- `src/extensions/capabilities.ts` owns the generic capability registry.
- `src/extensions/diagnostics.ts` owns extension diagnostic contracts.
- `src/extensions/runtime.ts` owns deterministic runtime registration and execution helpers.
- host-owned discovery, config loading, filesystem traversal, and module resolution stay out of this package.

`workspaceRoot` decision:

- `GovernanceExtensionHostContext.workspaceRoot` remains `string`.
- Rationale: it is a generic workspace concept, not an Nx runtime API.
- Core only carries that value in the portable host context; it does not read files, inspect `nx.json`, or perform module loading from it.

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
