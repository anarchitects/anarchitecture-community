import type { JsonObject, JsonValue, OutputData } from './output-data.js';

export type OutputDataParseErrorCode =
  | 'invalid_json'
  | 'invalid_type'
  | 'missing_property'
  | 'non_json_value'
  | 'circular_reference'
  | 'max_depth_exceeded'
  | 'unreadable_value';

/** The first error, with an unambiguous property/index path; [] means the root. */
export interface OutputDataParseError {
  code: OutputDataParseErrorCode;
  path: readonly (string | number)[];
  message: string;
}

export type OutputDataParseResult =
  | { ok: true; data: OutputData }
  | { ok: false; error: OutputDataParseError };

type Path = (string | number)[];
const MAX_DEPTH = 100;

class InvalidInput extends Error {
  constructor(readonly issue: OutputDataParseError) {
    super(issue.message);
  }
}

function fail(
  code: OutputDataParseErrorCode,
  path: Path,
  message: string,
): never {
  throw new InvalidInput({ code, path, message });
}

/** Parse JSON text, or normalize an already decoded value, without throwing. */
export function parseOutputData(input: unknown): OutputDataParseResult {
  if (typeof input !== 'string') {
    return normalizeOutputData(input);
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(input);
  } catch {
    return {
      ok: false,
      error: {
        code: 'invalid_json',
        path: [],
        message: 'Input is not valid JSON.',
      },
    };
  }
  return normalizeOutputData(decoded);
}

/**
 * Validate the envelope and JSON shape, returning a detached copy.
 * Omit undefined optional metadata; never invent metadata or rewrite payloads.
 * Tool schemas, ID policies, HTML sanitization, and version checks are separate.
 */
export function normalizeOutputData(input: unknown): OutputDataParseResult {
  try {
    const document = requireObject(copyJson(input, [], new WeakSet()), []);
    if (!Object.hasOwn(document, 'blocks')) {
      fail('missing_property', ['blocks'], 'Document requires a blocks array.');
    }
    if (!Array.isArray(document.blocks)) {
      fail('invalid_type', ['blocks'], 'Expected a blocks array.');
    }
    if (Object.hasOwn(document, 'time') && typeof document.time !== 'number') {
      fail('invalid_type', ['time'], 'Expected a finite numeric timestamp.');
    }
    if (
      Object.hasOwn(document, 'version') &&
      typeof document.version !== 'string'
    ) {
      fail(
        'invalid_type',
        ['version'],
        'Expected an Editor.js version string.',
      );
    }
    document.blocks.forEach((value, index) => {
      const path: Path = ['blocks', index];
      const block = requireObject(value, path);
      for (const key of ['type', 'data']) {
        if (!Object.hasOwn(block, key)) {
          fail('missing_property', [...path, key], `Block requires ${key}.`);
        }
      }
      if (typeof block.type !== 'string' || block.type.length === 0) {
        fail(
          'invalid_type',
          [...path, 'type'],
          'Expected a non-empty tool name.',
        );
      }
      requireObject(block.data, [...path, 'data']);
      if (Object.hasOwn(block, 'id') && typeof block.id !== 'string') {
        fail('invalid_type', [...path, 'id'], 'Expected a block ID string.');
      }
      if (Object.hasOwn(block, 'tunes')) {
        requireObject(block.tunes, [...path, 'tunes']);
      }
    });
    // Envelope checks above establish OutputData; no plugin-specific schema is assumed.
    return { ok: true, data: document as unknown as OutputData };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof InvalidInput
          ? error.issue
          : {
              code: 'unreadable_value',
              path: [],
              message: 'Input could not be inspected as plain JSON data.',
            },
    };
  }
}

function requireObject(value: JsonValue, path: Path): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('invalid_type', path, 'Expected a plain JSON object.');
  }
  return value;
}

function isOptionalMetadata(path: Path): boolean {
  return (
    (path.length === 1 && (path[0] === 'time' || path[0] === 'version')) ||
    (path.length === 3 &&
      path[0] === 'blocks' &&
      typeof path[1] === 'number' &&
      (path[2] === 'id' || path[2] === 'tunes'))
  );
}

/** Inspect descriptors so accessors and toJSON hooks are never called. */
function copyJson(
  value: unknown,
  path: Path,
  ancestors: WeakSet<object>,
): JsonValue {
  if (path.length > MAX_DEPTH) {
    fail(
      'max_depth_exceeded',
      path,
      'JSON nesting exceeds the limit of 100 levels.',
    );
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'object' || value === null) {
    fail('non_json_value', path, 'Expected a JSON value with finite numbers.');
  }
  if (ancestors.has(value)) {
    fail(
      'circular_reference',
      path,
      'Circular references cannot be stored as JSON.',
    );
  }
  let descriptors: Record<string, PropertyDescriptor>;
  let array: boolean;
  try {
    array = Array.isArray(value);
    const prototype: unknown = Object.getPrototypeOf(value);
    if (!array && prototype !== Object.prototype && prototype !== null) {
      fail(
        'non_json_value',
        path,
        'Expected a plain object, not a class instance.',
      );
    }
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    if (error instanceof InvalidInput) throw error;
    fail(
      'unreadable_value',
      path,
      'Value could not be inspected as plain JSON data.',
    );
  }
  if (Object.getOwnPropertySymbols(descriptors).length !== 0) {
    fail('non_json_value', path, 'Symbol keys cannot be stored as JSON.');
  }
  ancestors.add(value);
  try {
    if (array) {
      const length: unknown = descriptors.length.value;
      if (
        typeof length !== 'number' ||
        !Number.isInteger(length) ||
        length < 0
      ) {
        fail('non_json_value', path, 'Expected an array with a valid length.');
      }
      const keys = Object.keys(descriptors).filter((key) => key !== 'length');
      if (
        keys.length !== length ||
        keys.some((key) => !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)
      ) {
        fail(
          'non_json_value',
          path,
          'Expected a dense array without extra properties.',
        );
      }
      return Array.from({ length }, (_, index) =>
        copyProperty(descriptors[index], [...path, index], ancestors),
      );
    }
    const copy: JsonObject = {};
    for (const key of Object.keys(descriptors)) {
      const descriptor = descriptors[key];
      const childPath = [...path, key];
      if (
        descriptor.enumerable &&
        'value' in descriptor &&
        descriptor.value === undefined &&
        isOptionalMetadata(childPath)
      ) {
        continue;
      }
      // Define an own property even for __proto__; never invoke a prototype setter.
      Object.defineProperty(copy, key, {
        value: copyProperty(descriptor, childPath, ancestors),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return copy;
  } finally {
    ancestors.delete(value);
  }
}

function copyProperty(
  descriptor: PropertyDescriptor,
  path: Path,
  ancestors: WeakSet<object>,
): JsonValue {
  if (!descriptor.enumerable || !('value' in descriptor)) {
    fail(
      'non_json_value',
      path,
      'Expected an enumerable data property, not an accessor.',
    );
  }
  return copyJson(descriptor.value, path, ancestors);
}
