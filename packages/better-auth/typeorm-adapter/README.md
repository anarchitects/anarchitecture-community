# `@anarchitects/better-auth-typeorm-adapter`

Framework-neutral Better Auth database adapter infrastructure for TypeORM.

This package turns a TypeORM `DataSource` plus a caller-owned model map into a Better Auth database adapter. It is intended for host repositories that want Better Auth persistence over TypeORM without inheriting Nest-specific or app-specific integration code.

Longer wrapper and composition examples live in [`docs/examples/better-auth-typeorm-adapter-composition.md`](../../../docs/examples/better-auth-typeorm-adapter-composition.md).

## Purpose

This package is responsible for:

- adapting Better Auth database operations onto TypeORM
- resolving models through a caller-provided `models` map
- resolving fields through the mapped entity metadata
- staying framework-neutral so host repos keep their own wrappers

This package is not responsible for:

- generating or owning your TypeORM migrations
- reusing arbitrary existing app entities automatically
- choosing which Better Auth plugins your app enables
- exporting Nest providers, module wrappers, or repo-local helpers

## v1 Support

The validated v1 support claim for this package is:

- PostgreSQL only
- string-shaped IDs at the Better Auth API boundary
- PostgreSQL UUID-backed persistence
- JSON support on the supported PostgreSQL scope
- boolean support on the supported PostgreSQL scope
- date support on the supported PostgreSQL scope
- core Better Auth model support through the caller-owned `models` map

The package validation flow includes:

- `yarn nx lint better-auth-typeorm-adapter`
- `yarn nx test better-auth-typeorm-adapter`
- `yarn nx run better-auth-typeorm-adapter:test-postgres`
- `yarn nx run better-auth-typeorm-adapter:test-better-auth`

Deferred or unsupported for v1:

- numeric IDs
- arrays
- non-PostgreSQL database claims
- broad plugin-by-plugin compatibility claims

## Installation

Install the adapter plus its required Better Auth and TypeORM dependencies in your host repo:

```bash
yarn add @anarchitects/better-auth-typeorm-adapter better-auth typeorm pg
```

The package currently expects:

- Node.js `>=20`
- `better-auth` `^1.7.0`
- `typeorm` `^1.0.0`
- a PostgreSQL driver such as `pg`

CI permanently validates the lower TypeORM boundary (`1.0.0` on Node.js 20) and
the newest release allowed by `^1.0.0` (currently `1.1.0`, on Node.js 24).

## Public API

The public package surface is intentionally small:

```ts
import {
  createBetterAuthTypeormAdapter,
  type BetterAuthTypeormAdapterOptions,
  type BetterAuthTypeormModelMap,
} from '@anarchitects/better-auth-typeorm-adapter';
```

```ts
type BetterAuthTypeormModelMap = Record<string, EntityTarget<ObjectLiteral>>;

interface BetterAuthTypeormAdapterOptions {
  dataSource: DataSource;
  models: BetterAuthTypeormModelMap;
  adapterId?: string;
  adapterName?: string;
}

function createBetterAuthTypeormAdapter(
  options: BetterAuthTypeormAdapterOptions,
): BetterAuthOptions['database'];
```

`adapterId` and `adapterName` are optional metadata overrides. The package defaults remain PostgreSQL-oriented internally.

## Minimal Example

The example below uses `EntitySchema` to keep the setup framework-neutral and decorator-free. It shows the minimum moving parts:

- a PostgreSQL `DataSource`
- Better Auth-oriented persistence entities
- a caller-owned `models` map
- Better Auth configured with `createBetterAuthTypeormAdapter(...)`

