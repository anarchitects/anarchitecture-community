import {
  type AngularNodeSsrRendererOptions,
  createAngularSsrRenderer,
} from '../core/angular-node-ssr-renderer.js';
import type { AngularSsrRenderer } from '../core/angular-ssr-contract.js';
import type { INestApplication } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

type SupportedNestHttpAdapter = 'fastify';

type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[];
};

export interface NestAngularSsrIntegration<TContext = unknown> {
  readonly adapter: SupportedNestHttpAdapter;
  readonly renderer: AngularSsrRenderer<TContext>;
  handle(request: FastifyRequest, reply: FastifyReply): Promise<boolean>;
}

export interface CreateNestAngularSsrIntegrationOptions<TContext = unknown> {
  renderer?: AngularSsrRenderer<TContext>;
  rendererOptions?: AngularNodeSsrRendererOptions;
  createRequestContext?: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => TContext | Promise<TContext>;
}

export class UnsupportedNestHttpAdapterError extends Error {
  constructor(readonly adapterType: string) {
    super(
      `Unsupported Nest HTTP adapter "${adapterType}". Only "fastify" is supported.`,
    );
    this.name = 'UnsupportedNestHttpAdapterError';
  }
}

export function createNestAngularSsrIntegration<TContext = unknown>(
  app: INestApplication,
  options: Readonly<CreateNestAngularSsrIntegrationOptions<TContext>> = {},
): NestAngularSsrIntegration<TContext> {
  const adapterType = app.getHttpAdapter().getType();

  if (adapterType !== 'fastify') {
    throw new UnsupportedNestHttpAdapterError(adapterType);
  }

  const renderer = resolveRenderer(options);

  return {
    adapter: 'fastify',
    renderer,
    async handle(request, reply) {
      const requestContext = options.createRequestContext
        ? await options.createRequestContext(request, reply)
        : undefined;
      const response = await renderer.render(
        createWebRequestFromFastifyRequest(request),
        requestContext,
      );

      if (response === null) {
        return false;
      }

      await writeWebResponseToFastifyReply(reply, response);

      return true;
    },
  };
}

function resolveRenderer<TContext>(
  options: Readonly<CreateNestAngularSsrIntegrationOptions<TContext>>,
): AngularSsrRenderer<TContext> {
  const { renderer, rendererOptions } = options;

  if (renderer && rendererOptions) {
    throw new Error(
      'Cannot provide both "renderer" and "rendererOptions" to createNestAngularSsrIntegration.',
    );
  }

  return renderer ?? createAngularSsrRenderer<TContext>(rendererOptions);
}

function createWebRequestFromFastifyRequest(request: FastifyRequest): Request {
  const url = createAbsoluteRequestUrl(request);
  const method = request.method.toUpperCase();
  const headers = createHeaders(request.headers);
  const init: RequestInit = {
    method,
    headers,
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = request.raw as unknown as NonNullable<RequestInit['body']>;
    init.duplex = 'half';
  }

  return new Request(url, init);
}

function createAbsoluteRequestUrl(request: FastifyRequest): URL {
  const protocol =
    getFirstHeaderValue(request.headers['x-forwarded-proto']) ??
    request.protocol ??
    'http';
  const host =
    getFirstHeaderValue(request.headers['x-forwarded-host']) ??
    request.headers.host ??
    request.hostname ??
    'localhost';
  const rawUrl = request.raw.url ?? request.url ?? '/';

  return new URL(rawUrl, `${protocol}://${host}`);
}

function createHeaders(headers: FastifyRequest['headers']): Headers {
  const result = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        result.append(name, item);
      }

      continue;
    }

    result.append(name, String(value));
  }

  return result;
}

async function writeWebResponseToFastifyReply(
  reply: FastifyReply,
  response: Response,
): Promise<void> {
  reply.code(response.status);
  writeResponseHeaders(reply, response.headers);

  if (response.body === null) {
    await reply.send();
    return;
  }

  await reply.send(Buffer.from(await response.arrayBuffer()));
}

function writeResponseHeaders(reply: FastifyReply, headers: Headers): void {
  const fetchHeaders = headers as HeadersWithSetCookie;
  const setCookies = fetchHeaders.getSetCookie?.() ?? [];

  headers.forEach((value, name) => {
    if (name === 'set-cookie') {
      return;
    }

    reply.header(name, value);
  });

  if (setCookies.length > 0) {
    reply.header('set-cookie', setCookies);
  }
}

function getFirstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
