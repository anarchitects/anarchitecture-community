import '@angular/compiler';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createAngularSsrRenderer } from '../core/angular-node-ssr-renderer.js';
import { setupAngularSsrFixture } from '../../testing/angular-ssr-fixture.js';
import { createNestFastifyFixture } from '../../testing/nest-fastify-fixture.js';
import { bootstrapNestAngularSsr } from './nest-angular-ssr-bootstrap.js';
import type { INestApplication } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

describe('bootstrapNestAngularSsr', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the integration with the provided integration options', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const renderer = {
      render: vi.fn().mockResolvedValue(null),
    };
    const app = createMockApp();

    try {
      const integration = await bootstrapNestAngularSsr(app, {
        integration: { renderer },
        routing: { browserAssetsDir },
      });

      expect(integration.renderer).toBe(renderer);
      expect(app.fastify.register).toHaveBeenCalledTimes(1);
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('registers routes with the provided routing options', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const app = createMockApp();
    const renderer = {
      render: vi.fn().mockResolvedValue(null),
    };

    try {
      await bootstrapNestAngularSsr(app, {
        integration: { renderer },
        routing: {
          browserAssetsDir,
          apiPrefix: '/api',
        },
      });

      expect(app.fastify.register).toHaveBeenCalledTimes(1);
      expect(app.fastify.route).toHaveBeenCalledTimes(2);

      const assetResponse = await invokeRegisteredRoute(app, '/logo.svg');
      const apiResponse = await invokeRegisteredRoute(app, '/api/health');

      expect(assetResponse.reply.sendFile).not.toHaveBeenCalled();
      expect(apiResponse.reply.callNotFound).toHaveBeenCalledTimes(1);
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('returns the created integration object', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const app = createMockApp();
    const renderer = {
      render: vi.fn().mockResolvedValue(null),
    };

    try {
      const integration = await bootstrapNestAngularSsr(app, {
        integration: { renderer },
        routing: { browserAssetsDir },
      });

      expect(integration.adapter).toBe('fastify');
      expect(typeof integration.handle).toBe('function');
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('surfaces integration creation errors unchanged', async () => {
    const browserAssetsDir = await createTempAssetsDir();
    const app = createMockApp('express');

    try {
      await expect(
        bootstrapNestAngularSsr(app, {
          routing: { browserAssetsDir },
        }),
      ).rejects.toThrow('Unsupported Nest HTTP adapter "express"');
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it('surfaces route registration errors unchanged', async () => {
    const missingAssetsDir = join(
      tmpdir(),
      `nest-angular-ssr-missing-${Date.now()}`,
    );
    const app = createMockApp();
    const renderer = {
      render: vi.fn().mockResolvedValue(null),
    };

    await expect(
      bootstrapNestAngularSsr(app, {
        integration: { renderer },
        routing: { browserAssetsDir: missingAssetsDir },
      }),
    ).resolves.toBeDefined();

    const result = await invokeRegisteredRoute(app, '/missing.css');

    expect(result.reply.callNotFound).toHaveBeenCalledTimes(1);
  });

  it('composes the real integration and routing helpers in a real Nest Fastify app', async () => {
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

      await bootstrapNestAngularSsr(app, {
        integration: { renderer },
        routing: {
          browserAssetsDir,
          apiPrefix: '/api',
        },
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
        headers: { host: 'localhost' },
      });
      const apiResponse = await nestFixture.inject({
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
      await nestFixture.close();
      ssrFixture.cleanup();
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });
});

function createMockApp(adapterType = 'fastify') {
  const routes: MockFastifyRoute[] = [];
  const fastify = {
    register: vi.fn().mockResolvedValue(undefined),
    route: vi.fn((route: MockFastifyRoute) => {
      routes.push(route);
    }),
  };

  return {
    fastify,
    routes,
    getHttpAdapter: () => ({
      getType: () => adapterType,
      getInstance: () => fastify,
    }),
  } as unknown as INestApplication & {
    fastify: {
      register: ReturnType<typeof vi.fn>;
      route: ReturnType<typeof vi.fn>;
    };
    routes: MockFastifyRoute[];
  };
}

type MockFastifyRoute = {
  method: string[];
  url: string;
  handler: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => unknown | Promise<unknown>;
};

async function invokeRegisteredRoute(
  app: ReturnType<typeof createMockApp>,
  url: string,
) {
  const route = app.routes.find(
    (candidate) => candidate.url === (url === '/' ? '/' : '/*'),
  );

  if (!route) {
    throw new Error(`No route registered for ${url}`);
  }

  const reply = {
    sendFile: vi.fn().mockResolvedValue(undefined),
    callNotFound: vi.fn().mockReturnValue(undefined),
  } as unknown as FastifyReply & {
    sendFile: ReturnType<typeof vi.fn>;
    callNotFound: ReturnType<typeof vi.fn>;
  };

  await route.handler(
    {
      method: 'GET',
      url,
      raw: { url } as FastifyRequest['raw'],
    } as FastifyRequest,
    reply,
  );

  return { reply };
}

async function createTempAssetsDir(files: Record<string, string> = {}) {
  const directory = await mkdtemp(
    join(tmpdir(), 'nest-angular-ssr-bootstrap-'),
  );

  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      await writeFile(join(directory, path), content);
    }),
  );

  return directory;
}