```ts
import { betterAuth } from 'better-auth';
import { DataSource, EntitySchema } from 'typeorm';

import { createBetterAuthTypeormAdapter } from '@anarchitects/better-auth-typeorm-adapter';

const UsersEntity = new EntitySchema({
  name: 'UsersEntity',
  tableName: 'users',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    email: { type: 'varchar', unique: true },
    name: { type: 'varchar' },
    emailVerified: { type: 'boolean' },
    image: { type: 'varchar', nullable: true },
    createdAt: { type: 'timestamptz' },
    updatedAt: { type: 'timestamptz' },
  },
});

const AccountsEntity = new EntitySchema({
  name: 'AccountsEntity',
  tableName: 'accounts',
  indices: [
    {
      name: 'uq_accounts_issuer_account_id',
      columns: ['issuer', 'accountId'],
      unique: true,
    },
  ],
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    issuer: { type: 'varchar' },
    accountId: { type: 'varchar' },
    providerId: { type: 'varchar' },
    userId: { type: 'uuid' },
    accessToken: { type: 'varchar', nullable: true },
    refreshToken: { type: 'varchar', nullable: true },
    idToken: { type: 'varchar', nullable: true },
    accessTokenExpiresAt: { type: 'timestamptz', nullable: true },
    refreshTokenExpiresAt: { type: 'timestamptz', nullable: true },
    scope: { type: 'varchar', nullable: true },
    password: { type: 'varchar', nullable: true },
    createdAt: { type: 'timestamptz' },
    updatedAt: { type: 'timestamptz' },
  },
});

const SessionsEntity = new EntitySchema({
  name: 'SessionsEntity',
  tableName: 'sessions',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    userId: { type: 'uuid' },
    expiresAt: { type: 'timestamptz' },
    token: { type: 'varchar', unique: true },
    ipAddress: { type: 'varchar', nullable: true },
    userAgent: { type: 'varchar', nullable: true },
    createdAt: { type: 'timestamptz' },
    updatedAt: { type: 'timestamptz' },
  },
});

const VerificationsEntity = new EntitySchema({
  name: 'VerificationsEntity',
  tableName: 'verifications',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    identifier: { type: 'varchar' },
    value: { type: 'varchar' },
    expiresAt: { type: 'timestamptz' },
    createdAt: { type: 'timestamptz' },
    updatedAt: { type: 'timestamptz' },
  },
});

export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [UsersEntity, AccountsEntity, SessionsEntity, VerificationsEntity],
});

await dataSource.initialize();

export const auth = betterAuth({
  database: createBetterAuthTypeormAdapter({
    dataSource,
    models: {
      users: UsersEntity,
      accounts: AccountsEntity,
      sessions: SessionsEntity,
      verifications: VerificationsEntity,
    },
  }),
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
  user: {
    modelName: 'users',
  },
  account: {
    modelName: 'accounts',
  },
  session: {
    modelName: 'sessions',
  },
  verification: {
    modelName: 'verifications',
  },
});
```

## `DataSource` Expectations

Your host repository owns the `DataSource`.

Recommended expectations for v1:

- initialize the `DataSource` before Better Auth starts using it
- register explicit Better Auth persistence entities in that `DataSource`
- target PostgreSQL
- prefer UUID-backed primary keys for Better Auth persistence tables

This package does not create or configure the `DataSource` for you.

## Model Map Expectations

The adapter is model-map driven.

You must provide a `models` map that matches the Better Auth model names your configuration uses. In the minimal example above, Better Auth is configured to use plural model names, so the `models` map uses:

- `users`
- `accounts`
- `sessions`
- `verifications`

If your Better Auth configuration uses singular names or plugin-specific names, the `models` map must match those names instead.

Field handling is also explicit:

- Better Auth field names may differ from TypeORM property names
- the adapter resolves fields through mapped entity metadata
- customization comes from Better Auth model/field transforms plus the `models` map

## Schema Ownership

The supported v1 scope assumes Better Auth-oriented tables and entities.

Consumers should model explicit Better Auth persistence entities for the core tables rather than expecting the adapter to map itself onto arbitrary existing application entities automatically.

### `users`

| Field           | Expectation                  |
| --------------- | ---------------------------- |
| `id`            | Better Auth-facing user ID   |
| `email`         | User email                   |
| `name`          | User display name            |
| `emailVerified` | Email verification state     |
| `image`         | User profile image reference |
| `createdAt`     | Creation timestamp           |
| `updatedAt`     | Last update timestamp        |

### `accounts`

| Field                   | Expectation                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| `id`                    | Better Auth-facing account ID                                       |
| `issuer`                | Stable identity namespace; `local:credential` for password accounts |
| `accountId`             | Provider account identifier                                         |
| `providerId`            | Provider name or identifier                                         |
| `userId`                | Owning Better Auth user ID                                          |
| `accessToken`           | Provider access token when applicable                               |
| `refreshToken`          | Provider refresh token when applicable                              |
| `idToken`               | Provider ID token when applicable                                   |
| `accessTokenExpiresAt`  | Access token expiration timestamp when applicable                   |
| `refreshTokenExpiresAt` | Refresh token expiration timestamp when applicable                  |
| `scope`                 | Provider scope string when applicable                               |
| `password`              | Password hash for credential-backed flows when applicable           |
| `createdAt`             | Creation timestamp                                                  |
| `updatedAt`             | Last update timestamp                                               |

