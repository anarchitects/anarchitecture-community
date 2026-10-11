import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { validateOutputData } from '../src/index.js';
import type {
  ToolDataValidator,
  ToolValidationContext,
  ToolValidationResult,
} from '../src/index.js';

const paragraphValidator: ToolDataValidator = (data) => {
  if (
    data !== null &&
    typeof data === 'object' &&
    'text' in data &&
    typeof data.text === 'string'
  ) {
    return { ok: true };
  }
  return {
    ok: false,
    errors: [
      { path: ['text'], code: 'text_required', message: 'Expected text.' },
    ],
  };
};

function document(data: object = { text: 'Hello' }) {
  return { blocks: [{ type: 'paragraph', data }] };
}

describe('structural validation', () => {
  it.each([
    ['{', 'invalid_json', []],
    [{}, 'missing_property', ['blocks']],
    [{ blocks: [null] }, 'invalid_type', ['blocks', 0]],
    [
      { blocks: [{ type: 'paragraph', data: [] }] },
      'invalid_type',
      ['blocks', 0, 'data'],
    ],
    [
      { blocks: [{ type: 'paragraph', data: { value: undefined } }] },
      'non_json_value',
      ['blocks', 0, 'data', 'value'],
    ],
  ])(
    'rejects invalid envelopes before invoking plugins: %j',
    (input, code, path) => {
      const validator = vi.fn<ToolDataValidator>(() => ({ ok: true }));
      expect(
        validateOutputData(input, {
          toolValidators: new Map([['paragraph', validator]]),
        }),
      ).toMatchObject({
        ok: false,
        errors: [{ source: 'structure', code, path }],
      });
      expect(validator).not.toHaveBeenCalled();
    },
  );

  it('accepts an empty document and optional missing IDs', () => {
    expect(
      validateOutputData('{"blocks":[]}', {
        blockIds: 'required',
        unknownTools: 'reject',
      }),
    ).toEqual({ ok: true, data: { blocks: [] } });
    expect(validateOutputData(document())).toEqual({
      ok: true,
      data: document(),
    });
  });

  it('reports required, blank, and duplicate IDs in block order without invoking plugins', () => {
    const validator = vi.fn<ToolDataValidator>(() => ({ ok: true }));
    const input = {
      blocks: [
        { type: 'paragraph', data: {} },
        { id: '  ', type: 'paragraph', data: {} },
        { id: 'same', type: 'paragraph', data: {} },
        { id: 'same', type: 'paragraph', data: {} },
      ],
    };
    expect(
      validateOutputData(input, {
        blockIds: 'required',
        toolValidators: new Map([['paragraph', validator]]),
      }),
    ).toMatchObject({
      ok: false,
      errors: [
        {
          source: 'structure',
          code: 'missing_block_id',
          path: ['blocks', 0, 'id'],
        },
        {
          source: 'structure',
          code: 'invalid_block_id',
          path: ['blocks', 1, 'id'],
        },
        {
          source: 'structure',
          code: 'duplicate_block_id',
          path: ['blocks', 3, 'id'],
        },
      ],
    });
    expect(validator).not.toHaveBeenCalled();
    expect(validateOutputData(input, { blockIds: 'ignore' })).toEqual({
      ok: true,
      data: input,
    });
  });

  it('checks present IDs by default and never coerces invalid ID types', () => {
    const blocks = [0, 1].map(() => ({
      id: '__proto__',
      type: 'custom',
      data: {},
    }));
    expect(validateOutputData({ blocks })).toMatchObject({
      ok: false,
      errors: [{ code: 'duplicate_block_id', path: ['blocks', 1, 'id'] }],
    });
    expect(
      validateOutputData({ blocks: [{ id: '', type: 'custom', data: {} }] }),
    ).toMatchObject({ ok: false, errors: [{ code: 'invalid_block_id' }] });
    expect(
      validateOutputData(
        { blocks: [{ id: 1, type: 'custom', data: {} }] },
        { blockIds: 'ignore' },
      ),
    ).toMatchObject({ ok: false, errors: [{ code: 'invalid_type' }] });
  });
});

