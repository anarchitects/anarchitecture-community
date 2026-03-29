import type { BetterAuthOptions } from 'better-auth';
import type { DataSource, EntityManager } from 'typeorm';

type PersistenceMock = {
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  options: undefined;
};

const mocked = vi.hoisted(() => {
  const rootPersistence = createPersistenceMock();
  const transactionPersistence = createPersistenceMock();
  const transactionManager = {
    transaction: vi.fn(
      async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback({} as EntityManager),
    ),
  } as unknown as EntityManager & {
    transaction: ReturnType<typeof vi.fn>;
  };

  return {
    rootPersistence,
    transactionPersistence,
    transactionManager,
  };
});

vi.mock('./create-typeorm-persistence.js', () => ({
  createTypeormPersistence: vi.fn(({ manager }: { manager?: EntityManager }) =>
    manager === mocked.transactionManager
      ? mocked.transactionPersistence
      : mocked.rootPersistence,
  ),
}));

import { createTypeormPersistence } from './create-typeorm-persistence.js';
import { createBetterAuthTypeormDbAdapter } from './create-better-auth-typeorm-db-adapter.js';

function createPersistenceMock(): PersistenceMock {
  return {
    create: vi.fn(async ({ data }) => data),
    update: vi.fn(async ({ update }) => update),
    updateMany: vi.fn(async () => 1),
    findOne: vi.fn(async () => ({
      id: 'user_1',
      email_address: 'alice@example.com',
      member_name: 'Alice',
    })),
    findMany: vi.fn(async () => []),
    delete: vi.fn(async () => undefined),
    deleteMany: vi.fn(async () => 1),
    count: vi.fn(async () => 1),
    options: undefined,
  };
}

function resetPersistenceMocks() {
  mocked.rootPersistence.create = vi.fn(async ({ data }) => data);
  mocked.rootPersistence.update = vi.fn(async ({ update }) => update);
  mocked.rootPersistence.updateMany = vi.fn(async () => 1);
  mocked.rootPersistence.findOne = vi.fn(async () => ({
    id: 'user_1',
    email_address: 'alice@example.com',
    member_name: 'Alice',
  }));
  mocked.rootPersistence.findMany = vi.fn(async () => []);
  mocked.rootPersistence.delete = vi.fn(async () => undefined);
  mocked.rootPersistence.deleteMany = vi.fn(async () => 1);
  mocked.rootPersistence.count = vi.fn(async () => 1);

  mocked.transactionPersistence.create = vi.fn(async ({ data }) => data);
  mocked.transactionPersistence.update = vi.fn(async ({ update }) => update);
  mocked.transactionPersistence.updateMany = vi.fn(async () => 1);
  mocked.transactionPersistence.findOne = vi.fn(async () => null);
  mocked.transactionPersistence.findMany = vi.fn(async () => []);
  mocked.transactionPersistence.delete = vi.fn(async () => undefined);
  mocked.transactionPersistence.deleteMany = vi.fn(async () => 1);
  mocked.transactionPersistence.count = vi.fn(async () => 7);
}

describe('createBetterAuthTypeormDbAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPersistenceMocks();
  });

  it('uses Better Auth-transformed model and field names before reaching persistence', async () => {
    const dataSource = {
      manager: {} as EntityManager,
      transaction: vi.fn(),
    } as unknown as DataSource;

    const adapter = createBetterAuthTypeormDbAdapter(
      {
        dataSource,
        models: {
          members: 'UserEntity',
          loginAccounts: 'AccountEntity',
        },
      },
      {
        user: {
          modelName: 'members',
          fields: {
            email: 'email_address',
            name: 'member_name',
          },
        },
        account: {
          modelName: 'loginAccounts',
          fields: {
            userId: 'member_id',
          },
        },
      } as BetterAuthOptions,
    );

    await adapter.create({
      model: 'user',
      data: {
        name: 'Alice',
        email: 'alice@example.com',
      },
    });
    await adapter.findOne({
      model: 'user',
      where: [
        {
          field: 'email',
          operator: 'eq',
          value: 'alice@example.com',
        },
      ],
      select: ['email', 'name'],
    });
    await adapter.updateMany({
      model: 'account',
      where: [
        {
          field: 'userId',
          operator: 'eq',
          value: 'user_1',
        },
      ],
      update: {
        userId: 'user_2',
      },
    });
    await adapter.count({
      model: 'account',
      where: [
        {
          field: 'userId',
          operator: 'eq',
          value: 'user_2',
        },
      ],
    });
    await adapter.deleteMany({
      model: 'account',
      where: [
        {
          field: 'userId',
          operator: 'eq',
          value: 'user_2',
        },
      ],
    });

    expect(mocked.rootPersistence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'members',
        data: expect.objectContaining({
          email_address: 'alice@example.com',
          member_name: 'Alice',
        }),
      }),
    );
    expect(mocked.rootPersistence.findOne).toHaveBeenCalledWith({
      model: 'members',
      where: [
        {
          field: 'email_address',
          operator: 'eq',
          value: 'alice@example.com',
          connector: 'AND',
        },
      ],
      select: ['email_address', 'member_name'],
      join: undefined,
    });
    expect(mocked.rootPersistence.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'loginAccounts',
        where: [
          {
            field: 'member_id',
            operator: 'eq',
            value: 'user_1',
            connector: 'AND',
          },
        ],
        update: expect.objectContaining({
          member_id: 'user_2',
        }),
      }),
    );
    expect(mocked.rootPersistence.count).toHaveBeenCalledWith({
      model: 'loginAccounts',
      where: [
        {
          field: 'member_id',
          operator: 'eq',
          value: 'user_2',
          connector: 'AND',
        },
      ],
    });
    expect(mocked.rootPersistence.deleteMany).toHaveBeenCalledWith({
      model: 'loginAccounts',
      where: [
        {
          field: 'member_id',
          operator: 'eq',
          value: 'user_2',
          connector: 'AND',
        },
      ],
    });
  });

  it('supports optional plugin models through the caller-provided model map', async () => {
    const dataSource = {
      manager: {} as EntityManager,
      transaction: vi.fn(),
    } as unknown as DataSource;

    const adapter = createBetterAuthTypeormDbAdapter(
      {
        dataSource,
        models: {
          passkeys: 'PasskeyEntity',
        },
      },
      {
        plugins: [
          {
            id: 'passkey-plugin',
            schema: {
              passkey: {
                modelName: 'passkeys',
                fields: {
                  credentialID: {
                    type: 'string',
                    required: true,
                    fieldName: 'credential_id',
                  },
                },
              },
            },
          },
        ],
      } as BetterAuthOptions,
    );

    await adapter.findMany({
      model: 'passkey',
      limit: 5,
    });

    expect(mocked.rootPersistence.findMany).toHaveBeenCalledWith({
      model: 'passkeys',
      where: undefined,
      limit: 5,
      select: undefined,
      sortBy: undefined,
      offset: undefined,
      join: undefined,
    });
  });

  it('recreates a transaction-scoped adapter for Better Auth transaction callbacks', async () => {
    const dataSource = {
      manager: {} as EntityManager,
      transaction: vi.fn(
        async (callback: (manager: EntityManager) => Promise<unknown>) =>
          callback(mocked.transactionManager),
      ),
    } as unknown as DataSource & {
      transaction: ReturnType<typeof vi.fn>;
    };

    const adapter = createBetterAuthTypeormDbAdapter(
      {
        dataSource,
        models: {
          user: 'UserEntity',
        },
      },
      {} as BetterAuthOptions,
    );

    const result = await adapter.transaction(async (trx) => {
      await trx.count({ model: 'user' });
      return trx.id;
    });

    expect(result).toBe('typeorm');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(createTypeormPersistence).toHaveBeenCalledTimes(2);
    expect(createTypeormPersistence).toHaveBeenNthCalledWith(1, {
      dataSource,
      models: {
        user: 'UserEntity',
      },
      manager: undefined,
    });
    expect(createTypeormPersistence).toHaveBeenNthCalledWith(2, {
      dataSource,
      models: {
        user: 'UserEntity',
      },
      manager: mocked.transactionManager,
    });
    expect(mocked.transactionPersistence.count).toHaveBeenCalledWith({
      model: 'user',
      where: undefined,
    });
    expect(mocked.rootPersistence.count).not.toHaveBeenCalled();
  });
});
