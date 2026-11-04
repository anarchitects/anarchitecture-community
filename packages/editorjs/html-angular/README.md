# @anarchitects/editorjs-html-angular

A standalone, display-only Angular component for Editor.js documents. It delegates rendering to `@anarchitects/editorjs-html`, then binds the resulting string through Angular's ordinary `[innerHTML]` sanitizer. It does not load an editor, tools, Forms, a router, or hydration providers.

## Install and compatibility

```sh
npm install @anarchitects/editorjs-html-angular@0.0.1 @anarchitects/editorjs-html@0.0.1 @anarchitects/editorjs-core@0.0.1
```

Use Angular **22.1.4** (the exact peer baseline). This initial release is verified with Node **24.22.2**, TypeScript **6.0.3**, Angular compiler **22.1.4**, CLI/build **22.1.6**, and ng-packagr **22.1.1**. Production SSR and hydration are tested using those versions and Playwright Chromium **156.0.8078.4**. The declared Node engine follows Angular's supported floors; other Node/Angular combinations are not yet verified by this package. Broader compatibility coverage belongs to #687.

The published artifact is an Angular Package Format library with partial compilation. Its runtime dependencies are the headless renderer and ng-packagr's `tslib`; Angular core is a peer. The headless package privately uses `sanitize-html`. No authoring package or `@editorjs/*` dependency is required.

## Display a document

This complete standalone component can be imported into an existing Angular host. Replace `document` with your loaded Editor.js data; no Editor.js constructor is involved.

<!-- example: article.component.ts -->

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  EditorJsHtmlComponent,
  type HtmlRenderResult,
} from '@anarchitects/editorjs-html-angular';

