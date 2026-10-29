import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import { cp, readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { chromium } from '@playwright/test';

const [root, platform, report] = process.argv.slice(2);
assert(['fastify', 'node'].includes(platform));
assert.equal(process.version, 'v24.15.0');
const backend = join(root, platform);
const client = join(root, 'client');
const backendRequire = createRequire(join(backend, 'package.json'));
const clientRequire = createRequire(join(client, 'package.json'));
for (const name of [
  '@nestjs/core',
  '@angular/core',
  'fastify',
  '@nestjs/platform-node',
])
  assert.throws(() => clientRequire.resolve(name), {
    code: 'MODULE_NOT_FOUND',
  });
for (const name of [
  '@anarchitects/editorjs-core',
  '@anarchitects/editorjs-upload-fetch',
])
  assert(
    (await realpath(clientRequire.resolve(`${name}/package.json`))).startsWith(
      `${client}/`,
    ),
  );
for (const name of [
  '@angular/core',
  '@nestjs/platform-express',
  ...(platform === 'node'
    ? ['fastify', '@nestjs/platform-fastify']
    : ['@nestjs/platform-node']),
])
  assert.throws(() => backendRequire.resolve(name), {
    code: 'MODULE_NOT_FOUND',
  });
assert(
  (await realpath(backendRequire.resolve('@nestjs/core'))).startsWith(
    `${backend}/`,
  ),
);
const versions = JSON.parse(
  await readFile(join(root, 'versions.json'), 'utf8'),
);
const evidence = {
  platform,
  node: process.version,
  versions,
  cases: [],
  requests: [],
};
let browser, app, server;
const clients = new Set();
const committed = new Map();
let failStorage = false;
let deny = false;
let commitCalls = 0;
let allowedUrlCalls = 0;
const importFile = (file) =>
  import(pathToFileURL(join(backend, 'dist', file)).href);
const { createServer: createNestServer } = await importFile(
  platform === 'node' ? 'native-node.js' : 'fastify.js',
);
const { localPorts, memoryStore, png, approvedUrl } =
  await importFile('local.js');
const ports = localPorts();
const store = memoryStore(16);
ports.authenticate = async (header) => {
  if (header === 'Bearer local-demo') return { tenant: 'demo', user: 'author' };
  if (header === 'Bearer other-user') return { tenant: 'demo', user: 'other' };
  if (header === 'Bearer other-tenant')
    return { tenant: 'other', user: 'author' };
  if (header === 'Bearer reader') return { tenant: 'demo', user: 'reader' };
  return undefined;
};
ports.authorize = async (principal) => !deny && principal.user !== 'reader';
ports.resolveAllowedUrl = (url) => {
  allowedUrlCalls++;
  return url === approvedUrl ? png.slice() : undefined;
};
ports.store = {
  read: (id) => store.read(id),
  async commit(...args) {
    commitCalls++;
    if (failStorage) throw new Error('PRIVATE_STORAGE_DETAIL_MUST_NOT_ESCAPE');
    const asset = await store.commit(...args);
    committed.set(asset.id, asset);
    return asset;
  },
};
const check = async (name, fn) => {
  await fn();
  evidence.cases.push(name);
  console.log(`PASS ${platform}: ${name}`);
};
try {
  await build({
    configFile: false,
    root: client,
    logLevel: 'warn',
    build: {
      outDir: 'bundle',
      sourcemap: true,
      minify: false,
      lib: {
        entry: join(client, 'client.ts'),
        formats: ['es'],
        fileName: () => 'client.js',
      },
    },
  });
  const sourceMap = JSON.parse(
    await readFile(join(client, 'bundle/client.js.map'), 'utf8'),
  );
  assert(
    sourceMap.sources.some((source) =>
      source.includes('editorjs-upload-fetch'),
    ),
  );
  assert(
    sourceMap.sources.every(
      (source) =>
        !/@nestjs|@angular|fastify|multer|application\.ts|http\.ts|local\.ts/.test(
          source,
        ),
    ),
  );
  await cp(join(client, 'bundle/client.js.map'), join(report, 'client.js.map'));
  app = await createNestServer(ports);
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  const origin = `http://127.0.0.1:${address.port}`;
  const dropped = new Set();
  const bundle = await readFile(join(client, 'bundle/client.js'));
  // Same-origin local reverse proxy. Response loss is test-only, after the
  // real Nest handler has committed and produced the complete success body.
  server = createServer((request, response) => {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>Packed Nest upload consumer</title>');
      return;
    }
    if (request.url === '/client.js') {
      response.setHeader('Content-Type', 'application/javascript');
      response.end(bundle);
      return;
    }
    const key = request.headers['idempotency-key'];
    evidence.requests.push({
      method: request.method,
      path: request.url,
      key,
      contentType: request.headers['content-type'],
    });
    const upstream = httpRequest(
      new URL(request.url, origin),
      {
        method: request.method,
        headers: request.headers,
      },
      (incoming) => {
        const chunks = [];
        incoming.on('data', (chunk) => chunks.push(chunk));
        incoming.on('end', () => {
          const body = Buffer.concat(chunks);
          if (
            (key === 'lost-response' || key === 'timeout-response') &&
            !dropped.has(key)
          ) {
            assert.equal(incoming.statusCode, 200);
            assert(JSON.parse(body).asset);
            dropped.add(key);
            // Send headers and a partial body so Chromium cannot replay a
            // connection failure itself. The documented Fetch/core timeout
            // policy must perform the next attempt with a new FormData body.
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.write('{');
            return;
          }
          response.writeHead(incoming.statusCode, incoming.headers);
          response.end(body);
        });
      },
    );
    upstream.on('error', () => response.destroy());
    request.pipe(upstream);
  });
  server.on('connection', (socket) => {
    clients.add(socket);
    socket.on('close', () => clients.delete(socket));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const browserOrigin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  evidence.chromium = browser.version();
  const page = await browser.newPage();
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin !== browserOrigin)
      throw new Error(
        `Unexpected external browser request: ${route.request().url()}`,
      );
    await route.continue();
  });
  await page.goto(browserOrigin);
  const invoke = (options = {}) =>
    page.evaluate(
      async ({ bytes, ...options }) => {
        const api = await import('/client.js');
        const key = options.key ?? crypto.randomUUID();
        const authorization = options.authorization ?? 'Bearer local-demo';
        const blob = options.fileName
          ? new File([new Uint8Array(bytes)], options.fileName, {
              type: options.mime ?? 'image/png',
            })
          : new Blob([new Uint8Array(bytes)], {
              type: options.mime ?? 'image/png',
            });
        try {
          const uploader = api.uploadOperation(
            key,
            authorization,
            options.timeoutMs,
          );
          const result = options.retry
            ? await api.replayableFile(blob, key, authorization).result
            : options.url !== undefined
              ? await uploader.uploadByUrl(options.url)
              : await uploader.uploadByFile(blob);
          return { result };
        } catch (error) {
          return { exception: { name: error.name, code: error.code } };
        }
      },
      { bytes: [...png], ...options },
    );
  const success = (value) => {
    assert.equal(value.result?.success, 1, JSON.stringify(value));
    assert.deepEqual(Object.keys(value.result.file).sort(), [
      'id',
      'mime',
      'size',
      'url',
    ]);
    assert.equal(value.result.file.size, png.length);
    return value.result.file;
  };
  const failure = (value, code) =>
    assert.deepEqual(value, { result: { success: 0, error: { code } } });
  const raw = async (
    body,
    contentType,
    key = 'raw-operation',
    authorization = 'Bearer local-demo',
  ) => {
    const response = await fetch(
      `${origin}/uploads/${contentType?.startsWith('multipart') ? 'file' : 'url'}`,
      {
        method: 'POST',
        body,
        headers: {
          Authorization: authorization,
          'Idempotency-Key': key,
          ...(contentType ? { 'Content-Type': contentType } : {}),
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    return { status: response.status, body: await response.json() };
  };
  let first;
  await check(
    'named File and nameless Blob map receipts without alt/caption or filename paths',
    async () => {
      first = success(
        await invoke({
          key: 'original-file',
          fileName: '../../private/photo.png',
        }),
      );
      assert.match(first.url, /^\/media\/[0-9a-f-]{36}$/);
      const blob = success(await invoke());
      assert.notEqual(blob.id, first.id);
      const response = await fetch(`${origin}${first.url}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /image\/png/);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
      assert.deepEqual(
        await page.evaluate(async (url) => {
          const image = new Image();
          image.src = url;
          await image.decode();
          return [image.naturalWidth, image.naturalHeight];
        }, first.url),
        [1, 1],
      );
    },
  );
  await check('allowed URL resolves only controlled local bytes', async () => {
    success(await invoke({ url: approvedUrl }));
    assert.equal(allowedUrlCalls, 1);
  });
  await check(
    'same-key concurrent multipart attempts deduplicate despite fresh boundaries',
    async () => {
      const before = committed.size;
      const results = await Promise.all([
        invoke({ key: 'concurrent-file' }),
        invoke({ key: 'concurrent-file' }),
      ]);
      assert.deepEqual(success(results[0]), success(results[1]));
      assert.equal(committed.size, before + 1);
    },
  );
  await check(
    'same-key concurrent URL submissions deduplicate and mismatched operations conflict',
    async () => {
      const before = committed.size;
      const results = await Promise.all([
        invoke({ key: 'concurrent-url', url: approvedUrl }),
        invoke({ key: 'concurrent-url', url: approvedUrl }),
      ]);
      assert.deepEqual(success(results[0]), success(results[1]));
      assert.equal(committed.size, before + 1);
      failure(await invoke({ key: 'concurrent-url' }), 'conflict');
      assert.deepEqual(
        await raw(
          JSON.stringify({ url: approvedUrl }),
          'application/json',
          'original-file',
        ),
        { status: 409, body: { problem: { code: 'conflict' } } },
      );
      assert.equal(committed.size, before + 1);
    },
  );
  await check('operation keys isolate users and tenants', async () => {
    const otherUser = success(
      await invoke({
        key: 'original-file',
        authorization: 'Bearer other-user',
      }),
    );
    const otherTenant = success(
      await invoke({
        key: 'original-file',
        authorization: 'Bearer other-tenant',
      }),
    );
    assert.equal(new Set([first.id, otherUser.id, otherTenant.id]).size, 3);
  });
  await check(
    'missing identity, denied permission and revoked replay never commit',
    async () => {
      const before = commitCalls;
      failure(await invoke({ authorization: '' }), 'unauthenticated');
      failure(await invoke({ authorization: 'Bearer reader' }), 'forbidden');
      for (const [authorization, status, code] of [
        ['', 401, 'unauthenticated'],
        ['Bearer reader', 403, 'forbidden'],
      ]) {
        assert.deepEqual(
          await raw(
            JSON.stringify({ url: approvedUrl }),
            'application/json',
            'auth-operation',
            authorization,
          ),
          { status, body: { problem: { code } } },
        );
      }
      deny = true;
      failure(await invoke({ key: 'original-file' }), 'forbidden');
      deny = false;
      assert.equal(commitCalls, before);
    },
  );
  await check(
    'missing/invalid operation keys reject before storage',
    async () => {
      const before = commitCalls;
      for (const key of ['', 'short', 'a'.repeat(81), 'spaces not allowed'])
        failure(await invoke({ key }), 'request');
      assert.equal(commitCalls, before);
    },
  );
  await check(
    'content, MIME and oversized/empty files fail closed',
    async () => {
      const before = commitCalls;
      failure(await invoke({ bytes: [1, 2, 3] }), 'content');
      failure(await invoke({ mime: 'text/plain' }), 'content');
      failure(await invoke({ bytes: [] }), 'content');
      failure(await invoke({ bytes: [...png, 1] }), 'content');
      failure(await invoke({ bytes: new Array(1025).fill(1) }), 'too-large');
      assert.equal(commitCalls, before);
    },
  );
  await check(
    'arbitrary/private/data/credential URLs cannot trigger import',
    async () => {
      const before = commitCalls;
      for (const url of [
        'http://127.0.0.1/private',
        'http://169.254.169.254/latest/meta-data',
        'file:///etc/passwd',
        'data:image/png;base64,eA==',
        'https://user:secret@uploads.example.test/approved.png',
        `${approvedUrl}?redirect=elsewhere`,
      ])
        failure(await invoke({ url }), 'url');
      assert.equal(commitCalls, before);
    },
  );
  await check(
    'strict Standard Schema rejects malformed URL DTOs before application resolution',
    async () => {
      const before = allowedUrlCalls;
      for (const body of [
        {},
        { url: 12 },
        { url: approvedUrl, extra: true },
        { url: 'x'.repeat(513) },
        { url: '' },
        [],
      ]) {
        const response = await raw(JSON.stringify(body), 'application/json');
        assert.deepEqual(response, {
          status: 400,
          body: { problem: { code: 'request' } },
        });
      }
      assert.equal(allowedUrlCalls, before);
    },
  );
  await check(
    'malformed and oversized JSON return bounded sanitized errors',
    async () => {
      assert.deepEqual(await raw('{', 'application/json'), {
        status: 400,
        body: { problem: { code: 'request' } },
      });
      assert.deepEqual(
        await raw(
          JSON.stringify({ url: 'x'.repeat(2048) }),
          'application/json',
        ),
        { status: 413, body: { problem: { code: 'too-large' } } },
      );
    },
  );
  await check(
    'missing, unexpected, multiple and malformed multipart parts never commit',
    async () => {
      const before = commitCalls;
      for (const variant of ['missing', 'field', 'wrong-name', 'multiple']) {
        const data = new FormData();
        if (variant === 'field') data.append('caption', 'must not be accepted');
        if (variant === 'wrong-name')
          data.append('other', new Blob([png], { type: 'image/png' }), 'x.png');
        if (variant === 'multiple') {
          data.append('image', new Blob([png], { type: 'image/png' }), 'x.png');
          data.append('image', new Blob([png], { type: 'image/png' }), 'y.png');
        }
        const response = await fetch(`${origin}/uploads/file`, {
          method: 'POST',
          body: data,
          headers: {
            Authorization: 'Bearer local-demo',
            'Idempotency-Key': 'multipart-key',
          },
          signal: AbortSignal.timeout(5000),
        });
        assert.equal(response.status, 400, variant);
        assert.deepEqual(await response.json(), {
          problem: { code: 'request' },
        });
      }
      assert.deepEqual(
        await raw('--broken', 'multipart/form-data; boundary=broken'),
        { status: 400, body: { problem: { code: 'request' } } },
      );
      assert.equal(commitCalls, before);
    },
  );
  await check(
    'internal storage failures expose no private details and do not retry',
    async () => {
      const before = commitCalls;
      failStorage = true;
      failure(await invoke({ retry: true }), 'internal');
      assert.deepEqual(
        await raw(JSON.stringify({ url: approvedUrl }), 'application/json'),
        { status: 500, body: { problem: { code: 'internal' } } },
      );
      failStorage = false;
      assert.equal(commitCalls, before + 2);
    },
  );
  await check(
    'lost response retries with the same key and creates exactly one stored file',
    async () => {
      const before = committed.size;
      const receipt = success(
        await invoke({ key: 'lost-response', retry: true }),
      );
      assert.equal(committed.size, before + 1);
      const attempts = evidence.requests.filter(
        (request) => request.key === 'lost-response',
      );
      assert.equal(attempts.length, 2);
      assert.equal(
        new Set(attempts.map((request) => request.contentType)).size,
        2,
        'Each retry must build a fresh multipart body',
      );
      assert.deepEqual(
        success(await invoke({ key: 'lost-response' })),
        receipt,
      );
    },
  );
  await check(
    'timeout does not undo storage; explicit same-key replay recovers the original result',
    async () => {
      const before = committed.size;
      assert.deepEqual(
        await invoke({ key: 'timeout-response', timeoutMs: 250 }),
        { exception: { name: 'FetchUploadError', code: 'timeout' } },
      );
      assert.equal(committed.size, before + 1);
      const original = [...committed.values()].at(-1);
      assert.deepEqual(
        success(await invoke({ key: 'timeout-response' })),
        original,
      );
      assert.equal(committed.size, before + 1);
    },
  );
  await check(
    'bounded storage retains old receipts at capacity and rejects new operations',
    async () => {
      while (committed.size < 16) success(await invoke());
      failure(await invoke({ retry: true }), 'capacity');
      assert.deepEqual(
        await raw(JSON.stringify({ url: approvedUrl }), 'application/json'),
        { status: 429, body: { problem: { code: 'capacity' } } },
      );
      assert.equal(committed.size, 16);
      assert.deepEqual(success(await invoke({ key: 'original-file' })), first);
    },
  );
  evidence.status = 'passed';
} catch (error) {
  evidence.status = 'failed';
  evidence.error = String(error);
  throw error;
} finally {
  await browser?.close();
  for (const socket of clients) socket.destroy();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await app?.close();
  evidence.cleanup = { browserClosed: true, serversClosed: true };
  await writeFile(
    join(report, 'nest-upload.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
}
