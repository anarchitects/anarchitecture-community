# @anarchitects/editorjs-angular

Standalone Angular editor component for Editor.js, built on
`@anarchitects/editorjs-core` document normalization and shared contracts.

Import `EditorJs` to render `<aa-editorjs>` with initial configuration/data and
readiness, saved-change and error outputs. Each component owns its holder and editor
instance. Replace the `data` input to load another document; configuration remains
initialization-only. The component exposes an instance-scoped `api` for imperative
controls. Angular Forms integration is not available in this version.

## Installation and prerequisites

In an existing Angular application, install the published packages:

```sh
npm install @anarchitects/editorjs-angular @anarchitects/editorjs-core @editorjs/editorjs@2.31.7
```

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
matrix. They cover standalone, zoneless editing, saved changes, imperative controls
and teardown. Forms and full SSR/hydration are not supported features here. No
CommonJS build is supplied. Nx is not a consumer dependency. Angular peers are
evaluated normally; Editor.js is loaded only during browser initialization.

## Quick start

Import the standalone component in an existing Angular 22 application:

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
an empty holder and does not invoke even a custom loader. This baseline does not
claim full SSR/hydration support or install application hydration providers.

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
If a replacement or its baseline save fails, the next successful snapshot is used
silently to re-establish the baseline; it may include edits made during recovery.
Those edits are not emitted separately. Reapply a valid document or recreate the
component when recovery must preserve a known document. Ordinary automatic-save
failures do not require a new baseline; the next notification can produce a change.

Feeding saved output back into `data` requests a replacement and can reset selection;
it is not necessary for normal editing. No two-way form model, persistence, dirty
or touched state is maintained. Use the imperative API when you need an awaited
operation or an explicit save rather than automatic saved-change events.

## Configuration and custom tools

`EditorJsConfig<Tools>` accepts upstream Editor.js configuration except `holder`,
deprecated `holderId`, `data`, `onReady` and `onChange`. Those fields are forbidden,
including when passing an already-typed upstream configuration object. Data is a
separate inbound value. Readiness and changes are separate outbound events.

`tools` uses core `ToolRegistration` / `ToolConfiguration`, preserving consumer
tool constructor, configuration and toolbox-data types. For example, given your
own Editor.js-compatible tool:

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
`save()` returns its own operation's snapshot even if newer edits or replacements
arrive meanwhile; the stale-result suppression policy applies to automatic
`change` outputs. Callers decide what to do with an explicitly requested snapshot.

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
Failed mode transitions use the same silent recovery-baseline policy described
for failed replacements above.

Imperative failures reject with `EditorJsOperationError`, an `Error` carrying
`operation`, `code` and original `cause`. While the component is live, the same
object is emitted through `error`. Always await/catch returned promises, even if
you also listen to `error`; the output does not handle the caller's rejection.
Removing the component rejects active and queued calls immediately with `destroyed`,
drops unstarted work and suppresses late outputs. Already-running upstream work
cannot be cancelled. The facade has no public `destroy()` and cannot control
another component's instance; a retained old facade remains disposed after remount.

## Errors and accessibility

Use error codes for control flow; `cause` preserves the upstream error or core data
diagnostic. Error messages are explanatory, not stable identifiers.

| Code               | Meaning and response                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `not-ready`        | Await the live component's `ready` notification before issuing controls.                                                                  |
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
import { provideEditorJsLoader } from '@anarchitects/editorjs-angular';
import type { EditorJsLoader } from '@anarchitects/editorjs-angular';

export function configureEditor(loader: EditorJsLoader): ApplicationConfig {
  return { providers: [provideEditorJsLoader(loader)] };
}
```

A replacement loader may cache code, but must not cache instances, holders or
documents. Each factory call must create a distinct instance. It must reuse core normalization for detached initial data, preserve
owned option precedence and propagate load/creation/readiness failures. Child
environment overrides affect their descendants; application-wide providers store
only loading behavior. Component-level test overrides can provide the token
directly using `useValue`. Custom loaders must enforce their own platform safety.

## Public surface and ownership

Use only `@anarchitects/editorjs-angular` or its `package.json` subpath.

- Runtime exports: `EditorJs`, `EDITOR_JS_LOADER`, `provideEditorJsLoader`,
  `EditorJsOperationError` (re-exported from core).
- Configuration types: `EditorJsConfig`, `EditorJsTools`.
- Event/control types (re-exported from core): `EditorJsApi`, `EditorJsReadyEvent`, `EditorJsChangeEvent`,
  `EditorJsErrorEvent`, `EditorJsOperation`.
- Loading types: `EditorJsLoader`, `EditorJsFactory`, `EditorJsCreateOptions`,
  `EditorJsInstance`.

Import document, tool and upload types directly from `@anarchitects/editorjs-core`.
Applications own persistence records, storage mappings, migrations, transports,
tool selection and rendering safety. No tool registry, uploader, forms dependency
or application model is supplied. Server-safe loading does not establish full
SSR/hydration support. Editor.js remains an application-owned peer dependency.

Core implements document normalization, the shared operation queue, change coalescing
and disposal guards. Angular adds signal inputs/outputs, dependency injection,
browser loading and component/holder ownership. Non-Angular integrations can use
`EditorJsDocumentCoordinator` and its non-DOM driver directly from core; they provide
their own readiness, editor creation and destruction. See the
[core package documentation](https://github.com/anarchitects/anarchitecture-community/tree/main/packages/editorjs/core#readme).

| Need                             | Consumer responsibility / current boundary                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Angular Forms                    | No CVA or Signal Forms control is supplied.                                                         |
| SSR/hydration                    | Import and empty server-holder safety only; no full hydration guarantee or hydration providers.     |
| Tool registry and concrete tools | Supply compatible tools and their schemas; no registry or tool bundle is included.                  |
| Uploads                          | Supply transport, credentials and application policy; core upload contracts do not perform uploads. |
| Persistence                      | Decide storage records, validation, migrations and save policy; `change` is not durable storage.    |

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
| Angular peer mismatch                                           | Use matching Angular 22 core/common versions and their supported tooling.                                                         |
| Private subpath or source file cannot resolve                   | Import the package root and remove repository-only `@anarchitecture-community/source` resolution conditions.                      |

Report reproducible problems with package, Angular, Editor.js and Node versions
through the [issue tracker](https://github.com/anarchitects/anarchitecture-community/issues).
Contributor details are in the
[development guide](https://github.com/anarchitects/anarchitecture-community/blob/main/docs/editorjs-angular-development.md).

## License

Apache-2.0.
