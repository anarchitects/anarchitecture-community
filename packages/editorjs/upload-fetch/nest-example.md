# A bounded Nest upload endpoint

This optional application example connects the public Fetch upload ports to a
small Nest backend. Copy the files below into your own application; the package
does not export a Nest module or install any server dependencies.

The example runs on Node **24.15.0**, TypeScript **6.0.3**, Nest common/core
**12.3.2**, RxJS **7.8.2**, reflect-metadata **0.2.2** and Zod **4.6.7**, with
either of these explicitly selected HTTP integrations:

| Integration | Server dependencies                                                              |
| ----------- | -------------------------------------------------------------------------------- |
| Fastify     | `@nestjs/platform-fastify@12.3.2`, `fastify@5.12.7`, `@fastify/multipart@10.1.6` |
| Native Node | `@nestjs/platform-node@12.3.2` (uses its bundled Multer 2.5.0)                   |

This is evidence for the bounded upload example, not production certification,
an SSR support claim, or a change to your application's HTTP adapter default.
See Nest's [file upload APIs](https://docs.nestjs.com/techniques/file-upload)
and [HTTP adapter guidance](https://docs.nestjs.com/techniques/performance).

## Install and run locally

Use a new ESM server directory, separate from the browser application's package
manifest. Install the common dependencies and **one** platform:

```sh
npm init -y
npm pkg set type=module
npm install --save-exact @nestjs/common@12.3.2 @nestjs/core@12.3.2 rxjs@7.8.2 reflect-metadata@0.2.2 zod@4.6.7
npm install --save-dev --save-exact typescript@6.0.3 @types/node@24.10.1
# Fastify:
npm install --save-exact @nestjs/platform-fastify@12.3.2 fastify@5.12.7 @fastify/multipart@10.1.6
# Or native Node, in its own application:
# npm install --save-exact @nestjs/platform-node@12.3.2
```

Save `application.ts`, `local.ts`, `http.ts`, and the selected `fastify.ts` or
`native-node.ts` below. Use this `tsconfig.json` (replace `fastify.ts` with
`native-node.ts` for native Node):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": false,
    "types": ["node"],
    "outDir": "dist"
  },
  "files": ["application.ts", "local.ts", "http.ts", "fastify.ts"]
}
```

```sh
npx tsc -p tsconfig.json
node --input-type=module -e "import { createServer } from './dist/fastify.js'; import { localPorts } from './dist/local.js'; const app = await createServer(localPorts()); await app.listen(3000, '127.0.0.1');"
# For native Node, use './dist/native-node.js' instead.
```

The local demo accepts the literal `Authorization: Bearer local-demo` header.
This is a public demonstration value, not an authentication implementation.
Keep this configuration on loopback. Replace `authenticate` and `authorize`
with your application's existing authentication and policy owners before
deployment. Missing identity fails with 401; denied upload permission fails
with 403, before multipart parsing and storage. JSON parsing remains bounded
and can reject a malformed body before guards run.

## Application and storage seams

The application receives bytes, a principal and an operation key. It knows
nothing about Nest, multipart or HTTP request objects. The storage port must
atomically bind the principal, key, fingerprint, bytes and original receipt.

<!-- nest-example-file: application.ts -->

```ts
import { createHash } from 'node:crypto';

