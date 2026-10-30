# Author a custom block tool

This guide implements an application-owned callout for Editor.js **2.31.7**.
It uses `@anarchitects/editorjs-core` without Angular. The browser classes below
are source files you copy into your application, not exports of the core package
or a new supported catalog tool. Core's root remains DOM-free.

The saved data is `{ text: string, tone: 'info' | 'warning' }`. Text permits
`b`, `mark` and line-break `br` elements without attributes. Labels are plain
text. Empty text is valid and survives saving. This example supports ordinary
editing and tone settings; it does not implement custom paste substitutions,
conversion, merging, shortcuts or asynchronous rendering.

## Install and run

In an empty directory, run `npm init -y`, then
`npm install @anarchitects/editorjs-core @editorjs/editorjs@2.31.7` and
`npm install --save-dev typescript@6.0.3 esbuild@0.28.2`.
Copy the named files below into that directory. Set `"type": "module"` in
`package.json`. These instructions require Node 22.12 or later and a modern
browser. They assume the core package is available from your registry; a local
packed `.tgz` can replace the package name before initial publication.

Run `npx tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution
bundler --lib ES2022,DOM main.ts callout-direct.ts`, then
`npx esbuild main.ts --bundle --format=esm --splitting --outdir=dist --servedir=.`.
Open the local URL printed by esbuild. Enter text, open the block's settings to
choose a tone, save, and reload the saved JSON. No backend or persistence is
included. Production applications own durable storage, schema evolution and
submission policy.

## Validate saved data without a browser

Save as `callout-data.ts`. This file imports only core's public root and compiles
with ES2022 libraries alone. It accepts unknown input, including a JSON string.
Malformed JSON, missing fields and unsupported tools produce errors before any
browser tool is constructed. The validator map uses the **configured name**;
registering as `aside` requires validating `aside` too.

The deliberately closed example rejects unknown tools and tune payloads. Add
explicit validators before accepting additional schemas. Registry checks and
TypeScript parameters do not validate saved data. Successful schema validation
does not sanitize HTML, and does not narrow core's generic output into a custom
TypeScript data union.

<!-- neutral-example-file: callout-data.ts -->

```ts
import {
  validateOutputData,
  type OutputDataValidationResult,
  type ToolDataValidator,
  type ToolValidationIssue,
} from '@anarchitects/editorjs-core';

export interface CalloutData {
  text: string;
  tone: 'info' | 'warning';
}
export interface CalloutConfig {
  label: string;
}

export function isCalloutData(value: unknown): value is CalloutData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'text' in value &&
    typeof value.text === 'string' &&
    'tone' in value &&
    (value.tone === 'info' || value.tone === 'warning')
  );
}

export const validateCallout: ToolDataValidator = (value) => {
  const data = typeof value === 'object' && value !== null ? value : {};
  const errors: ToolValidationIssue[] = [];
  if (!('text' in data) || typeof data.text !== 'string')
    errors.push({ path: ['text'], message: 'Expected text to be a string' });
  if (!('tone' in data) || (data.tone !== 'info' && data.tone !== 'warning'))
    errors.push({ path: ['tone'], message: 'Expected info or warning' });
  return errors.length ? { ok: false, errors } : { ok: true };
};

export function validateCalloutDocument(
  input: unknown,
  name = 'callout',
): OutputDataValidationResult {
  const result = validateOutputData(input, {
    toolValidators: new Map([[name, validateCallout]]),
    unknownTools: 'reject',
  });
  if (!result.ok) return result;
  for (const [index, block] of result.data.blocks.entries()) {
    if (block.tunes && Object.keys(block.tunes).length) {
      return {
        ok: false,
        errors: [
          {
            source: 'tool',
            code: 'tool_data_invalid',
            path: ['blocks', index, 'tunes'],
            message: 'This example accepts no saved tunes',
          },
        ],
      };
    }
  }
  return result;
}

export function requireCalloutDocument(input: unknown, name = 'callout') {
  const result = validateCalloutDocument(input, name);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.data;
}
```

