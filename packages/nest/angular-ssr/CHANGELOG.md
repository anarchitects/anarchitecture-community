## 0.5.0

### Nest 12 support

Adds the Nest 12 Fastify feature line while preserving
`NestAngularSsrModule.forRoot` / `forRootAsync`, `bootstrapNestAngularSsr` and
the documented low-level API signatures. Supports CJS and ESM Nest hosts and
split Angular ESM server/CJS Nest composition with hydration. CJS hosts need
Node's enabled `require(esm)` support. Express and native Node adapters are not
included.

### Breaking installation requirements

- Node `>=24.22.3 <25`.
- Nest common/core/platform-fastify `~12.5.0` and Fastify `~5.12.8`.
- Angular framework `~22.2.6` and Angular SSR `~22.2.7`; keep framework/compiler
  packages coherent. The verified build combination uses Angular build 22.2.7
  and TypeScript 6.0.3.
- Nest 11, Angular 21 and Angular 22.1 cannot install this feature-line artifact.
  Do not bypass peer or engine checks. Nx is build/validation tooling, not a
  runtime dependency.

Upgrade the coherent dependency set, build Angular before Nest, and validate SSR,
hydration, API routes and misses, assets, host/proxy rules, cookies, redirects,
HEAD and not-found behavior in the application. Keep the prior reviewed
application artifact and complete lockfile for owner-authorized rollback.

The bridge buffers responses and does not propagate client disconnects into the
renderer request signal. This release does not add streaming or cancellation.
The package includes its README, Apache-2.0 LICENSE and NOTICE.

### Maintenance and distribution

Nest 11 consumers use **0.4.0**, available on `nest11`, with adapter minimum
`^11.2.10`. Angular 21 security/critical maintenance ends **13 February 2027**,
inclusive; consumers can move to Angular 22 while retaining Nest 11. Nest 11's
90-day window begins with the first verified generally available Nest 12 release;
no trigger date is assigned by this version proposal. Published artifacts remain
available after maintenance ends. Application owners control adoption.

Initial 0.5.0 publication targets `next`; promotion to `latest` requires a
separate review. Pin the reviewed version and lockfile.
