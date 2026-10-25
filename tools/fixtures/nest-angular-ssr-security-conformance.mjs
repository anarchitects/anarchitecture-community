import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Resolve everything from the installed consumer, never the workspace source.
export async function assertSsrSecurityConformance(consumerRoot, mode = 'cjs') {
  const require = createRequire(join(consumerRoot, 'package.json'));
  require('reflect-metadata');
  const { Module } = require('@nestjs/common');
  const { NestFactory } = require('@nestjs/core');
  const { FastifyAdapter } = require('@nestjs/platform-fastify');
  const packagePath = require.resolve(
    '@anarchitects/nest-angular-ssr/package.json',
  );
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  const ssrRequire = createRequire(packagePath);
  const staticVersion = ssrRequire('@fastify/static/package.json').version;
  assert.equal(manifest.dependencies['@fastify/static'], '^10.1.7');
  assert.equal(
    manifest.peerDependencies['@nestjs/platform-fastify'],
    '^11.1.29',
  );
  const [major, minor, patch] = staticVersion.split('.').map(Number);
  assert.ok(major === 10 && (minor > 1 || (minor === 1 && patch >= 7)));
  const readme = await readFile(
    join(dirname(packagePath), 'README.md'),
    'utf8',
  );
  assert.ok(
    readme.includes('trustProxy'),
    'Packed README must include proxy migration guidance',
  );
  const ssr =
    mode === 'esm'
      ? await import(
          pathToFileURL(
            join(dirname(packagePath), manifest.exports['.'].import),
          ).href
        )
      : require('@anarchitects/nest-angular-ssr');
  const root = await mkdtemp(join(tmpdir(), 'ssr-security-'));
  const assets = join(root, 'browser');
  await mkdir(join(assets, 'private'), { recursive: true });
  await mkdir(join(assets, 'api'), { recursive: true });
  await writeFile(join(assets, 'main.js'), 'public asset');
  await writeFile(join(assets, 'space name.txt'), 'encoded asset');
  await writeFile(join(assets, 'private', 'secret.txt'), 'PRIVATE SENTINEL');
  await writeFile(join(assets, 'api', 'secret.txt'), 'API SENTINEL');
  await writeFile(join(root, 'outside.txt'), 'OUTSIDE SENTINEL');
  const caseInsensitive = await readFile(
    join(assets, 'PRIVATE', 'SECRET.TXT'),
    'utf8',
  ).then(
    () => true,
    () => false,
  );
  if (process.platform === 'darwin') {
    assert.ok(
      caseInsensitive,
      'The macOS security fixture must exercise a case-insensitive volume',
    );
  }
  class TestModule {}
  Module({})(TestModule);

  try {
    // Both an explicitly trusted proxy and an untrusted remote are exercised.
    for (const trustProxy of [false, '127.0.0.1', '192.0.2.1']) {
      const app = await NestFactory.create(
        TestModule,
        new FastifyAdapter({ trustProxy }),
        {
          logger: false,
          abortOnError: false,
        },
      );
      try {
        const server = app.getHttpAdapter().getInstance();
        server.get('/api/health', () => 'ok');
        server.get('/private/*', (_request, reply) =>
          reply.code(403).send('guarded'),
        );
        const rendered = [];
        const integration = ssr.createNestAngularSsrIntegration(app, {
          renderer: {
            async render(request, context) {
              rendered.push(request.url);
              const url = new URL(request.url);
              if (url.pathname === '/fallback') return null;
              if (url.pathname === '/redirect')
                return new Response(null, {
                  status: 302,
                  headers: { location: '/' },
                });
              const headers = new Headers({
                'content-type': 'application/json',
              });
              headers.append('set-cookie', 'first=1; HttpOnly; Path=/');
              headers.append('set-cookie', 'second=2; Secure; Path=/');
              return new Response(
                request.method === 'HEAD'
                  ? null
                  : JSON.stringify({
                      url: request.url,
                      context,
                      cookie: request.headers.get('cookie'),
                    }),
                { headers },
              );
            },
          },
          createRequestContext: (request) => ({
            trace: request.headers['x-trace-id'],
          }),
        });
        await ssr.registerNestAngularSsrRoutes(app, integration, {
          browserAssetsDir: assets,
          apiPrefix: '/api',
          allowedHosts: ['localhost', 'public.example'],
        });
        await app.init();
        await server.ready();
        const inject = (url, extra = {}) => server.inject({ url, ...extra });
        for (const method of ['GET', 'HEAD']) {
          const asset = await inject('/main.js', { method });
          assert.equal(asset.statusCode, 200);
          assert.equal(asset.body, method === 'HEAD' ? '' : 'public asset');
          const page = await inject('/page?view=full', {
            method,
            headers: { cookie: 'session=one', 'x-trace-id': 'trace-one' },
          });
          assert.equal(page.statusCode, 200);
          assert.deepEqual(page.headers['set-cookie'], [
            'first=1; HttpOnly; Path=/',
            'second=2; Secure; Path=/',
          ]);
          if (method === 'HEAD') assert.equal(page.body, '');
          else
            assert.deepEqual(page.json(), {
              url: 'http://localhost/page?view=full',
              context: { trace: 'trace-one' },
              cookie: 'session=one',
            });
          assert.equal((await inject('/fallback', { method })).statusCode, 404);
          const redirect = await inject('/redirect', { method });
          assert.equal(redirect.statusCode, 302);
          assert.equal(redirect.headers.location, '/');
          const before = rendered.length;
          assert.equal(
            (await inject('/api/health', { method })).statusCode,
            200,
          );
          assert.equal(
            (await inject('/api/missing', { method })).statusCode,
            404,
          );
          assert.equal(
            (await inject('/api/secret.txt', { method })).statusCode,
            404,
          );
          assert.equal(
            (await inject('/missing.css', { method })).statusCode,
            404,
          );
          assert.equal(
            (await inject('/private/secret.txt', { method })).statusCode,
            403,
          );
          for (const path of [
            '//private/secret.txt',
            '/./private/secret.txt',
            '/%2e/private/secret.txt',
            '/public/../private/secret.txt',
            '/public/%2e%2e/private/secret.txt',
            '/private%2fsecret.txt',
            '/private%5csecret.txt',
            '/private\\secret.txt',
            '/PRIVATE/secret.txt',
            '/private/SECRET.TXT',
            '/%70rivate/secret.txt',
            '/%2e%2e/outside.txt',
            '/..%2foutside.txt',
            '/api%2fsecret.txt',
            '/api%5csecret.txt',
            '//api/secret.txt',
            '/%61pi/secret.txt',
            '/main.js/',
            '/%00',
            '/%ZZ',
          ]) {
            const response = await inject(path, { method });
            assert.ok(
              [400, 403, 404].includes(response.statusCode),
              `${method} ${path}: ${response.statusCode} ${response.body}`,
            );
            assert.ok(!response.body.includes('SENTINEL'), path);
          }
          assert.equal(
            rendered.length,
            before,
            'Rejected paths must never reach SSR',
          );
        }
        assert.equal((await inject('/space%20name.txt')).body, 'encoded asset');
        assert.equal((await inject('/main.js?cache=1')).body, 'public asset');
        assert.equal(
          (await inject('/main.js', { method: 'POST' })).statusCode,
          404,
        );
        assert.equal(
          (await inject('/', { headers: { host: 'evil.example' } })).statusCode,
          400,
        );
        const trusted = trustProxy === '127.0.0.1';
        const proxy = await inject('/page?q=1', {
          remoteAddress: '127.0.0.1',
          headers: {
            host: 'localhost:3000',
            'x-forwarded-host': 'public.example:8443',
            'x-forwarded-proto': 'https',
          },
        });
        assert.equal(proxy.statusCode, 200);
        assert.equal(
          proxy.json().url,
          trusted
            ? 'https://public.example:8443/page?q=1'
            : 'http://localhost:3000/page?q=1',
        );
        const spoof = await inject('/main.js', {
          remoteAddress: '127.0.0.1',
          headers: {
            host: 'evil.example',
            'x-forwarded-host': 'public.example',
          },
        });
        assert.equal(spoof.statusCode, trusted ? 200 : 400);
        const rejectedProxy = await inject('/', {
          remoteAddress: '127.0.0.1',
          headers: {
            host: 'localhost',
            'x-forwarded-host': 'evil.example',
          },
        });
        assert.equal(rejectedProxy.statusCode, trusted ? 400 : 200);
      } finally {
        await app.close();
      }
    }
    console.log('Packed SSR security conformance passed', {
      mode,
      ssr: manifest.version,
      static: staticVersion,
      caseInsensitive,
      nest: require('@nestjs/platform-fastify/package.json').version,
      fastify: createRequire(
        require.resolve('@nestjs/platform-fastify/package.json'),
      )('fastify/package.json').version,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
