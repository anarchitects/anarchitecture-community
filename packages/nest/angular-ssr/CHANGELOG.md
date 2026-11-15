## 0.4.0

### Breaking installation minimum

- This is a Nest 11/Fastify maintenance release. `@nestjs/platform-fastify` now
  requires `^11.2.10`, replacing the previous `^11.1.29` minimum. Upgrade Nest
  common/core/platform-fastify coherently to 11.2.10 or a separately verified
  patch. A top-level Fastify override does not repair the older adapter itself.
- This breaking minimum starts the `0.4.x` maintenance successor to `0.3.x`.
  It does not add Nest 12 support. Pin the reviewed version and complete lockfile;
  the maintenance publication channel is `nest11`.

### Compatibility and packaging

- Public `NestAngularSsrModule.forRoot` / `forRootAsync`,
  `bootstrapNestAngularSsr` and low-level integration signatures are unchanged.
  Fastify remains the supported HTTP adapter; Express and native Node support
  are not included.
- Use coherent patched dependencies. The verified maintenance combinations use
  Nest 11.2.10, Fastify 5.12.8 and static 10.1.11 with Angular 21.2.26 / SSR and
  build 21.2.30, or Angular 22.2.6 / SSR and build 22.2.7, on Node 24.22.3.
  Broader peer ranges are not a security guarantee for older patches.
- Package documentation covers installation, migration, SSR/hydration checks and
  application-owned rollback. The archive includes its package README, Apache-2.0
  LICENSE and NOTICE.

### Maintenance and migration

- Angular 21 receives security and critical-defect fixes only through
  **13 February 2027**, inclusive, under an approved transition extension. Upgrade
  to the verified Angular 22 combination before then; this can be done while
  retaining Nest 11. Patches do not restart the window.
- Nest 11 has its own maintenance window: 90 calendar days after this package's
  first verified generally available Nest 12 release. That release is pending;
  Angular 21's date neither starts nor extends the Nest 11 window. When Angular 21
  maintenance ends, any remaining Nest 11 maintenance covers Angular 22.
- New features target the separate Nest 12 line. Its migration requires Node
  `>=24.22.3 <25`, Nest `~12.5.0`, Fastify `~5.12.8`, Angular framework `~22.2.6`
  and SSR `~22.2.7`; select an actually published version for that line.
- Published older artifacts remain available after maintenance ends. Application
  owners control upgrade, deployment and rollback timing.
