# `@anarchitects/nest-angular-ssr`

Angular SSR integration for NestJS on Fastify, built on `@angular/ssr`.

This package provides three usage levels:

- easiest: `NestAngularSsrModule.forRoot(...)` in a normal Nest `AppModule`
- explicit: `bootstrapNestAngularSsr(...)` during Nest bootstrap
- advanced: direct renderer/integration composition

## Support matrix

The Nest 12 feature line is **unreleased**. Its bounded installation contract is
Node `>=24.22.3 <25`, Nest common/core/platform-fastify `~12.5.0`, Fastify
`~5.12.8`, and the coherent Angular combination below. Local packed-consumer
certification covers the combinations below; publication is still pending. The
source manifest is not an available Nest 12 registry release.

| Angular framework | Angular SSR/build | TypeScript | Nx tooling | Consumer shapes                                                    |
| ----------------- | ----------------- | ---------- | ---------- | ------------------------------------------------------------------ |
| 22.2.6            | 22.2.7            | 6.0.3      | 24.0.6     | CJS and ESM Nest; split Angular ESM server/CJS Nest with hydration |

Nx is validation/build tooling, not a runtime peer. The peer ranges admit patches
within these minor trains; the rows identify exact tested combinations, not every
possible cross-product. Native Node and Express are not supported by this implementation.

### Nest 11 maintenance and migration

Published `0.3.x` artifacts belong to the Nest 11 line. The next maintenance
release raises `@nestjs/platform-fastify` to `^11.2.10`; this is a breaking
installation minimum and requires a distinct successor minor. Upgrade Nest
common/core/platform-fastify coherently to 11.2.10 or a separately verified patch.
A root Fastify override does **not** fix vulnerabilities in the older adapter
itself. Keep Angular framework packages coherent and use patched SSR/build
packages; a successful install alone does not establish a safe dependency tree.

The maintenance line receives security and critical-defect fixes only. New
features target Nest 12. For each framework, the previous major's maintenance
window is 90 calendar days from this package's first verified generally available
release supporting its successor, subject to recorded existing commitments.
Nest and Angular have separate clocks. No EOM date is announced here before the
release/commitment inventory is complete. Published older artifacts remain
available after maintenance ends.

To migrate to the Nest 12 line:

1. Select an actually published, reviewed SSR version for Nest 12; inspect its
   peers rather than assuming that an npm channel or the source manifest identifies
   the right line. Keep the prior application version and lockfile for rollback.
2. Upgrade Nest common, core and platform-fastify together to the declared 12.5
   train. Use Node 24.22.3 or a later Node 24 patch and the coherent Angular 22.2
   combination above. Angular 21, Angular 22.1 and Nest 11 cannot install this
   feature-line artifact. Do not bypass peer or engine checks.
3. Keep existing `forRoot`, `forRootAsync`, explicit bootstrap and low-level
   integration calls: their signatures are unchanged. Select Fastify explicitly.
   CJS hosts need Node's enabled `require(esm)` support for Nest 12. Keep the
   separately built Angular server bundle ESM.
4. Build Angular before starting Nest. Verify SSR and hydration, static assets,
   API routes and API misses, host/proxy rules, cookies, redirects, HEAD and
   not-found handling in the application's deployment environment.
5. Roll back by restoring the previous reviewed application artifact and complete
   dependency lock together; do not combine Nest 11 peers with the Nest 12 package.
   The application owner controls deployment and rollback.

The intended channels are `nest11` for maintenance and `next` for initial Nest 12
availability, with separately reviewed promotion to `latest`. They are not yet
established by this source tree. Pin a reviewed version and lockfile rather than
relying on a mutable channel. Until a Nest 12 release is published, existing
consumers must retain their reviewed Nest 11 package and address its dependency
security findings.

## Installation

In an existing Nest/Fastify host, set `SSR_VERSION` to an **actually published
Nest 12-compatible version** before running this command. There is no such
registry version at this documentation review; do not substitute `0.3.2`.

