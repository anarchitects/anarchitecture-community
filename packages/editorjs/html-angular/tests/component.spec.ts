import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderEditorJsHtml } from '@anarchitects/editorjs-html';
import type { HtmlRendererOptions, HtmlRenderResult } from '../src/index.js';

// Use ngc's published signal-input metadata, not Vite's decorator transform.
const { EditorJsHtmlComponent } = createRequire(import.meta.url)(
  resolve(
    import.meta.dirname,
    '../dist/fesm2022/anarchitects-editorjs-html-angular.mjs',
  ),
) as typeof import('../src/index.js');
const paragraph = (text: string) => ({
  blocks: [{ type: 'paragraph', data: { text } }],
});
function mount<Blocks extends object = Record<string, unknown>>(
  data: unknown,
  options?: HtmlRendererOptions<Blocks>,
) {
  const fixture = TestBed.createComponent(EditorJsHtmlComponent);
  const events: HtmlRenderResult[] = [];
  fixture.componentInstance.resultChange.subscribe((result) =>
    events.push(result),
  );
  fixture.componentRef.setInput('data', data);
  if (options) fixture.componentRef.setInput('options', options);
  const container = () =>
    (fixture.nativeElement as HTMLElement).querySelector(
      '.editorjs-html',
    ) as HTMLElement;
  return { fixture, events, container };
}
beforeAll(() =>
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()),
);
afterEach(() => TestBed.resetTestingModule());

