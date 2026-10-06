# `@anarchitects/nest-angular-ssr`

Angular SSR integration for NestJS on Fastify, built on `@angular/ssr`.

This package provides three usage levels:

- easiest: `NestAngularSsrModule.forRoot(...)` in a normal Nest `AppModule`
- explicit: `bootstrapNestAngularSsr(...)` during Nest bootstrap
- advanced: direct renderer/integration composition

## Support matrix

Release `0.3.x` supports Node 24, NestJS 11, Fastify 5, and these tested
Angular/Nx combinations. Nx is test infrastructure, not a peer dependency of
this library.

| Angular | TypeScript | Nx             | Status    |
| ------- | ---------- | -------------- | --------- |
| 21.2    | 5.9        | 22.6 (minimum) | Supported |
| 21.2    | 5.9        | 23.1           | Supported |
| 22      | 6.0        | 23.1           | Supported |

The cells are centrally defined in
[`tools/fixtures/nest-angular-ssr-compatibility-matrix.json`](../../../tools/fixtures/nest-angular-ssr-compatibility-matrix.json)
and run as isolated packed-tarball consumers in CI.

## Runtime support

Runtime behavior:

| Request                    | Behavior                                      |
| -------------------------- | --------------------------------------------- |
| `/api/...`                 | Bypasses SSR and stays in Nest/Fastify        |
| Existing browser asset     | Served directly                               |
| Other `GET` / `HEAD` route | Rendered through Angular SSR                  |
| SSR returns `null`         | Falls back to Nest/Fastify not-found handling |

Validated consumer compatibility:

| Consumer shape             | Status    | Notes                      |
| -------------------------- | --------- | -------------------------- |
| CommonJS-oriented Nest app | Supported | Direct module import works |
| ESM Nest app               | Supported | Direct module import works |

The compatibility result above is backed by the fixture validation note at [`docs/validation/nest-angular-ssr-consumers.md`](../../../docs/validation/nest-angular-ssr-consumers.md).

## Requirements

- NestJS 11+ with the Fastify adapter
- Angular 21 or 22 SSR built on `@angular/ssr`
- A built Angular `outputMode: "server"` application (recommended), or the
  legacy app-owned bootstrap/template inputs

Peer dependencies:

- `@angular/ssr`
- `@nestjs/common`
- `@nestjs/core`
- `@nestjs/platform-fastify`
- `fastify`

## Recommended Usage

### Split Angular/Nest build output (recommended)

Build Angular separately with `outputMode: "server"` and an explicit
`ssr.entry`. Construct and export the engine from that entry so the Nest
process never creates a second Angular runtime:

```ts
// frontend/src/server.ts
import { AngularNodeAppEngine } from '@angular/ssr/node';

export const angularSsrEngine = new AngularNodeAppEngine({
  allowedHosts: ['localhost', '127.0.0.1'],
});
```

Register the built output before `listen()`. The package finds the `browser/`
assets and Angular ESM server bundle under the single output root. The runtime
import is safe when this Nest entry is compiled into a CommonJS webpack bundle.

```ts
await bootstrapNestAngularSsr(app, {
  angular: {
    buildOutput: {
      root: 'dist/apps/frontend',
      // Optional overrides:
      // serverBundleCandidates: ['server/server.mjs'],
      // engineExport: 'angularSsrEngine',
    },
    allowedHosts: ['localhost', '127.0.0.1'],
  },
  routing: { apiPrefix: 'api' },
});

await app.listen(3000, '0.0.0.0');
```

For customized split deployments, explicit bootstrap is the recommended
integration. `NestAngularSsrModule.forRoot(...)` and `forRootAsync(...)` use
the same normalization and registration path and remain suitable for standard
Nest startup. Set `enabled: false` for tests and API-only deployments where no
frontend artifacts are available.

### Legacy colocated source mode

Use this mode only when Angular bootstrap code and its server template are
intentionally colocated with Nest.

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
- `@angular/compiler` may be required by this direct-source/JIT path. It is not
  loaded or required by the recommended build-output path.

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

