import { describe, expect, it } from 'vitest';
import { renderEditorJsHtml } from '../src/index.js';
const input = (text: string) => ({
  blocks: [{ type: 'paragraph', data: { text } }],
});
const unsafe = [
  '<img src=x onerror="globalThis.__executed=true">',
  '<script>globalThis.__executed=true</script>',
  '<b onclick="globalThis.__executed=true">bold</b>',
  '<svg><a xlink:href="javascript:alert(1)">svg</a></svg>',
  '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<mark style="background:url(javascript:alert(1))">mark</mark>',
  '<span class="saved-class">text</span>',
  '<b>unclosed',
  '<b><i>misnested</b></i>',
  '<p>block inside inline field</p>',
];
describe('common HTML safety boundary', () => {
  it('orders same-block field diagnostics by path before truncation', () => {
    const result = renderEditorJsHtml(
      {
        blocks: [
          {
            type: 'quote',
            data: {
              text: '<script>bad()</script>',
              caption: '<img src=x>',
              alignment: 'left',
            },
          },
        ],
      },
      { limits: { maxDiagnostics: 1 } },
    );
    expect(result.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['unsafe_html', ['blocks', 0, 'data', 'caption']],
      ['diagnostics_truncated', []],
    ]);
  });
  it.each(unsafe)(
    'rejects unsafe or repaired markup in strict mode: %s',
    (text) => {
      const result = renderEditorJsHtml(input(text));
      expect(result.status).toBe('failure');
      expect(result).not.toHaveProperty('html');
      expect(result.diagnostics.some((d) => d.code === 'unsafe_html')).toBe(
        true,
      );
    },
  );
  it.each([
    'javascript:alert(1)',
    'jav&#x61;script:alert(1)',
    'java&#10;script:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,x',
    'vbscript:bad',
    'file:///etc/passwd',
    'blob:https://example.com/id',
    '//example.com',
    '\\\\example.com',
    '/%5cexample.com',
    'javascript%3aalert(1)',
    ' https://example.com',
    'https://user:password@example.com',
  ])('rejects obfuscated/disallowed URL %s', (href) => {
    const result = renderEditorJsHtml(input(`<a href="${href}">link</a>`));
    expect(result.status).toBe('failure');
    const preview = renderEditorJsHtml(input(`<a href="${href}">link</a>`), {
      mode: 'preview',
    });
    expect(preview).toMatchObject({
      status: 'preview',
      html: '<p><a>link</a></p>',
    });
  });
  it.each([
    'https://example.com/path',
    'http://example.com',
    '/blog',
    'blog/post',
    '../post',
    '#heading',
    '?page=2',
  ])('preserves permitted URL %s', (href) => {
    expect(
      renderEditorJsHtml(input(`<a href="${href}">link</a>`)),
    ).toMatchObject({
      status: 'success',
      html: `<p><a href="${href}">link</a></p>`,
    });
  });
  it('enforces narrowed origin/scheme/relative policy and opt-in mailto', () => {
    expect(
      renderEditorJsHtml(input('<a href="http://example.com">link</a>'), {
        urls: { httpsOnly: true },
      }).status,
    ).toBe('failure');
    expect(
      renderEditorJsHtml(input('<a href="/blog">link</a>'), {
        urls: { allowRelative: false },
      }).status,
    ).toBe('failure');
    expect(
      renderEditorJsHtml(
        input('<a href="https://other.example/blog">link</a>'),
        { urls: { allowedOrigins: ['https://example.com'] } },
      ).status,
    ).toBe('failure');
    expect(
      renderEditorJsHtml(input('<a href="https://example.com/blog">link</a>'), {
        urls: { allowedOrigins: ['https://example.com'] },
      }).status,
    ).toBe('success');
    expect(
      renderEditorJsHtml(input('<a href="mailto:editor@example.com">mail</a>'))
        .status,
    ).toBe('failure');
    expect(
      renderEditorJsHtml(
        input('<a href="mailto:editor@example.com">mail</a>'),
        { urls: { allowMailto: true } },
      ).status,
    ).toBe('success');
  });
  it('reports transformations in preview and applies the same policy to captions', () => {
    const result = renderEditorJsHtml(
      {
        blocks: [
          {
            type: 'quote',
            data: {
              text: '<b>Safe</b>',
              caption: 'Author <img src=x onerror=alert(1)>',
              alignment: 'left',
            },
          },
        ],
      },
      { mode: 'preview' },
    );
    expect(result).toMatchObject({
      status: 'preview',
      html: '<figure><blockquote class="editorjs-quote-left"><p><b>Safe</b></p></blockquote><figcaption>Author </figcaption></figure>',
    });
    expect(result.diagnostics[0].path).toEqual([
      'blocks',
      0,
      'data',
      'caption',
    ]);
  });
  it('does not flag harmless entity, quote, tag case or void-element serialization', () => {
    expect(
      renderEditorJsHtml(
        input(
          "<B>bold &amp; clear</B><br/><a href='/blog' title='Read'>link</a>",
        ),
      ),
    ).toMatchObject({
      status: 'success',
      html: '<p><b>bold &amp; clear</b><br /><a href="/blog" title="Read">link</a></p>',
    });
  });
  it('diagnoses sanitizer removal even when custom policy allows the attribute name', () => {
    expect(
      renderEditorJsHtml(
        input('<a href="https://example.com" title="">link</a>'),
      ),
    ).toMatchObject({ status: 'failure' });
    expect(
      renderEditorJsHtml(input('<a href="/blog" target="_blank">link</a>'))
        .status,
    ).toBe('failure');
  });
});
