# @anarchitects/editorjs-html-angular

Standalone, display-only Angular component and host directive for Editor.js documents. They delegate rendering to `@anarchitects/editorjs-html`, then bind the resulting string through Angular's ordinary `[innerHTML]` sanitizer. Neither loads an editor, tools, Forms, a router, or hydration providers.

## Install and compatibility

```sh
npm install @anarchitects/editorjs-html-angular@0.0.1 @anarchitects/editorjs-html@0.0.1 @anarchitects/editorjs-core@0.0.1
```

Use Angular **22.1.4** (the exact peer baseline). This initial release is verified with Node **24.22.2**, TypeScript **6.0.3**, Angular compiler **22.1.4**, CLI/build **22.1.6**, and ng-packagr **22.1.1**. Production SSR and hydration are tested using those versions and Playwright Chromium **156.0.8078.4**. The declared Node engine follows Angular's supported floors; other Node/Angular combinations are not yet verified by this package. Other Angular versions are outside the verified peer contract.

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

`options` is an optional signal input containing the headless `HtmlRendererOptions<Blocks, Tunes>`. Each instance owns its renderer. Defined per-instance options overlay the nearest configuration provider as described below. Replace the document or options object identity to trigger an update; nested mutation is not observed. Options are snapshotted when their identity changes, so mutating old configuration does not affect subsequent document renders. Custom callbacks must be deterministic and synchronous; signals read inside callbacks are not tracked.

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

Built-in paragraph, header, quote, list-v2, and image profiles follow the [headless renderer contract](https://github.com/anarchitects/anarchitecture-community/tree/main/packages/editorjs/html#readme). Supply image `alt` explicitly: meaningful text for informative images, `''` only for intentionally decorative images. The component does not derive alt text from captions. Resource limits, URL policies, custom guards, escaping and tune order are owned by the headless renderer. Trusted callback code is not sandboxed. Ordinary image URLs can cause browser requests after rendering; the renderer itself does not fetch them.

## Render into an existing element

The directive owns **all children** of an otherwise empty `div`, `article` or `section`. Those three selectors are the supported host contract. Void elements, tables/selects, paragraphs/phrasing elements, interactive elements and custom component hosts are unsupported. Do not combine it with static/projected children, `ng-content`, another child-owning directive, `[innerHTML]`, `[textContent]` or a content-editable editor. Angular-managed children and projected views cannot safely share this ownership.

It does not add a wrapper or modify your host's `id`, classes, styles, ARIA or other attributes. Its qualified template bindings avoid collisions with other directives. The exported directive instance has the same `data`, `options`, `result` and `resultChange` members as the component.

<!-- example: directive-article.component.ts -->

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  EditorJsHtmlDirective,
  type HtmlRenderResult,
} from '@anarchitects/editorjs-html-angular';

