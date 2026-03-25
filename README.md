# Anarchitects Community Adapters

Community-maintained integration packages for the Anarchitects ecosystem.

This workspace hosts adapters and bridge libraries that are useful around the Anarchitects Bricks architecture, but do not belong in the core Bricks monorepo.

## Initial Focus

This repo starts with two packages:

- `@anarchitects/better-auth-typeorm-adapter`
  - A Better Auth database adapter backed by TypeORM.
  - First target: support the auth-domain use case proven in the Bricks monorepo.
- `@anarchitects/nest-angular-ssr`
  - A NestJS integration package for Angular SSR.
  - Intended as a modern replacement path for the niche previously served by `@nestjs/ng-universal`.

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

Non-goals for v1:

- forcing reuse of arbitrary existing domain entities
- exposing Better Auth table models as shared domain contracts
- coupling the adapter to a single application architecture

### `@anarchitects/nest-angular-ssr`

Goal:
Provide a clean NestJS module and integration path for Angular SSR applications in modern Nx/Nest/Angular workspaces.

Initial expectations:

- bootstrap helpers for Angular SSR inside Nest
- configurable rendering pipeline
- support for easy-mode setup and advanced composition
- alignment with current Angular SSR and Nest modular patterns

Non-goals for v1:

- recreating deprecated APIs exactly
- hiding all Angular SSR complexity
- supporting every legacy universal setup

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

2. Nest Angular SSR Adapter

Start with:

- define easy-mode Nest module API
- define advanced composition entry points
- validate Angular SSR bootstrapping inside Nest
- add a minimal example app
- document supported rendering model and limitations

Suggested early deliverables:

- root module/facade
- config contract
- render service abstraction
- example Nest + Angular SSR integration

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
  -live in the main Bricks repo
- community integrations and extracted adapters:
  - live here

The Better Auth TypeORM adapter will be proven internally first, then matured here as a community package.
The Nest Angular SSR adapter is intended as a standalone community integration from the start.

## Status

Early-stage workspace.
APIs are expected to evolve quickly until the first stable package contracts are established.

## License

MIT
