import '@angular/compiler';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createAngularSsrRenderer } from '../core/angular-node-ssr-renderer.js';
import { setupAngularSsrFixture } from '../../testing/angular-ssr-fixture.js';
import { createNestFastifyFixture } from '../../testing/nest-fastify-fixture.js';
import {
  createNestAngularSsrIntegration,
  type NestAngularSsrIntegration,
} from './nest-angular-ssr-integration.js';
import {
  registerNestAngularSsrRoutes,
  type RegisterNestAngularSsrRoutesOptions,
} from './nest-angular-ssr-routing.js';
import type { INestApplication } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

type MockFastifyRoute = {
  method: string[];
  url: string;
  handler: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => unknown | Promise<unknown>;
};

describe('registerNestAngularSsrRoutes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('honors an explicit apiPrefix override', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const integration = createMockIntegration();
    const context = createMockRoutingContext({
      config: { getGlobalPrefix: () => 'internal' },
    });

    try {
      await registerNestAngularSsrRoutes(
        context.app,
        integration,
        createRoutingOptions(browserAssetsDir, { apiPrefix: '/api' }),
      );

      await invokeRoute(context, '/api/users');

      expect(integration.handle).not.toHaveBeenCalled();
      expect(context.reply.callNotFound).toHaveBeenCalledTimes(1);
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('uses the Nest global prefix when available', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const integration = createMockIntegration();
    const context = createMockRoutingContext({
      config: { getGlobalPrefix: () => 'backend' },
    });

    try {
      await registerNestAngularSsrRoutes(
        context.app,
        integration,
        createRoutingOptions(browserAssetsDir),
      );

      await invokeRoute(context, '/backend/users');

      expect(integration.handle).not.toHaveBeenCalled();
      expect(context.reply.callNotFound).toHaveBeenCalledTimes(1);
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('defaults to no API boundary when no prefix is configured', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const integration = createMockIntegration(true);
    const context = createMockRoutingContext();

    try {
      await registerNestAngularSsrRoutes(
        context.app,
        integration,
        createRoutingOptions(browserAssetsDir),
      );

      await invokeRoute(context, '/api/users');

      expect(integration.handle).toHaveBeenCalledTimes(1);
      expect(context.reply.callNotFound).not.toHaveBeenCalled();
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('serves an existing browser asset directly without SSR handling', async () => {
    const browserAssetsDir = await createTempAssetsDir({
      'main.js': 'console.log("asset");',
    });
    const integration = createMockIntegration(true);
    const context = createMockRoutingContext();

    try {
      await registerNestAngularSsrRoutes(
        context.app,
        integration,
        createRoutingOptions(browserAssetsDir),
      );

      await invokeRoute(context, '/main.js');

      expect(context.reply.sendFile).toHaveBeenCalledWith('main.js');
      expect(integration.handle).not.toHaveBeenCalled();
      expect(context.reply.callNotFound).not.toHaveBeenCalled();
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('calls not found for missing asset-like requests without SSR handling', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const integration = createMockIntegration(true);
    const context = createMockRoutingContext();

    try {
      await registerNestAngularSsrRoutes(
        context.app,
        integration,
        createRoutingOptions(browserAssetsDir),
      );

      await invokeRoute(context, '/missing.css');

      expect(integration.handle).not.toHaveBeenCalled();
      expect(context.reply.sendFile).not.toHaveBeenCalled();
      expect(context.reply.callNotFound).toHaveBeenCalledTimes(1);
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('routes non-API extensionless requests through SSR', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const integration = createMockIntegration(true);
    const context = createMockRoutingContext();

    try {
      await registerNestAngularSsrRoutes(
        context.app,
        integration,
        createRoutingOptions(browserAssetsDir),
      );

      await invokeRoute(context, '/docs');

      expect(integration.handle).toHaveBeenCalledTimes(1);
      expect(context.reply.callNotFound).not.toHaveBeenCalled();
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('calls not found when SSR does not handle the request', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const integration = createMockIntegration(false);
    const context = createMockRoutingContext();

    try {
      await registerNestAngularSsrRoutes(
        context.app,
        integration,
        createRoutingOptions(browserAssetsDir),
      );

      await invokeRoute(context, '/docs');

      expect(integration.handle).toHaveBeenCalledTimes(1);
      expect(context.reply.callNotFound).toHaveBeenCalledTimes(1);
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('rejects path traversal attempts outside the browser asset root', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const integration = createMockIntegration(true);
    const context = createMockRoutingContext();

    try {
      await registerNestAngularSsrRoutes(
        context.app,
        integration,
        createRoutingOptions(browserAssetsDir),
      );

      await invokeRoute(context, '/%2e%2e/secret.txt');

      expect(integration.handle).not.toHaveBeenCalled();
      expect(context.reply.sendFile).not.toHaveBeenCalled();
      expect(context.reply.callNotFound).toHaveBeenCalledTimes(1);
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('serves assets, SSR routes, API routes, and missing assets correctly in a real Nest Fastify fixture', async () => {
    const ssrFixture = await setupAngularSsrFixture();
    const browserAssetsDir = await createTempAssetsDir({
      'main.js': 'console.log("asset");',
    });
    const realRenderer = createAngularSsrRenderer();
    const renderer = {
      render: vi.fn((request: Request) => realRenderer.render(request)),
    };
    const nestFixture = await createNestFastifyFixture(async (app, fastify) => {
      fastify.get('/api/health', async (_request, reply) => {
        await reply.send('ok');
      });

      const integration = createNestAngularSsrIntegration(app, { renderer });

      await registerNestAngularSsrRoutes(app, integration, {
        browserAssetsDir,
        apiPrefix: '/api',
      });
    });

    try {
      const assetResponse = await nestFixture.inject({
        method: 'GET',
        url: '/main.js',
      });
      const ssrResponse = await nestFixture.inject({
        method: 'GET',
        url: '/',
        headers: {
          host: 'localhost',
        },
      });
      const missingAssetResponse = await nestFixture.inject({
        method: 'GET',
        url: '/missing.css',
      });
      const apiResponse = await nestFixture.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(assetResponse.statusCode).toBe(200);
      expect(assetResponse.body).toBe('console.log("asset");');

      expect(ssrResponse.statusCode).toBe(200);
      expect(ssrResponse.body).toContain('SSR Fixture');

      expect(missingAssetResponse.statusCode).toBe(404);

      expect(apiResponse.statusCode).toBe(200);
      expect(apiResponse.body).toBe('ok');

      expect(renderer.render).toHaveBeenCalledTimes(1);
    } finally {
      await nestFixture.close();
      ssrFixture.cleanup();
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });
});

function createMockRoutingContext(overrides: {
  config?: { getGlobalPrefix?: () => string };
} = {}) {
  const routes: MockFastifyRoute[] = [];
  const fastify = {
    register: vi.fn().mockResolvedValue(undefined),
    route: vi.fn((route: MockFastifyRoute) => {
      routes.push(route);
    }),
  };
  const app = {
    getHttpAdapter: () => ({
      getInstance: () => fastify,
    }),
    ...overrides,
  } as unknown as INestApplication;
  const reply = createMockRoutingReply();

  return {
    app,
    fastify,
    routes,
    reply,
  };
}

function createMockIntegration(
  handled: boolean = true,
): NestAngularSsrIntegration<unknown> & {
  handle: ReturnType<typeof vi.fn>;
} {
  return {
    adapter: 'fastify',
    renderer: {
      render: vi.fn(),
    },
    handle: vi.fn().mockResolvedValue(handled),
  };
}

function createMockRoutingReply(): FastifyReply & {
  sendFile: ReturnType<typeof vi.fn>;
  callNotFound: ReturnType<typeof vi.fn>;
} {
  return {
    sendFile: vi.fn().mockResolvedValue(undefined),
    callNotFound: vi.fn().mockReturnValue(undefined),
  } as unknown as FastifyReply & {
    sendFile: ReturnType<typeof vi.fn>;
    callNotFound: ReturnType<typeof vi.fn>;
  };
}

function createRoutingOptions(
  browserAssetsDir: string,
  overrides: Partial<RegisterNestAngularSsrRoutesOptions> = {},
): RegisterNestAngularSsrRoutesOptions {
  return {
    browserAssetsDir,
    ...overrides,
  };
}

async function invokeRoute(
  context: ReturnType<typeof createMockRoutingContext>,
  url: string,
) {
  const route = selectRoute(context.routes, url);

  await route.handler(
    {
      method: 'GET',
      url,
      raw: { url } as FastifyRequest['raw'],
    } as FastifyRequest,
    context.reply,
  );
}

function selectRoute(routes: MockFastifyRoute[], url: string): MockFastifyRoute {
  const route = routes.find((candidate) => candidate.url === (url === '/' ? '/' : '/*'));

  if (!route) {
    throw new Error(`No route handler registered for ${url}`);
  }

  return route;
}

async function createTempAssetsDir(files: Record<string, string> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'nest-angular-ssr-assets-'));

  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      await writeFile(join(directory, path), content);
    }),
  );

  return directory;
}
