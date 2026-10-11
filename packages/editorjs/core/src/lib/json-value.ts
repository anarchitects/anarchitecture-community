import type { JsonObject, JsonValue } from './output-data.js';
import type {
  OutputDataParseError,
  OutputDataParseErrorCode,
} from './parse-output-data.js';

// Internal JSON copying shared by document and provenance parsing.
type Path = (string | number)[];
const MAX_DEPTH = 100;

export class InvalidInput extends Error {
  constructor(readonly issue: OutputDataParseError) {
    super(issue.message);
  }
}

export function fail(
  code: OutputDataParseErrorCode,
  path: Path,
  message: string,
): never {
  throw new InvalidInput({ code, path, message });
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
export function copyJson(
  value: unknown,
  path: Path,
  ancestors: WeakSet<object>,
  omitSymbolKeys = false,
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
  if (
    !omitSymbolKeys &&
    Object.getOwnPropertySymbols(descriptors).length !== 0
  ) {
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
        copyProperty(
          descriptors[index],
          [...path, index],
          ancestors,
          omitSymbolKeys,
        ),
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
        value: copyProperty(descriptor, childPath, ancestors, omitSymbolKeys),
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
  omitSymbolKeys = false,
): JsonValue {
  if (!descriptor.enumerable || !('value' in descriptor)) {
    fail(
      'non_json_value',
      path,
      'Expected an enumerable data property, not an accessor.',
    );
  }
  return copyJson(descriptor.value, path, ancestors, omitSymbolKeys);
}
