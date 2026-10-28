# @anarchitects/editorjs-tool-list

Typed list configuration, saved-data validation and explicit browser activation
for Editor.js. Share one list definition between direct Editor.js and Angular
hosts without adding Angular or Forms dependencies to this package.

## Installation and compatibility

```sh
npm install @anarchitects/editorjs-tool-list @anarchitects/editorjs-core @editorjs/editorjs@2.31.7
```

This package owns `@editorjs/list` **2.0.9** as an exact dependency and requires
Editor.js **2.31.7** as an application peer. Installing the package also installs the browser-oriented upstream dependency;
root import purity does not mean the dependency is absent from installation.

ESM only. Root declarations support ES2022-only libraries with TypeScript NodeNext
and Bundler resolution. The browser entry requires DOM declarations and Bundler
resolution; upstream's declarations do not support the tested NodeNext browser
path. The verified compiler is TypeScript 6.0.3, minimum Node runtime is 22.12.0,
and browser behavior is covered in Chromium. Other versions and browsers need
independent verification.

## Verified consumer combinations

The same package is exercised independently and alongside the other common tools
with Editor.js **2.31.7** and TypeScript **6.0.3**. Angular consumers cover:

| Angular | Consumer Node |
| ------- | ------------- |
| 22.0.0  | 22.22.3       |
| 22.1.4  | 24.15.0       |
| 22.2.2  | 26.0.0        |

These exact combinations cover standalone Angular, optional native Signal Forms,
SSR/hydration and lazy authoring-route delivery in Chromium. They do not certify
every version allowed by an engine or peer range. Install only the tools your
application needs; each tool works with core and Editor.js without the other four
packages or Angular. Browser entries install global styles that can remain after
an editor is removed. Keep browser imports behind the authoring boundary, including
when preloading routes; a lazy definition alone cannot prevent eager host imports.

## Direct browser quick start

Create an attached `<div id="editor"></div>` and load this module with a browser
bundler. New lists start unordered, with up to three nesting levels. Editor.js's
built-in paragraph remains available.

<!-- list-example-file: list-editor.ts -->

```ts
import EditorJS from '@editorjs/editorjs';
import {
  composeToolRegistry,
  createToolMap,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
} from '@anarchitects/editorjs-core';
import { defineListTool } from '@anarchitects/editorjs-tool-list';
import { ListTool } from '@anarchitects/editorjs-tool-list/browser';

export function createListEditor(holder: HTMLElement): EditorJS {
  const list = defineListTool({
    source: 'eager',
    registration: {
      class: ListTool,
      config: {
        defaultStyle: 'unordered',
        maxLevel: 3,
        counterTypes: ['numeric', 'upper-roman'],
      },
      inlineToolbar: ['bold', 'italic', 'link'],
    },
  });
  const registry = composeToolRegistry([[list]], {
    profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
  });
  return new EditorJS({
    holder,
    tools: createToolMap(registry, { defaultBlock: 'list' }),
    defaultBlock: 'list',
  });
}
```

