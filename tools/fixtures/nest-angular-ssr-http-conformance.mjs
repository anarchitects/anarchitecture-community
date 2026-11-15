import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// Real sockets complement the inject-based routing/security suite. All imports
// resolve inside the isolated packed consumer, never through workspace aliases.
export async function assertSsrHttpConformance(root, ssr) {
  const require = createRequire(join(root, 'package.json'));
  require('reflect-metadata');
  const { Module, Controller, Get, RequestMethod } = require('@nestjs/common');
  const { NestFactory } = require('@nestjs/core');
  const { FastifyAdapter } = require('@nestjs/platform-fastify');
  const certifyMiddleware =
    require('@nestjs/core/package.json').version.startsWith('12.');
  class ProtectedController {
    get() {
      return 'PRIVATE_CONTROLLER_SENTINEL';
    }
  }
  Controller('guarded')(ProtectedController);
  Get()(
    ProtectedController.prototype,
    'get',
    Object.getOwnPropertyDescriptor(ProtectedController.prototype, 'get'),
  );
  class AppModule {
    configure(consumer) {
      consumer
        .apply((_req, res) => {
          res.statusCode = 403;
          res.end('blocked by path-scoped middleware');
        })
        .forRoutes({ path: 'guarded', method: RequestMethod.GET });
    }
  }
  Module({ controllers: [ProtectedController] })(AppModule);
  const app = await NestFactory.create(AppModule, new FastifyAdapter(), {
    logger: false,
    abortOnError: false,
  });
  const sockets = new Set();
  const requests = new Set();
  const server = app.getHttpServer();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  const bufferEntered = Promise.withResolvers();
  const finishBuffer = Promise.withResolvers();
  const abortEntered = Promise.withResolvers();
  const rawClosed = Promise.withResolvers();
  const finishAbort = Promise.withResolvers();
  const renderedAbort = Promise.withResolvers();
  const overlap = Promise.withResolvers();
  let concurrent = 0;
  let port;
  const evidence = [];
  const chunk = Buffer.alloc(64 * 1024, 'x');
  const chunkCount = 64;
  let pulls = 0;
  const integration = ssr.createNestAngularSsrIntegration(app, {
    createRequestContext(req) {
      if (req.url === '/abort') req.raw.on('close', rawClosed.resolve);
      return { trace: req.headers['x-trace'] };
    },
    renderer: {
      async render(req, context) {
        const path = new URL(req.url).pathname;
        if (path === '/throw') throw new Error('PRIVATE_RENDERER_ERROR');
        if (path === '/body-error')
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('PRIVATE_PARTIAL'));
                controller.error(new Error('PRIVATE_BODY_ERROR'));
              },
            }),
          );
        if (path === '/null') return null;
        if (path === '/buffer') {
          return new Response(
            new ReadableStream({
              async start(controller) {
                controller.enqueue(new TextEncoder().encode('first-'));
                bufferEntered.resolve();
                await finishBuffer.promise;
                controller.enqueue(new TextEncoder().encode('last'));
                controller.close();
              },
            }),
          );
        }
        if (path === '/large')
          return new Response(
            new ReadableStream({
              pull(controller) {
                pulls++;
                controller.enqueue(chunk);
                if (pulls === chunkCount) controller.close();
              },
            }),
          );
        if (path === '/abort') {
          abortEntered.resolve(req.signal);
          await finishAbort.promise;
          renderedAbort.resolve();
          return new Response('finished after disconnect');
        }
        if (path === '/isolation') {
          if (++concurrent === 8) overlap.resolve();
          await within(overlap.promise);
          return Response.json({ context, header: req.headers.get('x-trace') });
        }
        const headers = new Headers({
          'x-ssr': 'retained',
          location: '/target',
        });
        headers.append('set-cookie', 'first=1; Path=/; HttpOnly');
        headers.append('set-cookie', 'second=2; Path=/; SameSite=Lax');
        return new Response('redirect body', { status: 307, headers });
      },
    },
  });
  app
    .getHttpAdapter()
    .getInstance()
    .route({
      method: ['GET', 'HEAD'],
      url: '/*',
      async handler(req, reply) {
        if (!(await integration.handle(req, reply))) reply.callNotFound();
      },
    });
  function exchange(
    path,
    { method = 'GET', trace, pause = false, onHeaders } = {},
  ) {
    return within(
      new Promise((resolve, reject) => {
        const client = request(
          {
            host: '127.0.0.1',
            port,
            path,
            method,
            headers: trace ? { 'x-trace': trace } : {},
            agent: false,
          },
          (res) => {
            onHeaders?.(res);
            const chunks = [];
            res.on('error', reject);
            res.on('data', (data) => chunks.push(data));
            res.on('end', () =>
              resolve({
                status: res.statusCode,
                headers: res.headers,
                body: Buffer.concat(chunks),
              }),
            );
            if (pause) {
              res.pause();
              // Exercise Node/Fastify delivery to a temporarily stalled client.
              // This does not assert renderer backpressure (the bridge buffers).
              setTimeout(() => res.resume(), 100);
            }
          },
        );
        requests.add(client);
        client.once('close', () => requests.delete(client));
        client.on('error', reject);
        client.setTimeout(5_000, () =>
          client.destroy(new Error('HTTP timeout')),
        );
        client.end();
      }),
    );
  }
  try {
    await app.listen(0, '127.0.0.1');
    port = server.address().port;
    // node:http sends this path verbatim as the request target. Unlike inject,
    // it exercises absolute-form targets at the actual Node HTTP boundary.
    if (certifyMiddleware) {
      for (const path of ['/guarded', `http://127.0.0.1:${port}/guarded`]) {
        const response = await exchange(path);
        assert.equal(response.status, 403, path);
        assert.equal(
          response.body.toString(),
          'blocked by path-scoped middleware',
          path,
        );
      }
      evidence.push(
        'path-scoped Nest middleware rejects origin- and absolute-form HTTP targets',
      );
    }
    const redirect = await exchange('/redirect');
    assert.equal(redirect.status, 307);
    assert.equal(redirect.headers.location, '/target');
    assert.equal(redirect.headers['x-ssr'], 'retained');
    assert.deepEqual(redirect.headers['set-cookie'], [
      'first=1; Path=/; HttpOnly',
      'second=2; Path=/; SameSite=Lax',
    ]);
    const head = await exchange('/redirect', { method: 'HEAD' });
    assert.equal(head.status, 307);
    assert.equal(head.body.length, 0);
    assert.deepEqual(
      head.headers['set-cookie'],
      redirect.headers['set-cookie'],
    );
    assert.equal((await exchange('/null')).status, 404);
    evidence.push(
      'real HTTP status, redirect, headers, multiple cookies, HEAD and null',
    );

    let receivedHeaders = false;
    const buffered = exchange('/buffer', {
      onHeaders: () => {
        receivedHeaders = true;
      },
    });
    await within(bufferEntered.promise);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(
      receivedHeaders,
      false,
      'Response escaped before the body completed',
    );
    finishBuffer.resolve();
    assert.equal((await buffered).body.toString(), 'first-last');
    const large = await exchange('/large', {
      pause: true,
      onHeaders() {
        assert.equal(
          pulls,
          chunkCount,
          'Expected the documented eager body buffering',
        );
      },
    });
    assert.equal(large.body.length, chunk.length * chunkCount);
    assert.ok(large.body.equals(Buffer.alloc(chunk.length * chunkCount, 'x')));
    evidence.push(
      'buffered body; 4 MiB delivery to paused client; no renderer backpressure',
    );

    const aborted = request({
      host: '127.0.0.1',
      port,
      path: '/abort',
      agent: false,
    });
    requests.add(aborted);
    aborted.on('error', () => {}); // The test deliberately closes this connection.
    aborted.once('close', () => requests.delete(aborted));
    aborted.end();
    const signal = await within(abortEntered.promise);
    aborted.destroy();
    await within(rawClosed.promise);
    assert.equal(
      signal.aborted,
      false,
      'Reassess the documented cancellation limitation',
    );
    finishAbort.resolve();
    await within(renderedAbort.promise);
    evidence.push(
      'disconnect observed; renderer Request.signal is not aborted',
    );

    for (const path of ['/throw', '/body-error']) {
      const response = await exchange(path);
      assert.equal(response.status, 500);
      assert.doesNotMatch(response.body.toString(), /PRIVATE_|stack/);
      assert.equal(
        (await exchange('/null')).status,
        404,
        'Server survives renderer failure',
      );
    }
    evidence.push(
      'renderer rejection and body-read failure: generic 500, server survives',
    );
    const isolated = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        exchange('/isolation', { trace: `request-${index}` }),
      ),
    );
    isolated.forEach((result, index) => {
      assert.equal(result.status, 200);
      assert.deepEqual(JSON.parse(result.body), {
        context: { trace: `request-${index}` },
        header: `request-${index}`,
      });
    });
    evidence.push(
      'eight overlapping requests retain isolated context and headers',
    );
  } finally {
    finishBuffer.resolve();
    finishAbort.resolve();
    overlap.resolve();
    for (const req of requests) req.destroy();
    for (const socket of sockets) socket.destroy();
    await within(app.close());
  }
  // A closed listener must not accept subsequent work.
  await assert.rejects(exchange('/null'), /ECONNREFUSED/);
  evidence.push('application closes listener and test-owned connections');
  return {
    transport: 'loopback TCP',
    middlewareCertification: certifyMiddleware
      ? 'Nest 12 required'
      : 'historical Nest 11 compatibility only; see separate audit',
    checks: evidence,
    limitations: [
      'buffered-response',
      'no-renderer-backpressure',
      'no-disconnect-signal',
    ],
  };
}

async function within(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('HTTP conformance deadline exceeded')),
          8_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
