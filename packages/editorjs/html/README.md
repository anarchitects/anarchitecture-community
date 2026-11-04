# @anarchitects/editorjs-html

Render supported Editor.js saved documents as safe, semantic HTML in Node or a
bundled browser application. Use it for public content and explicit previews
without loading an editor, browser tools, Angular or a CMS integration.

The standard profile supports **paragraph**, **header**, **quote**, **list** and
**image** saved names. Register explicit aliases, custom block renderers and tunes
when your saved document uses other names or schemas. Code and Callout are
opt-in examples below, not built-in tools.

## Installation and compatibility

```sh
npm install @anarchitects/editorjs-html
```

The package installs `@anarchitects/editorjs-core` and `sanitize-html` transitively.
No framework peers, authoring tools, stylesheets or Nx installation are required.
It exposes ESM JavaScript and TypeScript declarations at its package root, plus
`/package.json` metadata. Private subpaths are unsupported. There is no advertised
native CommonJS entry point.

Node **22.12.0+** is the runtime floor. Actual packed ESM and bundled-browser consumers are verified with Node **22.12.0**, **22.22.3**, **24.15.0** and **26.0.0**; native CommonJS `require` is not a supported entry point. Declarations use ES2022 types and are checked
with TypeScript **6.0.3** under NodeNext and Bundler resolution, without DOM/Node
ambient declarations. Browser use requires a bundler; Chromium is the current
verified browser engine. Angular component/directive and framework hydration
support are not part of this package's current validation. The sanitizer adds a
material browser bundle cost; import this package only where rendering is needed.

## Quick start

```ts
import { renderEditorJsHtml } from '@anarchitects/editorjs-html';

const result = renderEditorJsHtml({
  blocks: [{ type: 'paragraph', data: { text: 'Hello <b>world</b>' } }],
});
if (result.status !== 'success') throw new Error('Content cannot be published');
export const html = result.html;
// <p>Hello <b>world</b></p>
```

Supply JSON text or decoded plain JSON data. Rendering does not fetch remote
resources, call an editor, insert timestamps/IDs, mutate the document or migrate
stored data. Extract your own storage envelope and apply migrations before calling.
Accessors, cycles, sparse arrays, non-JSON values and invalid/duplicate block IDs
are rejected. A valid empty block array succeeds with an empty HTML string.

## Strict publishing and explicit preview

Strict mode is the default. Unsupported blocks/tunes, invalid saved data or unsafe
HTML cause `status: 'failure'` with **no HTML property**, including when other
blocks rendered successfully. Success means the supported rendering checks passed;
you still own publication authorization, editorial quality and accessibility.

```ts
import {
  renderEditorJsHtml,
  type HtmlDiagnostic,
} from '@anarchitects/editorjs-html';

const result = renderEditorJsHtml(
  {
    blocks: [
      { type: 'paragraph', data: { text: 'Visible preview' } },
      { type: 'image', data: {} },
    ],
  },
  { mode: 'preview' },
);
export const diagnostics: readonly HtmlDiagnostic[] = result.diagnostics;
export const previewHtml = result.status === 'preview' ? result.html : '';
// previewHtml is <p>Visible preview</p>; diagnostics identifies the omitted image.
```

Preview always returns `status: 'preview'` when output is available, even if nothing
was omitted. It skips whole unknown/invalid blocks, missing-alt images, blocks with
unknown/invalid tunes, and blocks whose registered callbacks fail. It returns
sanitized remainders for unsafe markup with diagnostics. Invalid saved-document
structure, resource limits or an unexpected rendering failure return failure
without HTML in either mode. Never treat preview as complete publishable output.
Diagnostics provide a stable code, stage and path, plus block index, saved ID/type
and tune when applicable. Messages omit content and exception details. Saved
identifiers are still host-controlled data; handle them safely when displaying/logging.

## Saved shapes and formatting

| Type        | Required data                                                      | HTML                                                              |
| ----------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `paragraph` | `text: string`                                                     | p                                                                 |
| `header`    | `text: string`, integer `level: 1–6`                               | exact h1–h6, without clamping                                     |
| `quote`     | `text: string`, `caption: string`, `alignment: 'left' \| 'center'` | figure containing blockquote/p and a separate nonempty figcaption |

