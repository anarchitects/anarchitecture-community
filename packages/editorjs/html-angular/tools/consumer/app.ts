import { ScopedArticleComponent } from './examples/scoped-article.component';
import { RouterOutlet, type Routes } from '@angular/router';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  makeStateKey,
  REQUEST,
  signal,
  TransferState,
} from '@angular/core';
import {
  EditorJsHtmlComponent,
  EditorJsHtmlDirective,
  provideEditorJsHtml,
  type HtmlRendererOptions,
  type HtmlRenderResult,
} from '@anarchitects/editorjs-html-angular';
import { ArticleComponent } from './examples/article.component';
import { PreviewComponent } from './examples/preview.component';
@Component({
  selector: 'aa-element-policy',
  imports: [EditorJsHtmlComponent, EditorJsHtmlDirective],
  providers: [provideEditorJsHtml({ classes: { paragraph: ['element'] } })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section id="element-directive" [aaEditorjsHtml]="data"></section>
    <aa-editorjs-html id="element-component" [data]="data" />`,
})
class ElementPolicy {
  readonly data = {
    blocks: [{ type: 'paragraph', data: { text: 'Element policy' } }],
  };
}
const key = makeStateKey<string>('article');
const paragraph = (text: string) => ({
  blocks: [{ type: 'paragraph', data: { text } }],
});
@Component({
  selector: 'aa-article',
  imports: [
    EditorJsHtmlComponent,
    EditorJsHtmlDirective,
    ElementPolicy,
    ScopedArticleComponent,
    ArticleComponent,
    PreviewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <main [attr.data-hydrated]="hydrated()">
    <aa-editorjs-html
      id="primary"
      [data]="data()"
      [options]="options()"
      (resultChange)="result.set($event)"
    />
    <aa-editorjs-html
      id="secondary"
      [data]="second"
      [options]="secondOptions"
    />
    <article
      id="directive"
      class="host-owned"
      aria-label="Directive article"
      data-owner="consumer"
      [aaEditorjsHtml]="data()"
      [aaEditorjsHtmlOptions]="options()"
      (aaEditorjsHtmlResultChange)="directiveResult.set($event)"
    ></article>
    <div id="route-directive" [aaEditorjsHtml]="second"></div>
    <aa-editorjs-html id="route-component" [data]="second" />
    <aa-element-policy />
    <output id="component-result">{{ result()?.status }}</output>
    <output id="directive-result">{{ directiveResult()?.status }}</output>
    <button (click)="update()">Update</button>
    <button (click)="invalid()">Invalid</button>
    <button (click)="recover()">Recover</button>
    <button (click)="preview()">Preview</button>
    <button (click)="empty()">Empty</button>
    <button (click)="attack()">Unsafe preview</button>
    <button (click)="customAttack()">Unsafe custom</button>
    <app-article /><app-preview /><app-scoped-article />
  </main>`,
})
export class App {
  private readonly state = inject(TransferState);
  private readonly request = inject(REQUEST);
  private readonly name = this.state.get(
    key,
    this.request
      ? new URL(this.request.url).pathname.slice(1) || 'first'
      : 'first',
  );
  readonly hydrated = signal(false);
  readonly data = signal<unknown>({
    blocks: [
      { type: 'header', data: { text: `Article ${this.name}`, level: 2 } },
      {
        type: 'paragraph',
        data: { text: 'Read <a href="/article">article</a>' },
      },
      {
        type: 'list',
        data: {
          style: 'ordered',
          meta: { start: 3, counterType: 'upper-roman' },
          items: [{ content: 'Third', meta: {}, items: [] }],
        },
      },
      {
        type: 'image',
        data: {
          file: { url: 'https://assets.invalid/photo.png' },
          alt: 'Blue boat',
          caption: 'At sea',
          withBorder: false,
          withBackground: false,
          stretched: false,
        },
      },
    ],
  });
  readonly options = signal<HtmlRendererOptions>({
    classes: { paragraph: ['primary'] },
  });
  readonly secondOptions = { classes: { paragraph: ['secondary'] } };
  readonly second = paragraph('Independent');
  readonly result = signal<HtmlRenderResult | undefined>(undefined);
  readonly directiveResult = signal<HtmlRenderResult | undefined>(undefined);
  constructor() {
    this.state.set(key, this.name);
    afterNextRender(() => this.hydrated.set(true));
  }
  update() {
    this.data.set(paragraph('Updated'));
    this.options.set({ classes: { paragraph: ['changed'] } });
  }
  invalid() {
    this.data.set(paragraph('<img src=x onerror="globalThis.__attack=true">'));
  }
  recover() {
    this.data.set(paragraph('Recovered'));
  }
  preview() {
    this.options.set({ ...this.options(), ...{ mode: 'preview' as const } });
    this.data.set({
      blocks: [
        ...paragraph('Preview kept').blocks,
        { type: 'unknown', data: {} },
      ],
    });
  }
  attack() {
    this.options.set({ mode: 'preview' });
    this.data.set(
      paragraph(
        '<a href="javascript:globalThis.__attack=true">Link</a><b onclick="globalThis.__attack=true">Safe text</b><img src="/x" onerror="globalThis.__attack=true">',
      ),
    );
  }
  customAttack() {
    this.options.set({
      blocks: [
        {
          name: 'unsafe',
          validate: (value): value is unknown => !!value,
          render: () =>
            '<svg onload="globalThis.__attack=true"></svg><img src="/x" onerror="globalThis.__attack=true">',
        },
      ],
    });
    this.data.set({ blocks: [{ type: 'unsafe', data: {} }] });
  }
  empty() {
    this.data.set({ blocks: [] });
  }
}

@Component({
  selector: 'aa-root',
  imports: [RouterOutlet, EditorJsHtmlDirective, EditorJsHtmlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div id="root-directive" [aaEditorjsHtml]="data"></div>
    <aa-editorjs-html id="root-component" [data]="data" /><router-outlet />`,
})
export class Shell {
  readonly data = paragraph('Application policy');
}
export const routes: Routes = [
  {
    path: 'first',
    component: App,
    providers: provideEditorJsHtml({ classes: { paragraph: ['route-first'] } }),
  },
  {
    path: 'second',
    component: App,
    providers: provideEditorJsHtml({
      classes: { paragraph: ['route-second'] },
    }),
  },
  { path: '**', component: App },
];
