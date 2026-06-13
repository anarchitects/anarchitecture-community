# Governance Package Conventions

This document defines how future Governance packages should fit into the existing Nx and Yarn workspace conventions in `anarchitects/anarchitecture-community`.

Status:
Guidance for future package extraction and creation work. It does not mean the Governance packages already exist in this repository.

## Existing Workspace Conventions

Governance packages must extend the current workspace model instead of introducing a parallel one.

Current repository conventions include:

- Yarn workspaces rooted at `packages/*/*`
- Nx-managed library projects and targets
- `@nx/js/typescript` inferred build and typecheck behavior
- Vite, Vitest, and ESLint Nx plugin integration
- package-local `package.json` files
- package-local Nx target definitions when extra targets are needed
- independent Nx releases
- published package whitelists through `files`

No separate build, test, release, or packaging system should be introduced for Governance packages.

## Governance Package Expectations

The required Governance packages are:

- `@anarchitects/governance-core`
- `@anarchitects/governance-cli`
- `@anarchitects/governance-adapter-typescript`
- `@anarchitects/governance-extension-*`

Within the current workspace, Governance packages should use concrete package roots that still match the existing `packages/*/*` convention. For example:

```text
packages/governance/core
packages/governance/cli
packages/governance/adapter-typescript
packages/governance/extension-<name>
```

That keeps Governance packages inside the existing Yarn workspace and Nx project structure without redesigning the repository layout.

Governance packages should be:

- ESM-first
- explicitly exported
- explicitly typed
- explicitly scoped in published files
- built and tested through the existing Nx conventions
- deterministic in build and test output
- clean in published npm artifacts

See `docs/governance-package-boundaries.md` for Governance-specific public API and dependency-boundary rules.
See `docs/governance-boundary-contributor-guide.md` for Core vs adapter vs extension vs host ownership and config placement.
See `docs/governance-release-conventions.md` for release sequencing and versioning expectations.
See `docs/governance-documentation-structure.md` for package README and documentation placement expectations.

## Package.json Expectations

Governance packages should follow the package-local manifest pattern already used in this repository.

Expected characteristics:

- `"type": "module"`
- explicit `"main"`, `"module"`, and `"types"` entries pointing at `dist`
- explicit `"exports"` entries
- explicit `"files"` whitelist for publishable artifacts
- `"publishConfig"` defined as needed for public publishing
- package-local `"nx"` metadata with local target overrides only where needed

The current repository pattern is ESM-first and export-explicit. Governance packages should follow the same style:

```json
{
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "@anarchitecture-community/source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist", "!**/*.tsbuildinfo"]
}
```

Governance packages should keep published contents explicit rather than relying on npm defaults.

## Nx Target Expectations

Governance packages should use the existing Nx target model already configured at the workspace level.

That means:

- build should use the existing Nx-managed Vite library build flow
- typecheck should use the existing `@nx/js/typescript` conventions
- test should use the existing Vitest conventions
- lint should use the existing ESLint conventions
- any extra package-specific targets should be declared package-locally in `package.json`

Do not introduce package-specific tooling that bypasses Nx for normal build, typecheck, test, or lint behavior.

Package-local targets are appropriate when a Governance package needs additional validation beyond the standard inferred targets, for example:

- specialized fixture validation
- extra integration test variants
- packaging validation helpers

## Fixture And Test Data Handling

Governance packages may include fixtures or test data when they are useful for automated validation, but fixture placement should stay aligned with existing repository conventions.

Use these rules:

- keep lightweight automated fixtures inside the package only when they are directly tied to package tests
- prefer package-local `tests/` or similar clearly non-exported locations for package-specific fixtures
- keep larger manual or consumer-validation fixtures isolated from publishable package roots when practical
- use workspace-level fixture apps for cross-package or consumer-validation scenarios

Fixtures and test data must never unintentionally leak into published npm artifacts.

## Published Artifact Cleanliness

Governance packages should publish only the artifacts required for consumers.

Minimum expectations:

- publish from `dist`
- exclude `*.tsbuildinfo`
- avoid shipping raw fixtures, scratch files, test-only data, or local validation outputs
- keep `dist` outputs clean, reproducible, and deterministic
- externalize dependencies appropriately so build output reflects the intended public package boundary

Large manual validation assets should remain outside publishable outputs. If a fixture is needed for tests, it should still be prevented from appearing in the packed artifact.

## Boundary-Conscious Dependency Conventions

Package manifests should reinforce the ownership split from ADR 0003.

Use these rules:

- Core stays technology-agnostic and does not add ecosystem-specific runtime
  dependencies for convenience.
- Adapters depend on `@anarchitects/governance-core` for canonical contracts
  and generic extension envelope contracts.
- Adapters must not add runtime dependencies on concrete extension
  implementation packages.
- Extensions depend on `@anarchitects/governance-core` and own their
  technology-specific validation and interpretation.
- Hosts or runtimes may orchestrate concrete adapters and extensions, but that
  orchestration boundary does not move into Core, adapters, or extensions.

## Configuration Conventions

Governance package docs and examples should keep configuration ownership
explicit:

- canonical profile examples stay technology-neutral
- adapter examples show extraction, discovery, path, or validation options
- extension examples show interpretation and provider options
- host examples show package selection, runtime context, and reporting options

Do not place adapter or extension options in canonical profile examples.

## Package Validation Expectations

Before release, Governance packages should validate the actual package contents rather than assuming the manifest is correct.

Expected validation includes:

- running the existing Nx build, typecheck, test, and lint targets
- checking the resulting `dist` output for cleanliness
- running `npm pack --dry-run` or equivalent package-content validation

The purpose of that validation is to confirm:

- exports resolve to the intended built files
- types are present
- fixtures and test-only assets are not accidentally published
- packed contents match the explicit package boundary
