import type {
  CleanedWhere,
  CustomAdapter,
  JoinConfig,
} from 'better-auth/adapters';
import type {
  DataSource,
  EntityManager,
  ObjectLiteral,
  Repository,
} from 'typeorm';

import type { BetterAuthTypeormModelMap } from '../types.js';
import {
  mapEntityRecordToOutput,
  mapEntityRecordsToOutput,
  mapInputRecordToEntityProperties,
  mapUpdateRecordToEntityProperties,
  resolveSelectFields,
} from './field-mapping.js';
import {
  getSinglePrimaryField,
  resolveModelRepository,
} from './metadata.js';
import {
  applySortAndPagination,
  applyWhereClauses,
  createRepositoryQueryBuilder,
} from './query-builder.js';

const DEFAULT_JOIN_LIMIT = 100;
type PersistenceWhereValue = CleanedWhere['value'];

export interface BetterAuthTypeormPersistence extends CustomAdapter {
  transaction: <R>(
    callback: (trx: BetterAuthTypeormPersistence) => Promise<R>,
  ) => Promise<R>;
}

export interface CreateTypeormPersistenceOptions {
  dataSource: DataSource;
  models: BetterAuthTypeormModelMap;
  manager?: EntityManager;
}

function createPersistenceScope(options: CreateTypeormPersistenceOptions) {
  return {
    dataSource: options.dataSource,
    manager: options.manager ?? options.dataSource.manager,
    models: options.models,
  };
}

function isPersistenceWhereValue(value: unknown): value is PersistenceWhereValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date
  );
}

async function hydrateJoinForRecord(
  persistence: BetterAuthTypeormPersistence,
  baseRecord: Record<string, unknown>,
  joinModel: string,
  joinConfig: JoinConfig[string],
): Promise<unknown> {
  const joinKey = baseRecord[joinConfig.on.from];

  if (typeof joinKey === 'undefined' || joinKey === null) {
    return joinConfig.relation === 'one-to-one' ? null : [];
  }

  if (!isPersistenceWhereValue(joinKey)) {
    return joinConfig.relation === 'one-to-one' ? null : [];
  }

  if (joinConfig.relation === 'one-to-one') {
    return persistence.findOne<Record<string, unknown>>({
      model: joinModel,
      where: [
        {
          field: joinConfig.on.to,
          operator: 'eq',
          value: joinKey,
          connector: 'AND',
        },
      ],
    });
  }

  return persistence.findMany<Record<string, unknown>>({
    model: joinModel,
    where: [
      {
        field: joinConfig.on.to,
        operator: 'eq',
        value: joinKey,
        connector: 'AND',
      },
    ],
    limit: joinConfig.limit ?? DEFAULT_JOIN_LIMIT,
  });
}

async function attachJoinResults(
  persistence: BetterAuthTypeormPersistence,
  records: Record<string, unknown>[],
  join: JoinConfig | undefined,
): Promise<Record<string, unknown>[]> {
  if (!join || records.length === 0) {
    return records;
  }

  const hydratedRecords = [...records];

  for (const [joinModel, joinConfig] of Object.entries(join)) {
    for (const record of hydratedRecords) {
      record[joinModel] = await hydrateJoinForRecord(
        persistence,
        record,
        joinModel,
        joinConfig,
      );
    }
  }

  return hydratedRecords;
}

function applySelect(
  queryBuilder: ReturnType<typeof createRepositoryQueryBuilder>,
  repository: Repository<ObjectLiteral>,
  select: string[] | undefined,
): void {
  if (!select || select.length === 0) {
    return;
  }

  const selection = resolveSelectFields(
    {
      model: repository.metadata.name,
      repository,
      target: repository.target,
      metadata: repository.metadata,
    },
    select,
  ).map((field) => `entity.${field.propertyPath}`);

  if (selection.length > 0) {
    queryBuilder.select(selection);
  }
}

async function countMatchingRows(
  repositoryContext: ReturnType<typeof resolveModelRepository>,
  where: CleanedWhere[],
): Promise<number> {
  const queryBuilder = createRepositoryQueryBuilder(repositoryContext);

  applyWhereClauses(queryBuilder, repositoryContext, where);

  return queryBuilder.getCount();
}