Account identity is the unique pair `(issuer, accountId)`, not `providerId` and
`accountId`. Define a database-level unique constraint for that pair. Better Auth
uses `local:credential` as the issuer for email/password credential accounts.

### `sessions`

| Field       | Expectation                   |
| ----------- | ----------------------------- |
| `id`        | Better Auth-facing session ID |
| `userId`    | Owning Better Auth user ID    |
| `expiresAt` | Session expiration timestamp  |
| `token`     | Session token                 |
| `ipAddress` | Client IP address when stored |
| `userAgent` | Client user agent when stored |
| `createdAt` | Creation timestamp            |
| `updatedAt` | Last update timestamp         |

### `verifications`

| Field        | Expectation                        |
| ------------ | ---------------------------------- |
| `id`         | Better Auth-facing verification ID |
| `identifier` | Verification subject identifier    |
| `value`      | Verification token or code value   |
| `expiresAt`  | Verification expiration timestamp  |
| `createdAt`  | Creation timestamp                 |
| `updatedAt`  | Last update timestamp              |

## Migration Ownership

Host repositories own their migrations.

This package does not:

- generate TypeORM migrations for your application
- own migration files in your repository
- decide how your deployment pipeline applies schema changes

Better Auth CLI behavior for built-in adapters does not automatically become the migration workflow for this community adapter.

If you use this package, you still need to choose and maintain your own TypeORM migration strategy in your host repository.

### Better Auth 1.7 account migration

Before enabling Better Auth 1.7, the host must migrate existing account rows in
this order:

1. Add `issuer` as nullable.
2. Backfill every existing account with a verified stable issuer. Credential
   accounts use `local:credential`; OAuth/OIDC issuers must come from trusted
   provider data or an explicitly chosen host-owned namespace.
3. Resolve any duplicate `(issuer, accountId)` pairs.
4. Make `issuer` `NOT NULL`.
5. Add the unique constraint on `(issuer, accountId)`.

Do not infer a generic issuer for existing social accounts without validating the
provider and tenant semantics. The adapter deliberately does not mutate host-owned
schemas or perform this backfill.

## TypeORM 1.x compatibility boundary

The adapter uses only TypeORM 1.x public APIs: `DataSource`, `EntityManager`,
repositories, entity metadata, and query builders. It does not import TypeORM
internals or use legacy `Connection`, global/named connections, `.connection`, or
removed find-option compatibility APIs.

EntitySchema metadata drives every field translation, including differing property
and database names for select, sort, update, predicates, joins, and PostgreSQL
`RETURNING` results. The test matrix covers a single primary key, UUIDs, booleans,
JSONB, nullable values, `timestamptz`, all supported Better Auth operators, explicit
`IS NULL`/`IS NOT NULL`, partial selection with pagination, repository writes and
rereads, and root plus manager-scoped transactions.

`consumeOne` and `incrementOne` are implemented as one PostgreSQL statement using a
locked, single-row CTE and `RETURNING`. Their full `where` clauses are selectors and
guards; empty mutation criteria are safe no-ops. Concurrent callers therefore
cannot consume a verification twice, lose counter increments, or update after a
guard stops matching.

## Optional Plugin Models

Optional Better Auth plugin models are opt-in through the `models` map.

For example, if your host application enables passkeys, you can register a plugin-specific model alongside the core models:

```ts
createBetterAuthTypeormAdapter({
  dataSource,
  models: {
    users: UsersEntity,
    accounts: AccountsEntity,
    sessions: SessionsEntity,
    verifications: VerificationsEntity,
    passkeys: PasskeysEntity,
  },
});
```

This package does not decide which Better Auth plugins a host application uses, and it does not claim broad plugin-by-plugin certification in v1.

## Wrapper Boundary

This package is the Better Auth adapter. Host repos still own:

- framework-specific wrappers
- dependency injection and module wiring
- application-specific auth services and routes
- entity registration choices
- plugin enablement choices
- migration workflows

Short wrapper/composition examples for Nest-style and DDD-style host repos live in [`docs/examples/better-auth-typeorm-adapter-composition.md`](../../../docs/examples/better-auth-typeorm-adapter-composition.md).

## Limitations

The current v1 boundary is intentionally narrow:

- PostgreSQL is the only required supported database target
- Better Auth-facing IDs stay string-shaped at the API boundary
- PostgreSQL UUID columns are valid and recommended
- numeric IDs are outside the required v1 support claim
- arrays are outside the required v1 support claim
- framework wrappers remain host-repo concerns

The package is intended to be externally usable without private repo knowledge, but it is still intentionally strict about ownership boundaries.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
