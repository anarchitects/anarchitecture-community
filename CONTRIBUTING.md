# Contributing

## Purpose

This repository hosts community integration packages for the Anarchitects ecosystem.

The initial focus is:

- `@anarchitects/better-auth-typeorm-adapter`
- `@anarchitects/nest-angular-ssr`

Contributions should improve package quality, maintainability, and reuse without expanding scope unnecessarily.

## Principles

- Keep public APIs small and intentional.
- Prefer explicit contracts over magic behavior.
- Do not leak framework internals into package public surfaces unless that is the package’s explicit job.
- Optimize for reusable library design, not app-specific shortcuts.
- Keep dependencies minimal and justified.
- Treat examples as validation surfaces, not product code.

## Workspace Expectations

This repo is an Nx workspace for publishable libraries.

General expectations:

- source code lives under `packages/`
- shared tooling lives under `tools/`
- documentation and design notes live under `docs/`
- examples, if added later, exist only to validate package integration

## Package Design Guidelines

### Easy mode and advanced mode

When relevant, packages should support both:

- easy mode:
  a small, straightforward entry point for common usage
- advanced mode:
  more composable APIs for targeted overrides and integration

### Typed configuration

Prefer:

- typed options
- explicit initialization APIs
- deterministic option precedence

Avoid:

- hidden environment reads inside core logic
- global mutable configuration
- implicit side effects during import

### Dependency boundaries

- keep framework-specific code inside the package that owns that integration
- do not couple unrelated packages unnecessarily
- avoid circular dependencies
- do not introduce cross-package leakage just to reduce a few lines of code

## Better Auth TypeORM Adapter Rules

- Do not force reuse of arbitrary application entities.
- Keep Better Auth persistence concerns explicit.
- Do not expose Better Auth schema tables as shared application domain models.
- Keep TypeORM mapping and Better Auth contract adaptation clearly separated.
- Prefer correctness and contract clarity over premature flexibility.

## Nest Angular SSR Adapter Rules

- Do not try to recreate deprecated APIs blindly.
- Prefer modern Angular SSR and current Nest modular patterns.
- Keep setup explicit.
- Support straightforward default usage, but preserve composition hooks for advanced consumers.
- Document platform limitations clearly.

## Code Style

- Use TypeScript.
- Prefer clear names over clever abstractions.
- Keep files focused.
- Add brief comments only where the code would otherwise be hard to follow.
- Avoid large implicit utility layers unless they clearly reduce complexity.

## Tests

All meaningful changes should include appropriate validation.

Typical expectations:

- unit tests for public behavior
- integration tests for framework boundaries
- regression tests for fixed bugs
- example validation when the package depends on real composition behavior

Before opening a PR, run the relevant Nx targets, typically:

```bash
yarn nx run-many -t lint
yarn nx run-many -t test
yarn nx run-many -t build
```

If only one project is affected, prefer project-scoped runs.

## Releasing `@anarchitects/nest-angular-ssr`

The package is intended to publish to the public npm registry through GitHub Actions using npm trusted publishing.

### One-time prerequisite

Before the first publish, configure npm trusted publishing for this GitHub repository and the publish workflow. Provenance is expected to come from GitHub Actions OIDC, not from long-lived npm tokens.

### First release

For the first package release, use Nx's first-release flow locally:

```bash
yarn nx release --projects nest-angular-ssr --skip-publish --first-release
git push && git push --tags
```

This creates the version/tag locally. The publish workflow then publishes the package from the pushed tag.

If the first CI publish needs explicit first-release handling as well, treat that as a one-time release operation and keep the steady-state workflow unchanged afterward.

### Ongoing releases

After the package already exists on npm:

```bash
yarn nx release --projects nest-angular-ssr --skip-publish
git push && git push --tags
```

The publish workflow is tag-driven and will publish `@anarchitects/nest-angular-ssr` on tags matching `nest-angular-ssr@*`.

### Local verification before releasing

Recommended package-scoped checks:

```bash
yarn nx build nest-angular-ssr
yarn nx typecheck nest-angular-ssr
yarn nx test nest-angular-ssr
yarn nx release publish --projects nest-angular-ssr --dry-run
```

## Releasing `@anarchitects/better-auth-typeorm-adapter`

The package is intended to publish to the public npm registry through GitHub Actions using npm trusted publishing.

### One-time prerequisite

Before the first publish, configure npm trusted publishing for this GitHub repository and the publish workflow. Provenance is expected to come from GitHub Actions OIDC, not from long-lived npm tokens.

### First release

For the first package release, use Nx's first-release flow locally:

```bash
yarn nx release --projects better-auth-typeorm-adapter --skip-publish --first-release
git push && git push --tags
```

This creates the version/tag locally. The publish workflow then publishes the package from the pushed tag.

The tag-driven publish workflow watches tags matching `better-auth-typeorm-adapter@*`.

### Ongoing releases

After the package already exists on npm:

```bash
yarn nx release --projects better-auth-typeorm-adapter --skip-publish
git push && git push --tags
```

The publish workflow remains tag-driven and will publish `@anarchitects/better-auth-typeorm-adapter` on tags matching `better-auth-typeorm-adapter@*`.

### Local verification before releasing

Recommended package-scoped checks:

```bash
yarn nx build better-auth-typeorm-adapter
yarn nx typecheck better-auth-typeorm-adapter
yarn nx test better-auth-typeorm-adapter
yarn nx run better-auth-typeorm-adapter:test-postgres
yarn nx run better-auth-typeorm-adapter:test-better-auth
yarn nx release publish --projects better-auth-typeorm-adapter --dry-run
```

The release notes are expected to come from Nx's GitHub release flow using the repository's conventional commits configuration. No separate handwritten changelog file is required for the adapter.

## Documentation

Public API changes should update docs in the same change.

At minimum, keep in sync:

- package README content
- usage examples
- important limitations
- configuration contracts
- migration notes when behavior changes

## Commit and PR Guidance

Use clear, scoped commit messages.

Examples:

- feat(better-auth-typeorm-adapter): add account repository mapping
- refactor(nest-angular-ssr): simplify render bootstrap contract
- docs: clarify adapter ownership boundaries

PRs should include:

- what changed
- why it changed
- risks or tradeoffs
- validation performed

## Breaking Changes

Breaking changes are allowed only when justified, explicit, and documented.

If a change breaks public usage:

- call it out clearly
- document migration impact
- avoid mixing unrelated breaking changes into the same PR

## Dependency Additions

Add dependencies only when they are clearly necessary.

Before adding one, check:

- is it required for package purpose
- does Nx or the existing toolchain already cover this need
- can the same result be achieved with less dependency weight
- does it create long-term maintenance burden

## Scope Control

Please avoid contributions that:

- mix unrelated features in one PR
- add app-specific behavior to library code
- expand public API without a real consumer need
- introduce broad abstractions before the concrete use case is proven

## Discussion First

For large changes, open an issue or start a discussion before implementation.

This is especially important for:

- public API design
- package extraction boundaries
- adapter ownership decisions
- major dependency changes
- architectural refactors

## License

By contributing, you agree that your contributions will be released under the repository’s license.
