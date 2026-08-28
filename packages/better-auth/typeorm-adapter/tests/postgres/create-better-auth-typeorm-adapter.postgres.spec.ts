import { randomUUID } from 'node:crypto';

import type { BetterAuthOptions } from 'better-auth';
import type { DBTransactionAdapter } from 'better-auth/adapters';
import type { DataSource } from 'typeorm';

import { createBetterAuthTypeormAdapter } from '../../src/index.js';
import {
  AppAccountsEntity,
  AppUsersEntity,
  TRANSFORMED_ENTITIES,
} from './entities.js';
import {
  destroyDataSource,
  startPostgresHarness,
  type PostgresHarness,
} from './harness.js';

function createTimestamp(day: number) {
  return new Date(`2025-02-${String(day).padStart(2, '0')}T12:00:00.000Z`);
}

function createBetterAuthPostgresOptions(): BetterAuthOptions {
  return {
    user: {
      modelName: 'appUsers',
      fields: {
        email: 'email_address',
        name: 'full_name',
        emailVerified: 'email_verified',
        image: 'profile_image',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    account: {
      modelName: 'appAccounts',
      fields: {
        issuer: 'issuer_url',
        accountId: 'provider_account_id',
        providerId: 'provider_name',
        userId: 'owner_user_id',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    advanced: {
      database: {
        generateId: () => randomUUID(),
      },
    },
  } as BetterAuthOptions;
}

describe('createBetterAuthTypeormAdapter PostgreSQL integration', () => {
  let harness: PostgresHarness | null = null;
  let dataSource: DataSource | null = null;

  function getHarness() {
    if (!harness) {
      throw new Error('PostgreSQL harness is not initialized.');
    }

    return harness;
  }

  function getDataSource() {
    if (!dataSource) {
      throw new Error('PostgreSQL data source is not initialized.');
    }

    return dataSource;
  }

  beforeAll(async () => {
    harness = await startPostgresHarness();
  });

  beforeEach(async () => {
    dataSource = await getHarness().createDataSource([...TRANSFORMED_ENTITIES]);
  });

  afterEach(async () => {
    await destroyDataSource(dataSource);
    dataSource = null;
  });

  afterAll(async () => {
    if (harness) {
      await harness.stop();
    }
  });

  it('persists through the public Better Auth adapter with transformed model and field names', async () => {
    const database = createBetterAuthTypeormAdapter({
      dataSource: getDataSource(),
      models: {
        appUsers: AppUsersEntity,
        appAccounts: AppAccountsEntity,
      },
    });
    const adapter = database(createBetterAuthPostgresOptions());

    const createdUser = await adapter.create<{
      id: string;
      email: string;
      name: string;
    }>({
      model: 'user',
      data: {
        email: 'adapter@example.com',
        name: 'Adapter User',
      },
      select: ['id', 'email', 'name'],
    });

    expect(createdUser).toMatchObject({
      email: 'adapter@example.com',
      name: 'Adapter User',
    });

    const foundUser = await adapter.findOne<{
      id: string;
      email: string;
      name: string;
    }>({
      model: 'user',
      where: [
        {
          field: 'email',
          operator: 'eq',
          value: 'adapter@example.com',
        },
      ],
      select: ['id', 'email', 'name'],
    });

    expect(foundUser).toEqual(createdUser);

    const storedUser = await getDataSource()
      .getRepository(AppUsersEntity)
      .findOneByOrFail({
        id: createdUser.id,
      });

    expect(storedUser).toMatchObject({
      emailAddress: 'adapter@example.com',
      fullName: 'Adapter User',
    });

    await expect(
      adapter.transaction(
        async (trx: DBTransactionAdapter<BetterAuthOptions>) => {
          await trx.create({
            model: 'account',
            data: {
              issuer: 'https://github.com',
              accountId: 'provider-user-1',
              providerId: 'github',
              userId: createdUser.id,
              createdAt: createTimestamp(1),
              updatedAt: createTimestamp(1),
            },
          });

          throw new Error('rollback');
        },
      ),
    ).rejects.toThrow('rollback');

    expect(await getDataSource().getRepository(AppAccountsEntity).count()).toBe(
      0,
    );

    await adapter.transaction(
      async (trx: DBTransactionAdapter<BetterAuthOptions>) => {
        await trx.create({
          model: 'account',
          data: {
            issuer: 'https://github.com',
            accountId: 'provider-user-2',
            providerId: 'github',
            userId: createdUser.id,
            createdAt: createTimestamp(2),
            updatedAt: createTimestamp(2),
          },
        });
      },
    );

    const storedAccount = await getDataSource()
      .getRepository(AppAccountsEntity)
      .findOneByOrFail({ providerAccountId: 'provider-user-2' });

    expect(storedAccount).toMatchObject({
      trustedIssuer: 'https://github.com',
      providerAccountId: 'provider-user-2',
      providerName: 'github',
    });
  });
});