`validateCallout` reports paths relative to the block's data; core prefixes them
with `blocks`, the block index and `data`. For example, a missing tone reports
`['blocks', 0, 'data', 'tone']`. Validate both received content and final output.
Server handlers can import this file without Editor.js, DOM, Angular or Nest.

## Implement the browser tool

Save as `callout-tool.ts`. Editor.js supplies `data`, `api`, `config`, `readOnly`
and `block`. Missing **new-block** fields default to empty text and `info`;
supplied invalid fields throw. Persisted input must first pass the stricter
document validator above, so missing saved fields are never silently defaulted.

No global listener, timer, request or subscription starts in the constructor:
Editor.js can construct discovery instances without rendering them. This tool
owns only its DOM and menu closures. `destroy()` is idempotent, disables the
retained element and prevents stale menu callbacks from changing state. A tool
that adds external resources must acquire them in its rendered lifetime and
release them on destruction; `removed()` alone is not a universal cleanup hook.

<!-- browser-example-file: callout-tool.ts -->

```ts
import type {
  API,
  BlockAPI,
  BlockTool,
  BlockToolConstructorOptions,
} from '@editorjs/editorjs';
import {
  isCalloutData,
  type CalloutConfig,
  type CalloutData,
} from './callout-data.js';

// Editor.js 2.31.7 exposes this through BlockTool, not as a root named export.
type MenuConfig = Exclude<
  ReturnType<NonNullable<BlockTool['renderSettings']>>,
  HTMLElement
>;

// Empty attribute maps retain these tags but strip every attribute.
// In Editor.js's sanitizer, `true` would preserve attributes too.
const textRules = { b: {}, mark: {}, br: {} };

export class CalloutTool implements BlockTool {
  static get toolbox() {
    return {
      title: 'Callout',
      icon: '<svg viewBox="0 0 20 20" width="20" height="20"><path d="M3 3h14v14H3zM9 6h2v5H9zm0 7h2v2H9z"/></svg>',
    };
  }
  static get isReadOnlySupported() {
    return true;
  }
  static get sanitize() {
    return { text: textRules, tone: {} };
  }

  private readonly api: API;
  private readonly block: BlockAPI;
  private readonly readOnly: boolean;
  private readonly element: HTMLDivElement;
  private tone: CalloutData['tone'];
  private destroyed = false;

  constructor({
    data,
    api,
    config,
    readOnly,
    block,
  }: BlockToolConstructorOptions<Partial<CalloutData>, CalloutConfig>) {
    const initial: unknown = { text: '', tone: 'info', ...data };
    if (!isCalloutData(initial)) throw new Error('Invalid callout data');
    const label: unknown = config?.label ?? 'Callout text';
    if (typeof label !== 'string' || !label.trim())
      throw new Error('Callout label must be a nonempty string');
    this.api = api;
    this.block = block;
    this.readOnly = readOnly;
    this.tone = initial.tone;
    this.element = document.createElement('div');
    this.element.className = 'callout-text';
    this.element.contentEditable = String(!readOnly);
    this.element.setAttribute('role', 'textbox');
    this.element.setAttribute('aria-label', label);
    this.element.setAttribute('aria-multiline', 'true');
    this.element.setAttribute('aria-readonly', String(readOnly));
    this.element.tabIndex = 0;
    // Sanitize before assigning HTML, including restored documents.
    this.element.innerHTML = api.sanitizer.clean(initial.text, textRules);
  }

  render() {
    return this.element;
  }

  save(): CalloutData {
    return {
      text: this.element.textContent
        ? this.api.sanitizer.clean(this.element.innerHTML, textRules)
        : '',
      tone: this.tone,
    };
  }

  validate(data: unknown) {
    return isCalloutData(data);
  }

  renderSettings(): MenuConfig {
    return (['info', 'warning'] as const).map((tone) => ({
      title: tone === 'info' ? 'Information tone' : 'Warning tone',
      name: `callout-${tone}`,
      isActive: () => this.tone === tone,
      isDisabled: this.readOnly || this.destroyed,
      closeOnActivate: true,
      onActivate: () => {
        if (this.readOnly || this.destroyed || this.tone === tone) return;
        this.tone = tone;
        // Tone is internal state: no DOM mutation tells Editor.js about it.
        this.block.dispatchChange();
      },
    }));
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.element.contentEditable = 'false';
    this.element.setAttribute('aria-readonly', 'true');
  }
}
```

