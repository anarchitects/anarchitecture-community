import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  composeToolRegistry,
  createToolMap,
  createToolResolver,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  validateOutputData,
  type ToolDataValidator,
} from '@anarchitects/editorjs-core';
import {
  defineParagraphTool,
  validateParagraphData,
  type ParagraphConfig,
  type ParagraphToolOptions,
} from '../src/index.js';

class Tool {
  readonly example = true;
}
const profile = EDITOR_JS_2_31_7_TOOL_PROFILE;

describe('paragraph definitions', () => {
  it('requires explicit built-in replacement and preserves the class', () => {
    const definition = defineParagraphTool({
      source: 'eager',
      registration: Tool,
    });
    expect(definition).toEqual({
      name: 'paragraph',
      kind: 'block',
      source: 'eager',
      registration: Tool,
    });
    expect(() => composeToolRegistry([[definition]], { profile })).toThrow();
    const registry = composeToolRegistry([[{ ...definition, replace: true }]], {
      profile,
    });
    expect(createToolMap(registry).paragraph).toBe(Tool);
    expectTypeOf(createToolMap(registry).paragraph).toEqualTypeOf<
      typeof Tool
    >();
  });

  it('retains literal aliases, settings and config identity without filling defaults', () => {
    const config = Object.freeze({
      placeholder: 'Write here',
      preserveBlank: true,
    });
    const registration = { class: Tool, config, inlineToolbar: ['bold'] };
    const definition = defineParagraphTool({
      name: 'body',
      source: 'eager',
      registration,
    });
    expect(definition.registration).not.toBe(registration);
    expect(definition.registration.config).toBe(config);
    expectTypeOf(definition.name).toEqualTypeOf<'body'>();
    const map = createToolMap(composeToolRegistry([[definition]], { profile }));
    expectTypeOf(map.body.class).toEqualTypeOf<typeof Tool>();
    expect(map.body.config).toBe(config);
    expect(
      defineParagraphTool({ source: 'eager', registration: Tool }),
    ).not.toHaveProperty('config');
    const optional: ParagraphToolOptions = definition;
    expectTypeOf(defineParagraphTool(optional).name).toEqualTypeOf<string>();
  });

  it('loads only through the core resolver and follows its failure/disposal contract', async () => {
    const config = { preserveBlank: false };
    const load = vi
      .fn<() => Promise<typeof Tool>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(Tool);
    const definition = defineParagraphTool({
      name: 'body',
      source: 'lazy',
      load,
      settings: { config },
    });
    expect(load).not.toHaveBeenCalled();
    const resolver = createToolResolver(
      composeToolRegistry([[definition]], { profile }),
    );
    await expect(resolver.resolve()).rejects.toMatchObject({
      code: 'load-failed',
    });
    const tools = await resolver.resolve();
    expect(tools.body.class).toBe(Tool);
    expect(tools.body.config).toBe(config);
    expectTypeOf(tools.body.class).toEqualTypeOf<typeof Tool>();
    expect(load).toHaveBeenCalledTimes(2);
    resolver.dispose();
    await expect(resolver.resolve()).rejects.toMatchObject({
      code: 'disposed',
    });
  });

  it('preserves constructors inferred through promise chaining', () => {
    const definition = defineParagraphTool({
      source: 'lazy',
      load: () => Promise.resolve(Tool).then((value) => value),
    });
    expectTypeOf(definition.load).returns.toEqualTypeOf<Promise<typeof Tool>>();
  });

  it.each([
    null,
    [],
    { placeholder: 42 },
    { preserveBlank: 'yes' },
    { unknown: true },
    Object.create({ placeholder: 'inherited' }),
  ])('rejects invalid config without invoking a loader: %j', (config) => {
    const load = vi.fn(async () => Tool);
    expect(() =>
      defineParagraphTool({
        source: 'lazy',
        load,
        settings: { config: config as ParagraphConfig },
      }),
    ).toThrow(TypeError);
    expect(load).not.toHaveBeenCalled();
  });

  it('rejects accessor config without invoking it, and snapshots whole replacements', () => {
    const getter = vi.fn(() => 'no');
    const config = Object.defineProperty({}, 'placeholder', { get: getter });
    expect(() =>
      defineParagraphTool({
        source: 'eager',
        registration: { class: Tool, config },
      }),
    ).toThrow(TypeError);
    expect(getter).not.toHaveBeenCalled();
    const first = defineParagraphTool({
      name: 'body',
      source: 'eager',
      registration: { class: Tool, config: { placeholder: 'old' } },
    });
    const second = defineParagraphTool({
      name: 'body',
      source: 'eager',
      replace: true,
      registration: { class: Tool, config: { preserveBlank: true } },
    });
    expect(
      createToolMap(composeToolRegistry([[first, second]], { profile })).body
        .config,
    ).toEqual({ preserveBlank: true });
  });
});

describe('paragraph saved data', () => {
  it('accepts blank text and HTML structurally, preserves input, and composes under aliases', () => {
    const data = Object.freeze({
      text: '<b>hello</b>',
      extra: { source: 'host' },
    });
    expect(validateParagraphData(data)).toEqual({ ok: true });
    expect(validateParagraphData({ text: '' })).toEqual({ ok: true });
    const validator: ToolDataValidator = validateParagraphData;
    const result = validateOutputData(
      { blocks: [{ type: 'body', data }] },
      {
        toolValidators: new Map([['body', validator]]),
        unknownTools: 'reject',
      },
    );
    expect(result.ok).toBe(true);
    expect(data.text).toBe('<b>hello</b>');
    expect(
      validateOutputData(
        { blocks: [{ type: 'body', data: { text: 2 } }] },
        { toolValidators: new Map([['body', validator]]) },
      ),
    ).toMatchObject({
      ok: false,
      errors: [{ path: ['blocks', 0, 'data', 'text'] }],
    });
  });
  it.each([
    null,
    [],
    {},
    { text: 1 },
    { text: 'ok', bad: () => 1 },
    { text: 'ok', bad: NaN },
  ])('rejects malformed or non-JSON data: %j', (data) => {
    expect(validateParagraphData(data).ok).toBe(false);
  });
  it('rejects cycles, excessive nesting and unreadable input without throwing or invoking getters', () => {
    const cycle: Record<string, unknown> = { text: 'cycle' };
    cycle['self'] = cycle;
    expect(validateParagraphData(cycle)).toMatchObject({
      ok: false,
      errors: [{ path: ['self'], code: 'circular_reference' }],
    });
    let deep: object = {};
    for (let i = 0; i < 300; i++) deep = { deep };
    expect(validateParagraphData({ text: 'deep', deep }).ok).toBe(false);
    const getter = vi.fn(() => 'read');
    expect(
      validateParagraphData(
        Object.defineProperty({}, 'text', { enumerable: true, get: getter }),
      ).ok,
    ).toBe(false);
    expect(getter).not.toHaveBeenCalled();
    expect(
      validateParagraphData(
        new Proxy(
          {},
          {
            ownKeys() {
              throw new Error('no');
            },
          },
        ),
      ).ok,
    ).toBe(false);
  });
});
