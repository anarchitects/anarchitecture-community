# @anarchitects/editorjs-html

Render supported Editor.js saved documents as safe, semantic HTML in Node or a
bundled browser application. Use it for public content and explicit previews
without loading an editor, browser tools, Angular or a CMS integration.

The current profile supports **paragraph**, **header** and **quote** saved names.
List, image, Code, custom blocks, configured aliases and tunes are not yet
supported; they produce diagnostics rather than disappearing silently.

## Installation and compatibility

```sh
npm install @anarchitects/editorjs-html
```

The package installs `@anarchitects/editorjs-core` and `sanitize-html` transitively.
No framework peers, authoring tools, stylesheets or Nx installation are required.
It exposes ESM JavaScript and TypeScript declarations at its package root, plus
`/package.json` metadata. Private subpaths are unsupported. There is no advertised
native CommonJS entry point.

Node **22.12.0+** is the runtime floor. Declarations use ES2022 types and are checked
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
was omitted. It skips whole unknown/invalid blocks and blocks with tunes, and
returns sanitized remainders for unsafe inline fields with diagnostics. Invalid
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

Text/caption fields allow `b`, `strong`, `i`, `em`, `u`, `s`, `mark`, `code`, `br`
and `a`. Anchors permit `href` and nonempty `title`. Plain text and entities are
serialized safely. Other tags/attributes, including saved classes, inline styles,
event handlers, images, forms, SVG/MathML, embedded documents and scripts, are
rejected in strict mode. Structurally repaired/unclosed inline elements are also
diagnosed. Harmless tag case, quote/entity spelling and br serialization normalize
without errors. HTML comments are non-rendering metadata and are omitted.

The same maintained sanitizer/policy handles inline fields and final formatted
output. There is no trusted-HTML bypass. No arbitrary renderer callback API is
exposed in this profile. Saved-shape validity alone does not prove HTML safety.

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
and `quoteCaption`. Each accepts at most 16 unique tokens, each starting with an
ASCII letter/underscore and continuing with letters, digits, underscore or hyphen
(up to 64 characters). The default quote alignment classes are
`editorjs-quote-left` and `editorjs-quote-center`; all other class lists default to
empty. An explicit list replaces its default, including `[]`. Supply host CSS for
these classes; no stylesheet or arbitrary inline-style option is shipped.

Links allow http(s) and relative/fragment URLs by default. `httpsOnly` restricts
absolute HTTP links; `allowRelative: false` rejects relative/fragment links.
`allowedOrigins` restricts absolute http(s) links to exact origins; an empty list
adds no origin restriction. Relative links retain the host document/base URL's
meaning, so disable them when an absolute-origin restriction must be exhaustive.
`allowMailto: true` explicitly permits mailto links. All controls default to false
except `allowRelative`, which defaults to true. Protocol-relative URLs, credentials,
backslashes, control/space characters and encoded control/protocol-separator tricks
are rejected. Host policy can narrow this boundary; it cannot enable script/data/
file/blob URLs. Link target/rel customization is not available; links do not
request new tabs. Hosts own navigation, CSP, privacy and rendering into an
appropriate block container; never concatenate untrusted HTML after rendering.

## Resource limits

| Option           | Default / maximum                                                       |
| ---------------- | ----------------------------------------------------------------------- |
| `maxInputBytes`  | 1,048,576 UTF-8 bytes, for raw JSON and its decoded JSON representation |
| `maxBlocks`      | 1,000                                                                   |
| `maxDepth`       | 32 JSON property/index levels from root                                 |
| `maxStringBytes` | 102,400 UTF-8 bytes per key or string                                   |
| `maxOutputBytes` | 2,097,152 accumulated formatted and sanitized UTF-8 bytes               |
| `maxDiagnostics` | 100 detailed diagnostics, then one truncation diagnostic                |

Limits accept positive integers no higher than these ceilings. Inline HTML has a
separate fixed nesting ceiling of 32 elements. Limits protect library work, not
transport parsing performed earlier by your server. Enforce request limits there
too. A lowered JSON-depth limit can exclude otherwise valid documents.

## Public exports and troubleshooting

Functions: `renderEditorJsHtml`, `createEditorJsHtmlRenderer`.
Types: `EditorJsHtmlRenderer`, `HtmlRendererOptions`, `HtmlRenderResult`,
`HtmlDiagnostic`, `HtmlDiagnosticCode`, `HtmlRenderLimits`, `HtmlUrlPolicy`,
`HtmlClasses`.

- `invalid_document`: check the raw envelope, JSON values and unique IDs; remove
  your application envelope before rendering.
- `invalid_block_data`: inspect the diagnostic path and the profile table.
- `unknown_block` / `unknown_tune`: use a supported saved profile or explicit
  preview. Do not rename a tool without migrating and validating its data.
- `unsafe_html`: remove disallowed markup/URLs or repair unclosed inline elements;
  inspect preview diagnostics without using the preview for publication.
- `limit_exceeded`: reduce content or choose a limit within the documented maximum.
- `invalid_configuration`: check option names, class tokens, origins and ceilings.
- `render_failed`: fail closed and report a minimal non-sensitive reproduction.
- Browser import failures: use a supported bundler and ensure package dependencies
  are installed. Node globals and editor/browser tool classes are not required.

This package does not enforce meaningful headings, link text, authorization,
storage schemas, migrations or complete accessibility. It is not a complete
security audit or a substitute for host security controls. Report issues with
runtime/bundler versions and a minimal example at the
[issue tracker](https://github.com/anarchitects/anarchitecture-community/issues).

Licensed Apache-2.0. Runtime dependencies retain their own licenses; `sanitize-html`
is MIT. No upstream renderer implementation or authoring-tool code is vendored.
