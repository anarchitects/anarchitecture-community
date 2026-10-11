// eslint-disable-next-line @nx/enforce-module-boundaries -- Compiled outside the workspace against the packed package.
import type {
  JsonArray,
  JsonObject,
  JsonValue,
  OutputBlockData,
  OutputBlockDataFor,
  OutputData,
} from '@anarchitects/editorjs-core';

interface ToolData {
  paragraph: { text: string };
  rating: { score: number; maximum: number };
}

type Block = OutputBlockDataFor<ToolData>;

export const document: OutputData<Block> = {
  blocks: [
    { type: 'paragraph', data: { text: 'Typed consumer' } },
    { id: 'rating', type: 'rating', data: { score: 4, maximum: 5 } },
  ],
};

export const unknownDocument: OutputData = document;
export const singleBlock: OutputBlockData<'custom', { value: boolean }> = {
  type: 'custom',
  data: { value: true },
};

export function summarize(block: Block): string {
  if (block.type === 'paragraph') {
    return block.data.text;
  }
  return `${block.data.score}/${block.data.maximum}`;
}

export const array: JsonArray = [null, true, 1, 'text'];
export const object: JsonObject = { nested: array };
export const value: JsonValue = object;

// @ts-expect-error A known type cannot carry another tool's data.
export const mismatched: Block = { type: 'rating', data: { text: 'wrong' } };
// @ts-expect-error Saved document metadata must use a numeric timestamp.
export const invalidTime: OutputData = { blocks: [], time: 'now' };
// @ts-expect-error Unknown plugin data is opaque until narrowed or validated.
export const unsafeText = unknownDocument.blocks[0].data.text;
// @ts-expect-error JSON values cannot contain functions.
export const notJson: JsonValue = { callback: () => 'text' };