export interface Principal {
  tenant: string;
  user: string;
}
export interface Asset {
  id: string;
  url: string;
  mime: 'image/png';
  size: number;
}
export type Rejection = 'content' | 'url' | 'conflict' | 'capacity';
export class UploadRejected extends Error {
  constructor(readonly code: Rejection) {
    super(code);
  }
}
export interface Store {
  commit(
    principal: Principal,
    key: string,
    fingerprint: string,
    bytes: Uint8Array,
  ): Promise<Asset>;
  read(id: string): Uint8Array | undefined;
}
export interface Ports {
  authenticate(
    authorization: string | undefined,
  ): Promise<Principal | undefined>;
  authorize(principal: Principal): Promise<boolean>;
  accept(bytes: Uint8Array, declaredMime: string): boolean;
  resolveAllowedUrl(url: string): Uint8Array | undefined;
  store: Store;
}
export class Uploads {
  constructor(private readonly ports: Ports) {}
  async file(
    principal: Principal,
    key: string,
    bytes: Uint8Array,
    mime: string,
  ) {
    if (!bytes.length || bytes.length > 1024 || !this.ports.accept(bytes, mime))
      throw new UploadRejected('content');
    return this.save(principal, key, 'file', bytes);
  }
  async url(principal: Principal, key: string, url: string) {
    const bytes = this.ports.resolveAllowedUrl(url);
    if (!bytes) throw new UploadRejected('url');
    if (
      !bytes.length ||
      bytes.length > 1024 ||
      !this.ports.accept(bytes, 'image/png')
    )
      throw new UploadRejected('content');
    return this.save(principal, key, `url:${url}`, bytes);
  }
  private save(
    principal: Principal,
    key: string,
    kind: string,
    bytes: Uint8Array,
  ) {
    const fingerprint = createHash('sha256')
      .update(kind)
      .update('\0')
      .update(bytes)
      .digest('hex');
    return this.ports.store.commit(principal, key, fingerprint, bytes);
  }
}
```

The following local composition accepts **only the exact PNG bytes below**.
It does not claim to validate arbitrary images by MIME type, extension or a
magic-byte check. The only accepted URL is an exact allowlist entry resolved
to those same local bytes. There is no DNS lookup or remote HTTP fetch.

<!-- nest-example-file: local.ts -->

```ts
import { randomUUID } from 'node:crypto';
import {
  UploadRejected,
  type Asset,
  type Ports,
  type Store,
} from './application.js';

export const approvedUrl = 'https://uploads.example.test/approved.png';
export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=',
  'base64',
);

export function memoryStore(capacity = 32): Store {
  const receipts = new Map<string, { fingerprint: string; asset: Asset }>();
  const files = new Map<string, Uint8Array>();
  return {
    async commit(principal, key, fingerprint, bytes) {
      const scopedKey = JSON.stringify([principal.tenant, principal.user, key]);
      const previous = receipts.get(scopedKey);
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new UploadRejected('conflict');
        return { ...previous.asset };
      }
      if (receipts.size >= capacity) throw new UploadRejected('capacity');
      const id = randomUUID();
      const asset: Asset = {
        id,
        url: `/media/${id}`,
        mime: 'image/png',
        size: bytes.length,
      };
      // No await between lookup and commit: atomic only within this one process.
      files.set(id, Uint8Array.from(bytes));
      receipts.set(scopedKey, { fingerprint, asset });
      return { ...asset };
    },
    read(id) {
      return files.get(id)?.slice();
    },
  };
}

export function localPorts(): Ports {
  return {
    async authenticate(header) {
      return header === 'Bearer local-demo'
        ? { tenant: 'demo', user: 'author' }
        : undefined;
    },
    async authorize() {
      return true;
    },
    accept: (bytes, mime) => mime === 'image/png' && png.equals(bytes),
    resolveAllowedUrl: (url) => (url === approvedUrl ? png.slice() : undefined),
    store: memoryStore(),
  };
}
```

This store retains up to 32 receipts and files (at most 1 KiB each). It rejects
new keys when full instead of evicting receipts and accidentally allowing a
replay to create another file. It is **not durable or shared across processes**:
restart loses both files and deduplication. Production replay safety requires
atomic durable storage, a defined retention/retry window, quotas and cleanup.
The media route is deliberately public for these controlled demonstration
images; confidential media needs a separate authorized delivery policy.

## Nest presentation

`POST /uploads/file` accepts one multipart file named `image` and no text
fields. `POST /uploads/url` accepts exactly `{ "url": "..." }`. Both require
an `Idempotency-Key` of 8–80 ASCII letters, digits, underscores or hyphens.
These routes and envelopes are **example-local**, not a canonical ecosystem
upload API. Zod validates the URL body through Nest's Standard Schema binding.

<!-- nest-example-file: http.ts -->

```ts
import 'reflect-metadata';
import {
  Body,
  Catch,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Injectable,
  Module,
  Param,
  Post,
  Req,
  StreamableFile,
  StandardSchemaValidationPipe,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  type ArgumentsHost,
  type CanActivate,
  type ExceptionFilter,
  type ExecutionContext,
  type INestApplication,
  type NestInterceptor,
  type Type,
} from '@nestjs/common';
import { z } from 'zod';
import {
  UploadRejected,
  Uploads,
  type Ports,
  type Principal,
} from './application.js';

