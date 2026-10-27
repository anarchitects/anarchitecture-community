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
  defineListTool,
  validateListData,
  type ListConfig,
  type ListData,
  type ListStyle,
} from '../src/index.js';
class Tool {
  identity = 'list';
}
const profile = EDITOR_JS_2_31_7_TOOL_PROFILE;
const item = (content = 'Item') => ({ content, meta: {}, items: [] });
const data = (style: ListStyle = 'unordered') => ({
  style,
  meta: {},
  items: [item()],
});

describe('list definitions', () => {
  it('preserves aliases, constructor inference, frozen config and counter identity without defaults', () => {
    const counterTypes = Object.freeze(['upper-roman'] as const);
    const config = Object.freeze({ counterTypes, maxLevel: 1 });
    const definition = defineListTool({
      name: 'steps',
      source: 'eager',
      registration: { class: Tool, config },
    });
    const map = createToolMap(composeToolRegistry([[definition]], { profile }));
    expectTypeOf(definition.name).toEqualTypeOf<'steps'>();
    expectTypeOf(map.steps.class).toEqualTypeOf<typeof Tool>();
    expect(map.steps.config).toBe(config);
    expect(map.steps.config.counterTypes).toBe(counterTypes);
    expect(config).not.toHaveProperty('defaultStyle');
    expect(defineListTool({ source: 'eager', registration: Tool }).name).toBe(
      'list',
    );
  });
  it('delegates conflict, explicit replacement and selection to core', () => {
    const first = defineListTool({ source: 'eager', registration: Tool });
    expect(() => composeToolRegistry([[first, first]], { profile })).toThrow();
    const second = defineListTool({
      source: 'eager',
      replace: true,
      registration: { class: Tool, config: { maxLevel: 2 } },
    });
    const registry = composeToolRegistry([[first, second]], { profile });
    expect(createToolMap(registry).list.config).toEqual({ maxLevel: 2 });
    expect(createToolMap(selectToolRegistry(registry, []))).toEqual({});
  });
  it('stays inert and preserves promise inference, retry and disposal', async () => {
    const chained = defineListTool({
      source: 'lazy',
      load: () => Promise.resolve(Tool).then((value) => value),
    });
    expectTypeOf(chained.load).returns.toEqualTypeOf<Promise<typeof Tool>>();
    const load = vi
      .fn<() => Promise<typeof Tool>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(Tool);
    const resolver = createToolResolver(
      composeToolRegistry([[defineListTool({ source: 'lazy', load })]], {
        profile,
      }),
    );
    expect(load).not.toHaveBeenCalled();
    await expect(resolver.resolve()).rejects.toMatchObject({
      code: 'load-failed',
    });
    expect((await resolver.resolve()).list.class).toBe(Tool);
    resolver.dispose();
    await expect(resolver.resolve()).rejects.toMatchObject({
      code: 'disposed',
    });
  });
  it.each(['ordered', 'unordered', 'checklist'] as const)(
    'accepts %s defaults without materializing saved values',
    (defaultStyle) => {
      const config = { defaultStyle };
      expect(
        defineListTool({
          source: 'lazy',
          load: async () => Tool,
          settings: { config },
        }).settings.config,
      ).toBe(config);
    },
  );
  it.each([
    null,
    [],
    { unknown: true },
    { defaultStyle: 'bullet' },
    { defaultStyle: 1 },
    { maxLevel: 0 },
    { maxLevel: -1 },
    { maxLevel: 1.5 },
    { maxLevel: '2' },
    { maxLevel: Infinity },
    { counterTypes: [] },
    { counterTypes: ['numeric', 'numeric'] },
    { counterTypes: ['decimal'] },
    { counterTypes: [1] },
    { counterTypes: 'numeric' },
    { counterTypes: Array(1) },
    Object.create({ defaultStyle: 'ordered' }),
  ])('rejects invalid config %j before activation', (config) => {
    const load = vi.fn(async () => Tool);
    expect(() =>
      defineListTool({
        source: 'lazy',
        load,
        settings: { config: config as ListConfig },
      }),
    ).toThrow(TypeError);
    expect(load).not.toHaveBeenCalled();
  });
  it('does not invoke config or array accessors', () => {
    const getter = vi.fn(() => 'numeric');
    for (const config of [
      Object.defineProperty({}, 'maxLevel', { get: getter }),
      {
        counterTypes: Object.defineProperty(['numeric'], '0', { get: getter }),
      },
    ])
      expect(() =>
        defineListTool({
          source: 'eager',
          registration: { class: Tool, config: config as ListConfig },
        }),
      ).toThrow(TypeError);
    expect(getter).not.toHaveBeenCalled();
  });
});

