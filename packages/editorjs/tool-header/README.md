# @anarchitects/editorjs-tool-header

Typed heading configuration, saved-data validation and explicit browser activation
for Editor.js. Share one header definition between direct Editor.js and Angular
hosts without adding Angular or Forms dependencies to this package.

## Installation and compatibility

```sh
npm install @anarchitects/editorjs-tool-header @anarchitects/editorjs-core @editorjs/editorjs@2.31.7
```

This package owns `@editorjs/header` **2.8.9** as an exact dependency and requires
Editor.js **2.31.7** as an application peer. Upstream header also depends on
Editor.js: pure root imports do not mean installation excludes Editor.js.

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
bundler. New headings start at level 2 and offer levels 2 and 3. Editor.js's
built-in paragraph remains available.

<!-- header-example-file: header-editor.ts -->

```ts
import EditorJS from '@editorjs/editorjs';
import {
  composeToolRegistry,
  createToolMap,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
} from '@anarchitects/editorjs-core';
import { defineHeaderTool } from '@anarchitects/editorjs-tool-header';
import { HeaderTool } from '@anarchitects/editorjs-tool-header/browser';

export function createHeadingEditor(holder: HTMLElement): EditorJS {
  const header = defineHeaderTool({
    source: 'eager',
    registration: {
      class: HeaderTool,
      config: { placeholder: 'Section title', levels: [2, 3], defaultLevel: 2 },
      inlineToolbar: ['bold', 'italic', 'link'],
      toolbox: { title: 'Section heading' },
    },
  });
  const registry = composeToolRegistry([[header]], {
    profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
  });
  return new EditorJS({
    holder,
    tools: createToolMap(registry, { defaultBlock: 'header' }),
    defaultBlock: 'header',
  });
}
```