```sh
: "${SSR_VERSION:?Set an approved published Nest 12 SSR version}"
npm install --save-exact "@anarchitects/nest-angular-ssr@${SSR_VERSION}" \
  @nestjs/common@12.5.0 @nestjs/core@12.5.0 @nestjs/platform-fastify@12.5.0 \
  fastify@5.12.8 reflect-metadata@0.2.2 rxjs@7.8.2 \
  @angular/common@22.2.6 @angular/compiler@22.2.6 @angular/core@22.2.6 \
  @angular/platform-browser@22.2.6 @angular/platform-server@22.2.6 \
  @angular/router@22.2.6 @angular/ssr@22.2.7
```

Use the compatible Angular build toolchain in the frontend project; the package
does not generate an Angular application or require Nx at runtime. In split
builds, Angular owns its application dependencies and server bundle; the Nest
host still satisfies this package's declared peers. Do not bundle a second
Angular engine into Nest.

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

These shapes describe the bounded versions above. The host owns its build,
application providers, authentication, authorization, persistence and deployment.
The package owns the SSR bridge, browser-asset routing and Nest integration;
it does not install auth, mail or schema-validation infrastructure.

## Requirements

- NestJS common/core/platform-fastify `~12.5.0`
- Angular framework `~22.2.6` with SSR `~22.2.7`, paired as above
- Node `>=24.22.3 <25`, Fastify `~5.12.8` and reflect-metadata `^0.2.0`
- A built Angular `outputMode: "server"` application (recommended), or the
  legacy app-owned bootstrap/template inputs

Peer dependencies:

- `@angular/ssr`
- `@nestjs/common`
- `@nestjs/core`
- `@nestjs/platform-fastify`
- `fastify`

The static-file dependency is `@fastify/static ~10.1.11`. The host selects and
configures `FastifyAdapter` explicitly; the library does not switch HTTP adapters.
Responses retain the existing buffered body behavior; streaming/backpressure parity
with other HTTP adapters is not claimed. The bridge reads the complete Web Response
before sending it, including for HEAD requests; use bounded response bodies.
Client disconnects do not abort the renderer's `Request.signal`. Applications
that need cancellable rendering or streaming must supply those capabilities outside
this bridge. Renderer and body-read failures use Nest's normal exception handling.

### Static files and reverse proxies

Browser assets must be public build output. Keep secrets and private uploads
outside `browserAssetsDir`. Non-canonical paths (dot segments, repeated slashes,
encoded separators and case aliases) are rejected instead of resolving them to
files behind a different route spelling. Use exact asset filename casing.

SSR host validation and request URLs follow Fastify's `trustProxy` policy.
Forwarded host/protocol headers are ignored by default. Behind a reverse proxy,
configure `new FastifyAdapter({ trustProxy: '127.0.0.1' })` only if that address
is your trusted proxy; otherwise use your proxy's actual addresses or CIDRs.
Restrict direct access to the backend and have the proxy replace forwarded
headers. Avoid trusting arbitrary clients. Set `allowedHosts` to your public
hostnames. Deployments that previously relied on unconditional forwarded-header
trust must configure this explicitly when upgrading.

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
// backend/src/main.ts (AppModule contains the application's Nest API modules)
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { bootstrapNestAngularSsr } from '@anarchitects/nest-angular-ssr';
import { AppModule } from './app.module.js';

async function main() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.setGlobalPrefix('api');

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
}

void main();
```

The Angular application must already have its normal browser bootstrap, server
bootstrap, server-rendered routes and hydration providers configured. Build it
with its application builder before starting the compiled Nest host. Run Nest
from the directory against which `dist/apps/frontend` resolves. A browser GET to
`http://localhost:3000/` should return rendered application HTML and hydrate;
`/api/...` stays with Nest, including API 404s.

For module-driven startup, replace the explicit helper call with this import in
your application module and keep the same Fastify bootstrap and global prefix:

```ts
import { Module } from '@nestjs/common';
import { NestAngularSsrModule } from '@anarchitects/nest-angular-ssr';

@Module({
  imports: [
    NestAngularSsrModule.forRoot({
      angular: {
        buildOutput: { root: 'dist/apps/frontend' },
        allowedHosts: ['localhost', '127.0.0.1'],
      },
      routing: { apiPrefix: 'api' },
    }),
  ],
})
export class AppModule {}
```