The paragraph/header/quote contracts match the Community adapters exercised with
paragraph 2.11.7, header 2.8.9 and quote 2.7.6. The additional profiles are:

| Saved name | Versioned contract                                                                                                                                  | Output                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `list`     | List 2.0.9: `style: 'ordered' \| 'unordered' \| 'checklist'`, `meta: object`, recursive `items: { content: string; meta: object; items: Item[] }[]` | ol/ul and nested li                |
| `image`    | Image 2.10.3 plus Community's top-level `alt`: `file: { url: string }`, string `caption`, boolean `withBorder`, `withBackground`, `stretched`       | figure/img and nonempty figcaption |

Lists inherit their root style. Ordered metadata permits positive integer `start`
(up to 2,147,483,647, the HTML counter range) and `counterType`: `numeric`,
`upper-roman`, `lower-roman`, `upper-alpha`, `lower-alpha`. These map to ol `start`
and `type`. Root metadata configures the root list; an item's metadata configures
its child list, inheriting the parent counter type when absent. A child list starts
at 1 unless explicitly configured. Leaf metadata has no child list to configure.
Checklist items require boolean `meta.checked`; visible `[Completed]` or
`[Not completed]` text precedes each item, including nested items. This exposes
state without adding focusable/editable form controls. These English status labels
are fixed in the standard profile; register an explicit replacement for localization.
Legacy flat strings, legacy checklist objects and mixed item-level styles require
an explicit host migration or custom registration; they are never guessed.

Image `alt` has three distinct states: authored nonblank **plain text**, explicit
empty `''` for a decorative image, and absent/unset. Missing or whitespace-only
alt produces `missing_alt`: strict rendering fails and preview skips the image
block. Caption/file-name/metadata never supplies alt implicitly. Attribute-looking
alt remains literal text. Additional JSON file metadata is preserved in the source
and omitted from HTML. Visual flags map to configured classes, not inline styles.
You own the accuracy of alt text and whether an image is meaningfully decorative.

```ts
import { renderEditorJsHtml } from '@anarchitects/editorjs-html';

export const result = renderEditorJsHtml({
  blocks: [
    {
      type: 'list',
      data: {
        style: 'ordered',
        meta: { start: 3, counterType: 'upper-roman' },
        items: [{ content: 'Prepare <b>ingredients</b>', meta: {}, items: [] }],
      },
    },
    {
      type: 'image',
      data: {
        file: { url: 'https://example.com/cake.jpg' },
        alt: 'A chocolate cake on a blue plate',
        caption: 'The finished cake',
        withBorder: false,
        withBackground: false,
        stretched: false,
      },
    },
  ],
});
if (result.status !== 'success')
  throw new Error('Review list/image diagnostics');
```

Text/caption fields allow `b`, `strong`, `i`, `em`, `u`, `s`, `mark`, `code`, `br`
and `a`. Anchors permit `href` and nonempty `title`. Plain text and entities are
serialized safely. Other tags/attributes, including saved classes, inline styles,
event handlers, images, forms, SVG/MathML, embedded documents and scripts, are
rejected in strict mode. Structurally repaired/unclosed inline elements are also
diagnosed. Harmless tag case, quote/entity spelling and br serialization normalize
without errors. HTML comments are non-rendering metadata and are omitted.

The same maintained sanitizer/policy handles inline fields and final formatted
output. There is no trusted-HTML bypass. Custom and overridden output passes this same policy before tune composition
and after each tune. A later tune cannot erase an earlier safety diagnostic. Saved-shape validity alone does not prove HTML safety.

## Configuration, isolation and styling

```ts
import { createEditorJsHtmlRenderer } from '@anarchitects/editorjs-html';

const renderer = createEditorJsHtmlRenderer({
  classes: {
    paragraph: ['article-paragraph'],
    quoteCenter: ['quote-centered'],
  },
  urls: {
    httpsOnly: true,
    allowRelative: false,
    allowedOrigins: ['https://example.com'],
  },
  limits: { maxBlocks: 100 },
});
export const result = renderer.render({
  blocks: [
    {
      type: 'paragraph',
      data: { text: '<a href="https://example.com/blog">Read</a>' },
    },
  ],
});
```

