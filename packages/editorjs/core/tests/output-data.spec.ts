import type {
  OutputBlockData as EditorOutputBlockData,
  OutputData as EditorOutputData,
} from '@editorjs/editorjs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  JsonObject,
  JsonValue,
  OutputBlockData,
  OutputBlockDataFor,
  OutputData,
} from '../src/index.js';

interface ParagraphData {
  text: string;
}

interface ToolData {
  paragraph: ParagraphData;
  callout: { message: string; tone: 'info' | 'warning' };
}

type CustomBlock = OutputBlockDataFor<ToolData>;

describe('document contracts', () => {
  it('preserves custom block data through JSON serialization', () => {
    const document: OutputData<CustomBlock> = {
      time: 1_700_000_000_000,
      version: '2.31.7',
      blocks: [
        { id: 'intro', type: 'paragraph', data: { text: 'Hello' } },
        {
          type: 'callout',
          data: { message: 'Custom tool', tone: 'info' },
          tunes: { alignment: { value: 'center' } },
        },
      ],
    };
    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });

  it('accepts minimal documents and unfamiliar plugin objects', () => {
    const minimal: OutputData = { blocks: [] };
    const unfamiliar: OutputData = {
      blocks: [
        { type: 'third-party/widget', data: { arbitrary: [null, true, 1] } },
      ],
    };
    expect(minimal.blocks).toEqual([]);
    expectTypeOf(unfamiliar.blocks[0].data).toEqualTypeOf<object>();
    // @ts-expect-error Plugin properties are not known without narrowing.
    void unfamiliar.blocks[0].data.arbitrary;
    expectTypeOf<NonNullable<OutputBlockData['tunes']>[string]>().toBeUnknown();
  });

  it('narrows data by the configured tool name', () => {
    const block = { type: 'paragraph', data: { text: 'Hello' } } as CustomBlock;
    if (block.type === 'paragraph') {
      expectTypeOf(block.data).toEqualTypeOf<ParagraphData>();
      // @ts-expect-error A paragraph does not have callout data.
      void block.data.message;
    }
    expectTypeOf<OutputData<CustomBlock>>().toExtend<OutputData>();
    expectTypeOf<{
      type: 'callout';
      data: ParagraphData;
    }>().not.toExtend<CustomBlock>();
    expectTypeOf<{
      type: 'unknown-tool';
      data: ParagraphData;
    }>().not.toExtend<CustomBlock>();
    // @ts-expect-error Tool data must be an object, matching Editor.js.
    expectTypeOf<OutputBlockData<'invalid', string>>();
    // @ts-expect-error Map entries must describe saved tool objects.
    expectTypeOf<OutputBlockDataFor<{ invalid: number }>>();
  });

  it('is structurally compatible with the official Editor.js declarations', () => {
    expectTypeOf<OutputData>().toExtend<EditorOutputData>();
    expectTypeOf<EditorOutputData>().toExtend<OutputData>();
    expectTypeOf<OutputData<CustomBlock>>().toExtend<EditorOutputData>();
    expectTypeOf<OutputBlockData<'paragraph', ParagraphData>>().toExtend<
      EditorOutputBlockData<'paragraph', ParagraphData>
    >();
    expectTypeOf<EditorOutputBlockData<'paragraph', ParagraphData>>().toExtend<
      OutputBlockData<'paragraph', ParagraphData>
    >();
    expectTypeOf<EditorOutputData>().not.toExtend<OutputData<CustomBlock>>();
    expectTypeOf<{ blocks: [{ type: string }] }>().not.toExtend<OutputData>();
    expectTypeOf<{ blocks: []; time: string }>().not.toExtend<OutputData>();
  });

  it('offers an opt-in JSON shape without claiming to validate plugin data', () => {
    const data = {
      text: 'Hello',
      items: [null, true, 3, { nested: ['value'] }],
    } satisfies JsonObject;
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
    expectTypeOf<undefined>().not.toExtend<JsonValue>();
    expectTypeOf<bigint>().not.toExtend<JsonValue>();
    expectTypeOf<Date>().not.toExtend<JsonValue>();
    expectTypeOf<() => string>().not.toExtend<JsonValue>();
  });
});
