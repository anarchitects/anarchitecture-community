import {
  Injectable,
  Module,
  type DynamicModule,
  type FactoryProvider,
  type ModuleMetadata,
  type OnApplicationBootstrap,
  type Provider,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ApplicationConfig, HttpAdapterHost } from '@nestjs/core';

import {
  bootstrapNestAngularSsr,
  type BootstrapNestAngularSsrOptions,
} from './nest-angular-ssr-bootstrap.js';
import type { NestAngularSsrIntegration } from './nest-angular-ssr-integration.js';

export type NestAngularSsrModuleOptions<TContext = unknown> =
  BootstrapNestAngularSsrOptions<TContext>;

export interface NestAngularSsrModuleAsyncOptions<TContext = unknown>
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: unknown[]
  ) =>
    | Readonly<NestAngularSsrModuleOptions<TContext>>
    | Promise<Readonly<NestAngularSsrModuleOptions<TContext>>>;
  inject?: FactoryProvider['inject'];
}

export const NEST_ANGULAR_SSR_MODULE_OPTIONS = Symbol(
  'NEST_ANGULAR_SSR_MODULE_OPTIONS',
);

@Injectable()
export class NestAngularSsrModuleBootstrapService<TContext = unknown>
  implements OnApplicationBootstrap
{
  private integrationPromise?: Promise<NestAngularSsrIntegration<TContext>>;

  constructor(
    private readonly options: Readonly<NestAngularSsrModuleOptions<TContext>>,
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly applicationConfig: ApplicationConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.getIntegration();
  }

  getIntegration(): Promise<NestAngularSsrIntegration<TContext>> {
    this.integrationPromise ??= bootstrapNestAngularSsr<TContext>(
      createNestAngularSsrModuleApplication(
        this.httpAdapterHost,
        this.applicationConfig,
      ),
      this.options,
    );

    return this.integrationPromise;
  }
}

@Module({})
export class NestAngularSsrModule {
  static forRoot<TContext = unknown>(
    options: Readonly<NestAngularSsrModuleOptions<TContext>>,
  ): DynamicModule {
    return {
      module: NestAngularSsrModule,
      providers: [
        createNestAngularSsrModuleOptionsProvider(options),
        createNestAngularSsrModuleBootstrapServiceProvider(),
      ],
    };
  }

  static forRootAsync<TContext = unknown>(
    options: Readonly<NestAngularSsrModuleAsyncOptions<TContext>>,
  ): DynamicModule {
    return {
      module: NestAngularSsrModule,
      imports: options.imports,
      providers: [
        createNestAngularSsrModuleAsyncOptionsProvider(options),
        createNestAngularSsrModuleBootstrapServiceProvider(),
      ],
    };
  }
}

function createNestAngularSsrModuleOptionsProvider<TContext>(
  options: Readonly<NestAngularSsrModuleOptions<TContext>>,
): Provider {
  return {
    provide: NEST_ANGULAR_SSR_MODULE_OPTIONS,
    useValue: options,
  };
}

function createNestAngularSsrModuleAsyncOptionsProvider<TContext>(
  options: Readonly<NestAngularSsrModuleAsyncOptions<TContext>>,
): Provider {
  return {
    provide: NEST_ANGULAR_SSR_MODULE_OPTIONS,
    useFactory: options.useFactory,
    inject: options.inject,
  };
}

function createNestAngularSsrModuleBootstrapServiceProvider(): Provider {
  return {
    provide: NestAngularSsrModuleBootstrapService,
    useFactory: (
      options: Readonly<NestAngularSsrModuleOptions>,
      httpAdapterHost: HttpAdapterHost,
      applicationConfig: ApplicationConfig,
    ) =>
      new NestAngularSsrModuleBootstrapService(
        options,
        httpAdapterHost,
        applicationConfig,
      ),
    inject: [
      NEST_ANGULAR_SSR_MODULE_OPTIONS,
      HttpAdapterHost,
      ApplicationConfig,
    ],
  };
}

function createNestAngularSsrModuleApplication(
  httpAdapterHost: HttpAdapterHost,
  applicationConfig: ApplicationConfig,
): INestApplication {
  const httpAdapter = httpAdapterHost.httpAdapter;

  if (!httpAdapter) {
    throw new Error(
      'Nest HTTP adapter is unavailable during NestAngularSsrModule bootstrap.',
    );
  }

  return {
    getHttpAdapter: () => httpAdapter,
    config: {
      getGlobalPrefix: () => applicationConfig.getGlobalPrefix(),
    },
  } as unknown as INestApplication;
}
