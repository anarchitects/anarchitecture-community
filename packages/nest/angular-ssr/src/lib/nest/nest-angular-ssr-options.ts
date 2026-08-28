import {
  resolveAngularSsrBuildOutput,
  type AngularSsrBuildOutputOptions,
} from '../core/angular-ssr-build-output.js';
import type { AngularSsrRegistrationOptions } from '../core/angular-ssr-registration.js';
import type { BootstrapNestAngularSsrOptions } from './nest-angular-ssr-bootstrap.js';
import type { CreateNestAngularSsrIntegrationOptions } from './nest-angular-ssr-integration.js';
import type { RegisterNestAngularSsrRoutesOptions } from './nest-angular-ssr-routing.js';

export interface NormalizedNestAngularSsrOptions<TContext> {
  integration: Readonly<CreateNestAngularSsrIntegrationOptions<TContext>>;
  routing: Readonly<RegisterNestAngularSsrRoutesOptions>;
}

export async function normalizeNestAngularSsrOptions<TContext>(
  options: Readonly<BootstrapNestAngularSsrOptions<TContext>>,
): Promise<NormalizedNestAngularSsrOptions<TContext>> {
  const { angular, integration, observability } = options;

  if (!angular) {
    assertBrowserAssetsDir(options.routing.browserAssetsDir);
    return {
      integration: { ...integration, observability },
      routing: { ...options.routing, observability },
    };
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
        observability,
        rendererOptions: { engine: buildOutput.engine },
      },
      routing: {
        ...options.routing,
        observability,
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
      observability,
      rendererOptions: { registration: angular },
    },
    routing: { ...options.routing, observability },
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
