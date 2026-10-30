# @anarchitects/editorjs-angular

Standalone Angular editor component for Editor.js, built on
`@anarchitects/editorjs-core` document normalization and shared contracts.

Import `EditorJs` to render `<aa-editorjs>` with initial configuration/data and
readiness, saved-change and error outputs. Each component owns its holder and editor
instance. Replace the `data` input to load another document; configuration remains
initialization-only. The component exposes an instance-scoped `api` for imperative
controls. The optional `/forms` entry point adds native Angular Signal Forms
value binding, composite interaction, availability and focus; see its current limits below.

For custom block, inline, tune and third-party tools, use the shipped
[complete Angular composition guide](custom-tools.md). It reuses the core guide's
actual implementations in direct, provider and optional Signal Forms consumers.
The basic quick start below needs only Editor.js's built-in paragraph.

## Installation and prerequisites

In an existing Angular application, install the packages when they are available
in your registry:

```sh
npm install @anarchitects/editorjs-angular @anarchitects/editorjs-core @editorjs/editorjs@2.31.7
```

Before initial publication, replace the two Anarchitects names with their supplied
`0.0.1.tgz` archives in the same install command. Install the core archive explicitly
so the Angular package's `^0.0.1` dependency resolves locally. A manifest version
does not by itself mean that a package has been published.

Use the equivalent Yarn or pnpm command. Supply matching Angular core/common
versions from Angular 22 and its supported Node/TypeScript toolchain.

| Requirement                     | Declared range/reference                   |
| ------------------------------- | ------------------------------------------ |
| Angular core/common peers       | `^22.0.0`                                  |
| Editor.js peer                  | `^2.31.7`                                  |
| Editor.js development reference | Exactly `2.31.7`                           |
| Node.js tooling                 | `^22.22.3` or `^24.15.0` or `^26.0.0`      |
| Package format                  | ESM, Angular Package Format, ES2022 output |

Angular 21 and future Angular/Editor.js majors are outside these ranges. Use matching
Angular core/common versions and tooling supported by that Angular release. Node is
a build/tooling requirement; editing runs in the browser. Core has its own independent
runtime baseline and does not require Angular.

The packed component and its public examples are checked with these combinations:

| Angular | Editor.js | Node.js tooling | TypeScript | Browser  |
| ------- | --------- | --------------- | ---------- | -------- |
| 22.0.0  | 2.31.7    | 22.22.3         | 6.0.3      | Chromium |
| 22.1.4  | 2.31.7    | 24.15.0         | 6.0.3      | Chromium |
| 22.2.2  | 2.31.7    | 26.0.0          | 6.0.3      | Chromium |

These are tested combinations, not every version permutation or a full browser
matrix. Chromium checks cover standalone editing and controls, plus zoneless Signal
Forms editing, value writes, dirty/touch, focus, disabled/readonly modes, reset,
validation, submission failure and teardown. Native reactive Forms has a browser
scenario; other native legacy bindings have the specific support limits documented
below. Forms declarations and examples compile on every
baseline. SSR, prerendering and hydration support is bounded to the profiles below,
with matching router/platform-server/SSR/CLI/build peers in each tested row.
Local browser evidence is Chromium on macOS arm64; other browsers, operating
systems and Windows tooling are not certified by that evidence.
No CommonJS build is supplied. Nx is not a consumer dependency. Angular peers are
evaluated normally; Editor.js is loaded only during browser initialization.

## Quick start

Import the standalone component in an existing Angular 22 application:

<!-- example-file: article-editor.ts -->

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { EditorJs } from '@anarchitects/editorjs-angular';
import type {
  EditorJsConfig,
  EditorJsChangeEvent,
  EditorJsErrorEvent,
} from '@anarchitects/editorjs-angular';
import type { OutputData } from '@anarchitects/editorjs-core';

@Component({
  selector: 'app-article-editor',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 id="article-label">Article body</h2>
    <p role="status">{{ status() }}</p>
    @if (errorMessage()) {
      <p role="alert">{{ errorMessage() }}</p>
    }
    <aa-editorjs
      role="group"
      aria-labelledby="article-label"
      [config]="config"
      [data]="document()"
      (change)="onChange($event)"
      (ready)="status.set('Ready')"
      (error)="onError($event)"
    />
  `,
})
export class ArticleEditor {
  readonly status = signal('Loading editor');
  readonly errorMessage = signal('');
  readonly config: EditorJsConfig = {
    placeholder: 'Write something…',
    minHeight: 120,
  };
  readonly document = signal<OutputData>({
    blocks: [{ type: 'paragraph', data: { text: 'Welcome' } }],
  });
  readonly latestSaved = signal<OutputData | undefined>(undefined);
  onChange(event: EditorJsChangeEvent): void {
    this.latestSaved.set(event.data);
    this.status.set('Edited');
  }
  loadDocument(data: OutputData): void {
    this.document.set(data);
  }
  onError(event: EditorJsErrorEvent): void {
    this.errorMessage.set(`Editor error: ${event.operation} (${event.code})`);
    console.error(event.operation, event.cause);
  }
}
```

Render `<app-article-editor>` through your application's normal route or parent
component. After loading, the status becomes “Ready” and the paragraph can be
edited. No forms or loader providers are required. Editor.js supplies its built-in
paragraph tool; additional tools remain your choice. Edits update `latestSaved` with
a detached saved document. Your application decides whether and how to persist it.
Call `loadDocument` with a new document to replace editor content. Keep saved output
separate from the input unless you intentionally want to render it back into the editor.

## SSR, prerendering and hydration

Both `EditorJs` and the Signal Forms `EditorJsControl` support request-time SSR,
fixed public prerendered pages and browser hydration in the combinations above.
The server renders an **empty editor holder**, not saved blocks, tool markup or an
editable document. Render a public article through your own safe display component;
this editor is not a server-side document renderer.

| Host profile                         | Supported behavior                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Immediate request-rendered editor    | Hydration reuses the holder, then creates one browser editor. Default incremental hydration and explicit full hydration with replay are covered.            |
| Fixed public prerendered editor      | The default hydration profile activates a public sample document in the browser. Never prerender private request data.                                      |
| Ordinary interaction defer           | Server renders a lightweight placeholder; the editor component is created after activation.                                                                 |
| One incremental interaction boundary | Server renders the main Angular structure and empty holder; a host button activates hydration. Client navigation uses the ordinary interaction placeholder. |
| Client-only application              | Existing standalone and Forms editing remain available without hydration providers.                                                                         |

This contract covers a single, non-nested interaction boundary and normal router
component destruction. It does not certify nested hydration, every idle/viewport/
timer trigger, `hydrate never` for editing, custom route reuse, multiple Angular
applications in one document, streaming/edge runtimes, Nest integration or arbitrary
third-party tools. Legacy Forms bindings retain their earlier CSR limits; the SSR
Forms contract here is for Signal Forms.

### Host configuration and routes

Use an Angular SSR application with matching Angular runtime, router,
platform-server and SSR/build tooling. For a 22.1.4 application, the additional
runtime packages are:

```sh
npm install @angular/router@22.1.4 @angular/platform-server@22.1.4 @angular/ssr@22.1.4
```

Keep the application's Angular CLI/build/compiler packages at the same version.
Configure routing and hydration once in the host, shared by browser and server.
Neither editor entry point installs application providers. On the three tested
baselines, `provideClientHydration()` enables incremental hydration and replay.
To select full hydration with replay, pass `true` to both configuration functions
below. Do not mix different server and browser profiles.

Save the quick-start component as `article-editor.ts` and the Signal Forms example
below as `article-form.ts`. Add these files beside them. The sample documents are
public constants; replace them with request-owned application data for real editing.
Omit the Forms routes and incremental Forms example if you do not install Forms.

`public-page.ts`:

<!-- ssr-example-file: public-page.ts -->

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-public-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<h1>Articles</h1><p>Choose an article to edit.</p>',
})
export class PublicPage {}
```

`article.config.ts`:

<!-- ssr-example-file: article.config.ts -->

```ts
import type { ApplicationConfig } from '@angular/core';
import { provideRouter, type Routes } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withNoHttpTransferCache,
  withNoIncrementalHydration,
} from '@angular/platform-browser';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./public-page').then((m) => m.PublicPage),
  },
  {
    path: 'edit',
    loadComponent: () =>
      import('./article-editor').then((m) => m.ArticleEditor),
  },
  {
    path: 'form',
    loadComponent: () => import('./article-form').then((m) => m.ArticleForm),
  },
  {
    path: 'delayed',
    loadComponent: () =>
      import('./delayed-article').then((m) => m.DelayedArticle),
  },
  {
    path: 'incremental',
    loadComponent: () =>
      import('./incremental-article').then((m) => m.IncrementalArticle),
  },
  {
    path: 'sample/edit',
    loadComponent: () =>
      import('./article-editor').then((m) => m.ArticleEditor),
  },
  {
    path: 'sample/form',
    loadComponent: () => import('./article-form').then((m) => m.ArticleForm),
  },
];

export function articleConfig(fullHydration = false): ApplicationConfig {
  return {
    providers: [
      provideRouter(routes),
      provideClientHydration(
        withNoHttpTransferCache(),
        ...(fullHydration
          ? [withNoIncrementalHydration(), withEventReplay()]
          : []),
      ),
    ],
  };
}
```

Use `articleConfig()` as the browser bootstrap configuration, with a root component
that imports `RouterOutlet` and renders `<router-outlet />`. This example disables
HTTP transfer caching; your host owns any separate caching/privacy policy.

`article.config.server.ts`:

<!-- ssr-example-file: article.config.server.ts -->

```ts
import { mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, RenderMode, withRoutes } from '@angular/ssr';
import { articleConfig } from './article.config';