### Explicit Bootstrap Helper (legacy inputs)

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

## Render observability

Set `observability` on `AngularNodeSsrRenderer` or `createAngularSsrRenderer`
to observe rendering directly, using only Web `Request` / `Response` and an
`AngularSsrEngine`. No Nest or Fastify application is needed:

```ts
import { createAngularSsrRenderer } from '@anarchitects/nest-angular-ssr';

const renderer = createAngularSsrRenderer({
  engine: angularSsrEngine,
  observability: {
    applicationId: 'storefront', // Optional stable application identifier.
    observer(event) {
      // Forward events to your own synchronous logging or metrics sink.
      console.log({ event: event.type, applicationId: event.applicationId });
    },
    onObserverError() {
      console.error('SSR observer failed');
    },
  },
});

const response = await renderer.render(new Request('https://example.com/'));
```

For package-created renderers, the same configuration is available as the
top-level `observability` option on `NestAngularSsrModule.forRoot(...)`, the
options returned by `forRootAsync(...)`, and `bootstrapNestAngularSsr(...)`.
For direct `createNestAngularSsrIntegration(...)` composition, use its
`observability` option. If you supply your own `integration.renderer`, configure
instrumentation on that renderer itself.

Every observed render attempt emits `ssr.render.start` before initialization or
engine invocation, followed by exactly one terminal event:

| Event                | Meaning                                                                       | Outcome fields             |
| -------------------- | ----------------------------------------------------------------------------- | -------------------------- |
| `ssr.render.success` | The engine produced a response, including redirects and HTTP error responses. | `durationMs`, `statusCode` |
| `ssr.render.null`    | The engine declined the request; the caller continues its fallback flow.      | `durationMs`               |
| `ssr.render.error`   | Initialization or rendering threw; the original value is rethrown unchanged.  | `durationMs`, `error`      |

Durations use a monotonic clock in milliseconds, include lazy registration and
engine initialization, and exclude that render's observer callbacks. They stop
when the engine produces its result, before response-body streaming or delivery.
Each concurrent call tracks its own duration. Event `timestamp` values use Unix
epoch milliseconds and are independent of the duration clock.

Events include `applicationId` when configured and request method/pathname;
query strings, fragments, headers, bodies, and request context are not included.
The direct renderer does not infer a request ID from headers or context. Use
event type, application ID, and status code for metric labels; raw pathnames can
have high cardinality. Error events retain the original thrown value, so apply
your application's redaction rules before logging errors.

Observers run synchronously. Their return values are ignored; enqueue
asynchronous work in your own sink. Synchronous observer failures are sent to
`onObserverError` when provided, and failures in either callback cannot change
the render result. Without observability configured, the renderer creates no
events and reads no timing clocks. Routing events (API bypass, static assets,
and rejected hosts) are not emitted by the renderer.

### Nest and Fastify routing events

The top-level `observability` configuration also enables routing events through
explicit bootstrap, `forRoot`, and `forRootAsync`. When composing the lower-level
APIs yourself, pass it to both `createNestAngularSsrIntegration(...)` and
`registerNestAngularSsrRoutes(...)` to observe rendering and routing.

