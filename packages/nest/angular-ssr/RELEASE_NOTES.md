# Unreleased: SSR observability

Completes the observability work for epic #35, through #505–#508. These notes
describe unreleased changes; the package version is assigned by the existing
Nx release workflow.

- Opt-in, vendor-neutral lifecycle observers for render start, success, null,
  and error, plus API bypass, static asset selection, and host rejection.
- Monotonic render durations in milliseconds, response status codes, original
  thrown values, and an optional stable `applicationId`.
- The same configuration through `forRoot`, `forRootAsync`, explicit bootstrap,
  and direct renderer composition. Routing events include Fastify request IDs;
  direct renderer events do not infer IDs from headers or application context.
- Synchronous observer and observer-error-handler failures are isolated from
  SSR responses and routing decisions. Returned promises are not awaited or
  automatically handled; applications own asynchronous export queues.
- Tested application-owned metrics and structured logging adapters in
  `examples/observability.ts`, with complete usage and privacy guidance in the
  README. Metrics cover attempts, all render durations, thrown failures, and
  null fallbacks. The logging adapter excludes URLs and raw errors by default.
- End-to-end coverage follows all six routing/render outcomes through both
  adapters, alongside bootstrap parity and concurrency tests.

No monitoring runtime or peer dependencies were added. Existing consumers
remain unchanged until they configure `observability`. Custom injected renderers
remain responsible for their own render instrumentation. HTTP error responses
are successful render results; the failure counter measures thrown failures.
Null fallback counts are not a count of all HTTP 404 responses.

Future cache lifecycle events (#34) and multi-app identifiers (#37) can use the
same observer model. This release adds neither caching nor multi-app routing.

Release validation uses the existing
`@anarchitecture-community/source:validate-nest-angular-ssr-release-gate` Nx
target, including packed CJS/ESM consumers, split builds, and the Angular/Nx
compatibility matrix. See the README for prerequisites and the command.

Validated on 2026-10-06 with Node 24.21.0:

- Package build, typecheck, lint, and all 99 tests passed (four existing lint
  warnings in the registration tests).
- Packed CommonJS and ESM consumers passed with direct package imports.
- The split Angular/Nest build-output fixture passed.
- All three packed compatibility cells passed: `angular21-nx22`,
  `angular21-nx23`, and `angular22-nx23`.