describe('EditorJsHtmlComponent compiled Angular DOM', () => {
  it('renders defaults and reports the current readonly result', async () => {
    const { fixture, events, container } = mount(
      JSON.stringify(paragraph('Hello <b>reader</b>')),
    );
    await fixture.whenStable();
    expect(container().innerHTML).toBe('<p>Hello <b>reader</b></p>');
    expect(events).toEqual([fixture.componentInstance.result()]);
    expect(fixture.componentInstance.result()).toEqual(
      renderEditorJsHtml(paragraph('Hello <b>reader</b>')),
    );
  });
  it.each([
    undefined,
    null,
    {},
    '{',
    paragraph('<img src=x onerror=alert(1)>'),
  ])('clears old HTML on invalid input %j and recovers', async (invalid) => {
    const { fixture, events, container } = mount(paragraph('Old'));
    await fixture.whenStable();
    const owner = container();
    fixture.componentRef.setInput('data', invalid);
    await fixture.whenStable();
    expect(container()).toBe(owner);
    expect(owner.innerHTML).toBe('');
    expect(events.at(-1)?.status).toBe('failure');
    expect(events.at(-1)).not.toHaveProperty('html');
    fixture.componentRef.setInput('data', paragraph('Recovered'));
    await fixture.whenStable();
    expect(owner.innerHTML).toBe('<p>Recovered</p>');
    expect(events.at(-1)?.status).toBe('success');
    fixture.componentRef.setInput('data', { blocks: [] });
    await fixture.whenStable();
    expect(owner.innerHTML).toBe('');
    expect(events.at(-1)).toEqual({
      status: 'success',
      html: '',
      diagnostics: [],
    });
  });
  it('keeps preview explicitly incomplete with diagnostics', async () => {
    const { fixture, container, events } = mount(
      { blocks: [...paragraph('Kept').blocks, { type: 'unknown', data: {} }] },
      { mode: 'preview' },
    );
    await fixture.whenStable();
    expect(container().innerHTML).toBe('<p>Kept</p>');
    expect(events.at(-1)?.status).toBe('preview');
    expect(events.at(-1)?.diagnostics[0].code).toBe('unknown_block');
    fixture.componentRef.setInput('options', { mode: 'strict' });
    await fixture.whenStable();
    expect(container().innerHTML).toBe('');
  });
  it('snapshots options by identity and isolates simultaneous instances', async () => {
    const options = { classes: { paragraph: ['one'] } };
    const a = mount(paragraph('A'), options);
    const b = mount(paragraph('B'), { classes: { paragraph: ['two'] } });
    await Promise.all([a.fixture.whenStable(), b.fixture.whenStable()]);
    options.classes.paragraph[0] = 'mutated';
    a.fixture.componentRef.setInput('data', paragraph('Next'));
    await a.fixture.whenStable();
    expect(a.container().innerHTML).toBe('<p class="one">Next</p>');
    a.fixture.componentRef.setInput('options', { ...options });
    await a.fixture.whenStable();
    expect(a.container().innerHTML).toBe('<p class="mutated">Next</p>');
    expect(b.container().innerHTML).toBe('<p class="two">B</p>');
    a.fixture.componentRef.setInput('options', {
      classes: { paragraph: ['not valid'] },
    });
    await a.fixture.whenStable();
    expect(a.container().innerHTML).toBe('');
    a.fixture.componentRef.setInput('options', undefined);
    await a.fixture.whenStable();
    expect(a.container().innerHTML).toBe('<p>Next</p>');
  });
  it('requires new document identity and coalesces updates before stabilization', async () => {
    const data = paragraph('Original');
    const { fixture, container, events } = mount(data);
    await fixture.whenStable();
    data.blocks[0].data.text = 'Mutated';
    fixture.componentRef.setInput('data', data);
    await fixture.whenStable();
    expect(container().innerHTML).toBe('<p>Original</p>');
    fixture.componentRef.setInput('data', paragraph('Intermediate'));
    fixture.componentRef.setInput('data', { ...data });
    await fixture.whenStable();
    expect(container().innerHTML).toBe('<p>Mutated</p>');
    expect(events).toHaveLength(2);
  });
  it('does not subscribe to signals read by callbacks or output listeners', async () => {
    const external = signal('First');
    let calls = 0;
    const { fixture, container, events } = mount(
      { blocks: [{ type: 'custom', data: {} }] },
      {
        blocks: [
          {
            name: 'custom',
            validate: (value): value is unknown => !!value,
            render: () => {
              calls++;
              return `<p>${external()}</p>`;
            },
          },
        ],
      },
    );
    fixture.componentInstance.resultChange.subscribe(() => external());
    await fixture.whenStable();
    external.set('Second');
    await fixture.whenStable();
    expect(calls).toBe(1);
    expect(events).toHaveLength(1);
    expect(container().innerHTML).toBe('<p>First</p>');
    fixture.destroy();
    external.set('After destroy');
    expect(events).toHaveLength(1);
  });
  it('preserves heading, list counters, links, figure captions and authored alt text', async () => {
    const data = {
      blocks: [
        { type: 'header', data: { text: 'Title', level: 2 } },
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
            alt: 'A blue boat',
            caption: 'At sea',
            withBorder: false,
            withBackground: false,
            stretched: false,
          },
        },
      ],
    };
    const { fixture, container } = mount(data);
    await fixture.whenStable();
    expect(fixture.componentInstance.result().status).toBe('success');
    expect(container().querySelector('h2')?.textContent).toBe('Title');
    expect(container().querySelector('a')?.getAttribute('href')).toBe(
      '/article',
    );
    expect(container().querySelector('ol')?.getAttribute('start')).toBe('3');
    expect(container().querySelector('ol')?.getAttribute('type')).toBe('I');
    expect(container().querySelector('img')?.getAttribute('alt')).toBe(
      'A blue boat',
    );
    expect(container().querySelector('figcaption')?.textContent).toBe('At sea');
  });
  it('applies an explicit built-in override and contains callback failures', async () => {
    let fail = false;
    const { fixture, container } = mount(paragraph('Title'), {
      blocks: [
        {
          name: 'paragraph',
          override: true,
          validate: (value): value is { text: string } =>
            !!value &&
            typeof value === 'object' &&
            'text' in value &&
            typeof value.text === 'string',
          render: (value, context) => {
            if (fail) throw Error('Host callback failed');
            return `<h3>${context.escapeText(value.text)}</h3>`;
          },
        },
      ],
    });
    await fixture.whenStable();
    expect(container().innerHTML).toBe('<h3>Title</h3>');
    fail = true;
    fixture.componentRef.setInput('data', paragraph('Next'));
    await fixture.whenStable();
    expect(container().innerHTML).toBe('');
    expect(fixture.componentInstance.result().diagnostics[0].code).toBe(
      'callback_failed',
    );
    fail = false;
    fixture.componentRef.setInput('data', paragraph('Recovered'));
    await fixture.whenStable();
    expect(container().innerHTML).toBe('<h3>Recovered</h3>');
  });
  it('rejects unsafe custom markup before Angular binding', async () => {
    const { fixture, container } = mount(
      { blocks: [{ type: 'custom', data: {} }] },
      {
        blocks: [
          {
            name: 'custom',
            validate: (value): value is unknown => !!value,
            render: () => '<p onclick="alert(1)">Unsafe</p>',
          },
        ],
      },
    );
    await fixture.whenStable();
    expect(container().innerHTML).toBe('');
    expect(fixture.componentInstance.result().status).toBe('failure');
  });
});
