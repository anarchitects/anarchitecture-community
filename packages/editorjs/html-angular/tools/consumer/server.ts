import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
const engine = new AngularNodeAppEngine();
export const reqHandler = createNodeRequestHandler(async (req, res) => {
  try {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    // This fixture only serves generated, single-segment browser assets.
    if (/^\/[a-zA-Z0-9_-]+\.(js|css|map)$/.test(pathname)) {
      const bytes = await readFile(
        new URL(`../browser${pathname}`, import.meta.url),
      );
      res.setHeader(
        'Content-Type',
        pathname.endsWith('.js')
          ? 'text/javascript'
          : pathname.endsWith('.css')
            ? 'text/css'
            : 'application/json',
      );
      res.end(bytes);
      return;
    }
    const response = await engine.handle(req);
    if (response) await writeResponseToNodeResponse(response, res);
    else {
      res.statusCode = 404;
      res.end();
    }
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end();
  }
});
if (isMainModule(import.meta.url)) {
  const server = createServer((req, res) => {
    void reqHandler(req, res);
  });
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (address && typeof address === 'object')
      console.log(`READY ${address.port}`);
  });
}
