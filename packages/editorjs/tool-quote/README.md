# @anarchitects/editorjs-tool-quote

Typed quote configuration, saved-data validation and explicit browser activation
for Editor.js. Share one quote definition between direct Editor.js and Angular
hosts without adding Angular or Forms dependencies to this package.

## Installation and compatibility

```sh
npm install @anarchitects/editorjs-tool-quote @anarchitects/editorjs-core @editorjs/editorjs@2.31.7
```

This package owns `@editorjs/quote` **2.7.6** as an exact dependency and requires
Editor.js **2.31.7** as an application peer. Installing the package also installs its browser-oriented upstream dependency;
root import purity does not mean that dependency is absent from installation.

ESM only. Root declarations support ES2022-only libraries with TypeScript NodeNext
and Bundler resolution. The browser entry requires DOM declarations and Bundler
resolution; upstream's declarations do not support the tested NodeNext browser
path. The verified compiler is TypeScript 6.0.3, minimum Node runtime is 22.12.0,
and browser behavior is covered in Chromium. Other versions and browsers need
independent verification.

## Direct browser quick start

Create an attached `<div id="editor"></div>` and load this module with a browser
bundler. With this configuration, new quotes save center alignment and show text
and attribution placeholders. Editor.js's built-in paragraph remains available.

<!-- quote-example-file: quote-editor.ts -->

```ts
import EditorJS from '@editorjs/editorjs';
import {
  composeToolRegistry,
  createToolMap,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
} from '@anarchitects/editorjs-core';
import { defineQuoteTool } from '@anarchitects/editorjs-tool-quote';
import { QuoteTool } from '@anarchitects/editorjs-tool-quote/browser';

export function createQuoteEditor(holder: HTMLElement): EditorJS {
  const quote = defineQuoteTool({
    source: 'eager',
    registration: {
      class: QuoteTool,
      config: {
        quotePlaceholder: 'Quotation',
        captionPlaceholder: 'Attribution',
        defaultAlignment: 'center',
      },
      inlineToolbar: ['bold', 'italic', 'link'],
      toolbox: { title: 'Citation' },
    },
  });
  const registry = composeToolRegistry([[quote]], {
    profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
  });
  return new EditorJS({
    holder,
    tools: createToolMap(registry, { defaultBlock: 'quote' }),
    defaultBlock: 'quote',
  });
}
```

