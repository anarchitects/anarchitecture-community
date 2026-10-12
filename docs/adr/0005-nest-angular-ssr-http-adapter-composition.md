# ADR 0005: Compose Nest Angular SSR Through HTTP Adapter Boundaries

## Status

Accepted

## Context

`@anarchitects/nest-angular-ssr` v0.3.x supports Fastify, Nest 11 and Angular 21/22. Its renderer already consumes Web `Request` and returns Web `Response | null`, but integration and routing use Fastify request/reply types, `@fastify/static`, native Fastify hooks, route registration, buffering via `response.arrayBuffer()`, and `getHttpAdapter().getType() === 'fastify'`. Published peer dependencies require Fastify. [Epic #33](https://github.com/anarchitects/anarchitecture-community/issues/33) plans the adapter-neutral contract and Express support; additional platforms remain outside that epic's current scope.

The ecosystem's [HTTP-platform independence policy](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0008-http-platform-independence.md) requires that HTTP-platform choices not alter contract guarantees.

## Decision

1. Retain **one** SSR package, common Angular renderer and public Nest façade: `NestAngularSsrModule.forRoot/forRootAsync`, `bootstrapNestAngularSsr` and the existing documented low-level entry points. Adapter selection is an integration detail.
2. Introduce an internal platform-neutral SSR contract for request-to-Web-Request conversion, Web-Response writing, API-prefix exclusion, asset serving, GET/HEAD fallback routing, not-found forwarding, lifecycle/observability and host validation. Isolate real framework-specific behavior in adapter modules; no routing logic inside the Angular renderer.
3. Implement the already-scoped Fastify-to-contract refactor and Express support under [#33](https://github.com/anarchitects/anarchitecture-community/issues/33) and its #38-#43. Design the abstraction for later Node HTTP support, **but do not expand #33's existing delivery scope implicitly**. Investigate `@nestjs/platform-node` via a separately reviewed follow-up once its stable API is available.
4. Preserve Fastify consumption, behavior and supported CJS/ESM consumers. Changing advanced types is additive-first; any breaking change requires a documented release decision.
5. Explicitly preserve API-prefix bypass (including miss/404), static assets with traversal protection, disallowed host response, `null` fallback, redirects, multiple `Set-Cookie` headers, request context, accurate request URL and method, query/headers, HEAD responses and observable events. Treat forwarded headers as untrusted unless the hosting proxy trust policy authorizes them.
6. Prefer streaming response bodies where safely supported. Measure and test against existing buffer-based behavior, including aborted connections, error propagation, backpressure and memory. Do not assert streaming parity without tests.
7. Adapter-specific dependencies/peers should not force Fastify for non-Fastify consumers; only change package manifests once conditional resolution, clean-install consumer testing and release compatibility are established. Nest 12 and Node HTTP support are **not** established by this ADR.

## Validation gates

- Unit contracts and real packed-package Nest fixtures for each *advertised* adapter, Angular 21/22, CJS/ESM, HTTP routing and security edge cases.
- No regressed Fastify behavior; successful HTTP response and SSR fallback, not merely compile.
- Verify Nest major compatibility per adapter separately, including package peers and build output imports.
- Document actual support matrix in the public package README only after tests pass.

## References

- [SSR epic #33](https://github.com/anarchitects/anarchitecture-community/issues/33)
- [Community SSR implementation](../../packages/nest/angular-ssr)
- [Native Node candidate](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0009-native-node-candidate-default.md)
