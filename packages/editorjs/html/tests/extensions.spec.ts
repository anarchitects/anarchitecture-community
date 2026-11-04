import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  createEditorJsHtmlRenderer,
  renderEditorJsHtml,
  type HtmlBlockRegistration,
  type HtmlRendererOptions,
  type HtmlRenderContext,
  type HtmlReadonly,
} from '../src/index.js';
interface Callout {
  text: string;
  tone: 'info' | 'warning';
}
interface Code {
  code: string;
}
interface Flag {
  flagged: boolean;
}
type Blocks = { callout: Callout; code: Code };
type Tunes = { flag: Flag };
const object = (data: unknown): data is Record<string, unknown> =>
  !!data && typeof data === 'object' && !Array.isArray(data);
const isCallout = (data: unknown): data is Callout =>
  object(data) &&
  typeof data['text'] === 'string' &&
  ['info', 'warning'].includes(data['tone'] as string);
const isFlag = (data: unknown): data is Flag =>
  object(data) && typeof data['flagged'] === 'boolean';
const options: HtmlRendererOptions<Blocks, Tunes> = {
  classes: { custom: ['info', 'warning', 'flagged'] },
  blocks: [
    {
      name: 'callout',
      validate: isCallout,
      render: (data, ctx) =>
        `<aside class="${data.tone}">${ctx.inline(data.text)}</aside>`,
    },
    {
      name: 'code',
      validate: (data): data is Code =>
        object(data) && typeof data['code'] === 'string',
      render: (data, ctx) =>
        `<pre><code>${ctx.escapeText(data.code)}</code></pre>`,
    },
  ],
  tunes: [
    {
      name: 'flag',
      validate: isFlag,
      render: (html, data) =>
        data.flagged ? `<div class="flagged">${html}</div>` : html,
    },
  ],
};
const doc = (
  type = 'callout',
  data: unknown = { text: '<mark>Marked</mark>', tone: 'warning' },
  tunes?: object,
) => ({ blocks: [{ type, data, ...(tunes ? { tunes } : {}) }] });
const any = (data: unknown): data is unknown => {
  void data;
  return true;
};
const custom = (
  render: HtmlBlockRegistration['render'],
): HtmlRendererOptions => ({
  blocks: [{ name: 'custom', validate: any, render }],
});

