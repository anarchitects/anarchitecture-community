# Template control flow, deferred views and Angular Elements

**S:** C04 and C13 describe custom elements and lazy rendering. **V:** current control-flow, defer and Elements contracts are linked in the ledger. **A:** A08 requires accessible, predictable rendering with explicit browser ownership.

## Control flow and identity

Prefer `@if`, `@for`, `@empty` and `@switch` in new templates. Use a stable domain identifier in `@for (...; track item.id)` for mutable/reordered collections. `$index` is suitable only when position is genuinely stable; tracking object identity can recreate rows after immutable replacement. Check identity uniqueness and preserve focus/selection on updates. Treat empty, error and loading states as different UI states.

The sample form shows an `@if` branch. For a list of review items, use a tracked loop and an explicit empty message; do not use a getter with side effects to create items during rendering. Exhaustive TypeScript modelling can support a switch, but runtime data must still be validated at its boundary.

## Deferred loading is a delivery boundary

Use `@defer` for expensive secondary UI, not required first-screen content or a substitute for route splitting. Direct dependencies are eligible for deferral when standalone and not also referenced eagerly in the same file, including via queries; transitive dependencies may still come through an NgModule. Confirm the resulting production chunks. Imports in placeholders, loading and error blocks are eager, so keep them light.

Select a trigger for the actual experience: idle for noncritical background work, viewport for below-the-fold content, interaction for optional tools. Prefetch controls downloading, not necessarily rendering; avoid fetching sensitive personalized data merely because code prefetches. Default viewport/interaction trigger references may require a suitable single-root placeholder; use explicit references when needed. A `when` trigger does not unload the block when its condition later becomes false. Use conditional rendering when disposal is required.

Provide appropriately sized placeholders to avoid layout shift, a meaningful loading state and a recoverable failure path. Avoid nested defer waterfalls. Test placeholder/loading/complete/error with the test runner's Angular defer utilities and simulate failed chunk delivery. For SSR and hydration, coordinate defer/hydrate triggers with the policies in [SSR and builds](ssr-builds.md).

## Custom-element integration

Angular Elements is appropriate for embedding a bounded UI in a non-Angular host with a stable browser contract. It is not automatically the right microfrontend boundary. Build a host contract for inputs/properties, attribute coercion, custom events, styles, asset URLs, language, focus and teardown. Do not expose framework-internal state through the element API.

Create an application environment with `createApplication`, then adapt a standalone component with `createCustomElement(component, {injector: app.injector})`. Register under a valid dashed custom-element name different from its Angular selector to avoid double instantiation. Browser registries cannot redefine a name: guard registration and coordinate concurrent loaders using one shared registration promise. Handle bootstrap failures so a rejected cached promise does not permanently disable recovery.

Inputs map to element properties and corresponding attribute names; attributes carry strings, so complex values should use properties with a documented shape. Outputs dispatch `CustomEvent` instances and payloads are read from `event.detail`. Angular output events and browser custom events have different contracts; specify bubbling/composition behavior if a host needs it instead of assuming it. Test reconnect and removal behavior in the actual host.

Shadow DOM is an explicit encapsulation decision. It changes CSS and slot composition; it is not the same as Angular content projection. Provide theming hooks and accessible semantics. When an Angular host consumes a custom element, use `CUSTOM_ELEMENTS_SCHEMA` at the narrow integration scope; do not use a broad schema to hide misspelled Angular bindings.

Register only in the browser. Avoid reading `window`, `document` or `customElements` during server module evaluation. The owner of a shared `ApplicationRef` destroys it only after all hosted elements are finished; removing one element is not permission to destroy the environment used by the others. Lazy import browser-only editor/custom-element code after rendering and dispose listeners and resources on teardown. The 2024 book's NgZone assumptions and single-bundle recipe are historical; verify zoneless operation and actual emitted assets for the supported Angular builder.
