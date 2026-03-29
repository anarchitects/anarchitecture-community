import type { BetterAuthOptions } from 'better-auth';
import {
  createAdapterFactory,
  type AdapterFactoryCustomizeAdapterCreator,
  type DBAdapter,
} from 'better-auth/adapters';
import type { EntityManager } from 'typeorm';

import type { BetterAuthTypeormAdapterOptions } from '../types.js';
import { createTypeormPersistence } from './create-typeorm-persistence.js';

const DEFAULT_ADAPTER_ID = 'typeorm';
const DEFAULT_ADAPTER_NAME = 'TypeORM';

function mapSelectFields(
  model: string,
  select: string[] | undefined,
  getDefaultModelName: (model: string) => string,
  getFieldName: ({ model, field }: { model: string; field: string }) => string,
) {
  if (!select) {
    return select;
  }

  const defaultModelName = getDefaultModelName(model);

  return select.map((field) =>
    getFieldName({ model: defaultModelName, field }),
  );
}

function mapSortByField(
  model: string,
  sortBy:
    | {
        field: string;
        direction: 'asc' | 'desc';
      }
    | undefined,
  getDefaultModelName: (model: string) => string,
  getFieldName: ({ model, field }: { model: string; field: string }) => string,
) {
  if (!sortBy) {
    return sortBy;
  }

  const defaultModelName = getDefaultModelName(model);

  return {
    field: getFieldName({
      model: defaultModelName,
      field: sortBy.field,
    }),
    direction: sortBy.direction,
  };
}

export function createBetterAuthTypeormDbAdapter(
  adapterOptions: BetterAuthTypeormAdapterOptions,
  authOptions: BetterAuthOptions,
  manager?: EntityManager,
): DBAdapter<BetterAuthOptions> {
  const createTypeormCustomAdapter: AdapterFactoryCustomizeAdapterCreator = ({
    getDefaultModelName,
    getFieldName,
  }) => {
    const persistence = createTypeormPersistence({
      dataSource: adapterOptions.dataSource,
      models: adapterOptions.models,
      manager,
    });

    return {
      create: ({ model, data, select }) =>
        persistence.create({ model, data, select }),
      update: ({ model, where, update }) =>
        persistence.update({ model, where, update }),
      updateMany: ({ model, where, update }) =>
        persistence.updateMany({ model, where, update }),
      findOne: ({ model, where, select, join }) =>
        persistence.findOne({
          model,
          where,
          select: mapSelectFields(
            model,
            select,
            getDefaultModelName,
            getFieldName,
          ),
          join,
        }),
      findMany: ({ model, where, limit, select, sortBy, offset, join }) =>
        persistence.findMany({
          model,
          where,
          limit,
          select: mapSelectFields(
            model,
            select,
            getDefaultModelName,
            getFieldName,
          ),
          sortBy: mapSortByField(
            model,
            sortBy,
            getDefaultModelName,
            getFieldName,
          ),
          offset,
          join,
        }),
      delete: ({ model, where }) => persistence.delete({ model, where }),
      deleteMany: ({ model, where }) =>
        persistence.deleteMany({ model, where }),
      count: ({ model, where }) => persistence.count({ model, where }),
      options: undefined,
    };
  };

  const adapterFactory = createAdapterFactory<BetterAuthOptions>({
    config: {
      adapterId: adapterOptions.adapterId ?? DEFAULT_ADAPTER_ID,
      adapterName: adapterOptions.adapterName ?? DEFAULT_ADAPTER_NAME,
      usePlural: false,
      supportsNumericIds: false,
      supportsUUIDs: true,
      supportsJSON: true,
      supportsDates: true,
      supportsBooleans: true,
      supportsArrays: false,
      transaction: async (callback) => {
        const executeTransaction = manager
          ? manager.transaction.bind(manager)
          : adapterOptions.dataSource.transaction.bind(
              adapterOptions.dataSource,
            );

        return executeTransaction(async (transactionManager) =>
          callback(
            createBetterAuthTypeormDbAdapter(
              adapterOptions,
              authOptions,
              transactionManager,
            ),
          ),
        );
      },
    },
    adapter: createTypeormCustomAdapter,
  });

  return adapterFactory(authOptions);
}
