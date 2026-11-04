import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { HtmlRendererOptions } from '../src/index.js';
import { api, paragraph } from './artifact';
const {
  EditorJsHtmlComponent,
  EditorJsHtmlDirective,
  provideEditorJsHtml,
  EDITOR_JS_HTML_CONFIG,
} = api;
const template = `<div class="directive" [aaEditorjsHtml]="data()" [aaEditorjsHtmlOptions]="options()"></div><aa-editorjs-html [data]="data()" [options]="options()" />`;
@Component({
  imports: [EditorJsHtmlComponent, EditorJsHtmlDirective],
  template,
})
class Host {
  readonly data = signal<unknown>(paragraph('Text'));
  readonly options = signal<HtmlRendererOptions | undefined>(undefined);
}
// Use a host with its own template so both APIs actually resolve the element provider.
@Component({
  imports: [EditorJsHtmlComponent, EditorJsHtmlDirective],
  providers: [provideEditorJsHtml({ classes: { paragraph: ['element'] } })],
  template,
})
class ElementHost extends Host {}
beforeAll(() =>
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()),
);
afterEach(() => TestBed.resetTestingModule());
const html = (fixture: { nativeElement: unknown }) =>
  [
    ...(fixture.nativeElement as HTMLElement).querySelectorAll(
      '.directive, .editorjs-html',
    ),
  ].map((e) => e.innerHTML);

