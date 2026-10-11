# Testing, incremental migration and release discipline

**S:** C06, C08 and C09 advocate testable provider composition and incremental standalone migration. **V:** current Angular testing/build APIs differ from historical examples. **A:** A10/A11 require behavior evidence, supported consumers and separate release stages.

## Test the seam that can fail

| Concern              | Meaningful evidence                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standalone component | Import the component in TestBed; exercise public inputs, outputs and visible states.                                                                          |
| Shallow replacement  | `overrideComponent` removes the real import and adds a compatible test component; don't hide missing bindings with permissive schemas.                        |
| HTTP                 | Install `provideHttpClient(...)` before `provideHttpClientTesting()`, assert request shape/headers and flush success/failure; verify no outstanding requests. |
| Injection hierarchy  | Assert identity per owner and child/parent behavior; test root-service resolution separately from child-client resolution.                                    |
| Routing              | Test URLs, guards/resolver outcomes, input precedence, absent values and actual reuse/reset behavior with a router harness where available.                   |
| State                | Check immutable transitions, derived values, cancellation policy, failure recovery and scope isolation. Mock-store tests do not prove real reducers/effects.  |
| Forms                | Exercise native/custom controls, invalid/touched/pending, disabled/readonly, submit concurrency, server failure, reset and keyboard/accessibility behavior.   |
| Deferred rendering   | Exercise all blocks and a failed lazy download; inspect production chunks.                                                                                    |
| SSR/hydration        | Compare initial DOM, inspect serialized data, capture hydration errors and exercise pre-hydration click/Enter.                                                |
| Package consumers    | Build a packed artifact in a consumer using the claimed peer range, including public declarations, styles and exports.                                        |

Current Angular CLI projects use Vitest, but existing repositories may have Jest or another supported runner. Keep their conventions until a runner migration is separately accepted. `fakeAsync` relies on Zone.js; do not copy a historical fakeAsync example into a zoneless runner and assume it works. Prefer awaited fixture stability or the runner's supported clock controls, with explicit scheduling assertions. Avoid tests that merely repeat the implementation.

## Standalone migration sequence

1. Inventory installed Angular/CLI/Nx/TypeScript/RxJS versions, accepted ADRs, consumers and release branches. Establish a passing baseline and record pre-existing failures. Pick the documented upgrade path and supported Node version.
2. Convert eligible declarations to standalone components/directives/pipes, preserving template imports. Run targeted compilation and tests. Do not remove modules that still own provider configuration or unsupported declarations.
3. Remove redundant NgModules after their imports/providers are accounted for. Review `forRoot`/`forFeature`, entry-point exports, lazy boundaries and compatibility consumers manually; an automated migration cannot infer every ownership contract.
4. Migrate application bootstrap and provider registration. Keep one root registration per capability; don't leave both `importProvidersFrom` and a new `provideX` installing duplicate services. Preserve route-scoped state/effects intentionally.
5. Migrate component APIs, control flow, forms and build infrastructure in separately reviewable steps. A standalone conversion is not an automatic mandate to change the state library, CSS system, test runner and SSR architecture together.
6. Validate targeted Nx tasks, production builds, package exports, packed consumers, browser behavior and SSR where applicable. Document changed public behavior, support ranges and rollback. Promote releases only after the repository's required review and CI gates.

Use `ng update` and applicable Nx migrations according to the documented version path; do not simply edit a dependency major. The automatic standalone migration's three conceptual phases remain useful, while its command availability and prerequisites must match the installed tooling. Review generated edits instead of treating successful script execution as architectural acceptance.

## Angular 21 release protection

Keep an already planned Angular 21-compatible release independently buildable. Preserve its peer constraints and CVA/public contracts until it is released or explicitly rescheduled by maintainers. Angular 22 Signal Forms implementation belongs to a subsequent reviewed support change where a legacy release is still staged. Do not claim dual 21/22 support without packed-consumer evidence on both versions. Do not deprecate or unpublish packages as part of this documentation change.

In Bricks 3-Tier, preserve the accepted foundation, forms and auth sequencing, removal only after consumers are migrated, and the separation between Nest tooling support and runtime support. In DDD, preserve the accepted Angular layer/state decision and its narrowly accepted Forms amendment. In vendor template repositories, apply these gates to generated Angular output only; no Angular runtime should be added to vendor automation without a real consumer requirement.

## Review record

A change should state affected decisions, installed versions, dependency/public-API changes, chosen scope and concurrency semantics, tests run and tests not run. A documentation example build is evidence for that example's APIs; it does not establish that every repository or historical supported version passes. The [validation record](validation.md) keeps this distinction explicit.