| Event               | Selection outcome                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ssr.api.bypass`    | The pathname matches the configured `apiPrefix` or detected Nest global prefix. Emitted once for registered API routes and unmatched API requests, for any HTTP method. |
| `ssr.host.rejected` | An SSR routing request failed `allowedHosts` validation and receives HTTP 400.                                                                                          |
| `ssr.asset.served`  | An existing browser file was selected and handed to Fastify's static-file handler, including HEAD requests. This does not measure transfer completion.                  |

API selection takes precedence over SSR host validation. For GET/HEAD requests
that reach the SSR routes, host validation precedes asset selection. None of these
three outcomes invokes the renderer or emits render events. Missing assets and
blocked asset paths retain their not-found behavior without emitting an
asset-served event. Remaining SSR candidates reach the renderer once, where
`ssr.render.start` marks acceptance; a `null` result still falls back to not-found
handling. Routing does not emit a second render-start event.

Routing events include Fastify's request ID, method, pathname without query or
fragment, and the configured `applicationId`. Observer failures and failures in
`onObserverError` cannot alter routing or responses. With no observer configured,
no API observation hook is installed. An empty API prefix disables API selection
and its bypass events.

### Metrics and structured logging adapters

Copy the following complete, application-owned adapters into `observability.ts`.
The [checked-in example](examples/observability.ts) is typechecked and exercised
by the package's unit and end-to-end tests. These functions are examples, not
runtime exports. They use structural counter, histogram, and log sinks; the
package does not depend on Prometheus, OpenTelemetry, or a logging library.

```ts
import type {
  AngularSsrLifecycleEvent,
  AngularSsrLifecycleObserver,
} from '@anarchitects/nest-angular-ssr';

// Application-owned examples, not exports from the package runtime.
export type Labels = Readonly<Record<string, string>>;

export interface Counter {
  add(value: number, labels: Labels): void;
}

export interface Histogram {
  record(seconds: number, labels: Labels): void;
}

export interface SsrMetrics {
  renders: Counter;
  failures: Counter;
  fallbacks: Counter;
  duration: Histogram;
}

function safeMethod(method: string): string {
  return [
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
    'CONNECT',
    'TRACE',
  ].includes(method)
    ? method
    : 'OTHER';
}

export function createSsrMetricsObserver(
  metrics: SsrMetrics,
): AngularSsrLifecycleObserver {
  return (event) => {
    const labels: Labels = {
      method: safeMethod(event.request.method),
      application: event.applicationId ?? 'unassigned',
    };
    switch (event.type) {
      case 'ssr.render.start':
        metrics.renders.add(1, labels);
        break;
      case 'ssr.render.success':
        metrics.duration.record(event.durationMs / 1000, {
          ...labels,
          outcome: 'success',
          status_class:
            event.statusCode >= 100 && event.statusCode < 600
              ? `${Math.floor(event.statusCode / 100)}xx`
              : 'other',
        });
        break;
      case 'ssr.render.null':
        metrics.fallbacks.add(1, labels);
        metrics.duration.record(event.durationMs / 1000, {
          ...labels,
          outcome: 'null',
          status_class: 'none',
        });
        break;
      case 'ssr.render.error':
        metrics.failures.add(1, labels);
        metrics.duration.record(event.durationMs / 1000, {
          ...labels,
          outcome: 'error',
          status_class: 'none',
        });
        break;
      default:
        // Routing (and future unrelated lifecycle events) are not renders.
        break;
    }
  };
}

export interface SsrLogRecord {
  level: 'info' | 'warn' | 'error';
  event: AngularSsrLifecycleEvent['type'];
  timestamp: number;
  applicationId?: string;
  method: string;
  durationMs?: number;
  statusCode?: number;
}

