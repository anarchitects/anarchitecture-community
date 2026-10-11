# Dependency injection, provider APIs, routing and HTTP

**S:** C03, C05 and C07 explain environment injectors and composable registration. **V:** the [API ledger](api-ledger.md) corrects historical initializer and interceptor APIs. **A:** A03/A04 require explicit ownership and observable composition.

## Scope is a design decision

Use `providedIn: 'root'` for genuinely application-wide, stateless infrastructure where local ADRs allow it. The book's root-service preference is not a mandate to make domain stores global. In Bricks, stateful domain stores use explicit provider helpers at the intended feature boundary. Component providers are appropriate when each component instance needs a separate store. Route providers establish an environment-injector visibility boundary; they do **not** promise that navigating away destroys every route-scoped service. Router configuration caching and custom reuse strategies affect lifetime. Test the actual owner's destruction and explicitly reset sensitive or short-lived state as needed.

Resolve dependencies where a service is instantiated. A root service injecting `HttpClient` receives the root client even if a child component asks for that service. A child injector cannot retroactively change an existing ancestor instance. Avoid compensating with global mutable registries.

## Six provider patterns

| Pattern                        | Intended use                                    | Implementation and failure mode                                                                                                                                                                                                              |
| ------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider Factory               | Single explicit library entry point             | Return `EnvironmentProviders` from `makeEnvironmentProviders`; validate configuration. Avoid casts and hidden bootstrap side effects.                                                                                                        |
| Feature (`withX`)              | Optional independently selectable behavior      | Represent features with a typed discriminant and provider contribution. Reject incompatible or duplicate modes rather than relying accidentally on last-provider-wins.                                                                       |
| Configuration Provider Factory | Register configuration with an existing service | Use `provideEnvironmentInitializer` for synchronous setup in the environment injector. Register cleanup through `DestroyRef` when registration is reversible. Use an application initializer only when bootstrap genuinely must await work.  |
| NgModule Bridge                | Support an existing module consumer             | A compatibility `forRoot` delegates to the same registration implementation. Never install the bridge and the new root factory together for the same service scope. Plan its support window.                                                 |
| Service Chain                  | Child behavior delegates to its parent          | Resolve the parent token with `skipSelf` and `optional`; define a root fallback and call direction. Avoid resolving yourself recursively or reapplying a handler.                                                                            |
| Functional Service             | Supply behavior as a function or class          | Use an `InjectionToken` with an explicit function `useValue` or class `useClass` provider. Prefer a discriminated configuration union; `typeof x === 'function'` cannot distinguish JavaScript classes from callable implementations safely. |

The following complete unit demonstrates a provider factory and functional service. Its root-only configuration is intentionally small; a production `withX` family should be introduced only when optional capabilities warrant it.

<!-- example-file: editorial-policy.ts -->

```ts
import {
  EnvironmentProviders,
  InjectionToken,
  makeEnvironmentProviders,
} from '@angular/core';

export type ReviewPolicy = (title: string) => boolean;
export const REVIEW_POLICY = new InjectionToken<ReviewPolicy>(
  'editorial.review-policy',
);

export function provideReviewPolicy(
  policy: ReviewPolicy,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: REVIEW_POLICY, useValue: policy },
  ]);
}
```

For a chain, a factory may call `inject(TOKEN, {skipSelf: true, optional: true})`, then return a new handler that delegates to the captured parent. A missing parent must be intentional, not a non-null assertion. For registration initializers, capture `DestroyRef` during initialization; do not call `inject` later in an arbitrary callback. Environment providers belong in application/route configuration, not a component's `providers` array.

## Route composition and inputs

Install `provideRouter(routes)` once at application composition. Add only the necessary `withX` features. Use `loadChildren` for a lazily loaded route collection and `loadComponent` for a component boundary. Splitting a route does not require a new injector; adding providers does not guarantee a new downloaded chunk. Avoid a static import of the same component from an eager entry point.

Keep authorization checks on the server. A client guard supports navigation UX but cannot protect data. Resolvers should have bounded failure behavior and should not turn every navigation into an uninterruptible workflow. Validate route values at the boundary: route identifiers are strings, not trusted domain objects.

With `withComponentInputBinding()`, the current default precedence is query parameters, then path/matrix parameters, then static route data, then resolver data (later sources win). Missing values become `undefined`; the router should not preserve stale input values silently. Use defaults/transforms or explicit validation. Avoid depending on newer filtering options unless the installed minor supports them. Required inputs are not a substitute for a resolver or validated route contract.

