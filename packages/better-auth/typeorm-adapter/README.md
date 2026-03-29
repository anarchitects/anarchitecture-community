# `@anarchitects/better-auth-typeorm-adapter`

Framework-neutral Better Auth database adapter infrastructure for TypeORM.

This README defines the v1 schema ownership and migration boundary for consumers of the package. It is intentionally focused on what schema shape the adapter expects, what the host application still owns, and what the package does not do for you automatically.

## Purpose

This package exists to turn a TypeORM `DataSource` plus a caller-provided model map into a Better Auth-compatible database adapter.

The public package boundary stays intentionally small:

- `createBetterAuthTypeormAdapter(...)`
- `BetterAuthTypeormAdapterOptions`
- caller-owned `models` map registration

This package is framework-neutral. It does not own Nest wrappers, app composition layers, or host-repo migrations.

## Ownership Model

The adapter is model-map driven, not schema-magic driven.

Consumers provide:

- their TypeORM `DataSource`
- their TypeORM entity classes
- their Better Auth model-to-entity map
- their migration strategy

The adapter provides:

- Better Auth adapter behavior over TypeORM
- model resolution through the provided `models` map
- field resolution through mapped entity metadata

The adapter does not:

- generate or own host-repo migrations
- infer a complete application schema automatically
- promise automatic reuse of arbitrary pre-existing domain entities
- turn Better Auth persistence tables into shared domain contracts

## Core Schema Expectations

The supported v1 scope assumes Better Auth-oriented tables and entities.

Consumers should model explicit Better Auth persistence entities for the core tables rather than expecting the adapter to map itself onto arbitrary existing application entities automatically.

### `users`

| Field | Expectation |
| --- | --- |
| `id` | Better Auth-facing user ID |
| `email` | User email |
| `name` | User display name |
| `emailVerified` | Email verification state |
| `image` | User profile image reference |
| `createdAt` | Creation timestamp |
| `updatedAt` | Last update timestamp |

### `accounts`

| Field | Expectation |
| --- | --- |
| `id` | Better Auth-facing account ID |
| `accountId` | Provider account identifier |
| `providerId` | Provider name or identifier |
| `userId` | Owning Better Auth user ID |
| `accessToken` | Provider access token when applicable |
| `refreshToken` | Provider refresh token when applicable |
| `idToken` | Provider ID token when applicable |
| `accessTokenExpiresAt` | Access token expiration timestamp when applicable |
| `refreshTokenExpiresAt` | Refresh token expiration timestamp when applicable |
| `scope` | Provider scope string when applicable |
| `password` | Password hash for credential-backed flows when applicable |
| `createdAt` | Creation timestamp |
| `updatedAt` | Last update timestamp |

### `sessions`

| Field | Expectation |
| --- | --- |
| `id` | Better Auth-facing session ID |
| `userId` | Owning Better Auth user ID |
| `expiresAt` | Session expiration timestamp |
| `token` | Session token |
| `ipAddress` | Client IP address when stored |
| `userAgent` | Client user agent when stored |
| `createdAt` | Creation timestamp |
| `updatedAt` | Last update timestamp |

### `verifications`

| Field | Expectation |
| --- | --- |
| `id` | Better Auth-facing verification ID |
| `identifier` | Verification subject identifier |
| `value` | Verification token or code value |
| `expiresAt` | Verification expiration timestamp |
| `createdAt` | Creation timestamp |
| `updatedAt` | Last update timestamp |

## Optional Plugin Models

Optional Better Auth plugin models are opt-in through the `models` map.

For example, a host application that enables passkeys may register a `passkeys` model in addition to the core models above. That remains optional plugin-owned scope, not part of the core v1 table story documented here.

This package does not decide which Better Auth plugins a host application uses.

## Model Naming and Field Transforms

Model resolution is explicit.

- Better Auth-facing model names are resolved through the caller-provided `models` map.
- Better Auth field transforms may differ from TypeORM property names.
- v1 assumes the adapter resolves fields through the mapped entity metadata rather than requiring identical property names and column names everywhere.
- Customization comes from Better Auth transforms plus the model map, not from hidden schema inference.

In practice, that means consumers stay responsible for registering the correct entity for each Better Auth model and for ensuring the mapped entity exposes the fields Better Auth expects for that model.

## IDs and Database Scope

The required v1 support scope is PostgreSQL.

Within that scope:

- Better Auth-facing IDs remain string-shaped at the API boundary.
- PostgreSQL `uuid` columns are a valid and recommended persistence choice.
- Numeric IDs are not part of the required v1 support claim.

Consumers may choose their own concrete PostgreSQL column definitions, but they remain responsible for keeping those choices compatible with Better Auth's string-oriented ID expectations.

## Migrations

Consumers own their migrations.

This package does not:

- generate TypeORM migrations for your application
- own migration files in your repository
- decide how your deployment pipeline applies schema changes

Better Auth CLI behavior for built-in adapters does not automatically become the migration workflow for this community adapter.

If you use this package, you still need to choose and maintain your own TypeORM migration strategy in your host repository.

## v1 Boundaries

This package is intentionally scoped.

It documents and targets:

- framework-neutral Better Auth adapter composition for TypeORM
- explicit Better Auth-oriented schema ownership
- explicit model-map registration
- PostgreSQL-backed v1 expectations

It does not document in this issue:

- framework wrapper examples
- illustrative entity class examples
- migration code snippets
- full setup walkthroughs

Those broader usage and integration examples belong to the package documentation work in `#12`.
