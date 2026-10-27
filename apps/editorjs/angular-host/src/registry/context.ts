import { InjectionToken } from '@angular/core';
export const REGISTRY_LABEL = new InjectionToken<string>(
  'fixture registry config label',
);
/** Observe factory execution without resolving browser tools or reading private metadata. */
export const REGISTRY_FACTORY_LABEL = new InjectionToken<{
  value: string | undefined;
}>('fixture registry factory observation');
