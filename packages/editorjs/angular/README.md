# @anarchitects/editorjs-angular

Typed Angular integration contracts and a lazy Editor.js loader using
`@anarchitects/editorjs-core` document and tool contracts.

This version supplies configuration, event and control interfaces, plus an
injectable loader. Core owns the shared control/event contracts and generic data
implementation; this package adapts them to Angular and browser holders. It does **not** supply an editor component or implement the
control facade. There is no `<aa-editorjs>` component to import yet. The lifecycle
rules below specify the contract for owner implementations; importing interfaces
does not implement those rules for a custom integration.

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
contract and packaging compatibility, not full browser editor, forms or hydration
support across the peer range. No CommonJS build is supplied. Nx is not a consumer
dependency. Angular peers are evaluated normally; Editor.js is loaded only when
the default loader is called on the browser platform.

## Quick start: typed configuration and documents

Create `editor-settings.ts` in your Angular application:

```ts
import type { EditorJsConfig } from '@anarchitects/editorjs-angular';
import type { OutputData } from '@anarchitects/editorjs-core';

export const editorConfig = {
  placeholder: 'Write something…',
  minHeight: 120,
  readOnly: false,
} satisfies EditorJsConfig;

export const initialDocument: OutputData = {
  blocks: [{ type: 'paragraph', data: { text: 'Welcome' } }],
};
```

Run your application's normal build. These values compile without initializing
an editor. There are no required providers for defining types. A working editor
view requires a browser owner implementation; this package does not render one.

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

## Owner lifecycle contract

These are the semantics specified by the public interfaces for an editor owner.
The loader itself only loads code and creates raw instances; it does not implement
input observation, queuing, outputs or cleanup. Initial data normalization is
delegated to core by the default factory.

| Surface  | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config` | Snapshot the latest observed value when browser initialization begins. Omitted settings keep Editor.js defaults. Later identity changes report `config-changed` and leave the active editor intact; recreate the owner to reconfigure tools/options. In-place mutations are unsupported.                                                                                                                                                                           |
| `data`   | Separate immutable inbound `OutputData`. Missing data means `{ blocks: [] }`. Before creation, use the latest observed document. After creation, new input references request serialized replacement; clearing the input requests an empty document. Validate structure and copy document data before giving it to Editor.js. Invalid data reports `invalid-data` without replacing current content. Tool-specific failures are reported by the failing operation. |
| `ready`  | `EditorJsReadyEvent` once per live owner, after `isReady` resolves. Its `api` is the owner's facade, never the raw instance.                                                                                                                                                                                                                                                                                                                                       |
| `change` | `EditorJsChangeEvent` contains saved `data` and an increasing owner-local `sequence`. It represents editor-originated notifications, which are not proof of a physical user gesture. Input replacement, `render` and `clear` must not emit feedback changes.                                                                                                                                                                                                       |
| `error`  | `EditorJsErrorEvent` identifies the operation, code and original `cause`. Initialization/input/automatic-save errors are emitted. Imperative failures reject their promises and emit the same failure while the owner is live. Nothing emits after destruction.                                                                                                                                                                                                    |

Observe input values by identity; Angular signal stabilization can coalesce input
writes before observation. Once accepted, document replacements and imperative
operations run in one ordered queue. Calls before readiness reject with
`not-ready`, and calls or pending work invalidated by destruction reject with
`destroyed`. A failed operation must not poison the remaining queue. There is no
automatic recreation, migration or retry.

Editor notifications schedule serialized saves and may coalesce while a save is
pending. Discard a save result superseded by a newer notification or accepted
document replacement, then save the latest content as needed. Never publish an
older snapshot after a newer one. Sequence gaps are allowed. Destruction prevents
late outputs, cancels unstarted work and disposes an already-created instance
after its readiness settles; library promises cannot cancel an upstream import
or initialization already in flight.

`EditorJsApi<Block>` specifies `save()`, `render(data)`, `clear()`, `focus(atEnd?)`
and `setReadOnly(boolean)`, all returning promises. Focus and read-only return the
upstream boolean result. The initial read-only setting is `config.readOnly`;
subsequent toggles go through the facade. The facade has no public `destroy()`:
the owner alone controls lifetime. These contracts do not imply two-way binding,
dirty/touched state or an Angular Forms control.

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

- Runtime exports: `EDITOR_JS_LOADER`, `provideEditorJsLoader`.
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

| Symptom                                       | Action                                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| No editor component export                    | This version provides contracts and loading only; it does not supply a view or facade implementation.                             |
| Upstream `EditorConfig` is rejected           | Remove holder/data/callback options and define a fresh `EditorJsConfig`; supply data and observe events separately in your owner. |
| Loader rejects on the server                  | Invoke it only from browser initialization after rendering. Do not initialize editors from server requests.                       |
| Tool fails during creation or rendering       | Check its Editor.js compatibility and tool-specific input/configuration; core type compatibility is not runtime validation.       |
| Configuration change is rejected              | Recreate the owner for new tools/options; use document replacement and read-only controls for their specific operations.          |
| Angular peer mismatch                         | Use matching Angular 22 core/common versions and their supported tooling.                                                         |
| Private subpath or source file cannot resolve | Import the package root and remove repository-only `@anarchitecture-community/source` resolution conditions.                      |

Report reproducible problems with package, Angular, Editor.js and Node versions
through the [issue tracker](https://github.com/anarchitects/anarchitecture-community/issues).
Contributor details are in the
[development guide](https://github.com/anarchitects/anarchitecture-community/blob/main/docs/editorjs-angular-development.md).

## License

Apache-2.0.