The contenteditable has an accessible name, multiline textbox semantics and a
keyboard focus stop. Editor.js observes text edits; settings explicitly call
`block.dispatchChange()` because tone has no DOM representation. Its MenuConfig
popover provides keyboard navigation. Readonly disables editing and settings
mutation, including previously retained callbacks. Editor.js owns its toolbar
listeners and must also be destroyed. A standalone host's “disabled” control can
use `editor.readOnly.toggle(true)`; readonly is an editing restriction, not
authorization or a guarantee that arbitrary external JavaScript cannot mutate DOM.
An empty editable can contain browser-inserted `br` elements; saving normalizes
that empty state to `text: ''` without dropping its block or tone.

`validate(false)` in Editor.js **omits that block from saved output**. It does not
reject the save or return a field error. This tool accepts empty text and every
shape its `save()` produces. Never use false merely to reject an unfinished
editorial field. Validate submission rules at the host/document boundary and
present errors there. Validating the resulting document cannot recover content
another tool has already omitted.

The sanitizer keeps only `b`, `mark` and `br`, without attributes; links, images,
scripts and event handlers are not part of this format. No marker authoring tool
is installed by this example; existing allowed marks survive round trips.
This editor policy is **not a public renderer**. At publication, either display
text literally with `textContent`, or sanitize again with your renderer's own
explicit policy. Never interpolate saved text into HTML, script, CSS or URLs.

## Typed direct and eager registration

Save as `callout-direct.ts`. Direct configuration preserves the constructor,
config and toolbox-default data types and is checked against Editor.js's actual
browser types. The configured name `callout` becomes the saved `type`.

<!-- browser-example-file: callout-direct.ts -->

```ts
import EditorJS from '@editorjs/editorjs';
import {
  composeToolRegistry,
  createToolMap,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  selectToolRegistry,
  type ToolConfiguration,
} from '@anarchitects/editorjs-core';
import { CalloutTool } from './callout-tool.js';
import {
  requireCalloutDocument,
  type CalloutConfig,
  type CalloutData,
} from './callout-data.js';

export const calloutRegistration = {
  class: CalloutTool,
  config: { label: 'Callout text' },
  inlineToolbar: ['bold'],
  toolbox: { title: 'Warning callout', data: { text: '', tone: 'warning' } },
} satisfies ToolConfiguration<typeof CalloutTool, CalloutConfig, CalloutData>;

export const eagerRegistry = selectToolRegistry(
  composeToolRegistry(
    [
      [
        {
          name: 'callout',
          kind: 'block',
          source: 'eager',
          registration: calloutRegistration,
        },
      ],
    ],
    { profile: EDITOR_JS_2_31_7_TOOL_PROFILE },
  ),
  ['callout'],
);

export const eagerTools = createToolMap(eagerRegistry);

export function createDirectCallout(holder: HTMLElement, input: unknown) {
  const data = requireCalloutDocument(input);
  return new EditorJS({
    holder,
    data,
    defaultBlock: 'callout',
    tools: { callout: calloutRegistration },
  });
}
```

For direct use, retain the returned Editor.js instance, handle `isReady` rejection,
await readiness before using it, and on teardown await settled initialization
then call its `destroy()` if available. `eagerTools` can replace the direct map;
`eagerRegistry` can be passed to the lifecycle helper below. The direct/eager
module imports browser code immediately: do not import it from server code or a
route intended to defer Editor.js delivery.

Toolbox data seeds a newly selected “Warning callout”; it does not overwrite
restored data. For a duplicate registry name, use core's explicit `replace: true`
on a whole replacement definition of the same kind. Config is not deep-merged.
Select any named inline/tune dependencies along with a block. The built-in `bold`
reference here is supplied by the pinned profile. Those checks verify references,
not capability, config, schema, sanitization or runtime behavior.

