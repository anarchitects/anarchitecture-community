# @anarchitects/editorjs-tool-paragraph

Typed paragraph configuration, saved-data validation and explicit browser activation
for Editor.js. Use this package when you want a pinned paragraph implementation
and a reusable definition shared by direct Editor.js and Angular hosts.
Editor.js already includes a paragraph: installing this package does not replace it.

## Installation and compatibility

```sh
npm install @anarchitects/editorjs-tool-paragraph @anarchitects/editorjs-core @editorjs/editorjs@2.31.7
```

The package owns `@editorjs/paragraph` **2.11.7** as an exact dependency and requires
Editor.js **2.31.7** as an application peer. No Angular or Forms dependency is
required. ESM only. The pure root supports ES2022 and TypeScript NodeNext/Bundler
resolution; the browser entry requires DOM declarations and **Bundler** resolution.
Upstream browser declarations do not currently support the tested NodeNext path.
Use TypeScript 6.0.3 for the verified consumer baseline. The Node engine is
`>=22.12.0`; browser behavior is verified in Chromium, not every browser.

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

Create an attached `<div id="editor"></div>` in your page, then use the following
module in your browser bundle. The placeholder is visible for an empty paragraph;
`preserveBlank: true` keeps blank paragraphs in saved output.

<!-- paragraph-example-file: paragraph-editor.ts -->

```ts
import EditorJS from '@editorjs/editorjs';
import {
  composeToolRegistry,
  createToolMap,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
} from '@anarchitects/editorjs-core';
import { defineParagraphTool } from '@anarchitects/editorjs-tool-paragraph';
import { ParagraphTool } from '@anarchitects/editorjs-tool-paragraph/browser';

export function createParagraphEditor(holder: HTMLElement): EditorJS {
  const paragraph = defineParagraphTool({
    source: 'eager',
    replace: true,
    registration: {
      class: ParagraphTool,
      config: { placeholder: 'Write your article…', preserveBlank: true },
      inlineToolbar: ['bold', 'italic', 'link'],
    },
  });
  const registry = composeToolRegistry([[paragraph]], {
    profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
  });
  return new EditorJS({ holder, tools: createToolMap(registry) });
}
```