describe('scoped immutable renderer configuration', () => {
  it('snapshots at provider creation and never mutates or retains caller-owned collections', async () => {
    const options = {
      classes: { paragraph: ['root'] },
      urls: { allowedOrigins: ['https://example.test'] },
    };
    const providers = provideEditorJsHtml(options);
    options.classes.paragraph[0] = 'mutated';
    options.urls.allowedOrigins.push('https://other.test');
    TestBed.configureTestingModule({ providers });
    const value = TestBed.inject(EDITOR_JS_HTML_CONFIG);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.classes?.paragraph)).toBe(true);
    expect(value.urls?.allowedOrigins).toEqual(['https://example.test']);
    const first = TestBed.createComponent(Host);
    const second = TestBed.createComponent(Host);
    await Promise.all([first.whenStable(), second.whenStable()]);
    expect(html(first)).toEqual([
      '<p class="root">Text</p>',
      '<p class="root">Text</p>',
    ]);
    first.componentInstance.options.set({
      classes: { paragraph: ['instance'] },
    });
    await first.whenStable();
    expect(html(first)[0]).toContain('instance');
    expect(html(second)[0]).toContain('root');
    expect(options.classes.paragraph).toEqual(['mutated']);
  });
  it('uses defaults, nearest element replacement, then defined instance values', async () => {
    TestBed.configureTestingModule({
      providers: provideEditorJsHtml({
        mode: 'preview',
        classes: { paragraph: ['root'] },
      }),
    });
    const parent = TestBed.createComponent(Host);
    const child = TestBed.createComponent(ElementHost);
    await Promise.all([parent.whenStable(), child.whenStable()]);
    expect(html(parent)[0]).toContain('root');
    expect(html(child)[0]).toContain('element');
    child.componentInstance.data.set({
      blocks: [{ type: 'unknown', data: {} }],
    });
    await child.whenStable();
    // Parent preview was replaced, not inherited by the element's complete config.
    expect(html(child)).toEqual(['', '']);
    child.componentInstance.options.set({ mode: 'preview' });
    child.componentInstance.data.set(paragraph('Local'));
    await child.whenStable();
    expect(html(child)[0]).toBe('<p class="element">Local</p>');
    child.componentInstance.options.set({ classes: {}, mode: undefined });
    await child.whenStable();
    expect(html(child)[0]).toBe('<p>Local</p>');
    child.componentInstance.options.set(undefined);
    await child.whenStable();
    expect(html(child)[0]).toContain('element');
  });
  it('replaces nested URL/limit/class objects and registration arrays without concatenation', async () => {
    TestBed.configureTestingModule({
      providers: provideEditorJsHtml({
        mode: 'preview',
        urls: { httpsOnly: true, allowRelative: false },
        limits: { maxBlocks: 1 },
        classes: { paragraph: ['root'], heading: ['heading'] },
        profiles: [{ name: 'body', profile: 'paragraph' }],
        tunes: [
          {
            name: 'flag',
            validate: (value): value is unknown => value !== undefined,
            ignore: true,
          },
        ],
      }),
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.componentInstance.options.set({
      mode: 'strict',
      urls: {},
      limits: {},
      classes: { paragraph: ['local'] },
      profiles: [],
      tunes: [],
    });
    fixture.componentInstance.data.set({
      blocks: [
        ...paragraph('<a href="/local">Local</a>').blocks,
        { type: 'header', data: { text: 'Heading', level: 2 } },
      ],
    });
    await fixture.whenStable();
    expect(html(fixture)[0]).toBe(
      '<p class="local"><a href="/local">Local</a></p><h2>Heading</h2>',
    );
    fixture.componentInstance.data.set({
      blocks: [{ type: 'body', data: { text: 'No inherited alias' } }],
    });
    await fixture.whenStable();
    expect(html(fixture)).toEqual(['', '']);
    fixture.componentInstance.data.set({
      blocks: [
        { type: 'paragraph', data: { text: 'No tune' }, tunes: { flag: {} } },
      ],
    });
    await fixture.whenStable();
    expect(html(fixture)).toEqual(['', '']);
  });
  it('preserves typed callback registrations and explicit per-instance replacement', async () => {
    const custom = provideEditorJsHtml<{ code: { text: string } }>({
      blocks: [
        {
          name: 'code',
          validate: (value): value is { text: string } =>
            !!value &&
            typeof value === 'object' &&
            'text' in value &&
            typeof value.text === 'string',
          render: (value, ctx) => `<pre>${ctx.escapeText(value.text)}</pre>`,
        },
      ],
    });
    TestBed.configureTestingModule({ providers: custom });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.data.set({
      blocks: [{ type: 'code', data: { text: '<literal>' } }],
    });
    await fixture.whenStable();
    expect(html(fixture)[0]).toBe('<pre>&lt;literal&gt;</pre>');
    fixture.componentInstance.options.set({ blocks: [] });
    await fixture.whenStable();
    expect(html(fixture)).toEqual(['', '']);
    fixture.componentInstance.options.set(undefined);
    await fixture.whenStable();
    expect(html(fixture)[0]).toContain('&lt;literal&gt;');
  });
  it('reports invalid configuration through the normal result path without running accessors', async () => {
    let reads = 0;
    const invalid = {
      get mode(): never {
        reads++;
        throw Error('must not run');
      },
    };
    TestBed.configureTestingModule({ providers: provideEditorJsHtml(invalid) });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    expect(html(fixture)).toEqual(['', '']);
    expect(reads).toBe(0);
    fixture.componentInstance.options.set({ mode: 'preview' });
    await fixture.whenStable();
    expect(html(fixture)).toEqual(['', '']);
  });
  it('fails invalid per-instance configurations and recovers to the provider', async () => {
    TestBed.configureTestingModule({
      providers: provideEditorJsHtml({ classes: { paragraph: ['root'] } }),
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const cycle: Record<string, unknown> = {};
    cycle['classes'] = cycle;
    for (const options of [
      cycle,
      { unknownOption: undefined },
      JSON.parse('{"__proto__":{"mode":"preview"}}'),
      { limits: { maxBlocks: 1001 } },
      { classes: { paragraph: ['bad token'] } },
      Object.defineProperty({}, 'mode', {
        enumerable: true,
        get() {
          throw Error('getter');
        },
      }),
    ]) {
      fixture.componentInstance.options.set(options as HtmlRendererOptions);
      await fixture.whenStable();
      expect(html(fixture)).toEqual(['', '']);
      fixture.componentInstance.options.set(undefined);
      await fixture.whenStable();
      expect(html(fixture)[0]).toContain('root');
    }
  });
  it('uses actual route providers and restores root policy on navigation', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideEditorJsHtml({ classes: { paragraph: ['root'] } }),
        provideRouter([
          {
            path: 'local',
            component: Host,
            providers: provideEditorJsHtml({
              classes: { paragraph: ['route'] },
            }),
          },
          { path: 'root', component: Host },
          {
            path: 'element',
            component: ElementHost,
            providers: provideEditorJsHtml({
              classes: { paragraph: ['route'] },
            }),
          },
        ]),
      ],
    });
    const router = await RouterTestingHarness.create();
    for (const [path, css] of [
      ['/local', 'route'],
      ['/root', 'root'],
      ['/element', 'element'],
      ['/local', 'route'],
    ]) {
      await router.navigateByUrl(path);
      await router.fixture.whenStable();
      expect(
        [
          ...(router.routeNativeElement as HTMLElement).querySelectorAll('p'),
        ].map((p) => p.className),
      ).toEqual([css, css]);
    }
  });
});