describe('typed headless registrations', () => {
  it('keeps aliases subject to inline safety and the missing-alt publication rule', () => {
    expect(
      renderEditorJsHtml(doc('copy', { text: '<script>secret</script>' }), {
        profiles: [{ name: 'copy', profile: 'paragraph' }],
      }),
    ).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'unsafe_html', type: 'copy' }],
    });
    expect(
      renderEditorJsHtml(
        doc('photo', {
          file: { url: 'https://example.com/a.png' },
          caption: 'Not alt',
          withBorder: false,
          withBackground: false,
          stretched: false,
        }),
        { profiles: [{ name: 'photo', profile: 'image' }], mode: 'preview' },
      ),
    ).toMatchObject({
      status: 'preview',
      html: '',
      diagnostics: [{ code: 'missing_alt', type: 'photo' }],
    });
  });
  it('omits a failed tune block, retains later preview blocks, and recovers on the next call', () => {
    const renderer = createEditorJsHtmlRenderer({
      mode: 'preview',
      tunes: [
        {
          name: 'broken',
          validate: any,
          render: () => {
            throw Error('private-tune-error');
          },
        },
      ],
    });
    expect(
      renderer.render({
        blocks: [
          ...doc('paragraph', { text: 'Omit' }, { broken: {} }).blocks,
          ...doc('paragraph', { text: 'Keep' }).blocks,
        ],
      }),
    ).toMatchObject({
      status: 'preview',
      html: '<p>Keep</p>',
      diagnostics: [
        {
          code: 'callback_failed',
          tune: 'broken',
          path: ['blocks', 0, 'tunes', 'broken'],
        },
      ],
    });
    expect(renderer.render(doc('paragraph', { text: 'Recovered' }))).toEqual({
      status: 'preview',
      html: '<p>Recovered</p>',
      diagnostics: [],
    });
  });
  it('composes the Callout/Marker/FlagTune and literal Code saved contracts explicitly', () => {
    const result = renderEditorJsHtml(
      {
        blocks: [
          ...doc(
            'callout',
            { text: '<b>Bold <mark>marked</mark></b>', tone: 'warning' },
            { flag: { flagged: true } },
          ).blocks,
          ...doc('code', { code: '<script>run()</script> & literal' }).blocks,
        ],
      },
      options,
    );
    expect(result).toEqual({
      status: 'success',
      diagnostics: [],
      html: '<div class="flagged"><aside class="warning"><b>Bold <mark>marked</mark></b></aside></div><pre><code>&lt;script&gt;run()&lt;/script&gt; &amp; literal</code></pre>',
    });
    expect(renderEditorJsHtml(doc()).status).toBe('failure');
  });
  it('connects saved-name maps to readonly callback data and context', () => {
    const typed: HtmlRendererOptions<Blocks, Tunes> = {
      blocks: [
        {
          name: 'code',
          validate: (value): value is Code =>
            object(value) && typeof value['code'] === 'string',
          render: (data, context) => {
            expectTypeOf(data).toEqualTypeOf<HtmlReadonly<Code>>();
            expectTypeOf(context).toEqualTypeOf<HtmlRenderContext>();
            // @ts-expect-error This configured name has Code data, not Callout.
            const wrong: string = data.tone;
            void wrong;
            return context.escapeText(data.code);
          },
        },
      ],
    };
    expect(
      renderEditorJsHtml(doc('code', { code: 'text' }), typed).status,
    ).toBe('success');
    const bad: HtmlRendererOptions<Blocks> = {
      blocks: [
        // @ts-expect-error The saved-name map has no arbitrary registration key.
        { name: 'missing', validate: isCallout, render: (): string => '' },
      ],
    };
    void bad;
  });
  it('supports explicit profile aliases including prototype-like keys without changing saved identity', () => {
    for (const name of ['heading', '__proto__', 'constructor', 'toString']) {
      const input = doc(name, { text: 'Title', level: 3 });
      const before = JSON.stringify(input);
      expect(
        renderEditorJsHtml(input, { profiles: [{ name, profile: 'header' }] }),
      ).toMatchObject({ status: 'success', html: '<h3>Title</h3>' });
      expect(JSON.stringify(input)).toBe(before);
      expect(renderEditorJsHtml(input).diagnostics[0].code).toBe(
        'unknown_block',
      );
    }
  });
  it('requires explicit whole built-in replacement; aliases still use the original profile', () => {
    expect(
      renderEditorJsHtml(doc('paragraph', { text: 'x' }), {
        profiles: [{ name: 'copy', profile: 'paragraph' }],
        blocks: [
          {
            name: 'paragraph',
            override: true,
            validate: any,
            render: () => '<p>Override</p>',
          },
        ],
      }),
    ).toMatchObject({ html: '<p>Override</p>' });
    expect(
      renderEditorJsHtml(doc('copy', { text: 'Original' }), {
        profiles: [{ name: 'copy', profile: 'paragraph' }],
        blocks: [
          {
            name: 'paragraph',
            override: true,
            validate: any,
            render: () => '<p>Override</p>',
          },
        ],
      }),
    ).toMatchObject({ html: '<p>Original</p>' });
  });
  it.each([
    { profiles: [{ name: 'paragraph', profile: 'header' }] },
    { profiles: [{ name: 'alias', profile: 'header', override: true }] },
    { profiles: [{ name: 'alias', profile: 'missing' }] },
    {
      profiles: [
        { name: 'alias', profile: 'header' },
        { name: 'alias', profile: 'quote' },
      ],
    },
    {
      blocks: [{ name: 'paragraph', validate: any, render: (): string => '' }],
    },
    {
      blocks: [
        { name: 'custom', validate: any, render: (): string => '' },
        {
          name: 'custom',
          override: true,
          validate: any,
          render: (): string => '',
        },
      ],
    },
    {
      profiles: [{ name: 'custom', profile: 'header' }],
      blocks: [{ name: 'custom', validate: any, render: (): string => '' }],
    },
    {
      tunes: [
        {
          name: 'flag',
          validate: isFlag,
          ignore: true,
          render: (): string => '',
        },
      ],
    },
    {
      tunes: [
        { name: 'flag', validate: isFlag, ignore: true },
        { name: 'flag', validate: isFlag, ignore: true },
      ],
    },
  ])('rejects ambiguous/invalid configuration: %j', (invalid) => {
    expect(
      renderEditorJsHtml(doc(), invalid as HtmlRendererOptions),
    ).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'invalid_configuration' }],
    });
  });
  it('does not evaluate registration getters', () => {
    const getter = vi.fn(() => 'custom');
    const config = {
      blocks: [
        Object.defineProperty({}, 'name', { enumerable: true, get: getter }),
      ],
    };
    expect(
      renderEditorJsHtml(doc(), config as unknown as HtmlRendererOptions)
        .status,
    ).toBe('failure');
    expect(getter).not.toHaveBeenCalled();
  });
  it('snapshots entries, detaches/freezes callback input, and isolates calls and instances', () => {
    const registration: HtmlBlockRegistration<'callout', Callout> = {
      name: 'callout',
      validate: isCallout,
      render: (data, context) => {
        expect(Object.isFrozen(data)).toBe(true);
        expect(Object.isFrozen(context.block)).toBe(true);
        expect(Object.isFrozen(context.block.tunes)).toBe(true);
        expect(Reflect.set(data, 'text', 'mutation')).toBe(false);
        return `<p>${context.inline(data.text)}</p>`;
      },
    };
    const registrations = [registration];
    const config: HtmlRendererOptions<{ callout: Callout }> = {
      blocks: registrations,
      tunes: [{ name: 'meta', validate: any, ignore: true }],
    };
    const first = createEditorJsHtmlRenderer(config);
    Object.assign(registration, { render: () => '<p>Changed</p>' });
    registrations.length = 0;
    const input = doc(
      'callout',
      { text: 'Original', tone: 'info' },
      { meta: { nested: [1] } },
    );
    const before = JSON.stringify(input);
    expect(first.render(input)).toMatchObject({ html: '<p>Original</p>' });
    expect(createEditorJsHtmlRenderer(config).render(input).status).toBe(
      'failure',
    );
    expect(first.render(input)).toMatchObject({ html: '<p>Original</p>' });
    expect(Object.isFrozen(input.blocks[0].data)).toBe(false);
    expect(JSON.stringify(input)).toBe(before);
  });
  it('validates tunes independently and composes in registration order, with explicit ignored tunes', () => {
    const config: HtmlRendererOptions = {
      tunes: [
        {
          name: 'second',
          validate: any,
          render: (html) => `<section>${html}</section>`,
        },
        {
          name: 'first',
          validate: any,
          render: (html) => `<aside>${html}</aside>`,
        },
        { name: 'metadata', validate: isFlag, ignore: true },
      ],
    };
    const input = doc(
      'paragraph',
      { text: 'Text' },
      { first: {}, metadata: { flagged: false }, second: {} },
    );
    expect(renderEditorJsHtml(input, config)).toMatchObject({
      html: '<aside><section><p>Text</p></section></aside>',
    });
    expect(
      renderEditorJsHtml(
        doc('paragraph', { text: 'Text' }, { metadata: {} }),
        config,
      ),
    ).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'invalid_tune_data', tune: 'metadata' }],
    });
  });
  it('skips the whole block for invalid/unknown tunes without calling formatters', () => {
    const renderer = vi.fn(() => '<p>Should not run</p>');
    const config: HtmlRendererOptions = {
      ...custom(renderer),
      tunes: [{ name: 'flag', validate: isFlag, ignore: true }],
    };
    expect(
      renderEditorJsHtml(
        doc('custom', {}, { unknown: {}, flag: { flagged: 'no' } }),
        { ...config, mode: 'preview' },
      ),
    ).toMatchObject({
      status: 'preview',
      html: '',
      diagnostics: [
        { code: 'invalid_tune_data', path: ['blocks', 0, 'tunes', 'flag'] },
        { code: 'unknown_tune' },
      ],
    });
    expect(renderer).not.toHaveBeenCalled();
  });
  it.each([
    () => {
      throw Error('private-secret');
    },
    () => null,
    () => Promise.resolve('<p>late</p>'),
    () => Promise.reject(Error('private-secret')),
    () => ({ then: () => 'late' }),
  ])(
    'handles non-string/async/throwing render callbacks without leaking content',
    (callback) => {
      const config = custom(
        callback as unknown as HtmlBlockRegistration['render'],
      );
      const strict = renderEditorJsHtml(doc('custom', {}), config);
      expect(strict).toMatchObject({
        status: 'failure',
        diagnostics: [{ code: 'callback_failed' }],
      });
      expect(JSON.stringify(strict)).not.toContain('private-secret');
      expect(
        renderEditorJsHtml(doc('custom', {}), { ...config, mode: 'preview' }),
      ).toMatchObject({ status: 'preview', html: '' });
    },
  );
  it('diagnoses guard exceptions, malformed returns and invalid data without rendering', () => {
    for (const validate of [
      () => {
        throw Error('secret');
      },
      () => ({ ok: true }),
      () => Promise.resolve(true),
    ]) {
      expect(
        renderEditorJsHtml(doc('custom', {}), {
          blocks: [
            {
              name: 'custom',
              validate: validate as never,
              render: (): string => '',
            },
          ],
        }),
      ).toMatchObject({
        status: 'failure',
        diagnostics: [{ code: 'callback_failed' }],
      });
    }
    expect(
      renderEditorJsHtml(doc('callout', { text: 'x', tone: 'bad' }), options),
    ).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'invalid_block_data' }],
    });
  });
  it.each([
    '<p onclick="bad()">Text</p>',
    '<a href="javascript:bad()">Link</a>',
    '<img src="data:image/svg+xml,evil" alt="">',
    '<p style="color:red">Text</p>',
    '<p class="unconfigured">Text</p>',
    '<svg><script>secret</script></svg>',
  ])(
    'applies the same safety floor to custom, override and tune HTML: %s',
    (html) => {
      for (const config of [
        custom(() => html),
        {
          blocks: [
            { name: 'custom', validate: any, render: () => '<p>Text</p>' },
          ],
          tunes: [{ name: 'flag', validate: any, render: () => html }],
        },
        {
          profiles: [{ name: 'custom', profile: 'paragraph' as const }],
          blocks: [
            {
              name: 'paragraph',
              override: true,
              validate: any,
              render: () => html,
            },
          ],
        },
      ]) {
        const type =
          config.blocks?.[0]?.name === 'paragraph' ? 'paragraph' : 'custom';
        expect(
          renderEditorJsHtml(
            doc(type, {}, config.tunes ? { flag: {} } : undefined),
            config,
          ),
        ).toMatchObject({
          status: 'failure',
          diagnostics: [{ code: 'unsafe_html' }],
        });
      }
    },
  );
  it('does not allow a tune to hide unsafe earlier callback HTML', () => {
    expect(
      renderEditorJsHtml(doc('custom', {}, { clear: {} }), {
        ...custom(() => '<script>secret</script>'),
        tunes: [
          {
            name: 'clear',
            validate: any,
            render: () => '<p>safe replacement</p>',
          },
        ],
      }),
    ).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'unsafe_html' }],
    });
  });
  it('rejects missing alt even in custom output and bounds callbacks/helpers', () => {
    expect(
      renderEditorJsHtml(doc('custom', {}), {
        ...custom(() => '<img src="https://example.com/x">'),
        mode: 'preview',
      }),
    ).toMatchObject({
      status: 'preview',
      html: '',
      diagnostics: [{ code: 'missing_alt' }],
    });
    expect(
      renderEditorJsHtml(doc('custom', {}), {
        ...custom(() => 'x'.repeat(30)),
        limits: { maxOutputBytes: 20 },
      }),
    ).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'limit_exceeded' }],
    });
    expect(
      renderEditorJsHtml(doc('custom', {}), {
        ...custom((_data, context) => context.escapeText('x'.repeat(200))),
        limits: { maxStringBytes: 100 },
      }),
    ).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'limit_exceeded' }],
    });
  });
});