export function createTypeormPersistence(
  options: CreateTypeormPersistenceOptions,
): BetterAuthTypeormPersistence {
  const scope = createPersistenceScope(options);

  const persistence: BetterAuthTypeormPersistence = {
    async create<T extends Record<string, unknown>>({
      model,
      data,
      select,
    }: {
      model: string;
      data: T;
      select?: string[] | undefined;
    }): Promise<T> {
      const repositoryContext = resolveModelRepository(scope, model);
      const entityData = mapInputRecordToEntityProperties(repositoryContext, data);
      const entity = repositoryContext.repository.create(entityData);
      const savedEntity = await repositoryContext.repository.save(entity);

      return mapEntityRecordToOutput(
        repositoryContext,
        savedEntity,
        select,
      ) as T;
    },

    async findOne<T>({
      model,
      where,
      select,
      join,
    }: {
      model: string;
      where: CleanedWhere[];
      select?: string[] | undefined;
      join?: JoinConfig | undefined;
    }): Promise<T | null> {
      const repositoryContext = resolveModelRepository(scope, model);
      const queryBuilder = createRepositoryQueryBuilder(repositoryContext);

      applySelect(queryBuilder, repositoryContext.repository, select);
      applyWhereClauses(queryBuilder, repositoryContext, where);

      const entity = await queryBuilder.getOne();

      if (!entity) {
        return null;
      }

      const [hydratedRecord] = await attachJoinResults(
        persistence,
        [mapEntityRecordToOutput(repositoryContext, entity, select)],
        join,
      );

      return hydratedRecord as T;
    },

    async findMany<T>({
      model,
      where,
      limit,
      select,
      sortBy,
      offset,
      join,
    }: {
      model: string;
      where?: CleanedWhere[] | undefined;
      limit: number;
      select?: string[] | undefined;
      sortBy?: { field: string; direction: 'asc' | 'desc' } | undefined;
      offset?: number | undefined;
      join?: JoinConfig | undefined;
    }): Promise<T[]> {
      const repositoryContext = resolveModelRepository(scope, model);
      const queryBuilder = createRepositoryQueryBuilder(repositoryContext);

      applySelect(queryBuilder, repositoryContext.repository, select);
      applyWhereClauses(queryBuilder, repositoryContext, where);
      applySortAndPagination(queryBuilder, repositoryContext, {
        sortBy,
        limit,
        offset,
      });

      const entities = await queryBuilder.getMany();
      const records = mapEntityRecordsToOutput(repositoryContext, entities, select);

      return (await attachJoinResults(persistence, records, join)) as T[];
    },

    async count({
      model,
      where,
    }: {
      model: string;
      where?: CleanedWhere[] | undefined;
    }): Promise<number> {
      const repositoryContext = resolveModelRepository(scope, model);
      const queryBuilder = createRepositoryQueryBuilder(repositoryContext);

      applyWhereClauses(queryBuilder, repositoryContext, where);

      return queryBuilder.getCount();
    },

    async update<T>({
      model,
      where,
      update,
    }: {
      model: string;
      where: CleanedWhere[];
      update: T;
    }): Promise<T | null> {
      const repositoryContext = resolveModelRepository(scope, model);
      const queryBuilder = createRepositoryQueryBuilder(repositoryContext);

      applyWhereClauses(queryBuilder, repositoryContext, where);

      const existingEntity = await queryBuilder.getOne();

      if (!existingEntity) {
        return null;
      }

      const primaryField = getSinglePrimaryField(repositoryContext);
      const mappedUpdate = mapUpdateRecordToEntityProperties(
        repositoryContext,
        update as Record<string, unknown>,
      );
      const mergedEntity = repositoryContext.repository.merge(
        existingEntity,
        mappedUpdate,
      );

      await repositoryContext.repository.save(mergedEntity);

      const rereadQueryBuilder = createRepositoryQueryBuilder(repositoryContext);
      const primaryValue = existingEntity[primaryField.propertyName];

      applyWhereClauses(
        rereadQueryBuilder,
        repositoryContext,
        [
          {
            field: primaryField.databaseName,
            operator: 'eq',
            value: primaryValue,
            connector: 'AND',
          },
        ],
      );

      const rereadEntity = await rereadQueryBuilder.getOne();

      if (!rereadEntity) {
        return null;
      }

      return mapEntityRecordToOutput(repositoryContext, rereadEntity) as T;
    },

    async updateMany({
      model,
      where,
      update,
    }: {
      model: string;
      where: CleanedWhere[];
      update: Record<string, unknown>;
    }): Promise<number> {
      const repositoryContext = resolveModelRepository(scope, model);
      const matchedCount = await countMatchingRows(repositoryContext, where);

      if (matchedCount === 0) {
        return 0;
      }

      const mappedUpdate = mapUpdateRecordToEntityProperties(repositoryContext, update);
      const queryBuilder = repositoryContext.repository
        .createQueryBuilder()
        .update(repositoryContext.target)
        .set(mappedUpdate);

      applyWhereClauses(queryBuilder, repositoryContext, where, '');

      const result = await queryBuilder.execute();

      return result.affected && result.affected > 0 ? result.affected : matchedCount;
    },

    async delete({
      model,
      where,
    }: {
      model: string;
      where: CleanedWhere[];
    }): Promise<void> {
      const repositoryContext = resolveModelRepository(scope, model);
      const queryBuilder = repositoryContext.repository
        .createQueryBuilder()
        .delete()
        .from(repositoryContext.target);

      applyWhereClauses(queryBuilder, repositoryContext, where, '');
      await queryBuilder.execute();
    },

    async deleteMany({
      model,
      where,
    }: {
      model: string;
      where: CleanedWhere[];
    }): Promise<number> {
      const repositoryContext = resolveModelRepository(scope, model);
      const matchedCount = await countMatchingRows(repositoryContext, where);

      if (matchedCount === 0) {
        return 0;
      }

      const queryBuilder = repositoryContext.repository
        .createQueryBuilder()
        .delete()
        .from(repositoryContext.target);

      applyWhereClauses(queryBuilder, repositoryContext, where, '');

      const result = await queryBuilder.execute();

      return result.affected && result.affected > 0 ? result.affected : matchedCount;
    },

    async transaction<R>(
      callback: (trx: BetterAuthTypeormPersistence) => Promise<R>,
    ): Promise<R> {
      if (options.manager) {
        return scope.manager.transaction(async (transactionManager) =>
          callback(
            createTypeormPersistence({
              dataSource: options.dataSource,
              models: options.models,
              manager: transactionManager,
            }),
          ),
        );
      }

      return options.dataSource.transaction(async (transactionManager) =>
        callback(
          createTypeormPersistence({
            dataSource: options.dataSource,
            models: options.models,
            manager: transactionManager,
          }),
        ),
      );
    },

    options: undefined,
  };

  return persistence;
}
