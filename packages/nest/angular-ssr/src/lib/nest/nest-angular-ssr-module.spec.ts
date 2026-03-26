import '@angular/compiler';
import 'reflect-metadata';

import {
  Controller,
  Get,
  Module,
  type DynamicModule,
  type FactoryProvider,
  type ValueProvider,
} from '@nestjs/common';
import { ApplicationConfig, HttpAdapterHost, NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createAngularSsrRenderer } from '../core/angular-node-ssr-renderer.js';
import { setupAngularSsrFixture } from '../../testing/angular-ssr-fixture.js';
import type { BootstrapNestAngularSsrOptions } from './nest-angular-ssr-bootstrap.js';
import {
  NEST_ANGULAR_SSR_MODULE_OPTIONS,
  NestAngularSsrModule,
  NestAngularSsrModuleBootstrapService,
  type NestAngularSsrModuleOptions,
} from './nest-angular-ssr-module.js';

describe('NestAngularSsrModule', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forRoot registers the expected providers and options', () => {
    const options = createModuleOptions('/tmp/browser-assets');
    const dynamicModule = NestAngularSsrModule.forRoot(options);

    expect(dynamicModule.module).toBe(NestAngularSsrModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: NestAngularSsrModuleBootstrapService,
        }),
        expect.objectContaining({
          provide: NEST_ANGULAR_SSR_MODULE_OPTIONS,
          useValue: options,
        }),
      ]),
    );
  });

  it('forRootAsync wires useFactory and inject into the options provider', async () => {
    const dependencyToken = Symbol('dependency');
    const options = createModuleOptions('/tmp/browser-assets', {
      apiPrefix: '/api',
    });
    const useFactory = vi.fn((...args: unknown[]) => {
      expect(args).toEqual(['/api']);
      return options;
    });
    const dynamicModule = NestAngularSsrModule.forRootAsync({
      inject: [dependencyToken],
      useFactory,
    });
    const provider = getOptionsProvider(dynamicModule) as FactoryProvider;

    expect(provider.inject).toEqual([dependencyToken]);
    expect(await provider.useFactory?.('/api')).toBe(options);
    expect(useFactory).toHaveBeenCalledTimes(1);
  });

  it('delegates the unchanged nested option shape through the bootstrap service', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const renderer = {
      render: vi.fn().mockResolvedValue(null),
    };
    const context = createBootstrapServiceContext({
      integration: { renderer },
      routing: { browserAssetsDir },
    });

    try {
      const integration = await context.service.getIntegration();

      expect(integration.renderer).toBe(renderer);
      expect(context.fastify.register).toHaveBeenCalledTimes(1);
      expect(context.fastify.route).toHaveBeenCalledTimes(2);
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('runs setup only once within a single app instance', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const context = createBootstrapServiceContext({
      integration: {
        renderer: {
          render: vi.fn().mockResolvedValue(null),
        },
      },
      routing: { browserAssetsDir },
    });

    try {
      const firstIntegration = context.service.getIntegration();
      const secondIntegration = context.service.getIntegration();

      await context.service.onApplicationBootstrap();
      await context.service.onApplicationBootstrap();

      expect(firstIntegration).toBe(secondIntegration);
      expect(context.fastify.register).toHaveBeenCalledTimes(1);
      expect(context.fastify.route).toHaveBeenCalledTimes(2);
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('surfaces bootstrap errors unchanged', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const context = createBootstrapServiceContext(
      {
        routing: { browserAssetsDir },
      },
      { adapterType: 'express' },
    );

    try {
      await expect(context.service.onApplicationBootstrap()).rejects.toThrow(
        'Unsupported Nest HTTP adapter "express". Only "fastify" is supported.',
      );
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('composes asset serving, SSR routing, and API bypass in a real Nest Fastify app', async () => {
    const ssrFixture = await setupAngularSsrFixture();
    const browserAssetsDir = await createTempAssetsDir({
      'main.js': 'console.log("asset");',
    });
    const realRenderer = createAngularSsrRenderer();
    const renderer = {
      render: vi.fn((request: Request) => realRenderer.render(request)),
    };
    const app = await createRealModuleFixture({
      integration: { renderer },
      routing: {
        browserAssetsDir,
        apiPrefix: '/api',
      },
    });

    try {
      const fastify = app.getHttpAdapter().getInstance() as unknown as {
        inject(options: {
          method: string;
          url: string;
          headers?: Record<string, string>;
        }): Promise<{ statusCode: number; body: string }>;
        ready(): Promise<void>;
      };

      await fastify.ready();

      const assetResponse = await fastify.inject({
        method: 'GET',
        url: '/main.js',
      });
      const ssrResponse = await fastify.inject({
        method: 'GET',
        url: '/',
        headers: { host: 'localhost' },
      });
      const apiResponse = await fastify.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(assetResponse.statusCode).toBe(200);
      expect(assetResponse.body).toBe('console.log("asset");');

      expect(ssrResponse.statusCode).toBe(200);
      expect(ssrResponse.body).toContain('SSR Fixture');

      expect(apiResponse.statusCode).toBe(200);
      expect(apiResponse.body).toBe('ok');

      expect(renderer.render).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
      ssrFixture.cleanup();
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });
});

function createBootstrapServiceContext(
  options: Readonly<BootstrapNestAngularSsrOptions<unknown>>,
  config: { adapterType?: string; globalPrefix?: string } = {},
) {
  const fastify = {
    register: vi.fn().mockResolvedValue(undefined),
    route: vi.fn(),
  };
  const httpAdapterHost = {
    httpAdapter: {
      getType: () => config.adapterType ?? 'fastify',
      getInstance: () => fastify,
    },
  } as HttpAdapterHost;
  const applicationConfig = new ApplicationConfig();

  if (config.globalPrefix !== undefined) {
    applicationConfig.setGlobalPrefix(config.globalPrefix);
  }

  return {
    fastify,
    service: new NestAngularSsrModuleBootstrapService(
      options,
      httpAdapterHost,
      applicationConfig,
    ),
  };
}

function createModuleOptions(
  browserAssetsDir: string,
  routingOverrides: Partial<NestAngularSsrModuleOptions['routing']> = {},
): NestAngularSsrModuleOptions {
  return {
    routing: {
      browserAssetsDir,
      ...routingOverrides,
    },
  };
}

function getOptionsProvider(
  dynamicModule: DynamicModule,
): FactoryProvider | ValueProvider {
  const provider = dynamicModule.providers?.find(
    (candidate): candidate is FactoryProvider | ValueProvider =>
      typeof candidate === 'object' &&
      candidate !== null &&
      'provide' in candidate &&
      candidate.provide === NEST_ANGULAR_SSR_MODULE_OPTIONS,
  );

  if (!provider) {
    throw new Error('NestAngularSsrModule options provider was not registered.');
  }

  return provider;
}

async function createRealModuleFixture(
  options: Readonly<NestAngularSsrModuleOptions>,
): Promise<NestFastifyApplication> {
  class HealthController {
    getHealth() {
      return 'ok';
    }
  }
  Get('health')(
    HealthController.prototype,
    'getHealth',
    Object.getOwnPropertyDescriptor(HealthController.prototype, 'getHealth')!,
  );
  Controller('api')(HealthController);

  class FixtureModule {}
  Module({
    imports: [NestAngularSsrModule.forRoot(options)],
    controllers: [HealthController],
  })(FixtureModule);

  const app = await NestFactory.create<NestFastifyApplication>(
    FixtureModule,
    new FastifyAdapter(),
    { logger: false, abortOnError: false },
  );

  await app.init();

  return app;
}

async function createTempAssetsDir(files: Record<string, string> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'nest-angular-ssr-module-'));

  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      await writeFile(join(directory, path), content);
    }),
  );

  return directory;
}
