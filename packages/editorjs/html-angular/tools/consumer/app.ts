import { RouterOutlet } from '@angular/router';
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
  type HtmlRenderResult,
} from '@anarchitects/editorjs-html-angular';
import { ArticleComponent } from './examples/article.component';
import { PreviewComponent } from './examples/preview.component';
const key = makeStateKey<string>('article');
const paragraph = (text: string) => ({
  blocks: [{ type: 'paragraph', data: { text } }],
});
@Component({
  selector: 'aa-article',
  imports: [EditorJsHtmlComponent, ArticleComponent, PreviewComponent],
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
    <output>{{ result()?.status }}</output>
    <button (click)="update()">Update</button>
    <button (click)="invalid()">Invalid</button>
    <button (click)="recover()">Recover</button>
    <button (click)="preview()">Preview</button>
    <button (click)="empty()">Empty</button>
    <app-article /><app-preview />
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
  readonly options = signal({ classes: { paragraph: ['primary'] } });
  readonly secondOptions = { classes: { paragraph: ['secondary'] } };
  readonly second = paragraph('Independent');
  readonly result = signal<HtmlRenderResult | undefined>(undefined);
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
  empty() {
    this.data.set({ blocks: [] });
  }
}

@Component({
  selector: 'aa-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<router-outlet />',
})
export class Shell {}
