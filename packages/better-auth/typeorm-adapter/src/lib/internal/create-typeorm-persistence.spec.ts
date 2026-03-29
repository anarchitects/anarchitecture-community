import type { CleanedWhere, JoinConfig } from 'better-auth/adapters';
import type {
  DataSource,
  EntityManager,
  EntityTarget,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { createTypeormPersistence } from './create-typeorm-persistence.js';

type FakeColumn = {
  propertyName: string;
  propertyPath: string;
  databaseName: string;
  databasePath: string;
};

type QueryExecution = {
  one?: ObjectLiteral | null;
  many?: ObjectLiteral[];
  count?: number;
  affected?: number;
};

class FakeQueryBuilder {
  readonly whereCalls: Array<{
    kind: 'where' | 'andWhere' | 'orWhere';
    expression: string;
    parameters: Record<string, unknown>;
  }> = [];

  readonly selects: string[][] = [];
  readonly orderBys: Array<{ field: string; direction: 'ASC' | 'DESC' }> = [];
  readonly takes: number[] = [];
  readonly skips: number[] = [];
  readonly sets: Record<string, unknown>[] = [];
  readonly modes: string[] = [];
  readonly executions: QueryExecution[];

  constructor(executions: QueryExecution[]) {
    this.executions = [...executions];
  }

  where(expression: string, parameters: Record<string, unknown> = {}) {
    this.whereCalls.push({ kind: 'where', expression, parameters });
    return this;
  }

  andWhere(expression: string, parameters: Record<string, unknown> = {}) {
    this.whereCalls.push({ kind: 'andWhere', expression, parameters });
    return this;
  }

  orWhere(expression: string, parameters: Record<string, unknown> = {}) {
    this.whereCalls.push({ kind: 'orWhere', expression, parameters });
    return this;
  }

  select(selection: string[]) {
    this.selects.push(selection);
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC') {
    this.orderBys.push({ field, direction });
    return this;
  }

  take(limit: number) {
    this.takes.push(limit);
    return this;
  }

  skip(offset: number) {
    this.skips.push(offset);
    return this;
  }

  update() {
    this.modes.push('update');
    return this;
  }

  delete() {
    this.modes.push('delete');
    return this;
  }

  set(update: Record<string, unknown>) {
    this.sets.push(update);
    return this;
  }

  async getOne() {
    return this.executions.shift()?.one ?? null;
  }

  async getMany() {
    return this.executions.shift()?.many ?? [];
  }

  async getCount() {
    return this.executions.shift()?.count ?? 0;
  }

  async execute() {
    const execution = this.executions.shift();
    return { affected: execution?.affected ?? 0 };
  }
}

function createFakeRepository(options: {
  metadataName: string;
  columns?: FakeColumn[];
  primaryColumns?: FakeColumn[];
  queryExecutions?: QueryExecution[][];
  saveResult?: ObjectLiteral;
}) {
  const columns =
    options.columns ??
    [
      {
        propertyName: 'id',
        propertyPath: 'id',
        databaseName: 'id',
        databasePath: 'id',
      },
      {
        propertyName: 'email',
        propertyPath: 'email',
        databaseName: 'email_address',
        databasePath: 'email_address',
      },
      {
        propertyName: 'userId',
        propertyPath: 'userId',
        databaseName: 'user_id',
        databasePath: 'user_id',
      },
      {
        propertyName: 'createdAt',
        propertyPath: 'createdAt',
        databaseName: 'created_at',
        databasePath: 'created_at',
      },
    ];

  const queryBuilders: FakeQueryBuilder[] = [];
  const createMock = vi.fn((entity: Record<string, unknown>) => ({ ...entity }));
  const saveMock = vi.fn(async (entity: ObjectLiteral) => options.saveResult ?? entity);
  const mergeMock = vi.fn((entity: ObjectLiteral, update: Record<string, unknown>) => ({
    ...entity,
    ...update,
  }));
  const createQueryBuilderMock = vi.fn(() => {
    const builder = new FakeQueryBuilder(
      options.queryExecutions?.shift() ?? [{ many: [] }],
    );
    queryBuilders.push(builder);
    return builder as unknown as SelectQueryBuilder<ObjectLiteral>;
  });

  const repository = {
    target: options.metadataName as EntityTarget<ObjectLiteral>,
    metadata: {
      name: options.metadataName,
      columns,
      primaryColumns:
        options.primaryColumns ??
        [
          {
            propertyName: 'id',
            propertyPath: 'id',
            databaseName: 'id',
            databasePath: 'id',
          },
        ],
    } as unknown as Repository<ObjectLiteral>['metadata'],
    create: createMock,
    save: saveMock,
    merge: mergeMock,
    createQueryBuilder: createQueryBuilderMock,
  };

  return {
    repository: repository as unknown as Repository<ObjectLiteral>,
    queryBuilders,
    metadata: repository.metadata,
    createMock,
    saveMock,
    mergeMock,
    createQueryBuilderMock,
  };
}

function createFakeManager(
  repositories: Record<string, ReturnType<typeof createFakeRepository>>,
) {
  const manager = {
    getRepository: vi.fn((target: EntityTarget<ObjectLiteral>) => {
      const repository = repositories[String(target)];
      if (!repository) {
        throw new Error(`Unknown repository target ${String(target)}`);
      }
      return repository.repository;
    }),
    transaction: vi.fn(async (callback: (manager: EntityManager) => Promise<unknown>) =>
      callback(manager as unknown as EntityManager),
    ),
  };

  return manager as unknown as EntityManager & {
    getRepository: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
}

function createFakeDataSource(manager: EntityManager) {
  return {
    manager,
    transaction: vi.fn(
      async (callback: (manager: EntityManager) => Promise<unknown>) =>
      callback(manager),
    ),
  } as unknown as DataSource & {
    transaction: ReturnType<typeof vi.fn>;
  };
}

describe('createTypeormPersistence', () => {
  it('creates records by mapping transformed fields to entity properties', async () => {
    const userRepository = createFakeRepository({
      metadataName: 'UserEntity',
      saveResult: {
        id: 'user_1',
        email: 'alice@example.com',
      },
    });
    const manager = createFakeManager({ UserEntity: userRepository });
    const dataSource = createFakeDataSource(manager);
    const persistence = createTypeormPersistence({
      dataSource,
      manager,
      models: { user: 'UserEntity' },
    });

    const created = await persistence.create({
      model: 'user',
      data: {
        id: 'user_1',
        email_address: 'alice@example.com',
      },
      select: ['id', 'email_address'],
    });

    expect(userRepository.createMock).toHaveBeenCalledWith({
      id: 'user_1',
      email: 'alice@example.com',
    });
    expect(created).toEqual({
      id: 'user_1',
      email_address: 'alice@example.com',
    });
  });

  it('resolves fields by property or database column name and applies sort and pagination', async () => {
    const userRepository = createFakeRepository({
      metadataName: 'UserEntity',
      queryExecutions: [[{ many: [{ id: 'user_1', email: 'alice@example.com' }] }]],
    });
    const manager = createFakeManager({ UserEntity: userRepository });
    const dataSource = createFakeDataSource(manager);
    const persistence = createTypeormPersistence({
      dataSource,
      manager,
      models: { user: 'UserEntity' },
    });

    const records = await persistence.findMany({
      model: 'user',
      where: [
        {
          field: 'email_address',
          operator: 'eq',
          value: 'alice@example.com',
          connector: 'AND',
        },
      ],
      limit: 10,
      offset: 5,
      sortBy: {
        field: 'email',
        direction: 'desc',
      },
      select: ['id', 'email_address'],
    });

    expect(records).toEqual([
      {
        id: 'user_1',
        email_address: 'alice@example.com',
      },
    ]);
    expect(userRepository.queryBuilders[0]?.whereCalls[0]?.expression).toContain(
      'entity.email =',
    );
    expect(userRepository.queryBuilders[0]?.orderBys).toEqual([
      { field: 'entity.email', direction: 'DESC' },
    ]);
    expect(userRepository.queryBuilders[0]?.takes).toEqual([10]);
    expect(userRepository.queryBuilders[0]?.skips).toEqual([5]);
  });

  it('throws explicit errors for missing models and unresolved fields', async () => {
    const manager = createFakeManager({});
    const dataSource = createFakeDataSource(manager);
    const persistence = createTypeormPersistence({
      dataSource,
      manager,
      models: {},
    });

    await expect(
      persistence.findMany({
        model: 'user',
        limit: 10,
      }),
    ).rejects.toThrow('No TypeORM entity mapping was registered');

    const userRepository = createFakeRepository({
      metadataName: 'UserEntity',
    });
    const managerWithRepository = createFakeManager({ UserEntity: userRepository });
    const persistenceWithRepository = createTypeormPersistence({
      dataSource: createFakeDataSource(managerWithRepository),
      manager: managerWithRepository,
      models: { user: 'UserEntity' },
    });

    await expect(
      persistenceWithRepository.findMany({
        model: 'user',
        limit: 10,
        where: [
          {
            field: 'missing_field',
            operator: 'eq',
            value: 'x',
            connector: 'AND',
          },
        ],
      }),
    ).rejects.toThrow('Could not resolve field "missing_field"');
  });

  it('applies every supported where operator and preserves connector order', async () => {
    const userRepository = createFakeRepository({
      metadataName: 'UserEntity',
      queryExecutions: [[{ many: [] }]],
    });
    const manager = createFakeManager({ UserEntity: userRepository });
    const dataSource = createFakeDataSource(manager);
    const persistence = createTypeormPersistence({
      dataSource,
      manager,
      models: { user: 'UserEntity' },
    });

    const where: CleanedWhere[] = [
      { field: 'email_address', operator: 'eq', value: 'alice', connector: 'AND' },
      { field: 'email_address', operator: 'ne', value: 'bob', connector: 'OR' },
      { field: 'id', operator: 'lt', value: 10, connector: 'AND' },
      { field: 'id', operator: 'lte', value: 11, connector: 'AND' },
      { field: 'id', operator: 'gt', value: 12, connector: 'AND' },
      { field: 'id', operator: 'gte', value: 13, connector: 'AND' },
      {
        field: 'email_address',
        operator: 'in',
        value: ['alice', null, 'bob'] as unknown as CleanedWhere['value'],
        connector: 'AND',
      },
      {
        field: 'email_address',
        operator: 'not_in',
        value: ['carol', null, 'dave'] as unknown as CleanedWhere['value'],
        connector: 'AND',
      },
      {
        field: 'email_address',
        operator: 'contains',
        value: 'example',
        connector: 'AND',
      },
      {
        field: 'email_address',
        operator: 'starts_with',
        value: 'alice',
        connector: 'AND',
      },
      {
        field: 'email_address',
        operator: 'ends_with',
        value: '.com',
        connector: 'AND',
      },
      { field: 'created_at', operator: 'eq', value: null, connector: 'AND' },
      { field: 'created_at', operator: 'ne', value: null, connector: 'AND' },
    ];

    await persistence.findMany({
      model: 'user',
      where,
      limit: 25,
    });

    const expressions = userRepository.queryBuilders[0]?.whereCalls.map(
      (call) => `${call.kind}:${call.expression}`,
    );

    expect(expressions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('where:entity.email ='),
        expect.stringContaining('orWhere:entity.email !='),
        expect.stringContaining('andWhere:entity.id <'),
        expect.stringContaining('andWhere:entity.id <='),
        expect.stringContaining('andWhere:entity.id >'),
        expect.stringContaining('andWhere:entity.id >='),
        expect.stringContaining('andWhere:(entity.email IN'),
        expect.stringContaining('andWhere:(entity.email NOT IN'),
        expect.stringContaining('andWhere:entity.email LIKE'),
        expect.stringContaining('andWhere:entity.createdAt IS NULL'),
        expect.stringContaining('andWhere:entity.createdAt IS NOT NULL'),
      ]),
    );
  });

  it('handles empty in and not_in semantics explicitly', async () => {
    const userRepository = createFakeRepository({
      metadataName: 'UserEntity',
      queryExecutions: [[{ many: [] }], [{ many: [] }]],
    });
    const manager = createFakeManager({ UserEntity: userRepository });
    const dataSource = createFakeDataSource(manager);
    const persistence = createTypeormPersistence({
      dataSource,
      manager,
      models: { user: 'UserEntity' },
    });

    await persistence.findMany({
      model: 'user',
      where: [
        { field: 'id', operator: 'in', value: [], connector: 'AND' },
      ],
      limit: 5,
    });

    await persistence.findMany({
      model: 'user',
      where: [
        { field: 'id', operator: 'not_in', value: [], connector: 'AND' },
      ],
      limit: 5,
    });

    expect(userRepository.queryBuilders[0]?.whereCalls[0]?.expression).toBe('1 = 0');
    expect(userRepository.queryBuilders[1]?.whereCalls[0]?.expression).toBe('1 = 1');
  });

  it('updates deterministically by reading, saving, and rereading the entity', async () => {
    const userRepository = createFakeRepository({
      metadataName: 'UserEntity',
      queryExecutions: [
        [{ one: { id: 'user_1', email: 'alice@example.com' } }],
        [{ one: { id: 'user_1', email: 'updated@example.com' } }],
      ],
    });
    const manager = createFakeManager({ UserEntity: userRepository });
    const dataSource = createFakeDataSource(manager);
    const persistence = createTypeormPersistence({
      dataSource,
      manager,
      models: { user: 'UserEntity' },
    });

    const updated = await persistence.update({
      model: 'user',
      where: [
        {
          field: 'id',
          operator: 'eq',
          value: 'user_1',
          connector: 'AND',
        },
      ],
      update: {
        email_address: 'updated@example.com',
      },
    });

    expect(userRepository.saveMock).toHaveBeenCalledWith({
      id: 'user_1',
      email: 'updated@example.com',
    });
    expect(updated).toEqual({
      id: 'user_1',
      email_address: 'updated@example.com',
    });
  });

  it('throws for unsupported primary-key situations during deterministic updates', async () => {
    const userRepository = createFakeRepository({
      metadataName: 'UserEntity',
      primaryColumns: [
        {
          propertyName: 'id',
          propertyPath: 'id',
          databaseName: 'id',
          databasePath: 'id',
        },
        {
          propertyName: 'tenantId',
          propertyPath: 'tenantId',
          databaseName: 'tenant_id',
          databasePath: 'tenant_id',
        },
      ],
      queryExecutions: [[{ one: { id: 'user_1', tenantId: 'tenant_1' } }]],
    });
    const manager = createFakeManager({ UserEntity: userRepository });
    const persistence = createTypeormPersistence({
      dataSource: createFakeDataSource(manager),
      manager,
      models: { user: 'UserEntity' },
    });

    await expect(
      persistence.update({
        model: 'user',
        where: [
          {
            field: 'id',
            operator: 'eq',
            value: 'user_1',
            connector: 'AND',
          },
        ],
        update: {
          email_address: 'updated@example.com',
        },
      }),
    ).rejects.toThrow(
      'Better Auth TypeORM persistence currently requires a single primary column',
    );
  });

  it('returns counts and affected rows for bulk operations', async () => {
    const userRepository = createFakeRepository({
      metadataName: 'UserEntity',
      queryExecutions: [[{ count: 7 }], [{ affected: 3 }], [{ affected: 2 }], [{ affected: 1 }]],
    });
    const manager = createFakeManager({ UserEntity: userRepository });
    const dataSource = createFakeDataSource(manager);
    const persistence = createTypeormPersistence({
      dataSource,
      manager,
      models: { user: 'UserEntity' },
    });

    expect(
      await persistence.count({
        model: 'user',
        where: [
          {
            field: 'email_address',
            operator: 'contains',
            value: 'example',
            connector: 'AND',
          },
        ],
      }),
    ).toBe(7);

    expect(
      await persistence.updateMany({
        model: 'user',
        where: [
          {
            field: 'email_address',
            operator: 'contains',
            value: 'example',
            connector: 'AND',
          },
        ],
        update: {
          email_address: 'bulk@example.com',
        },
      }),
    ).toBe(3);

    expect(
      await persistence.deleteMany({
        model: 'user',
        where: [
          {
            field: 'email_address',
            operator: 'contains',
            value: 'example',
            connector: 'AND',
          },
        ],
      }),
    ).toBe(2);

    await expect(
      persistence.delete({
        model: 'user',
        where: [
          {
            field: 'id',
            operator: 'eq',
            value: 'user_1',
            connector: 'AND',
          },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it('hydrates one-to-one, one-to-many, and many-to-many joins', async () => {
    const userRepository = createFakeRepository({
      metadataName: 'UserEntity',
      queryExecutions: [[{ many: [{ id: 'user_1' }, { id: 'user_2' }] }]],
    });
    const sessionRepository = createFakeRepository({
      metadataName: 'SessionEntity',
      columns: [
        {
          propertyName: 'id',
          propertyPath: 'id',
          databaseName: 'id',
          databasePath: 'id',
        },
        {
          propertyName: 'userId',
          propertyPath: 'userId',
          databaseName: 'user_id',
          databasePath: 'user_id',
        },
      ],
      queryExecutions: [
        [{ one: { id: 'session_1', userId: 'user_1' } }],
        [{ one: null }],
      ],
    });
    const accountRepository = createFakeRepository({
      metadataName: 'AccountEntity',
      columns: [
        {
          propertyName: 'id',
          propertyPath: 'id',
          databaseName: 'id',
          databasePath: 'id',
        },
        {
          propertyName: 'userId',
          propertyPath: 'userId',
          databaseName: 'user_id',
          databasePath: 'user_id',
        },
      ],
      queryExecutions: [
        [{ many: [{ id: 'account_1', userId: 'user_1' }] }],
        [{ many: [] }],
      ],
    });
    const passkeyRepository = createFakeRepository({
      metadataName: 'PasskeyEntity',
      columns: [
        {
          propertyName: 'id',
          propertyPath: 'id',
          databaseName: 'id',
          databasePath: 'id',
        },
        {
          propertyName: 'userId',
          propertyPath: 'userId',
          databaseName: 'user_id',
          databasePath: 'user_id',
        },
      ],
      queryExecutions: [
        [{ many: [{ id: 'passkey_1', userId: 'user_1' }] }],
        [{ many: [] }],
      ],
    });

    const manager = createFakeManager({
      UserEntity: userRepository,
      SessionEntity: sessionRepository,
      AccountEntity: accountRepository,
      PasskeyEntity: passkeyRepository,
    });
    const persistence = createTypeormPersistence({
      dataSource: createFakeDataSource(manager),
      manager,
      models: {
        user: 'UserEntity',
        session: 'SessionEntity',
        account: 'AccountEntity',
        passkey: 'PasskeyEntity',
      },
    });

    const records = await persistence.findMany<Record<string, unknown>>({
      model: 'user',
      limit: 10,
      join: {
        session: {
          on: { from: 'id', to: 'user_id' },
          relation: 'one-to-one',
        },
        account: {
          on: { from: 'id', to: 'user_id' },
          relation: 'one-to-many',
          limit: 1,
        },
        passkey: {
          on: { from: 'id', to: 'user_id' },
          relation: 'many-to-many',
          limit: 1,
        },
      } satisfies JoinConfig,
    });

    expect(records).toEqual([
      {
        id: 'user_1',
        session: { id: 'session_1', user_id: 'user_1' },
        account: [{ id: 'account_1', user_id: 'user_1' }],
        passkey: [{ id: 'passkey_1', user_id: 'user_1' }],
      },
      {
        id: 'user_2',
        session: null,
        account: [],
        passkey: [],
      },
    ]);
  });

  it('short-circuits joins when the base record has no join key', async () => {
    const userRepository = createFakeRepository({
      metadataName: 'UserEntity',
      queryExecutions: [[{ many: [{ id: null }] }]],
    });
    const sessionRepository = createFakeRepository({
      metadataName: 'SessionEntity',
      queryExecutions: [],
    });
    const manager = createFakeManager({
      UserEntity: userRepository,
      SessionEntity: sessionRepository,
    });
    const persistence = createTypeormPersistence({
      dataSource: createFakeDataSource(manager),
      manager,
      models: { user: 'UserEntity', session: 'SessionEntity' },
    });

    const records = await persistence.findMany<Record<string, unknown>>({
      model: 'user',
      limit: 10,
      join: {
        session: {
          on: { from: 'id', to: 'user_id' },
          relation: 'one-to-many',
        },
      },
    });

    expect(records).toEqual([{ id: null, session: [] }]);
    expect(sessionRepository.queryBuilders).toHaveLength(0);
  });

  it('uses the root data source transaction and returns manager-scoped persistence', async () => {
    const userRepository = createFakeRepository({
      metadataName: 'UserEntity',
      queryExecutions: [[{ many: [] }]],
    });
    const manager = createFakeManager({ UserEntity: userRepository });
    const dataSource = createFakeDataSource(manager);
    const persistence = createTypeormPersistence({
      dataSource,
      models: { user: 'UserEntity' },
    });

    await persistence.transaction(async (transactionPersistence) => {
      await transactionPersistence.findMany({
        model: 'user',
        limit: 5,
      });
      return null;
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.getRepository).toHaveBeenCalled();
  });

  it('delegates nested transactions to the provided manager', async () => {
    const userRepository = createFakeRepository({
      metadataName: 'UserEntity',
      queryExecutions: [],
    });
    const manager = createFakeManager({ UserEntity: userRepository });
    const persistence = createTypeormPersistence({
      dataSource: createFakeDataSource(manager),
      manager,
      models: { user: 'UserEntity' },
    });

    await persistence.transaction(async () => null);

    expect(manager.transaction).toHaveBeenCalledTimes(1);
  });
});
