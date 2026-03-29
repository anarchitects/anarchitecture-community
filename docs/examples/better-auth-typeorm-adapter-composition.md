# Better Auth TypeORM Adapter Composition Examples

This note holds the longer `@anarchitects/better-auth-typeorm-adapter` composition examples so the package README can stay focused on installation and setup.

The important boundary is the same in every example:

- this package provides the Better Auth database adapter
- host repos still own wrappers, dependency injection, migrations, and plugin choices

## Nest-Style Wrapper Example

This pattern fits a host repo that wants a Nest-facing composition layer without making Nest part of the adapter package itself.

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { createBetterAuthTypeormAdapter } from '@anarchitects/better-auth-typeorm-adapter';

import { AccountsEntity } from './entities/accounts.entity';
import { SessionsEntity } from './entities/sessions.entity';
import { UsersEntity } from './entities/users.entity';
import { VerificationsEntity } from './entities/verifications.entity';

@Injectable()
export class BetterAuthDatabaseFactory {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  createDatabase() {
    return createBetterAuthTypeormAdapter({
      dataSource: this.dataSource,
      models: {
        users: UsersEntity,
        accounts: AccountsEntity,
        sessions: SessionsEntity,
        verifications: VerificationsEntity,
      },
      adapterName: this.config.get('APP_NAME') ?? 'TypeORM',
    });
  }
}
```

```ts
import { betterAuth } from 'better-auth';

export function createAuth(database: ReturnType<BetterAuthDatabaseFactory['createDatabase']>) {
  return betterAuth({
    database,
    advanced: {
      database: {
        generateId: 'uuid',
      },
    },
    user: { modelName: 'users' },
    account: { modelName: 'accounts' },
    session: { modelName: 'sessions' },
    verification: { modelName: 'verifications' },
  });
}
```

Why this boundary is intentional:

- Nest owns the provider lifecycle and configuration
- the host repo owns entity imports and module wiring
- the adapter package stays unaware of Nest tokens, decorators, and DI policies

## DDD / Composition-Layer Example

This pattern fits a host repo that wants a small infrastructure composition function instead of a framework wrapper.

```ts
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import type { DataSource } from 'typeorm';

import { createBetterAuthTypeormAdapter } from '@anarchitects/better-auth-typeorm-adapter';

import { authPersistenceEntities } from './auth-persistence-entities';

export interface CreateAuthInfrastructureOptions {
  dataSource: DataSource;
  baseURL: string;
}

export function createAuthInfrastructure({
  dataSource,
  baseURL,
}: CreateAuthInfrastructureOptions) {
  const database = createBetterAuthTypeormAdapter({
    dataSource,
    models: authPersistenceEntities,
  });

  const auth = betterAuth({
    baseURL,
    database,
    advanced: {
      database: {
        generateId: 'uuid',
      },
    },
    user: { modelName: 'users' },
    account: { modelName: 'accounts' },
    session: { modelName: 'sessions' },
    verification: { modelName: 'verifications' },
  } satisfies BetterAuthOptions);

  return {
    auth,
    database,
  };
}
```

```ts
import { AccountsEntity } from './entities/accounts.entity';
import { SessionsEntity } from './entities/sessions.entity';
import { UsersEntity } from './entities/users.entity';
import { VerificationsEntity } from './entities/verifications.entity';

export const authPersistenceEntities = {
  users: UsersEntity,
  accounts: AccountsEntity,
  sessions: SessionsEntity,
  verifications: VerificationsEntity,
};
```

Why this boundary is intentional:

- the host repo can expose domain-oriented factories or ports
- Better Auth configuration remains app-owned
- the adapter package stays a persistence adapter, not an application architecture opinion

## What These Examples Deliberately Do Not Add

These examples are illustrative only. They do not introduce:

- a new Nest package
- a new DI abstraction in the adapter package
- generated entities or migrations
- app-specific controller, service, or mailer behavior

If a host repo wants stronger wrapper abstractions, that code should live in the host repo or in a separate package with its own public contract.