@Component({
  selector: 'app-directive-article',
  imports: [EditorJsHtmlDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="article-body"
      aria-label="Article"
      [aaEditorjsHtml]="document()"
      (aaEditorjsHtmlResultChange)="rendered.set($event)"
      #display="aaEditorjsHtml"
    ></article>
    @if (display.result().status === 'failure') {
      <p role="status">This article cannot be displayed.</p>
    }
  `,
})
export class DirectiveArticleComponent {
  readonly document = signal<unknown>({
    blocks: [{ type: 'paragraph', data: { text: 'Directive article' } }],
  });
  readonly rendered = signal<HtmlRenderResult | undefined>(undefined);
}
```

`[aaEditorjsHtml]` supplies the required document; `[aaEditorjsHtmlOptions]` supplies optional per-instance renderer options. `(aaEditorjsHtmlResultChange)` reports the same strict/preview/failure result as the component. `#display="aaEditorjsHtml"` exposes the current readonly computed `result()` to templates. Empty, invalid, identity-change, snapshot and notification semantics match the component.

## Scoped rendering configuration

`provideEditorJsHtml(options)` returns an ordinary `Provider[]` for an application's providers, a route's providers or a component/directive's element providers. It configures only rendering; it does not install routing, hydration, HTTP, persistence, asset hosting or credentials.

Resolution is **headless defaults → nearest complete provider configuration → defined per-instance options**. The nearest provider replaces its parent wholesale; there is no multi-provider accumulation or parent fallback for missing fields. `provideEditorJsHtml()` explicitly resets that scope to defaults. Angular's normal injector lookup applies: element providers take priority over environment providers. Route configurations can outlive navigation, so no route-destruction guarantee is made.

Within an instance, the top-level fields `mode`, `limits`, `urls`, `classes`, `profiles`, `blocks` and `tunes` overlay the provider. An omitted or `undefined` field inherits it. **Nested objects and registration arrays replace whole values**, never recursively merge or concatenate. For example, `{classes:{paragraph:['local']}}` replaces all configured classes, with omitted class keys returning to headless defaults; `{classes:{}}` resets all classes to defaults. `{blocks:[]}` removes provider-supplied custom blocks. To intentionally combine registrations, construct the complete array yourself with array spread; duplicate/override rules still apply. Per-instance policy cannot exceed the headless safety ceilings.

Providers snapshot and freeze plain configuration records/arrays when the helper is called. Inputs are snapshotted when their identity changes. Caller objects are never frozen or mutated. Callbacks retain their function identity and remain trusted application code; mutable state captured by callbacks is your responsibility. Accessors, cyclic configuration, non-plain records and excessive configuration structures fail closed. Snapshot inspection is bounded to 32 levels, 1,000 array entries and 10,000 values, in addition to the headless configuration limits. Semantic option validation and all rendering diagnostics remain headless-owned. Invalid configuration yields normal `failure` results with no HTML; preview does not bypass it.

`EDITOR_JS_HTML_CONFIG` is a typed `InjectionToken<HtmlRendererOptions>` for reading the nearest configuration. Prefer the helper over handwritten `useValue` providers so provisioning captures immutable values. Without a provider, both presentations use headless defaults; optional direct token injection returns `null`. The token stores configuration only, never document/results/request state.

This element-scoped example affects its child directive and component equally:

<!-- example: scoped-article.component.ts -->

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  EditorJsHtmlComponent,
  provideEditorJsHtml,
} from '@anarchitects/editorjs-html-angular';
import { DirectiveArticleComponent } from './directive-article.component';

@Component({
  selector: 'app-scoped-article',
  imports: [EditorJsHtmlComponent, DirectiveArticleComponent],
  providers: [
    provideEditorJsHtml({ classes: { paragraph: ['element-text'] } }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aa-editorjs-html [data]="document" /><app-directive-article />`,
})
export class ScopedArticleComponent {
  readonly document = {
    blocks: [{ type: 'paragraph', data: { text: 'Scoped component' } }],
  };
}
```

For a route scope, pass the exported routes to your host's existing `provideRouter` call. A route provider does not imply lazy delivery:

<!-- example: article.routes.ts -->

```ts
import type { Routes } from '@angular/router';
import { provideEditorJsHtml } from '@anarchitects/editorjs-html-angular';
import { DirectiveArticleComponent } from './directive-article.component';

export const articleRoutes: Routes = [
  {
    path: 'article',
    component: DirectiveArticleComponent,
    providers: [
      provideEditorJsHtml({ classes: { paragraph: ['route-text'] } }),
    ],
  },
];
```

For an application scope, add `provideEditorJsHtml(...)` to the host's application providers, identically on server and client when using SSR.

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

## Public API

The root exports `EditorJsHtmlComponent`, `EditorJsHtmlDirective`, `provideEditorJsHtml`, `EDITOR_JS_HTML_CONFIG` and the `HtmlRendererOptions`, `HtmlRenderResult`, `HtmlDiagnostic` types. Import additional headless contracts from `@anarchitects/editorjs-html`. There are no supported deep imports.

For contributor checks and exact package/SSR evidence, see the [validation record](https://github.com/anarchitects/anarchitecture-community/blob/main/docs/editorjs-html-angular-directive-validation.md).

## Troubleshooting

- **Unknown directive binding:** import `EditorJsHtmlDirective` into the consuming standalone component and use one of its three supported host elements. Do not suppress the error with a schema.
- **Blank content:** inspect `result().status`/`diagnostics` or the result-change output. Strict failure clears the old HTML. Fix invalid data, missing image alt, unsupported names or malformed configuration before retrying.
- **Changed object has no effect:** replace its identity; nested mutation is intentionally not reactive. Replace an input to recover from invalid instance options. A provider snapshot is immutable for its injector lifetime; correct the provider and recreate its owner to change it.
- **Unexpected provider policy:** Angular searches element injectors before environment injectors. A nearer element or route provider replaces the complete parent configuration, and instance options take precedence. The helper does not install a global mutable registry.
- **Styling missing:** use global host-owned CSS and allowed configured classes. Generated descendants are not Angular templates and do not inherit emulated parent style attributes.
- **Hydration mismatch:** keep server/client data and configuration identical and remove competing children/bindings. The library does not install hydration or require a skip-hydration workaround.

For other package problems, [report an issue](https://github.com/anarchitects/anarchitecture-community/issues) with versions and a minimal reproduction, excluding private document content.
