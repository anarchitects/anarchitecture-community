# @anarchitects/editorjs-tool-image

Typed image definitions, structural saved-data validation and a browser adapter
for Editor.js. Uploading belongs to your application. The tool adds independently
authored alternative text to the upstream image/caption/display controls.

## Install and compatibility

```sh
npm install @anarchitects/editorjs-core @anarchitects/editorjs-tool-image @editorjs/editorjs@2.31.7
```

ESM; Node >=22.12.0 for the neutral entry. This package pins `@editorjs/image`
2.10.3 and peers with Editor.js 2.31.7. The browser entry requires DOM libraries
and Bundler resolution for upstream declarations. Chromium is the browser tested
in the packed generic and Angular standalone consumers. Angular 22.1.4,
TypeScript 6.0.3 and Node 24.15.0 are the reference Angular consumer. Angular is
optional and is not a dependency of this package.

The root exports `defineImageTool`, `validateImageData`, `ImageConfig<Input,
FileData>`, `ImageData`, `ImageFile` and `ImageToolOptions`. It evaluates no browser
code and imports no DOM, upstream tool or Angular declarations. `/browser`
exports `ImageTool`. Loading it evaluates upstream `window` access and installs
global styles; import it only in the browser. No stylesheet import is required.

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

## Upload and configuration contract

`ImageConfig<Input, FileData>` uses core's `ImageUploader<Input, FileData>`, which
combines `FileUploader` and `UrlUploader`. Both `uploadByFile` and `uploadByUrl`
are required, including for read-only editors. Explicitly reject an unsupported
operation; leaving a method out fails configuration validation and never selects
an endpoint fallback. The browser input is **Blob**, including File. Pasted blob
URLs can produce a Blob without a filename; adapt File-only services explicitly.

Methods keep their original receiver. Synchronous throws and rejected promises
enter upstream's failure notifier. `success: 0` becomes an Error whose `cause`
retains the optional host error. Success must be `success: 1` with a nonblank
string `file.url` and JSON-compatible file metadata. Metadata is copied through
core's bounded JSON normalization, preserved in saved data, and never assigned a
backend-specific shape. Malformed responses fail visibly; no success is fabricated.

Optional config: `types` (file-picker hint, default `image/*`),
`captionPlaceholder` (default `Caption`), `buttonContent` (trusted button HTML),
and `features` with boolean `border`, `background`, `stretch`, and boolean or
`'optional'` `caption`. Other configuration keys are rejected. These are UI
controls, not file-content validation. No endpoint/header/request-body/action
configuration, HTTP implementation, credentials, storage, URL-fetch service,
retry loop or Forms pending/error state is supplied.

Hosts must validate file content/size, permitted URL schemes/origins, authorization
and durable URL lifetime. Captions can contain inline HTML; sanitize for the target
renderer. Treat button HTML as trusted configuration. Structural validation does
not make HTML or URLs safe. This slice supports images; upstream's incidental
`.mp4` video rendering is not an accessible video-authoring contract.

## Alternative text and saved data

Each image has labelled native controls: **Image purpose** and **Alternative
text**, grouped under **Image alternative text**. Labels use Editor.js i18n.
Select Describe image and enter a description, or explicitly choose Decorative.
A caption is visible supporting text or attribution; alternative text describes
the image’s purpose for readers who cannot see it. Caption remains independent;
filenames, captions and uploaded metadata never
supply alternative text automatically.

- Missing `alt`: unset, including legacy upstream data. Editing preserves unset
  until the author makes a choice. An empty description also remains unset.
- Nonblank `alt`: authored description, preserved literally as plain text.
- `alt: ""`: deliberately decorative. Only choosing Decorative creates this state.
- `null`, nonstrings and whitespace-only descriptions are invalid saved data.

`ImageData` requires `file.url`, string `caption`, and boolean `withBorder`,
`withBackground`, `stretched`; `alt` is optional. `file` accepts additional JSON
metadata. Validators accept additional JSON block fields, but the editor only
preserves documented fields and file metadata. The validator never fills defaults
or migrates legacy data. New blank editor blocks use upstream defaults and are
excluded from saves until an image exists.

Alt survives uploads, saving, rendering and read-only transitions. In read-only
mode both alt controls are disabled and the upstream caption is noneditable.
Alt is also applied to the editor's image elements. This does not supply a public
content renderer. Host renderers should set `image.alt = data.alt` when present,
including the deliberate empty string, or use their framework's escaped attribute
binding. Never interpolate alt into HTML. Establish an explicit publication policy
for unset alt; do not silently treat unset as decorative or infer it from caption.

## Direct lazy browser owner

<!-- image-example-file: image-definition.ts -->

```ts
import {
  defineImageTool,
  type ImageConfig,
} from '@anarchitects/editorjs-tool-image';
import type { ImageUploader } from '@anarchitects/editorjs-core';

export function imageDefinition(uploader: ImageUploader<Blob>) {
  const config: ImageConfig<Blob> = { uploader, features: { caption: true } };
  return defineImageTool({
    source: 'lazy',
    load: () =>
      import('@anarchitects/editorjs-tool-image/browser').then(
        (m) => m.ImageTool,
      ),
    settings: { config },
  });
}
```

<!-- image-example-file: image-editor.ts -->