describe('pluggable tool validation', () => {
  it('preserves unknown tools by default and can require registered validators', () => {
    const input = {
      blocks: [{ type: 'vendor/tool', data: { custom: [true, null] } }],
    };
    expect(validateOutputData(input)).toEqual({ ok: true, data: input });
    expect(validateOutputData(input, { unknownTools: 'reject' })).toEqual({
      ok: false,
      errors: [
        {
          source: 'tool',
          code: 'unknown_tool',
          path: ['blocks', 0, 'type'],
          tool: 'vendor/tool',
          message: 'No validator is registered for this tool.',
        },
      ],
    });
  });

  it('composes independently supplied validators and prefixes relative diagnostic paths', () => {
    const customValidator: ToolDataValidator = () => ({
      ok: false,
      errors: [
        {
          path: ['items', 0, 'a/b.c~d'],
          code: 'invalid_item',
          message: 'Expected an item label.',
        },
        { message: 'Custom payload rejected.' },
      ],
    });
    const toolValidators = new Map([
      ['paragraph', paragraphValidator],
      ['custom', customValidator],
    ]);
    const input = {
      blocks: [
        { type: 'paragraph', data: {} },
        { type: 'custom', data: { items: [{}] } },
      ],
    };
    const result = validateOutputData(input, { toolValidators });
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          source: 'tool',
          code: 'tool_data_invalid',
          tool: 'paragraph',
          path: ['blocks', 0, 'data', 'text'],
          validatorCode: 'text_required',
          message: 'Expected text.',
        },
        {
          source: 'tool',
          code: 'tool_data_invalid',
          tool: 'custom',
          path: ['blocks', 1, 'data', 'items', 0, 'a/b.c~d'],
          validatorCode: 'invalid_item',
          message: 'Expected an item label.',
        },
        {
          source: 'tool',
          code: 'tool_data_invalid',
          tool: 'custom',
          path: ['blocks', 1, 'data'],
          message: 'Custom payload rejected.',
        },
      ],
    });
    expect(validateOutputData(input, { toolValidators })).toEqual(result);
    expect(toolValidators.size).toBe(2);
  });

  it('treats prototype-like tool names as exact registry keys', () => {
    const validator = vi.fn<ToolDataValidator>(() => ({ ok: true }));
    const input = {
      blocks: [
        { type: '__proto__', data: {} },
        { type: 'constructor', data: {} },
      ],
    };
    const toolValidators = new Map([
      ['__proto__', validator],
      ['constructor', validator],
    ]);
    expect(
      validateOutputData(input, { toolValidators, unknownTools: 'reject' }).ok,
    ).toBe(true);
    expect(validator).toHaveBeenCalledTimes(2);
  });

  it('provides frozen detached snapshots and preserves HTML and extension data', () => {
    const input = {
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          data: { text: '<img src=x onerror=alert(1)>', items: [{ value: 1 }] },
          extra: { enabled: true },
        },
      ],
      version: 'future',
    };
    let snapshot: unknown;
    const validator: ToolDataValidator = (data, context) => {
      snapshot = data;
      expect(context).toEqual({
        type: 'paragraph',
        id: 'block-1',
        blockIndex: 0,
      });
      expect(Object.isFrozen(context)).toBe(true);
      expect(Object.isFrozen(data)).toBe(true);
      if (
        data !== null &&
        typeof data === 'object' &&
        'items' in data &&
        Array.isArray(data.items)
      ) {
        expect(Object.isFrozen(data.items)).toBe(true);
        expect(Object.isFrozen(data.items[0])).toBe(true);
      }
      return paragraphValidator(data, context);
    };
    const result = validateOutputData(input, {
      toolValidators: new Map([['paragraph', validator]]),
    });
    expect(result).toEqual({ ok: true, data: input });
    if (!result.ok) return;
    expect(result.data).not.toBe(input);
    expect(snapshot).not.toBe(input.blocks[0].data);
    expect(snapshot).not.toBe(result.data.blocks[0].data);
    expect(Object.isFrozen(result.data.blocks[0].data)).toBe(false);
  });

  it('contains validator exceptions and mutation attempts without leaking exception details', () => {
    const input = document();
    for (const validator of [
      () => {
        throw new Error('sensitive transport detail');
      },
      (data: unknown) => {
        Object.assign(data as object, { text: 'changed' });
        return { ok: true as const };
      },
    ]) {
      expect(
        validateOutputData(input, {
          toolValidators: new Map([['paragraph', validator]]),
        }),
      ).toEqual({
        ok: false,
        errors: [
          {
            source: 'tool',
            code: 'validator_failed',
            path: ['blocks', 0, 'data'],
            tool: 'paragraph',
            message: 'Tool validator threw while checking block data.',
          },
        ],
      });
      expect(input).toEqual(document());
    }
  });

  it.each([
    null,
    true,
    undefined,
    {},
    { ok: true, errors: [] },
    { ok: false, errors: [] },
    { ok: false, errors: [{}] },
    { ok: false, errors: [{ message: '' }] },
    { ok: false, errors: [{ message: 'bad', path: [-1] }] },
    { ok: false, errors: [{ message: 'bad', path: [null] }] },
    { ok: false, errors: [{ message: 'bad', code: 1 }] },
    { ok: false, errors: new Array(1) },
  ])(
    'rejects invalid callback results rather than accepting content: %j',
    (response) => {
      const validator = (() => response) as ToolDataValidator;
      expect(
        validateOutputData(document(), {
          toolValidators: new Map([['paragraph', validator]]),
        }),
      ).toMatchObject({
        ok: false,
        errors: [
          { code: 'invalid_validator_result', path: ['blocks', 0, 'data'] },
        ],
      });
    },
  );

  it('rejects accidentally asynchronous validators and handles rejected promises', async () => {
    for (const callback of [
      async () => ({ ok: true }),
      async () => {
        throw new Error('failure');
      },
    ]) {
      const validator = callback as unknown as ToolDataValidator;
      expect(
        validateOutputData(document(), {
          toolValidators: new Map([['paragraph', validator]]),
        }),
      ).toMatchObject({
        ok: false,
        errors: [{ code: 'invalid_validator_result' }],
      });
    }
    await Promise.resolve();
    expectTypeOf<
      () => Promise<ToolValidationResult>
    >().not.toExtend<ToolDataValidator>();
    expectTypeOf<
      (data: { text: string }) => ToolValidationResult
    >().not.toExtend<ToolDataValidator>();
    expectTypeOf<Parameters<ToolDataValidator>[0]>().toBeUnknown();
    expectTypeOf<
      Parameters<ToolDataValidator>[1]
    >().toEqualTypeOf<ToolValidationContext>();
  });
});
