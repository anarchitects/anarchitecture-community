import { randomUUID } from 'node:crypto';

import type { CleanedWhere } from 'better-auth/adapters';
import type { DataSource } from 'typeorm';

import { createTypeormPersistence } from '../../src/lib/internal/create-typeorm-persistence.js';
import {
  AccountsEntity,
  AtomicCountersEntity,
  CORE_ENTITIES,
  SessionsEntity,
  UsersEntity,
  VerificationsEntity,
} from './entities.js';
import {
  destroyDataSource,
  startPostgresHarness,
  type PostgresHarness,
} from './harness.js';

function createTimestamp(day: number) {
  return new Date(`2025-01-${String(day).padStart(2, '0')}T12:00:00.000Z`);
}

describe('createTypeormPersistence PostgreSQL integration', () => {
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
    dataSource = await getHarness().createDataSource([...CORE_ENTITIES]);
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

  it('executes core CRUD behavior against the documented core tables', async () => {
    const persistence = createTypeormPersistence({
      dataSource: getDataSource(),
      models: {
        users: UsersEntity,
        accounts: AccountsEntity,
        sessions: SessionsEntity,
        verifications: VerificationsEntity,
      },
    });

    const userId = randomUUID();
    const sessionId = randomUUID();
    const verificationId = randomUUID();

    const createdUser = await persistence.create({
      model: 'users',
      data: {
        id: userId,
        email: 'alice@example.com',
        name: 'Alice',
        emailVerified: false,
        image: null,
        createdAt: createTimestamp(1),
        updatedAt: createTimestamp(1),
      },
      select: ['id', 'email', 'name'],
    });

    expect(createdUser).toEqual({
      id: userId,
      email: 'alice@example.com',
      name: 'Alice',
    });

    await persistence.create({
      model: 'sessions',
      data: {
        id: sessionId,
        userId,
        expiresAt: createTimestamp(10),
        token: 'session-token-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Vitest',
        createdAt: createTimestamp(1),
        updatedAt: createTimestamp(1),
      },
    });
    await persistence.create({
      model: 'verifications',
      data: {
        id: verificationId,
        identifier: 'alice@example.com',
        value: 'verify-token-1',
        expiresAt: createTimestamp(10),
        createdAt: createTimestamp(1),
        updatedAt: createTimestamp(1),
      },
    });

    const foundUser = await persistence.findOne({
      model: 'users',
      where: [
        {
          field: 'email',
          operator: 'eq',
          value: 'alice@example.com',
          connector: 'AND',
          mode: 'sensitive',
        },
      ],
    });

    expect(foundUser).toMatchObject({
      id: userId,
      email: 'alice@example.com',
      name: 'Alice',
      emailVerified: false,
    });

    const updatedUser = await persistence.update({
      model: 'users',
      where: [
        {
          field: 'id',
          operator: 'eq',
          value: userId,
          connector: 'AND',
          mode: 'sensitive',
        },
      ],
      update: {
        image: 'avatar-1.png',
      },
    });

    expect(updatedUser).toMatchObject({
      id: userId,
      image: 'avatar-1.png',
    });

    expect(
      await persistence.updateMany({
        model: 'sessions',
        where: [
          {
            field: 'userId',
            operator: 'eq',
            value: userId,
            connector: 'AND',
            mode: 'sensitive',
          },
        ],
        update: {
          userAgent: 'Updated Vitest',
        },
      }),
    ).toBe(1);

    expect(
      await persistence.count({
        model: 'sessions',
        where: [
          {
            field: 'userAgent',
            operator: 'eq',
            value: 'Updated Vitest',
            connector: 'AND',
            mode: 'sensitive',
          },
        ],
      }),
    ).toBe(1);

    await persistence.delete({
      model: 'verifications',
      where: [
        {
          field: 'id',
          operator: 'eq',
          value: verificationId,
          connector: 'AND',
          mode: 'sensitive',
        },
      ],
    });

    expect(
      await persistence.count({
        model: 'verifications',
      }),
    ).toBe(0);
  });

  it('supports where operators plus sort and pagination against PostgreSQL', async () => {
    const persistence = createTypeormPersistence({
      dataSource: getDataSource(),
      models: {
        users: UsersEntity,
      },
    });

    const usersRepository = getDataSource().getRepository(UsersEntity);

    await usersRepository.save([
      {
        id: randomUUID(),
        email: 'alice@example.com',
        name: 'Alice',
        emailVerified: true,
        image: null,
        createdAt: createTimestamp(1),
        updatedAt: createTimestamp(1),
      },
      {
        id: randomUUID(),
        email: 'bob@example.com',
        name: 'Bob',
        emailVerified: false,
        image: 'avatar-2.png',
        createdAt: createTimestamp(2),
        updatedAt: createTimestamp(2),
      },
      {
        id: randomUUID(),
        email: 'carol@example.com',
        name: 'Carol',
        emailVerified: false,
        image: 'avatar-3.png',
        createdAt: createTimestamp(3),
        updatedAt: createTimestamp(3),
      },
    ]);

    expect(
      await persistence.findMany({
        model: 'users',
        where: [
          {
            field: 'email',
            operator: 'contains',
            value: 'example',
            connector: 'AND',
            mode: 'sensitive',
          },
          {
            field: 'name',
            operator: 'starts_with',
            value: 'A',
            connector: 'OR',
            mode: 'sensitive',
          },
        ],
        limit: 10,
      }),
    ).toHaveLength(3);

    expect(
      await persistence.findMany({
        model: 'users',
        where: [
          {
            field: 'email',
            operator: 'ends_with',
            value: 'example.com',
            connector: 'AND',
            mode: 'sensitive',
          },
          {
            field: 'createdAt',
            operator: 'gt',
            value: createTimestamp(1),
            connector: 'AND',
            mode: 'sensitive',
          },
          {
            field: 'createdAt',
            operator: 'lte',
            value: createTimestamp(3),
            connector: 'AND',
            mode: 'sensitive',
          },
        ],
        limit: 10,
      }),
    ).toHaveLength(2);

    expect(
      await persistence.findMany({
        model: 'users',
        where: [
          {
            field: 'name',
            operator: 'ne',
            value: 'Alice',
            connector: 'AND',
            mode: 'sensitive',
          },
        ],
        limit: 10,
      }),
    ).toHaveLength(2);

    expect(
      await persistence.findMany({
        model: 'users',
        where: [
          {
            field: 'createdAt',
            operator: 'lt',
            value: createTimestamp(3),
            connector: 'AND',
            mode: 'sensitive',
          },
        ],
        limit: 10,
      }),
    ).toHaveLength(2);

    expect(
      await persistence.findMany({
        model: 'users',
        where: [
          {
            field: 'image',
            operator: 'eq',
            value: null,
            connector: 'AND',
            mode: 'sensitive',
          },
        ],
        limit: 10,
      }),
    ).toHaveLength(1);

    expect(
      await persistence.findMany({
        model: 'users',
        where: [
          {
            field: 'image',
            operator: 'ne',
            value: null,
            connector: 'AND',
            mode: 'sensitive',
          },
        ],
        limit: 10,
      }),
    ).toHaveLength(2);

    expect(
      await persistence.findMany({
        model: 'users',
        where: [
          {
            field: 'image',
            operator: 'in',
            value: [null, 'avatar-2.png'] as unknown as CleanedWhere['value'],
            connector: 'AND',
            mode: 'sensitive',
          },
        ],
        limit: 10,
      }),
    ).toHaveLength(2);

    expect(
      await persistence.findMany({
        model: 'users',
        where: [
          {
            field: 'image',
            operator: 'not_in',
            value: [null, 'avatar-2.png'] as unknown as CleanedWhere['value'],
            connector: 'AND',
            mode: 'sensitive',
          },
        ],
        limit: 10,
      }),
    ).toHaveLength(1);

    expect(
      await persistence.findMany({
        model: 'users',
        where: [
          {
            field: 'id',
            operator: 'in',
            value: [] as unknown as CleanedWhere['value'],
            connector: 'AND',
            mode: 'sensitive',
          },
        ],
        limit: 10,
      }),
    ).toHaveLength(0);

    expect(
      await persistence.findMany({
        model: 'users',
        where: [
          {
            field: 'id',
            operator: 'not_in',
            value: [] as unknown as CleanedWhere['value'],
            connector: 'AND',
            mode: 'sensitive',
          },
        ],
        limit: 10,
      }),
    ).toHaveLength(3);

    const pagedUsers = await persistence.findMany({
      model: 'users',
      limit: 1,
      offset: 1,
      sortBy: {
        field: 'createdAt',
        direction: 'desc',
      },
      select: ['email'],
    });

    expect(pagedUsers).toEqual([{ email: 'bob@example.com' }]);
  });

  it('hydrates one-to-one and one-to-many relations against live PostgreSQL data', async () => {
    const persistence = createTypeormPersistence({
      dataSource: getDataSource(),
      models: {
        users: UsersEntity,
        accounts: AccountsEntity,
      },
    });

    const userId = randomUUID();
    const accountId = randomUUID();

    await getDataSource()
      .getRepository(UsersEntity)
      .save({
        id: userId,
        email: 'joined@example.com',
        name: 'Joined User',
        emailVerified: true,
        image: null,
        createdAt: createTimestamp(1),
        updatedAt: createTimestamp(1),
      });
    await getDataSource()
      .getRepository(AccountsEntity)
      .save({
        id: accountId,
        issuer: 'https://github.com',
        accountId: 'github-user-1',
        providerId: 'github',
        userId,
        accessToken: null,
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
        password: null,
        createdAt: createTimestamp(1),
        updatedAt: createTimestamp(1),
      });

    const accountWithUser = await persistence.findOne<Record<string, unknown>>({
      model: 'accounts',
      where: [
        {
          field: 'id',
          operator: 'eq',
          value: accountId,
          connector: 'AND',
          mode: 'sensitive',
        },
      ],
      join: {
        users: {
          on: {
            from: 'userId',
            to: 'id',
          },
          relation: 'one-to-one',
          limit: 1,
        },
      },
    });

    expect(accountWithUser).toMatchObject({
      id: accountId,
      users: {
        id: userId,
        email: 'joined@example.com',
      },
    });

    const userWithAccounts = await persistence.findOne<Record<string, unknown>>(
      {
        model: 'users',
        where: [
          {
            field: 'id',
            operator: 'eq',
            value: userId,
            connector: 'AND',
            mode: 'sensitive',
          },
        ],
        join: {
          accounts: {
            on: {
              from: 'id',
              to: 'userId',
            },
            relation: 'one-to-many',
            limit: 10,
          },
        },
      },
    );

    expect(userWithAccounts).toMatchObject({
      id: userId,
      accounts: [
        {
          id: accountId,
          issuer: 'https://github.com',
          providerId: 'github',
        },
      ],
    });
  });

  it('serializes concurrent consumeOne and guarded incrementOne calls', async () => {
    const persistence = createTypeormPersistence({
      dataSource: getDataSource(),
      models: {
        verifications: VerificationsEntity,
        counters: AtomicCountersEntity,
      },
    });
    const verificationId = randomUUID();
    const counterId = randomUUID();

    await getDataSource()
      .getRepository(VerificationsEntity)
      .save({
        id: verificationId,
        identifier: 'single-use@example.com',
        value: 'single-use-token',
        expiresAt: createTimestamp(10),
        createdAt: createTimestamp(1),
        updatedAt: createTimestamp(1),
      });
    await getDataSource().getRepository(AtomicCountersEntity).save({
      id: counterId,
      remainingUses: 0,
      state: 'open',
      note: null,
    });

    const consumeResults = await Promise.all(
      Array.from({ length: 12 }, () =>
        persistence.consumeOne<Record<string, unknown>>({
          model: 'verifications',
          where: [
            {
              field: 'identifier',
              operator: 'eq',
              value: 'single-use@example.com',
              connector: 'AND',
              mode: 'sensitive',
            },
            {
              field: 'value',
              operator: 'eq',
              value: 'single-use-token',
              connector: 'AND',
              mode: 'sensitive',
            },
          ],
        }),
      ),
    );

    expect(consumeResults.filter((result) => result !== null)).toHaveLength(1);
    expect(consumeResults.find((result) => result !== null)).toMatchObject({
      id: verificationId,
      identifier: 'single-use@example.com',
    });
    expect(
      await getDataSource().getRepository(VerificationsEntity).count(),
    ).toBe(0);

    const incrementResults = await Promise.all(
      Array.from({ length: 20 }, () =>
        persistence.incrementOne<Record<string, unknown>>({
          model: 'counters',
          where: [
            {
              field: 'id',
              operator: 'eq',
              value: counterId,
              connector: 'AND',
              mode: 'sensitive',
            },
            {
              field: 'remaining_uses',
              operator: 'lt',
              value: 5,
              connector: 'AND',
              mode: 'sensitive',
            },
            {
              field: 'state_code',
              operator: 'eq',
              value: 'open',
              connector: 'AND',
              mode: 'sensitive',
            },
          ],
          increment: { remaining_uses: 1 },
          set: { note_text: 'updated atomically' },
        }),
      ),
    );

    expect(incrementResults.filter((result) => result !== null)).toHaveLength(
      5,
    );
    expect(
      await getDataSource()
        .getRepository(AtomicCountersEntity)
        .findOneByOrFail({
          id: counterId,
        }),
    ).toEqual({
      id: counterId,
      remainingUses: 5,
      state: 'open',
      note: 'updated atomically',
    });
  });

  it('rolls back atomic operations in nested manager-scoped transactions', async () => {
    const persistence = createTypeormPersistence({
      dataSource: getDataSource(),
      models: {
        verifications: VerificationsEntity,
        counters: AtomicCountersEntity,
      },
    });
    const verificationId = randomUUID();
    const counterId = randomUUID();

    await getDataSource()
      .getRepository(VerificationsEntity)
      .save({
        id: verificationId,
        identifier: 'rollback@example.com',
        value: 'rollback-token',
        expiresAt: createTimestamp(10),
        createdAt: createTimestamp(1),
        updatedAt: createTimestamp(1),
      });
    await getDataSource().getRepository(AtomicCountersEntity).save({
      id: counterId,
      remainingUses: 1,
      state: 'open',
      note: null,
    });

    await expect(
      persistence.transaction(async (transactionPersistence) => {
        await transactionPersistence.transaction(async (nestedPersistence) => {
          await nestedPersistence.consumeOne({
            model: 'verifications',
            where: [
              {
                field: 'id',
                operator: 'eq',
                value: verificationId,
                connector: 'AND',
                mode: 'sensitive',
              },
            ],
          });
          await nestedPersistence.incrementOne({
            model: 'counters',
            where: [
              {
                field: 'id',
                operator: 'eq',
                value: counterId,
                connector: 'AND',
                mode: 'sensitive',
              },
            ],
            increment: { remaining_uses: -1 },
          });
        });

        throw new Error('rollback atomic operations');
      }),
    ).rejects.toThrow('rollback atomic operations');

    expect(
      await getDataSource().getRepository(VerificationsEntity).countBy({
        id: verificationId,
      }),
    ).toBe(1);
    expect(
      await getDataSource()
        .getRepository(AtomicCountersEntity)
        .findOneByOrFail({
          id: counterId,
        }),
    ).toMatchObject({ remainingUses: 1 });
  });

  it('commits and rolls back transaction-scoped persistence operations', async () => {
    const persistence = createTypeormPersistence({
      dataSource: getDataSource(),
      models: {
        users: UsersEntity,
      },
    });

    const committedUserId = randomUUID();

    await persistence.transaction(async (trx) => {
      await trx.create({
        model: 'users',
        data: {
          id: committedUserId,
          email: 'committed@example.com',
          name: 'Committed User',
          emailVerified: true,
          image: null,
          createdAt: createTimestamp(1),
          updatedAt: createTimestamp(1),
        },
      });
    });

    await expect(
      persistence.transaction(async (trx) => {
        await trx.create({
          model: 'users',
          data: {
            id: randomUUID(),
            email: 'rolled-back@example.com',
            name: 'Rolled Back User',
            emailVerified: false,
            image: null,
            createdAt: createTimestamp(2),
            updatedAt: createTimestamp(2),
          },
        });

        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    expect(
      await persistence.count({
        model: 'users',
      }),
    ).toBe(1);
  });
});
