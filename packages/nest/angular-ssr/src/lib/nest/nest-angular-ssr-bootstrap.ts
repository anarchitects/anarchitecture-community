import type { INestApplication } from '@nestjs/common';

import type { AngularSsrBuildOutputOptions } from '../core/angular-ssr-build-output.js';
import type { AngularSsrRegistrationOptions } from '../core/angular-ssr-registration.js';
import type { AngularSsrObservabilityOptions } from '../core/angular-ssr-observability.js';
import {
  createNestAngularSsrIntegration,
  type CreateNestAngularSsrIntegrationOptions,
  type NestAngularSsrIntegration,
} from './nest-angular-ssr-integration.js';
import {
  type RegisterNestAngularSsrRoutesOptions,
  registerNestAngularSsrRoutes,
} from './nest-angular-ssr-routing.js';
import { normalizeNestAngularSsrOptions } from './nest-angular-ssr-options.js';

export interface BootstrapNestAngularSsrOptions<TContext = unknown> {
  enabled?: boolean;
  angular?: Readonly<
    AngularSsrRegistrationOptions | AngularSsrBuildOutputOptions
  >;
  observability?: Readonly<AngularSsrObservabilityOptions>;
  integration?: Readonly<
    Omit<CreateNestAngularSsrIntegrationOptions<TContext>, 'observability'>
  >;
  routing: Readonly<Omit<RegisterNestAngularSsrRoutesOptions, 'observability'>>;
}

export function bootstrapNestAngularSsr<TContext = unknown>(
  app: INestApplication,
  options: Readonly<BootstrapNestAngularSsrOptions<TContext>> & {
    enabled: false;
  },
): Promise<undefined>;
export function bootstrapNestAngularSsr<TContext = unknown>(
  app: INestApplication,
  options: Readonly<BootstrapNestAngularSsrOptions<TContext>> & {
    enabled?: true;
  },
): Promise<NestAngularSsrIntegration<TContext>>;
export function bootstrapNestAngularSsr<TContext = unknown>(
  app: INestApplication,
  options: Readonly<BootstrapNestAngularSsrOptions<TContext>>,
): Promise<NestAngularSsrIntegration<TContext> | undefined>;
export async function bootstrapNestAngularSsr<TContext = unknown>(
  app: INestApplication,
  options: Readonly<BootstrapNestAngularSsrOptions<TContext>>,
): Promise<NestAngularSsrIntegration<TContext> | undefined> {
  if (options.enabled === false) {
    return undefined;
  }

  const normalized = await normalizeNestAngularSsrOptions(options);
  const integration = createNestAngularSsrIntegration<TContext>(
    app,
    normalized.integration,
  );

  await registerNestAngularSsrRoutes(app, integration, normalized.routing);

  return integration;
}
