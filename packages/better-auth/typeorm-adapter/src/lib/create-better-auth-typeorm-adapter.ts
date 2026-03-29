import type { BetterAuthOptions } from 'better-auth';

import type { BetterAuthTypeormAdapterOptions } from './types.js';
import { createBetterAuthTypeormDbAdapter } from './internal/create-better-auth-typeorm-db-adapter.js';

export function createBetterAuthTypeormAdapter(
  options: BetterAuthTypeormAdapterOptions,
): BetterAuthOptions['database'] {
  return (authOptions: BetterAuthOptions) =>
    createBetterAuthTypeormDbAdapter(options, authOptions);
}
