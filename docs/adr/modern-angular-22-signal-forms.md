# ADR: Modern Angular 22 and Signal Forms
Status: Proposed (pending review). Date: 2026-10-11.

## Context
This independently written policy draws on the architectural themes of Manfred Steyer's *Modern Angular*, 2nd Extended Edition (2024): standalone architecture, Nx boundaries, providers, signals, and SSR. The book predates Angular 22: adopting Angular 22+ and stable Signal Forms is a separate **Anarchitects decision**, not a claim made by the author. The licensed book is NOT bundled or reproduced.

## Decision
1. **Platform:** New Angular-specific packages and features target Angular 22+ and a supported TypeScript toolchain. Existing Angular 21 compatibility lines must follow their documented breaking-release and migration gates. Framework-agnostic TS contracts, Nest services, and Node tooling must never gain Angular dependencies from this policy.
2. **Standalone first:** Standalone components, directives and pipes, functional router/HTTP/DI APIs; use NgModule bridges only where explicitly necessary for compatibility.
3. **Signals first:** Prefer `signal` for mutable UI state, `computed` for derived values and `input`, `model`, `output`, signal queries for modern component APIs. Update data immutably. Avoid effects used just to propagate state; use effects sparingly for external imperative integrations and clean them up.
4. **Forms:** Stable Angular 22 Signal Forms and `[formField]` are default. Custom form controls use the relevant `FormValueControl`/specialized interface. Do not maintain duplicate bespoke Reactive Forms / `ControlValueAccessor` implementations; test documented Angular-native legacy interoperability when needed.
5. **Templates:** Prefer built-in `@if`, `@for` with stable `track`, `@switch`, and appropriate `@defer`; avoid unnecessary broad module imports.
6. **Routing / providers / HTTP:** Prefer `provideRouter`, lazy route/component imports, functional guards/interceptors, `provideHttpClient`, composable `provideX`/`withX` features, and deliberate route injection scopes. Prefer tree-shakable provider setup.
7. **Architecture:** Respect Nx project boundaries and public entry points; prohibit deep imports across libraries. Separate feature orchestration, presentation, state and data-access. RxJS is appropriate for asynchronous streams and cancellation; do not use effects as a general event bus.
8. **SSR and performance:** Guard browser-only code, lazy-load rich editors, validate hydration and teardown, and keep authoring bundles out of public display routes.
9. **Quality:** Test reactive state and form validation, SSR/hydration, route loading, lifecycle disposal and package peer compatibility. Document migration and breaking changes.

## Agent instruction
Before generating or modifying ANY Angular source, read this ADR and other applicable repository ADRs and agent instructions. Review actual Angular APIs and published compatibility requirements. If instructions conflict, identify the conflict rather than silently overriding a more specific accepted ADR.

## Provenance
Reference: Manfred Steyer, *Modern Angular* (2024), Angular Architects (licensed publication; not included). Angular 22/Signal Forms guidance is Anarchitects policy and should be verified against official Angular docs. No licensed PDF, illustrations, or book passages are reproduced.

## Local application
Apply to Angular Editor.js #67-#74 and Visual Composition #517; Editor.js core and composition contracts stay independent of Angular.