export function createSsrLoggingObserver(
  write: (record: SsrLogRecord) => void,
): AngularSsrLifecycleObserver {
  return (event) =>
    write({
      level:
        event.type === 'ssr.render.error'
          ? 'error'
          : event.type === 'ssr.host.rejected'
            ? 'warn'
            : 'info',
      event: event.type,
      timestamp: event.timestamp,
      ...(event.applicationId === undefined
        ? {}
        : { applicationId: event.applicationId }),
      method: safeMethod(event.request.method),
      ...('durationMs' in event ? { durationMs: event.durationMs } : {}),
      ...(event.type === 'ssr.render.success'
        ? { statusCode: event.statusCode }
        : {}),
    });
}
```

`renders` counts attempts at `ssr.render.start`; `failures` counts thrown
initialization/render failures; `fallbacks` counts `ssr.render.null`. A produced
HTTP 500 response is a render success with `status_class: '5xx'`, not a thrown
failure. A null result measures the renderer's fallback frequency, not all HTTP
404s: API 404s and missing assets are deliberately excluded. `duration` records
one sample per completed attempt, including null and error outcomes, in **seconds**
(the event's milliseconds divided by 1,000). Histogram boundaries must use seconds.
Label keys stay consistent: missing application IDs use `unassigned`, and
null/error durations use `status_class: 'none'` because no response was produced.
Name these instruments, for example, `ssr_render_attempts_total`,
`ssr_render_failures_total`, `ssr_render_fallbacks_total`, and
`ssr_render_duration_seconds`. Adapt your existing counter's `add`/`inc` and
histogram's `record`/`observe` methods to the structural interfaces above.

The following complete direct-renderer example prints metric updates and JSON
application logs. Replace the console sinks with your application's instruments
and structured logger; the observer itself stays synchronous. In Nest, pass the
same `observability` object to the top-level bootstrap/module option.

```ts
import {
  createAngularSsrRenderer,
  type AngularSsrLifecycleObserver,
  type AngularSsrObservabilityOptions,
} from '@anarchitects/nest-angular-ssr';
import {
  createSsrLoggingObserver,
  createSsrMetricsObserver,
  type Counter,
} from './observability.js';

