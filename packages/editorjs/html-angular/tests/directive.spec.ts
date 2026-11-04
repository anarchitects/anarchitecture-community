import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  SecurityContext,
  Sanitizer,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By, DomSanitizer } from '@angular/platform-browser';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderEditorJsHtml } from '@anarchitects/editorjs-html';
import type { HtmlRendererOptions, HtmlRenderResult } from '../src/index.js';
import { api, paragraph } from './artifact';
const { EditorJsHtmlComponent, EditorJsHtmlDirective } = api;
@Component({
  imports: [EditorJsHtmlComponent, EditorJsHtmlDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <article
      id="article"
      class="host-owned"
      aria-label="Article"
      [attr.data-owner]="owner()"
      [aaEditorjsHtml]="data()"
      [aaEditorjsHtmlOptions]="options()"
      (aaEditorjsHtmlResultChange)="events.push($event)"
      #display="aaEditorjsHtml"
    ></article>
    <aa-editorjs-html [data]="data()" [options]="options()" />
    <output>{{ display.result().status }}</output>`,
})
class Host {
  readonly data = signal<unknown>(paragraph('First <b>render</b>'));
  readonly options = signal<HtmlRendererOptions | undefined>(undefined);
  readonly owner = signal('original');
  readonly events: HtmlRenderResult[] = [];
}
beforeAll(() =>
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()),
);
afterEach(() => TestBed.resetTestingModule());
async function mount() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const article = (fixture.nativeElement as HTMLElement).querySelector(
    'article',
  ) as HTMLElement;
  const directive = fixture.debugElement
    .query(By.directive(EditorJsHtmlDirective))
    .injector.get(EditorJsHtmlDirective);
  const component = fixture.debugElement.query(
    By.directive(EditorJsHtmlComponent),
  ).componentInstance as InstanceType<typeof EditorJsHtmlComponent>;
  return {
    fixture,
    article,
    directive,
    component,
    host: fixture.componentInstance,
  };
}
describe('compiled host directive', () => {
  it('uses the same result/HTML as the component and preserves host-owned attributes', async () => {
    const { fixture, article, directive, component, host } = await mount();
    expect(article.innerHTML).toBe('<p>First <b>render</b></p>');
    expect(directive.result()).toEqual(component.result());
    expect(host.events).toEqual([directive.result()]);
    host.owner.set('updated');
    host.options.set({ classes: { paragraph: ['custom'] } });
    await fixture.whenStable();
    expect(article.id).toBe('article');
    expect(article.className).toBe('host-owned');
    expect(article.getAttribute('aria-label')).toBe('Article');
    expect(article.getAttribute('data-owner')).toBe('updated');
    expect(article.innerHTML).toBe('<p class="custom">First <b>render</b></p>');
  });
  it('passes both presentations through Angular HTML sanitization', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: Sanitizer, useExisting: DomSanitizer }],
    });
    const sanitize = vi.spyOn(TestBed.inject(DomSanitizer), 'sanitize');
    const { fixture, host } = await mount();
    expect(
      sanitize.mock.calls.filter(
        ([context, value]) =>
          context === SecurityContext.HTML &&
          value === '<p>First <b>render</b></p>',
      ),
    ).toHaveLength(2);
    sanitize.mockClear();
    host.data.set(paragraph('Next'));
    await fixture.whenStable();
    expect(
      sanitize.mock.calls.filter(
        ([context, value]) =>
          context === SecurityContext.HTML && value === '<p>Next</p>',
      ),
    ).toHaveLength(2);
    sanitize.mockRestore();
  });
  it('clears invalid replacements, recovers, and exposes incomplete preview consistently', async () => {
    const { fixture, article, directive, component, host } = await mount();
    for (const invalid of [
      null,
      undefined,
      {},
      '{',
      paragraph('<img src=x onerror=alert(1)>'),
    ]) {
      host.data.set(invalid);
      await fixture.whenStable();
      expect(article.innerHTML).toBe('');
      expect(directive.result().status).toBe('failure');
      expect(directive.result()).toEqual(component.result());
      host.data.set(paragraph('Recovered'));
      await fixture.whenStable();
      expect(article.textContent).toBe('Recovered');
    }
    host.options.set({ mode: 'preview' });
    host.data.set({
      blocks: [...paragraph('Kept').blocks, { type: 'unknown', data: {} }],
    });
    await fixture.whenStable();
    expect(directive.result()).toEqual(component.result());
    expect(host.events.at(-1)?.status).toBe('preview');
    expect(article.innerHTML).toBe('<p>Kept</p>');
    expect(directive.result().diagnostics[0].code).toBe('unknown_block');
    host.data.set({ blocks: [] });
    await fixture.whenStable();
    expect(article.innerHTML).toBe('');
    host.options.set(undefined);
    await fixture.whenStable();
    expect(directive.result().status).toBe('success');
  });
  it('retains supported headless semantics through host sanitization', async () => {
    const { fixture, article, directive, host } = await mount();
    const data = {
      blocks: [
        { type: 'header', data: { text: 'Title', level: 2 } },
        {
          type: 'quote',
          data: { text: 'Quote', caption: 'Attribution', alignment: 'center' },
        },
        {
          type: 'list',
          data: {
            style: 'ordered',
            meta: { start: 4, counterType: 'lower-alpha' },
            items: [{ content: 'Fourth', meta: {}, items: [] }],
          },
        },
        {
          type: 'image',
          data: {
            file: { url: 'https://assets.invalid/boat.png' },
            alt: 'Blue boat',
            caption: 'Caption',
            withBorder: true,
            withBackground: false,
            stretched: false,
          },
        },
      ],
    };
    host.data.set(data);
    await fixture.whenStable();
    const headless = renderEditorJsHtml(data);
    expect(directive.result()).toEqual(headless);
    expect(headless.status).toBe('success');
    const parsed = document.createElement('div');
    parsed.innerHTML = headless.status === 'failure' ? '' : headless.html;
    expect(article.innerHTML).toBe(parsed.innerHTML);
    expect(article.querySelector('ol')?.getAttribute('start')).toBe('4');
    expect(article.querySelector('ol')?.getAttribute('type')).toBe('a');
    expect(article.querySelector('img')?.getAttribute('alt')).toBe('Blue boat');
  });
  it('snapshots options, coalesces input changes and tears down notification effects', async () => {
    const { fixture, host, article } = await mount();
    const options = { classes: { paragraph: ['before'] } };
    host.options.set(options);
    await fixture.whenStable();
    options.classes.paragraph[0] = 'after';
    host.data.set(paragraph('Changed'));
    await fixture.whenStable();
    expect(article.querySelector('p')?.className).toBe('before');
    const count = host.events.length;
    host.options.set({ ...options });
    host.data.set(paragraph('Intermediate'));
    host.data.set(paragraph('Final'));
    await fixture.whenStable();
    expect(host.events.length).toBe(count + 1);
    expect(article.innerHTML).toBe('<p class="after">Final</p>');
    fixture.destroy();
    const destroyedCount = host.events.length;
    host.data.set(paragraph('Destroyed'));
    await TestBed.inject(ApplicationRef).whenStable();
    expect(host.events).toHaveLength(destroyedCount);
  });
  it.each(['div', 'section'])(
    'supports the %s container without adding wrapper elements',
    async (tag) => {
      const template = `<${tag} [aaEditorjsHtml]="data"></${tag}>`;
      @Component({
        imports: [EditorJsHtmlDirective],
        template,
      })
      class Container {
        readonly data = paragraph('Text');
      }
      const fixture = TestBed.createComponent(Container);
      await fixture.whenStable();
      const element = (fixture.nativeElement as HTMLElement).firstElementChild;
      expect(element?.tagName.toLowerCase()).toBe(tag);
      expect(element?.innerHTML).toBe('<p>Text</p>');
    },
  );
  it.each(['p', 'button', 'input', 'table', 'select'])(
    'rejects binding on unsupported %s hosts',
    (tag) => {
      const template =
        tag === 'input'
          ? '<input [aaEditorjsHtml]="data">'
          : `<${tag} [aaEditorjsHtml]="data"></${tag}>`;
      @Component({
        imports: [EditorJsHtmlDirective],
        template,
      })
      class InvalidHost {
        readonly data = paragraph('Text');
      }
      TestBed.configureTestingModule({ errorOnUnknownProperties: true });
      expect(() =>
        TestBed.createComponent(InvalidHost).detectChanges(),
      ).toThrow(/aaEditorjsHtml/);
    },
  );
});
