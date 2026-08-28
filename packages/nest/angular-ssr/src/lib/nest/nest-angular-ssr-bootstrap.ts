import type { INestApplication } from '@nestjs/common';

import {
  resolveAngularSsrBuildOutput,
  type AngularSsrBuildOutputOptions,
} from '../core/angular-ssr-build-output.js';
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
  enabled?: boolean;
  angular?: Readonly<
    AngularSsrRegistrationOptions | AngularSsrBuildOutputOptions
  >;
  integration?: Readonly<CreateNestAngularSsrIntegrationOptions<TContext>>;
  routing: Readonly<RegisterNestAngularSsrRoutesOptions>;
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

  const normalized = await normalizeBootstrapOptions(options);
  const integration = createNestAngularSsrIntegration<TContext>(
    app,
    normalized.integration,
  );

  await registerNestAngularSsrRoutes(app, integration, normalized.routing);

  return integration;
}

async function normalizeBootstrapOptions<TContext>(
  options: Readonly<BootstrapNestAngularSsrOptions<TContext>>,
): Promise<{
  integration:
    | Readonly<CreateNestAngularSsrIntegrationOptions<TContext>>
    | undefined;
  routing: Readonly<RegisterNestAngularSsrRoutesOptions>;
}> {
  const { angular, integration } = options;

  if (!angular) {
    assertBrowserAssetsDir(options.routing.browserAssetsDir);
    return { integration, routing: options.routing };
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

  if (isBuildOutputOptions(angular)) {
    const buildOutput = await resolveAngularSsrBuildOutput(angular);

    return {
      integration: {
        ...integration,
        rendererOptions: { engine: buildOutput.engine },
      },
      routing: {
        ...options.routing,
        browserAssetsDir:
          options.routing.browserAssetsDir ?? buildOutput.browserAssetsDir,
        allowedHosts: options.routing.allowedHosts ?? angular.allowedHosts,
      },
    };
  }

  assertBrowserAssetsDir(options.routing.browserAssetsDir);
  return {
    integration: {
      ...integration,
      rendererOptions: { registration: angular },
    },
    routing: options.routing,
  };
}

function isBuildOutputOptions(
  angular: Readonly<
    AngularSsrRegistrationOptions | AngularSsrBuildOutputOptions
  >,
): angular is Readonly<AngularSsrBuildOutputOptions> {
  return 'buildOutput' in angular;
}

function assertBrowserAssetsDir(
  browserAssetsDir: string | undefined,
): asserts browserAssetsDir is string {
  if (!browserAssetsDir) {
    throw new Error(
      '"routing.browserAssetsDir" is required unless "angular.buildOutput.root" is configured.',
    );
  }
}
