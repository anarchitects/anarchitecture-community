import type { OutputData } from './output-data.js';
import { copyJson, fail, InvalidInput } from './json-value.js';
import { parseOutputData } from './parse-output-data.js';
import type { OutputDataParseError } from './parse-output-data.js';

/** Application-owned schema identity and opaque version, not an Editor.js release. */
export interface ContentSchemaVersion {
  id: string;
  version: string;
}

/** Host application or process that produced content; not inferred from a package. */
export interface ContentProducer {
  name: string;
  version?: string;
}

/**
 * Optional JSON sidecar. OutputData.version remains the Editor.js package version.
 * All recorded versions are opaque provenance, not proof of compatibility.
 */
export interface ContentProvenance {
  schema?: ContentSchemaVersion;
  /** Versions keyed by configured tool name, not necessarily npm package name. */
  toolVersions?: Record<string, string>;
  producer?: ContentProducer;
}

export type ContentParseResult =
  | { ok: true; data: OutputData; provenance?: ContentProvenance }
  | { ok: false; error: OutputDataParseError };

/**
 * Parse raw OutputData with an optional decoded provenance sidecar.
 * Unknown/future version strings and JSON extensions are preserved, never
 * compared, inferred, upgraded, or downgraded. Hosts own compatibility policy
 * and explicit migrations. This result is not a new required storage envelope.
 */
export function parseContentWithProvenance(
  input: unknown,
  provenance?: unknown,
): ContentParseResult {
  const parsed = parseOutputData(input);
  if (!parsed.ok) {
    return {
      ok: false,
      error: { ...parsed.error, path: ['data', ...parsed.error.path] },
    };
  }
  if (provenance === undefined) return parsed;
  try {
    const path = ['provenance'];
    const metadata = copyJson(provenance, path, new WeakSet());
    requireRecord(metadata, path);
    if (Object.hasOwn(metadata, 'schema')) {
      const schemaPath = [...path, 'schema'];
      requireRecord(metadata.schema, schemaPath);
      requireString(metadata.schema, 'id', schemaPath);
      requireString(metadata.schema, 'version', schemaPath);
    }
    if (Object.hasOwn(metadata, 'toolVersions')) {
      const toolsPath = [...path, 'toolVersions'];
      requireRecord(metadata.toolVersions, toolsPath);
      for (const key of Object.keys(metadata.toolVersions)) {
        if (key.length === 0) {
          fail(
            'invalid_type',
            [...toolsPath, key],
            'Expected a non-empty configured tool name.',
          );
        }
        requireString(metadata.toolVersions, key, toolsPath);
      }
    }
    if (Object.hasOwn(metadata, 'producer')) {
      const producerPath = [...path, 'producer'];
      requireRecord(metadata.producer, producerPath);
      requireString(metadata.producer, 'name', producerPath);
      if (Object.hasOwn(metadata.producer, 'version')) {
        requireString(metadata.producer, 'version', producerPath);
      }
    }
    return {
      ok: true,
      data: parsed.data,
      provenance: metadata as ContentProvenance,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof InvalidInput
          ? error.issue
          : {
              code: 'unreadable_value',
              path: ['provenance'],
              message: 'Provenance could not be inspected as plain JSON data.',
            },
    };
  }
}

function requireRecord(
  value: unknown,
  path: string[],
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('invalid_type', path, 'Expected a plain provenance object.');
  }
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  path: string[],
): void {
  if (!Object.hasOwn(record, key)) {
    fail(
      'missing_property',
      [...path, key],
      'Required provenance field is absent.',
    );
  }
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(
      'invalid_type',
      [...path, key],
      'Expected a nonblank provenance string.',
    );
  }
}
