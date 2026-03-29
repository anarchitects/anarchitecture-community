import type { ObjectLiteral } from 'typeorm';

import type { ModelRepositoryContext, ResolvedField } from './metadata.js';
import { resolveField } from './metadata.js';

function pickSelectedFields(
  mappedRecord: Record<string, unknown>,
  select: string[] | undefined,
): Record<string, unknown> {
  if (!select || select.length === 0) {
    return mappedRecord;
  }

  const selectedRecord: Record<string, unknown> = {};

  for (const key of select) {
    if (Object.hasOwn(mappedRecord, key)) {
      selectedRecord[key] = mappedRecord[key];
    }
  }

  return selectedRecord;
}

export function mapInputRecordToEntityProperties(
  repositoryContext: ModelRepositoryContext,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const mappedInput: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    const field = resolveField(repositoryContext, key);
    mappedInput[field.propertyName] = value;
  }

  return mappedInput;
}

export function mapUpdateRecordToEntityProperties(
  repositoryContext: ModelRepositoryContext,
  update: Record<string, unknown>,
): Record<string, unknown> {
  return mapInputRecordToEntityProperties(repositoryContext, update);
}

export function mapEntityRecordToOutput(
  repositoryContext: ModelRepositoryContext,
  row: ObjectLiteral,
  select?: string[] | undefined,
): Record<string, unknown> {
  const mappedRecord: Record<string, unknown> = {};

  for (const column of repositoryContext.metadata.columns) {
    if (typeof row[column.propertyName] === 'undefined') {
      continue;
    }

    mappedRecord[column.databaseName] = row[column.propertyName];
  }

  return pickSelectedFields(mappedRecord, select);
}

export function mapEntityRecordsToOutput(
  repositoryContext: ModelRepositoryContext,
  rows: ObjectLiteral[],
  select?: string[] | undefined,
): Record<string, unknown>[] {
  return rows.map((row) => mapEntityRecordToOutput(repositoryContext, row, select));
}

export function resolveSelectFields(
  repositoryContext: ModelRepositoryContext,
  select?: string[] | undefined,
): ResolvedField[] {
  if (!select || select.length === 0) {
    return [];
  }

  return select.map((field) => resolveField(repositoryContext, field));
}
