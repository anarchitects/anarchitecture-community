export class BetterAuthTypeormPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BetterAuthTypeormPersistenceError';
  }
}

export function createMissingModelMappingError(model: string): Error {
  return new BetterAuthTypeormPersistenceError(
    `No TypeORM entity mapping was registered for Better Auth model "${model}".`,
  );
}

export function createUnresolvedFieldError(
  model: string,
  field: string,
): Error {
  return new BetterAuthTypeormPersistenceError(
    `Could not resolve field "${field}" for Better Auth model "${model}".`,
  );
}

export function createUnsupportedPrimaryKeyError(model: string): Error {
  return new BetterAuthTypeormPersistenceError(
    `Better Auth TypeORM persistence currently requires a single primary column for model "${model}".`,
  );
}