## Lazy registration and explicit ownership

Save as `callout-lazy.ts`. This module has no static runtime import of the tool
or Editor.js. Each resolver loads only selected names. To save under another
name, call `calloutRegistry('aside')` and pass the same name to the owner below.

<!-- browser-example-file: callout-lazy.ts -->

```ts
import {
  composeToolRegistry,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  selectToolRegistry,
  type ToolConfiguration,
} from '@anarchitects/editorjs-core';
import type { CalloutTool } from './callout-tool.js';
import type { CalloutConfig, CalloutData } from './callout-data.js';

const settings = {
  config: { label: 'Callout text' },
  inlineToolbar: ['bold'],
  toolbox: { title: 'Warning callout', data: { text: '', tone: 'warning' } },
} satisfies Omit<
  ToolConfiguration<typeof CalloutTool, CalloutConfig, CalloutData>,
  'class'
>;

export function calloutRegistry<const Name extends string>(name: Name) {
  const all = composeToolRegistry(
    [
      [
        {
          name,
          kind: 'block',
          source: 'lazy',
          load: () =>
            import('./callout-tool.js').then((module) => module.CalloutTool),
          settings,
        },
      ],
    ],
    { profile: EDITOR_JS_2_31_7_TOOL_PROFILE },
  );
  return selectToolRegistry(all, [name]);
}
```

Save as `callout-editor.ts`. Validate before resolving tools or importing the
editor. Retain the owner immediately so removal while loading cannot later
create an editor. Disposal stops ownership, not JavaScript's shared module import;
it separately destroys the raw editor. Loader/initialization failure rejects
`ready`; dispose that owner and create a fresh one after correcting the cause.

<!-- browser-example-file: callout-editor.ts -->

```ts
import {
  createToolResolver,
  type ToolRegistry,
} from '@anarchitects/editorjs-core';
import type EditorJS from '@editorjs/editorjs';
import type { EditorConfig } from '@editorjs/editorjs';
import { requireCalloutDocument } from './callout-data.js';

export function mountCallout(
  holder: HTMLElement,
  registry: ToolRegistry,
  input: unknown,
  name = 'callout',
  onChange: NonNullable<EditorConfig['onChange']> = () => undefined,
) {
  const data = requireCalloutDocument(input, name);
  const resolver = createToolResolver(registry, { defaultBlock: name });
  let removed = false;
  let editor: EditorJS | undefined;
  let cleanup: Promise<void> | undefined;
  const assertLive = () => {
    if (removed) throw new Error('Callout owner removed');
  };
  const dispose = () => {
    removed = true;
    resolver.dispose();
    return (cleanup ??= (async () => {
      const owned = editor;
      if (!owned) return;
      await owned.isReady.catch(() => undefined);
      if (typeof owned.destroy === 'function') owned.destroy();
    })());
  };
  const ready = (async () => {
    const tools = await resolver.resolve();
    assertLive();
    const { default: Editor } = await import('@editorjs/editorjs');
    assertLive();
    editor = new Editor({
      holder,
      data,
      defaultBlock: name,
      onChange,
      tools: tools as EditorConfig['tools'],
    });
    await editor.isReady;
    assertLive();
    return editor;
  })();
  return { ready, dispose };
}
```

The single tools-map assertion bridges core's opaque constructors to upstream's
browser interfaces; it is not schema validation. The direct recipe independently
checks the concrete class against those interfaces. Each owner has its own
resolver and editor; disposing one does not dispose another's tools or editor.

## A working page

Save as `main.ts`. Save and reload use the same validation boundary. Buttons
remain disabled until initialization; failures appear in a live status region.
The listener AbortController belongs to this page and is aborted on removal.
The owner handles pending initialization during teardown.

<!-- browser-example-file: main.ts -->

