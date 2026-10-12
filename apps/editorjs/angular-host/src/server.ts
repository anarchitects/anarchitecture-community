import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import type { RequestContext } from './ssr/request-context';

const browserFolder = resolve(import.meta.dirname, '../browser');
const angularApp = new AngularNodeAppEngine();
let sequence = 0;
const event = (value: object) => console.log(JSON.stringify(value));

/** Private loopback fixture server; the engine owns Angular request rendering. */
export const reqHandler = createNodeRequestHandler(async (req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (pathname === '/fixture-health') {
    res.end('ready');
    return;
  }
  if (pathname === '/fixture-submit') {
    event({ event: 'unexpected-submit' });
    res.writeHead(409).end('No fixture persistence');
    return;
  }
  // Only serve emitted assets. Route HTML goes through Angular's render-mode selection.
  if (/\.(?:js|css|map|ico|png|svg|woff2)$/.test(pathname)) {
    const file = resolve(browserFolder, '.' + decodeURIComponent(pathname));
    if (!file.startsWith(browserFolder + sep)) {
      res.writeHead(400).end();
      return;
    }
    try {
      const body = await readFile(file);
      const mime: Record<string, string> = {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
      };
      res
        .writeHead(200, {
          'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
        })
        .end(body);
    } catch {
      res.writeHead(404).end();
    }
    return;
  }
  const id = ++sequence;
  const delay = Number(req.headers['x-fixture-delay'] ?? 0);
  const context: RequestContext = {
    delay: Number.isInteger(delay) && delay >= 0 && delay <= 200 ? delay : 0,
    owners: 0,
    destroyed: 0,
    loaders: 0,
    loadersDestroyed: 0,
    calls: 0,
    instances: 0,
    errors: 0,
    onOwned: () => event({ event: 'owned', id }),
    onDisposed: () => {
      if (
        context.owners === context.destroyed &&
        context.loaders === context.loadersDestroyed
      ) {
        event({ event: 'disposed', id, lifetime: lifetime(context) });
      }
    },
  };
  event({ event: 'start', id });
  try {
    const response = await angularApp.handle(req, context);
    if (context.errors)
      throw new Error('Angular reported a server rendering error');
    if (response) {
      res.setHeader('X-Fixture-Request', id);
      await writeResponseToNodeResponse(response, res);
    } else res.writeHead(404).end('No fixture route');
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500);
    res.end('SSR fixture failed');
  } finally {
    event({ event: 'finished', id, lifetime: lifetime(context) });
  }
});

function lifetime(context: RequestContext) {
  return {
    owners: context.owners,
    destroyed: context.destroyed,
    loaders: context.loaders,
    loadersDestroyed: context.loadersDestroyed,
    calls: context.calls,
    instances: context.instances,
  };
}

if (isMainModule(import.meta.url)) {
  const server = createServer((req, res) => {
    Promise.resolve(reqHandler(req, res)).catch((error) => {
      console.error(error);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  server.listen(Number(process.env['PORT'] ?? 4319), '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing fixture address');
    event({ event: 'listening', port: address.port });
  });
  process.once('SIGTERM', () => {
    server.close(() => event({ event: 'closed' }));
    server.closeIdleConnections();
  });
}
