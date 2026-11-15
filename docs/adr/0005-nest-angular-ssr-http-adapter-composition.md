# ADR 0005: Compose Nest Angular SSR Through HTTP Adapter Boundaries

## Status

Accepted

## Context

`@anarchitects/nest-angular-ssr` v0.3.x supports Fastify, Nest 11 and Angular 21/22. Its renderer already consumes Web `Request` and returns Web `Response | null`, but integration and routing use Fastify request/reply types, `@fastify/static`, native Fastify hooks, route registration, buffering via `response.arrayBuffer()`, and `getHttpAdapter().getType() === 'fastify'`. Published peer dependencies require Fastify. At original acceptance, [epic #33](https://github.com/anarchitects/anarchitecture-community/issues/33) covered the adapter-neutral contract and Express support. Native Node was deliberately deferred pending a sufficiently mature, stable upstream API for production evaluation, not rejected architecturally.

The ecosystem's [HTTP-platform independence policy](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0008-http-platform-independence.md) requires that HTTP-platform choices not alter contract guarantees.

## Amendment — 2026-11-14

Native Node is now an **architecturally accepted implementation target** alongside Fastify and Express in #33. Nest documents `@nestjs/platform-node` / `NodeAdapter` from 12.3; published 12.3.0 and 12.5.0 metadata and the 12.5.0 adapter source provide a concrete API to evaluate. This removes the original scope deferral while retaining the same package, neutral contract and concrete-adapter architecture; this ADR remains **Accepted**, not superseded.

**Implementation acceptance is separate:** a verified Nest 12.3+ baseline is necessary, but neither 12.3.0 nor every later release is certified by this amendment. Select exact compatible Nest/adapter/Node/Angular versions and prove the gates below before advertising native Node SSR support. Nest's Express-style Node helpers do not establish Express equivalence. No default changes here: [Meta ADR-0009](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0009-native-node-candidate-default.md) still governs evaluation and possible promotion of the ecosystem default.

## Amendment — 2026-11-15: Native Node-first delivery priority

The preceding 2026-11-14 amendment approved native Node as a **third architectural target** but did not assign it precedence over Express. This follow-up amendment sets **native Node as the first new concrete SSR adapter to implement and validate**, reflecting Nest's released `NodeAdapter` API and its documented recommendation for new Nest 12.3+ applications. Keep the existing Fastify regression baseline; develop Express after native Node is established, or in parallel only if it does not delay Node or compromise the shared contract. No shipped default, currently supported SSR matrix or automatic Fastify/Express migration changes. This alignment depends on [Meta ADR-0009's native-first amendment PR #53](https://github.com/anarchitects/anarchitecture-meta/pull/53); support remains evidence-gated under the existing 2026-11-14 conditions.

## Lifecycle alignment — 2026-11-15 (proposed)

[Meta ADR-0022](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0022-core-framework-lifecycle-90-day-maintenance.md) governs future NestJS and Angular major transitions for this SSR package. New adapter capabilities continue to target the currently validated latest-stable feature line; neither the approved native Node-first sequence nor existing Fastify compatibility changes automatically. For each previously supported framework major, the package owner must document the first verified generally available successor-major SSR release and start a **90-calendar-day security/critical maintenance-only window** from that publication date. Nest 11 and Angular 21 claims and the 0.3.x Fastify maintenance baseline are not retroactively cancelled. Preserve any explicit longer consumer commitment as a dated owner-approved exception. No claimed support or EOM date is inferred from this ADR, and #578/#737 remain the compatibility/release decision track.

## Decision

1. Retain **one** SSR package, common Angular renderer and public Nest façade: `NestAngularSsrModule.forRoot/forRootAsync`, `bootstrapNestAngularSsr` and the existing documented low-level entry points. Adapter selection is an integration detail.
2. Introduce an internal platform-neutral SSR contract for request-to-Web-Request conversion, Web-Response writing, API-prefix exclusion, asset serving, GET/HEAD fallback routing, not-found forwarding, lifecycle/observability and host validation across Fastify, Express and native Node. Isolate request/response bridging, routing and static assets in concrete adapter modules; no routing logic inside the Angular renderer.
3. Implement all three concrete adapters under [#33](https://github.com/anarchitects/anarchitecture-community/issues/33): `@nestjs/platform-fastify`, `@nestjs/platform-express` and `@nestjs/platform-node`. **Priority order:** establish the shared adapter-neutral contract (#38) and minimum Fastify regression seam; implement and validate native Node's request/response bridge and SSR routing/assets as the **first new concrete adapter**; retain/complete Fastify migration (#39) as required for stable compatibility; implement Express (#40–#41) subsequently or independently in parallel without delaying native Node. #42 and #43 must validate each delivered adapter incrementally rather than gating native Node readiness on Express. Identify the actual adapter explicitly and reliably through its verified Nest adapter identity (`fastify`, `express`, `node`); never classify Node as Express through structural similarity. Unsupported adapters fail clearly.
4. Preserve Fastify consumption, behavior and supported CJS/ESM consumers. Changing advanced types is additive-first; any breaking change requires a documented release decision.
5. Explicitly preserve API-prefix bypass (including miss/404), static assets with traversal protection, disallowed host response, `null` fallback, redirects, multiple `Set-Cookie` headers, request context, accurate request URL and method, query/headers, HEAD responses and observable events. Treat forwarded headers as untrusted unless the hosting proxy trust policy authorizes them.
6. Prefer streaming response bodies where safely supported. Measure and test against existing buffer-based behavior, including aborted connections, error propagation, backpressure and memory. Do not assert streaming parity without tests.
7. Adapter-specific dependencies, peers, runtime imports and public declarations must not require unused HTTP adapters, frameworks or plugins. Native Node consumers must install without Express or Fastify; Express consumers must install without Fastify. Change manifests only after conditional resolution, clean-install packed-consumer proof and release compatibility are established. This amendment approves the architecture, **not** an implemented Nest 12 or native Node support claim.
8. Coordinate version/dependency and support-line decisions with [#578](https://github.com/anarchitects/anarchitecture-community/issues/578), [ADR-0006](0006-nest12-ssr-compatibility-and-schema-boundaries.md) and the prospective 90-day previous-major window in [Meta ADR-0022](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0022-core-framework-lifecycle-90-day-maintenance.md). #33 owns adapter neutrality/parity; #578 owns Nest-major compatibility and release readiness/publication. Neither Express nor native Node blocks an independently validated Fastify-only Nest 12 release. Keep Nest 11 security/critical maintenance and advertised consumer contracts during the audited transition or a dated grandfathered extension, not indefinitely. New features target the currently verified latest-stable major. Release authorization and downstream adoption remain separate.

## Consequences

The common renderer and public Nest-facing APIs remain stable while three concrete integrations require independent behavior evidence. Native Node is the **preferred reference integration for new Nest 12.3+ SSR adapter functionality**, not a mandatory platform for consumers or a claim of validated support. Native Node's routing specificity, case sensitivity, decoded paths, proxy options, conditional static responses and connection lifecycle require explicit treatment rather than Express assumptions. Reuse compatible behavior only when verified. Keep legitimate platform differences documented; do not weaken existing security guarantees to obtain nominal parity.

## Validation gates

- Unit contracts and real clean-install, packed-package Nest fixtures for each _advertised_ adapter/version combination, retaining supported Angular 21/22 and CJS/ESM consumers. Record exact versions, locks and artifact identity; do not imply every adapter supports every historical cell.
- Native Node fixtures must explicitly construct `NodeAdapter`, exercise the common module/bootstrap APIs and install without Express/Fastify or workspace dependency leakage. Validate runtime imports and public type declarations independently; registry metadata alone is insufficient.
- No regressed Fastify behavior throughout the native-first sequence; successful HTTP response and SSR fallback, not merely compile. Native Node readiness is separately measurable before Express lands; full epic completion still requires all three advertised adapters to pass their respective gates.
- Prove platform-specific API bypass and misses, static precedence and path normalization/traversal protection, GET/HEAD, `null` to normal Nest not-found, host/proxy trust, headers, cookies, redirects and request context. Cover streaming or documented buffering, backpressure, cancellation, renderer/write errors, response termination and lifecycle cleanup with real HTTP evidence.
- Verify Nest major compatibility per adapter separately, including package peers, build output imports and the actual minimum native Node patch. Nest documents a 12.3.1 floor for `@nestjs/serve-static`'s SPA fallback integration; that is neither an SSR support floor nor a requirement to use `ServeStaticModule` here. Verify this package's own fallback and assets independently.
- Document actual support matrix in the public package README only after tests pass.

## References

- [SSR epic #33](https://github.com/anarchitects/anarchitecture-community/issues/33)
- [Community SSR implementation](../../packages/nest/angular-ssr)
- [Native Node candidate](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0009-native-node-candidate-default.md)
- [Nest HTTP adapter API and documented differences](https://docs.nestjs.com/http/performance) (reviewed 2026-11-14)
- [Published Node adapter 12.3.0 metadata](https://registry.npmjs.org/@nestjs/platform-node/12.3.0) and [12.5.0 metadata](https://registry.npmjs.org/@nestjs/platform-node/12.5.0)
- [NodeAdapter 12.5.0 source](https://github.com/nestjs/nest/blob/v12.5.0/packages/platform-node/adapters/node-adapter.ts)
- [Accepted Nest 12 compatibility audit #736](../validation/nest12-ssr-audit-736.md) and [release-line decision #737](https://github.com/anarchitects/anarchitecture-community/issues/737)