Call `createListEditor(holder)` and await `isReady` before `save()`. Handle
readiness and command rejections in the host UI. Keep the holder attached during
initialization; its owner calls `destroy()` after readiness on removal. For removal
during pending initialization, use core's
[direct browser ownership recipe](https://github.com/anarchitects/anarchitecture-community/tree/main/packages/editorjs/core#direct-browser-integration).
Do not evaluate this eager example during SSR.

## Lazy definitions and standalone Angular

The root helper is inert: it never imports or constructs the browser class. The
caller supplies a loader and the owner decides when to resolve it.

<!-- list-example-file: list-definition.ts -->

```ts
import { defineListTool } from '@anarchitects/editorjs-tool-list';

export const list = defineListTool({
  source: 'lazy',
  load: () =>
    import('@anarchitects/editorjs-tool-list/browser').then(
      ({ ListTool }) => ListTool,
    ),
  settings: {
    config: {
      defaultStyle: 'unordered',
      maxLevel: 3,
      counterTypes: ['numeric', 'upper-roman'],
    },
    inlineToolbar: ['bold', 'italic', 'link'],
  },
});
```

For direct lazy use, compose the definition with the core profile and create one
`createToolResolver(registry, { defaultBlock: 'list' })` per editor owner. Await
`resolve()` and pass the resulting map and matching `defaultBlock` to Editor.js.
Dispose the resolver on removal. A failed attempt rejects with `load-failed`;
an explicit subsequent `resolve()` retries. Disposal prevents stale activation,
but does not cancel downloaded code or remove global styles.

For Angular, additionally install `@anarchitects/editorjs-angular` and its Angular
22 peers. Reuse the same definition with the existing environment provider:

<!-- list-angular-example-file: list-app.ts -->

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { EditorJs, provideEditorJsTools } from '@anarchitects/editorjs-angular';
import { list } from './list-definition';

@Component({
  selector: 'app-root',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 id="editor-label">Article lists</h1>
    <aa-editorjs aria-labelledby="editor-label" [config]="config" />
  `,
})
export class ListEditor {
  readonly config = { defaultBlock: 'list' };
}

bootstrapApplication(ListEditor, {
  providers: [provideEditorJsTools([list])],
}).catch(console.error);
```

The host HTML needs `<app-root></app-root>`. The wrapper owns editor lifetime.
Leave `config.tools` absent to use the provider; an explicit map, including `{}`,
takes full precedence. No list-specific provider is needed. Optional native
Signal Forms uses this same registry with `EditorJsControl` from
`@anarchitects/editorjs-angular/forms` and `[formField]`. Install Forms only for
that integration; this package adds no form state or custom control.

## Configuration and naming

| Setting                                     | Behavior                                                                                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defaultStyle?: ListStyle`                  | `ordered`, `unordered` or `checklist`; omitted means unordered for new blocks. Saved `style` takes precedence.                                                                                      |
| `maxLevel?: number`                         | Positive integer; `1` disables keyboard nesting. Omitted means no configured nesting limit. This controls editing, not saved-data validation.                                                       |
| `counterTypes?: readonly ListCounterType[]` | Nonempty unique subset of `numeric`, `upper-roman`, `lower-roman`, `upper-alpha`, `lower-alpha`. Omitted shows all counter choices. Filters the menu, not persisted values or initial counter type. |

`defineListTool` validates config synchronously and throws `TypeError` for unknown
keys, accessor properties or invalid values. It preserves config and nested array
identity, copies settings containers and does not fill defaults or freeze objects.
Treat configuration as immutable for the lifetime of an editor. Upstream keeps
numeric counter order and only displays the counter submenu when more than one
choice remains; one allowed counter does not set the initial counter.

The default name is `list` and kind is `block`. The core Editor.js profile has no
built-in list. Aliases retain their literal types; use the same alias in saved
blocks, validator maps and the resolver/editor `defaultBlock` if selected as the
default. Adding a definition does not change the built-in paragraph default.
Duplicate names need explicit same-kind `replace: true`; replacement replaces the
whole definition. Core owns selection, toolbar/tune references and conflicts.

Use Tab to nest and Shift+Tab to unnest. The block settings select unordered,
ordered and checklist modes. Ordered settings offer a start counter and allowed
counter styles. Mode changes can reset style-specific metadata; save the result
rather than assuming checklist state survives conversion. `maxLevel` does not
flatten pre-existing deep data, and counter settings do not migrate saved values.

## Saved format and validation

Only the **2.0.9 nested generation** is supported. `ListData` is a discriminated
union by `style`; `ListData<'checklist'>` and `ListItem<'checklist'>` require checked
item metadata. Every root requires `style`, a `meta` object and `items` array.
Every item requires string `content`, a `meta` object and recursive `items` array.
Children inherit the root style; they have no independent mode.

- Unordered metadata may be empty.
- Ordered root/item metadata permits optional positive integer `start` and a
  supported `counterType`. Missing values are not filled by validation; upstream
  counter rendering defaults to 1 and numeric.
- Checklist items require boolean `meta.checked`, including nested items. The
  checklist root requires `meta: {}` but does **not** require `checked`.

For example, valid current saved data is:

```json
{
  "style": "checklist",
  "meta": {},
  "items": [
    {
      "content": "Draft",
      "meta": { "checked": true },
      "items": [
        { "content": "Review", "meta": { "checked": false }, "items": [] }
      ]
    }
  ]
}
```

Additional JSON properties are accepted at root, item and metadata boundaries.
Known fields are checked for their applicable style. Empty arrays/content are
structurally valid. Upstream 2.0.9 cannot initialize a persisted list whose root
`items` is empty: it throws during legacy-format detection. A host starting an
empty editor should omit that block (or initialize a new block without saved data).
Structural validity alone does not guarantee upstream editability.
Upstream save/render may discard unknown fields or inactive
metadata; structural acceptance does not promise editing round-trip preservation.
Inline HTML is allowed in content; this validator does not sanitize HTML.

<!-- list-example-file: list-validation.ts -->

```ts
import { validateOutputData } from '@anarchitects/editorjs-core';
import { validateListData } from '@anarchitects/editorjs-tool-list';

export function validateArticle(input: unknown) {
  return validateOutputData(input, {
    toolValidators: new Map([['list', validateListData]]),
    unknownTools: 'reject',
  });
}
```

This example accepts documents containing only the named tool. For a mixed
document, supply a validator for every permitted saved block name, including
Editor.js's built-in paragraph if it remains available. Registering a tool does
not automatically register its validator. Unknown tools are rejected deliberately;
installing all common-tool packages is not required.

Definitions do not install validators automatically. Map the configured alias.
`validateListData(unknown)` returns core's synchronous `ToolValidationResult` with
paths relative to data, such as `['items', 0, 'items', 1, 'meta', 'checked']`.
It reuses core's bounded JSON inspection and rejects cycles, accessors, unreadable
objects, excessive JSON depth and non-JSON extensions without mutating data.
The JSON-depth bound is independent of the editor's `maxLevel` setting.

### Legacy data and migration

Flat `items: ['text']`, old checklist items `{text, checked}`, and nested records
missing required metadata are rejected. No converter is exported. The raw upstream
constructor accepts and normalizes older shapes; importing `/browser` does not
turn it into a migration gate. Hosts must identify stored generations, explicitly
migrate outside this package, and validate **before** passing persisted content to
Editor.js. Omitted data for a new block is upstream initialization, not validation
of a saved document. Do not infer the tool generation from Editor.js's document
`version` field: record provenance in your host's storage contract.

Hosts own persistence, migration, application-specific depth/counter rules and
safe public HTML rendering. Validation is neither sanitization nor an accessibility
certificate. The browser class omits only undefined optional ordered `start`/`counterType`
properties from upstream save output, making new ordered lists JSON-compatible.
It does not fill defaults, remove unknown values or change the strict validator.
Chosen counters remain unchanged. Raw `@editorjs/list` save results can contain
those undefined fields; use `ListTool` for the documented core/Angular path.

## Exports, ownership and troubleshooting

- Root: `defineListTool`, `validateListData`, `ListConfig`, `ListData`, `ListItem`,
  `ListStyle`, `ListCounterType`, `ListToolOptions`. No DOM, Editor.js or Angular
  declaration/runtime imports.
- `/browser`: `ListTool`, a thin subclass of the upstream constructor. Evaluation injects global CSS;
  there is no separate stylesheet or guaranteed style removal on disposal.
- `/package.json`: public package metadata.

Read-only mode disables content editing and checklist toggling. Browser owners
must await readiness, handle errors and destroy their own editors. SSR imports
only roots and inert definitions. Strict CSP, shadow roots, alternate documents,
other browsers and comprehensive accessibility need separate verification.

For rejected legacy data, perform explicit migration before mounting. For a missing
counter menu, check the number of allowed choices. For ignored Angular definitions,
check provider visibility and overriding `config.tools`. For duplicate tool names,
rename or explicitly replace. Use Bundler resolution for browser declarations;
the pure root also supports NodeNext. A readonly config accepted by the definition
may not match the raw constructor's mutable array type; use the documented map
composition. Retry failed lazy loading through a subsequent direct resolver call
or a new Angular owner. Remount to change tools/configuration after initialization.

Report reproducible problems with exact versions through
[GitHub issues](https://github.com/anarchitects/anarchitecture-community/issues).
This package is Apache-2.0; upstream list is MIT-licensed.