Call `createQuoteEditor(holder)` and await `isReady` before `save()`. Handle
readiness and command rejections in the host UI. Keep the holder attached during
initialization; its owner calls `destroy()` after readiness on removal. For removal
during pending initialization, use core's
[direct browser ownership recipe](https://github.com/anarchitects/anarchitecture-community/tree/main/packages/editorjs/core#direct-browser-integration).
Do not evaluate this eager example during SSR.

## Lazy definitions and standalone Angular

The root helper is inert: it never imports or constructs the browser class. The
caller supplies a loader and the owner decides when to resolve it.

<!-- quote-example-file: quote-definition.ts -->

```ts
import { defineQuoteTool } from '@anarchitects/editorjs-tool-quote';

export const quote = defineQuoteTool({
  source: 'lazy',
  load: () =>
    import('@anarchitects/editorjs-tool-quote/browser').then(
      ({ QuoteTool }) => QuoteTool,
    ),
  settings: {
    config: {
      quotePlaceholder: 'Quotation',
      captionPlaceholder: 'Attribution',
      defaultAlignment: 'center',
    },
    inlineToolbar: ['bold', 'italic', 'link'],
    toolbox: { title: 'Citation' },
  },
});
```

For direct lazy use, compose the definition with the core profile and create one
`createToolResolver(registry, { defaultBlock: 'quote' })` per editor owner. Await
`resolve()` and pass the resulting map and matching `defaultBlock` to Editor.js.
Dispose the resolver on removal. A failed attempt rejects with `load-failed`;
an explicit subsequent `resolve()` retries. Disposal prevents stale activation,
but does not cancel downloaded code or remove global styles.

For Angular, additionally install `@anarchitects/editorjs-angular` and its Angular
22 peers. Reuse the same definition with the existing environment provider:

<!-- quote-angular-example-file: quote-app.ts -->

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { EditorJs, provideEditorJsTools } from '@anarchitects/editorjs-angular';
import { quote } from './quote-definition';

@Component({
  selector: 'app-root',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 id="editor-label">Article quotes</h1>
    <aa-editorjs aria-labelledby="editor-label" [config]="config" />
  `,
})
export class QuoteEditor {
  readonly config = { defaultBlock: 'quote' };
}

bootstrapApplication(QuoteEditor, {
  providers: [provideEditorJsTools([quote])],
}).catch(console.error);
```

The host HTML needs `<app-root></app-root>`. The wrapper owns editor lifetime.
Leave `config.tools` absent to use the provider; an explicit map, including `{}`,
takes full precedence. No quote-specific provider is needed. Optional native
Signal Forms uses this same registry with `EditorJsControl` from
`@anarchitects/editorjs-angular/forms` and `[formField]`. Install Forms only for
that integration; this package adds no form state or custom control.

## Configuration and naming

| Setting                             | Behavior                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `quotePlaceholder?: string`         | Empty text hint; omitted means `Enter a quote`. An explicit empty string suppresses the hint.      |
| `captionPlaceholder?: string`       | Empty caption hint; omitted means `Enter a caption`. An explicit empty string suppresses the hint. |
| `defaultAlignment?: QuoteAlignment` | `left` or `center`; omitted means left for new blocks. A valid saved alignment takes precedence.   |

The helper validates this subset, rejecting unknown keys, accessor properties and
invalid values with synchronous `TypeError`. It preserves config identity, copies
settings containers and does not fill defaults, mutate or freeze supplied values.
Treat config as immutable for the editor lifetime. Toolbox customization belongs
in registration/settings `toolbox`, not in config: use `{ title: 'Citation' }`,
a supported icon override or `false` to hide the entry. Core owns toolbar/tune
reference validation; Editor.js owns the menus. Placeholders pass through its i18n API.

Definitions default to name `quote` and kind `block`, preserving literal aliases
and constructor/loader inference. The core profile has no built-in quote. Duplicate
names need explicit same-kind `replace: true`; replacement replaces the entire
definition. Select custom tools independently through core. For aliases, use the
same name in saved blocks, validator maps and both resolver/editor `defaultBlock`.
Adding a quote definition does not change the built-in paragraph default.

The settings menu offers **Align Left** and **Align Center**. Selection updates
saved `alignment` and the active settings item; upstream 2.7.6 deliberately does
**not** change visual alignment while editing, including after rendering saved
centered data. Consumers rendering published content own their alignment styling.
Do not infer saved alignment from computed CSS.

## Saved data and structural validation

`QuoteData` requires string `text`, string `caption` and
`alignment: 'left' | 'center'`. Additional JSON fields are accepted without mutation;
upstream editing may discard them, so acceptance is not a round-trip preservation
promise. Empty text/caption are structurally valid and upstream retains empty quote
blocks. Inline HTML is permitted structurally in both fields.

<!-- quote-example-file: quote-validation.ts -->

```ts
import { validateOutputData } from '@anarchitects/editorjs-core';
import { validateQuoteData } from '@anarchitects/editorjs-tool-quote';

export function validateArticle(input: unknown) {
  return validateOutputData(input, {
    toolValidators: new Map([['quote', validateQuoteData]]),
    unknownTools: 'reject',
  });
}
```

Use the configured alias as the validator key. Definitions do not install
validators automatically. `validateQuoteData(unknown)` works independently and
returns core's synchronous `ToolValidationResult`; error paths are relative to
data (`['text']`, `['caption']`, `['alignment']`, or a nested extension path).
When composed through `validateOutputData`, paths include the block location.
Core's bounded JSON inspection rejects cycles, accessors, non-JSON values,
unreadable objects and excessive nesting. Validation does not add missing
captions/alignment, coerce values or change a saved center to the configured left.

Validate persisted data before editing: raw upstream accepts incomplete data and
falls back for an invalid saved alignment. That is initialization behavior, not a
migration or validation contract. Hosts own persistence, explicit migrations,
HTML sanitization and safe public rendering. Structural validation is not an
accessibility certificate or permission to render untrusted HTML.

## Exports and troubleshooting

- Root: `defineQuoteTool`, `validateQuoteData`, `QuoteAlignment`, `QuoteConfig`,
  `QuoteData`, `QuoteToolOptions`. Runtime and declarations contain no DOM,
  Editor.js, upstream or Angular import.
- `/browser`: `QuoteTool`, the actual upstream constructor. Evaluation injects
  global CSS; no separate stylesheet or style-removal guarantee is provided.
- `/package.json`: public package metadata.

Only import roots and inert definitions during SSR. Create browser editors after
the holder exists and destroy each owner's editor after readiness. Read-only mode
makes both text and caption non-editable and hides settings through Editor.js.
Strict CSP, shadow roots, alternate documents, other browsers and comprehensive
accessibility need separate verification.

For an invalid alignment, use the exact lowercase strings `left` or `center`.
For unchanged appearance after choosing center, inspect the saved value: this is
upstream's documented editing behavior. For missing Angular tools, check provider
visibility and overriding `config.tools`. For duplicate names, rename or explicitly
replace the definition. Remount to change tool configuration after initialization.
Retry failed lazy loading through a subsequent direct resolver call or a new
Angular owner.

Use Bundler resolution for browser declarations. Upstream's raw config/data types
use a private alignment enum: do not deep-import it or cast your config to it.
Use the pure string-union types and documented definition/map APIs; they preserve
the config and supply it through Editor.js's public tool contract. The pure root
also supports NodeNext; that does not certify upstream's NodeNext browser types.

Report reproducible issues with exact versions through
[GitHub issues](https://github.com/anarchitects/anarchitecture-community/issues).
This package is Apache-2.0; upstream quote is MIT-licensed.
