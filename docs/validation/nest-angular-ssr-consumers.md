# Nest Angular SSR Consumer Validation

These fixture apps install the packed `@anarchitects/nest-angular-ssr` tarball and exercise it through `NestAngularSsrModule.forRoot(...)`.

Each installed consumer also passes static-path/guard, GET/HEAD, API bypass,
SSR fallback, redirect, cookie, host and proxy-trust conformance. Deployment
fixtures use the host-owned Fastify 5.12.7 override; the separate compatibility
matrix checks Nest 11.1.29 with its bundled Fastify. See
[security validation](nest-angular-ssr-security.md) for scope and release gates.

| Fixture | Classification | Mode | Summary |
| --- | --- | --- | --- |
| nest-cjs-consumer | direct | direct | Direct package consumption worked. |
| nest-esm-consumer | direct | direct | Direct package consumption worked. |