```ts
import {
  composeToolRegistry,
  createToolResolver,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  type ImageUploader,
} from '@anarchitects/editorjs-core';
import { imageDefinition } from './image-definition';

export async function mountImageEditor(
  holder: HTMLElement,
  uploader: ImageUploader<Blob>,
) {
  const resolver = createToolResolver(
    composeToolRegistry([[imageDefinition(uploader)]], {
      profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
    }),
  );
  let editor: import('@editorjs/editorjs').default | undefined;
  try {
    const [{ default: EditorJS }, tools] = await Promise.all([
      import('@editorjs/editorjs'),
      resolver.resolve(),
    ]);
    editor = new EditorJS({ holder, tools });
    await editor.isReady;
    return {
      editor,
      destroy: () => {
        resolver.dispose();
        editor?.destroy();
      },
    };
  } catch (error) {
    resolver.dispose();
    editor?.destroy?.();
    throw error;
  }
}
```

Call `mountImageEditor(holder, uploader)` with an attached holder and your
implementation of both upload methods. On success, `await owner.editor.save()`
returns Editor.js JSON; validate it before storage or rendering, and call
`owner.destroy()` when finished. Catch both mount and save rejections in your UI.
Call after the holder exists in the browser, catch initialization errors, and
coordinate an in-flight mount with your host's lifetime. Each owner needs its own
resolver. To use eager loading, statically import `ImageTool` from `/browser` and
pass `{ source: 'eager', registration: { class: ImageTool, config } }` to the helper,
then `createToolMap` over the composed registry. Eager imports immediately execute
browser code. `name` defaults to `image`; choose an alias explicitly and use the
same name in saved blocks and validation. The helper never silently replaces a
profile tool. A selected definition does not change the host's default block.

## Validate before persistence or rendering

<!-- image-example-file: image-validation.ts -->

```ts
import { validateOutputData } from '@anarchitects/editorjs-core';
import { validateImageData } from '@anarchitects/editorjs-tool-image';

export function validateImages(value: unknown) {
  return validateOutputData(value, {
    toolValidators: new Map([['image', validateImageData]]),
    unknownTools: 'reject',
  });
}
```

Add validators for every other saved block name in a mixed document. Results carry
relative field paths (prefixed at document level). Validation is synchronous and
nonmutating, including cyclic, accessor, non-JSON and excessively deep inputs.
Applications own migrations and any requirement that all images have authored alt.

## Angular standalone

Install `@anarchitects/editorjs-angular` separately. Supply your application uploader
when bootstrapping; this component uses the same root definition and lazy loader.

<!-- image-angular-example-file: image-app.ts -->

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { EditorJs, provideEditorJsTools } from '@anarchitects/editorjs-angular';
import type { ImageUploader } from '@anarchitects/editorjs-core';
import { imageDefinition } from './image-definition';

@Component({
  selector: 'app-root',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<h1 id="label">Article images</h1><aa-editorjs aria-labelledby="label" />',
})
export class ImageApp {}

export function startImageApp(uploader: ImageUploader<Blob>) {
  return bootstrapApplication(ImageApp, {
    providers: [provideEditorJsTools([imageDefinition(uploader)])],
  });
}
```

The host HTML needs `<app-root></app-root>`. Call
`startImageApp(uploader).catch(...)` from the browser application entry and report
bootstrap errors to the user. Install the Angular wrapper with its required
Angular 22 peers; Forms is needed only when using the optional `/forms` entry.

Omit `config.tools` to use providers; an explicit map, including `{}`, has full-map
precedence. Provider factories can capture injected uploader services before
creating definitions. SSR imports only neutral roots and inert definitions;
never resolve the browser loader on the server. Hosts own hydration and authoring
route delivery. Remount to change tool configuration. Optional native Forms uses
the existing Angular `/forms` API; upload failure is a notifier event, not an
initialization error or automatic form validity/pending state.

## Failure recovery

Invalid config throws `TypeError` before activation. A failed lazy tool import
rejects the direct resolver with core's `load-failed`; an explicit subsequent
`resolve()` retries while that resolver is alive. The mount recipe above disposes
its resolver on failure: retry by calling `mountImageEditor` for a new owner.
For Angular initialization failure, show the wrapper error and explicitly recreate
the editor owner. Changing the provider or config on an existing owner is not a
retry mechanism. Upload failures use upstream's notifier and leave the selection
UI available for another author action; retries and upload-state UI belong to the
host. Disposing an owner prevents stale activation but does not cancel host work.

## Removal and resource lifetime

The adapter uses upstream public constructor/render/save/settings/paste methods
and Editor.js removed/destroy hooks. It disconnects its observer and control
listeners and suppresses late upstream notifications after removal. Uploaders and
alt state are per instance; there is no shared global upload cache.

On either success or failure, the adapter saves the current caption/display settings and rebuilds
the upstream view through its public constructor/render methods. This prevents a
late FileReader preview from hiding a fast completed upload or leaving a failed upload stuck in its preloader. Alt controls remain
in place. The upstream image/caption view is replaced, so an active caption
selection may be lost when an upload completes. File metadata and alt bypass
Editor.js HTML cleaning; caption retains the enabled inline-tool sanitizer rules.
Hosts still own safe rendering of all metadata and URL policy.

Upstream has no public cancellation/destroy facility. Already-started host uploads,
FileReader previews, pasted blob fetches and detached upstream image work can
finish after removal. Their promises settle normally; this package does not
cancel host mutations, unload downloaded modules/styles, or hide unfinished work
in never-settling promises. Hosts own abort policy, object-URL revocation and
external resources. A removed editor is not revived by completion. Shared upload
transports, retries and optional upload-state composition belong to host services.

## License

Repository-owned adapter code is Apache-2.0. The separately installed upstream
`@editorjs/image` dependency is MIT licensed; its implementation is not vendored.
