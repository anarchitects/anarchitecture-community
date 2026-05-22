import { local } from '@feature/local';
import { sharedProxy } from '@shared/index';

export const web = local && sharedProxy;