const urlBody = z.object({ url: z.string().min(1).max(512) }).strict();
interface RequestContext {
  headers: Record<string, string | string[] | undefined>;
}
interface ParsedFile {
  buffer?: Buffer;
  mimetype: string;
}
export const fileLimits = {
  fileSize: 1024,
  files: 1,
  fields: 0,
  parts: 2,
  fieldNameSize: 32,
  fieldSize: 128,
};

export function uploadModule(
  ports: Ports,
  fileInterceptor: Type<NestInterceptor>,
) {
  const uploads = new Uploads(ports);
  const contexts = new WeakMap<
    RequestContext,
    { principal: Principal; key: string }
  >();
  @Injectable()
  class UploadGuard implements CanActivate {
    async canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest<RequestContext>();
      const authorization = request.headers['authorization'];
      const principal = await ports.authenticate(
        typeof authorization === 'string' ? authorization : undefined,
      );
      if (!principal) throw new HttpException('Unauthorized', 401);
      if (!(await ports.authorize(principal)))
        throw new HttpException('Forbidden', 403);
      const key = request.headers['idempotency-key'];
      if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(key))
        throw new HttpException('Invalid operation key', 400);
      contexts.set(request, { principal, key });
      return true;
    }
  }
  @Controller('uploads')
  @UseGuards(UploadGuard)
  @UsePipes(new StandardSchemaValidationPipe())
  class UploadController {
    @Post('file')
    @HttpCode(200)
    @UseInterceptors(fileInterceptor)
    async file(
      @Req() request: RequestContext,
      @UploadedFile() file?: ParsedFile,
    ) {
      if (!file?.buffer) throw new HttpException('File required', 400);
      const { principal, key } = contexts.get(request)!;
      return {
        asset: await uploads.file(principal, key, file.buffer, file.mimetype),
      };
    }
    @Post('url')
    @HttpCode(200)
    async url(
      @Req() request: RequestContext,
      @Body({ schema: urlBody }) body: z.infer<typeof urlBody>,
    ) {
      const { principal, key } = contexts.get(request)!;
      return { asset: await uploads.url(principal, key, body.url) };
    }
  }
  @Controller('media')
  class MediaController {
    @Get(':id')
    image(@Param('id') id: string) {
      const bytes = ports.store.read(id);
      if (!bytes) throw new HttpException('Not found', 404);
      return new StreamableFile(bytes, {
        type: 'image/png',
        length: bytes.length,
      });
    }
  }
  @Module({
    controllers: [UploadController, MediaController],
    providers: [UploadGuard],
  })
  class UploadModule {}
  return UploadModule;
}

