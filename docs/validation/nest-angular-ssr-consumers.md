# Nest Angular SSR Consumer Validation

These fixture apps install the packed `@anarchitects/nest-angular-ssr` tarball and exercise it through `NestAngularSsrModule.forRoot(...)`.

Each installed consumer also passes static-path/guard, GET/HEAD, API bypass,
SSR fallback, redirect, cookie, host and proxy-trust conformance. Deployment
fixtures use Nest 12.5.0 and the host-owned Fastify 5.12.8 override. Each consumer
installs the archive outside the repository with no workspace source references. See
[security validation](nest-angular-ssr-security.md) for scope and release gates.

| Fixture           | Classification | Mode   | Summary                            |
| ----------------- | -------------- | ------ | ---------------------------------- |
| nest-cjs-consumer | direct         | direct | Direct package consumption worked. |
| nest-esm-consumer | direct         | direct | Direct package consumption worked. |
