import { describe, expect, it } from 'vitest';
import { renderEditorJsHtml } from '../src/index.js';
import {
  attacks,
  invalidFragments,
  routes,
  scenario,
} from './adversarial-fixtures.js';

describe('adversarial corpus across every output path', () => {
  for (const route of routes) {
    it.each(attacks)(`${route}: %s`, (_name, markup) => {
      const { input, options } = scenario(route, markup);
      const result = renderEditorJsHtml(input, options);
      expect(result.status).toBe('failure');
      expect(result).not.toHaveProperty('html');
      expect(
        result.diagnostics.some((item) => item.code === 'unsafe_html'),
      ).toBe(true);
      expect(renderEditorJsHtml(input, options)).toEqual(result);
      const preview = renderEditorJsHtml(input, {
        ...options,
        mode: 'preview',
      });
      expect(preview.status).toBe('preview');
      expect(preview.diagnostics.length).toBeGreaterThan(0);
    });
  }
  for (const route of ['custom', 'override', 'tune']) {
    it.each(invalidFragments)(
      `${route}: invalid content model %s`,
      (markup) => {
        const { input, options } = scenario(route, markup);
        expect(renderEditorJsHtml(input, options)).toMatchObject({
          status: 'failure',
          diagnostics: [{ code: 'unsafe_html' }],
        });
        expect(
          renderEditorJsHtml(input, { ...options, mode: 'preview' }),
        ).toMatchObject({
          status: 'preview',
          html: '',
          diagnostics: [{ code: 'unsafe_html' }],
        });
      },
    );
  }
});

describe('bounded work and semantic preservation', () => {
  it.each(['strict', 'preview'] as const)(
    'fails closed on real ceilings in %s',
    (mode) => {
      const oversized = [
        ' '.repeat(1024 * 1024 + 1),
        {
          blocks: Array.from({ length: 1001 }, () => ({
            type: 'paragraph',
            data: { text: '' },
          })),
        },
        { blocks: [{ type: 'paragraph', data: { text: '😀'.repeat(25601) } }] },
        {
          blocks: [],
          nested: Array.from({ length: 40 }).reduce<unknown>(
            (value) => [value],
            null,
          ),
        },
      ];
      for (const input of oversized) {
        const result = renderEditorJsHtml(input, { mode });
        expect(result).toMatchObject({
          status: 'failure',
          diagnostics: [{ code: 'limit_exceeded' }],
        });
        expect(result).not.toHaveProperty('html');
        expect(renderEditorJsHtml(input, { mode })).toEqual(result);
      }
      for (const route of ['paragraph', 'custom', 'tune']) {
        const { input, options } = scenario(
          route,
          '<b>'.repeat(1000) + 'x' + '</b>'.repeat(1000),
        );
        expect(renderEditorJsHtml(input, { ...options, mode })).toMatchObject({
          status: 'failure',
          diagnostics: [{ code: 'limit_exceeded', stage: 'limits' }],
        });
      }
      const custom = scenario('custom', 'x'.repeat(2 * 1024 * 1024 + 1));
      expect(
        renderEditorJsHtml(custom.input, { ...custom.options, mode }),
      ).toMatchObject({
        status: 'failure',
        diagnostics: [{ code: 'limit_exceeded' }],
      });
    },
  );
  it.each([
    '{',
    'null',
    '[]',
    '{"blocks":{}}',
    '{"blocks":[null]}',
    '{"blocks":[],"x":1e400}',
  ])('rejects malformed JSON/document %s deterministically', (input) => {
    const strict = renderEditorJsHtml(input);
    expect(strict).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'invalid_document' }],
    });
    expect(renderEditorJsHtml(input, { mode: 'preview' })).toEqual(strict);
  });
  it.each([
    '<figure><figcaption>First</figcaption><p>Content</p></figure>',
    '<figure><p>Content</p><figcaption>Last</figcaption></figure>',
    '<figure><figure><figcaption>Inner</figcaption></figure><figcaption>Outer</figcaption></figure>',
    '<ul> \n<li>Parent<ol><li>Child</li></ol></li> </ul>',
    '<a href="#safe"><section><h2>Linked section</h2></section></a>',
    '<pre><code>&lt;script&gt;literal&lt;/script&gt;</code></pre>',
    '<p><strong>B</strong><em>I</em><u>U</u><s>S</s><mark>M</mark><code>C</code><br />&amp;</p>',
  ])('preserves valid content models: %s', (markup) => {
    const { input, options } = scenario('custom', markup);
    expect(renderEditorJsHtml(input, options)).toEqual({
      status: 'success',
      html: markup,
      diagnostics: [],
    });
  });
  it('cannot hide invalid intermediate output with a later tune', () => {
    const { input, options } = scenario('custom', '<li>Orphan</li>');
    const result = renderEditorJsHtml(
      { blocks: [{ ...input.blocks[0], tunes: { repair: {} } }] },
      {
        ...options,
        mode: 'preview',
        tunes: [
          {
            name: 'repair',
            validate: (data): data is unknown => !!data,
            render: () => '<p>Repaired</p>',
          },
        ],
      },
    );
    expect(result).toMatchObject({
      status: 'preview',
      html: '',
      diagnostics: [{ code: 'unsafe_html' }],
    });
  });
});

