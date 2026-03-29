import type { BetterAuthOptions } from 'better-auth';

import type { BetterAuthTypeormAdapterOptions } from './types.js';

const NOT_IMPLEMENTED_MESSAGE =
  'createBetterAuthTypeormAdapter is not implemented yet. Issue #6 locks the public API; the runtime adapter lands in issues #7 and #9.';

export function createBetterAuthTypeormAdapter(
  options: BetterAuthTypeormAdapterOptions,
): BetterAuthOptions['database'] {
  void options;
  throw new Error(NOT_IMPLEMENTED_MESSAGE);
}
