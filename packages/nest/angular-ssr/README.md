# `@anarchitects/nest-angular-ssr`

Angular SSR integration for NestJS on Fastify, built on `@angular/ssr`.

This package provides three usage levels:

- easiest: `NestAngularSsrModule.forRoot(...)` in a normal Nest `AppModule`
- explicit: `bootstrapNestAngularSsr(...)` during Nest bootstrap
- advanced: direct renderer/integration composition

## v1 Support

Runtime behavior:

| Request | Behavior |
| --- | --- |
| `/api/...` | Bypasses SSR and stays in Nest/Fastify |
| Existing browser asset | Served directly |
| Other `GET` / `HEAD` route | Rendered through Angular SSR |
| SSR returns `null` | Falls back to Nest/Fastify not-found handling |

Validated consumer compatibility:

| Consumer shape | Status | Notes |
| --- | --- | --- |
| CommonJS-oriented Nest app | Supported | Direct module import works |
| ESM Nest app | Supported | Direct module import works |

The compatibility result above is backed by the fixture validation note at [`docs/validation/nest-angular-ssr-consumers.md`](../../../docs/validation/nest-angular-ssr-consumers.md).

## Requirements

- NestJS 11+ with the Fastify adapter
- Angular SSR built on `@angular/ssr`
- An explicit browser assets directory
- An app-owned Angular server bootstrap entry or bootstrap function

Peer dependencies:

- `@angular/ssr`
- `@nestjs/common`
- `@nestjs/core`
- `@nestjs/platform-fastify`
- `fastify`

## Recommended Usage

### Nest Module

Use the module when you want a normal Nest `AppModule`-based setup.

```ts
import { Module } from '@nestjs/common';
import { join } from 'node:path';
import {
  type AngularSsrRegistrationOptions,
  NestAngularSsrModule,
} from '@anarchitects/nest-angular-ssr';
import { bootstrapServerApplication } from './main.server';

const angular = {
  bootstrap: async () => bootstrapServerApplication,
  templatePath: join(process.cwd(), 'src/index.server.html'),
  routeExtractionUrl: 'http://127.0.0.1/',
  allowedHosts: ['127.0.0.1', 'localhost'],
  inlineCriticalCss: false,
} satisfies AngularSsrRegistrationOptions;

@Module({
  imports: [
    NestAngularSsrModule.forRoot({
      angular,
      routing: {
        browserAssetsDir: 'dist/apps/web/browser',
      },
    }),
  ],
})
export class AppModule {}
```

```ts
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.setGlobalPrefix('api');
  await app.listen(3000, '0.0.0.0');
}

void bootstrap();
```

Notes:

- `browserAssetsDir` is required.
- `angular.bootstrap` is required and remains application-owned.
- `angular.templatePath` should point to your server HTML document, typically `src/index.server.html`.
- `angular.baseHref` defaults to `'/'`.
- `angular.inlineCriticalCss` defaults to `false`.
- `angular.routeExtractionUrl` defaults to `http://localhost/`.
- `angular.allowedHosts` is optional. Leave it unset unless you want explicit host restrictions for the Angular SSR engine.
- Angular/Nx SSR generator output can usually be reused directly: keep your `main.server.ts` as the bootstrap entry and point `templatePath` at the generated `index.server.html`.
- When your app uses `app.setGlobalPrefix(...)`, SSR routing follows that prefix automatically.
- Set `routing.apiPrefix` only when you need to override the detected Nest global prefix.
- `NestAngularSsrModule.forRootAsync(...)` is available when the same option shape needs to come from Nest DI or async config.

```ts
NestAngularSsrModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    angular: {
      bootstrap: async () => bootstrapServerApplication,
      templatePath: config.getOrThrow<string>('WEB_INDEX_SERVER_TEMPLATE'),
    },
    routing: {
      browserAssetsDir: config.getOrThrow<string>('WEB_BROWSER_ASSETS_DIR'),
    },
  }),
});
```

### Explicit Bootstrap Helper

Use this when you want explicit bootstrap wiring in `main.ts`.

