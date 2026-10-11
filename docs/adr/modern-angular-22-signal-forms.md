# ADR: Modern Angular 22 and Signal Forms

Status: Accepted. Date: 2026-10-11.

Acceptance: explicit maintainer approval on 2026-10-11.

## Context and evidence

The earlier short baseline did not make the source's full engineering scope reviewable. This expanded decision is supported by an original [engineering guide](../guides/modern-angular/README.md), [chapter traceability matrix](../guides/modern-angular/traceability.md), [official API ledger](../guides/modern-angular/api-ledger.md) and [repository application](../guides/modern-angular/repository-application.md).

Manfred Steyer's _Modern Angular_, 2nd Extended Edition (2024), provides architectural principles for standalone composition, DI, reactive state, migration and rendering. The complete 146-page supplied publication was reviewed. It predates Angular 22: Angular 22+, stable Signal Forms and repository defaults are separate accepted Anarchitects decisions. The source PDF and its text/illustrations are not distributed. Examples are original.

Current Angular evidence was checked on 2026-10-11 against official documentation and an isolated Angular 22.2.2 example build. Living documentation can describe a later minor than a repository supports. The ledger records such distinctions; example compilation is not a support claim for every repository.

## Scope and authority

Apply these decisions to Angular implementations, generated Angular output, examples and public Angular contracts. Do not add Angular dependencies to neutral TypeScript, domain contracts, Nest services, vendor automation or Node/Nx tooling. Read every local ADR and the relevant guides first. Accepted specific decisions remain binding; proposals do not silently supersede them. Maintainers explicitly accepted this ADR on 2026-10-11; implementation and release gates remain separate.

## Decisions

### A01 — Platform and compatibility

For new Angular work governed by this accepted ADR, target Angular 22+ with its supported Node/TypeScript/RxJS toolchain. A target policy is not an automatic dependency upgrade. Preserve staged Angular 21-compatible releases, existing package peer ranges and older runnable examples until an explicit migration is accepted. Verify the actual runtime version rather than inferring it from Nx. Avoid experimental APIs without a separate bounded decision.

### A02 — Standalone architecture and boundaries

Use standalone declarations and explicit template imports. Keep NgModule bridges only at supported compatibility seams. Respect local domain/layer tags, public entry points and dependency rules. Avoid cross-package deep imports, self-barrel cycles and broad exports that obscure ownership. Path aliases do not enforce boundaries, and barrels do not prove tree shaking. Use the repository's existing Nx constraints where available; do not introduce Nx merely for this policy. See [architecture](../guides/modern-angular/architecture.md).

### A03 — Injection and provider patterns

Expose composable `provideX`/`withX` APIs with typed environment providers and deliberate configuration validation. Use the six documented patterns where justified: provider factory, feature, configuration provider factory, NgModule bridge, service chain and functional service. Prefer root provisioning only for appropriate application-wide infrastructure. Stateful Bricks stores require explicit ownership/provider helpers. Route-provider visibility does not guarantee destruction on route exit. Test lifetime, parent lookup and cleanup. See [provider patterns](../guides/modern-angular/providers-routing-http.md).

### A04 — Router and HTTP composition

Compose router providers once at the host, separate lazy route/component delivery from injector scoping, and validate route-derived values. Use current input binding precedence and clear missing values. Prefer functional interceptors with explicit order; use native DI bridging for legacy interceptors. Child HTTP clients are independent unless deliberately delegated to the parent. Test the root-service/child-client distinction, backend selection and retry/error/auth boundaries. Guards improve navigation UX; servers enforce authorization.

### A05 — State, derivation and asynchronous work

Use signals for current local state, immutable updates and computed synchronous derivation. Use linked state only when writable derivation has explicit reset semantics. Effects synchronize external sinks and need cleanup; they are not a state propagation network or lossless event bus. Use RxJS when events, cancellation or concurrency matter, selecting operators according to read/write semantics. Resources serve reads, not general mutations. Choose service-with-signals versus a store using accepted local criteria, and keep one owner for each state. See [reactivity](../guides/modern-angular/reactivity.md).

### A06 — Component contracts

Prefer `input`, `model`, `output` and signal queries on the accepted runtime baseline. Inputs are inbound values, models express intentional two-way ownership and outputs express events. Required inputs/queries must actually be available when read. Use pure transforms, stable contracts, deliberate aliases and correct query descendant semantics. Use `setInput` for dynamically created components and dispose their owned resources. Outputs are neither signals nor Observables.

