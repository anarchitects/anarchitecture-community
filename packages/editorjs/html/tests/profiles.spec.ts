import { describe, expect, it } from 'vitest';
import { validateListData } from '@anarchitects/editorjs-tool-list';
import { validateImageData } from '@anarchitects/editorjs-tool-image';
import { renderEditorJsHtml, type HtmlRendererOptions } from '../src/index.js';
const item = (content = 'Item', meta: object = {}, items: object[] = []) => ({
  content,
  meta,
  items,
});
const list = (
  style = 'unordered',
  meta: object = {},
  items: unknown[] = [item()],
) => ({ style, meta, items });
const image = (alt: string | undefined = 'A red\n<square>') => ({
  file: {
    url: 'https://example.com/image.png',
    id: 'url',
    meta: { width: 80, owned: true },
  },
  caption: 'Visible <b>caption</b>',
  withBorder: false,
  withBackground: false,
  stretched: false,
  ...(alt === undefined ? {} : { alt }),
});
const render = (type: string, data: unknown, options?: HtmlRendererOptions) =>
  renderEditorJsHtml({ blocks: [{ type, data }] }, options);

describe('standard saved profiles', () => {
  // Shapes asserted by the actual packed authoring flow in portable/list.spec.ts.
  it('preserves saved list-v2 nesting, ordered start, all counter variants and child metadata', () => {
    const data = list('ordered', { start: 3, counterType: 'upper-roman' }, [
      item('Parent', { start: 2, counterType: 'lower-alpha' }, [item('Child')]),
      item('Sibling'),
    ]);
    const before = JSON.stringify(data);
    expect(validateListData(data).ok).toBe(true);
    expect(render('list', data)).toEqual({
      status: 'success',
      diagnostics: [],
      html: '<ol start="3" type="I"><li>Parent<ol start="2" type="a"><li>Child</li></ol></li><li>Sibling</li></ol>',
    });
    expect(JSON.stringify(data)).toBe(before);
    for (const [counterType, type] of [
      ['numeric', '1'],
      ['upper-roman', 'I'],
      ['lower-roman', 'i'],
      ['upper-alpha', 'A'],
      ['lower-alpha', 'a'],
    ])
      expect(
        render(
          'list',
          list('ordered', { counterType }, [
            item('Parent', {}, [item('Child')]),
          ]),
        ),
      ).toMatchObject({
        html: `<ol type="${type}"><li>Parent<ol type="${type}"><li>Child</li></ol></li></ol>`,
      });
  });
  it('renders unordered and empty lists, and visible readonly checklist states', () => {
    expect(render('list', list())).toMatchObject({
      html: '<ul><li>Item</li></ul>',
    });
    expect(render('list', list('unordered', {}, []))).toMatchObject({
      html: '<ul></ul>',
    });
    const checklist = list('checklist', {}, [
      item('Parent', { checked: true }, [item('Child', { checked: false })]),
    ]);
    expect(validateListData(checklist).ok).toBe(true);
    expect(render('list', checklist)).toMatchObject({
      status: 'success',
      html: '<ul><li><span>[Completed] </span>Parent<ul><li><span>[Not completed] </span>Child</li></ul></li></ul>',
    });
  });
  it.each([
    {},
    list('bullet'),
    list('ordered', { start: 0 }),
    list('ordered', { counterType: 'decimal' }),
    list('unordered', {}, ['legacy']),
    list('unordered', {}, [{ text: 'legacy' }]),
    list('checklist'),
    list('unordered', {}, [{ ...item(), meta: [] }]),
    list('unordered', {}, [{ ...item(), items: 'wrong' }]),
  ])(
    'agrees with the public list validator on malformed generations: %j',
    (data) => {
      expect(validateListData(data).ok).toBe(false);
      expect(render('list', data)).toMatchObject({
        status: 'failure',
        diagnostics: [{ code: 'invalid_block_data' }],
      });
      expect(render('list', data, { mode: 'preview' })).toMatchObject({
        status: 'preview',
        html: '',
      });
    },
  );
  it('rejects mixed item styles and unrepresentable HTML counters explicitly', () => {
    for (const data of [
      list('ordered', { start: 2147483648 }),
      list('unordered', {}, [{ ...item(), style: 'ordered' }]),
    ])
      expect(render('list', data)).toMatchObject({
        status: 'failure',
        diagnostics: [{ code: 'invalid_block_data' }],
      });
  });
  it('bounds nested lists and accumulated formatting in both modes', () => {
    const data = list('unordered', {}, [item('Parent', {}, [item('Child')])]);
    for (const mode of ['strict', 'preview'] as const) {
      expect(
        render('list', data, { mode, limits: { maxListDepth: 1 } }),
      ).toMatchObject({
        status: 'failure',
        diagnostics: [
          {
            code: 'limit_exceeded',
            path: ['blocks', 0, 'data', 'items', 0, 'items'],
          },
        ],
      });
      expect(
        render('list', data, { mode, limits: { maxOutputBytes: 20 } }).status,
      ).toBe('failure');
    }
  });
  it('sanitizes each nested content path with precise diagnostics', () => {
    const data = list('unordered', {}, [
      item('Parent', {}, [item('<b>Child</b><script>secret</script>')]),
    ]);
    expect(render('list', data)).toMatchObject({
      status: 'failure',
      diagnostics: [
        {
          code: 'unsafe_html',
          path: ['blocks', 0, 'data', 'items', 0, 'items', 0, 'content'],
        },
      ],
    });
    expect(render('list', data, { mode: 'preview' })).toMatchObject({
      html: '<ul><li>Parent<ul><li><b>Child</b></li></ul></li></ul>',
    });
  });
  // file metadata, multiline plain alt and visual flags mirror portable/image.spec.ts.
  it('preserves authored plain alt, caption and visual flags without copying file metadata', () => {
    const data = {
      ...image(),
      withBorder: true,
      withBackground: true,
      stretched: true,
    };
    const before = JSON.stringify(data);
    expect(validateImageData(data).ok).toBe(true);
    expect(render('image', data)).toMatchObject({
      status: 'success',
      html: '<figure class="editorjs-image-border editorjs-image-background editorjs-image-stretched"><img src="https://example.com/image.png" alt="A red\n&lt;square&gt;" /><figcaption>Visible <b>caption</b></figcaption></figure>',
    });
    expect(JSON.stringify(data)).toBe(before);
    expect(render('image', { ...image(''), caption: '' })).toMatchObject({
      html: '<figure><img src="https://example.com/image.png" alt="" /></figure>',
    });
  });
  it.each([undefined, '   ', '\n'])(
    'never infers missing/blank alt %j from caption/file',
    (alt) => {
      const data = { ...image(), alt };
      if (alt === undefined) delete data.alt;
      const result = render('image', data);
      expect(result).toMatchObject({
        status: 'failure',
        diagnostics: [
          { code: 'missing_alt', path: ['blocks', 0, 'data', 'alt'] },
        ],
      });
      expect(result).not.toHaveProperty('html');
      expect(render('image', data, { mode: 'preview' })).toMatchObject({
        status: 'preview',
        html: '',
      });
    },
  );
  it.each([
    {},
    { ...image(), alt: 1 },
    { ...image(), caption: null },
    { ...image(), file: {} },
    { ...image(), stretched: 'true' },
  ])('matches invalid structural image contracts: %j', (data) => {
    expect(validateImageData(data).ok).toBe(false);
    expect(render('image', data)).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'invalid_block_data' }],
    });
  });
  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,evil',
    '//tracker.invalid/x',
    'file:///x',
    'mailto:user@example.com',
    'https://other.example/x',
    '/relative.png',
  ])('rejects image URL %s without fetching', (url) => {
    expect(
      render(
        'image',
        { ...image(), file: { url } },
        {
          urls: { allowedOrigins: ['https://example.com'], allowMailto: true },
        },
      ),
    ).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'unsafe_html' }],
    });
  });
  it('requires explicit relative-image opt-in independent of relative links', () => {
    expect(
      render(
        'image',
        { ...image(''), file: { url: '/asset.png' } },
        { urls: { allowRelative: false, allowRelativeImages: true } },
      ).status,
    ).toBe('success');
  });
  it('keeps attribute-looking alt as literal text and diagnoses caption markup', () => {
    expect(render('image', image('" onerror="alert(1)'))).toMatchObject({
      status: 'success',
    });
    expect(
      render('image', {
        ...image(),
        caption: '<img src="https://evil.invalid">',
      }),
    ).toMatchObject({
      status: 'failure',
      diagnostics: [
        { path: ['blocks', 0, 'data', 'caption'], code: 'unsafe_html' },
      ],
    });
  });
});