```ts
import { NestFactory } from '@nestjs/core';
import { join } from 'node:path';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { bootstrapNestAngularSsr } from '@anarchitects/nest-angular-ssr';

import { AppModule } from './app.module';
import { bootstrapServerApplication } from './main.server';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.setGlobalPrefix('api');

  await bootstrapNestAngularSsr(app, {
    angular: {
      bootstrap: async () => bootstrapServerApplication,
      templatePath: join(process.cwd(), 'src/index.server.html'),
    },
    routing: {
      browserAssetsDir: 'dist/apps/web/browser',
    },
  });

  await app.listen(3000, '0.0.0.0');
}

void bootstrap();
```

`BootstrapNestAngularSsrOptions` keeps three explicit groups:

- `angular`: public Angular SSR registration/bootstrap input
- `integration`: renderer injection or request-context customization
- `routing`: browser assets directory and optional API-prefix override

## Advanced Composition

Use the lower-level APIs only if the module or bootstrap helper is too opinionated for your app:

- `createAngularSsrRenderer(...)`
- `AngularNodeSsrRenderer`
- `createNestAngularSsrIntegration(...)`
- `registerNestAngularSsrRoutes(...)`

At the renderer layer, `createAngularSsrRenderer({ registration })` is the advanced entry point for package-owned Angular registration without the Nest module/bootstrap helpers.

If you want to normalize a template file up front, use `createAngularSsrRegistration(...)`:

```ts
import { join } from 'node:path';
import { createAngularSsrRegistration } from '@anarchitects/nest-angular-ssr';

const registration = await createAngularSsrRegistration({
  bootstrap: async () => bootstrapServerApplication,
  templatePath: join(process.cwd(), 'src/index.server.html'),
});
```

These APIs keep the public boundary small:

- SSR core stays on Web `Request` / `Response`
- Nest integration is Fastify-only in v1
- routing and bootstrap remain explicit concerns

## Existing Option Shapes

- `AngularSsrRegistrationOptions`
  - `bootstrap: AngularSsrServerBootstrapLoader`
  - `templatePath: string`
  - `baseHref?: string`
  - `inlineCriticalCss?: boolean`
  - `routeExtractionUrl?: string | URL`
  - `allowedHosts?: readonly string[]`
- `ResolvedAngularSsrRegistrationOptions`
  - `bootstrap: AngularSsrServerBootstrapLoader`
  - `templatePath: string`
  - `document: string`
  - `baseHref?: string`
  - `inlineCriticalCss?: boolean`
  - `routeExtractionUrl?: string | URL`
  - `allowedHosts?: readonly string[]`
- `AngularNodeSsrRendererOptions`
  - `registration?: AngularSsrRegistrationOptions | ResolvedAngularSsrRegistrationOptions`
  - `engine?: AngularNodeAppEngine`
  - `engineOptions?: AngularNodeAppEngineOptions`
- `CreateNestAngularSsrIntegrationOptions<TContext>`
  - `renderer?: AngularSsrRenderer<TContext>`
  - `rendererOptions?: AngularNodeSsrRendererOptions`
  - `createRequestContext?: (request, reply) => TContext | Promise<TContext>`
- `RegisterNestAngularSsrRoutesOptions`
  - `browserAssetsDir: string`
  - `apiPrefix?: string`
- `BootstrapNestAngularSsrOptions<TContext>`
  - `angular?: AngularSsrRegistrationOptions`
  - `integration?: CreateNestAngularSsrIntegrationOptions<TContext>`
  - `routing: RegisterNestAngularSsrRoutesOptions`
- `NestAngularSsrModuleOptions<TContext>`
  - alias of `BootstrapNestAngularSsrOptions<TContext>`

The mutually exclusive pairs are enforced in code:

- renderer `registration` vs `engine`
- renderer `registration` vs `engineOptions`
- renderer `engine` vs `engineOptions`
- integration `renderer` vs `rendererOptions`
- bootstrap `angular` vs `integration.renderer`
- bootstrap `angular` vs `integration.rendererOptions`

## Constraints and Non-Goals

v1 intentionally does not do the following:

- support Express or non-Fastify Nest adapters
- use `ServeStaticModule`
- add hidden auto-bootstrap outside the Nest module lifecycle or explicit helper call
- take ownership of your Angular server bootstrap implementation
- claim support for every Nest/Angular deployment shape
- recreate legacy Universal APIs exactly

This package is intentionally scoped to modern Angular SSR on Nest + Fastify.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