export function installErrors(app: INestApplication) {
  @Catch()
  class UploadErrors implements ExceptionFilter {
    catch(error: unknown, host: ArgumentsHost) {
      const rejectionStatus = {
        content: 422,
        url: 422,
        conflict: 409,
        capacity: 429,
      };
      const status =
        error instanceof UploadRejected
          ? rejectionStatus[error.code]
          : error instanceof HttpException
            ? error.getStatus()
            : 500;
      const codes: Record<number, string> = {
        400: 'request',
        401: 'unauthenticated',
        403: 'forbidden',
        404: 'missing',
        413: 'too-large',
        415: 'media-type',
      };
      const code =
        error instanceof UploadRejected
          ? error.code
          : (codes[status] ?? 'internal');
      const response = host.switchToHttp().getResponse();
      const adapter = app.getHttpAdapter();
      adapter.setHeader(response, 'Cache-Control', 'no-store');
      adapter.setHeader(response, 'X-Content-Type-Options', 'nosniff');
      adapter.reply(response, { problem: { code } }, status);
    }
  }
  app.useGlobalFilters(new UploadErrors());
}
```

Only the following composition files import platform packages. Each uses its
own documented interceptor and JSON body limit. Neither parser trusts the
filename for storage paths. Unsupported payloads never reach `commit`.

<!-- nest-example-file: fastify.ts -->

```ts
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { FileInterceptor } from '@nestjs/platform-fastify/multipart';
import type { Ports } from './application.js';
import { fileLimits, installErrors, uploadModule } from './http.js';

export async function createServer(ports: Ports) {
  const app = await NestFactory.create<NestFastifyApplication>(
    uploadModule(ports, FileInterceptor('image', { limits: fileLimits })),
    new FastifyAdapter({ bodyLimit: 1024, requestTimeout: 10_000 }),
    { logger: false },
  );
  installErrors(app);
  return app;
}
```

<!-- nest-example-file: native-node.ts -->

```ts
import { NestFactory } from '@nestjs/core';
import {
  FileInterceptor,
  NodeAdapter,
  type NestNodeApplication,
} from '@nestjs/platform-node';
import type { Ports } from './application.js';
import { fileLimits, installErrors, uploadModule } from './http.js';

export async function createServer(ports: Ports) {
  const app = await NestFactory.create<NestNodeApplication>(
    uploadModule(ports, FileInterceptor('image', { limits: fileLimits })),
    new NodeAdapter(),
    { logger: false, bodyParser: false },
  );
  app.useBodyParser('json', { limit: 1024, inflate: false });
  app.getHttpServer().requestTimeout = 10_000;
  installErrors(app);
  return app;
}
```

## Browser mapping and replay

Install `@anarchitects/editorjs-core` and `@anarchitects/editorjs-upload-fetch`
in the browser application, following the package [installation guide](./README.md).
Serve the browser application and these routes on one origin (or supply your
own deliberately configured CORS/credential policy). No Nest or Node imports
belong in the browser bundle.

<!-- nest-example-file: client.ts -->

```ts
import {
  composeImageUploader,
  createUploadOperation,
  type UploadResponse,
} from '@anarchitects/editorjs-core';
import {
  createFetchFileUploader,
  createFetchUrlUploader,
  FetchUploadError,
} from '@anarchitects/editorjs-upload-fetch/browser';