Register SSR once: choose the module lifecycle **or** explicit bootstrap. Do not
call both for the same app. `forRootAsync` accepts `imports`, `inject` and an
async `useFactory` returning the same options. For environment-only configuration:

```ts
NestAngularSsrModule.forRootAsync({
  useFactory: async () => ({
    enabled: process.env['SSR_ENABLED'] !== 'false',
    angular: {
      buildOutput: {
        root: process.env['WEB_OUTPUT_ROOT'] ?? 'dist/apps/frontend',
      },
      allowedHosts: ['localhost', '127.0.0.1'],
    },
    routing: { apiPrefix: 'api' },
  }),
});
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
- Nest integration is Fastify-only in this release line
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
The [checked-in example](https://github.com/anarchitects/anarchitecture-community/blob/main/packages/nest/angular-ssr/examples/observability.ts) is typechecked and exercised
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

No cache behavior or multi-application orchestration is implemented. The optional
`applicationId` labels observations; it does not select an Angular application.
Review exhaustive event switches when upgrading to newly added event variants.

## Public API and configuration

Import runtime functions and types from `@anarchitects/nest-angular-ssr` only;
`./package.json` is the other supported package entry point. Use the module or
bootstrap helper for normal composition; direct renderer, integration, route
registration and `resolveAngularSsrBuildOutput` are advanced public entry points.

- `AngularSsrBuildOutputOptions`
  - `buildOutput.root: string` (resolved from the process working directory)
  - `buildOutput.browserAssetsDir?: string` (default `browser`, relative to root)
  - `buildOutput.serverBundleCandidates?: readonly string[]` (default
    `server/server.mjs`, `server/main.server.mjs`, `server/main.mjs`, in order)
  - `buildOutput.engineExport?: string` (default `angularSsrEngine`)
  - `buildOutput.importStrategy?: 'runtime' | 'native'` (default `runtime`;
    preserves dynamic import through CJS bundling)
  - `allowedHosts?: readonly string[]`
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

`enabled` defaults to true; false returns before loading frontend files. In
build-output mode, explicit `routing.browserAssetsDir` and `routing.allowedHosts`
override derived assets and `angular.allowedHosts`. Configure the exported Angular
engine's own host allowlist separately. In legacy registration mode,
`angular.allowedHosts` configures the engine; set `routing.allowedHosts` as well
when you want to restrict the routing/static-asset boundary. An absent or empty
routing allowlist does not restrict hosts. Explicit `routing.apiPrefix` overrides
the Nest global prefix; an empty value disables bypass. Without either, there is
no API prefix. Prefix matching includes the exact prefix and its slash descendants.

The mutually exclusive pairs are enforced in code:

- renderer `registration` vs `engine`
- renderer `registration` vs `engineOptions`
- renderer `engine` vs `engineOptions`
- integration `renderer` vs `rendererOptions`
- bootstrap `angular` vs `integration.renderer`
- bootstrap `angular` vs `integration.rendererOptions`

## Constraints and Non-Goals

This implementation does not do the following:

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
- Peer/engine install errors: check the selected package line, Node patch and
  coherent framework versions; do not use `--force` or `--legacy-peer-deps`.
- `ERR_REQUIRE_ESM`: use the tested Node 24 line without disabling `require(esm)`;
  keep Angular's split server output ESM and use the runtime import strategy.
- Duplicate-route errors: remove either the module registration or explicit helper.
- API misses render HTML: match `routing.apiPrefix` to the Nest global prefix.
- Large or endless response bodies: this bridge buffers them; it is unsuitable
  for unbounded streams. Client disconnects do not cancel Angular rendering.
- Hydration mismatches: keep initial server/client DOM consistent, isolate request
  state and exclude browser-only imports from server evaluation. The host owns
  hydration providers and safe transfer-cache configuration.
- Do not import or instantiate `AngularNodeAppEngine` in Nest for split mode;
  the single engine instance must be owned by the Angular server bundle.

For help, report a minimal reproduction with exact package/framework versions in
the [issue tracker](https://github.com/anarchitects/anarchitecture-community/issues).
Do not include credentials, private request data or tokens.

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](https://github.com/anarchitects/anarchitecture-community/blob/main/LICENSE) and [NOTICE](https://github.com/anarchitects/anarchitecture-community/blob/main/NOTICE) files.