describe('configuration preserves the safety floor', () => {
  it.each([
    'paragraph',
    'heading',
    'quote',
    'quoteLeft',
    'quoteCenter',
    'quoteCaption',
    'list',
    'listItem',
    'checklist',
    'image',
    'imageCaption',
    'imageBorder',
    'imageBackground',
    'imageStretched',
    'custom',
  ])('permits only configured tokens for %s, never saved CSS', (key) => {
    const { input, options } = scenario(
      'custom',
      '<div class="approved">Text</div>',
    );
    expect(
      renderEditorJsHtml(input, {
        ...options,
        classes: { [key]: ['approved'] },
      }),
    ).toMatchObject({
      status: 'success',
      html: '<div class="approved">Text</div>',
    });
    expect(
      renderEditorJsHtml(input, { ...options, classes: { [key]: [] } }).status,
    ).toBe('failure');
    expect(
      renderEditorJsHtml(input, {
        ...options,
        classes: { [key]: ['bad" onclick="run()'] },
      }),
    ).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'invalid_configuration' }],
    });
    const css = scenario(
      'custom',
      '<div class="approved" style="background:url(https://attack.invalid/css)">Text</div>',
    );
    expect(
      renderEditorJsHtml(css.input, {
        ...css.options,
        classes: { [key]: ['approved'] },
      }).status,
    ).toBe('failure');
  });
  it.each(['image', 'alias-image', 'custom', 'override', 'tune'])(
    '%s preserves plain alt and rejects image URL obfuscation',
    (route) => {
      for (const url of [
        'JaVaScRiPt:alert(1)',
        'java\tscript:alert(1)',
        'javascript%3aalert(1)',
        '/%5cattack.invalid',
        'data:image/svg+xml,x',
        'https://user:secret@attack.invalid/x',
        '//attack.invalid/x',
      ]) {
        const fixture = scenario(route, `<img src="${url}" alt="">`);
        if (route.endsWith('image'))
          fixture.input.blocks[0].data = {
            file: { url },
            alt: '',
            caption: '',
            withBorder: false,
            withBackground: false,
            stretched: false,
          };
        expect(
          renderEditorJsHtml(fixture.input, fixture.options),
        ).toMatchObject({
          status: 'failure',
          diagnostics: [{ code: 'unsafe_html' }],
        });
      }
    },
  );
  it('does not allow mailto for images or HTTP under httpsOnly', () => {
    for (const src of [
      'mailto:editor@example.com',
      'http://assets.invalid/x',
    ]) {
      const { input, options } = scenario(
        'custom',
        `<img src="${src}" alt="">`,
      );
      expect(
        renderEditorJsHtml(input, {
          ...options,
          urls: { allowMailto: true, httpsOnly: true },
        }).status,
      ).toBe('failure');
    }
  });
});
