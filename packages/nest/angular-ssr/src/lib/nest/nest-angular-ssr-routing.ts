import fastifyStatic from '@fastify/static';
import type { INestApplication } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { stat } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';

import type { NestAngularSsrIntegration } from './nest-angular-ssr-integration.js';
import type { AngularSsrObservabilityOptions } from '../core/angular-ssr-observability.js';

type FastifyStaticReply = FastifyReply & {
  sendFile(path: string): unknown;
};

type FastifyInstanceWithRouting = {
  register(plugin: unknown, options: unknown): Promise<unknown> | unknown;
  route(options: {
    method: string[];
    url: string;
    handler: (
      request: FastifyRequest,
      reply: FastifyStaticReply,
    ) => unknown | Promise<unknown>;
  }): unknown;
};

type NestApplicationWithConfig = INestApplication & {
  config?: {
    getGlobalPrefix?: () => string;
  };
};

type AssetResolution =
  | { kind: 'existing-file'; relativePath: string }
  | { kind: 'missing-asset' }
  | { kind: 'not-asset' }
  | { kind: 'outside-root' };

export interface RegisterNestAngularSsrRoutesOptions {
  browserAssetsDir?: string;
  apiPrefix?: string;
  allowedHosts?: readonly string[];
  observability?: Readonly<AngularSsrObservabilityOptions>;
}

export async function registerNestAngularSsrRoutes<TContext = unknown>(
  app: INestApplication,
  integration: NestAngularSsrIntegration<TContext>,
  options: Readonly<RegisterNestAngularSsrRoutesOptions>,
): Promise<void> {
  const fastify = app
    .getHttpAdapter()
    .getInstance() as unknown as FastifyInstanceWithRouting;
  if (!options.browserAssetsDir) {
    throw new Error(
      '"routing.browserAssetsDir" is required when registering Nest Angular SSR routes.',
    );
  }

  const browserAssetsRoot = resolve(options.browserAssetsDir);
  const effectiveApiPrefix = resolveApiPrefix(app, options.apiPrefix);
  const handler = async (
    request: FastifyRequest,
    reply: FastifyStaticReply,
  ) => {
    const pathname = getRequestPathname(request);

    if (isApiRequest(pathname, effectiveApiPrefix)) {
      return reply.callNotFound();
    }

    if (!isAllowedHost(request, options.allowedHosts)) {
      return reply
        .code(400)
        .send('The request host is not allowed for Angular SSR.');
    }

    const asset = await resolveAssetRequest(browserAssetsRoot, pathname);

    if (asset.kind === 'existing-file') {
      return reply.sendFile(asset.relativePath);
    }

    if (asset.kind === 'missing-asset' || asset.kind === 'outside-root') {
      return reply.callNotFound();
    }

    const handled = await integration.handle(request, reply);

    if (!handled) {
      return reply.callNotFound();
    }

    return reply;
  };

  await fastify.register(fastifyStatic, {
    root: browserAssetsRoot,
    serve: false,
  });

  fastify.route({
    method: ['GET', 'HEAD'],
    url: '/',
    handler,
  });
  fastify.route({
    method: ['GET', 'HEAD'],
    url: '/*',
    handler,
  });
}

function isAllowedHost(
  request: FastifyRequest,
  allowedHosts: readonly string[] | undefined,
): boolean {
  if (!allowedHosts || allowedHosts.length === 0) {
    return true;
  }

  const rawHost =
    getFirstHeaderValue(request.headers['x-forwarded-host']) ??
    request.headers.host ??
    request.hostname;

  if (!rawHost) {
    return false;
  }

  const host = rawHost.toLowerCase();
  let hostname = host;

  try {
    hostname = new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return false;
  }

  return allowedHosts.some((allowedHost) => {
    const normalized = allowedHost.trim().toLowerCase();
    return normalized === '*' || normalized === host || normalized === hostname;
  });
}

function getFirstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function resolveApiPrefix(
  app: INestApplication,
  apiPrefixOverride?: string,
): string {
  if (apiPrefixOverride !== undefined) {
    return normalizePrefix(apiPrefixOverride);
  }

  return normalizePrefix(
    (app as NestApplicationWithConfig).config?.getGlobalPrefix?.() ?? '',
  );
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim();

  if (trimmed === '' || trimmed === '/') {
    return '';
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function isApiRequest(pathname: string, apiPrefix: string): boolean {
  return (
    apiPrefix !== '' &&
    (pathname === apiPrefix || pathname.startsWith(`${apiPrefix}/`))
  );
}

function getRequestPathname(request: FastifyRequest): string {
  const rawUrl = request.raw.url ?? request.url ?? '/';

  return new URL(rawUrl, 'http://localhost').pathname;
}

async function resolveAssetRequest(
  browserAssetsRoot: string,
  pathname: string,
): Promise<AssetResolution> {
  const decodedPathname = safelyDecodePathname(pathname);

  if (decodedPathname === null) {
    return { kind: 'outside-root' };
  }

  const resolvedPath = resolve(browserAssetsRoot, `.${decodedPathname}`);
  const assetRelativePath = relative(browserAssetsRoot, resolvedPath);

  if (
    assetRelativePath === '..' ||
    assetRelativePath.startsWith(`..${sep}`) ||
    assetRelativePath === ''
  ) {
    return pathLooksLikeAsset(decodedPathname)
      ? { kind: 'missing-asset' }
      : { kind: 'not-asset' };
  }

  if (
    assetRelativePath.startsWith(`..${sep}`) ||
    assetRelativePath === '..' ||
    assetRelativePath.includes(`${sep}..${sep}`) ||
    assetRelativePath.startsWith('..')
  ) {
    return { kind: 'outside-root' };
  }

  const assetStat = await getFileStat(resolvedPath);

  if (assetStat?.isFile()) {
    return {
      kind: 'existing-file',
      relativePath: assetRelativePath.split(sep).join('/'),
    };
  }

  if (pathLooksLikeAsset(decodedPathname)) {
    return { kind: 'missing-asset' };
  }

  return { kind: 'not-asset' };
}

async function getFileStat(path: string) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

function pathLooksLikeAsset(pathname: string): boolean {
  return extname(pathname) !== '';
}

function safelyDecodePathname(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}