`createEditorJsHtmlRenderer` snapshots options per instance; later mutations of
input options do not affect it. `renderEditorJsHtml` creates the same isolated
configuration for a single call. Configuration errors return `invalid_configuration`
without throwing or output. There is no global configuration or retained document.

Available class keys are `paragraph`, `heading`, `quote`, `quoteLeft`, `quoteCenter`
and `quoteCaption`, plus `list`, `listItem`, `checklist`, `image`, `imageCaption`,
`imageBorder`, `imageBackground`, `imageStretched` and `custom`. Each accepts at most 16 unique tokens, each starting with an
ASCII letter/underscore and continuing with letters, digits, underscore or hyphen
(up to 64 characters). The default quote alignment classes are
`editorjs-quote-left` and `editorjs-quote-center`. Image flag defaults are
`editorjs-image-border`, `editorjs-image-background` and `editorjs-image-stretched`;
other class lists default to empty. An explicit list replaces its default, including `[]`. Supply host CSS for
these classes; no stylesheet or arbitrary inline-style option is shipped.

Links allow http(s) and relative/fragment URLs by default. `httpsOnly` restricts
absolute HTTP links; `allowRelative: false` rejects relative/fragment links.
`allowedOrigins` restricts absolute http(s) links to exact origins; an empty list
adds no origin restriction. Relative links retain the host document/base URL's
meaning, so disable them when an absolute-origin restriction must be exhaustive.
`allowMailto: true` explicitly permits mailto links. All controls default to false
except `allowRelative`, which defaults to true. Images use the same HTTPS/origin
restrictions, but only absolute http(s) sources by default. Set
`allowRelativeImages: true` explicitly for relative asset sources; this is separate
from link `allowRelative`. Mailto never applies to images. The renderer makes no
requests, but inserting strict or preview image output in a browser can load those assets.
For example, preview may retain a permitted HTTP image after removing its unsafe
event handler. Diagnostics do not mean all remote resources were removed.
Hosts own image privacy, authorization and reachability. Protocol-relative URLs, credentials,
backslashes, control/space characters and encoded control/protocol-separator tricks
are rejected. Host policy can narrow this boundary; it cannot enable script/data/
file/blob URLs. Link target/rel customization is not available; links do not
request new tabs. Hosts own navigation, CSP, privacy and rendering into an
appropriate block container; never concatenate untrusted HTML after rendering.

## Typed custom blocks, aliases and tunes

The headless registry is independent of authoring registries and tool constructors.
`profiles` explicitly maps saved names to immutable standard profiles. A profile
alias always uses the original built-in implementation, even when that built-in's
saved name is overridden. `blocks` registers a guard and synchronous HTML callback
for each custom name. Names use exact own-key lookup, including prototype-like
names; no inference from browser classes or document version occurs.

```ts
import { renderEditorJsHtml } from '@anarchitects/editorjs-html';

export const aliased = renderEditorJsHtml(
  { blocks: [{ type: 'title', data: { text: 'A title', level: 2 } }] },
  { profiles: [{ name: 'title', profile: 'header' }] },
);
if (aliased.status !== 'success') throw new Error('Alias validation failed');
```

Duplicate configured block names (including across `profiles` and `blocks`) or
tune names fail configuration. Replacing a built-in saved name requires
`override: true`; that flag on a new name is an error. There is no last-entry-wins
rule or process-global mutation. Each list allows at most 1,000 entries, and names
are nonblank strings of at most 128 characters. Compose arrays explicitly in your
host; options replace complete arrays rather than merging registries implicitly.