const counter = (name: string): Counter => ({
  add(value, labels) {
    console.log(JSON.stringify({ instrument: 'counter', name, value, labels }));
  },
});
const measure = createSsrMetricsObserver({
  renders: counter('ssr_render_attempts_total'),
  failures: counter('ssr_render_failures_total'),
  fallbacks: counter('ssr_render_fallbacks_total'),
  duration: {
    record(seconds, labels) {
      console.log(
        JSON.stringify({
          instrument: 'histogram',
          name: 'ssr_render_duration_seconds',
          value: seconds,
          labels,
        }),
      );
    },
  },
});
const log = createSsrLoggingObserver((record) => {
  console.log(JSON.stringify(record));
});
const observers: AngularSsrLifecycleObserver[] = [measure, log];
const observability: AngularSsrObservabilityOptions = {
  applicationId: 'storefront',
  observer(event) {
    // Attempt both sinks even if one fails; rethrow the first failure for
    // the package dispatcher to report through onObserverError.
    const failures: unknown[] = [];
    for (const observer of observers) {
      try {
        observer(event);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) throw failures[0];
  },
  onObserverError(_error, event) {
    // Use a separate diagnostic sink, without logging raw errors or URLs.
    console.error(
      JSON.stringify({ event: 'ssr.observer.failed', source: event.type }),
    );
  },
};
const renderer = createAngularSsrRenderer({
  observability,
  engine: {
    async handle(request) {
      const pathname = new URL(request.url).pathname;
      if (pathname === '/fallback') return null;
      if (pathname === '/error') throw new Error('Example render failure');
      return new Response('Rendered HTML');
    },
  },
});
for (const path of ['/', '/fallback', '/error']) {
  try {
    await renderer.render(new Request(`https://example.com${path}`));
  } catch {
    /* The host still owns render-error handling. */
  }
}
```

An exporter failure can lose measurements from that callback; isolation protects
request handling, not telemetry delivery. Exporters that return promises must
catch their own rejections and use a bounded queue with an explicit drop/backpressure
policy. Returning a promise from an observer does not make it awaited, and
`onObserverError` only receives synchronous failures. Do not make network calls
or wait for an exporter on the SSR request path.

### Ordering, correlation, cardinality, and privacy

A single render emits start, then exactly one success/null/error event. Concurrent
requests can interleave; there is no global ordering between requests. Render
duration uses a monotonic clock and excludes that attempt's observer callbacks;
event timestamps use wall-clock epoch milliseconds and may move backwards.
Rendering ends before response delivery, so a later body/connection failure is
not a render-error event. Routing-only outcomes each emit their one routing
event; missing assets emit no render or asset-served event.

`applicationId` is optional and should be a stable deployment/application name.
It is propagated through both routing and rendering. It is not a tenant ID,
session ID, user ID, or request ID. Fastify routing events carry the host request
ID when available; renderer events currently do not infer or propagate it.
Do not assume pathname or application ID uniquely correlates concurrent renders.
If your application needs richer correlation, supply it in your logging context
and apply your own retention/redaction rules.

Keep metric labels bounded: the examples use a finite method allowlist, outcome,
status class, and an optional stable application ID. Never use raw URLs,
pathnames, query strings, headers, request IDs, user IDs, tenant IDs, exception
messages, or stacks as labels. Even pathnames without queries can contain
personal data or secrets. The logging example deliberately omits pathnames,
request IDs, and the original error. Allowlist and redact any extra log fields
before adding them; avoid serializing the entire lifecycle event. Configure
`applicationId` with a non-sensitive value.

Future [cache work (#34)](https://github.com/anarchitects/anarchitecture-community/issues/34)
can extend the event union with namespaced cache events using the same observer
and shared metadata. No cache events, cache metrics, or caching behavior exist
yet; render counters must not count future cache events as render attempts.
[Multi-app work (#37)](https://github.com/anarchitects/anarchitecture-community/issues/37)
can use the existing optional `applicationId` to distinguish applications.
This identifier does not implement app selection or multi-app orchestration.
Review exhaustive event switches when upgrading to newly added event variants.

### Validation and release notes

The routing/observability end-to-end test follows success, null, error, API
bypass, asset serving, and host rejection through a real Nest/Fastify app and
the instrumented renderer, then checks metric updates and structured records.
Other tests cover all three bootstrap paths, observer failures, concurrent
renders, and deterministic timing.

From the repository root, the complete release gate is:

```sh
yarn nx sync
yarn nx run @anarchitecture-community/source:validate-nest-angular-ssr-release-gate
```

It runs package build/typecheck/test/lint, packed CommonJS and ESM consumers,
the split Angular/Nest fixture, and all Angular/Nx compatibility cells. It
requires Node 24, registry access, and local fixture ports 3311, 3312, and 3320.
Review any fixture reference changes from `nx sync` separately from package
changes. See [unreleased observability notes](RELEASE_NOTES.md) for the rollout
and compatibility details.

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
  - `engine?: AngularSsrEngine`
  - `engineOptions?: AngularSsrEngineOptions`
  - `observability?: Readonly<AngularSsrObservabilityOptions>`
- `CreateNestAngularSsrIntegrationOptions<TContext>`
  - `renderer?: AngularSsrRenderer<TContext>`
  - `rendererOptions?: Omit<AngularNodeSsrRendererOptions, 'observability'>`
  - `observability?: Readonly<AngularSsrObservabilityOptions>`
  - `createRequestContext?: (request, reply) => TContext | Promise<TContext>`
- `RegisterNestAngularSsrRoutesOptions`
  - `browserAssetsDir?: string` (derived from build output when omitted)
  - `apiPrefix?: string`
  - `allowedHosts?: readonly string[]`
  - `observability?: Readonly<AngularSsrObservabilityOptions>`
- `BootstrapNestAngularSsrOptions<TContext>`
  - `enabled?: boolean`
  - `observability?: Readonly<AngularSsrObservabilityOptions>`
  - `angular?: AngularSsrRegistrationOptions | AngularSsrBuildOutputOptions`
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

## Troubleshooting

- `browser assets directory was not found`: build the Angular application
  before Nest and point `angular.buildOutput.root` at the directory containing
  `browser/` and `server/`.
- `Angular server bundle was not found`: keep `outputMode: "server"`, configure
  `ssr.entry`, or provide explicit `serverBundleCandidates`.
- `does not export an engine`: export `angularSsrEngine` from `ssr.entry`, or
  configure `engineExport` to match your chosen name.
- `request host is not allowed`: add the public hostname to `allowedHosts`.
  Rejected hosts deliberately return HTTP 400 instead of an empty CSR shell.
- Do not import or instantiate `AngularNodeAppEngine` in Nest for split mode;
  the single engine instance must be owned by the Angular server bundle.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
