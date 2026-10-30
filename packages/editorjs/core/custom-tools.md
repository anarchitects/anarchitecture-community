# Author custom block, inline and tune tools

This guide implements an application-owned callout for Editor.js **2.31.7**.
It uses `@anarchitects/editorjs-core` without Angular. The browser classes below
are source files you copy into your application, not exports of the core package
or a new supported catalog tool. Core's root remains DOM-free.

The saved data is `{ text: string, tone: 'info' | 'warning' }`. Text permits
`b`, `mark` and line-break `br` elements without attributes. Labels are plain
text. Empty text is valid and survives saving. This example supports ordinary
editing and tone settings; it does not implement custom paste substitutions,
conversion, merging, shortcuts or asynchronous rendering.

The optional [marker and flag extension](#add-an-inline-marker-and-a-per-block-flag)
adds bounded inline formatting and independently saved per-block tune state.

## Choose a recipe and its ownership

Start with the callout page, then add the optional files for the path you need.
The direct and eager maps use the same classes as the lazy registry; they do not
provide separate tool implementations. Copy the files from the guide shipped
with your installed core version, preserving each named file's contents.

| Path                        | Start here                                                                                                             | Observable result                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Block, direct/eager or lazy | [Install](#install-and-run), [direct/eager map](#typed-direct-and-eager-registration), [working page](#a-working-page) | Edit callout text/tone, save JSON, reload, toggle readonly, remove the editor.                  |
| Inline and tune             | [Marker and flag](#add-an-inline-marker-and-a-per-block-flag), then [composed page](#run-the-composed-page)            | Marker HTML stays in callout text; flag state is saved separately under `blocks[*].tunes.flag`. |
| Third-party tool            | [Pinned Code integration](#integrate-an-independently-installed-code-tool)                                             | Install Code separately; run direct or lazy delivery and round-trip literal code.               |

The host owns each editor, resolver, holder and mutable configuration. Editor.js
owns calling the tool's supported hooks; the tool owns its DOM, listeners and
other resources. Registry `kind` and TypeScript assignability do not implement
those hooks. Keep configuration separate from saved JSON: services, callbacks
and DOM references are configuration, not document data. The configured block
name becomes `blocks[*].type`; changing it requires an explicit host migration.

| Boundary                                   | What it establishes                                    | What remains the host/tool's responsibility                                                               |
| ------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Core parsing/normalization                 | JSON-compatible document structure                     | Accepted application schema versions and migration.                                                       |
| `validateOutputData` with tool validators  | The selected validator's checks on each block's `data` | Register validators under configured names; choose the unknown-tool policy.                               |
| Tune validation in this guide              | Allowed tune names and boolean flag payload            | Check `block.tunes` explicitly; block-data validators do not receive it automatically.                    |
| Registry/reference validation              | Valid selections, names and kinds                      | Actual upstream implementation, config schema and readonly behavior.                                      |
| Browser sanitization and display rendering | Only the explicit rules implemented at that boundary   | A safe public renderer, URL/HTML policy and server authorization; schema success is not an XSS guarantee. |

Callout supports readonly text/tone display; marker mutation is unavailable in
readonly mode; flag activation refuses readonly or detached owners. Code renders
a disabled textarea. These are bounded capabilities of these implementations,
not capabilities inherited by every registered tool. See the versioned
[block](https://github.com/codex-team/editor.js/blob/v2.31.7/types/tools/block-tool.d.ts),
[inline](https://github.com/codex-team/editor.js/blob/v2.31.7/types/tools/inline-tool.d.ts)
and [tune](https://github.com/codex-team/editor.js/blob/v2.31.7/types/block-tunes/block-tune.d.ts)
contracts alongside the upstream [Tools API](https://editorjs.io/tools-api/) and
[Block Tunes API](https://editorjs.io/block-tunes-api/). Living documentation can
describe behavior beyond the pinned release.

Register teardown before awaiting readiness. Dispose the resolver to fence late
loads, and separately destroy the editor through its owner. An imported module
cannot be unloaded; Code's shared injected stylesheet remains after removal.
After an initialization failure, dispose the owner, correct the cause and create
a fresh one. Loader retries cannot repair an invalid export or clear the browser's
module cache. The sections below retain each tool's precise cleanup limits.

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
  type OutputData,
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
  readDocument: (input: unknown) => OutputData = (input) =>
    requireCalloutDocument(input, name),
) {
  const data = readDocument(input);
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

## Add an inline marker and a per-block flag

The following optional files extend the same callout. `MarkerTool` writes
attribute-free `mark` elements into its enclosing block's text. `FlagTune` saves
`{ flagged: boolean }` separately under `blocks[*].tunes.flag`. Neither adds a
block type. Keep the earlier files, including the owner helper; its optional
`readDocument` argument lets this composition use the stricter boundary below.

### Validate tune data at the document boundary

Save as `editorial-data.ts`. This is another DOM-free file. Missing flag data
means false for a new or older block, but a present payload must contain exactly
one boolean `flagged` field. Unknown tune keys are rejected. The original
`validateCalloutDocument` remains the closed block-only policy; use this boundary
for the composed editor on **both load and save**.

<!-- neutral-example-file: editorial-data.ts -->

```ts
import {
  validateOutputData,
  type OutputDataValidationResult,
} from '@anarchitects/editorjs-core';
import { validateCallout } from './callout-data.js';

export interface FlagData {
  flagged: boolean;
}

export function isFlagData(value: unknown): value is FlagData {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'flagged' in value &&
    typeof value.flagged === 'boolean' &&
    Object.keys(value).length === 1
  );
}

export function validateEditorialDocument(
  input: unknown,
  blockName = 'callout',
  flagName = 'flag',
): OutputDataValidationResult {
  const result = validateOutputData(input, {
    toolValidators: new Map([[blockName, validateCallout]]),
    unknownTools: 'reject',
  });
  if (!result.ok) return result;
  for (const [index, block] of result.data.blocks.entries()) {
    for (const [name, value] of Object.entries(block.tunes ?? {})) {
      if (name !== flagName || !isFlagData(value))
        return {
          ok: false,
          errors: [
            {
              source: 'tool',
              code: 'tool_data_invalid',
              path: ['blocks', index, 'tunes', name],
              message:
                name !== flagName
                  ? 'Unknown tune'
                  : 'Expected exactly { flagged: boolean }',
            },
          ],
        };
    }
  }
  return result;
}

export function requireEditorialDocument(
  input: unknown,
  blockName = 'callout',
  flagName = 'flag',
) {
  const result = validateEditorialDocument(input, blockName, flagName);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.data;
}
```

Core's `ToolDataValidator` receives block **data**, not tune data. Its success
cannot certify `tunes.flag`. This additional traversal belongs to the consuming
application's schema; there is no new core validator API. Configured names must
match in the registry and validator. `marker` has no separate saved payload.

### Toggle marker formatting

Save as `marker-tool.ts`. Select a nonempty range inside one editable callout.
Activate “Highlight text” to wrap it; selecting within a single existing mark
and activating again removes that entire mark, preserving its text and bold
children. A selection spanning partially marked and unmarked content or multiple
marks is deliberately unsupported and disabled. Cross-block selections,
collapsed carets, another editor's selection and readonly content are rejected.
The tool does not implement arbitrary nested-format normalization.

<!-- browser-example-file: marker-tool.ts -->

```ts
import type {
  API,
  InlineTool,
  InlineToolConstructorOptions,
} from '@editorjs/editorjs';
type MenuConfig = Exclude<
  Awaited<ReturnType<InlineTool['render']>>,
  HTMLElement
>;

export class MarkerTool implements InlineTool {
  static get isInline() {
    return true;
  }
  static get isReadOnlySupported() {
    return false;
  }
  static get sanitize() {
    return { mark: {} };
  }
  private readonly api: API;

  private readonly holder: HTMLElement;
  private editable: HTMLElement | undefined;

  constructor({ api, config }: InlineToolConstructorOptions) {
    if (!(config?.holder instanceof HTMLElement))
      throw new Error('Marker requires its editor holder');
    this.api = api;
    this.holder = config.holder;
  }

  private context() {
    if (
      !this.holder.isConnected ||
      (this.editable && !this.editable.isConnected) ||
      this.api.readOnly.isEnabled
    )
      return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount !== 1 || selection.isCollapsed)
      return;
    const range = selection.getRangeAt(0);
    const element = (node: Node) =>
      node instanceof Element ? node : node.parentElement;
    const editable = element(range.startContainer)?.closest<HTMLElement>(
      '.callout-text[contenteditable="true"]',
    );
    if (
      !editable ||
      !editable.contains(range.endContainer) ||
      !this.holder.contains(editable) ||
      (this.editable && this.editable !== editable)
    )
      return;
    this.editable = editable;
    const startMark = element(range.startContainer)?.closest('mark');
    const endMark = element(range.endContainer)?.closest('mark');
    if (startMark && startMark === endMark && editable.contains(startMark))
      return { selection, range, mark: startMark };
    const intersecting = Array.from(editable.querySelectorAll('mark')).filter(
      (mark) => range.intersectsNode(mark),
    );
    if (intersecting.length) {
      const mark = intersecting[0];
      if (intersecting.length !== 1 || range.toString() !== mark.textContent)
        return;
      return { selection, range, mark };
    }
    return { selection, range, mark: undefined };
  }

  render(): MenuConfig {
    return {
      title: 'Highlight text',
      icon: '<span aria-hidden="true">M</span>',
      hint: { title: 'Highlight text' },
      isDisabled: !this.context(),
      isActive: () => !!this.context()?.mark,
      onActivate: () => {
        const context = this.context();
        if (!context) return;
        const { selection, range, mark } = context;
        const selected = document.createRange();
        if (mark) {
          const first = mark.firstChild,
            last = mark.lastChild;
          if (!first || !last) return;
          mark.replaceWith(...Array.from(mark.childNodes));
          selected.setStartBefore(first);
          selected.setEndAfter(last);
        } else {
          const wrapper = document.createElement('mark');
          wrapper.append(range.extractContents());
          range.insertNode(wrapper);
          selected.selectNodeContents(wrapper);
        }
        selection.removeAllRanges();
        selection.addRange(selected);
      },
    };
  }
}
```

This uses the current `MenuConfig` activation/state hooks instead of the
deprecated `surround`/`checkState` methods. Editor.js owns the toolbar's mouse and
keyboard handlers; the tool reads the current selection on each call and retains
no `Range`, global listener, timer or request. There is no invented inline
`destroy()` hook. Destroy the editor through its owner. Detached-editor and
readonly checks also make retained menu callbacks inert after teardown.

Pass this editor's dedicated holder in the marker config. The instance remembers
its first editable element and rejects a different or detached one, including
after block reload/removal. Editor.js recreates inline instances when rendering
the toolbar. Do not share a holder/config across editor owners. This explicit
boundary avoids Editor.js 2.31.7's early `api.ui.nodes` snapshot, whose declared
nodes can be undefined when tool APIs are constructed before UI preparation.

Marker mutation changes the block DOM, which Editor.js observes. The explicit
sanitizer maps on **both** marker and callout keep `mark` without attributes.
Never replace `{}` with `true` to mean “no attributes”: that upstream rule allows
attributes. The public renderer still needs its own safe rendering policy.

### Save per-block tune state

Save as `flag-tune.ts`. The instance owns its boolean, wrapper and status text.
Its menu is disabled in readonly mode; the callback checks the current readonly
state and that its own wrapper still belongs to the live editor.

<!-- browser-example-file: flag-tune.ts -->

```ts
import type {
  API,
  BlockAPI,
  BlockTune,
  BlockTuneConstructable,
} from '@editorjs/editorjs';
import { isFlagData, type FlagData } from './editorial-data.js';
type MenuConfig = Exclude<ReturnType<BlockTune['render']>, HTMLElement>;

export class FlagTune implements BlockTune {
  static get isTune() {
    return true;
  }
  private readonly api: API;
  private readonly block: BlockAPI;
  private readonly wrapper = document.createElement('div');
  private readonly status = document.createElement('span');
  private flagged: boolean;

  constructor({
    api,
    block,
    data,
  }: ConstructorParameters<BlockTuneConstructable>[0]) {
    if (data !== undefined && !isFlagData(data))
      throw new Error('Invalid flag tune data');
    this.flagged = data === undefined ? false : data.flagged;
    this.api = api;
    this.block = block;
    this.wrapper.className = 'callout-flag';
    this.status.className = 'callout-flag-status';
    this.status.contentEditable = 'false';
    this.refresh();
  }

  private refresh() {
    this.wrapper.dataset.flagged = String(this.flagged);
    this.status.textContent = this.flagged
      ? 'Flagged for review'
      : 'Not flagged';
  }

  private canEdit() {
    return (
      this.wrapper.isConnected &&
      !this.api.readOnly.isEnabled &&
      this.block.holder.contains(this.wrapper)
    );
  }

  wrap(content: HTMLElement) {
    this.wrapper.replaceChildren(this.status, content);
    return this.wrapper;
  }

  render(): MenuConfig {
    return {
      title: 'Flag for review',
      icon: '<span aria-hidden="true">F</span>',
      isActive: () => this.flagged,
      isDisabled: !this.canEdit(),
      closeOnActivate: true,
      onActivate: () => {
        if (!this.canEdit()) return;
        this.flagged = !this.flagged;
        this.refresh();
        this.block.dispatchChange();
      },
    };
  }

  save(): FlagData {
    return { flagged: this.flagged };
  }
}
```

There is no per-instance tune destruction hook in this upstream contract.
This implementation starts no external resource and uses no shared mutable
state, static `prepare` or static `reset`. The editor owns the menu and removes
the block wrapper; detached callbacks cannot mutate it. If you add resources,
design their ownership around supported hooks before adding them to this sample.
Readonly is an editing restriction, not server authorization.

### Compose and deliberately replace definitions

Save as `editorial-registry.ts`. All three names are selected together. The
block references the selected marker and flag plus built-in bold. The second
composition replaces the **whole** callout definition to change its label; it
does not deep-merge config or remove references. Loaders return constructors.

<!-- browser-example-file: editorial-registry.ts -->

```ts
import {
  composeToolRegistry,
  selectToolRegistry,
  validateToolReferences,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  type ToolConfiguration,
} from '@anarchitects/editorjs-core';
import type { CalloutTool } from './callout-tool.js';
import type { CalloutConfig, CalloutData } from './callout-data.js';

export function editorialRegistry(
  holder: HTMLElement,
  blockName = 'callout',
  markerName = 'marker',
  flagName = 'flag',
) {
  const settings = {
    config: { label: 'Callout text' },
    inlineToolbar: ['bold', markerName],
    tunes: [flagName],
  } satisfies Omit<
    ToolConfiguration<typeof CalloutTool, CalloutConfig, CalloutData>,
    'class'
  >;
  const block = {
    name: blockName,
    kind: 'block',
    source: 'lazy',
    load: () => import('./callout-tool.js').then((m) => m.CalloutTool),
    settings,
  } as const;
  const base = composeToolRegistry(
    [
      [
        block,
        {
          name: markerName,
          kind: 'inline',
          source: 'lazy',
          load: () => import('./marker-tool.js').then((m) => m.MarkerTool),
          settings: { config: { holder } },
        },
        {
          name: flagName,
          kind: 'tune',
          source: 'lazy',
          load: () => import('./flag-tune.js').then((m) => m.FlagTune),
        },
      ],
    ],
    { profile: EDITOR_JS_2_31_7_TOOL_PROFILE },
  );
  const configured = composeToolRegistry(
    [
      [
        {
          ...block,
          replace: true,
          settings: { ...settings, config: { label: 'Editorial callout' } },
        },
      ],
    ],
    { profile: EDITOR_JS_2_31_7_TOOL_PROFILE, base },
  );
  const selected = selectToolRegistry(configured, [
    blockName,
    markerName,
    flagName,
  ]);
  validateToolReferences(selected, { defaultBlock: blockName });
  return selected;
}
```

Omitting a referenced marker/tune, using the wrong kind, or referencing a removed
name fails with core's `invalid-reference` diagnostic. Reusing an existing name
without `replace: true` fails with `duplicate-name`. A tune must not be selected
as an inline tool. Renaming `flag` to `review` saves under `tunes.review`; pass
that name to `requireEditorialDocument` too. Core does not rewrite documents.

Each implementation is checked against the upstream instance interface.
Editor.js 2.31.7's `InlineToolConstructable` declaration still returns the older
HTMLElement-only base interface even though `InlineTool.render` and the runtime
support MenuConfig. The existing owner helper's single opaque tools-map bridge
handles this upstream declaration mismatch; no constructor is redefined and no
core runtime type or export changes. The real browser remains the behavior gate.

### Run the composed page

Save as `editorial-main.ts`, keeping the earlier `index.html`. Compile with
`npx tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution
bundler --lib ES2022,DOM editorial-main.ts`, then use
`npx esbuild editorial-main.ts --bundle --format=esm --splitting --entry-names=main
--outdir=dist --servedir=.` to serve that same page with this entry point.
Select text to open the inline toolbar; use Tab/arrow keys and Enter to activate
Highlight text. Block settings contain Flag for review and the built-in block
actions. Save/reload preserves markers and each block's independent flag.

<!-- browser-example-file: editorial-main.ts -->

```ts
import type EditorJS from '@editorjs/editorjs';
import { editorialRegistry } from './editorial-registry.js';
import { requireEditorialDocument } from './editorial-data.js';
import { mountCallout } from './callout-editor.js';

const holder = document.querySelector<HTMLElement>('#editor')!;
const status = document.querySelector<HTMLElement>('#status')!;
const saved = document.querySelector<HTMLTextAreaElement>('#saved')!;
const buttons = document.querySelectorAll<HTMLButtonElement>(
  '[data-editor-action]',
);
const events = new AbortController();
const owner = mountCallout(
  holder,
  editorialRegistry(holder),
  {
    blocks: [
      { type: 'callout', data: { text: 'First callout', tone: 'info' } },
      { type: 'callout', data: { text: 'Second callout', tone: 'warning' } },
    ],
  },
  'callout',
  () => {
    if (!events.signal.aborted) status.textContent = 'Changed';
  },
  requireEditorialDocument,
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

function action(id: string, run: (editor: EditorJS) => Promise<void>) {
  document.querySelector(id)!.addEventListener(
    'click',
    () => {
      owner.ready.then(run).catch(report);
    },
    { signal: events.signal },
  );
}
action('#save', async (editor) => {
  const data = requireEditorialDocument(await editor.save());
  if (events.signal.aborted) return;
  saved.value = JSON.stringify(data);
  status.textContent = 'Saved';
});
action('#reload', async (editor) => {
  await editor.render(requireEditorialDocument(saved.value));
  if (!events.signal.aborted) status.textContent = 'Reloaded';
});
action('#readonly', async (editor) => {
  await editor.readOnly.toggle();
});
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

These examples use only public package imports and the existing resolver/owner.
No Angular, Forms, Nest or new tool package is needed. The inline tool is a
mutating control and explicitly **does not support readonly activation**;
Editor.js filters it out in that mode. The callout and flag's saved state remain
visible, and the flag's activation guard rejects readonly or detached mutation.
Keep the same document boundary for received data and before persistence.

See the upstream [MenuConfig](https://editorjs.io/menu-config/) and
[Block Tunes API](https://editorjs.io/block-tunes-api/) alongside the pinned
[inline](https://github.com/codex-team/editor.js/blob/v2.31.7/types/tools/inline-tool.d.ts)
and [tune](https://github.com/codex-team/editor.js/blob/v2.31.7/types/block-tunes/block-tune.d.ts)
declarations. This bounded example does not promise arbitrary selection editing,
resource-owning plugins or compatibility with other Editor.js versions.

## Integrate an independently installed Code tool

This example uses **`@editorjs/code@2.9.4` with Editor.js 2.31.7** in a bundled
browser application. Install it explicitly with `npm install --save-exact
@editorjs/code@2.9.4`; core does not install or re-export it. Keep the earlier
`callout-editor.ts` and `callout-data.ts` owner files. No CalloutTool browser
implementation is needed by this page.

The [upstream package](https://github.com/editor-js/code) is MIT licensed and ships
its LICENSE. Its public default export resolves to `dist/code.mjs` for imports,
`dist/code.umd.js` for require, and `dist/index.d.ts` for types. It declares
`@codexteam/icons: ^0.3.2` and no peers or engines; install Editor.js explicitly.
The browser recipe uses TypeScript's **Bundler** resolution. NodeNext, raw Node
execution and UMD/CDN consumption are separate interoperability questions, not
supported modes of this recipe. Pin your dependency lock and reassess upgrades.

The module injects its CSS into `document.head` when evaluated. No extra CSS
import, font, image or external stylesheet is needed. Keep the import behind
browser activation: importing it on a server is not a substitute for delivering
its styles in the browser. Strict CSP nonce handling, iframes and alternate
documents need separate integration work. Removal destroys the editor's owned
DOM; it does not unload the module or remove its shared injected stylesheet.

### Validate configuration and saved code

Save as `code-data.ts`. These application-owned checks deliberately accept only
the documented placeholder and `{ code: string }` data. Missing/unknown data or
tunes fail before construction. Empty code remains valid. Core validates the
envelope and registry structure; it cannot certify a third-party tool's config.

<!-- neutral-example-file: code-data.ts -->

```ts
import {
  validateOutputData,
  type ToolDataValidator,
} from '@anarchitects/editorjs-core';

export function requireCodeConfig(input: unknown) {
  if (
    typeof input !== 'object' ||
    input === null ||
    Array.isArray(input) ||
    !('placeholder' in input) ||
    typeof input.placeholder !== 'string' ||
    Object.keys(input).some((key) => key !== 'placeholder')
  )
    throw new Error('Code config requires only a string placeholder');
  return { placeholder: input.placeholder };
}

export const validateCode: ToolDataValidator = (data) => {
  if (
    typeof data !== 'object' ||
    data === null ||
    Array.isArray(data) ||
    !('code' in data) ||
    typeof data.code !== 'string' ||
    Object.keys(data).some((key) => key !== 'code')
  )
    return {
      ok: false,
      errors: [
        { message: 'Expected only a string code field', path: ['code'] },
      ],
    };
  return { ok: true };
};

export function requireCodeDocument(input: unknown, name = 'code') {
  const result = validateOutputData(input, {
    toolValidators: new Map([[name, validateCode]]),
    unknownTools: 'reject',
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  if (result.data.blocks.some((block) => Object.keys(block.tunes ?? {}).length))
    throw new Error('This code document does not accept saved tunes');
  return result.data;
}
```

Code is **literal text**, including any HTML-looking characters. Upstream's
`sanitize.code: true` preserves that content; it is not a public HTML sanitizer.
Render saved code with `textContent` or an equivalently escaped rendering API,
never execute it or insert it as trusted HTML. This example has no backend,
syntax highlighter, durable persistence or publication policy.

### Preserve upstream settings and select the constructor

Save as `code-settings.ts`. Type-only upstream imports are erased at build time.
The configuration is checked independently of TypeScript and the registry.
Toolbox data seeds a new block; it does not overwrite restored code.

<!-- browser-example-file: code-settings.ts -->

```ts
import type CodeTool from '@editorjs/code';
import type { CodeConfig, CodeData } from '@editorjs/code';
import type { ToolConfiguration } from '@anarchitects/editorjs-core';
import { requireCodeConfig } from './code-data.js';

export function codeSettings(input: unknown) {
  return {
    config: requireCodeConfig(input),
    toolbox: { title: 'Code sample', data: { code: '// New sample' } },
  } satisfies Omit<
    ToolConfiguration<typeof CodeTool, CodeConfig, CodeData>,
    'class'
  >;
}
```

Save as `code-direct.ts`. This is a browser-only module: its static imports
deliver Editor.js and Code as soon as this module is imported. Import it only
when eager delivery at that browser boundary is intended.

<!-- browser-example-file: code-direct.ts -->

```ts
import EditorJS, { type EditorConfig } from '@editorjs/editorjs';
import CodeTool from '@editorjs/code';
import {
  composeToolRegistry,
  createToolMap,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
} from '@anarchitects/editorjs-core';
import { codeSettings } from './code-settings.js';
import { requireCodeDocument } from './code-data.js';

export function createDirectCode(
  holder: HTMLElement,
  input: unknown,
  config: unknown,
  name = 'code',
  onChange: EditorConfig['onChange'] = () => undefined,
) {
  const data = requireCodeDocument(input, name);
  const registry = composeToolRegistry(
    [
      [
        {
          name,
          kind: 'block',
          source: 'eager',
          registration: { class: CodeTool, ...codeSettings(config) },
        },
      ],
    ],
    { profile: EDITOR_JS_2_31_7_TOOL_PROFILE },
  );
  return new EditorJS({
    holder,
    data,
    defaultBlock: name,
    tools: createToolMap(registry),
    onChange,
  });
}
```

Save as `code-lazy.ts`. The loader returns the actual **default constructor**,
never the module namespace. Unselected definitions do not load. The configured
name is saved in `blocks[*].type`; pass the same name to the document validator.

<!-- browser-example-file: code-lazy.ts -->

```ts
import {
  composeToolRegistry,
  selectToolRegistry,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
} from '@anarchitects/editorjs-core';
import { codeSettings } from './code-settings.js';

export function codeRegistry(config: unknown, name = 'code') {
  const registry = composeToolRegistry(
    [
      [
        {
          name,
          kind: 'block',
          source: 'lazy',
          load: () => import('@editorjs/code').then((module) => module.default),
          settings: codeSettings(config),
        },
      ],
    ],
    { profile: EDITOR_JS_2_31_7_TOOL_PROFILE },
  );
  return selectToolRegistry(registry, [name]);
}
```

### Run direct or lazy delivery

Save as `code-main.ts` and `code.html`. Compile with `npx tsc --noEmit --strict
--target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM
code-main.ts`, then serve `npx esbuild code-main.ts --bundle --format=esm
--splitting --outdir=dist --servedir=.`. Open `/code.html` for lazy registration or
`/code.html?mode=direct` for eager registration at activation. Neither page loads
Code before **Start editor**. Use `&name=snippet` (or `?name=snippet`) to try a
configured name. Save and Reload JSON use the same validation boundary.

<!-- browser-example-file: code-main.ts -->

```ts
import type EditorJS from '@editorjs/editorjs';
import { codeRegistry } from './code-lazy.js';
import { requireCodeConfig, requireCodeDocument } from './code-data.js';
import { mountCallout } from './callout-editor.js';

const holder = document.querySelector<HTMLElement>('#editor')!;
const status = document.querySelector<HTMLElement>('#status')!;
const saved = document.querySelector<HTMLTextAreaElement>('#saved')!;
const start = document.querySelector<HTMLButtonElement>('#start')!;
const buttons = document.querySelectorAll<HTMLButtonElement>(
  '[data-editor-action]',
);
const params = new URL(location.href).searchParams;
const name = params.get('name') ?? 'code';
const config = requireCodeConfig({ placeholder: 'Write literal code' });
const read = (input: unknown) => requireCodeDocument(input, name);
let owner: ReturnType<typeof mountCallout> | undefined;
let removed = false;
const events = new AbortController();
const changed = () => {
  if (!removed) status.textContent = 'Changed';
};
const report = (error: unknown) => {
  if (!removed) status.textContent = String(error);
};

start.addEventListener(
  'click',
  () => {
    start.disabled = true;
    const activate = async () => {
      const input = {
        blocks: [{ type: name, data: { code: '// Restored sample' } }],
      };
      if (params.get('mode') === 'direct') {
        const { createDirectCode } = await import('./code-direct.js');
        if (removed) return;
        const editor = createDirectCode(holder, input, config, name, changed);
        let cleanup: Promise<void> | undefined;
        owner = {
          ready: editor.isReady.then(() => editor),
          dispose: () =>
            (cleanup ??= (async () => {
              await editor.isReady.catch(() => undefined);
              if (typeof editor.destroy === 'function') editor.destroy();
            })()),
        };
      } else {
        owner = mountCallout(
          holder,
          codeRegistry(config, name),
          input,
          name,
          changed,
          read,
        );
      }
      await owner.ready;
      if (removed) return;
      for (const button of buttons) button.disabled = false;
      status.textContent = 'Ready';
    };
    activate().catch(async (error) => {
      await owner?.dispose();
      report(error);
    });
  },
  { signal: events.signal },
);

function action(id: string, run: (editor: EditorJS) => Promise<void>) {
  document.querySelector(id)!.addEventListener(
    'click',
    () => {
      owner?.ready
        .then((editor) => (removed ? undefined : run(editor)))
        .catch(report);
    },
    { signal: events.signal },
  );
}
action('#save', async (editor) => {
  const data = read(await editor.save());
  if (!removed) {
    saved.value = JSON.stringify(data);
    status.textContent = 'Saved';
  }
});
action('#reload', async (editor) => {
  await editor.render(read(saved.value));
  if (!removed) status.textContent = 'Reloaded';
});
action('#readonly', async (editor) => {
  const readOnly = await editor.readOnly.toggle();
  if (!removed) status.textContent = readOnly ? 'Read only' : 'Editable';
});
document.querySelector('#remove')!.addEventListener(
  'click',
  () => {
    removed = true;
    events.abort();
    start.disabled = true;
    for (const button of buttons) button.disabled = true;
    Promise.resolve(owner?.dispose()).then(() => {
      status.textContent = 'Removed';
    });
  },
  { signal: events.signal },
);
```

<!-- browser-example-file: code.html -->

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Literal code editor</title>
    <link rel="icon" href="data:," />
  </head>
  <body>
    <h1>Literal code editor</h1>
    <button id="start">Start editor</button>
    <section aria-label="Code editor"><div id="editor"></div></section>
    <button id="save" data-editor-action disabled>Save</button>
    <button id="reload" data-editor-action disabled>Reload JSON</button>
    <button id="readonly" data-editor-action disabled>Toggle read only</button>
    <button id="remove">Remove editor</button>
    <p id="status" role="status">Not started</p>
    <label for="saved">Saved document JSON</label
    ><textarea id="saved"></textarea>
    <script type="module" src="/dist/code-main.js"></script>
  </body>
</html>
```

Readonly renders Code's textarea **disabled**, so keyboard editing is unavailable.
Wait for `readOnly.toggle()` to resolve before editing the rebuilt block.
Ordinary typing emits editor changes. Upstream Tab/Shift+Tab indentation changes
the textarea value directly without dispatching an input event; do not assume
`onChange` covers every programmatic edit. Save explicitly at submission, and
test any additional autosave/keyboard adaptation in the host. This recipe does
not certify pasted HTML normalization, syntax highlighting or comprehensive
accessibility of the third-party control. The host labels the editor region;
the upstream textarea itself supplies a placeholder rather than a label.

Editor.js 2.31.7 intercepts forward Delete when the textarea selection ends at
the last character, so it can leave selected text unchanged. The tested clearing
path is Select All followed by Backspace. Review keyboard behavior against your
product's requirements; this recipe does not patch the upstream key handler.

The tool has no instance `destroy()` hook. Its key handler belongs to its textarea;
dispose the editor owner and release references to removed DOM. Do not invent
a tool destruction API. Removal during lazy activation prevents late creation.

Malformed config fails before lazy loading; invalid saved data fails before
construction. A failed import rejects readiness and is shown as text. Correct
the deployment/network error and reload the page to create a fresh owner;
native module failures can remain cached in a document. A wrong export mapping
must be corrected to `module.default`. Core's resolver reports loader/constructor
errors and supports explicit retry, but retry cannot repair a missing export,
unsupported config or the browser's module cache. Dispose failed owners.
Consumers own dependency maintenance, lockfiles, browser/CSP testing and support
for their chosen tool version. This is evidence for one bounded integration,
not a new Community tool package or a general third-party compatibility promise.
