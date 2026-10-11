# Signals, RxJS, stores and component contracts

**S:** C10–C12 describe values, derivation and event streams. **V:** current signal/component APIs are recorded in the ledger. **A:** A05/A06 choose signal-first local state, deliberate async concurrency and explicit store ownership.

## State and derivation

A writable signal owns a current value. A computed signal derives a value synchronously from other signals. Replace arrays and objects immutably; mutating an object inside a signal does not provide a reliable notification contract. Read signals in templates so Angular can track consumers. Use `ChangeDetectionStrategy.OnPush` explicitly for new reusable components even in a zoneless application; it communicates intended change-detection behavior.

Use `linkedSignal` when a user-editable value should be reset or reconciled with a changing source. It is writable derived state, not a general event-processing mechanism. Define what happens when the selected item disappears. Do not create an effect merely to copy one signal into another or to maintain a total that belongs in `computed`.

<!-- example-file: editorial-state.ts -->

```ts
import { computed, Injectable, signal } from '@angular/core';

export interface ReviewItem {
  readonly id: string;
  readonly approved: boolean;
}

@Injectable()
export class ReviewState {
  readonly #items = signal<readonly ReviewItem[]>([]);
  readonly items = this.#items.asReadonly();
  readonly outstanding = computed(
    () => this.items().filter((item) => !item.approved).length,
  );

  replace(items: readonly ReviewItem[]): void {
    this.#items.set(items.map((item) => ({ ...item })));
  }

  approve(id: string): void {
    this.#items.update((items) =>
      items.map((item) =>
        item.id === id ? { ...item, approved: true } : item,
      ),
    );
  }
}
```

Provide this state explicitly at the chosen owner. The example deliberately has no implicit root provider. Its immutable updates allow consumers to see new values, and `outstanding` has one source of truth.

## Effects and asynchronous work

Effects synchronize reactive state with an external sink such as an imperative chart, storage or analytics. Register cleanup for subscriptions, listeners and scheduled work. Keep browser-only sinks out of server execution. `untracked` excludes incidental reads from dependency tracking; it must not hide a dependency needed for correctness. `allowSignalWrites` is deprecated in current Angular: writes are permitted, but cycles and competing state owners are still design defects.

Signals represent current state. Several writes can stabilize before an effect or `toObservable` observes them, so these mechanisms are not a lossless command bus. Use an output or an Observable for discrete user events. An effect's asynchronous continuation is not a place to assume reactive dependency tracking or an injection context remains active.

Use RxJS when time, cancellation, event multiplicity or composition matters. Choose concurrency explicitly: `switchMap` replaces obsolete reads, `concatMap` preserves ordered writes, `exhaustMap` ignores duplicate submissions while one runs, and `mergeMap` allows independent concurrent operations. These are semantic choices, not universal rules. Unsubscribing from a write request does not undo a server-side mutation. Keep error handling inside the appropriate inner stream so one failure does not accidentally terminate future commands.

`toSignal` should be created once per source/owner, not repeatedly in a template or computed. Supply `initialValue`, handle `undefined`, or use `requireSync` only for a source guaranteed to emit synchronously. Use `takeUntilDestroyed` for subscriptions owned by an Angular destruction context; pass an explicit `DestroyRef` outside an injection context. `resource` and `httpResource` are stable in Angular 22 and suit reactive reads. Their cancellation/reload model makes them unsuitable as the default for mutations. Represent loading, error, empty and success states rather than asserting a value always exists.

## Choosing a store

Local component state needs no shared store. A feature service with signals is the starting point where the local ADR permits it. Use NgRx Signal Store or another already accepted store when entity management, cross-feature coordination, mutation workflows, derived state and debugging justify it. Do not mix two stores for the same state. Apply the DDD repository's documented scorecard where applicable; this guide does not replace its thresholds.

A root store is an explicit application-lifetime choice. Route/component stores must have tested reset and teardown behavior, particularly around route reuse and SSR. Register NgRx feature state/effects at the composition boundary and test real reducers/effects separately from mocked stores. Do not infer that `provideState` or a signal store automatically enforces domain boundaries.

## Inputs, models, outputs and queries

Use `input()`/`input.required()` for readonly inbound values, `model()` for a deliberate two-way value contract, and `output()` for emitted intent. A model is not needed merely because a component has internal state. Input transforms should be pure and normalize representation; business validation belongs in a domain boundary. Models do not support input transforms. Avoid aliases unless an external contract or DOM collision requires one.

Required inputs must not be read before Angular supplies them. Derive values lazily in `computed`, or read them during an appropriate lifecycle operation. Outputs are not signals or Observables, do not bubble like DOM events, and should not use names that collide with native events. `outputFromObservable` and `outputToObservable` bridge event contracts when needed; describe subscription lifetime and event/error behavior rather than treating an output as a state store.

Use signal queries (`viewChild`, `viewChildren`, `contentChild`, `contentChildren`) where compatible with the supported version. Queries cannot cross another component's template. A required child is valid only when the template contract guarantees its presence; an `@if` may make it absent. Current `contentChild` includes descendants by default, while `contentChildren` defaults to direct children; use explicit options when the contract depends on this distinction. React to query changes for dynamic content rather than snapshotting once.

For dynamic components, use Angular's creation APIs and `ComponentRef.setInput` so input and change-detection semantics remain intact. Retain and dispose of component refs and event subscriptions according to the owner's lifetime. Never assign a signal input field as though it were an ordinary writable property.