Call `createHeadingEditor(holder)` and await `isReady` before `save()`. Handle
readiness and command rejections in the host UI. Keep the holder attached during
initialization; its owner calls `destroy()` after readiness on removal. For removal
during pending initialization, use core's
[direct browser ownership recipe](https://github.com/anarchitects/anarchitecture-community/tree/main/packages/editorjs/core#direct-browser-integration).
Do not evaluate this eager example during SSR.

## Lazy definitions and standalone Angular

The root helper is inert: it never imports or constructs the browser class. The
caller supplies a loader and the owner decides when to resolve it.

<!-- header-example-file: header-definition.ts -->

```ts
import { defineHeaderTool } from '@anarchitects/editorjs-tool-header';

export const header = defineHeaderTool({
  source: 'lazy',
  load: () =>
    import('@anarchitects/editorjs-tool-header/browser').then(
      ({ HeaderTool }) => HeaderTool,
    ),
  settings: {
    config: { placeholder: 'Section title', levels: [2, 3], defaultLevel: 2 },
    inlineToolbar: ['bold', 'italic', 'link'],
    toolbox: { title: 'Section heading' },
  },
});
```

For direct lazy use, compose the definition with the core profile and create one
`createToolResolver(registry, { defaultBlock: 'header' })` per editor owner. Await
`resolve()` and pass the resulting map and matching `defaultBlock` to Editor.js.
Dispose the resolver on removal. A failed attempt rejects with `load-failed`;
an explicit subsequent `resolve()` retries. Disposal prevents stale activation,
but does not cancel downloaded code or remove global styles.

For Angular, additionally install `@anarchitects/editorjs-angular` and its Angular
22 peers. Reuse the same definition with the existing environment provider:

<!-- header-angular-example-file: header-app.ts -->

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { EditorJs, provideEditorJsTools } from '@anarchitects/editorjs-angular';
import { header } from './header-definition';

@Component({
  selector: 'app-root',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 id="editor-label">Article headings</h1>
    <aa-editorjs aria-labelledby="editor-label" [config]="config" />
  `,
})
export class HeadingEditor {
  readonly config = { defaultBlock: 'header' };
}

bootstrapApplication(HeadingEditor, {
  providers: [provideEditorJsTools([header])],
}).catch(console.error);
```

The host HTML needs `<app-root></app-root>`. The wrapper owns editor lifetime.
Leave `config.tools` absent to use the provider; an explicit map, including `{}`,
takes full precedence. No header-specific provider is needed. Optional native
Signal Forms uses this same registry with `EditorJsControl` from
`@anarchitects/editorjs-angular/forms` and `[formField]`. Install Forms only for
that integration; this package adds no form state or custom control.

## Configuration, levels and naming

| Setting                            | Behavior                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `placeholder?: string`             | Hint for an empty heading; absent means no tool-specific hint.                                       |
| `levels?: readonly HeadingLevel[]` | Nonempty, unique integers 1–6. Requires an explicit included `defaultLevel`. Omitted allows all six. |
| `defaultLevel?: HeadingLevel`      | Integer 1–6; when both level settings are omitted upstream defaults to 2.                            |

`HeadingLevel` is `1 | 2 | 3 | 4 | 5 | 6`. A singleton such as
`{ levels: [3], defaultLevel: 3 }` is supported. Omitting that explicit default is
rejected because upstream's fallback selects the second available level. Upstream
orders its level UI numerically regardless of the array order.

The helper checks these settings, rejects unknown keys and accessor properties,
and throws `TypeError` synchronously for invalid config. It preserves the config
object and level-array identity without filling defaults or freezing them. Treat
configuration as immutable during an editor lifetime. Core owns toolbar, toolbox,
tune and reference validation; Editor.js owns menu behavior.

Definitions default to name `header` and kind `block`, preserving literal aliases
and constructor inference. The pinned core profile has no built-in header, so
initial registration needs no replacement flag. Duplicate names require explicit
same-kind `replace: true`. Replacement replaces the whole definition rather than
merging config. Core selection controls which custom definitions are active.

For an alias such as `title`, use it in saved blocks, validator maps and both the
resolver reference context and Editor.js `defaultBlock` when making it the default.
Adding header does not change Editor.js's default paragraph automatically. Remount
with a new owner to change tools after initialization.

## Saved data and structural validation

`HeaderData` requires string `text` and `level: HeadingLevel`, with additional JSON
properties allowed. Empty text is structurally valid; upstream omits blank headings
when saving. Inline HTML is permitted structurally. Upstream editing may discard
unknown fields, so this is not an extension round-trip preservation promise.

<!-- header-example-file: header-validation.ts -->

```ts
import { validateOutputData } from '@anarchitects/editorjs-core';
import { validateHeaderData } from '@anarchitects/editorjs-tool-header';

export function validateArticle(input: unknown) {
  return validateOutputData(input, {
    toolValidators: new Map([['header', validateHeaderData]]),
    unknownTools: 'reject',
  });
}
```

This example accepts documents containing only the named tool. For a mixed
document, supply a validator for every permitted saved block name, including
Editor.js's built-in paragraph if it remains available. Registering a tool does
not automatically register its validator. Unknown tools are rejected deliberately;
installing all common-tool packages is not required.

Use the configured alias as the validator key. Definitions do not register validators
automatically. `validateHeaderData(unknown)` also works alone, returning core's
synchronous `ToolValidationResult` with relative error paths. Core's bounded JSON
inspection rejects cycles, accessors and non-JSON extensions without invoking
getters. The validator rejects malformed text and unsupported levels, including
numeric strings, without mutation or coercion. Configuration-specific allowed
levels remain a separate host rule.

Validate persisted content before editing. The raw upstream class normalizes data,
including numeric-string parsing and fallback for unavailable levels; this is not
our validation or migration contract. Validation does not sanitize HTML, establish
an accessible heading hierarchy or make content safe for public rendering. Hosts
own rendering safety, document outline, storage and migrations.

## Exports and troubleshooting

- Root: `defineHeaderTool`, `validateHeaderData`, `HeadingLevel`, `HeaderConfig`,
  `HeaderData`, `HeaderToolOptions`. Runtime and declarations are DOM-free.
- `/browser`: `HeaderTool`, the actual upstream constructor. Evaluation injects
  global CSS; no separate stylesheet or style-disposal guarantee is provided.
- `/package.json`: public package metadata.

Use only the root during SSR and keep loaders inert until a browser holder exists.
Read-only mode renders headings without an editable surface. Strict CSP, shadow
roots, alternate documents and comprehensive accessibility are not certified.

For rejected levels, supply distinct integers 1–6 and an explicit default in the
set. For duplicate-name errors, rename or explicitly replace the block definition.
For missing Angular tools, check provider visibility and overriding `config.tools`.
For browser declaration errors under NodeNext, use Bundler resolution. Handle lazy
failures and retry the direct resolver or recreate the Angular owner. A readonly
config accepted by the helper need not match the raw constructor's narrower mutable
array declaration; compose through the documented definition/map APIs.

Report reproducible issues with exact versions through
[GitHub issues](https://github.com/anarchitects/anarchitecture-community/issues).
This package is Apache-2.0; upstream header is MIT-licensed.
