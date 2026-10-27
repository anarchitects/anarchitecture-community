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
  defineHeaderTool,
  validateHeaderData,
  type HeaderConfig,
  type HeaderToolOptions,
} from '../src/index.js';

class Tool {
  readonly identity = 'header';
}
const profile = EDITOR_JS_2_31_7_TOOL_PROFILE;

describe('header definitions', () => {
  it('preserves alias, constructor, settings and opaque config identities', () => {
    const levels = Object.freeze([3] as const);
    const config = Object.freeze({ levels, defaultLevel: 3 as const });
    const definition = defineHeaderTool({
      name: 'title',
      source: 'eager',
      registration: {
        class: Tool,
        config,
        toolbox: { title: 'Article title' },
      },
    });
    const registry = composeToolRegistry([[definition]], { profile });
    const map = createToolMap(registry);
    expectTypeOf(definition.name).toEqualTypeOf<'title'>();
    expectTypeOf(map.title.class).toEqualTypeOf<typeof Tool>();
    expect(map.title.config).toBe(config);
    expect(map.title.config.levels).toBe(levels);
    expect(config).not.toHaveProperty('placeholder');
    expect(defineHeaderTool({ source: 'eager', registration: Tool }).name).toBe(
      'header',
    );
    const optional: HeaderToolOptions = definition;
    expectTypeOf(defineHeaderTool(optional).name).toEqualTypeOf<string>();
  });

  it('leaves absent defaults to upstream and accepts every supported singleton with an explicit default', () => {
    expect(
      defineHeaderTool({ source: 'eager', registration: Tool }),
    ).not.toHaveProperty('settings');
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      const config = { levels: [level], defaultLevel: level };
      expect(
        defineHeaderTool({
          source: 'lazy',
          load: async () => Tool,
          settings: { config },
        }).settings.config,
      ).toBe(config);
    }
    expect(() =>
      defineHeaderTool({
        source: 'lazy',
        load: async () => Tool,
        settings: { config: { defaultLevel: 6 } },
      }),
    ).not.toThrow();
  });

  it('uses core selection, conflict and whole-definition replacement semantics', () => {
    const first = defineHeaderTool({
      source: 'eager',
      registration: { class: Tool, config: { placeholder: 'first' } },
    });
    const second = defineHeaderTool({
      source: 'eager',
      registration: { class: Tool, config: { defaultLevel: 4 } },
    });
    expect(() => composeToolRegistry([[first, second]], { profile })).toThrow();
    const registry = composeToolRegistry(
      [[first, { ...second, replace: true }]],
      { profile },
    );
    expect(createToolMap(registry).header.config).toEqual({ defaultLevel: 4 });
    expect(createToolMap(selectToolRegistry(registry, []))).toEqual({});
    expect(() =>
      composeToolRegistry([[{ ...first, name: 'bold', replace: true }]], {
        profile,
      }),
    ).toThrow();
  });

  it('preserves promise-chain inference and delegates retry and disposal to core', async () => {
    const chained = defineHeaderTool({
      source: 'lazy',
      load: () => Promise.resolve(Tool).then((value) => value),
    });
    expectTypeOf(chained.load).returns.toEqualTypeOf<Promise<typeof Tool>>();
    const load = vi
      .fn<() => Promise<typeof Tool>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(Tool);
    const definition = defineHeaderTool({ source: 'lazy', load });
    const resolver = createToolResolver(
      composeToolRegistry([[definition]], { profile }),
    );
    expect(load).not.toHaveBeenCalled();
    await expect(resolver.resolve()).rejects.toMatchObject({
      code: 'load-failed',
    });
    expect((await resolver.resolve()).header.class).toBe(Tool);
    resolver.dispose();
    await expect(resolver.resolve()).rejects.toMatchObject({
      code: 'disposed',
    });
  });

  it.each([
    null,
    [],
    { placeholder: 4 },
    { unknown: true },
    { defaultLevel: 0 },
    { defaultLevel: 7 },
    { defaultLevel: 2.5 },
    { defaultLevel: '2' },
    { levels: [] },
    { levels: [2] },
    { levels: [2], defaultLevel: 3 },
    { levels: [2, 2], defaultLevel: 2 },
    { levels: [0, 2], defaultLevel: 2 },
    { levels: ['2'], defaultLevel: 2 },
    { levels: [2.5], defaultLevel: 2 },
    { levels: '2', defaultLevel: 2 },
    { levels: Array(2), defaultLevel: 2 },
    Object.create({ placeholder: 'inherited' }),
  ])('rejects invalid configuration before invoking loaders: %j', (config) => {
    const load = vi.fn(async () => Tool);
    expect(() =>
      defineHeaderTool({
        source: 'lazy',
        load,
        settings: { config: config as HeaderConfig },
      }),
    ).toThrow(TypeError);
    expect(load).not.toHaveBeenCalled();
  });

  it('does not invoke configuration or level getters', () => {
    const getter = vi.fn(() => 2);
    const levels = Object.defineProperty([2], '0', { get: getter });
    const config = Object.defineProperty({}, 'defaultLevel', { get: getter });
    expect(() =>
      defineHeaderTool({
        source: 'eager',
        registration: { class: Tool, config },
      }),
    ).toThrow(TypeError);
    expect(() =>
      defineHeaderTool({
        source: 'eager',
        registration: {
          class: Tool,
          config: { levels, defaultLevel: 2 } as HeaderConfig,
        },
      }),
    ).toThrow(TypeError);
    expect(getter).not.toHaveBeenCalled();
  });
});

describe('header saved data', () => {
  it('accepts structural empty/inline text and JSON extensions without mutation', () => {
    const validator: ToolDataValidator = validateHeaderData;
    for (const level of [1, 2, 3, 4, 5, 6])
      expect(validateHeaderData({ text: '', level }).ok).toBe(true);
    const data = Object.freeze({
      text: '<b>Title</b>',
      level: 3,
      extra: { retained: true },
    });
    expect(validateHeaderData(data)).toEqual({ ok: true });
    expect(data.text).toBe('<b>Title</b>');
    expect(
      validateOutputData(
        { blocks: [{ type: 'title', data: { text: 'bad', level: '3' } }] },
        {
          toolValidators: new Map([['title', validator]]),
          unknownTools: 'reject',
        },
      ),
    ).toMatchObject({
      ok: false,
      errors: [{ path: ['blocks', 0, 'data', 'level'] }],
    });
  });
  it.each([
    null,
    [],
    {},
    { text: 1, level: 2 },
    { text: 'title' },
    ...[0, 7, 2.5, '2', null, NaN].map((level) => ({ text: 'title', level })),
    { text: 'title', level: 2, extra: () => 1 },
  ])('rejects unsupported data without coercion: %j', (data) => {
    expect(validateHeaderData(data).ok).toBe(false);
  });
  it('rejects cycles, depth and unreadable data without invoking getters or overflowing', () => {
    const cycle: Record<string, unknown> = { text: 'title', level: 2 };
    cycle['self'] = cycle;
    expect(validateHeaderData(cycle)).toMatchObject({
      ok: false,
      errors: [{ path: ['self'] }],
    });
    let deep: object = {};
    for (let i = 0; i < 300; i++) deep = { deep };
    expect(validateHeaderData({ text: 'title', level: 2, deep }).ok).toBe(
      false,
    );
    const getter = vi.fn(() => 2);
    expect(
      validateHeaderData(
        Object.defineProperty({ text: 'title' }, 'level', {
          enumerable: true,
          get: getter,
        }),
      ).ok,
    ).toBe(false);
    expect(getter).not.toHaveBeenCalled();
    expect(
      validateHeaderData(
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
