import { describe, expect, it } from 'vitest';
import { normalizeOutputData, parseOutputData } from '../src/index.js';
import type { OutputData, OutputDataParseErrorCode } from '../src/index.js';

function normalized(input: unknown): OutputData {
  const result = normalizeOutputData(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

describe('parseOutputData', () => {
  it.each(['', ' ', '{', '{"blocks":[],}', 'undefined'])(
    'reports malformed JSON: %j',
    (input) => {
      expect(parseOutputData(input)).toEqual({
        ok: false,
        error: {
          code: 'invalid_json',
          path: [],
          message: 'Input is not valid JSON.',
        },
      });
    },
  );

  it('accepts empty documents from JSON text and decoded input', () => {
    expect(parseOutputData(' { "blocks": [] } ')).toEqual({
      ok: true,
      data: { blocks: [] },
    });
    expect(parseOutputData({ blocks: [] })).toEqual(
      parseOutputData('{"blocks":[]}'),
    );
  });

  it('checks parsed values instead of treating valid JSON as a valid document', () => {
    for (const text of ['null', 'false', '42', '[]', '"text"']) {
      expect(parseOutputData(text)).toMatchObject({
        ok: false,
        error: { code: 'invalid_type', path: [] },
      });
    }
    expect(parseOutputData('{"blocks":[],"time":1e400}')).toMatchObject({
      ok: false,
      error: { code: 'non_json_value', path: ['time'] },
    });
  });

  it('preserves prototype-like JSON keys as own data without changing prototypes', () => {
    const input =
      '{"blocks":[{"type":"custom","data":{"__proto__":{"polluted":true},"constructor":{"prototype":{"value":1}}}}],"__proto__":{"root":true}}';
    const result = parseOutputData(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(JSON.parse(input));
    expect(Object.getPrototypeOf(result.data)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(result.data.blocks[0].data)).toBe(
      Object.prototype,
    );
    expect(Object.hasOwn(result.data, '__proto__')).toBe(true);
    expect(Object.hasOwn(result.data.blocks[0].data, '__proto__')).toBe(true);
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  });
});

describe('normalizeOutputData', () => {
  it.each<{
    input: unknown;
    code: OutputDataParseErrorCode;
    path: (string | number)[];
  }>([
    { input: undefined, code: 'non_json_value', path: [] },
    { input: {}, code: 'missing_property', path: ['blocks'] },
    { input: { blocks: null }, code: 'invalid_type', path: ['blocks'] },
    { input: { blocks: {} }, code: 'invalid_type', path: ['blocks'] },
    { input: { blocks: [null] }, code: 'invalid_type', path: ['blocks', 0] },
    {
      input: { blocks: [{}] },
      code: 'missing_property',
      path: ['blocks', 0, 'type'],
    },
    {
      input: { blocks: [{ type: 'custom' }] },
      code: 'missing_property',
      path: ['blocks', 0, 'data'],
    },
    {
      input: { blocks: [{ type: '', data: {} }] },
      code: 'invalid_type',
      path: ['blocks', 0, 'type'],
    },
    {
      input: { blocks: [{ type: 1, data: {} }] },
      code: 'invalid_type',
      path: ['blocks', 0, 'type'],
    },
    {
      input: { blocks: [{ type: 'custom', data: [] }] },
      code: 'invalid_type',
      path: ['blocks', 0, 'data'],
    },
    {
      input: { blocks: [{ type: 'custom', data: null }] },
      code: 'invalid_type',
      path: ['blocks', 0, 'data'],
    },
    {
      input: { blocks: [{ type: 'custom', data: {}, id: 1 }] },
      code: 'invalid_type',
      path: ['blocks', 0, 'id'],
    },
    {
      input: { blocks: [{ type: 'custom', data: {}, tunes: [] }] },
      code: 'invalid_type',
      path: ['blocks', 0, 'tunes'],
    },
    {
      input: { blocks: [], time: 'now' },
      code: 'invalid_type',
      path: ['time'],
    },
    { input: { blocks: [], time: null }, code: 'invalid_type', path: ['time'] },
    {
      input: { blocks: [], version: 2 },
      code: 'invalid_type',
      path: ['version'],
    },
  ])('returns actionable errors at $path', ({ input, code, path }) => {
    const result = normalizeOutputData(input);
    expect(result).toMatchObject({
      ok: false,
      error: { code, path, message: expect.any(String) },
    });
  });

  it('omits only undefined optional metadata and never fabricates values', () => {
    const input = {
      time: undefined,
      version: undefined,
      blocks: [{ id: undefined, type: 'custom', data: {}, tunes: undefined }],
    };
    const output = normalized(input);
    expect(output).toEqual({ blocks: [{ type: 'custom', data: {} }] });
    expect(Object.hasOwn(output, 'time')).toBe(false);
    expect(Object.hasOwn(output.blocks[0], 'id')).toBe(false);
    expect(Object.hasOwn(input, 'time')).toBe(true);
    expect(
      normalized({
        time: 0,
        version: '',
        blocks: [{ id: '', type: 'custom', data: {} }],
      }),
    ).toEqual({
      time: 0,
      version: '',
      blocks: [{ id: '', type: 'custom', data: {} }],
    });
  });

  it('preserves unknown tools, tunes, extension fields, and HTML strings without mutation', () => {
    const data = Object.freeze({
      'a/b~c': [null, false, 1, { text: '<script>untrusted()</script>' }],
    });
    const block = Object.freeze({
      type: 'vendor/custom',
      data,
      tunes: { custom: [1, 'value'] },
      extension: { enabled: true },
    });
    const input = Object.freeze({
      blocks: Object.freeze([block]),
      version: 'future',
      app: { schema: 3 },
    });
    const output = normalized(input);
    expect(output).toEqual(input);
    expect(output).not.toBe(input);
    expect(output.blocks).not.toBe(input.blocks);
    expect(output.blocks[0].data).not.toBe(data);
    expect(normalized(output)).toEqual(output);
    expect(parseOutputData(JSON.stringify(output))).toEqual({
      ok: true,
      data: output,
    });
  });

  it('clones shared references independently without misidentifying a cycle', () => {
    const shared = { nested: [1, 2] };
    const result = normalized({
      blocks: [
        { type: 'custom', data: shared },
        { type: 'custom', data: shared },
      ],
    });
    expect(result.blocks[0].data).toEqual(result.blocks[1].data);
    expect(result.blocks[0].data).not.toBe(result.blocks[1].data);
  });

  it.each([
    undefined,
    NaN,
    Infinity,
    -Infinity,
    1n,
    Symbol('value'),
    () => 1,
    new Date(),
    new Map(),
  ])(
    'rejects non-JSON payload values instead of silently rewriting them: %s',
    (value) => {
      expect(
        normalizeOutputData({ blocks: [{ type: 'custom', data: { value } }] }),
      ).toMatchObject({
        ok: false,
        error: { code: 'non_json_value', path: ['blocks', 0, 'data', 'value'] },
      });
    },
  );

  it('rejects nested undefined metadata names, cycles, sparse arrays, and extra array properties', () => {
    expect(
      normalizeOutputData({
        blocks: [{ type: 'custom', data: { id: undefined } }],
      }),
    ).toMatchObject({
      ok: false,
      error: { path: ['blocks', 0, 'data', 'id'] },
    });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(
      normalizeOutputData({ blocks: [{ type: 'custom', data: cyclic }] }),
    ).toMatchObject({
      ok: false,
      error: {
        code: 'circular_reference',
        path: ['blocks', 0, 'data', 'self'],
      },
    });
    for (const items of [new Array(2), Object.assign([1], { extra: 2 })]) {
      expect(
        normalizeOutputData({ blocks: [{ type: 'custom', data: { items } }] }),
      ).toMatchObject({
        ok: false,
        error: { code: 'non_json_value', path: ['blocks', 0, 'data', 'items'] },
      });
    }
  });

  it('does not invoke getters or toJSON hooks and does not drop hidden or symbol properties', () => {
    let calls = 0;
    const accessor = {
      get value() {
        calls++;
        return 1;
      },
    };
    const hook = {
      toJSON() {
        calls++;
        return {};
      },
    };
    const hidden = Object.defineProperty({}, 'hidden', { value: 1 });
    for (const data of [accessor, hook, hidden, { [Symbol('key')]: 1 }]) {
      expect(
        normalizeOutputData({ blocks: [{ type: 'custom', data }] }),
      ).toMatchObject({
        ok: false,
        error: { code: 'non_json_value' },
      });
    }
    expect(calls).toBe(0);
  });

  it('optionally omits symbol-keyed metadata recursively without reading it or mutating input', () => {
    let calls = 0;
    const metadata = Symbol('tracking');
    const block = { type: 'custom', data: { items: [{ text: 'Retained' }] } };
    const input = { blocks: [block] };
    for (const value of [
      input,
      input.blocks,
      block,
      block.data,
      block.data.items,
      block.data.items[0],
    ]) {
      Object.defineProperty(value, metadata, {
        get() {
          calls++;
          throw new Error('Do not read');
        },
      });
    }
    expect(normalizeOutputData(input)).toMatchObject({
      ok: false,
      error: { code: 'non_json_value' },
    });
    expect(parseOutputData(input)).toMatchObject({
      ok: false,
      error: { code: 'non_json_value' },
    });
    const result = normalizeOutputData(input, { symbolKeys: 'omit' });
    expect(result).toEqual({
      ok: true,
      data: {
        blocks: [{ type: 'custom', data: { items: [{ text: 'Retained' }] } }],
      },
    });
    if (!result.ok) throw new Error('Expected normalized document');
    expect(normalizeOutputData(result.data)).toEqual(result);
    expect(result.data.blocks[0].data).not.toBe(block.data);
    expect(Object.getOwnPropertySymbols(block)).toEqual([metadata]);
    expect(calls).toBe(0);
  });

  it('retains strict JSON validation for string-keyed properties when omitting symbol keys', () => {
    let calls = 0;
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const values = [
      Symbol('value'),
      undefined,
      NaN,
      new Date(),
      new Map(),
      () => 1,
      {
        get text() {
          calls++;
          return 'Do not read';
        },
      },
      {
        toJSON() {
          calls++;
          return {};
        },
      },
      Object.defineProperty({}, 'hidden', { value: 1 }),
      new Array(2),
      Object.assign([1], { extra: true }),
      cyclic,
    ];
    for (const value of values) {
      const input = { blocks: [{ type: 'custom', data: { value } }] };
      expect(normalizeOutputData(input, { symbolKeys: 'omit' })).toEqual(
        normalizeOutputData(input),
      );
      expect(normalizeOutputData(input, { symbolKeys: 'omit' }).ok).toBe(false);
    }
    expect(calls).toBe(0);
  });

  it('reports unreadable objects without throwing and limits recursive nesting', () => {
    const proxy = Proxy.revocable({}, {});
    proxy.revoke();
    expect(
      normalizeOutputData({ blocks: [{ type: 'custom', data: proxy.proxy }] }),
    ).toMatchObject({
      ok: false,
      error: { code: 'unreadable_value', path: ['blocks', 0, 'data'] },
    });
    let nested: object = {};
    for (let index = 0; index < 101; index++) nested = { nested };
    expect(
      normalizeOutputData({ blocks: [{ type: 'custom', data: nested }] }),
    ).toMatchObject({
      ok: false,
      error: { code: 'max_depth_exceeded' },
    });
  });

  it('accepts null-prototype plain objects and preserves unusual property paths', () => {
    expect(
      normalized(Object.assign(Object.create(null), { blocks: [] })),
    ).toEqual({ blocks: [] });
    expect(
      normalizeOutputData({
        blocks: [{ type: 'custom', data: { 'a/b.c~d': undefined } }],
      }),
    ).toMatchObject({
      ok: false,
      error: { path: ['blocks', 0, 'data', 'a/b.c~d'] },
    });
  });
});
