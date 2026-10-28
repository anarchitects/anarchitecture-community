import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  composeToolRegistry,
  createToolMap,
  createToolResolver,
  selectToolRegistry,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  validateOutputData,
  type ToolDataValidator,
} from '@anarchitects/editorjs-core';
import {
  defineQuoteTool,
  validateQuoteData,
  type QuoteConfig,
  type QuoteToolOptions,
} from '../src/index.js';

class Tool {
  readonly identity = 'quote';
}
const profile = EDITOR_JS_2_31_7_TOOL_PROFILE;

describe('quote definitions', () => {
  it('preserves literal aliases, constructors and config identity, copying settings containers', () => {
    const config = Object.freeze({
      quotePlaceholder: '',
      captionPlaceholder: 'Author',
      defaultAlignment: 'center' as const,
    });
    const toolbox = { title: 'Citation', icon: '<svg></svg>' };
    const registration = { class: Tool, config, toolbox };
    const definition = defineQuoteTool({
      name: 'citation',
      source: 'eager',
      registration,
    });
    const map = createToolMap(composeToolRegistry([[definition]], { profile }));
    expectTypeOf(definition.name).toEqualTypeOf<'citation'>();
    expectTypeOf(map.citation.class).toEqualTypeOf<typeof Tool>();
    expect(definition.registration).not.toBe(registration);
    expect(map.citation.config).toBe(config);
    expect(map.citation.toolbox).toEqual(toolbox);
    expect(defineQuoteTool({ source: 'eager', registration: Tool }).name).toBe(
      'quote',
    );
    const optional: QuoteToolOptions = definition;
    expectTypeOf(defineQuoteTool(optional).name).toEqualTypeOf<string>();
  });
  it('does not materialize absent defaults and preserves lazy settings', () => {
    expect(
      defineQuoteTool({ source: 'eager', registration: Tool }),
    ).not.toHaveProperty('settings');
    const config = {};
    const settings = { config, toolbox: false as const };
    const definition = defineQuoteTool({
      source: 'lazy',
      load: async () => Tool,
      settings,
    });
    expect(definition.settings).not.toBe(settings);
    expect(definition.settings.config).toBe(config);
    expect(config).toEqual({});
    for (const defaultAlignment of ['left', 'center'] as const)
      expect(() =>
        defineQuoteTool({
          source: 'lazy',
          load: async () => Tool,
          settings: { config: { defaultAlignment } },
        }),
      ).not.toThrow();
  });
  it('delegates independent selection, conflicts and explicit whole replacement to core', async () => {
    const load = vi.fn(async () => Tool);
    const quote = defineQuoteTool({
      source: 'lazy',
      load,
      settings: { config: { quotePlaceholder: 'First' } },
    });
    const other = defineQuoteTool({
      name: 'citation',
      source: 'eager',
      registration: Tool,
    });
    const registry = composeToolRegistry([[quote, other]], { profile });
    await createToolResolver(
      selectToolRegistry(registry, ['citation']),
    ).resolve();
    expect(load).not.toHaveBeenCalled();
    const replacement = defineQuoteTool({
      source: 'eager',
      registration: { class: Tool, config: { defaultAlignment: 'center' } },
    });
    expect(() =>
      composeToolRegistry([[quote, replacement]], { profile }),
    ).toThrow();
    const replaced = composeToolRegistry(
      [[quote, { ...replacement, replace: true }]],
      { profile },
    );
    expect(createToolMap(replaced).quote.config).toEqual({
      defaultAlignment: 'center',
    });
    expect(() =>
      composeToolRegistry([[{ ...replacement, name: 'bold', replace: true }]], {
        profile,
      }),
    ).toThrow();
  });
  it('preserves promise-chain inference and resolver retry/disposal', async () => {
    const chained = defineQuoteTool({
      source: 'lazy',
      load: () => Promise.resolve(Tool).then((value) => value),
    });
    expectTypeOf(chained.load).returns.toEqualTypeOf<Promise<typeof Tool>>();
    const load = vi
      .fn<() => Promise<typeof Tool>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(Tool);
    const resolver = createToolResolver(
      composeToolRegistry([[defineQuoteTool({ source: 'lazy', load })]], {
        profile,
      }),
    );
    expect(load).not.toHaveBeenCalled();
    await expect(resolver.resolve()).rejects.toMatchObject({
      code: 'load-failed',
    });
    expect((await resolver.resolve()).quote.class).toBe(Tool);
    resolver.dispose();
    await expect(resolver.resolve()).rejects.toMatchObject({
      code: 'disposed',
    });
  });
  it.each([
    null,
    [],
    { quotePlaceholder: 3 },
    { captionPlaceholder: false },
    { unknown: true },
    { defaultAlignment: 'right' },
    { defaultAlignment: 'Center' },
    { defaultAlignment: '' },
    { defaultAlignment: null },
    { defaultAlignment: 0 },
    Object.create({ quotePlaceholder: 'inherited' }),
    { [Symbol('extra')]: 1 },
  ])('rejects invalid config before loading: %j', (config) => {
    const load = vi.fn(async () => Tool);
    expect(() =>
      defineQuoteTool({
        source: 'lazy',
        load,
        settings: { config: config as QuoteConfig },
      }),
    ).toThrow(TypeError);
    expect(load).not.toHaveBeenCalled();
  });
  it('rejects accessor config without invoking it', () => {
    const getter = vi.fn(() => 'left');
    expect(() =>
      defineQuoteTool({
        source: 'eager',
        registration: {
          class: Tool,
          config: Object.defineProperty({}, 'defaultAlignment', {
            get: getter,
          }),
        },
      }),
    ).toThrow(TypeError);
    expect(getter).not.toHaveBeenCalled();
  });
});

