import type { ApplicationRef } from '@angular/core';
import type { BootstrapContext } from '@angular/platform-browser';
import { expectTypeOf, test } from 'vitest';

import type {
  AngularSsrRegistrationOptions,
  AngularSsrServerBootstrapLoader,
} from './angular-ssr-registration.js';

test('exports a public registration contract that consumers can type without Angular private APIs', () => {
  const registration = {
    bootstrap: async () => async (_context: BootstrapContext) =>
      ({}) as ApplicationRef,
    document: '<!doctype html><html><body><app-root></app-root></body></html>',
    baseHref: '/',
    inlineCriticalCss: false,
    routeExtractionUrl: 'http://localhost/',
    allowedHosts: ['localhost'],
  } satisfies AngularSsrRegistrationOptions;
  const bootstrapLoader: AngularSsrServerBootstrapLoader = registration.bootstrap;

  expectTypeOf(bootstrapLoader).toBeFunction();
  expectTypeOf(registration).toMatchTypeOf<AngularSsrRegistrationOptions>();
});
