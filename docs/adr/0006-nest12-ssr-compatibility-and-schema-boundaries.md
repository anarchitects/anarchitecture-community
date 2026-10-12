# ADR 0006: Nest 12 SSR Compatibility and First-Party Capability Boundaries

## Status
Accepted

## Context
The ecosystem has selected Nest 12 as the active feature track, Nest 11 for patches only, and Zod as the target contract schema. The existing `@anarchitects/nest-angular-ssr` supports Nest 11/Fastify with explicit Angular 21/22 fixtures. Its adapter-agnostic evolution belongs to [ADR 0005](0005-nest-angular-ssr-http-adapter-composition.md) and [epic #33](https://github.com/anarchitects/anarchitecture-community/issues/33).

## Decision
1. Align new SSR features and integration work with Nest 12 and its verified HTTP adapter APIs. Preserve Nest 11 as a patch-only maintenance line; keep existing advertised Nest 11 Angular SSR consumers functional until an explicit versioned migration.
2. Keep Angular SSR rendering and Web Request/Response semantics independent of Nest's authentication, authorization, Zod validation, database, outbox and mail modules. Do not add optional first-party Nest capabilities as mandatory SSR peers or duplicate their host responsibilities.
3. Support native Nest adapter choices only after real packed-consumer proof of SSR, static assets, CJS/ESM entry points, API bypass, proxy/host security, cookies, HEAD/redirect handling and streaming.
4. Avoid pulling CASL, Better Auth, Mailer, Zod or SimpleWebAuthn directly into generic SSR integration. A host owns its auth/authorization/schema composition. Angular-side CASL may be used by independent Auth Angular packages but must never become SSR-required.
5. Keep Angular 21/22 and Node/Nest support matrices accurate. A new Nest 12 claim must be backed by fixtures; no automatic peer widening or feature backport to Nest 11.

## References
- [Meta Nest-first policy](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0010-nest-first-runtime-and-dependency-policy.md)
- [SSR adapter composition](0005-nest-angular-ssr-http-adapter-composition.md)