describe('quote data', () => {
  const valid = { text: '', caption: '', alignment: 'left' };
  it('accepts both alignments, empty strings, inline HTML and extensions without mutation', () => {
    for (const alignment of ['left', 'center'])
      expect(validateQuoteData({ ...valid, alignment })).toEqual({ ok: true });
    const data = Object.freeze({
      text: '<b>Quoted</b>',
      caption: '<i>Author</i>',
      alignment: 'center',
      extra: { retained: true },
    });
    const before = JSON.stringify(data);
    expect(validateQuoteData(data)).toEqual({ ok: true });
    expect(JSON.stringify(data)).toBe(before);
    const validator: ToolDataValidator = validateQuoteData;
    expect(
      validateOutputData(
        {
          blocks: [
            { type: 'citation', data: { ...valid, alignment: 'right' } },
          ],
        },
        {
          toolValidators: new Map([['citation', validator]]),
          unknownTools: 'reject',
        },
      ),
    ).toMatchObject({
      ok: false,
      errors: [{ path: ['blocks', 0, 'data', 'alignment'] }],
    });
  });
  it.each([
    [{ caption: '', alignment: 'left' }, ['text']],
    [{ ...valid, text: 2 }, ['text']],
    [{ text: '', alignment: 'left' }, ['caption']],
    [{ ...valid, caption: null }, ['caption']],
    [{ text: '', caption: '' }, ['alignment']],
    ...['right', 'Center', '', 2, null].map(
      (alignment): [unknown, string[]] => [
        { ...valid, alignment },
        ['alignment'],
      ],
    ),
    [{ ...valid, extension: { bad: undefined } }, ['extension', 'bad']],
  ])('rejects malformed data with precise paths: %j', (data, path) => {
    expect(validateQuoteData(data)).toMatchObject({
      ok: false,
      errors: [{ path }],
    });
  });
  it.each([null, [], {}, 1, 'quote'])('rejects non-quote data: %j', (data) =>
    expect(validateQuoteData(data).ok).toBe(false),
  );
  it('bounds cycles/depth and rejects unreadable data without invoking getters', () => {
    const cycle: Record<string, unknown> = { ...valid };
    cycle['self'] = cycle;
    expect(validateQuoteData(cycle)).toMatchObject({
      ok: false,
      errors: [{ path: ['self'] }],
    });
    let deep: object = {};
    for (let i = 0; i < 300; i++) deep = { deep };
    expect(validateQuoteData({ ...valid, deep }).ok).toBe(false);
    const getter = vi.fn(() => 'left');
    expect(
      validateQuoteData(
        Object.defineProperty({ text: '', caption: '' }, 'alignment', {
          enumerable: true,
          get: getter,
        }),
      ).ok,
    ).toBe(false);
    expect(getter).not.toHaveBeenCalled();
    expect(
      validateQuoteData(
        new Proxy(
          {},
          {
            ownKeys() {
              throw new Error('unreadable');
            },
          },
        ),
      ).ok,
    ).toBe(false);
  });
});
