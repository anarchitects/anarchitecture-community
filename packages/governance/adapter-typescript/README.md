# `@anarchitects/governance-adapter-typescript`

Platform-independent TypeScript workspace discovery and normalization owned by `anarchitects/anarchitecture-community`.

This package is part of the Governance split and owns the extracted TypeScript adapter from `anarchitects/anarchitecture-plugins/packages/governance/src/typescript-adapter`.

Public APIs:

```ts
import {
  buildTypeScriptImportGraph,
  createTypeScriptWorkspaceAdapter,
  detectTypeScriptWorkspace,
  discoverTypeScriptProjects,
  deriveProjectTags,
  mapTypeScriptImportsToGovernanceDependencies,
  parsePackageManagerWorkspace,
  parseTsConfigResolution,
} from '@anarchitects/governance-adapter-typescript';
```

Supported assumptions:

- workspace detection is based on plain package-manager files such as `pnpm-workspace.yaml` and `package.json#workspaces`
- tsconfig parsing supports root `tsconfig.json`, `tsconfig.base.json`, and deterministic `extends` chains
- static import analysis supports relative imports, package-name imports, `compilerOptions.paths`, `baseUrl`, re-exports, and string-literal dynamic imports
- normalization flows into canonical `@anarchitects/governance-core` contracts such as `GovernanceProjectInput` and `GovernanceDependencyInput`
- the package can expose a concrete `GovernanceWorkspaceAdapter` implementation for hosts that want to consume it through Core-owned adapter contracts

This package must remain platform-independent:

- no Nx runtime dependencies
- no imports from `anarchitects/anarchitecture-plugins`
- no reverse dependency on Nx-specific Governance packages

Explicit non-Nx guarantee:

- this package does not read Nx graphs
- this package does not import `@nx/devkit` or `nx`
- this package does not depend on Nx plugin, executor, generator, or host runtime modules

Nx-specific Governance adapter behavior remains in `anarchitects/anarchitecture-plugins`.

Shared package guidance lives in:

- [`docs/governance-package-conventions.md`](../../../docs/governance-package-conventions.md)
- [`docs/governance-package-boundaries.md`](../../../docs/governance-package-boundaries.md)
- [`docs/governance-release-conventions.md`](../../../docs/governance-release-conventions.md)
- [`docs/governance-documentation-structure.md`](../../../docs/governance-documentation-structure.md)
