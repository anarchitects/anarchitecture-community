# Standalone architecture and package boundaries

**S:** chapters C01, C02 and C08 distinguish template dependencies, service provisioning and architectural modules. **V:** standalone is the current default; NgModule interoperability still exists. **A:** A01/A02 require explicit public seams and preserve repository-specific boundaries.

## Three different dependency graphs

A component's `imports` make directives, components and pipes available to its template. They do not give arbitrary services application lifetime. Environment providers configure an application or route injector; component providers configure an element injector. TypeScript imports and package exports define yet another graph. Review each graph separately when a lazy feature unexpectedly grows or a service is duplicated.

Use standalone components for new Angular code. Existing NgModules may import standalone declarations, and standalone components may import a compatibility NgModule. Do not place a standalone declaration in `declarations`. Use `bootstrapApplication` for an application entry point when the migration stage allows it; libraries do not bootstrap applications. Compatibility is a migration seam, not a requirement to rewrite a working package immediately.

Import exactly the template capabilities a component uses. Export reusable components through the owning package's documented entry point. Avoid catch-all arrays of every component or provider: they obscure ownership and can retain dependencies unexpectedly. Tree shaking is verified from a production build, not inferred from the presence of a barrel.

## Nx and framework-neutral cores

Retain established library locations, package names, tags and enforceable dependency constraints. Nx tags should describe the actual domain and layer; enforce them with the repository's module-boundary rules. TypeScript path aliases improve ergonomics but are not architectural enforcement. Inspect resolved Nx project configuration with `nx show projects` and `nx show project <name> --json` before selecting targets; inferred tasks may not appear in a project file.

A typical Bricks Angular dependency direction is `ui <- feature -> state -> data-access`; shared contracts and utilities sit below these layers as allowed by the local ADR. UI emits user intent and receives values. Features compose views and coordinate use cases. State owns the feature's lifetime and async policy. Data access handles transport. A DTO or domain model shared with a backend must not import Angular, HTTP clients, UI controls or stores.

DDD and 3-Tier remain different implementation styles. Do not manufacture frontend ports and adapters just to mirror a Nest backend. Do not move business rules into `common` to avoid a boundary violation. In Community, governance core contracts stay technology-neutral; adapters translate observations and extensions enrich canonical models. In Plugins, generator output may be Angular while the Nx plugin itself remains tooling code.

## Barrels without cycles

A public barrel exports its own area's deliberate API. Inside that area, use direct internal imports rather than importing the area's barrel back into itself. Do not re-export a feature from a lower-level shared barrel. Keep internal implementation types private unless consumers need them. Prefer `export type` for type-only contracts.

Example structure, not a new package requirement:

```text
editorial/ui/src/index.ts              public components only
editorial/ui/src/lib/review-card.ts    imports its sibling directly
editorial/state/src/index.ts           public state factory/types
editorial/feature/src/lib/review.ts    imports ui + state public APIs
```

A cycle such as `index -> card -> index` may appear harmless until initialization order or bundling changes. A layer cycle such as `ui -> feature -> ui` is an architectural defect even when the bundler tolerates it. Inspect imports and the dependency graph; do not fix cycles with dynamic imports unless the boundary itself calls for asynchronous loading.

## Review and acceptance

A boundary change must explain ownership, allowed consumers, public exports and migration impact. Verify no deep imports into another package, no framework leakage into shared TypeScript, no new dependency cycle, and no eager import that defeats a claimed lazy boundary. Public packages need consumer-facing READMEs and correct exports; this internal guide does not substitute for those deliverables.
