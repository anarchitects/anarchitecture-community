import '@angular/compiler';

import type { AngularNodeAppEngine } from '@angular/ssr/node';
import type { INestApplication } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';

import {
  AngularNodeSsrRenderer,
  type AngularNodeSsrRendererOptions,
} from '../core/angular-node-ssr-renderer.js';
import type { AngularSsrRenderer } from '../core/angular-ssr-contract.js';
import { setupAngularSsrFixture } from '../../testing/angular-ssr-fixture.js';
import { createNestFastifyFixture } from '../../testing/nest-fastify-fixture.js';
import {
  createNestAngularSsrIntegration,
  UnsupportedNestHttpAdapterError,
} from './nest-angular-ssr-integration.js';

describe('createNestAngularSsrIntegration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects the Fastify adapter', () => {
    const renderer = createMockRenderer();

    const integration = createNestAngularSsrIntegration(createMockApp(), {
      renderer,
    });

    expect(integration.adapter).toBe('fastify');
    expect(integration.renderer).toBe(renderer);
  });

  it('fails fast for unsupported adapters', () => {
    expect(() =>
      createNestAngularSsrIntegration(createMockApp('express')),
    ).toThrow(UnsupportedNestHttpAdapterError);
    expect(() =>
      createNestAngularSsrIntegration(createMockApp('express')),
    ).toThrow('Unsupported Nest HTTP adapter "express"');
  });

  it('uses an injected renderer when provided', async () => {
    const renderer = createMockRenderer(new Response('ok'));
    const integration = createNestAngularSsrIntegration(createMockApp(), {
      renderer,
    });

    await integration.handle(createMockRequest(), createMockReply());

    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it('creates a default renderer from rendererOptions', async () => {
    const engine = {
      handle: vi.fn().mockResolvedValue(new Response('ok')),
    } as unknown as AngularNodeAppEngine;
    const integration = createNestAngularSsrIntegration(createMockApp(), {
      rendererOptions: { engine },
    });

    expect(integration.renderer).toBeInstanceOf(AngularNodeSsrRenderer);

    await integration.handle(createMockRequest(), createMockReply());

    expect(engine.handle).toHaveBeenCalledTimes(1);
  });

  it('forwards a derived request context unchanged', async () => {
    const renderer = createMockRenderer(null);
    const reply = createMockReply();
    const createRequestContext = vi.fn().mockResolvedValue({ requestId: '1' });
    const integration = createNestAngularSsrIntegration(createMockApp(), {
      renderer,
      createRequestContext,
    });

    const handled = await integration.handle(
      createMockRequest({
        protocol: 'https',
        headers: {
          host: 'example.com',
          'x-forwarded-proto': 'https',
          'x-trace-id': 'trace-1',
        },
        raw: { url: '/docs?section=ssr' } as FastifyRequest['raw'],
      }),
      reply,
    );

    expect(handled).toBe(false);
    expect(createRequestContext).toHaveBeenCalledWith(
      expect.any(Object),
      reply,
    );
    expect(renderer.render).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/docs?section=ssr',
      }),
      { requestId: '1' },
    );
  });

  it('attaches a request body for non-GET requests', async () => {
    const renderer = createMockRenderer(null);
    const integration = createNestAngularSsrIntegration(createMockApp(), {
      renderer,
    });
    const raw = Object.assign(Readable.from('payload'), {
      url: '/submit',
    });

    await integration.handle(
      createMockRequest({
        method: 'POST',
        headers: {
          host: 'example.com',
          'content-type': 'text/plain',
        },
        raw: raw as unknown as FastifyRequest['raw'],
      }),
      createMockReply(),
    );

    const request = renderer.render.mock.calls[0]?.[0];

    expect(request).toBeInstanceOf(Request);
    await expect(request?.text()).resolves.toBe('payload');
  });

  it('returns false and leaves the reply untouched when SSR does not handle the request', async () => {
    const renderer = createMockRenderer(null);
    const reply = createMockReply();
    const integration = createNestAngularSsrIntegration(createMockApp(), {
      renderer,
    });

    await expect(integration.handle(createMockRequest(), reply)).resolves.toBe(
      false,
    );
    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.header).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('writes status, headers, and body when SSR handles the request', async () => {
    const renderer = createMockRenderer(
      new Response('rendered html', {
        status: 202,
        headers: {
          'content-type': 'text/html',
          'x-ssr': '1',
        },
      }),
    );
    const reply = createMockReply();
    const integration = createNestAngularSsrIntegration(createMockApp(), {
      renderer,
    });

    await expect(integration.handle(createMockRequest(), reply)).resolves.toBe(
      true,
    );
    expect(reply.code).toHaveBeenCalledWith(202);
    expect(reply.header).toHaveBeenCalledWith('content-type', 'text/html');
    expect(reply.header).toHaveBeenCalledWith('x-ssr', '1');
    expect(reply.send).toHaveBeenCalledWith(Buffer.from('rendered html'));
  });

  it('rejects ambiguous renderer configuration', () => {
    const renderer = createMockRenderer();
    const rendererOptions: AngularNodeSsrRendererOptions = {
      engine: {
        handle: vi.fn(),
      } as unknown as AngularNodeAppEngine,
    };

    expect(() =>
      createNestAngularSsrIntegration(createMockApp(), {
        renderer,
        rendererOptions,
      }),
    ).toThrow(
      'Cannot provide both "renderer" and "rendererOptions" to createNestAngularSsrIntegration.',
    );
  });

  it('bridges a real Nest Fastify request to SSR', async () => {
    const ssrFixture = await setupAngularSsrFixture();
    const nestFixture = await createNestFastifyFixture((app, fastify) => {
      const integration = createNestAngularSsrIntegration(app);

      fastify.get('/', async (request, reply) => {
        const handled = await integration.handle(request, reply);

        if (!handled) {
          await reply.code(404).send('miss');
        }
      });
    });

    try {
      const response = await nestFixture.inject({
        method: 'GET',
        url: '/',
        headers: {
          host: 'localhost',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('SSR Fixture');
      expect(response.body).toContain('Angular SSR core fixture');
    } finally {
      await nestFixture.close();
      ssrFixture.cleanup();
    }
  });
});

function createMockApp(adapterType = 'fastify'): INestApplication {
  return {
    getHttpAdapter: () => ({
      getType: () => adapterType,
    }),
  } as unknown as INestApplication;
}

function createMockRenderer(
  response: Response | null = new Response('ok'),
): AngularSsrRenderer<unknown> & {
  render: ReturnType<typeof vi.fn>;
} {
  return {
    render: vi.fn().mockResolvedValue(response),
  };
}

function createMockRequest(
  overrides: Record<string, unknown> = {},
): FastifyRequest {
  return {
    method: 'GET',
    protocol: 'http',
    headers: {
      host: 'localhost',
    },
    hostname: 'localhost',
    url: '/',
    raw: { url: '/' } as FastifyRequest['raw'],
    ...overrides,
  } as unknown as FastifyRequest;
}

function createMockReply(): FastifyReply {
  const reply = {
    code: vi.fn(),
    header: vi.fn(),
    send: vi.fn().mockResolvedValue(undefined),
  };

  reply.code.mockReturnValue(reply);
  reply.header.mockReturnValue(reply);

  return reply as unknown as FastifyReply;
}
