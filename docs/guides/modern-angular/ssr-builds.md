# SSR, hydration and builders

**S:** C14 introduces the esbuild application builder and server rendering. **V:** modern Angular has evolved in builder names, rendering configuration and hydration defaults. **A:** A09 requires deliberate rendering modes, isolation and reproducible package builds.

## Rendering mode and request isolation

Choose client rendering, request-time server rendering or prerendering per route based on data freshness, access control and operational cost. Prerendering public static content is different from rendering a signed-in request. Never bake private user data into a shared prerender artifact or cache. Do not keep request-specific credentials, mutable stores or tenant state in module-level variables. Create request-owned state and use supported server request APIs rather than browser globals.

Server and client must initially produce compatible DOM. Use valid HTML and stable IDs; avoid render-time random/time-dependent markup without a transferred consistent value. Direct DOM manipulation before hydration can invalidate matching. Initialize editors, charts and browser integrations after client rendering with supported hooks, and import libraries lazily if their module top level touches browser APIs. Guard late asynchronous initialization against owner destruction and dispose instances/listeners.

`provideClientHydration()` enables client hydration. In the observed Angular 22.2 documentation, incremental hydration and event replay are enabled with it by default; older Angular instructions that always add `withIncrementalHydration()` are version-specific. The opt-out is `withNoIncrementalHydration()`. Verify the supported minor before changing host configuration. Libraries should not silently install application hydration providers.

Test hydration with realistic defer triggers and replayed interactions. Deferred server content can exist before its client code activates, so forms and actions must be safe prior to hydration. `ngSkipHydration` is a narrowly justified host escape hatch for an incompatible component, with an issue/removal plan; it should not mask broad DOM or lifecycle defects.

## Transfer cache and privacy

Transfer only data safe to embed in the response and reuse on the client. Inspect the actual HTTP transfer-cache options and authentication behavior for the installed version. Do not broaden caching to authenticated requests or sensitive headers without a reviewed cache key and privacy model. Server rendering is not a secrets boundary if data is serialized into HTML. Test two independent users/tenants and inspect generated HTML for accidental cross-request data or token exposure.

When multiple Angular applications share a document, coordinate application IDs and element ownership. Avoid independently bootstrapping two applications onto the same host. Hydration warnings should be test failures in the relevant SSR integration suite, not ignored console noise.

## Builder selection and library packaging

Use the repository's supported modern application builder for new applications. Angular's application builder handles browser output and optional server/prerender output; it is different from the library packaging toolchain. Do not replace ng-packagr or an Nx library executor with an application builder. A browser-esbuild migration is an intermediate historical option, not a requirement for every workspace.

Run the official supported build-system migration where appropriate and inspect generated changes. Server output uses ESM conventions: remove assumptions around CommonJS `require`, `__dirname`, export shape and old Universal package entry points. Update server entry points and deployment scripts according to emitted output, not a memorized folder layout. Inspect assets, style import resolution, source maps, CSP requirements, budgets and environment substitutions.

An esbuild-based builder does not promise a single JS file for Angular Elements; route/defer chunks and assets can be separate. Test distribution through the real host URLs. Do not reuse benchmark numbers from the 2024 book as performance guarantees for a current repository. Compare production build size, startup/hydration behavior and build time on a consistent local/CI setup when claiming an improvement.

Validate the published artifact, not only the monorepo app: public entry points, declaration dependencies, peer ranges, CSS assets and consumer build resolution can fail independently. Keep framework runtime support claims separate from Nx/tooling support, especially in repositories that also publish Nest packages.