### A07 — Forms

Adopt stable Angular 22 Signal Forms as the default for new forms once the local platform gate permits it. Use `[formField]`, form-tree state and the relevant native custom-control contract. Do not implement both CVA and Signal Forms interfaces on the same control or maintain a parallel bespoke state facade. Retain supported legacy controls until a deliberate compatibility migration. Test validation, pending/submitting, touch/dirty, reset, native/custom integration, accessibility and server failure. Guard pre-hydration native submission and sensitive data. See [forms](../guides/modern-angular/forms.md).

### A08 — Templates, defer and web components

Prefer built-in control flow with stable list identity. Defer expensive secondary UI only where its dependencies, triggers, placeholders and failure behavior justify it; verify actual lazy output. Angular Elements is an optional host integration boundary with explicit properties/events, registration, styles and application lifetime. Do not assume historical Zone.js or single-bundle recipes are universal. See [rendering and elements](../guides/modern-angular/rendering-elements.md).

### A09 — SSR, hydration and builds

Choose rendering modes deliberately, isolate request state, preserve matching initial DOM and keep browser-only libraries out of server evaluation. Transfer only safe cacheable data. Use supported hydration configuration for the installed minor and test replay/pre-hydration behavior. Keep skip-hydration exceptions narrow. Use the supported application builder for applications and the existing library-packaging toolchain for libraries; inspect ESM server output and deployment assumptions. See [SSR/builds](../guides/modern-angular/ssr-builds.md).

### A10 — Evidence and quality

Test behavior at the seam: injector identity, interceptor hierarchy, route inputs/reuse, reactive transitions, custom-control integration, defer states and SSR/hydration where used. Use the repository's supported runner; Zone-based utilities are not assumed in zoneless tests. Verify public exports/peers/styles using packed consumers when making package support claims. The documentation example suite and repository implementation suites are separate evidence. See [testing](../guides/modern-angular/testing-migration.md) and [validation](../guides/modern-angular/validation.md).

### A11 — Migration and release gates

Migrate declarations, remove redundant modules and change bootstrap/providers in reviewable stages with checks between them. Preserve `forRoot`/`forFeature` ownership and avoid installing both modern and compatibility providers. Treat forms, state, CSS, SSR, builders and test-runner migrations as explicit changes rather than incidental modernization. Preserve accepted release ordering and removal/deprecation rules. This documentation PR performs no dependency upgrade, release, deprecation or unpublish.

### A12 — Agent obligations and traceability

Before generating, editing or refactoring any code, agents must enumerate and read **ALL ADRs** in every repository ADR location, then the engineering guides relevant to affected packages/topics and local agent instructions. This includes generated code, templates, examples, tests and migrations. Record applicable accepted decisions and conflicts; reread when scope or evidence changes. Read proposals and historical records for context without treating them as accepted. Maintain chapter/API/decision traceability and never commit the licensed PDF, extracted text, scans or copied code passages.

## Alternatives and consequences

Keeping only a short checklist was rejected because it hid version and ownership distinctions. Copying the book's implementation was rejected because it would mix historical APIs with current contracts and redistribute licensed material. Blanket upgrades, blanket root stores and mandatory NgRx/SSR/Elements were rejected because local consumers and accepted architecture differ.

The resulting policy is more explicit and testable, but requires maintaining official API evidence and local application notes. Guides share a common technical core while repository-specific decisions remain local. Adoption can be staged; maintainers may approve a narrowly documented exception with scope, owner, rationale, consumer impact, validation and revisit criteria. Agents may not silently invent exceptions to accepted decisions.

## Local application and acceptance record

Apply this guide to Angular UI/editor adapters, including the Editor.js and visual-composition workstreams. Governance canonical contracts remain technology-neutral; adapters extract, extensions enrich and hosts compose. Angular does not belong in governance core.

Keep rich-editor/browser code out of server module evaluation and public display bundles. Validate hydration and disposal in actual integrations. Public package READMEs must describe actual consumer exports and follow the separately accepted [public package documentation policy](0004-public-package-documentation.md) (maintainer approval 2026-10-11).

Review the [local ADR inventory and release constraints](../guides/modern-angular/repository-application.md) before implementation. This acceptance supersedes only explicitly named clauses; unrelated historical or proposed ADRs retain their existing status. The guide's source principles, current API facts and Anarchitects decisions remain separately traceable.
