import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import {
  EditorJsHtmlComponent,
  EditorJsHtmlDirective,
  provideEditorJsHtml,
} from '@anarchitects/editorjs-html-angular';
import {
  renderEditorJsHtml,
  type HtmlRendererOptions,
} from '@anarchitects/editorjs-html';
import {
  attacks,
  routes,
  scenario,
  invalidFragments,
  imageData,
} from './adversarial-fixtures';

@Component({
  selector: 'aa-corpus',
  imports: [EditorJsHtmlComponent, EditorJsHtmlDirective],
  providers: [provideEditorJsHtml()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main id="corpus" [attr.data-ready]="ready()">
    @for (entry of cases; track entry.name) {
      <section
        class="case"
        [attr.data-name]="entry.name"
        [attr.data-status]="entry.result.status"
        [attr.data-html]="
          entry.result.status === 'failure' ? '' : entry.result.html
        "
      >
        <aa-editorjs-html
          [data]="entry.input"
          [options]="entry.options"
          #component
        />
        <article
          [aaEditorjsHtml]="entry.input"
          [aaEditorjsHtmlOptions]="entry.options"
          #directive="aaEditorjsHtml"
        ></article>
        <output
          >{{ component.result().status }}/{{
            directive.result().status
          }}</output
        >
      </section>
    }
  </main>`,
})
export class Corpus {
  readonly ready = signal(false);
  readonly cases = createCases();
  constructor() {
    afterNextRender(() => this.ready.set(true));
  }
}
function createCases() {
  const cases: {
    name: string;
    input: unknown;
    options: HtmlRendererOptions;
    result: ReturnType<typeof renderEditorJsHtml>;
  }[] = [];
  const add = (
    name: string,
    input: unknown,
    options: HtmlRendererOptions,
    status: string,
  ) => {
    const result = renderEditorJsHtml(input, options);
    if (result.status !== status) throw Error(`${name}: expected ${status}`);
    cases.push({ name, input, options, result });
  };
  for (const route of routes)
    for (const [name, markup] of attacks) {
      const { input, options } = scenario(route, markup);
      add(`${route}/${name}/strict`, input, options, 'failure');
      for (const narrowed of [false, true])
        add(
          `${route}/${name}/preview/${narrowed}`,
          input,
          {
            ...options,
            mode: 'preview',
            ...(narrowed
              ? { urls: { allowedOrigins: ['https://assets.invalid'] } }
              : {}),
          },
          'preview',
        );
    }
  for (const route of ['custom', 'override', 'tune'])
    for (const [index, markup] of invalidFragments.entries()) {
      const { input, options } = scenario(route, markup);
      add(
        `${route}/fragment/${index}`,
        input,
        { ...options, mode: 'preview' },
        'preview',
      );
    }
  for (const alt of ['A mountain', '', undefined]) {
    const { alt: omitted, ...image } = imageData();
    void omitted;
    const input = {
      blocks: [
        {
          type: 'image',
          data: {
            ...image,
            ...(alt === undefined ? {} : { alt }),
            caption: 'Caption is not alt',
          },
        },
      ],
    };
    add(
      `alt/${String(alt)}`,
      input,
      {},
      alt === undefined ? 'failure' : 'success',
    );
    if (alt === undefined)
      add('alt/missing-preview', input, { mode: 'preview' }, 'preview');
  }
  const semantic = {
    blocks: [
      { type: 'header', data: { text: 'Semantic heading', level: 2 } },
      {
        type: 'quote',
        data: { text: 'Quotation', caption: 'Attribution', alignment: 'left' },
      },
      {
        type: 'list',
        data: {
          style: 'ordered',
          meta: { start: 3, counterType: 'upper-roman' },
          items: [
            {
              content: 'Parent',
              meta: { start: 2, counterType: 'lower-alpha' },
              items: [{ content: 'Child', meta: {}, items: [] }],
            },
          ],
        },
      },
      {
        type: 'list',
        data: {
          style: 'checklist',
          meta: {},
          items: [{ content: 'Done', meta: { checked: true }, items: [] }],
        },
      },
      {
        type: 'code',
        data: { code: '<script>literal</script>' },
        tunes: { flag: { flagged: true } },
      },
    ],
  };
  add(
    'semantics',
    semantic,
    {
      blocks: [
        {
          name: 'code',
          validate: (d): d is { code: string } =>
            !!d &&
            typeof d === 'object' &&
            'code' in d &&
            typeof d.code === 'string',
          render: (d, ctx) =>
            `<pre><code>${ctx.escapeText((d as { readonly code: string }).code)}</code></pre>`,
        },
      ],
      tunes: [
        {
          name: 'flag',
          validate: (d): d is { flagged: boolean } =>
            !!d &&
            typeof d === 'object' &&
            'flagged' in d &&
            typeof d.flagged === 'boolean',
          render: (html) => `<aside>${html}</aside>`,
        },
      ],
    },
    'success',
  );
  return cases;
}
