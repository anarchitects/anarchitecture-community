import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { join, extname } from 'node:path';
import { build } from 'vite';
import { chromium, expect } from '@playwright/test';
import { packConsumer, source, workspace } from '../pack.mjs';

const { root } = packConsumer(true);
const reportDir = join(source, 'test-output/browser');
mkdirSync(reportDir, { recursive: true });
const requests = [];
const stored = new Map();
const report = { node: process.version, cases: [], stored: 0 };
let browser;
let server;
try {
  const readme = readFileSync(
    join(root, 'node_modules/@anarchitects/editorjs-upload-fetch/README.md'),
    'utf8',
  );
  const examples = [
    ...readme.matchAll(
      /<!-- upload-example-file: ([\w.-]+) -->\s*```ts\n([\s\S]*?)```/g,
    ),
  ];
  assert.deepEqual(
    examples.map((e) => e[1]),
    ['uploads.ts', 'editor.ts', 'retry.ts'],
  );
  for (const [, name, code] of examples) writeFileSync(join(root, name), code);
  for (const resolution of ['NodeNext', 'Bundler']) {
    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          module: resolution === 'Bundler' ? 'ESNext' : 'NodeNext',
          moduleResolution: resolution,
          target: 'ES2022',
          lib: ['ES2022', 'DOM'],
          types: [],
          strict: true,
          skipLibCheck: false,
          noEmit: true,
        },
        files: examples
          .map((e) => e[1])
          .filter((name) => resolution === 'Bundler' || name !== 'editor.ts'),
      }),
    );
    execFileSync(
      process.execPath,
      [
        join(workspace, 'node_modules/typescript/bin/tsc'),
        '-p',
        join(root, 'tsconfig.json'),
      ],
      { cwd: root, stdio: 'pipe', encoding: 'utf8' },
    );
  }
  assert.equal(existsSync(join(root, 'node_modules/@angular')), false);
  assert.equal(existsSync(join(root, 'node_modules/@nestjs')), false);
  copyFileSync(
    join(import.meta.dirname, 'consumer.mjs'),
    join(root, 'consumer.mjs'),
  );
  writeFileSync(
    join(root, 'index.html'),
    '<!doctype html><html><body><div id="editor"></div><script type="module" src="/consumer.mjs"></script></body></html>',
  );
  await build({
    configFile: false,
    root,
    logLevel: 'warn',
    build: { outDir: 'dist', target: 'es2022' },
  });
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://local');
      const send = (body, status = 200) => {
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(body));
      };
      if (url.pathname === '/asset.svg') {
        response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        response.end(
          '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>',
        );
        return;
      }
      if (request.method === 'POST') {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        requests.push({
          path: url.pathname,
          mode: url.searchParams.get('mode'),
          headers: request.headers,
          body: body.toString(),
        });
        if (url.pathname.startsWith('/api/assets/')) {
          send({ asset: { url: '/asset.svg', id: 'recipe' } });
          return;
        }
        if (url.pathname === '/idempotent') {
          const key = request.headers['idempotency-key'];
          const previous = stored.get(key);
          if (previous && !previous.bytes.equals(body)) {
            send({ success: 0 }, 409);
            return;
          }
          if (previous) {
            send(previous.result);
            return;
          }
          const result = {
            success: 1,
            file: { url: '/asset.svg', id: `stored-${stored.size + 1}` },
          };
          stored.set(key, { bytes: body, result });
          // Storage committed, but its response never completes. A replay sees
          // the saved outcome. Sending headers prevents connection-establishment
          // retries inside Chromium from obscuring the logical retry assertion.
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.write('{');
          return;
        }
        const mode = url.searchParams.get('mode');
        if (mode === 'network') {
          request.socket.destroy();
          return;
        }
        if (mode === 'hold') return;
        if (mode === 'slow-body') {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.write('{');
          return;
        }
        if (mode === 'denied') {
          send({ success: 0, error: { code: 'denied' } }, 403);
          return;
        }
        if (mode === 'http') {
          send({ private: 'hidden' }, 503);
          return;
        }
        if (mode === 'json') {
          response.writeHead(200);
          response.end('{');
          return;
        }
        if (mode === 'empty') {
          response.writeHead(204);
          response.end();
          return;
        }
        if (mode === 'failure') {
          send({ success: 0, error: { code: 'policy' } });
          return;
        }
        if (mode === 'bad-url') {
          send({ success: 1, file: { url: ' ' } });
          return;
        }
        if (mode === 'bad-envelope') {
          send({ success: true });
          return;
        }
        send({
          success: 1,
          file: {
            url: '/asset.svg',
            id: request.headers['content-type']?.startsWith('multipart/')
              ? 'file'
              : 'url',
            meta: { retained: true, sizes: [8, 8] },
          },
        });
        return;
      }
      const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!/^(index\.html|assets\/[\w.-]+)$/.test(name)) {
        response.writeHead(404);
        response.end();
        return;
      }
      const path = join(root, 'dist', name);
      response.writeHead(200, {
        'Content-Security-Policy':
          "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'",
        'Content-Type':
          {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
          }[extname(path)] ?? 'application/octet-stream',
      });
      response.end(readFileSync(path));
    } catch {
      response.writeHead(500);
      response.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  report.browser = browser.version();
  assert.equal(report.browser, '156.0.8078.4');
  const page = await browser.newPage();
  const external = [];
  const blocked = [];
  page.on('requestfailed', (request) =>
    blocked.push({ url: request.url(), error: request.failure()?.errorText }),
  );
  await page.addInitScript(() => {
    window.previewViolations = [];
    document.addEventListener('securitypolicyviolation', (event) =>
      window.previewViolations.push(event.blockedURI),
    );
  });
  page.on('request', (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith('data:'))
      external.push(request.url());
  });
  await page.goto(origin);
  await page.waitForFunction(() => !!window.uploads);
  const exercise = (mode, settings = {}) =>
    page.evaluate(
      ([mode, settings]) => window.uploads.exercise(mode, settings),
      [mode, settings],
    );
  for (const [mode, code, status] of [
    ['http', 'http', 503],
    ['denied', 'http', 403],
    ['network', 'network'],
    ['json', 'response', 200],
    ['empty', 'response', 204],
    ['bad-url', 'mapping', 200],
    ['bad-envelope', 'mapping', 200],
  ]) {
    const result = await exercise(mode);
    assert.equal(result.code, code);
    if (status) assert.equal(result.status, status);
    report.cases.push(mode);
  }
  assert.deepEqual(
    (await exercise('denied', { decodeHttpErrors: true })).result,
    { success: 0, error: { code: 'denied' } },
  );
  assert.equal((await exercise('ok', { mappingError: true })).code, 'mapping');
  assert.equal((await exercise('hold', { cancel: true })).code, 'cancelled');
  for (const mode of ['hold', 'slow-body'])
    assert.equal((await exercise(mode, { timeoutMs: 80 })).code, 'timeout');
  report.cases.push(
    'mapped denial',
    'mapper throw',
    'abort',
    'request timeout',
    'body timeout',
  );
  const recipe = await page.evaluate(() => window.uploads.recipe());
  assert.equal(recipe[0].file.id, 'recipe');
  assert.equal(recipe[1].file.id, 'recipe');
  report.cases.push('executed README file/URL recipe');
  assert.deepEqual(external, []); // Direct adapter calls never fetch the submitted URL.
  await page.evaluate(() => window.uploads.mount());
  const mode = page.getByLabel('Image purpose');
  const alt = page.getByLabel('Alternative text', { exact: true });
  await mode.selectOption('description');
  await alt.fill('Authored alternative');
  const save = () => page.evaluate(() => window.uploads.save());
  await page.evaluate(() => {
    window.uploads.setMode('failure');
    return window.uploads.paste('blob');
  });
  await expect(
    page.getByText('Couldn’t upload image. Please try another.').last(),
  ).toBeVisible();
  await page.evaluate(() => {
    window.uploads.setMode('ok');
    return window.uploads.paste('blob');
  });
  await expect
    .poll(async () => (await save()).blocks[0]?.data.file.id)
    .toBe('file');
  await page.locator('.image-tool__caption').fill('Independent caption');
  const data = (await save()).blocks[0].data;
  assert.equal(data.alt, 'Authored alternative');
  assert.equal(data.caption, 'Independent caption');
  assert.deepEqual(data.file.meta, { retained: true, sizes: [8, 8] });
  const multipart = requests.find(
    (r) =>
      r.path === '/upload' &&
      r.mode === 'ok' &&
      r.headers['content-type']?.startsWith('multipart/'),
  );
  assert.match(multipart.headers['content-type'], /boundary=/);
  assert.match(multipart.body, /name="picture"; filename="fallback.svg"/);
  assert.match(multipart.body, /<svg/);
  assert.equal(multipart.headers['x-host'], 'image');
  await page.evaluate(() => window.uploads.paste('url'));
  await expect
    .poll(async () => (await save()).blocks[0]?.data.file.id)
    .toBe('url');
  const saved = await save();
  await page.evaluate((data) => window.uploads.mount(data), saved);
  await expect(alt).toHaveValue('Authored alternative');
  await expect(page.locator('.image-tool__caption')).toHaveText(
    'Independent caption',
  );
  await mode.selectOption('decorative');
  assert.equal((await save()).blocks[0].data.alt, '');
  const decorative = await save();
  await page.evaluate((data) => window.uploads.mount(data), decorative);
  await expect(mode).toHaveValue('decorative');
  await mode.selectOption('unset');
  assert.equal('alt' in (await save()).blocks[0].data, false);
  await page.evaluate(() => window.uploads.paste('file'));
  await expect
    .poll(async () => (await save()).blocks[0]?.data.file.id)
    .toBe('file');
  assert.ok(
    await page.evaluate(() =>
      window.previewViolations.includes(
        'https://untrusted.invalid/no-fetch.svg',
      ),
    ),
  );
  assert.ok(
    external.every((url) =>
      blocked.some((request) => request.url === url && request.error === 'csp'),
    ),
    JSON.stringify({ external, blocked }),
  );
  assert.ok(
    requests.some((r) =>
      r.body.includes('https://untrusted.invalid/no-fetch.svg'),
    ),
  );
  report.cases.push(
    'packed ImageTool Blob/File/URL',
    'failure recovery',
    'metadata and caption',
    'alt description/decorative/unset round trip',
    'adapter URL submission does not fetch input; host CSP blocks upstream preview',
  );
  const onceOnly = await page.evaluate(() =>
    window.uploads.retry('single', false),
  );
  assert.equal(onceOnly.code, 'timeout');
  assert.deepEqual(onceOnly.attempts, [1]);
  const recovered = await page.evaluate(() =>
    window.uploads.retry('logical-operation', true),
  );
  assert.equal(recovered.result.success, 1);
  assert.deepEqual(recovered.attempts, [1, 2]);
  assert.equal(stored.size, 2);
  assert.equal(
    requests.filter((r) => r.headers['idempotency-key'] === 'logical-operation')
      .length,
    2,
  );
  const conflict = await page.evaluate(() =>
    window.uploads.retry('logical-operation', true, 'different'),
  );
  assert.equal(conflict.status, 409);
  assert.deepEqual(conflict.attempts, [1]);
  report.cases.push(
    'retry off after committed lost response',
    'replay deduplicates committed result',
    'key/payload conflict denied',
  );
  report.stored = stored.size;
  writeFileSync(
    join(reportDir, 'result.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  rmSync(root, { recursive: true, force: true });
}
