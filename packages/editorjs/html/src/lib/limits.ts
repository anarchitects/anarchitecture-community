import type { JsonValue } from '@anarchitects/editorjs-core';
import type { HtmlRenderLimits } from './contracts.js';

export const ceilings: Readonly<Required<HtmlRenderLimits>> = Object.freeze({
  maxInputBytes: 1024 * 1024,
  maxBlocks: 1000,
  maxDepth: 32,
  maxStringBytes: 100 * 1024,
  maxOutputBytes: 2 * 1024 * 1024,
  maxDiagnostics: 100,
});
export type Limits = typeof ceilings;
export class InputProblem extends Error {
  constructor(
    readonly kind: 'invalid_document' | 'limit_exceeded',
    readonly path: readonly (string | number)[],
  ) {
    super(kind);
  }
}

/** UTF-8 byte length, including the replacement encoding for lone surrogates. */
export function byteLength(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

/** Bound and detach JSON without calling accessors, iterators or toJSON. */
export function boundedInput(input: unknown, limits: Limits): JsonValue {
  let bytes = 0;
  const active = new WeakSet<object>();
  const add = (count: number, path: readonly (string | number)[]) => {
    bytes += count;
    if (bytes > limits.maxInputBytes)
      throw new InputProblem('limit_exceeded', path);
  };
  const string = (value: string, path: readonly (string | number)[]) => {
    if (
      value.length > limits.maxStringBytes ||
      byteLength(value) > limits.maxStringBytes
    )
      throw new InputProblem('limit_exceeded', path);
    add(byteLength(JSON.stringify(value)), path);
  };
  const copy = (value: unknown, path: (string | number)[]): JsonValue => {
    if (path.length > limits.maxDepth)
      throw new InputProblem('limit_exceeded', path);
    if (typeof value === 'string') {
      string(value, path);
      return value;
    }
    if (
      value === null ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      add(JSON.stringify(value).length, path);
      return value;
    }
    if (typeof value !== 'object' || value === null || active.has(value))
      throw new InputProblem('invalid_document', path);
    const array = Array.isArray(value);
    if (
      !array &&
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    )
      throw new InputProblem('invalid_document', path);
    active.add(value);
    add(2, path);
    const output: JsonValue[] | { [key: string]: JsonValue } = array
      ? []
      : Object.create(null);
    const length = array
      ? Object.getOwnPropertyDescriptor(value, 'length')?.value
      : undefined;
    if (
      array &&
      (length > limits.maxInputBytes ||
        (path.length === 1 &&
          path[0] === 'blocks' &&
          length > limits.maxBlocks))
    )
      throw new InputProblem('limit_exceeded', path);
    let count = 0;
    for (const key of Reflect.ownKeys(value)) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string')
        throw new InputProblem('invalid_document', path);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
        throw new InputProblem('invalid_document', [...path, key]);
      const childKey = array ? Number(key) : key;
      if (
        array &&
        (!Number.isInteger(childKey) ||
          Number(childKey) < 0 ||
          String(childKey) !== key ||
          Number(childKey) >= length)
      )
        throw new InputProblem('invalid_document', path);
      if (count++) add(1, path);
      if (!array) {
        string(key, path);
        add(1, path);
      }
      Object.defineProperty(output, key, {
        value: copy(descriptor.value, [...path, childKey]),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    if (array && count !== length)
      throw new InputProblem('invalid_document', path);
    active.delete(value);
    return output;
  };
  if (typeof input === 'string') {
    if (
      input.length > limits.maxInputBytes ||
      byteLength(input) > limits.maxInputBytes
    )
      throw new InputProblem('limit_exceeded', []);
    try {
      input = JSON.parse(input);
    } catch {
      throw new InputProblem('invalid_document', []);
    }
  }
  return copy(input, []);
}
