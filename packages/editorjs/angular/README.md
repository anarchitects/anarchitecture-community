# @anarchitects/editorjs-angular

Standalone Angular editor component for Editor.js, built on
`@anarchitects/editorjs-core` document normalization and shared contracts.

Import `EditorJs` to render `<aa-editorjs>` with initial configuration/data and
readiness/error outputs. Each component owns its holder and editor instance.
This version supports initialization, editing and teardown. It does not yet
publish saved change events, apply data/configuration changes after creation,
provide imperative controls or integrate with Angular Forms. Recreate the component
to supply a different document or configuration.

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
| Node.js tooling                 | `^22.22.3` or `^24.15.0` or `>=26.0.0`     |
| Package format                  | ESM, Angular Package Format, ES2022 output |

The package is checked with Angular 22.1.4 and TypeScript 6.0.3. This establishes
the tested component and packaging baseline, not forms or full hydration support
across every version in the peer range. No CommonJS build is supplied. Nx is not a consumer
dependency. Angular peers are evaluated normally; Editor.js is loaded only when
the default loader is called on the browser platform.

## Quick start

Import the standalone component in an existing Angular 22 application:

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { EditorJs } from '@anarchitects/editorjs-angular';
import type {
  EditorJsConfig,
  EditorJsErrorEvent,
} from '@anarchitects/editorjs-angular';
import type { OutputData } from '@anarchitects/editorjs-core';

@Component({
  selector: 'app-article-editor',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p role="status">{{ status() }}</p>
    <aa-editorjs
      [config]="config"
      [data]="document"
      (ready)="status.set('Ready')"
      (error)="onError($event)"
    />
  `,
})
export class ArticleEditor {
  readonly status = signal('Loading editor');
  readonly config: EditorJsConfig = {
    placeholder: 'Write something…',
    minHeight: 120,
  };
  readonly document: OutputData = {
    blocks: [{ type: 'paragraph', data: { text: 'Welcome' } }],
  };
  onError(event: EditorJsErrorEvent): void {
    this.status.set('Editor could not start');
    console.error(event.operation, event.cause);
  }
}
```

Render `<app-article-editor>` through your application's normal route or parent
component. After loading, the status becomes “Ready” and the paragraph can be
edited. No forms or loader providers are required. Editor.js supplies its built-in
paragraph tool; additional tools remain your choice. This version does not expose
saving edited content yet.

## Component inputs, outputs and lifetime

| Surface  | Current behavior                                                                                                                                                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config` | Optional `EditorJsConfig`. Captured when browser initialization begins. Missing settings retain Editor.js defaults. Later changes do not reconfigure the instance.                                                                                                                     |
| `data`   | Optional core `OutputData`. Uses the latest value when loading finishes, immediately before creation. Omitted data means an empty document. Core normalization validates JSON structure and detaches the input before passing it to the factory. Later changes do not replace content. |
| `ready`  | Readiness-only `EditorJsReadyEvent` (`void`), emitted once after Editor.js resolves `isReady`, only while the component is live. There is no `api` payload.                                                                                                                            |
| `error`  | Core `EditorJsErrorEvent` with `operation`, `code` and original `cause`. This is an Angular component output, not a native DOM error event.                                                                                                                                            |

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
observed. Programmatic updates, saved change events and imperative controls are
not implemented by this component version; the shared control/event interfaces
remain available for other owner implementations.

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

## Shared control contracts

Core's `EditorJsApi<Block>`, `EditorJsChangeEvent<Block>` and error/operation
contracts are re-exported for integrations. These are interfaces, not a runtime
controller. They describe serialized operations and ordered saved snapshots;
`EditorJs` does not expose their control/change surface in this version.
Readiness is independent of the control facade and carries no editor reference.

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

- Runtime exports: `EditorJs`, `EDITOR_JS_LOADER`, `provideEditorJsLoader`.
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

Package versions are independent from document schema/tool versions. During `0.x`,
review [release notes](https://github.com/anarchitects/anarchitecture-community/releases)
under `editorjs-angular@<version>` before upgrading.

## Troubleshooting

| Symptom                                          | Action                                                                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Saving or live input updates are unavailable     | This version implements mounting/editing/teardown; controls, saved changes and live input replacement are not available.          |
| Upstream `EditorConfig` is rejected              | Remove holder/data/callback options and define a fresh `EditorJsConfig`; supply data and observe events separately in your owner. |
| Loader rejects on the server                     | Invoke it only from browser initialization after rendering. Do not initialize editors from server requests.                       |
| Tool fails during creation or rendering          | Check its Editor.js compatibility and tool-specific input/configuration; core type compatibility is not runtime validation.       |
| Configuration or document changes have no effect | Recreate the component with new inputs; this version has no live reconfiguration or imperative controls.                          |
| Angular peer mismatch                            | Use matching Angular 22 core/common versions and their supported tooling.                                                         |
| Private subpath or source file cannot resolve    | Import the package root and remove repository-only `@anarchitecture-community/source` resolution conditions.                      |

Report reproducible problems with package, Angular, Editor.js and Node versions
through the [issue tracker](https://github.com/anarchitects/anarchitecture-community/issues).
Contributor details are in the
[development guide](https://github.com/anarchitects/anarchitecture-community/blob/main/docs/editorjs-angular-development.md).

## License

Apache-2.0.
