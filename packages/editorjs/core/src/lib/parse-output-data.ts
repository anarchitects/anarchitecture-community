import type { JsonObject, JsonValue, OutputData } from './output-data.js';
import { copyJson, fail, InvalidInput } from './json-value.js';

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

/** Policy for transient, non-JSON metadata on otherwise valid documents. */
export interface OutputDataNormalizationOptions {
  /** Reject symbol-keyed properties by default; opt in to omitting them recursively. */
  symbolKeys?: 'reject' | 'omit';
}

type Path = (string | number)[];
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
export function normalizeOutputData(
  input: unknown,
  options: OutputDataNormalizationOptions = {},
): OutputDataParseResult {
  try {
    const document = requireObject(
      copyJson(input, [], new WeakSet(), options.symbolKeys === 'omit'),
      [],
    );
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