## HTTP configuration and hierarchy

Prefer functional interceptors in an explicit order. Let authentication, retries, caching and telemetry have distinct responsibilities. Clone immutable requests when changing headers; never mutate a caller's body in place. Retry only when operation semantics allow it. Normalize errors without suppressing them, redact credentials and personal data, and limit auth headers to the intended origin.

`provideHttpClient(withInterceptors([...]))` establishes a client configuration. A child client is independent by default. `withRequestsMadeViaParent()` deliberately runs child interceptors and delegates to the parent's chain. Do not combine that delegation with a backend-selection feature in the same configuration. Test the sequence and ensure a child customization is actually injected where the request is made.

Use `withInterceptorsFromDi()` only to bridge existing class interceptors; the book's historical `withLegacyInterceptors` spelling is not the current API. A multi-provider uses `multi: true`, never `multiple`. On the observed Angular 22.2 docs, Fetch is the default backend and `withFetch()` is deprecated. Explicit XHR is a browser-specific choice for requirements such as upload progress, not a portable SSR default. Verify the supported minor before removing an older version's Fetch configuration.

Do not add both root and route `provideHttpClient` casually. A library should usually depend on the host's client; if it owns a specialized client, document its interceptors, backend, scope and parent delegation. Application-wide telemetry should not unexpectedly disappear because a feature silently replaces the client.

## Original composed provider example

This separate unit illustrates the remaining composition mechanics. The registry is installed once at the application boundary. A feature initializer registers a channel and removes only its own registration when its environment is destroyed. The bridge delegates to the same root factory. A child decorator resolves the parent's decorator and appends once. In a real library, document whether child environments may override the root sink.

<!-- example-file: editorial-providers.ts -->

```ts
import {
  DestroyRef,
  EnvironmentProviders,
  inject,
  Injectable,
  InjectionToken,
  makeEnvironmentProviders,
  ModuleWithProviders,
  NgModule,
  provideEnvironmentInitializer,
} from '@angular/core';

export type ReviewSink = (message: string) => void;
export const REVIEW_SINK = new InjectionToken<ReviewSink>('editorial.sink');
export const TITLE_DECORATOR = new InjectionToken<(title: string) => string>(
  'editorial.decorator',
);

type EditorialFeature = { readonly kind: 'sink'; readonly sink: ReviewSink };
export function withReviewSink(sink: ReviewSink): EditorialFeature {
  return { kind: 'sink', sink };
}

@Injectable()
export class ReviewRegistry {
  readonly #channels = new Set<symbol>();
  get size(): number {
    return this.#channels.size;
  }
  register(): () => void {
    const id = Symbol('channel');
    this.#channels.add(id);
    return () => {
      this.#channels.delete(id);
    };
  }
}

export function provideEditorial(
  ...features: EditorialFeature[]
): EnvironmentProviders {
  if (features.length > 1)
    throw new Error('Configure one review sink per environment.');
  const sink: ReviewSink = features[0]?.sink ?? (() => undefined);
  return makeEnvironmentProviders([
    ReviewRegistry,
    { provide: REVIEW_SINK, useValue: sink },
    { provide: TITLE_DECORATOR, useValue: (title: string) => title },
  ]);
}

export function provideReviewChannel(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const unregister = inject(ReviewRegistry).register();
    inject(DestroyRef).onDestroy(unregister);
  });
}

export function provideTitleSuffix(suffix: string): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: TITLE_DECORATOR,
      useFactory: () => {
        const parent = inject(TITLE_DECORATOR, {
          skipSelf: true,
          optional: true,
        });
        return (title: string) => `${parent ? parent(title) : title}${suffix}`;
      },
    },
  ]);
}

@NgModule({})
export class EditorialCompatibilityModule {
  static forRoot(
    sink: ReviewSink,
  ): ModuleWithProviders<EditorialCompatibilityModule> {
    return {
      ngModule: EditorialCompatibilityModule,
      providers: [provideEditorial(withReviewSink(sink))],
    };
  }
}
```

The registry's destruction test uses an explicitly created environment, not router navigation, so it proves the cleanup callback without claiming that a router destroys its provider environment on every exit. This example accepts a function value; an alternative class-based API should use an explicit discriminated variant and `useClass`, not runtime function guessing.