Call `createParagraphEditor(holder)`, await its `isReady`, then use `save()` to
obtain Editor.js JSON. Observe readiness and operation rejections in your UI.
Keep the holder attached during initialization; the owner calls `destroy()` after
readiness when removing the editor. For removal during pending initialization,
use the core package's
[direct browser ownership recipe](https://github.com/anarchitects/anarchitecture-community/tree/main/packages/editorjs/core#direct-browser-integration).
Do not import this eager example during SSR.

## Lazy definitions and Angular

The root helper never imports or constructs the browser class. The caller supplies
the loader and the host decides when to resolve it.

<!-- paragraph-example-file: paragraph-definition.ts -->

```ts
import { defineParagraphTool } from '@anarchitects/editorjs-tool-paragraph';

export const paragraph = defineParagraphTool({
  source: 'lazy',
  replace: true,
  load: () =>
    import('@anarchitects/editorjs-tool-paragraph/browser').then(
      ({ ParagraphTool }) => ParagraphTool,
    ),
  settings: {
    config: { placeholder: 'Write your article…', preserveBlank: true },
    inlineToolbar: ['bold', 'italic', 'link'],
  },
});
```

For a direct lazy host, compose this definition with the same core profile, create
one `createToolResolver(registry)` per editor owner, and pass the awaited map to
Editor.js. Dispose the resolver when its owner ends. A failed resolution rejects
with core's `load-failed`; an explicit subsequent `resolve()` retries the attempt.
Disposal rejects pending/future resolution and prevents stale activation; it does
not cancel a downloaded module or remove its styles.

For Angular, additionally install `@anarchitects/editorjs-angular` with its required
Angular 22 peers. Reuse the definition above and existing environment provider:

<!-- paragraph-angular-example-file: paragraph-app.ts -->

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { EditorJs, provideEditorJsTools } from '@anarchitects/editorjs-angular';
import { paragraph } from './paragraph-definition';

@Component({
  selector: 'app-root',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 id="article-heading">Article body</h1>
    <aa-editorjs aria-labelledby="article-heading" />
  `,
})
export class ArticleEditor {}

bootstrapApplication(ArticleEditor, {
  providers: [provideEditorJsTools([paragraph])],
}).catch(console.error);
```

The host HTML needs `<app-root></app-root>`. The wrapper owns initialization and
disposal. Leave `config.tools` absent to use the provider; an explicit tools map,
including `{}`, takes full precedence. No paragraph-specific provider is needed.
For optional native Signal Forms, use the same provider with `EditorJsControl`
from `@anarchitects/editorjs-angular/forms` and `[formField]`; install Forms only
for that integration. Paragraph adds no separate form state or control.

## Configuration and replacement

| Setting                   | Default when absent                  | Meaning                                      |
| ------------------------- | ------------------------------------ | -------------------------------------------- |
| `placeholder?: string`    | Upstream/editor placeholder behavior | Hint for an empty paragraph; not saved text. |
| `preserveBlank?: boolean` | `false`                              | Retain blank paragraphs when saving.         |

`defineParagraphTool` accepts core's eager registration or lazy loader/settings
shape, with optional `name` (default `paragraph`) and explicit `replace: true`.
It preserves literal names, constructor types and the config object's identity.
It validates config without filling defaults; unsupported keys, wrong types and
accessor properties throw `TypeError`. Treat configuration as immutable during an
editor lifetime. Toolbar/tune/toolbox behavior and reference validation remain
core/Editor.js responsibilities.

With the Editor.js profile, `paragraph` conflicts with its built-in unless you
explicitly set `replace: true`. Alternatively use a distinct name such as `body`,
and set **both** Editor.js `defaultBlock` and the core resolver's reference context
to `body`. Omitting this package leaves the built-in unchanged. Replacements replace
the entire definition, including config; settings are not deep-merged.

## Saved data and structural validation

`ParagraphData` requires `text: string` and permits additional JSON properties.
Empty text is structurally valid regardless of upstream's save-time blank omission.
The tool may save inline HTML and may discard unknown data fields on editing;
validation does not promise upstream round-trip preservation of extensions.

<!-- paragraph-example-file: paragraph-validation.ts -->

```ts
import { validateOutputData } from '@anarchitects/editorjs-core';
import { validateParagraphData } from '@anarchitects/editorjs-tool-paragraph';

export function validateArticle(input: unknown) {
  return validateOutputData(input, {
    toolValidators: new Map([['paragraph', validateParagraphData]]),
    unknownTools: 'reject',
  });
}
```

This example accepts documents containing only the named tool. For a mixed
document, supply a validator for every permitted saved block name, including
Editor.js's built-in paragraph if it remains available. Registering a tool does
not automatically register its validator. Unknown tools are rejected deliberately;
installing all common-tool packages is not required.

Use the configured alias as the map key if you renamed the tool. Definitions do
not register validators automatically. `validateParagraphData(unknown)` also works
alone and returns core's synchronous `ToolValidationResult`, with paths relative
to the data object. It uses core's bounded JSON inspection, rejects cycles,
accessors and non-JSON extensions without invoking getters, and does not mutate
input. Successful validation is neither HTML sanitization nor persistence migration.
The host owns safe public rendering and storage.

## Exports, behavior and troubleshooting

- Root: `defineParagraphTool`, `validateParagraphData`, `ParagraphConfig`,
  `ParagraphData`, `ParagraphToolOptions`. Runtime and declarations are DOM-free.
- `/browser`: `ParagraphTool`, a thin subclass that supplies an empty config when
  Editor.js omits it; rendering, saving and static capabilities remain upstream-owned. Evaluation
  injects global CSS; there is no separate stylesheet or cleanup guarantee.
- `/package.json`: public package metadata.

Use only the root during SSR; leave browser loaders inert until a browser holder
exists. The upstream read-only mode renders paragraph content without an editable
surface. Empty-content saving depends on `preserveBlank`, and inline HTML still
depends on Editor.js sanitization policy. Strict CSP, shadow roots, alternate
documents and comprehensive accessibility are not certified by this integration.

For duplicate-name errors, opt into explicit replacement or rename the tool.
For a NodeNext browser declaration error, use Bundler resolution for browser code;
the DOM-free root supports NodeNext independently. If an Angular paragraph looks
unchanged, check for overriding `config.tools` and confirm the provider is visible
to that editor. For failed lazy downloads, handle the error and explicitly recreate
the Angular editor owner or retry the direct resolver.

Report reproducible issues with exact package/runtime versions through
[GitHub issues](https://github.com/anarchitects/anarchitecture-community/issues).
This package is Apache-2.0; its upstream paragraph dependency is MIT-licensed.
