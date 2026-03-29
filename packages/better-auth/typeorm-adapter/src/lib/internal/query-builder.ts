import type { CleanedWhere } from 'better-auth/adapters';
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import type { ModelRepositoryContext, ResolvedField } from './metadata.js';
import { resolveField } from './metadata.js';

type WhereCapableQueryBuilder = Pick<
  SelectQueryBuilder<ObjectLiteral>,
  'where' | 'andWhere' | 'orWhere'
>;

const DEFAULT_ALIAS = 'entity';

let parameterCounter = 0;

function nextParameterName(): string {
  parameterCounter += 1;
  return `where_${parameterCounter}`;
}

function createClauseExpression(
  resolvedField: ResolvedField,
  where: CleanedWhere,
  alias: string,
): { expression: string; parameters: Record<string, unknown> } {
  const fieldExpression = `${alias}.${resolvedField.propertyPath}`;
  const operator = where.operator;
  const value = where.value;

  if (operator === 'eq' && value === null) {
    return { expression: `${fieldExpression} IS NULL`, parameters: {} };
  }

  if (operator === 'ne' && value === null) {
    return { expression: `${fieldExpression} IS NOT NULL`, parameters: {} };
  }

  if (operator === 'in' || operator === 'not_in') {
    const values = Array.isArray(value) ? value : [value];
    const withoutNull = values.filter((entry) => entry !== null);
    const hasNull = values.length !== withoutNull.length;

    if (withoutNull.length === 0 && !hasNull) {
      return {
        expression: operator === 'in' ? '1 = 0' : '1 = 1',
        parameters: {},
      };
    }

    if (withoutNull.length === 0 && hasNull) {
      return {
        expression:
          operator === 'in'
            ? `${fieldExpression} IS NULL`
            : `${fieldExpression} IS NOT NULL`,
        parameters: {},
      };
    }

    const parameterName = nextParameterName();
    const baseExpression =
      operator === 'in'
        ? `${fieldExpression} IN (:...${parameterName})`
        : `${fieldExpression} NOT IN (:...${parameterName})`;

    if (!hasNull) {
      return {
        expression: baseExpression,
        parameters: { [parameterName]: withoutNull },
      };
    }

    return {
      expression:
        operator === 'in'
          ? `(${baseExpression} OR ${fieldExpression} IS NULL)`
          : `(${baseExpression} AND ${fieldExpression} IS NOT NULL)`,
      parameters: { [parameterName]: withoutNull },
    };
  }

  const parameterName = nextParameterName();

  if (operator === 'contains') {
    return {
      expression: `${fieldExpression} LIKE :${parameterName}`,
      parameters: { [parameterName]: `%${String(value)}%` },
    };
  }

  if (operator === 'starts_with') {
    return {
      expression: `${fieldExpression} LIKE :${parameterName}`,
      parameters: { [parameterName]: `${String(value)}%` },
    };
  }

  if (operator === 'ends_with') {
    return {
      expression: `${fieldExpression} LIKE :${parameterName}`,
      parameters: { [parameterName]: `%${String(value)}` },
    };
  }

  const sqlOperator =
    operator === 'eq'
      ? '='
      : operator === 'ne'
        ? '!='
        : operator === 'lt'
          ? '<'
          : operator === 'lte'
            ? '<='
            : operator === 'gt'
              ? '>'
              : '>=';

  return {
    expression: `${fieldExpression} ${sqlOperator} :${parameterName}`,
    parameters: { [parameterName]: value },
  };
}

export function applyWhereClauses(
  queryBuilder: WhereCapableQueryBuilder,
  repositoryContext: ModelRepositoryContext,
  where: CleanedWhere[] | undefined,
  alias = DEFAULT_ALIAS,
): void {
  if (!where || where.length === 0) {
    return;
  }

  where.forEach((clause, index) => {
    const resolvedField = resolveField(repositoryContext, clause.field);
    const { expression, parameters } = createClauseExpression(
      resolvedField,
      clause,
      alias,
    );

    if (index === 0) {
      queryBuilder.where(expression, parameters);
      return;
    }

    if (clause.connector === 'OR') {
      queryBuilder.orWhere(expression, parameters);
      return;
    }

    queryBuilder.andWhere(expression, parameters);
  });
}

export function applySortAndPagination(
  queryBuilder: SelectQueryBuilder<ObjectLiteral>,
  repositoryContext: ModelRepositoryContext,
  options: {
    sortBy?:
      | {
          field: string;
          direction: 'asc' | 'desc';
        }
      | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  },
  alias = DEFAULT_ALIAS,
): void {
  if (options.sortBy) {
    const resolvedField = resolveField(repositoryContext, options.sortBy.field);
    queryBuilder.orderBy(
      `${alias}.${resolvedField.propertyPath}`,
      options.sortBy.direction.toUpperCase() as 'ASC' | 'DESC',
    );
  }

  if (typeof options.limit === 'number') {
    queryBuilder.take(options.limit);
  }

  if (typeof options.offset === 'number') {
    queryBuilder.skip(options.offset);
  }
}

export function createRepositoryQueryBuilder(
  repositoryContext: ModelRepositoryContext,
  alias = DEFAULT_ALIAS,
): SelectQueryBuilder<ObjectLiteral> {
  return repositoryContext.repository.createQueryBuilder(alias);
}
