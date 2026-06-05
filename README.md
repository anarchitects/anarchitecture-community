# Anarchitects Community Adapters

Community-maintained integration packages for the Anarchitects ecosystem.

This workspace hosts adapters and bridge libraries that are useful around the Anarchitects Bricks architecture, but do not belong in the core Bricks monorepo.

## Initial Focus

This repo starts with two packages:

- `@anarchitects/better-auth-typeorm-adapter`
  - A Better Auth database adapter backed by TypeORM.
  - First target: support the auth-domain use case proven in the Bricks monorepo.
- `@anarchitects/nest-angular-ssr`
  - A Fastify-first NestJS integration package for Angular SSR.
  - Provides a Nest module facade, explicit bootstrap helper, and lower-level composition APIs.
  - Validated for direct consumption from both CommonJS-oriented and ESM Nest apps.

## Why This Repo Exists

The main Bricks monorepo should stay focused on domain bricks and app-facing consumption.

This repo exists for integrations that are:

- reusable across projects,
- valuable to the wider community,
- not core domain contracts themselves,
- best developed as standalone packages with their own release lifecycle.

## Principles

- Keep public APIs small and explicit.
- Prefer framework adapters over framework leakage.
- Keep package boundaries clean.
- Ship minimal dependencies.
- Start internal-first, extract only what proves stable.
- Align with the Anarchitects flexibility paradigm:
  - easy mode for common use,
  - advanced mode for composition and overrides.

## Planned Packages

### `@anarchitects/better-auth-typeorm-adapter`

Goal:
Provide a production-usable Better Auth adapter for TypeORM without forcing Better Auth persistence details into app-level public contracts.

Initial expectations:

- TypeORM-backed persistence for Better Auth entities
- explicit schema ownership
- compatibility with isolated and app-integrated deployment models
- internal-first contract hardening before broader extraction/adoption

Current documentation:

- `packages/better-auth/typeorm-adapter/README.md`
- `docs/examples/better-auth-typeorm-adapter-composition.md`

Non-goals for v1:

- forcing reuse of arbitrary existing domain entities
- exposing Better Auth table models as shared domain contracts
- coupling the adapter to a single application architecture

### `@anarchitects/nest-angular-ssr`

Goal:
Provide a clean NestJS module and integration path for Angular SSR applications in modern Nx/Nest/Angular workspaces.

Current v1 surface:

- `NestAngularSsrModule.forRoot(...)` and `forRootAsync(...)`
- explicit `bootstrapNestAngularSsr(...)` wiring
- lower-level renderer, integration, and routing APIs for advanced composition
- Fastify-native static asset serving and SSR fallback routing
- validated direct consumption from CommonJS-oriented and ESM Nest apps

Non-goals for v1:

- recreating deprecated APIs exactly
- hiding all Angular SSR complexity
- supporting every legacy universal setup
- supporting non-Fastify Nest adapters

## Workspace Structure

Expected top-level layout:

```text
packages/
  better-auth/
    typeorm-adapter/
  nest/
    angular-ssr/
tools/
docs/
```

Recommended package layering:

- library source in packages/
- shared tooling in tools/
- design notes, ADRs, and package docs in docs/

## Quick Start

Install dependencies:

```bash
yarn install
```

List projects:

```bash
yarn nx show projects
```

Run tests for all packages:

```bash
yarn nx run-many -t test
```

Build all packages:

```bash
yarn nx run-many -t build
```

Lint all packages:

```bash
yarn nx run-many -t lint
```

## Suggested First Steps

1. Better Auth TypeORM Adapter

Start with:

- define package API surface
- document adapter ownership and schema boundaries
- model the minimum Better Auth persistence contract
- add integration tests against a real database
- keep extraction concerns secondary to correctness

Suggested early deliverables:

- adapter contract draft
- entity/schema strategy
- repository mapping layer
- smoke-tested login/session/account persistence flow

Key v1 references:

- `packages/better-auth/typeorm-adapter/README.md`
- `docs/examples/better-auth-typeorm-adapter-composition.md`

2. Nest Angular SSR Adapter

Current status:

- package implemented under `packages/nest/angular-ssr`
- Nest module facade, explicit bootstrap helper, and advanced composition entry points in place
- runtime behavior and CJS/ESM consumer validation implemented with fixture apps
- package-local documentation should be treated as the source of truth

Key v1 references:

- `packages/nest/angular-ssr/README.md`
- `docs/validation/nest-angular-ssr-consumers.md`

## Development Rules

- Keep packages independently publishable.
- Do not leak repo-internal implementation details into public exports.
- Prefer typed config and explicit module options.
- Add docs and tests with each public API addition.
- Treat examples as validation surfaces, not product packages.

## Relationship To Anarchitecture Bricks

This repo complements, but does not replace, the main Bricks monorepo.

General split:

- core domain bricks and app-facing contracts:
  - live in the main Bricks repo
- community integrations and extracted adapters:
  - live here

The Better Auth TypeORM adapter will be proven internally first, then matured here as a community package.
The Nest Angular SSR adapter is intended as a standalone community integration from the start.

## Status

Early-stage workspace.
APIs are expected to evolve quickly until the first stable package contracts are established.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