export function articleServerConfig(fullHydration = false) {
  return mergeApplicationConfig(articleConfig(fullHydration), {
    providers: [
      provideServerRendering(
        withRoutes([
          { path: 'sample/edit', renderMode: RenderMode.Prerender },
          { path: 'sample/form', renderMode: RenderMode.Prerender },
          { path: '**', renderMode: RenderMode.Server },
        ]),
      ),
    ],
  });
}
```

Use `articleServerConfig()` in your SSR bootstrap, passing the server's
`BootstrapContext` to `bootstrapApplication`. Retain your Angular application's
server entry and asset serving. Rendering modes and deployment are host decisions.
Configure the application builder's `security.allowedHosts` for the actual host
names you serve (for local use, `localhost` and `127.0.0.1`); retain host validation
when deploying behind a proxy.
Keep public display routes free of eager editor/tool imports, authoring barrels,
router preloading and editor prefetch if they must not download editor code.
Lazy routes alone cannot undo another eager import or host preload policy.

### Delayed activation

`delayed-article.ts` creates the standalone quick-start editor on interaction:

<!-- ssr-example-file: delayed-article.ts -->

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ArticleEditor } from './article-editor';

@Component({
  selector: 'app-delayed-article',
  imports: [ArticleEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button #activate type="button">Activate article</button>
    @defer (on interaction(activate)) {
      <app-article-editor />
    } @placeholder {
      <p>Activate to load the editor.</p>
    } @loading {
      <p role="status">Loading editor view…</p>
    } @error {
      <p role="alert">Editor view unavailable. Reload the page to retry.</p>
    }
  `,
})
export class DelayedArticle {}
```

`incremental-article.ts` renders the Forms example's Angular structure on the
server and hydrates it on interaction under the default profile:

<!-- ssr-example-file: incremental-article.ts -->

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ArticleForm } from './article-form';

@Component({
  selector: 'app-incremental-article',
  imports: [ArticleForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @defer (on interaction; hydrate on interaction) {
      <section aria-label="Article editing">
        <button type="button">Activate article</button>
        <app-article-form />
      </section>
    } @placeholder {
      <button type="button">Activate article</button>
    } @loading {
      <p role="status">Loading editor view…</p>
    } @error {
      <p role="alert">Editor view unavailable. Reload the page to retry.</p>
    }
  `,
})
export class IncrementalArticle {}
```

The activation button must remain outside disabled/inert regions. Keep deferred
dependencies in separate files and avoid eager references or component queries
that defeat their lazy boundary. Placeholder/loading/error content is eager and
should stay lightweight. Reserve layout space in the host, outside the owned
holder. Use matching initial markup and stable label IDs; do not insert saved HTML
into the holder or use broad `ngSkipHydration` to hide mismatches.

A failed Angular view download selects `@error`; reloading after fixing delivery is
the supported recovery here. An Editor.js loader/create/readiness failure happens
after the view exists and uses the component's `error` output instead. Display it
and recreate the owner to retry; `@error` does not handle that operation.

### Initial data, requests and pre-hydration safety

Give server and client the same initial document, form availability and conditional
markup. Fetch and authorize data in your host; transfer only safe, serializable
initial values through Angular's supported `TransferState` or an appropriately
scoped data mechanism. Consume request data once on the client and give each owner
its own copy. Never concatenate documents into inline scripts, and never put
request documents, credentials, field trees, holders or editor instances in
module-level mutable variables. Transferred values are visible in response HTML.
Core validates JSON shape; tool schemas and safe public rendering remain yours.

The examples above use only `type="button"` controls and do not submit a native
form. When adding a real form, gate native inputs and submit buttons with a
fieldset disabled in server HTML until the host is active and the editor is ready.
Keep a safe POST method/action as a fallback; never allow sensitive values to fall
back to a GET query string. The control's inert editing region is separate from
the fieldset: disabling a fieldset does not disable arbitrary contenteditable DOM.
Do not overwrite schema-owned disabled state merely to implement the host gate.

Before hydration, Angular submit handlers and directives are not attached. Replay,
`aria-disabled` and a future handler are not native-submission safeguards. Check
click and Enter with JavaScript delayed or unavailable. Replay can invoke a
server-rendered host activation control; it cannot recover typing into editor DOM
that did not yet exist. Once ready, explicitly capture and validate the current
snapshot before persistence as described in the submission section below.

Each live component owns its editor; each request owns its initial state. Route
exit or conditional removal disposes that component and fences late outputs.
Already-running work cannot be forcibly cancelled. Reset invalidates obsolete
snapshots synchronously but reconciles the view asynchronously; await a later
usable state before saving again. A custom reuse strategy that retains components
must define its own lifetime policy. Recreating an owner gives it fresh controls;
retained controls from the old owner stay disposed.

## Component inputs, outputs and lifetime

| Surface  | Current behavior                                                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config` | Optional `EditorJsConfig`, captured when browser initialization begins. Later observed identity changes report `config-changed` and leave the instance/configuration intact. Recreate the component to reconfigure it.                                        |
| `data`   | Optional core `OutputData`. Uses the latest value before creation. After creation, each observed new reference requests a copied, validated, serialized replacement; replacements wait for readiness. `undefined` or `{ blocks: [] }` requests empty content. |
| `ready`  | Readiness-only `EditorJsReadyEvent` (`void`), emitted once after Editor.js resolves `isReady`, while the owner is live. It does not mean queued document replacements have completed.                                                                         |
| `change` | `EditorJsChangeEvent` with detached saved `data` and an increasing owner-local `sequence`. Represents editor-originated notifications, not proof of a physical user gesture. Coalescing and duplicate suppression can leave sequence gaps.                    |
| `error`  | Core `EditorJsErrorEvent` with `operation`, `code` and original `cause`. This is an Angular component output, not a native DOM error event.                                                                                                                   |

Invalid initial data reports `operation: 'data'`, `code: 'invalid-data'` and the
core diagnostic as `cause`, without constructing an editor. Loader, constructor
and readiness failures report `operation-failed` with their respective operation.
There is no automatic retry. Recreate the component after fixing configuration,
data or loading failures. Initialization errors never produce a `ready` event.

The component initializes only after browser rendering. On the server it renders
an empty holder and does not invoke even a custom loader. The supported host
profiles and required application configuration are described above.

Removing the component destroys its editor. Removing it during code loading
prevents construction; removing it during readiness suppresses late outputs and
attempts disposal when readiness settles. Editor.js exposes its public cleanup API
after readiness, so a never-settling upstream initialization cannot be forcibly
cancelled by this wrapper. Cleanup errors while live use `error`; after destruction
they go to Angular's `ErrorHandler` because the component's outputs no longer exist.
No editor reference is stored in an application-wide service.

Treat configuration and documents as immutable inputs. In-place mutation is not
observed. Angular may coalesce several signal writes before observing their latest
value; inputs are state, not a lossless command stream.

## Document updates and saved changes

Accepted replacements and automatic saves run serially through core coordination.
A notification during a save makes that result obsolete and schedules a newer
save. An accepted replacement invalidates pending change snapshots immediately.
Nothing publishes after destruction; unstarted operations are discarded. Work
already running inside Editor.js cannot be cancelled by a promise.

Replacement is authoritative: notifications while a replacement is queued or
running are ignored. Avoid editing while a replacement is in progress; it can
overwrite edits to the previous document. Programmatic replacement does not emit
`change`. After rendering, a silent save establishes the actual editor content as
a baseline, including any IDs or tool normalization. Later notifications with the
same content are suppressed, ignoring only save timestamps and JSON object key
order. Array order, IDs, tool data and other metadata remain significant.

Invalid replacement input reports `data` / `invalid-data` with core diagnostics and
leaves current content and accepted work intact. Only `undefined` means missing:
`null`, JSON strings and malformed/non-JSON documents are invalid. Unknown tool
names and JSON fields are preserved by core; the application must install tools
that can render them. Core does not sanitize HTML or validate tool schemas here.

Rejected saves/renders report `operation-failed` with the original cause; invalid
saved documents report `save` / `invalid-data`. Later work still runs, without
automatic retries. A failed render may have partially changed upstream content.
After a render failure, publication stays suspended until a successful explicit
replacement. If only its baseline save fails, the next successful automatic snapshot
is used silently to re-establish the baseline; it may include edits made during recovery.
Those edits are not emitted separately. Reapply a valid document or recreate the
component when recovery must preserve a known document. Ordinary automatic-save
failures do not require a new baseline; the next notification can produce a change.

Feeding saved output back into `data` requests a replacement and can reset selection;
it is not necessary for normal editing. No two-way form model, persistence, dirty
or touched state is maintained. Use the imperative API when you need an awaited
operation or an explicit save rather than automatic saved-change events.

## Signal Forms

Import `EditorJsControl` from `@anarchitects/editorjs-angular/forms` and install
`@angular/forms` at exactly the same version as your Angular core/common/platform-browser
packages. For example, for an Angular 22.1.4 application:

```sh
npm install @anarchitects/editorjs-angular @anarchitects/editorjs-core @editorjs/editorjs@2.31.7 @angular/forms@22.1.4
```

Forms is an optional `^22.0.0` peer. Root-only `EditorJs` consumers do not need it:
keep imports on `@anarchitects/editorjs-angular` when Forms is not installed.
Importing `/forms` requires the matching Forms peer; the package does not install
or provide a substitute for it.
This entry point supports value synchronization, composite touch, disabled/readonly
state, native focus/reset hooks and explicit snapshots. Native legacy integration
is supported within the boundaries described below. Schema availability rules control editing, but do not flush asynchronous saves.

<!-- example-file: article-form.ts -->

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  FormField,
  form,
  disabled,
  readonly as readonlyField,
  required,
  validate,
} from '@angular/forms/signals';
import {
  EditorJsControl,
  type EditorJsControlConfig,
} from '@anarchitects/editorjs-angular/forms';
import type {
  EditorJsErrorEvent,
  OutputData,
} from '@anarchitects/editorjs-core';

