import type { INestApplication } from '@nestjs/common';

import type { AngularSsrRegistrationOptions } from '../core/angular-ssr-registration.js';
import {
  createNestAngularSsrIntegration,
  type CreateNestAngularSsrIntegrationOptions,
  type NestAngularSsrIntegration,
} from './nest-angular-ssr-integration.js';
import {
  registerNestAngularSsrRoutes,
  type RegisterNestAngularSsrRoutesOptions,
} from './nest-angular-ssr-routing.js';

export interface BootstrapNestAngularSsrOptions<TContext = unknown> {
  angular?: Readonly<AngularSsrRegistrationOptions>;
  integration?: Readonly<CreateNestAngularSsrIntegrationOptions<TContext>>;
  routing: Readonly<RegisterNestAngularSsrRoutesOptions>;
}

export async function bootstrapNestAngularSsr<TContext = unknown>(
  app: INestApplication,
  options: Readonly<BootstrapNestAngularSsrOptions<TContext>>,
): Promise<NestAngularSsrIntegration<TContext>> {
  const integration = createNestAngularSsrIntegration<TContext>(
    app,
    resolveIntegrationOptions(options),
  );

  await registerNestAngularSsrRoutes(app, integration, options.routing);

  return integration;
}

function resolveIntegrationOptions<TContext>(
  options: Readonly<BootstrapNestAngularSsrOptions<TContext>>,
): Readonly<CreateNestAngularSsrIntegrationOptions<TContext>> | undefined {
  const { angular, integration } = options;

  if (!angular) {
    return integration;
  }

  if (integration?.renderer) {
    throw new Error(
      'Cannot provide both "angular" and "integration.renderer" to bootstrapNestAngularSsr.',
    );
  }

  if (integration?.rendererOptions) {
    throw new Error(
      'Cannot provide both "angular" and "integration.rendererOptions" to bootstrapNestAngularSsr.',
    );
  }

  return {
    ...integration,
    rendererOptions: {
      registration: angular,
    },
  };
}
