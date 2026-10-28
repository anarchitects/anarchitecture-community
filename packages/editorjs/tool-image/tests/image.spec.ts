import { describe, expect, it } from 'vitest';
import { defineImageTool, validateImageData } from '../src/index.js';
import {
  composeToolRegistry,
  createToolResolver,
  validateOutputData,
} from '@anarchitects/editorjs-core';
const data = {
  file: { url: 'asset.svg', id: 'host', nested: { width: 32 } },
  caption: '<b>Caption</b>',
  withBorder: false,
  withBackground: false,
  stretched: false,
};
class Tool {}
const config = {
  uploader: {
    async uploadByFile(input: string) {
      return { success: 1 as const, file: { url: input } };
    },
    async uploadByUrl(url: string) {
      return { success: 1 as const, file: { url } };
    },
  },
};
describe('image structural contract', () => {
  it.each([undefined, '', 'A red square', '<literal>'])(
    'accepts alt %s without mutation',
    (alt) => {
      const input = { ...data, ...(alt === undefined ? {} : { alt }) };
      const before = structuredClone(input);
      expect(validateImageData(input)).toEqual({ ok: true });
      expect(input).toEqual(before);
    },
  );
  it.each([null, 42, '  ', undefined])(
    'rejects explicitly invalid alt %s',
    (alt) => {
      expect(validateImageData({ ...data, alt }).ok).toBe(false);
    },
  );
  it.each([
    null,
    [],
    {},
    { ...data, file: { url: '' } },
    { ...data, file: { url: 23 } },
    { ...data, caption: null },
    { ...data, stretched: 'true' },
    { ...data, file: { url: 'asset', bad: new Date() } },
    { ...data, file: { url: 'asset', bad: () => 0 } },
  ])('rejects malformed data', (value) => {
    expect(validateImageData(value).ok).toBe(false);
  });
  it('rejects cycles, accessors and hostile proxies without invoking getters', () => {
    const cycle: Record<string, unknown> = {};
    cycle['self'] = cycle;
    expect(validateImageData({ ...data, file: { url: 'x', cycle } }).ok).toBe(
      false,
    );
    let called = false;
    expect(
      validateImageData({
        ...data,
        get alt() {
          called = true;
          return 'unsafe';
        },
      }).ok,
    ).toBe(false);
    expect(called).toBe(false);
    expect(
      validateImageData(
        new Proxy(
          {},
          {
            ownKeys() {
              throw new Error('hostile');
            },
          },
        ),
      ).ok,
    ).toBe(false);
  });
  it('composes document paths and aliases', () => {
    const result = validateOutputData(
      { blocks: [{ type: 'photo', data: { ...data, file: { url: '' } } }] },
      {
        toolValidators: new Map([['photo', validateImageData]]),
        unknownTools: 'reject',
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors[0].path).toEqual([
        'blocks',
        0,
        'data',
        'file',
        'url',
      ]);
  });
});
describe('registry config', () => {
  it('stays inert and supports eager/lazy, aliases and owner disposal', async () => {
    let calls = 0;
    const definition = defineImageTool({
      name: 'photo',
      source: 'lazy',
      load: async () => {
        calls++;
        return Tool;
      },
      settings: { config },
    });
    expect(calls).toBe(0);
    expect(definition.settings.config).toBe(config);
    const registry = composeToolRegistry([[definition]], {
      profile: { tools: [] },
    });
    const first = createToolResolver(registry, { defaultBlock: 'photo' });
    const second = createToolResolver(registry, { defaultBlock: 'photo' });
    expect((await first.resolve()).photo.class).toBe(Tool);
    first.dispose();
    expect((await second.resolve()).photo.class).toBe(Tool);
    expect(calls).toBe(2);
    second.dispose();
    expect(
      defineImageTool({
        source: 'eager',
        registration: { class: Tool, config },
      }).name,
    ).toBe('image');
  });
  it.each([
    undefined,
    {},
    { uploader: {} },
    { uploader: config.uploader, endpoints: {} },
    { uploader: config.uploader, types: 1 },
    { uploader: config.uploader, features: { caption: 'bad' } },
  ])('rejects unsupported config', (invalid) => {
    expect(() =>
      defineImageTool({
        source: 'lazy',
        load: async () => Tool,
        settings: { config: invalid },
      } as never),
    ).toThrow();
  });
});
