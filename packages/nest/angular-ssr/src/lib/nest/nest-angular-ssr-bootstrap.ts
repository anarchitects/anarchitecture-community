import type { INestApplication } from '@nestjs/common';

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
  integration?: Readonly<CreateNestAngularSsrIntegrationOptions<TContext>>;
  routing: Readonly<RegisterNestAngularSsrRoutesOptions>;
}

export async function bootstrapNestAngularSsr<TContext = unknown>(
  app: INestApplication,
  options: Readonly<BootstrapNestAngularSsrOptions<TContext>>,
): Promise<NestAngularSsrIntegration<TContext>> {
  const integration = createNestAngularSsrIntegration<TContext>(
    app,
    options.integration,
  );

  await registerNestAngularSsrRoutes(app, integration, options.routing);

  return integration;
}