The following complete example uses the saved contracts from the core
[custom-tool guide](https://github.com/anarchitects/anarchitecture-community/blob/main/packages/editorjs/core/custom-tools.md):
Callout (`text`, `tone`), inline Marker (`mark` inside text), FlagTune (`flagged`)
and Code 2.9.4 (`code`). It requires no browser-tool imports or installation.

```ts
import {
  createEditorJsHtmlRenderer,
  type HtmlRendererOptions,
} from '@anarchitects/editorjs-html';

type Callout = { text: string; tone: 'info' | 'warning' };
type Code = { code: string };
type Flag = { flagged: boolean };
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isCallout = (value: unknown): value is Callout =>
  object(value) &&
  typeof value['text'] === 'string' &&
  (value['tone'] === 'info' || value['tone'] === 'warning');
const isCode = (value: unknown): value is Code =>
  object(value) && typeof value['code'] === 'string';
const isFlag = (value: unknown): value is Flag =>
  object(value) && typeof value['flagged'] === 'boolean';

const options: HtmlRendererOptions<
  { callout: Callout; code: Code },
  { flag: Flag }
> = {
  classes: { custom: ['callout-info', 'callout-warning', 'flagged'] },
  blocks: [
    {
      name: 'callout',
      validate: isCallout,
      render: (data, context) =>
        `<aside class="callout-${data.tone}">${context.inline(data.text)}</aside>`,
    },
    {
      name: 'code',
      validate: isCode,
      render: (data, context) =>
        `<pre><code>${context.escapeText(data.code)}</code></pre>`,
    },
  ],
  tunes: [
    {
      name: 'flag',
      validate: isFlag,
      render: (html, data) =>
        data.flagged ? `<div class="flagged">${html}</div>` : html,
    },
  ],
};
const renderer = createEditorJsHtmlRenderer(options);
export const rendered = renderer.render({
  blocks: [
    {
      type: 'callout',
      data: { text: 'A <mark>marked</mark> warning', tone: 'warning' },
      tunes: { flag: { flagged: true } },
    },
    { type: 'code', data: { code: '<script>literalExample()</script>' } },
  ],
});
if (rendered.status !== 'success')
  throw new Error('Custom content failed validation');
```

The generic saved-name maps connect each guard and callback to its data type.
A type annotation alone does not validate persistence: guards must actually check
the expected shape. Guards run on detached, deeply frozen JSON after core envelope
validation and must return a synchronous boolean. You can wrap a neutral public
tool validator's `.ok` result in a correctly typed predicate, but its package may
install authoring dependencies; the renderer does not import one automatically.

Callbacks receive frozen data and a frozen context with `blockIndex`, saved `block`,
`escapeText` and `inline`. Context exposes no editor, DOM or framework service.
`escapeText` encodes literal text/attribute values; use it for Code and plain text.
`inline` interprets only the documented inline subset and records safety violations.
Helpers accept strings within the configured string/output ceilings and are valid
only during the current render. Input/source data is neither mutated nor frozen.
Configuration containers are copied, but callback function identity is retained:
use pure callbacks and immutable captures for deterministic output.

Saved tunes validate independently before any block rendering. They compose only
when present, in **registration order**, regardless of saved property order. An
absent tune invokes nothing. Register `{ name, validate, ignore: true }` explicitly
for nonvisual metadata; it still validates and cannot also supply a renderer.
Unknown or invalid tunes skip the whole block in preview and fail strict rendering.
Returning a Promise/non-string, a nonboolean guard result, or throwing yields
`callback_failed`; the affected block is omitted in preview. Later calls recover
independently. Error messages never copy callback exception text.

Custom output permits the standard semantic tags plus `aside`, `section`, `div`,
`span` and `pre`. Classes must be in trusted configuration; no styles, IDs, event
attributes or arbitrary data/ARIA attributes pass through. Images need allowed
URLs and explicit valid alt even in callback output; missing-alt output omits the
whole custom block in preview. Final fragments must also obey the supported content
models: list children are `li` (plus whitespace), `li` belongs to a list,
`figcaption` is the single first/last caption directly within its figure, and
phrasing containers cannot contain block elements. Malformed final nesting or
content models produce `unsafe_html` and omit the whole block in preview; a later
tune cannot hide that omission. This is a bounded check of the supported vocabulary,
not a general HTML validator. All fragments pass the common policy before the
next tune and at final output. Callback JavaScript is trusted application code,
not sandboxed plugin code: never load arbitrary user-authored functions. There is
no trusted-HTML option, sanitizer override or implicit custom fallback.

## Resource limits

| Option           | Default / maximum                                                       |
| ---------------- | ----------------------------------------------------------------------- |
| `maxInputBytes`  | 1,048,576 UTF-8 bytes, for raw JSON and its decoded JSON representation |
| `maxBlocks`      | 1,000                                                                   |
| `maxDepth`       | 32 JSON property/index levels from root                                 |
| `maxListDepth`   | 16 list levels (also subject to the JSON-depth ceiling)                 |
| `maxStringBytes` | 102,400 UTF-8 bytes per key or string                                   |
| `maxOutputBytes` | 2,097,152 accumulated formatted and sanitized UTF-8 bytes               |
| `maxDiagnostics` | 100 detailed diagnostics, then one truncation diagnostic                |

Limits accept positive integers no higher than these ceilings. Inline and final HTML
have a separate fixed nesting ceiling of 32 elements; exceeding it returns
`limit_exceeded` without HTML in either mode. The JSON-depth ceiling can be
reached before 16 list levels because each list contains nested objects/arrays. Limits protect library work, not
transport parsing performed earlier by your server or arbitrary work/allocations
inside trusted callbacks. Each callback result and bounded helper call is checked;
intermediate tune output counts toward the accumulated output ceiling. Enforce request limits there
too. A lowered JSON-depth limit can exclude otherwise valid documents.

## Public exports and troubleshooting

Functions: `renderEditorJsHtml`, `createEditorJsHtmlRenderer`.
Types: `EditorJsHtmlRenderer`, `HtmlRendererOptions`, `HtmlRenderResult`,
`HtmlDiagnostic`, `HtmlDiagnosticCode`, `HtmlRenderLimits`, `HtmlUrlPolicy`,
`HtmlClasses`, `HtmlReadonly`, `HtmlReadonlyJson`, `HtmlDataGuard`,
`HtmlRenderContext`, `HtmlStandardProfile`, `HtmlProfileRegistration`,
`HtmlBlockRegistration`, `HtmlTuneRegistration`, `HtmlBlockRegistrations`,
`HtmlTuneRegistrations`.

- `invalid_document`: check the raw envelope, JSON values and unique IDs; remove
  your application envelope before rendering.
- `invalid_block_data`: inspect the diagnostic path and the profile table.
- `unknown_block` / `unknown_tune`: configure the exact saved name with a supported
  profile/registration, or use explicit preview. Do not rename a tool without migrating and validating its data.
- `invalid_tune_data`: correct the saved tune payload to match its registered guard.
- `missing_alt`: author meaningful plain alt or deliberately choose decorative `''`.
- `callback_failed`: check guard/renderer exceptions and synchronous boolean/string
  returns; callback exception details are deliberately not included in diagnostics.
- `unsafe_html`: remove disallowed markup/URLs or repair unclosed inline elements;
  inspect preview diagnostics without using the preview for publication.
- `limit_exceeded`: reduce content or choose a limit within the documented maximum.
- `invalid_configuration`: check option names, class tokens, origins and ceilings.
- `render_failed`: fail closed and report a minimal non-sensitive reproduction.
- Browser import failures: use a supported bundler and ensure package dependencies
  are installed. Node globals and editor/browser tool classes are not required.

Validation includes an adversarial corpus across built-ins, aliases, overrides,
custom blocks and tunes, plus parsed Chromium DOM, execution/request controls and
accessibility snapshots. This does not establish other browsers or Angular binding
compatibility; those need their own integration proof. Sanitizer upgrades require
rerunning the corpus. Use a normal flow container such as `div`, `article` or
`section`; never insert rendered output into scripts, styles, attributes, tables,
selects, paragraphs or interactive hosts. Output safety does not cover later DOM
mutation, host CSS, redirects or the contents/privacy of allowed external assets.

This package does not enforce meaningful headings, link text, authorization,
storage schemas, migrations or complete accessibility. It is not a complete
security audit or a substitute for host security controls. Report issues with
runtime/bundler versions and a minimal example at the
[issue tracker](https://github.com/anarchitects/anarchitecture-community/issues).

Licensed Apache-2.0. Runtime dependencies retain their own licenses; `sanitize-html`
is MIT. No upstream renderer implementation or authoring-tool code is vendored.