@Component({
  selector: 'app-article-form',
  imports: [EditorJsControl, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 id="form-body-label">Article body (required)</h2>
    <p id="form-body-help">
      Add at least one block. Tool-specific validation is your responsibility.
    </p>
    <aa-editorjs-control
      aria-labelledby="form-body-label"
      [attr.aria-describedby]="
        fields.body().touched() && fields.body().invalid()
          ? 'form-body-help form-body-errors'
          : 'form-body-help'
      "
      [formField]="fields.body"
      [config]="config"
      (error)="onError($event)"
    />
    @if (fields.body().touched() && fields.body().invalid()) {
      <p id="form-body-errors" role="alert">
        @for (error of fields.body().errors(); track $index) {
          {{ error.message }}
        }
      </p>
    }
    <button type="button" (click)="locked.set(!locked())">
      Toggle disabled
    </button>
    <button type="button" (click)="reviewing.set(!reviewing())">
      Toggle readonly
    </button>
    <button
      type="button"
      [disabled]="fields.body().disabled()"
      (click)="fields.body().focusBoundControl()"
    >
      Focus article
    </button>
    @if (errorMessage()) {
      <p role="alert">{{ errorMessage() }}</p>
    }
  `,
})
export class ArticleForm {
  readonly model = signal<{ body: OutputData }>({
    body: {
      blocks: [{ type: 'paragraph', data: { text: 'Edit this article.' } }],
    },
  });
  readonly locked = signal(false);
  readonly reviewing = signal(false);
  readonly fields = form(this.model, (path) => {
    disabled(path.body, () => this.locked());
    readonlyField(path.body, () => this.reviewing());
    required(path.body);
    validate(path.body, ({ value }) =>
      value().blocks.length === 0
        ? { kind: 'article', message: 'Add at least one block.' }
        : undefined,
    );
  });
  readonly config: EditorJsControlConfig = { placeholder: 'Write something…' };
  readonly errorMessage = signal('');

  onError(event: EditorJsErrorEvent): void {
    this.errorMessage.set(`Editor error: ${event.operation} (${event.code})`);
  }
}
```

Successful saved edits update `model().body` through Angular's native value binding
and let Angular mark the field dirty. The control forwards payload-free `ready`,
saved `change` and typed operational `error` events from the owned editor.
No manual `(change)` assignment to the form model is needed. Use unique label IDs
when displaying multiple controls; accessible block editing still depends on tools.

Replace the document immutably through your model to write programmatically.
Programmatic writes render silently and preserve the field's interaction flags.
An editor-origin value echoed by Forms is not rendered back into the editor.
Several model writes before Angular stabilizes may coalesce. Native field-tree
writes also take precedence over saves that finish before input delivery. `[(value)]` without
`[formField]` is also supported; these model-only programmatic writes take effect
when Angular delivers the input. Call the reset hook for immediate invalidation
when coordinating such writes with pending editor work. Do not bind both to the
same control.

The `value` model defaults to `{ blocks: [] }` and accepts non-null core `OutputData`.
Invalid inbound data emits a core `invalid-data` diagnostic and retains the requested
model. It keeps any previous view and suppresses editor-to-model updates until a
valid document is supplied. An invalid initial value prevents editor creation;
a corrected value can then initialize it. Upstream initialization failures still
require recreation. Saved snapshots are detached from upstream mutable data;
consumers must treat model and event values as immutable. Angular Forms may attach
symbol-keyed tracking metadata to the model. The adapter uses core normalization's
explicit `symbolKeys: 'omit'` option for inbound values; all other JSON validation
remains strict. Saved `change` events are detached from the model and remain plain
JSON documents. To normalize a Forms model directly for storage, opt into the same
core option or use a successful saved event snapshot.

`EditorJsControlConfig` has the same initialization-only options as `EditorJsConfig`,
with `readOnly` forbidden because Forms owns availability.
There is no separate `data` input or imperative `api` on the control. The underlying
standalone component retains its existing controls.

The model holds the last successful published snapshot, subject to native Forms
synchronization/debounce. It may lag a current edit; submitting or changing form
validation state does not await Editor.js. Use the control's `save()` when submission
requires a current snapshot, then validate that snapshot before persistence.
For SSR, follow the host hydration and pre-hydration safety contract above; legacy
bindings have the limitations below.

### Existing reactive and template-driven forms

Angular supplies the bindings; the package supplies a native value control. There
is no package `ControlValueAccessor`, `NG_VALUE_ACCESSOR` provider, or shadow
`FormControl`. Import legacy modules only in the consuming component. Prefer
Signal Forms for new forms and Angular's
[migration APIs](https://angular.dev/guide/forms/signals/migration) for gradual adoption.

Native bindings support matched Angular/Forms **22.0.0, 22.1.4 and 22.2.2**
within the following boundaries, which are identical on these three baselines:

| Binding                                       | Supported boundary                                                                                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[formControl]`, `formControlName`            | Non-null values, native dirty/touched/disabled/validation state; explicit control reset hook as below.                                                                                           |
| `compatForm` + `[formField]`                  | Retains a consumer-owned `FormControl`; use event-emitting writes and the explicit control reset hook.                                                                                           |
| `SignalFormControl.fieldTree` + `[formField]` | Signal Forms value, schema state and native reset, while participating in a legacy `FormGroup`.                                                                                                  |
| `[(ngModel)]`                                 | Characterized, but not supported as a clean initialization path: Angular first delivers `null`, producing an `invalid-data` event before the valid model arrives. Use one of the other bindings. |

Signal Forms and direct reactive binding have been checked with real Editor.js in
Chromium. The compatibility table does not promise every legacy option or browser
combination. Match the Angular Forms peer to your application's other Angular packages.
The characterized `ngModel` path can also leave its view/control value stale when an
external model assignment coincides with an editor reset; it is excluded from the
supported reset/write contract. Use a supported reactive or migration binding
for these workflows.

Direct legacy bindings and retained controls inside `compatForm` publish a
successfully saved edit immediately even with `updateOn: 'blur'` or `'submit'`.
They mark dirty on publication and touched on the control's `touch` event. Do not
use those options to defer this editor's model changes or assume submit flushes
Editor.js. Use `save()` and validate the captured snapshot as described below.

Use `FormControl<OutputData>` with `nonNullable: true`. Calling `reset()` then
restores its initial document; an explicit `reset({ blocks: [] })` clears it.
A nullable control's `null` reset is rejected as `invalid-data`; it is not silently
converted to an empty document or turned into a validation error. Keep nullable
storage/API models at the consumer boundary and map them to a non-null editing
model before binding.

For direct legacy bindings, call `editor.reset()` **before** a form reset or an
external authoritative value write that may overtake editor work. The hook
invalidates pending work synchronously; Angular subsequently projects the new
value. It does not reset the form's flags itself. Legacy `FormControl.reset()` does
not invoke this hook, including an unchanged-value reset. Let Angular render
before requesting the next snapshot. Silent legacy writes and state-only changes
may also need consumer change-detection scheduling; use normal event-emitting
operations in zoneless hosts.

```ts
import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EditorJsControl } from '@anarchitects/editorjs-angular/forms';
import type { OutputData } from '@anarchitects/editorjs-core';

@Component({
  selector: 'app-existing-article-form',
  imports: [EditorJsControl, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="article">
      <aa-editorjs-control formControlName="body" aria-label="Article body" />
      <button type="button" (click)="reset()">Reset article</button>
    </form>
  `,
})
export class ExistingArticleForm {
  readonly body = new FormControl<OutputData>(
    { blocks: [] },
    { nonNullable: true },
  );
  readonly article = new FormGroup({ body: this.body });
  readonly editor = viewChild(EditorJsControl);

  reset(): void {
    this.editor()?.reset();
    this.article.reset({ body: { blocks: [] } });
  }
  load(body: OutputData): void {
    this.editor()?.reset();
    this.body.setValue(body);
  }
}
```

For a standalone reactive field, use `[formControl]="body"` with the same imports
and reset/write policy. Validators remain on the legacy control. Their errors
reach `EditorJsControl.errors()` with `kind` and `context`; display messages from
your own error mapping. Operational `error` events remain separate from validation.

To keep an existing control while migrating the template, put it in `compatForm`
and bind the unwrapped field. Do not bind both `[formField]` and a legacy directive
to the same editor. `extractValue` unwraps retained controls for reading; the
original model still contains `FormControl` objects and is not a storage payload.
`emitEvent: false` writes are not observed by this compatibility field until the
control emits again (for example via `updateValueAndValidity()`). Legacy reset
still needs the editor hook; `compatForm` does not add a subscription that invokes it.

```ts
import {
  ChangeDetectionStrategy,
  Component,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { FormField } from '@angular/forms/signals';
import { compatForm, extractValue } from '@angular/forms/signals/compat';
import { EditorJsControl } from '@anarchitects/editorjs-angular/forms';
import type { OutputData } from '@anarchitects/editorjs-core';

@Component({
  selector: 'app-migrating-article',
  imports: [EditorJsControl, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aa-editorjs-control [formField]="fields.body" aria-label="Article body" />
    <button type="button" (click)="reset()">Reset article</button>
  `,
})
export class MigratingArticle {
  readonly body = new FormControl<OutputData>(
    { blocks: [] },
    { nonNullable: true },
  );
  readonly model = signal({ body: this.body });
  readonly fields = compatForm(this.model);
  readonly editor = viewChild(EditorJsControl);

  readPublishedValue() {
    return extractValue(this.fields);
  }
  reset(): void {
    this.editor()?.reset();
    this.body.reset({ blocks: [] });
  }
}
```

Alternatively, introduce a `SignalFormControl` into a legacy group and bind its
`fieldTree`. Its reset calls the native editor hook, including unchanged-value
resets. Use Signal Forms schema rules for availability, errors and async validation.
It is not a drop-in replacement for every `FormControl` method: on the tested
baselines, imperative `disable()`, `setValidators()` and `setErrors()` throw.
Do not assume legacy event-option parity; consult Angular's
[`SignalFormControl` API](https://angular.dev/api/forms/signals/compat/SignalFormControl).

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { FormField, disabled } from '@angular/forms/signals';
import { SignalFormControl } from '@angular/forms/signals/compat';
import { EditorJsControl } from '@anarchitects/editorjs-angular/forms';
import type { OutputData } from '@anarchitects/editorjs-core';

@Component({
  selector: 'app-signal-field-in-legacy-form',
  imports: [EditorJsControl, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aa-editorjs-control
      [formField]="body.fieldTree"
      aria-label="Article body"
    />
    <button type="button" (click)="body.reset()">Reset article</button>
  `,
})
export class SignalFieldInLegacyForm {
  readonly locked = signal(false);
  readonly body = new SignalFormControl<OutputData>({ blocks: [] }, (path) => {
    disabled(path, () => this.locked());
  });
  readonly article = new FormGroup({ body: this.body });
}
```

### Interaction, availability and focus

Angular owns `dirty` and `touched`. The payload-free `touch` output reports focus
leaving the whole control; moving between blocks and the in-holder toolbar does not
mark touched. Initialization, programmatic value writes and calling `focus()` do not
by themselves mark interaction. Disablement and disposal suppress artificial blur.
A tool's UI portalled outside the control counts as leaving its boundary.

Use native schema `disabled()` and `readonly()` rules with `[formField]`. With
`[(value)]` alone, bind the `disabled` and `readonly` boolean inputs yourself.
Both request Editor.js read-only mode and retain the document. Disabled also makes
the editor region inert, preventing pointer/keyboard interaction and descendant tab
navigation. Readonly allows reading, selection and focus. Initial state is applied
before editor creation; later changes use the ordered editor API, without replacing
initialization-only configuration. Programmatic writes and resets, including unchanged-value resets,
still reconcile while unavailable.

Interaction is gated while loading or changing modes, including rapid toggles.
A mode failure leaves interaction gated and emits one operational error; the
requested form state is retained. Change the schema's availability state again to
retry, or recreate the control. Handle the error visibly; do not infer successful
editor mode from the requested field state alone. Legitimate saved edits captured
before entering read-only mode can still update the model and emit `change`.
Angular temporarily suppresses computed dirty/touched flags while a field is
non-interactive; retained flags become observable again on return to editable mode.

`focus(options?: FocusOptions): void` is the native Angular hook, also reached by
`fields.body().focusBoundControl()`. It delegates to the editor when ready and
editable, or focuses the labelled group when readonly. Before readiness, while
disabled, during a transition, after a mode failure or after disposal it does
nothing and never schedules a deferred focus steal. A failed editor focus reports
one `error`; its promise is handled internally. `preventScroll` and `focusVisible`
are accepted for signature compatibility but ignored, including group focus,
because Editor.js only exposes its own caret-position argument. Do not rely on
`config.autofocus` during initial interaction gating; request focus through this hook
when the control is usable.

The control receives native `invalid`, `pending`, `touched`, `dirty`, `required`,
`errors` and `name` inputs as well as availability. It uses a `group` role with
`aria-disabled` and `aria-busy` for applicable state; busy covers
native validation pending or an unsettled editor mode. Validation pending alone
does not disable editing. `data-invalid`, `data-readonly` and `data-required` expose
requested state for styling. The control avoids `aria-invalid` (deprecated on
`group`) and `aria-readonly`/`aria-required` (unsupported on that role), following
the [WAI-ARIA group contract](https://www.w3.org/TR/wai-aria-1.2/#group).
Supply visible labels, required indicators and validation/operation messages, and
associate descriptions using normal host attributes as shown above. Schema `errors`
and operational `error` events remain separate. Host ARIA does not certify the
accessibility of third-party tools.

### Reset, validation and submission

Reset through the native field tree, for example
`fields.body().reset({ blocks: [] })`. Angular restores pristine/untouched state;
`fields.body().reset()` retains the current model value and resets interaction.
The control's synchronous `reset(): void` hook invalidates obsolete publications
immediately, then reconciles after Angular supplies the value, even for the same
object reference. Calling the hook directly only reconciles the view; it does not
reset a form tree. With `[(value)]` alone, assign the desired model and call the
hook if its identity is unchanged. Programmatic assignment alone preserves flags.

Reset works during loading, readiness, saves, renders and unavailable modes.
Already-running upstream work cannot be forcibly cancelled, so the view may lag.
Queued obsolete saves cannot restore the previous model or mark the reset dirty.
A later successful render restores normal publication; render failure requires an
explicit write/reset retry. Removing the owner suppresses late outputs.

`save(): Promise<OutputData>` returns a detached, structurally checked current
snapshot through the same ordered queue. It does not itself update `value`, emit
`change`, mark dirty or run schema validation. It rejects before readiness, after
destruction, while read-only, or with `superseded` when reset/replacement overtakes
it or leaves the view unreconciled. Catch the rejection; a live owner's `error`
already reports it once. After reset, let Angular render before requesting a new
snapshot. Read-only workflows use the last successful model and must honor any
preceding operational errors.

Use native `required`, `validate` and `validateAsync` schema rules. A non-null
`{ blocks: [] }` passes structural checks but says nothing about meaningful content.
Define tool-aware content rules in the consuming application. Native `pending`
represents validation, not editor loading/saving. Native `submitting` belongs to the
form. Neither flushes editor work. `submit(..., { ignoreValidators: 'none', ... })`
refuses submission while validation is pending; it does not wait and retry for you.
See Angular's [submission API](https://angular.dev/api/forms/signals/submit) and
[async validation guidance](https://angular.dev/guide/forms/signals/async-operations).

This single-field example captures first, validates that exact snapshot, then
persists it. Supply the two application endpoints: `POST /api/articles/check`
returns `{ valid: boolean }`; `POST /api/articles` persists the document and returns
a successful HTTP status. The server must also validate persistence requests.
The sample paragraph rule is illustrative; adapt it to your tools and content policy.

```ts
import {
  ChangeDetectionStrategy,
  Component,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormField,
  form,
  required,
  submit,
  validate,
  validateAsync,
  type ValidationError,
} from '@angular/forms/signals';
import { EditorJsControl } from '@anarchitects/editorjs-angular/forms';
import type { OutputData } from '@anarchitects/editorjs-core';

function contentError(data: OutputData): ValidationError | undefined {
  const hasText = data.blocks.some((block) => {
    const text = (block.data as { text?: unknown }).text;
    return (
      block.type === 'paragraph' &&
      typeof text === 'string' &&
      text.trim().length > 0
    );
  });
  return hasText
    ? undefined
    : { kind: 'content', message: 'Write a paragraph.' };
}
async function checkArticle(
  data: OutputData,
): Promise<ValidationError | undefined> {
  const error = contentError(data);
  if (error) return error;
  const response = await fetch('/api/articles/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Validation unavailable');
  const result: unknown = await response.json();
  return typeof result === 'object' &&
    result !== null &&
    'valid' in result &&
    result.valid === true
    ? undefined
    : { kind: 'review', message: 'Review the article.' };
}

@Component({
  selector: 'app-submit-article',
  imports: [EditorJsControl, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 id="submit-body-label">Article</h2>
    <aa-editorjs-control
      [formField]="fields.body"
      aria-labelledby="submit-body-label"
      aria-describedby="submit-body-errors"
      (ready)="ready.set(true)"
      (error)="operationMessage.set($event.code)"
    />
    <p id="submit-body-errors" aria-live="polite">
      @for (error of fields.body().errors(); track $index) {
        {{ error.message }}
      }
    </p>
    <button
      type="button"
      [disabled]="!ready() || fields().submitting()"
      (click)="persist()"
    >
      Save
    </button>
    <button
      type="button"
      [disabled]="fields().submitting()"
      (click)="fields.body().reset({ blocks: [] })"
    >
      Reset
    </button>
    <p role="status">{{ operationMessage() }}</p>
  `,
})
export class SubmitArticle {
  readonly model = signal<{ body: OutputData }>({ body: { blocks: [] } });
  readonly ready = signal(false);
  readonly operationMessage = signal('');
  readonly editor = viewChild.required(EditorJsControl);
  readonly fields = form(this.model, (path) => {
    required(path.body);
    validate(path.body, ({ value }) => contentError(value()));
    validateAsync(path.body, {
      params: ({ value }) => value(),
      factory: (params) =>
        resource({ params, loader: ({ params }) => checkArticle(params) }),
      onSuccess: (error) => error,
      onError: () => ({
        kind: 'validation-service',
        message: 'Validation unavailable.',
      }),
    });
  });

  async persist(): Promise<void> {
    try {
      await submit(this.fields, {
        // This one-field form validates the fresh snapshot below, not the older model.
        ignoreValidators: 'all',
        action: async () => {
          const snapshot = await this.editor().save();
          const error = await checkArticle(snapshot);
          if (error) return { ...error, fieldTree: this.fields.body };
          try {
            const response = await fetch('/api/articles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(snapshot),
            });
            if (!response.ok) throw new Error('Save failed');
            this.operationMessage.set('Saved the captured document.');
            return undefined;
          } catch {
            return {
              kind: 'server',
              message: 'Save failed. Try again.',
              fieldTree: this.fields.body,
            };
          }
        },
      });
    } catch {
      // The editor reports its own error once; validation transport may also reject.
      this.operationMessage.set(
        'Could not capture or validate the article. Try again.',
      );
    }
  }
}
```

Native submission prevents duplicate actions and retains values on server failure.
The example deliberately uses `ignoreValidators: 'all'` only because it validates
its entire one-field payload inside the action. For a larger form, validate every
submitted field and its async rules; do not bypass unrelated validators.
It persists the captured document; edits made after capture belong to a later save.
Applications own policies for concurrent external resets, navigation and server
requests already sent. A successful snapshot is not a durable storage guarantee.

| Failure                  | Model and recovery                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load/create/ready        | Preserve the requested model; recreate the control to retry.                                                                                         |
| Invalid inbound document | Preserve the request, suspend publication, correct the model.                                                                                        |
| Render                   | Preserve the requested model; retry with an explicit write/reset. Partial upstream mutation is possible.                                             |
| Save                     | Preserve the last published value; retry a later edit or explicit save. A failed baseline save uses the next successful automatic snapshot silently. |
| Mode                     | Preserve requested availability and valid prior edits; interaction remains gated until an availability change/recreation retries.                    |
| Destruction              | Reject retained snapshots and suppress late outputs. Cleanup errors use Angular's error handler.                                                     |

Operational `error` events never replace schema `errors`. Consumers decide which
failures block persistence and render both kinds of feedback accessibly.

## Configuration and custom tools

`EditorJsConfig<Tools>` accepts upstream Editor.js configuration except `holder`,
deprecated `holderId`, `data`, `onReady` and `onChange`. Those fields are forbidden,
including when passing an already-typed upstream configuration object. Data is a
separate inbound value. Readiness and changes are separate outbound events.

`tools` uses core `ToolRegistration` / `ToolConfiguration`, preserving consumer
tool constructor, configuration and toolbox-data types. For the following API
sketch, copy `callout-data.ts` and `callout-tool.ts` from the installed core package's
[complete guide](https://github.com/anarchitects/anarchitecture-community/blob/main/packages/editorjs/core/custom-tools.md)
beside this file. `CalloutTool` is application source, not an exported package class.
This eager import is for a browser-only entry point; use the
[lazy Angular recipe](custom-tools.md) for SSR and delayed activation.

```ts
import type { EditorJsConfig } from '@anarchitects/editorjs-angular';
import type {
  OutputBlockDataFor,
  OutputData,
  ToolConfiguration,
} from '@anarchitects/editorjs-core';
import { CalloutTool } from './callout-tool';

interface CalloutData {
  text: string;
  tone: 'info' | 'warning';
}
interface CalloutOptions {
  label: string;
}
type Tools = {
  callout: ToolConfiguration<typeof CalloutTool, CalloutOptions, CalloutData>;
};
type Block = OutputBlockDataFor<{ callout: CalloutData }>;

export const config: EditorJsConfig<Tools> = {
  tools: {
    callout: {
      class: CalloutTool,
      config: { label: 'Note' },
      toolbox: { title: 'Callout', data: { tone: 'info' } },
    },
  },
};
export const data: OutputData<Block> = {
  blocks: [{ type: 'callout', data: { text: 'Hello', tone: 'info' } }],
};
```

Applications supply and validate tool implementations. A constructor satisfying
the core type alone does not prove that it implements the Editor.js browser API.
Tool options may contain callbacks/services and are not persisted JSON. Generic
block parameters describe data already validated by the application; they do not
validate editor output at runtime. Use core parsers/validators for untrusted data.

## Tool providers and injector ownership

For a complete application using the shared callout, inline marker, flag tune
and independently installed Code tool, see [Compose custom tools with Angular](custom-tools.md).
It includes direct/provider composition, explicitly owned environments and an
optional native Signal Forms workflow with validation, reset and submission.

`provideEditorJsTools(contribution, options?)` and `EDITOR_JS_TOOL_REGISTRY` are
optional environment APIs. They make a core tool registry available to an
application, route or explicitly created child `EnvironmentInjector`. They do not
belong in a component's `providers` array, and resolving the token never loads a
tool or Editor.js. Forms is not required.

When `config.tools` is omitted or `undefined`, the component resolves the nearest
provider registry at its browser activation boundary. An explicit map, including
`{}`, wins in full: the component does not look up, validate or load provider
tools. With no registry, Editor.js retains its normal built-ins. This rule also
applies to `EditorJsControl` through its root editor component.

Declare lazy tools in the application or route environment, then omit `tools`
from the editor config. The following sketch uses the same copied
`callout-tool.ts` and `callout-data.ts`; it is not a dependency on an unspecified
tool implementation. For a complete bootstrap, labelled editing UI, saved output
and teardown, follow [the shipped recipe](custom-tools.md#standalone-direct-and-provider-composition).

```ts
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  InjectionToken,
  type ApplicationConfig,
} from '@angular/core';
import {
  EditorJs,
  provideEditorJsTools,
  type EditorJsConfig,
} from '@anarchitects/editorjs-angular';

const TOOL_LABEL = new InjectionToken<string>('tool-label');

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: TOOL_LABEL, useValue: 'Note' },
    provideEditorJsTools({
      factory: () => {
        const label = inject(TOOL_LABEL);
        return [
          {
            name: 'callout',
            kind: 'block',
            source: 'lazy',
            load: () =>
              import('./callout-tool').then((module) => module.CalloutTool),
            settings: { config: { label } },
          },
        ];
      },
    }),
  ],
};

@Component({
  selector: 'app-provider-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorJs],
  template: '<aa-editorjs [config]="config" />',
})
export class ProviderEditor {
  readonly config: EditorJsConfig = {
    placeholder: 'Write an article',
  };
}
```

Pass either a readonly definitions array or `{ factory: () => definitions }`.
Factories run synchronously once per contribution when the owning environment's
snapshot is first requested. They may use `inject()` to capture services and
configuration, but must return inert definitions, not promises or loaded browser
code. A bare function/class is not a contribution. Factories run in the provider
owner's context even when a child requests the token; a child service override
does not change an already-owned parent contribution. Capture dependencies before
building a lazy `load` callback: loading does not establish an injection context,
and `inject()` cannot be used after an `await`.

Definition containers are snapshotted by core on first token lookup; treat them
as immutable until then. Provider options and selection lists are copied when
the helper is called. Opaque tool config/data and service identities follow core's
ownership rules and remain host-owned. Use separate definitions for mutable
per-editor or per-request configuration. Do not share such values across SSR
requests merely because a provider declaration is reusable.

`EditorJsToolProviderOptions` supports:

- `inherit` defaults to `false`. A local helper isolates its environment from
  ancestor registrations. `inherit: true` explicitly starts with the nearest
  parent's **selected** snapshot; a missing parent is empty. Parent-excluded tools
  cannot be recovered by child selection.
- `select` defaults to all composed custom definitions. An explicit list controls
  order, and `[]` selects none. Selection runs after inheritance and every local
  contribution. Names supplied across independent providers are checked at runtime.

Repeated helper calls in one environment concatenate definitions in provider
order. Every call must have identical normalized options, including selection
order; omitted `inherit` equals `false`, while omitted `select` differs from `[]`.
Conflicting options fail instead of silently using the final call's settings.
Core handles duplicate names, explicit same-kind `replace: true`, selection and
built-in/default rules using `EDITOR_JS_2_31_7_TOOL_PROFILE`. Replacing a definition
does not merge its config. Sibling snapshots remain independent. A child with no
local helper sees the nearest parent's same snapshot and owner.

Invalid provider wrappers/options can throw `ToolRegistryError` during helper
construction. Composition and selection errors surface on token lookup. Scope
option conflicts use `invalid-options` with a `providers` path; invalid factory
results use `invalid-definition`. A throwing host factory propagates its error.
Correct the provider configuration and create a new environment rather than
retrying a failed DI factory. With no provider, optional token lookup returns
`null`; direct `config.tools` usage needs no registry provider.

Providers own immutable metadata, not resolvers or editor instances. Each editor
owns one core resolver and waits for its selected tools before invoking the
configured `provideEditorJsLoader` loader. The synchronous factory receives a
fresh config shell and tool map, followed by the existing readiness and document
reconciliation flow. Data changed during loading is read at creation; config
remains initialization-only. A config identity change reports `config-changed`
and does not reload tools. Shared module code is allowed; raw editors and tool
instances must not be shared between owners.

The component disposes its resolver on removal and unregisters its environment
cleanup callback. Destruction of the actual provider-owning environment also
terminates the editor, including when the registry is inherited by a child.
Pending loads cannot create a stale editor or emit outputs. An already-created
editor awaiting readiness is fenced immediately and destroyed when readiness
settles; a never-settling upstream readiness promise can delay physical cleanup.
Route exit alone does not prove environment destruction, since an injector may be
retained for reuse. Destroying a child does not destroy its parent or siblings.

During component initialization, composition, selection and reference errors emit
`operation: 'config'`, `code: 'operation-failed'`. Rejected tool loads or invalid
constructors emit `operation: 'load'` with the same code. Their `ToolRegistryError`
cause identifies the tool/path and retains the underlying load cause. The editor
loader, factory and readiness retain their existing `load`, `create` and `ready`
error stages. A failed initialization emits no ready event and does not retry.
Fix the cause and recreate the component; if DI composition failed, correct the
providers and create a fresh environment too. Cleanup errors after owner
termination go to Angular's `ErrorHandler`, because outputs are no longer usable.

Server imports, provider setup, token lookup and rendering never invoke these
loaders. SSR still renders an empty holder; keep host-owned hydration providers,
initial data and request isolation as described above. Provider-backed tools do
not change the supported hydration modes. Lazy tool delivery in a particular
application still depends on its imports, preloading and activation policy.

Static imports are eager even when used inside a provider declaration. For a tool
whose module touches browser globals, declare `source: 'lazy'` and a host-owned
dynamic loader; do not call it during a contribution factory or server rendering.
See the [core registry and resolver guide](https://github.com/anarchitects/anarchitecture-community/tree/main/packages/editorjs/core#lazy-tool-resolution)
for loading, retry, disposal and validation limits.

### Recovering from a failed tool load

Use the provider configuration above with a host that removes a failed editor
and lets the user mount a fresh one after the loading problem has been corrected:

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  EditorJs,
  type EditorJsErrorEvent,
} from '@anarchitects/editorjs-angular';

@Component({
  selector: 'app-retry-editor',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 id="retry-editor-label">Article body</h2>
    @if (message()) {
      <p role="alert">{{ message() }}</p>
    }
    @if (mounted()) {
      <aa-editorjs
        role="group"
        aria-labelledby="retry-editor-label"
        (error)="onError($event)"
      />
    } @else {
      <button type="button" (click)="retry()">Retry loading editor</button>
    }
  `,
})
export class RetryEditor {
  readonly mounted = signal(true);
  readonly message = signal('');
  onError(event: EditorJsErrorEvent): void {
    this.message.set(`Editor error: ${event.operation} (${event.code})`);
    // Load failures happen before an editor is created; a new mount owns a new resolver.
    if (event.operation === 'load') this.mounted.set(false);
  }
  retry(): void {
    this.message.set('');
    this.mounted.set(true);
  }
}
```

This retries initialization, not an operation on the failed component. The user
action occurs after Angular has removed the old view. A malformed definition or
invalid constructor needs a code/configuration fix; remounting does not repair it.
DI composition failures require a corrected, fresh environment as well. For an
editor that previously accepted edits, keep the last accepted saved document in
the host and pass it as `[data]` to a new owner; do not assume removal saves edits.
Use unique accessible label IDs when hosting more than one instance.

Block, inline and tune definitions use the same public core shapes shown in the
[three-kind registry example](https://github.com/anarchitects/anarchitecture-community/tree/main/packages/editorjs/core#block-inline-and-tune-definitions).
Pass definitions to `provideEditorJsTools`, not an already composed registry.
With `{ select: ['callout', 'marker', 'flag'] }`, keep every custom name referenced
by a selected block's `inlineToolbar` or `tunes`. Built-in `bold` and `paragraph`
need no custom registration. To specialize an inherited block, use
`{ inherit: true }` and an explicit same-kind `replace: true` definition with all
required settings; inheritance does not merge its opaque config object.

## Optional upload ownership

`createEditorJsUploadOwner` adds per-editor signals and lifetime handling to an
existing core `FileUploader`, `UrlUploader` or `ImageUploader`. It is available
from the root without Angular Forms. It creates only the supplied methods and
uses core's operation runner; it installs no HTTP client, interceptors, Fetch
adapter or global upload registry. Share a stateless backend through DI, then
create a separate owner for every editor instance.

Install `@anarchitects/editorjs-tool-image` to use this example; it supplies its
pinned `@editorjs/image` dependency. Keep the Editor.js peer installed as above.
Supply your existing `ImageUploader<Blob>` to `startUploadEditor`;
compose separate capabilities with core's `composeImageUploader` if needed.
The browser document must contain `<app-upload-editor></app-upload-editor>`.
The optional `@anarchitects/editorjs-upload-fetch/browser` adapter can implement
that port, or your host may capture its already configured HTTP client in a
provider factory. Resolve injected dependencies synchronously: request callbacks
run later, outside the injection context.

For HTTP, use the Fetch adapter's
[complete custom-backend mapping](https://github.com/anarchitects/anarchitecture-community/tree/main/packages/editorjs/upload-fetch#quick-start-a-custom-backend)
and pass the result of `createUploads()` to `startUploadEditor`. That optional
adapter requires a separate install and does not use Angular HttpClient
interceptors. With native Forms, pass the same port to
[the upload-aware submission recipe](#uploads-with-native-signal-forms).
Both image methods remain required; explicitly deny unsupported URL uploads.
Accept Blob inputs without assuming that a filename exists.

<!-- example-file: upload-editor.ts -->

```ts
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  InjectionToken,
  signal,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  createEditorJsUploadOwner,
  EditorJs,
  type EditorJsConfig,
  type EditorJsUploadOwner,
} from '@anarchitects/editorjs-angular';
import {
  composeToolRegistry,
  createToolResolver,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  type ImageUploader,
} from '@anarchitects/editorjs-core';
import { defineImageTool } from '@anarchitects/editorjs-tool-image';

const UPLOAD_BACKEND = new InjectionToken<ImageUploader<Blob>>(
  'upload backend',
);
const UPLOAD_OWNER = new InjectionToken<
  EditorJsUploadOwner<ImageUploader<Blob>>
>('editor upload owner');

@Component({
  selector: 'app-upload-editor',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: UPLOAD_OWNER,
      useFactory: () =>
        createEditorJsUploadOwner(inject(UPLOAD_BACKEND), {
          destroyRef: inject(DestroyRef),
          // Return only safe UI text. Never copy a raw server message or cause.
          mapError: () => 'The image could not be uploaded. Please try again.',
        }),
    },
  ],
  template: `
    <section aria-label="Article editor" [attr.aria-busy]="uploads.busy()">
      <p role="status">{{ uploads.activeCount() }} uploads in progress</p>
      @if (config(); as configured) {
        <aa-editorjs [config]="configured" />
      }
      @if (loadingError()) {
        <p role="alert">The editor tools could not load.</p>
      }
      @for (operation of uploads.operations(); track operation.id) {
        @if (operation.status !== 'active') {
          <p role="alert">{{ operation.message }}</p>
          <button type="button" (click)="uploads.acknowledge(operation.id)">
            Dismiss upload error
          </button>
        }
      }
      @if (uploads.overflow(); as summary) {
        <p role="alert">{{ summary.count }} additional uploads failed.</p>
        <button type="button" (click)="uploads.acknowledge(summary.id)">
          Dismiss older upload errors
        </button>
      }
    </section>
  `,
})
export class UploadEditor {
  readonly uploads = inject(UPLOAD_OWNER);
  readonly config = signal<EditorJsConfig | undefined>(undefined);
  readonly loadingError = signal(false);

  constructor() {
    const lifetime = inject(DestroyRef);
    const registry = composeToolRegistry(
      [
        [
          defineImageTool({
            source: 'lazy',
            load: () =>
              import('@anarchitects/editorjs-tool-image/browser').then(
                (m) => m.ImageTool,
              ),
            settings: { config: { uploader: this.uploads.uploader } },
          }),
        ],
      ],
      { profile: EDITOR_JS_2_31_7_TOOL_PROFILE },
    );
    const resolver = createToolResolver(registry);
    lifetime.onDestroy(() => resolver.dispose());
    afterNextRender(() => {
      void resolver
        .resolve()
        .then((tools) => {
          if (!lifetime.destroyed) this.config.set({ tools });
        })
        .catch(() => {
          if (!lifetime.destroyed) this.loadingError.set(true);
        });
    });
  }
}

export function startUploadEditor(backend: ImageUploader<Blob>) {
  return bootstrapApplication(UploadEditor, {
    providers: [{ provide: UPLOAD_BACKEND, useValue: backend }],
  });
}
```

`DestroyRef` must belong to the intended editor host. A root or route provider
can live longer than a visible editor; navigating away does not guarantee route
injector destruction. The example's component provider creates one owner per
component. `provideEditorJsTools` still creates an immutable environment snapshot,
not a per-editor factory: never place a mutable owner in a shared definition.
The example materializes its own registry and passes a complete `config.tools`
map, preserving its precedence over all environment tool providers. An isolated
environment with a deliberately matching editor lifetime is also supported.

`operations()` contains frozen records with a unique opaque symbol `id`, numeric
`generation`, `kind` (`file` or `url`), `attempts`, and `status` (`active`, `failure`
or `exception`). Only failed records have presentation text. IDs are local runtime
identities, not serializable storage keys. No input Blob, URL, raw error, response
body or credentials are copied into these records. The host mapper is responsible
for redaction; omitted, throwing, asynchronous or invalid mappers fall back to a
generic message and never replace the port's original outcome.

`busy()` and `activeCount()` cover logical operations, including retry delays.
Successful records disappear; failures remain until `acknowledge(id)` or reset.
Acknowledging an active operation does nothing. Success or a new manual retry
never clears an earlier failure. At most 100 detailed failures remain; older
failures increment `overflow().count`, which keeps `hasErrors()` true until the
summary is explicitly acknowledged or reset. Active work is never evicted.

Retries are off by default. The optional `retry` uses core's bounded
`UploadRetryPolicy`, including an explicit replay-safety guarantee, classifier and
host scheduler. Invalid policy rejects an invocation before transport starts.
The attempt count measures only calls made by core; retries inside a host backend
are opaque. Owner-level retry cannot add an idempotency key through the unchanged
port signature: enable it only when repeating that port call is already safe.
See the [core retry contract](https://github.com/anarchitects/anarchitecture-community/tree/main/packages/editorjs/core#upload-boundaries).

Expected failures still resolve with the original `success: 0` response; throws
and rejections preserve their original cause. The ImageTool bridge owns its
notification. Owner state provides a separate host UI and must not be forwarded
to the editor's initialization-error output or another ImageTool notifier.
Upload completion does not imply persistence of the editor document, and
`save()` does not wait for uploads. Choose an explicit host save/submit policy.

`reset()` advances the generation, stops local operation handles, clears activity
and errors, and permits new work. `dispose()` also permanently rejects future
calls with core's `UploadStoppedError`; it unregisters its destruction callback.
Both fence late completions. Neither aborts a host transport nor rolls back a
backend mutation. The host may independently wire a transport abort signal.
A broken retry scheduler cancellation can throw an `AggregateError` after all
handles have been stopped and state cleared; schedulers must return nonthrowing
cleanup callbacks.

**For document replacement, including a same-value reset, destroy the old
editor/tool generation and dispose its owner, then mount a fresh component with
fresh owner/configuration.** A keyed `@for` or removing/recreating the host view
provides this lifetime boundary. Resetting owner signals alone cannot invalidate
an ImageTool callback already running against the old document. Do not reuse an
old owner in a replacement editor. SSR creates inert state; browser tool imports
and requests begin only after client activation and user action.

## Imperative controls

Each `EditorJs` component exposes a stable, bound `api: EditorJsApi`. Readiness
remains a payload-free notification; retrieve controls through the component,
for example using an Angular signal query:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  signal,
  viewChild,
} from '@angular/core';
import {
  EditorJs,
  EditorJsOperationError,
} from '@anarchitects/editorjs-angular';
import type { OutputData } from '@anarchitects/editorjs-core';

@Component({
  selector: 'app-saveable-editor',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" [disabled]="!ready()" (click)="save()">
      Save snapshot
    </button>
    <p role="status">{{ status() }}</p>
    <aa-editorjs (ready)="ready.set(true)" (error)="status.set($event.code)" />
  `,
})
export class SaveableEditor {
  readonly editor = viewChild.required(EditorJs);
  readonly ready = signal(false);
  readonly status = signal('Loading');
  readonly snapshot = signal<OutputData | undefined>(undefined);

  async save(): Promise<void> {
    try {
      this.snapshot.set(await this.editor().api.save());
      this.status.set('Snapshot available');
    } catch (error) {
      this.status.set(
        error instanceof EditorJsOperationError ? error.code : 'Save failed',
      );
    }
  }
}
```

| Method                  | Result and behavior                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `save()`                | `Promise<OutputData>` with a detached, structurally validated snapshot. Does not emit `change` or alter automatic change tracking.                       |
| `render(data)`          | `Promise<void>`. Validate/copy data when accepted, then replace content in queue order without a feedback change.                                        |
| `clear()`               | `Promise<void>`. Delegate to Editor.js clear, including its empty initial block; suppress programmatic feedback.                                         |
| `focus(atEnd?)`         | `Promise<boolean>`. Return Editor.js's focus result; `false` is a supported result, not a rejection. Omitted `atEnd` keeps the upstream default.         |
| `setReadOnly(readOnly)` | `Promise<boolean>` with the upstream resulting mode. Requires every installed tool to support that mode. `config.readOnly` supplies the initial setting. |

All calls before readiness reject with `not-ready`; calls after owner disposal
reject with `destroyed`. A failed initialization disposes the controller, so
recreate the component before trying again. While ready, controls and observed
input replacements share one ordered queue with automatic saves. Calls during a
replacement wait for it. Later work still runs after a failed operation. A direct
`save()` rejects with `superseded` if a later accepted replacement or explicit
invalidation overtakes it, or a failed replacement leaves the view unreconciled.
Retry after successful reconciliation. Ordinary later editor edits do not supersede
an explicit snapshot; callers own edits after capture.

`render` and `clear` invalidate obsolete automatic snapshots when accepted. Their
promises include the silent baseline save while editable. Baseline failure rejects
with `operation: 'save'` even though content may already have been replaced. Invalid
`render` data rejects with `operation: 'render'`, `code: 'invalid-data'`, preserving
core diagnostics. Unlike the optional data input, `render` requires a document;
use `clear()` or `{ blocks: [] }` for empty content.

Read-only transitions serialize with document operations. Pending observed edits
are captured before entering read-only mode; mode changes do not manufacture edit
events. Editor.js 2.31.7 rejects `save()` while read-only. Baselines are taken before
entry and after returning to editing. Replacements/clear while read-only defer
their baseline until editing resumes, and editor notifications are ignored while
read-only. A failed transition may partially change the upstream mode; the default
driver reads its actual state when attempting recovery. Tool support and focus
behavior remain upstream responsibilities.
Failed mode transitions require a silent recovery baseline. Failed render/clear
operations instead suspend publication until a successful explicit replacement.

Imperative failures reject with `EditorJsOperationError`, an `Error` carrying
`operation`, `code` and original `cause`. While the component is live, the same
object is emitted through `error`. Always await/catch returned promises, even if
you also listen to `error`; the output does not handle the caller's rejection.
Removing the component rejects active and queued calls immediately with `destroyed`,
drops unstarted work and suppresses late outputs. Already-running upstream work
cannot be cancelled. The facade has no public `destroy()` and cannot control
another component's instance; a retained old facade remains disposed after remount.

### Adapter reconciliation

`EditorJs.invalidate(): void` synchronously suspends obsolete publications and
supersedes pending snapshots, including before readiness. `reconcile(): void`
invalidates and schedules reapplication of the current `data` input after Angular
renders, even when its identity is unchanged. These methods support adapters whose
reset callback runs before the new value is bound: invalidate immediately, update
the binding, then reconcile. Invalidating alone leaves publication suspended until
a successful replacement; neither method changes the input or emits `change`.
Forms consumers normally use the field tree's reset API instead. No raw Editor.js
instance or core queue is exposed, and server rendering does not run reconciliation.

## Errors and accessibility

Use error codes for control flow; `cause` preserves the upstream error or core data
diagnostic. Error messages are explanatory, not stable identifiers.

| Code               | Meaning and response                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `not-ready`        | Await the live component's `ready` notification before issuing controls.                                                                  |
| `superseded`       | The snapshot was overtaken or the view is unreconciled. Reapply the authoritative document/reset, allow Angular to render, then retry.    |
| `destroyed`        | The owner has been disposed; obtain controls from a newly mounted component.                                                              |
| `invalid-data`     | Inspect the core diagnostic in `cause`, correct the document and retry explicitly.                                                        |
| `config-changed`   | Configuration is initialization-only; recreate the component to change it.                                                                |
| `operation-failed` | Inspect `operation` and `cause`; load/create/ready failures need recreation, while later queued work can continue after control failures. |

Give each editor a visible label and named group, as in the quick start. Use unique
label IDs when rendering multiple editors. Applications own loading/error presentation
and focus placement after mount or removal. The wrapper forwards `api.focus()` and
does not add a textbox role to its multi-block holder. Accessible block editing,
keyboard commands and read-only behavior also depend on the selected Editor.js tools;
a named outer group does not certify their accessibility.

## Lazy loading and replacement

`EDITOR_JS_LOADER` is an `InjectionToken<EditorJsLoader>` with a default stateless
loader. Injecting it does not load Editor.js. Call it only after a live browser
owner has rendered its holder; the default rejects on non-browser platforms
before importing Editor.js. It resolves an `EditorJsFactory`, which creates one
fresh raw `EditorJsInstance` synchronously per call.

After awaiting the loader, check that the owner is still live before calling the
factory. Retain the returned instance immediately, observe its `isReady` rejection
and arrange teardown even if readiness fails or the owner is destroyed meanwhile.
The factory can throw; the loader can reject. The caller owns both failures.

`EditorJsCreateOptions` supplies `holder`, `config`, `data` and `onChange`. The
default factory calls core `normalizeOutputData` to validate and detach initial
data, defaulting only omitted data to an empty document. Invalid data throws a
`TypeError` whose `cause` is the original core diagnostic. It does not implement
tool-schema validation. The factory applies holder/data/callback fields after consumer
options and clears `holderId`/`onReady`, protecting ownership even for untyped
callers. Readiness comes from `isReady`. The raw change callback only invalidates
content; it is not the saved-document output. Raw instance methods bypass the
facade's contract and belong exclusively to the owner.

Replace loading in an application or route environment with a typed provider:

```ts
import type { ApplicationConfig } from '@angular/core';
import {
  provideEditorJsLoader,
  provideEditorJsTools,
} from '@anarchitects/editorjs-angular';
import type { EditorJsLoader } from '@anarchitects/editorjs-angular';
import type { ToolDefinition } from '@anarchitects/editorjs-core';

export function configureEditor(
  loader: EditorJsLoader,
  tools: readonly ToolDefinition[],
): ApplicationConfig {
  return {
    providers: [provideEditorJsLoader(loader), provideEditorJsTools(tools)],
  };
}
```

A component that omits `config.tools` resolves this registry before calling the
custom loader. Its factory receives `options.config.tools` as a fresh, resolved
map; preserve it when constructing Editor.js. An explicit `config.tools` map
replaces the provider registry in full even with a custom loader. The loader
chooses editor construction; it does not own or extend the registry lifecycle.

A replacement loader may cache code, but must not cache instances, holders or
documents. Each factory call must create a distinct instance. It must reuse core normalization for detached initial data, preserve
owned option precedence and propagate load/creation/readiness failures. Child
environment overrides affect their descendants; application-wide providers store
only loading behavior. Component-level test overrides can provide the token
directly using `useValue`. Custom loaders must enforce their own platform safety.

## Public surface and ownership

Use the root entry point for standalone editing and `/forms` for Forms integration.
Package metadata is available through the `package.json` subpath.

- Root runtime exports: `EditorJs`, `EDITOR_JS_LOADER`, `provideEditorJsLoader`,
  `EDITOR_JS_TOOL_REGISTRY`, `provideEditorJsTools`,
  `EditorJsOperationError` (re-exported from core), `createEditorJsUploadOwner`.
- Upload types: `EditorJsUploadOwner`, `EditorJsUploadOwnerOptions`,
  `EditorJsUploadRecord`, `EditorJsUploadId`, `EditorJsUploadOverflow`.
- Tool provider types: `EditorJsToolContribution`, `EditorJsToolProviderOptions`.
- Configuration types: `EditorJsConfig`, `EditorJsTools`.
- Event/control types (re-exported from core): `EditorJsApi`, `EditorJsReadyEvent`, `EditorJsChangeEvent`,
  `EditorJsErrorEvent`, `EditorJsOperation`.
- Loading types: `EditorJsLoader`, `EditorJsFactory`, `EditorJsCreateOptions`,
  `EditorJsInstance`.

The `/forms` entry point exports `EditorJsControl` and the type
`EditorJsControlConfig`. Its supported surface is `value`, `config`, native state
inputs listed above, `touch`, `ready`, `change`, `error`, `focus()`, `reset()` and
`save()`. It has no separate `data` input or imperative `api`. Import document, tool and upload types directly
from `@anarchitects/editorjs-core`.
Applications own persistence records, storage mappings, migrations, transports,
tool selection and rendering safety. The optional registry supplies metadata;
concrete tools, an uploader and application models remain host-owned.
Forms is optional and isolated to the `/forms` entry point. SSR and
hydration require the host composition described above. Editor.js remains an
application-owned peer dependency.

Core implements document normalization, the shared operation queue, change coalescing
and disposal guards. Angular adds signal inputs/outputs, dependency injection,
browser loading and component/holder ownership. Non-Angular integrations can use
`EditorJsDocumentCoordinator` and its non-DOM driver directly from core; they provide
their own readiness, editor creation and destruction. See the
[core package documentation](https://github.com/anarchitects/anarchitecture-community/tree/main/packages/editorjs/core#readme).

| Need                             | Consumer responsibility / current boundary                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Angular Forms                    | Opt-in value binding, touch, availability, focus, reset and snapshots via `/forms`; no package-owned CVA.     |
| SSR/hydration                    | Supported profiles above; host owns providers, routes, initial data, native submission safety and deployment. |
| Tool registry and concrete tools | Optional browser-resolved providers or explicit `config.tools`; hosts supply concrete tools and schemas.      |
| Uploads                          | Supply transport, credentials and application policy; core upload contracts do not perform uploads.           |
| Persistence                      | Decide storage records, validation, migrations and save policy; `change` is not durable storage.              |

Package versions are independent from document schema/tool versions. During `0.x`,
review [release notes](https://github.com/anarchitects/anarchitecture-community/releases)
under `editorjs-angular@<version>` before upgrading. Incompatible changes during
`0.x` require an explicit minor release and migration guidance; from `1.0` they
require a major release. Treat peer-range narrowing, input/event/error semantics
and loader/driver requirements as compatibility changes. The readiness event is
payload-free; controls are obtained from the component's `api`.

## Troubleshooting

| Symptom                                                         | Action                                                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A control rejects with `not-ready` or `destroyed`               | Wait for `ready`, then use the live component’s `api`; obtain a new facade after remounting.                                      |
| Upstream `EditorConfig` is rejected                             | Remove holder/data/callback options and define a fresh `EditorJsConfig`; supply data and observe events separately in your owner. |
| Loader rejects on the server                                    | Invoke it only from browser initialization after rendering. Do not initialize editors from server requests.                       |
| Tool fails during creation or rendering                         | Check its Editor.js compatibility and tool-specific input/configuration; core type compatibility is not runtime validation.       |
| Configuration changes or in-place data mutations have no effect | Supply a new document reference; recreate the component to change configuration. Observe the error output for rejected updates.   |
| Angular peer mismatch                                           | Use matching Angular 22 core/common/Forms versions (Forms only when using `/forms`) and their supported tooling.                  |
| Private subpath or source file cannot resolve                   | Import the package root and remove repository-only `@anarchitecture-community/source` resolution conditions.                      |

Report reproducible problems with package, Angular, Editor.js and Node versions
through the [issue tracker](https://github.com/anarchitects/anarchitecture-community/issues).
Contributor details are in the
[development guide](https://github.com/anarchitects/anarchitecture-community/blob/main/docs/editorjs-angular-development.md).

## Uploads with native Signal Forms

Install the optional `@angular/forms` peer alongside the Image Tool dependencies
above. This opt-in recipe composes `createEditorJsUploadOwner` with the existing
`EditorJsControl` and native `validate`/`submit`. It adds no control facade and
changes no behavior for standalone or Forms consumers who do not select it.
Supply your upload port and an awaited persistence function to
`startArticleEditor`; mount `<app-article-editor></app-article-editor>`.
The persistence function returns false for an expected safe application failure;
transport exceptions stay in the host's error handling.

This recipe **blocks while uploads are active**. `pending()` still means native
asynchronous validation, `submitting()` means the native submission action, and
the host's `locked()` also covers snapshot capture. `ignoreValidators: 'none'`
blocks pending validation; it does not wait. Submit again after validation
completes. `EditorJsControl.save()` captures the editor and does not await uploads.
If adding async document validation, derive a stable content key for its resource
parameters (for example, serialize the blocks being validated). Do not key it on
the entire snapshot object or its capture timestamp: every save creates a new
snapshot, which would restart validation on every submission attempt. The schema
below uses synchronous upload rules; remote content validation remains host-owned.

<!-- example-file: forms-upload-editor.ts -->

```ts
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  InjectionToken,
  input,
  output,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  FormField,
  form,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { createEditorJsUploadOwner } from '@anarchitects/editorjs-angular';
import {
  EditorJsControl,
  type EditorJsControlConfig,
} from '@anarchitects/editorjs-angular/forms';
import {
  composeToolRegistry,
  createToolResolver,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  type ImageUploader,
  type OutputData,
} from '@anarchitects/editorjs-core';
import { defineImageTool } from '@anarchitects/editorjs-tool-image';

interface Article {
  title: string;
  body: OutputData;
}
const BACKEND = new InjectionToken<ImageUploader<Blob>>('article uploads');
const PERSIST = new InjectionToken<(article: Article) => Promise<boolean>>(
  'persist article',
);

@Component({
  selector: 'app-article-session',
  imports: [FormField, EditorJsControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-label="Article" [attr.aria-busy]="uploads.busy()">
      <p role="status">{{ uploads.activeCount() }} uploads in progress</p>
      <div #surface [inert]="locked()" [attr.inert]="locked() ? '' : null">
        <label>Title <input [formField]="fields.title" /></label>
        @if (config(); as configured) {
          <aa-editorjs-control
            aria-label="Article body"
            [formField]="fields.body"
            [config]="configured"
            (ready)="ready.set(true)"
            (error)="
              notice.set('The editor operation failed. Please try again.')
            "
          />
        }
      </div>
      <!-- No form element: neither click nor Enter has a native submission fallback. -->
      <button
        type="button"
        [disabled]="
          !ready() || locked() || uploads.busy() || uploads.hasErrors()
        "
        (click)="save()"
      >
        Save article
      </button>
      <button type="button" (click)="reset()">Reset current article</button>
      @for (error of fields().errorSummary(); track $index) {
        <p role="alert">{{ error.message }}</p>
      }
      @for (operation of uploads.operations(); track operation.id) {
        @if (operation.status !== 'active') {
          <button type="button" (click)="uploads.acknowledge(operation.id)">
            Acknowledge upload error
          </button>
        }
      }
      @if (uploads.overflow(); as overflow) {
        <button type="button" (click)="uploads.acknowledge(overflow.id)">
          Acknowledge older upload errors
        </button>
      }
      <p role="status">{{ notice() }}</p>
      @if (fields().pending()) {
        <p role="status">Validation in progress</p>
      }
      @if (fields().submitting()) {
        <p role="status">Saving article</p>
      }
    </section>
  `,
})
export class ArticleSession implements OnInit {
  readonly initial = input.required<Article>();
  readonly replacement = output<Article>();
  readonly lifetime = inject(DestroyRef);
  private readonly persist = inject(PERSIST);
  readonly uploads = createEditorJsUploadOwner(inject(BACKEND), {
    destroyRef: this.lifetime,
    mapError: () =>
      'An image upload failed. Retry or remove it, then acknowledge this error.',
  });
  readonly model = signal<Article>({ title: '', body: { blocks: [] } });
  readonly fields = form(this.model, (path) => {
    required(path.title, { message: 'Enter an article title.' });
    validate(path.body, () => [
      ...(this.uploads.busy()
        ? [
            {
              kind: 'upload-busy',
              message: 'Wait for image uploads before saving.',
            },
          ]
        : []),
      ...this.uploads
        .operations()
        .filter((op) => op.status !== 'active')
        .map((op) => ({ kind: 'upload-failed', message: op.message })),
      ...(this.uploads.overflow()
        ? [
            {
              kind: 'upload-failed',
              message:
                'Additional uploads failed; review before acknowledging.',
            },
          ]
        : []),
    ]);
  });
  readonly locked = signal(false);
  readonly ready = signal(false);
  readonly notice = signal('');
  readonly config = signal<EditorJsControlConfig | undefined>(undefined);
  private readonly editor = viewChild(EditorJsControl);
  private readonly surface = viewChild<ElementRef<HTMLElement>>('surface');

  ngOnInit() {
    this.fields().reset(this.initial());
  }
  constructor() {
    const available = () => !this.locked() && !this.uploads.disposed();
    const resolver = createToolResolver(
      composeToolRegistry(
        [
          [
            defineImageTool({
              source: 'lazy',
              load: () =>
                import('@anarchitects/editorjs-tool-image/browser').then(
                  (m) => m.ImageTool,
                ),
              settings: {
                config: {
                  uploader: {
                    uploadByFile: (file: Blob) =>
                      available()
                        ? this.uploads.uploader.uploadByFile(file)
                        : Promise.resolve({ success: 0 as const }),
                    uploadByUrl: (url: string) =>
                      available()
                        ? this.uploads.uploader.uploadByUrl(url)
                        : Promise.resolve({ success: 0 as const }),
                  },
                },
              },
            }),
          ],
        ],
        { profile: EDITOR_JS_2_31_7_TOOL_PROFILE },
      ),
    );
    this.lifetime.onDestroy(() => resolver.dispose());
    afterNextRender(() => {
      void resolver
        .resolve()
        .then((tools) => {
          if (!this.lifetime.destroyed)
            this.config.set({ tools, defaultBlock: 'image' });
        })
        .catch(() => {
          if (!this.lifetime.destroyed)
            this.notice.set('Image tools could not load.');
        });
      // Capture-phase guard closes the gap before Angular applies inert.
      const element = this.surface()?.nativeElement;
      const gate = (event: Event) => {
        if (!this.locked()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      const events = [
        'pointerdown',
        'pointerup',
        'mouseup',
        'touchstart',
        'dblclick',
        'keyup',
        'mousedown',
        'click',
        'keydown',
        'beforeinput',
        'input',
        'paste',
        'cut',
        'drop',
      ];
      for (const name of events) element?.addEventListener(name, gate, true);
      this.lifetime.onDestroy(() => {
        for (const name of events)
          element?.removeEventListener(name, gate, true);
      });
    });
  }
  reset() {
    const article = this.initial();
    this.ready.set(false);
    this.locked.set(true);
    this.editor()?.reset();
    // Session destruction removes the tool before DestroyRef disposes uploads.
    this.fields().reset(article);
    this.replacement.emit(article);
  }
  async save() {
    const editor = this.editor();
    if (
      !editor ||
      !this.ready() ||
      this.lifetime.destroyed ||
      this.locked() ||
      this.uploads.disposed()
    )
      return;
    if (this.uploads.busy() || this.uploads.hasErrors()) {
      this.notice.set('Resolve outstanding uploads before saving.');
      return;
    }
    this.locked.set(true); // Also guards programmatic duplicate calls before snapshot capture.
    const generation = this.uploads.generation();
    const current = () =>
      this.ready() &&
      !this.lifetime.destroyed &&
      !this.uploads.disposed() &&
      this.uploads.generation() === generation &&
      !this.uploads.busy() &&
      !this.uploads.hasErrors();
    try {
      const snapshot = await editor.save(); // This API does not wait for uploads.
      if (!current()) return;
      this.model.update((article) => ({ ...article, body: snapshot }));
      const saved = await submit(this.fields, {
        ignoreValidators: 'none',
        action: async (field) => {
          if (!current())
            return { kind: 'superseded', message: 'The article changed.' };
          const success = await this.persist({
            ...field().value(),
            body: snapshot,
          });
          if (!current()) return undefined;
          return success
            ? undefined
            : {
                kind: 'server',
                message: 'The article could not be saved. Please try again.',
              };
        },
      });
      if (current())
        this.notice.set(
          saved ? 'Article saved.' : 'Review the form before saving again.',
        );
    } catch {
      if (current())
        this.notice.set('The article could not be saved. Please try again.');
    } finally {
      this.locked.set(false);
    }
  }
}

@Component({
  selector: 'app-article-editor',
  imports: [ArticleSession],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (generation of [revision()]; track generation) {
      <app-article-session
        [initial]="article()"
        (replacement)="replace($event)"
      />
    }
  `,
})
export class ArticleEditor {
  readonly article = signal<Article>({ title: '', body: { blocks: [] } });
  readonly revision = signal(0);
  replace(article: Article) {
    this.article.set(article);
    this.revision.update((value) => value + 1); // Recreate even for the same value.
  }
}
export function startArticleEditor(
  backend: ImageUploader<Blob>,
  persist: (article: Article) => Promise<boolean>,
) {
  return bootstrapApplication(ArticleEditor, {
    providers: [
      { provide: BACKEND, useValue: backend },
      { provide: PERSIST, useValue: persist },
    ],
  });
}
```

The outer component replaces the complete session on reset, including same-value
reset. Call `replace(nextArticle)` for a different document. The native reset API
clears interaction state; destroying the session retires its editor, tool and
upload owner. Owner reset alone cannot invalidate callbacks already held by an
Image Tool. Disposal fences local results but does not abort a transport or undo
stored files. Persistence already sent to a server has the same limitation.

The lock prevents new editing and upload calls during snapshot capture and
submission. If your host adds programmatic document writes, disabled/readonly
rules or additional uploader entry points, apply the same guard there and reject
an attempt if availability or document identity changes. Use native `disabled`
and `readonly` schema rules; do not bind those inputs over `[formField]`. Do not
route upload errors through the editor's initialization/save error output.

Upload errors are derived validators, so other validators and native server
errors remain under Angular's ownership. Snapshot reconciliation changes the
model; Angular clears server errors on edited fields according to its native
semantics. A later successful upload does not acknowledge an earlier failure.
Acknowledge only after the host determines that the failed operation is resolved
or its image is no longer relevant. Concurrent failures and the bounded overflow
summary all block this recipe. Acknowledgement does not change dirty/touched
state. A host may deliberately choose nonblocking upload presentation instead.

There is no native HTML form in this example: before hydration, the button is
inert and Enter cannot navigate or leak draft content into a URL. If embedding
inside an ancestor form, that host must prevent unsafe native submission too.
The registry loads browser tools only after rendering; SSR evaluates neither
Image Tool constructors nor upload requests. The image bridge preserves caption,
metadata and alt's three states: unset, authored description, and decorative
empty string. Upload completion never invents alternative text.

This recipe coordinates editing and submission; it does not certify a complete
blog. The application still owns publication validation for unset alt, safe public
rendering, document migrations, durable storage and production upload security.

## License

Apache-2.0.
