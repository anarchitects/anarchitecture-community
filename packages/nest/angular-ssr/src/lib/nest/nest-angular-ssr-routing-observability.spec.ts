import 'reflect-metadata';

import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AngularSsrLifecycleEvent } from '../core/angular-ssr-observability.js';
import {
  bootstrapNestAngularSsr,
  type BootstrapNestAngularSsrOptions,
} from './nest-angular-ssr-bootstrap.js';
import { NestAngularSsrModule } from './nest-angular-ssr-module.js';
import {
  createSsrLoggingObserver,
  createSsrMetricsObserver,
  type SsrLogRecord,
} from '../../../examples/observability.js';

type BootstrapMode = 'explicit' | 'forRoot' | 'forRootAsync';

const configurations = (
  ['explicit', 'forRoot', 'forRootAsync'] as const
).flatMap((mode) =>
  [false, true].flatMap((overridePrefix) =>
    [false, true].map((observerThrows) => ({
      mode,
      overridePrefix,
      observerThrows,
    })),
  ),
);

describe('Nest Fastify routing observability', () => {
  it('bridges a complete routing/rendering journey to metrics and structured logs', async () => {
    const browserAssetsDir = await mkdtemp(join(tmpdir(), 'ssr-bridges-e2e-'));
    let app: NestFastifyApplication | undefined;
    try {
      await writeFile(join(browserAssetsDir, 'main.js'), 'browser asset');
      const events: AngularSsrLifecycleEvent[] = [];
      const records: SsrLogRecord[] = [];
      const metrics = {
        renders: { add: vi.fn() },
        failures: { add: vi.fn() },
        fallbacks: { add: vi.fn() },
        duration: { record: vi.fn() },
      };
      const measure = createSsrMetricsObserver(metrics);
      const log = createSsrLoggingObserver((record) => records.push(record));
      const failure = new Error('private user data must not reach the log');
      app = await createObservedApp(
        'explicit',
        {
          integration: {
            rendererOptions: {
              engine: {
                handle: async (request) => {
                  const pathname = new URL(request.url).pathname;
                  if (pathname === '/declined') return null;
                  if (pathname === '/failure') throw failure;
                  return new Response('rendered HTML');
                },
              },
            },
          },
          routing: { browserAssetsDir, allowedHosts: ['localhost'] },
          observability: {
            applicationId: 'storefront',
            observer(event) {
              events.push(event);
              measure(event);
              log(event);
            },
          },
        },
        'api',
      );
      const fastify = app.getHttpAdapter().getInstance();
      const results = [];
      for (const url of [
        '/success?token=secret',
        '/declined',
        '/failure',
        '/api/health',
        '/main.js',
        '/blocked',
      ]) {
        results.push(
          await fastify.inject({
            method: 'GET',
            url,
            headers: {
              host: url === '/blocked' ? 'rejected.example' : 'localhost',
            },
          }),
        );
      }
      expect(results.map((response) => response.statusCode)).toEqual([
        200, 404, 500, 200, 200, 400,
      ]);
      expect(results[0].body).toBe('rendered HTML');
      expect(results[3].body).toBe('ok');
      expect(results[4].body).toBe('browser asset');
      expect(
        events.map((event) => [event.type, event.request.pathname]),
      ).toEqual([
        ['ssr.render.start', '/success'],
        ['ssr.render.success', '/success'],
        ['ssr.render.start', '/declined'],
        ['ssr.render.null', '/declined'],
        ['ssr.render.start', '/failure'],
        ['ssr.render.error', '/failure'],
        ['ssr.api.bypass', '/api/health'],
        ['ssr.asset.served', '/main.js'],
        ['ssr.host.rejected', '/blocked'],
      ]);
      expect(metrics.renders.add.mock.calls).toEqual(
        Array.from({ length: 3 }, () => [
          1,
          { method: 'GET', application: 'storefront' },
        ]),
      );
      expect(metrics.failures.add).toHaveBeenCalledExactlyOnceWith(1, {
        method: 'GET',
        application: 'storefront',
      });
      expect(metrics.fallbacks.add).toHaveBeenCalledExactlyOnceWith(1, {
        method: 'GET',
        application: 'storefront',
      });
      expect(
        metrics.duration.record.mock.calls.map(([seconds, labels]) => {
          expect(seconds).toBeGreaterThanOrEqual(0);
          return labels.outcome;
        }),
      ).toEqual(['success', 'null', 'error']);
      expect(records.map((record) => record.event)).toEqual(
        events.map((event) => event.type),
      );
      expect(
        records.find((record) => record.event === 'ssr.render.error'),
      ).toEqual({
        event: 'ssr.render.error',
        level: 'error',
        timestamp: expect.any(Number),
        durationMs: expect.any(Number),
        applicationId: 'storefront',
        method: 'GET',
      });
      expect(JSON.stringify(records)).not.toMatch(
        /secret|private user|requestId|pathname/,
      );
    } finally {
      await app?.close();
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });

  it.each(configurations)(
    '$mode: explicit prefix=$overridePrefix, throwing observer=$observerThrows',
    async ({ mode, overridePrefix, observerThrows }) => {
      const browserAssetsDir = await mkdtemp(
        join(tmpdir(), 'ssr-observability-'),
      );
      let app: NestFastifyApplication | undefined;
      try {
        await writeFile(
          join(browserAssetsDir, 'main.js'),
          'console.log("asset");',
        );
        const events: AngularSsrLifecycleEvent[] = [];
        const observerFailure = new Error('observer failed');
        const onObserverError = vi.fn(() => {
          throw new Error('error hook failed');
        });
        const renderFailure = new Error('render failed');
        const handle = vi.fn(async (request: Request) => {
          // Selection is complete before the engine sees the request, and
          // the renderer alone emits the acceptance/start signal.
          expect(events.map((event) => event.type)).toEqual([
            'ssr.render.start',
          ]);
          const pathname = new URL(request.url).pathname;
          if (pathname === '/declined') return null;
          if (pathname === '/failure') throw renderFailure;
          return new Response(request.method === 'HEAD' ? null : 'rendered', {
            status: 202,
          });
        });
        const options: BootstrapNestAngularSsrOptions = {
          integration: { rendererOptions: { engine: { handle } } },
          routing: {
            browserAssetsDir,
            allowedHosts: ['localhost'],
            ...(overridePrefix ? { apiPrefix: '/api/' } : {}),
          },
          observability: {
            applicationId: 'storefront',
            observer(event) {
              events.push(event);
              if (observerThrows) throw observerFailure;
            },
            onObserverError,
          },
        };
        app = await createObservedApp(
          mode,
          options,
          overridePrefix ? 'internal' : 'api',
        );
        const fastify = app.getHttpAdapter().getInstance();

        const cases = [
          {
            url: '/api/health?secret=1',
            status: 200,
            body: 'ok',
            types: ['ssr.api.bypass'],
          },
          {
            url: '/api/native',
            method: 'POST',
            status: 200,
            body: 'native',
            types: ['ssr.api.bypass'],
          },
          { url: '/api/missing', status: 404, types: ['ssr.api.bypass'] },
          { url: '/api', status: 404, types: ['ssr.api.bypass'] },
          {
            url: '/api/health',
            host: 'rejected.example',
            status: 200,
            body: 'ok',
            types: ['ssr.api.bypass'],
          },
          {
            url: '/main.js?version=1',
            status: 200,
            body: 'console.log("asset");',
            types: ['ssr.asset.served'],
          },
          {
            url: '/main.js',
            method: 'HEAD',
            status: 200,
            body: '',
            types: ['ssr.asset.served'],
          },
          {
            url: '/blocked',
            host: 'rejected.example',
            status: 400,
            body: 'The request host is not allowed for Angular SSR.',
            types: ['ssr.host.rejected'],
          },
          {
            url: '/main.js',
            host: 'rejected.example',
            status: 400,
            body: 'The request host is not allowed for Angular SSR.',
            types: ['ssr.host.rejected'],
          },
          { url: '/missing.css', status: 404, types: [] },
          { url: '/%2e%2e%2fsecret.txt', status: 404, types: [] },
          {
            url: '/',
            status: 202,
            body: 'rendered',
            types: ['ssr.render.start', 'ssr.render.success'],
          },
          {
            url: '/docs?token=secret',
            method: 'HEAD',
            status: 202,
            body: '',
            types: ['ssr.render.start', 'ssr.render.success'],
          },
          {
            url: '/apian',
            status: 202,
            body: 'rendered',
            types: ['ssr.render.start', 'ssr.render.success'],
          },
          {
            url: '/declined',
            status: 404,
            types: ['ssr.render.start', 'ssr.render.null'],
          },
          {
            url: '/failure',
            status: 500,
            types: ['ssr.render.start', 'ssr.render.error'],
          },
        ] as const;

        for (const scenario of cases) {
          events.length = 0;
          handle.mockClear();
          onObserverError.mockClear();
          const method = 'method' in scenario ? scenario.method : 'GET';
          const response = await fastify.inject({
            method,
            url: scenario.url,
            headers: {
              host: 'host' in scenario ? scenario.host : 'localhost',
              authorization: 'secret',
            },
          });

          expect(response.statusCode, scenario.url).toBe(scenario.status);
          if ('body' in scenario) expect(response.body).toBe(scenario.body);
          if (scenario.status === 404)
            expect(response.json()).toMatchObject({
              statusCode: 404,
              error: 'Not Found',
            });
          if (scenario.status === 500)
            expect(response.json()).toMatchObject({
              statusCode: 500,
              message: 'Internal server error',
            });
          expect(
            events.map((event) => event.type),
            scenario.url,
          ).toEqual(scenario.types);
          const renders = scenario.types.some(
            (type) => type === 'ssr.render.start',
          );
          expect(handle).toHaveBeenCalledTimes(renders ? 1 : 0);
          for (const event of events) {
            expect(event.applicationId).toBe('storefront');
            expect(event.timestamp).toEqual(expect.any(Number));
            expect(event.request).toEqual({
              method,
              pathname: new URL(scenario.url, 'http://localhost').pathname,
              ...(renders ? {} : { requestId: 'host-request-id' }),
            });
            if (event.type === 'ssr.render.error')
              expect(event.error).toBe(renderFailure);
          }
          expect(onObserverError).toHaveBeenCalledTimes(
            observerThrows ? events.length : 0,
          );
          if (observerThrows) {
            for (const event of events)
              expect(onObserverError).toHaveBeenCalledWith(
                observerFailure,
                event,
              );
          }
        }
      } finally {
        await app?.close();
        await rm(browserAssetsDir, { recursive: true, force: true });
      }
    },
  );

  it.each([false, true])(
    'renders API-like paths when the prefix is empty (override=%s)',
    async (override) => {
      const browserAssetsDir = await mkdtemp(
        join(tmpdir(), 'ssr-empty-prefix-'),
      );
      let app: NestFastifyApplication | undefined;
      try {
        const observer = vi.fn();
        const handle = vi.fn().mockResolvedValue(new Response('rendered'));
        app = await createObservedApp(
          'explicit',
          {
            integration: { rendererOptions: { engine: { handle } } },
            routing: {
              browserAssetsDir,
              ...(override ? { apiPrefix: '/' } : {}),
            },
            observability: { observer },
          },
          override ? 'api' : '',
        );

        const response = await app
          .getHttpAdapter()
          .getInstance()
          .inject({ method: 'GET', url: '/api/docs' });

        expect(response.statusCode).toBe(200);
        expect(response.body).toBe('rendered');
        expect(handle).toHaveBeenCalledTimes(1);
        expect(observer.mock.calls.map(([event]) => event.type)).toEqual([
          'ssr.render.start',
          'ssr.render.success',
        ]);
      } finally {
        await app?.close();
        await rm(browserAssetsDir, { recursive: true, force: true });
      }
    },
  );

  it('does not install an API observation hook without an observer', async () => {
    const browserAssetsDir = await mkdtemp(join(tmpdir(), 'ssr-no-observer-'));
    const addHook = vi.fn();
    const app = {
      getHttpAdapter: () => ({
        getType: () => 'fastify',
        getInstance: () => ({ addHook, register: vi.fn(), route: vi.fn() }),
      }),
    } as unknown as NestFastifyApplication;
    try {
      await bootstrapNestAngularSsr(app, {
        routing: { browserAssetsDir, apiPrefix: '/api' },
      });
      expect(addHook).not.toHaveBeenCalled();
    } finally {
      await rm(browserAssetsDir, { recursive: true, force: true });
    }
  });
});

async function createObservedApp(
  mode: BootstrapMode,
  options: BootstrapNestAngularSsrOptions,
  globalPrefix: string,
): Promise<NestFastifyApplication> {
  class HealthController {
    health() {
      return 'ok';
    }
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    HealthController.prototype,
    'health',
  );
  if (!descriptor) throw new Error('Missing health handler');
  Get('health')(HealthController.prototype, 'health', descriptor);
  Controller()(HealthController);

  class FixtureModule {}
  Module({
    controllers: [HealthController],
    imports:
      mode === 'explicit'
        ? []
        : [
            mode === 'forRoot'
              ? NestAngularSsrModule.forRoot(options)
              : NestAngularSsrModule.forRootAsync({
                  useFactory: async () => options,
                }),
          ],
  })(FixtureModule);
  const app = await NestFactory.create<NestFastifyApplication>(
    FixtureModule,
    new FastifyAdapter({ genReqId: () => 'host-request-id' }),
    { logger: false, abortOnError: false },
  );
  try {
    app.setGlobalPrefix(globalPrefix);
    const fastify = app.getHttpAdapter().getInstance();
    // Also cover routes registered before the SSR hook and explicit prefix
    // overrides that differ from the Nest global prefix.
    fastify.post('/api/native', async () => 'native');
    if (globalPrefix !== 'api') fastify.get('/api/health', async () => 'ok');
    if (mode === 'explicit') await bootstrapNestAngularSsr(app, options);
    await app.init();
    await fastify.ready();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