describe('current nested saved data', () => {
  it('accepts nested inline HTML and additional JSON fields without mutation', () => {
    const value: ListData<'ordered'> = {
      style: 'ordered',
      meta: { start: 4, counterType: 'upper-roman', extra: true },
      items: [
        {
          content: '<b>Parent</b>',
          meta: {},
          items: [
            {
              content: 'Child',
              meta: { start: 2, counterType: 'lower-alpha' },
              items: [],
              extra: [1],
            },
          ],
        },
      ],
      extra: { version: 2 },
    };
    const before = structuredClone(value);
    expect(validateListData(Object.freeze(value))).toEqual({ ok: true });
    expect(value).toEqual(before);
    expect(
      validateListData({
        style: 'checklist',
        meta: {},
        items: [
          {
            content: '',
            meta: { checked: false },
            items: [{ content: 'Done', meta: { checked: true }, items: [] }],
          },
        ],
      }),
    ).toEqual({ ok: true });
    for (const counterType of [
      'numeric',
      'upper-roman',
      'lower-roman',
      'upper-alpha',
      'lower-alpha',
    ])
      expect(
        validateListData({ ...data('ordered'), meta: { counterType } }).ok,
      ).toBe(true);
    expect(
      validateListData({ style: 'unordered', meta: {}, items: [] }).ok,
    ).toBe(true);
  });
  it.each<[unknown, (string | number)[]]>([
    [{ style: 'bullet', meta: {}, items: [] }, ['style']],
    [{ style: 'unordered', items: [] }, ['meta']],
    [{ ...data(), meta: [] }, ['meta']],
    [{ ...data(), items: 'old' }, ['items']],
    [{ ...data(), items: ['legacy'] }, ['items', 0]],
    [
      { ...data(), items: [{ text: 'legacy', checked: true }] },
      ['items', 0, 'content'],
    ],
    [
      { ...data(), items: [{ content: 'missing', items: [] }] },
      ['items', 0, 'meta'],
    ],
    [
      { ...data(), items: [{ content: 1, meta: {}, items: [] }] },
      ['items', 0, 'content'],
    ],
    [
      { ...data(), items: [{ content: 'missing', meta: {} }] },
      ['items', 0, 'items'],
    ],
    [{ ...data('checklist') }, ['items', 0, 'meta', 'checked']],
    [
      {
        ...data('checklist'),
        items: [
          {
            content: 'parent',
            meta: { checked: true },
            items: [{ ...item(), meta: { checked: 'false' } }],
          },
        ],
      },
      ['items', 0, 'items', 0, 'meta', 'checked'],
    ],
    ...[0, -1, 1.5, '2', null].map((start): [unknown, (string | number)[]] => [
      { ...data('ordered'), meta: { start } },
      ['meta', 'start'],
    ]),
    [
      {
        ...data('ordered'),
        items: [{ ...item(), meta: { counterType: 'decimal' } }],
      },
      ['items', 0, 'meta', 'counterType'],
    ],
    [
      { ...data('ordered'), meta: { counterType: 'decimal' } },
      ['meta', 'counterType'],
    ],
  ])(
    'rejects invalid/legacy values with a precise relative path',
    (value, path) => {
      expect(validateListData(value)).toMatchObject({
        ok: false,
        errors: [{ path }],
      });
    },
  );
  it('uses the configured alias in core document error paths', () => {
    const validator: ToolDataValidator = validateListData;
    expect(
      validateOutputData(
        {
          blocks: [
            {
              type: 'steps',
              data: { ...data(), items: [{ ...item(), items: [null] }] },
            },
          ],
        },
        {
          toolValidators: new Map([['steps', validator]]),
          unknownTools: 'reject',
        },
      ),
    ).toMatchObject({
      ok: false,
      errors: [{ path: ['blocks', 0, 'data', 'items', 0, 'items', 0] }],
    });
  });
  it('rejects cycles, excessive depth, sparse items, non-JSON extensions and unreadable objects safely', () => {
    const cycle: Record<string, unknown> = item();
    cycle['items'] = [cycle];
    let deep: object = item();
    for (let i = 0; i < 300; i++) deep = { ...item(), items: [deep] };
    const getter = vi.fn(() => []);
    const unreadable = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('unreadable');
        },
      },
    );
    for (const value of [
      null,
      [],
      { items: [{ text: 'old', checked: false }] },
      { ...data(), items: [cycle] },
      { ...data(), items: [deep] },
      { ...data(), items: Array(1) },
      { ...data(), extension: () => 1 },
      Object.defineProperty(data(), 'items', { get: getter }),
      unreadable,
    ])
      expect(validateListData(value).ok).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });
});