@Component({
  selector: 'app-article',
  imports: [EditorJsHtmlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aa-editorjs-html
      [data]="document()"
      (resultChange)="rendered.set($event)"
    />
    @if (rendered()?.status === 'failure') {
      <p role="status">This article cannot be displayed.</p>
    }
  `,
})
export class ArticleComponent {
  readonly document = signal<unknown>({
    blocks: [{ type: 'paragraph', data: { text: 'Hello <b>reader</b>.' } }],
  });
  readonly rendered = signal<HtmlRenderResult | undefined>(undefined);
}
```

`data` is a required `InputSignal<unknown>` accepting a decoded document or JSON string. Explicit `undefined`, malformed input, or strict rendering failure clears the owned container. An empty `{ blocks: [] }` document succeeds with empty HTML. Replacing invalid data with valid data renders again.

`options` is an optional signal input containing the headless `HtmlRendererOptions<Blocks, Tunes>`. Each instance owns its renderer. Replace the document or options object identity to trigger an update; nested mutation is not observed. Options are snapshotted when their identity changes, so mutating old configuration does not affect subsequent document renders. Custom callbacks must be deterministic and synchronous; signals read inside callbacks are not tracked.

`result` is a readonly computed signal of `HtmlRenderResult`. `resultChange` emits that result when Angular stabilizes the component effect, including the first result. Multiple input writes before stabilization can coalesce; this is not a lossless operation stream. Subscribers are not reactive dependencies, and Angular destroys the effect/output subscriptions with the component. Do not throw from an output listener or continuously change inputs in response to every notification.

## Preview and per-instance configuration

<!-- example: preview.component.ts -->

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  EditorJsHtmlComponent,
  type HtmlRendererOptions,
} from '@anarchitects/editorjs-html-angular';

@Component({
  selector: 'app-preview',
  imports: [EditorJsHtmlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aa-editorjs-html [data]="document" [options]="options" />`,
})
export class PreviewComponent {
  readonly document = {
    blocks: [{ type: 'code', data: { text: '<literal text>' } }],
  };
  readonly options: HtmlRendererOptions<{ code: { text: string } }> = {
    mode: 'preview',
    classes: { custom: ['article-code'] },
    blocks: [
      {
        name: 'code',
        validate: (value): value is { text: string } =>
          !!value &&
          typeof value === 'object' &&
          'text' in value &&
          typeof value.text === 'string',
        render: (data, context) =>
          `<pre class="article-code">${context.escapeText(data.text)}</pre>`,
      },
    ],
  };
}
```

Strict mode is the default: failure exposes diagnostics and **no HTML**. Preview always reports `status: 'preview'`, even without diagnostics; it may omit unsupported blocks or remove unsafe content. Never treat preview as publication approval. The headless result is available for diagnostics; Angular may further sanitize its HTML at the DOM boundary. This component never calls `bypassSecurityTrustHtml`, builds a second parser, or constructs DOM nodes manually.

Built-in paragraph, header, quote, list-v2, and image profiles follow the [headless renderer contract](../html/README.md). Supply image `alt` explicitly: meaningful text for informative images, `''` only for intentionally decorative images. The component does not derive alt text from captions. Resource limits, URL policies, custom guards, escaping and tune order are owned by the headless renderer. Trusted callback code is not sandboxed. Ordinary image URLs can cause browser requests after rendering; the renderer itself does not fetch them.

## SSR and hydration

Use the same document and options on server and client, with a fresh application instance per request. The host configures hydration; the library never registers it. For the `ArticleComponent` above, the complete client and server entry points are:

<!-- example: main.ts -->

```ts
import {
  bootstrapApplication,
  provideClientHydration,
} from '@angular/platform-browser';
import { ArticleComponent } from './article.component';

bootstrapApplication(ArticleComponent, {
  providers: [provideClientHydration()],
}).catch(console.error);
```

<!-- example: main.server.ts -->

```ts
import {
  bootstrapApplication,
  provideClientHydration,
  type BootstrapContext,
} from '@angular/platform-browser';
import { provideServerRendering, withRoutes, RenderMode } from '@angular/ssr';
import { ArticleComponent } from './article.component';

export default (context: BootstrapContext) =>
  bootstrapApplication(
    ArticleComponent,
    {
      providers: [
        provideClientHydration(),
        provideServerRendering(
          withRoutes([{ path: '**', renderMode: RenderMode.Server }]),
        ),
      ],
    },
    context,
  );
```

These entries belong in an Angular application configured with the application builder and an SSR HTTP host. The HTML document must contain `<app-article></app-article>`. Install the matching host `@angular/platform-browser`, `@angular/platform-server` and `@angular/ssr` packages; they are not library dependencies. Use your host's transfer-state/data-loading strategy for request-specific content. Do not rewrite the component's HTML before hydration or opt out with `ngSkipHydration` to mask mismatches.

Normal Angular binding may replace the generated innerHTML descendants during hydration even when the markup is identical. The component host and owned container are reused; descendant node identity is not a public contract.

The owned DOM is `<aa-editorjs-html><div class="editorjs-html">…</div></aa-editorjs-html>`. There is no content projection or editor lifecycle. Style generated content using your application's global stylesheet, scoped under `aa-editorjs-html .editorjs-html` or trusted configured classes; parent emulated component styles do not reach innerHTML descendants. Do not rely on `::ng-deep`. Heading levels, authored alt text and link text remain the document author's responsibility.

## Public API and verification

The root exports `EditorJsHtmlComponent` and the `HtmlRendererOptions`, `HtmlRenderResult`, `HtmlDiagnostic` types. Import additional headless contracts from `@anarchitects/editorjs-html`. There are no supported deep imports. A host directive and scoped DI defaults are separate work in #686; this version accepts per-instance options only.

From the repository, run:

```sh
yarn nx build editorjs-html-angular
yarn nx run editorjs-html-angular:typecheck
yarn nx lint editorjs-html-angular
yarn nx test editorjs-html-angular
yarn nx run editorjs-html-angular:packed-smoke
```

The uncached packed smoke installs actual core, renderer and APF tarballs into a temporary consumer, compiles every TypeScript example above, builds production SSR/client bundles, checks server HTML, and hydrates in Chromium. It checks host/container reuse and identical HTML, request/instance isolation, updates, failure clearing/recovery, semantics and absence of authoring dependencies. Hosted DTE is not part of this local proof.