```ts
import { calloutRegistry } from './callout-lazy.js';
import { mountCallout } from './callout-editor.js';
import { requireCalloutDocument } from './callout-data.js';

const holder = document.querySelector<HTMLElement>('#editor')!;
const status = document.querySelector<HTMLElement>('#status')!;
const output = document.querySelector<HTMLTextAreaElement>('#saved')!;
const buttons = document.querySelectorAll<HTMLButtonElement>(
  '[data-editor-action]',
);
const events = new AbortController();
const owner = mountCallout(
  holder,
  calloutRegistry('callout'),
  {
    blocks: [
      { type: 'callout', data: { text: 'Hello <b>editor</b>', tone: 'info' } },
    ],
  },
  'callout',
  () => {
    if (!events.signal.aborted) status.textContent = 'Changed';
  },
);
const report = (error: unknown) => {
  if (!events.signal.aborted) status.textContent = String(error);
};
owner.ready
  .then(() => {
    if (events.signal.aborted) return;
    for (const button of buttons) button.disabled = false;
    status.textContent = 'Ready';
  })
  .catch(report);

document.querySelector('#save')!.addEventListener(
  'click',
  () => {
    owner.ready
      .then((editor) => editor.save())
      .then((data) => {
        if (events.signal.aborted) return;
        output.value = JSON.stringify(requireCalloutDocument(data));
        status.textContent = 'Saved';
      })
      .catch(report);
  },
  { signal: events.signal },
);
document.querySelector('#reload')!.addEventListener(
  'click',
  () => {
    owner.ready
      .then(async (editor) => {
        await editor.render(requireCalloutDocument(output.value));
        if (events.signal.aborted) return;
        status.textContent = 'Reloaded';
      })
      .catch(report);
  },
  { signal: events.signal },
);
document.querySelector('#readonly')!.addEventListener(
  'click',
  () => {
    owner.ready.then((editor) => editor.readOnly.toggle()).catch(report);
  },
  { signal: events.signal },
);
document.querySelector('#remove')!.addEventListener(
  'click',
  () => {
    events.abort();
    for (const button of buttons) button.disabled = true;
    owner
      .dispose()
      .then(() => {
        status.textContent = 'Removed';
      })
      .catch((error: unknown) => {
        status.textContent = String(error);
      });
  },
  { signal: events.signal },
);
```

Save as `index.html` alongside the TypeScript files. The styling is optional;
it gives the editable area a visible boundary and focus indicator.

<!-- browser-example-file: index.html -->

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="data:," />
    <title>Custom callout</title>
    <style>
      body {
        max-width: 48rem;
        margin: 2rem auto;
        padding: 1rem;
        font-family: sans-serif;
      }
      .callout-text {
        border: 1px solid;
        padding: 1rem;
        min-height: 2rem;
      }
      .callout-text:focus-visible {
        outline: 3px solid royalblue;
      }
      textarea {
        display: block;
        width: 100%;
        min-height: 8rem;
      }
    </style>
  </head>
  <body>
    <h1>Custom callout</h1>
    <div id="editor"></div>
    <button id="save" data-editor-action disabled>Save</button>
    <button id="reload" data-editor-action disabled>Reload JSON</button>
    <button id="readonly" data-editor-action disabled>Toggle read only</button>
    <button id="remove">Remove editor</button>
    <p id="status" role="status">Loading</p>
    <label for="saved">Saved document JSON</label>
    <textarea id="saved"></textarea>
    <script type="module" src="/dist/main.js"></script>
  </body>
</html>
```

For a routed view, use its lifecycle to abort page listeners and await
`owner.dispose()` as well. Event handlers should not outlive their view. This
reference has no upload, network or timer work inside the tool; applications
adding those features must supply their own cancellation and error policy.

See the [core README](README.md) for registry diagnostics, explicit replacement,
resolver retry/disposal and document validation contracts. The upstream
[Tools API](https://editorjs.io/tools-api/) and
[2.31.7 block-tool declarations](https://github.com/codex-team/editor.js/blob/v2.31.7/types/tools/block-tool.d.ts)
define the browser lifecycle implemented here. Compatibility is bounded to that
Editor.js version; this example is not a claim about every third-party tool,
browser, public renderer or production blog workflow.
