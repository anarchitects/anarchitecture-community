import { describe, expect, it } from 'vitest';
import {
  createEditorJsHtmlRenderer,
  renderEditorJsHtml,
  type HtmlRendererOptions,
} from '../src/index.js';
const paragraph = (text: string) => ({ type: 'paragraph', data: { text } });
const document = (...blocks: unknown[]) => ({ version: '2.31.7', blocks });

describe('semantic rendering and result ownership', () => {
  it('renders paragraphs, exact heading levels and separate quote captions', () => {
    expect(
      renderEditorJsHtml(
        document(
          paragraph('A & B <b>bold</b><br><i>italic</i>'),
          { type: 'header', data: { text: 'Title', level: 2 } },
          {
            type: 'quote',
            data: {
              text: 'Quotation',
              caption: 'Author <em>name</em>',
              alignment: 'center',
            },
          },
        ),
      ),
    ).toEqual({
      status: 'success',
      diagnostics: [],
      html: '<p>A &amp; B <b>bold</b><br /><i>italic</i></p><h2>Title</h2><figure><blockquote class="editorjs-quote-center"><p>Quotation</p></blockquote><figcaption>Author <em>name</em></figcaption></figure>',
    });
  });
  it('handles empty documents explicitly and retains preview status even without omissions', () => {
    expect(renderEditorJsHtml({ blocks: [] })).toEqual({
      status: 'success',
      html: '',
      diagnostics: [],
    });
    expect(renderEditorJsHtml({ blocks: [] }, { mode: 'preview' })).toEqual({
      status: 'preview',
      html: '',
      diagnostics: [],
    });
  });
  it('accepts stored JSON, does not mutate decoded content, and repeats deterministically', () => {
    const input = document(
      paragraph('<mark>Marker</mark> <a href="/blog?q=1&amp;sort=2">link</a>'),
    );
    const before = JSON.stringify(input);
    const first = renderEditorJsHtml(input);
    expect(first.status).toBe('success');
    expect(renderEditorJsHtml(input)).toEqual(first);
    expect(renderEditorJsHtml(before)).toEqual(first);
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each([
    'image',
    'list',
    'code',
    'heading',
    'toString',
    'constructor',
    '__proto__',
  ])(
    'diagnoses unsupported saved name %s with no successful prefix',
    (type) => {
      const result = renderEditorJsHtml(
        document(paragraph('Before'), { type, data: {} }, paragraph('After')),
      );
      expect(result.status).toBe('failure');
      expect(result).not.toHaveProperty('html');
      expect(result.diagnostics[0]).toMatchObject({
        code: 'unknown_block',
        blockIndex: 1,
        type,
        path: ['blocks', 1, 'type'],
      });
    },
  );
  it('skips entire unknown, malformed and tuned blocks only in explicit preview', () => {
    const result = renderEditorJsHtml(
      document(
        paragraph('Before'),
        { type: 'header', data: { text: 'No clamp', level: 99 } },
        {
          type: 'paragraph',
          data: { text: 'Tuned' },
          tunes: { flag: { flagged: true } },
        },
        { type: 'missing', data: {} },
        paragraph('After'),
      ),
      { mode: 'preview' },
    );
    expect(result).toMatchObject({
      status: 'preview',
      html: '<p>Before</p><p>After</p>',
    });
    expect(result.diagnostics.map((d) => d.code)).toEqual([
      'invalid_block_data',
      'unknown_tune',
      'unknown_block',
    ]);
  });
  it.each([
    {},
    { blocks: null },
    { blocks: [{ type: 'paragraph', data: null }] },
    '{broken',
    {
      blocks: [
        { id: 'a', ...paragraph('a') },
        { id: 'a', ...paragraph('b') },
      ],
    },
  ])('fails invalid envelopes even in preview: %j', (input) => {
    const result = renderEditorJsHtml(input, { mode: 'preview' });
    expect(result.status).toBe('failure');
    expect(result).not.toHaveProperty('html');
    expect(result.diagnostics[0].code).toBe('invalid_document');
  });
  it.each([
    { type: 'paragraph', data: { text: 1 } },
    { type: 'header', data: { text: 'x', level: 1.5 } },
    { type: 'header', data: { text: 'x', level: 0 } },
    { type: 'quote', data: { text: 'x', caption: 2, alignment: 'left' } },
    { type: 'quote', data: { text: 'x', caption: 'a', alignment: 'right' } },
  ])('rejects invalid saved profile %j', (block) => {
    expect(renderEditorJsHtml(document(block))).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'invalid_block_data' }],
    });
  });
  it('captures independent options and clears failure state on the next call', () => {
    const classes = ['first'];
    const options: HtmlRendererOptions = { classes: { paragraph: classes } };
    const first = createEditorJsHtmlRenderer(options);
    classes[0] = 'mutated';
    const second = createEditorJsHtmlRenderer({
      classes: { paragraph: ['second'] },
    });
    const input = document(paragraph('Hi'));
    expect(first.render(input)).toMatchObject({
      html: '<p class="first">Hi</p>',
    });
    expect(second.render(input)).toMatchObject({
      html: '<p class="second">Hi</p>',
    });
    expect(first.render(null).status).toBe('failure');
    expect(first.render(input).status).toBe('success');
  });
  it('does not evaluate accessors, toJSON or inherited saved data', () => {
    let reads = 0;
    const input = {
      get blocks() {
        reads++;
        return [];
      },
      toJSON() {
        reads++;
        return { blocks: [] };
      },
    };
    expect(renderEditorJsHtml(input).status).toBe('failure');
    expect(reads).toBe(0);
    expect(renderEditorJsHtml(Object.create({ blocks: [] })).status).toBe(
      'failure',
    );
    const cyclic: Record<string, unknown> = { blocks: [] };
    cyclic['self'] = cyclic;
    expect(renderEditorJsHtml(cyclic).status).toBe('failure');
  });
  it('enforces byte, block, depth, string and output ceilings in both modes', () => {
    const cases: [unknown, HtmlRendererOptions][] = [
      [
        JSON.stringify(document(paragraph('hello'))),
        { limits: { maxInputBytes: 10 } },
      ],
      [document(paragraph('a'), paragraph('b')), { limits: { maxBlocks: 1 } }],
      [document(paragraph('hello')), { limits: { maxDepth: 2 } }],
      [
        document(paragraph('😀'.repeat(30))),
        { limits: { maxStringBytes: 100 } },
      ],
      [document(paragraph('hello')), { limits: { maxOutputBytes: 5 } }],
    ];
    for (const [input, options] of cases)
      for (const mode of ['strict', 'preview'] as const) {
        const result = renderEditorJsHtml(input, { ...options, mode });
        expect(result).toMatchObject({
          status: 'failure',
          diagnostics: [{ code: 'limit_exceeded' }],
        });
        expect(result).not.toHaveProperty('html');
      }
  });
  it('bounds diagnostics, retains document order and does not disclose saved text', () => {
    const result = renderEditorJsHtml(
      document(
        ...Array.from({ length: 4 }, () => ({
          type: 'paragraph',
          data: { text: 42 },
        })),
      ),
      { limits: { maxDiagnostics: 2 } },
    );
    expect(result.diagnostics.map((d) => d.code)).toEqual([
      'invalid_block_data',
      'invalid_block_data',
      'diagnostics_truncated',
    ]);
    expect(result.diagnostics.slice(0, 2).map((d) => d.blockIndex)).toEqual([
      0, 1,
    ]);
    expect(JSON.stringify(result)).not.toContain('42');
  });
  it.each([
    { mode: 'unsafe' },
    { limits: { maxBlocks: 1001 } },
    { limits: { maxDepth: 0 } },
    { classes: { paragraph: ['x" onload="bad'] } },
    { urls: { allowedOrigins: ['https://example.com/path'] } },
    { sanitize: false },
  ])('fails invalid configuration without throwing: %j', (options) => {
    expect(
      renderEditorJsHtml(
        document(paragraph('Hi')),
        options as HtmlRendererOptions,
      ),
    ).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'invalid_configuration' }],
    });
  });
});