interface Asset {
  id: string;
  url: string;
  mime: 'image/png';
  size: number;
}
interface Problem {
  code: string;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function decode(body: unknown): UploadResponse<Asset, Problem> {
  if (!record(body)) throw new Error('Invalid response');
  const asset = body['asset'];
  if (
    Object.keys(body).length === 1 &&
    record(asset) &&
    Object.keys(asset).sort().join(',') === 'id,mime,size,url' &&
    typeof asset['id'] === 'string' &&
    /^[0-9a-f-]{36}$/.test(asset['id']) &&
    asset['url'] === `/media/${asset['id']}` &&
    asset['mime'] === 'image/png' &&
    typeof asset['size'] === 'number' &&
    Number.isInteger(asset['size']) &&
    asset['size'] > 0 &&
    asset['size'] <= 1024
  ) {
    return {
      success: 1,
      file: {
        id: asset['id'],
        url: asset['url'],
        mime: 'image/png',
        size: asset['size'],
      },
    };
  }
  const problem = body['problem'];
  if (
    Object.keys(body).length === 1 &&
    record(problem) &&
    Object.keys(problem).length === 1 &&
    typeof problem['code'] === 'string' &&
    [
      'request',
      'unauthenticated',
      'forbidden',
      'missing',
      'too-large',
      'media-type',
      'content',
      'url',
      'conflict',
      'capacity',
      'internal',
    ].includes(problem['code'])
  )
    return { success: 0, error: { code: problem['code'] } };
  throw new Error('Invalid response');
}

// One instance per logical operation; reuse the key only for that operation's attempts.
export function uploadOperation(
  key: string,
  authorization: string,
  timeoutMs = 5000,
) {
  const headers = { Authorization: authorization, 'Idempotency-Key': key };
  return composeImageUploader(
    createFetchFileUploader<Asset, Problem>({
      request(blob) {
        const body = new FormData();
        body.append(
          'image',
          blob,
          blob instanceof File ? blob.name : 'upload.png',
        );
        return {
          url: '/uploads/file',
          timeoutMs,
          init: { method: 'POST', headers, body },
        };
      },
      decode,
      decodeHttpErrors: true,
    }),
    createFetchUrlUploader<Asset, Problem>({
      request(url) {
        return {
          url: '/uploads/url',
          timeoutMs,
          init: {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          },
        };
      },
      decode,
      decodeHttpErrors: true,
    }),
  );
}

// Opt in only while the same server/store retains this principal/key/outcome.
export function replayableFile(blob: Blob, key: string, authorization: string) {
  const uploader = uploadOperation(key, authorization);
  return createUploadOperation(() => uploader.uploadByFile(blob), {
    retry: {
      replaySafe: true,
      maxAttempts: 2,
      delayMs: 100,
      shouldRetry: (outcome) =>
        outcome.kind === 'exception' &&
        outcome.error instanceof FetchUploadError &&
        ['network', 'timeout'].includes(outcome.error.code),
      schedule(resume, delay) {
        const timer = setTimeout(resume, delay);
        return () => clearTimeout(timer);
      },
    },
  });
}
```

Call `uploadOperation(crypto.randomUUID(), authorization).uploadByFile(blob)`
or `.uploadByUrl('https://uploads.example.test/approved.png')`. To try the
closed content policy, send a PNG whose bytes match `png` above. A successful
result is `{ success: 1, file: { id, url, mime, size } }`; application and HTTP
rejections become `{ success: 0, error: { code } }`. Network, timeout, response
and decoding failures still reject with `FetchUploadError`. No retry occurs
unless you select `replayableFile` and can uphold its storage assumption.

Duplicate submissions from the same tenant/user and key return the original
receipt, even concurrently. A key reused with a different operation/payload
returns 409. Different principals have separate namespaces. Authorization runs
again on replay, so a revoked permission cannot recover a previous success.
Every attempt builds new FormData; the key stays stable across retries.
Cancellation/timeout does not undo a remote commit.

For Image Tool, compose an uploader per logical call rather than sharing a
permanent operation key. Your host owns alt-text authoring: preserve unset,
authored and explicitly decorative values separately from the caption. This
endpoint returns asset metadata only and never infers alt text from a filename.

## Before using a real backend

Replace the local identity, permission and exact-byte policy with your host's
verified implementations; retain negative tests. Real image handling needs
bounded decoding, dimensions, content checks/scanning and safe metadata
handling. Storage needs durable atomic deduplication, tenant isolation,
capacity limits, retention and a media-delivery policy. Keep URL import
disabled unless you implement and test SSRF protections, DNS/redirect rules,
timeouts and download-size limits; an allowlist string check followed by an
unrestricted fetch is insufficient.

Configure HTTPS, proxy trust, request/header/concurrency limits, rate limits,
observability and your existing session authority. If you use cookies, add
the corresponding CSRF and credential/CORS controls. Check expected parser
errors after any adapter/dependency upgrade. 413 means the byte limit was
exceeded; 422 means the controlled content/URL policy rejected the input; 409
means a key was reused incorrectly; 429 means this local store is full. A 500
exposes only `internal`; investigate server-side without returning stack traces,
tokens or storage details to the browser.
