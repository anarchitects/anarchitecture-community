import type { EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

import type { BetterAuthTypeormModelMap } from '../types.js';
import {
  createMissingModelMappingError,
  createUnresolvedFieldError,
  createUnsupportedPrimaryKeyError,
} from './errors.js';

type EntityMetadata = Repository<ObjectLiteral>['metadata'];
type EntityColumn = EntityMetadata['columns'][number];

export interface PersistenceContext {
  readonly manager: EntityManager;
  readonly models: BetterAuthTypeormModelMap;
}

export interface ModelRepositoryContext {
  readonly model: string;
  readonly target: EntityTarget<ObjectLiteral>;
  readonly repository: Repository<ObjectLiteral>;
  readonly metadata: EntityMetadata;
}

export interface ResolvedField {
  readonly inputName: string;
  readonly propertyName: string;
  readonly propertyPath: string;
  readonly databaseName: string;
}

function findColumn(metadata: EntityMetadata, field: string): EntityColumn | null {
  return (
    metadata.columns.find((column) => column.propertyName === field) ??
    metadata.columns.find((column) => column.propertyPath === field) ??
    metadata.columns.find((column) => column.databaseName === field) ??
    metadata.columns.find((column) => column.databasePath === field) ??
    null
  );
}

export function resolveModelRepository(
  context: PersistenceContext,
  model: string,
): ModelRepositoryContext {
  const target = context.models[model];

  if (!target) {
    throw createMissingModelMappingError(model);
  }

  const repository = context.manager.getRepository(target);

  return {
    model,
    target,
    repository,
    metadata: repository.metadata,
  };
}

export function resolveField(
  repositoryContext: ModelRepositoryContext,
  field: string,
): ResolvedField {
  const column = findColumn(repositoryContext.metadata, field);

  if (!column) {
    throw createUnresolvedFieldError(repositoryContext.model, field);
  }

  return {
    inputName: field,
    propertyName: column.propertyName,
    propertyPath: column.propertyPath,
    databaseName: column.databaseName,
  };
}

export function getSinglePrimaryField(
  repositoryContext: ModelRepositoryContext,
): ResolvedField {
  if (repositoryContext.metadata.primaryColumns.length !== 1) {
    throw createUnsupportedPrimaryKeyError(repositoryContext.model);
  }

  const [primaryColumn] = repositoryContext.metadata.primaryColumns;

  return {
    inputName: primaryColumn.databaseName,
    propertyName: primaryColumn.propertyName,
    propertyPath: primaryColumn.propertyPath,
    databaseName: primaryColumn.databaseName,
  };
}
