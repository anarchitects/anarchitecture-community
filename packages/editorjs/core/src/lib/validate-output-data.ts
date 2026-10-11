import type { OutputData } from './output-data.js';
import { parseOutputData } from './parse-output-data.js';
import type { OutputDataParseErrorCode } from './parse-output-data.js';

/** A plugin issue uses a path relative to the block's data object. */
export interface ToolValidationIssue {
  message: string;
  path?: readonly (string | number)[];
  code?: string;
}

export type ToolValidationResult =
  | { ok: true; errors?: never }
  | { ok: false; errors: readonly ToolValidationIssue[] };

export interface ToolValidationContext {
  readonly type: string;
  readonly blockIndex: number;
  readonly id?: string;
}

/**
 * Synchronous host callback. Data and context are frozen, detached snapshots.
 * Validate unknown data explicitly; returning success does not sanitize content.
 */
export type ToolDataValidator = (
  data: unknown,
  context: ToolValidationContext,
) => ToolValidationResult;

export interface OutputDataValidationOptions {
  /** Registry keyed by configured tool name; core neither mutates nor owns it. */
  toolValidators?: ReadonlyMap<string, ToolDataValidator>;
  /** Default: optional. Present IDs must be nonblank and unique unless ignored. */
  blockIds?: 'optional' | 'required' | 'ignore';
  /** Default: allow. Reject requires a registered validator for every tool. */
  unknownTools?: 'allow' | 'reject';
}

export type OutputDataValidationErrorCode =
  | OutputDataParseErrorCode
  | 'missing_block_id'
  | 'invalid_block_id'
  | 'duplicate_block_id'
  | 'unknown_tool'
  | 'tool_data_invalid'
  | 'validator_failed'
  | 'invalid_validator_result';

export interface OutputDataValidationError {
  source: 'structure' | 'tool';
  code: OutputDataValidationErrorCode;
  path: readonly (string | number)[];
  message: string;
  /** Configured tool name, present for tool-stage errors. */
  tool?: string;
  /** Optional code supplied by the host validator. */
  validatorCode?: string;
}

export type OutputDataValidationResult =
  | { ok: true; data: OutputData }
  | { ok: false; errors: readonly OutputDataValidationError[] };

/**
 * Parse JSON text/decoded input, validate structure and IDs, then tool data.
 * Plugin checks never run on structurally invalid documents. Unknown tool data
 * remains opaque; successful validation is not a generic type cast or XSS check.
 */
export function validateOutputData(
  input: unknown,
  options: OutputDataValidationOptions = {},
): OutputDataValidationResult {
  const parsed = parseOutputData(input);
  if (!parsed.ok) {
    return { ok: false, errors: [{ source: 'structure', ...parsed.error }] };
  }
  const errors: OutputDataValidationError[] = [];
  const ids = new Set<string>();
  if (options.blockIds !== 'ignore') {
    parsed.data.blocks.forEach((block, index) => {
      const path = ['blocks', index, 'id'];
      if (block.id === undefined) {
        if (options.blockIds === 'required') {
          errors.push({
            source: 'structure',
            code: 'missing_block_id',
            path,
            message: 'Block requires an ID.',
          });
        }
      } else if (block.id.trim().length === 0) {
        errors.push({
          source: 'structure',
          code: 'invalid_block_id',
          path,
          message: 'Expected a nonblank block ID.',
        });
      } else if (ids.has(block.id)) {
        errors.push({
          source: 'structure',
          code: 'duplicate_block_id',
          path,
          message: 'Block ID duplicates an earlier block.',
        });
      } else {
        ids.add(block.id);
      }
    });
  }
  if (errors.length > 0) return { ok: false, errors };

  parsed.data.blocks.forEach((block, blockIndex) => {
    const validator = options.toolValidators?.get(block.type);
    if (validator === undefined) {
      if (options.unknownTools === 'reject') {
        errors.push({
          source: 'tool',
          code: 'unknown_tool',
          path: ['blocks', blockIndex, 'type'],
          tool: block.type,
          message: 'No validator is registered for this tool.',
        });
      }
      return;
    }
    const path = ['blocks', blockIndex, 'data'];
    const diagnostic = { source: 'tool' as const, path, tool: block.type };
    try {
      const context: ToolValidationContext = Object.freeze({
        type: block.type,
        blockIndex,
        ...(block.id === undefined ? {} : { id: block.id }),
      });
      const result: unknown = validator(frozenCopy(block.data), context);
      // Async validators are unsupported. Consume rejected native promises so a
      // misconfigured callback cannot produce an unhandled rejection here.
      const asynchronous = result instanceof Promise;
      if (asynchronous) {
        void result.catch(() => undefined);
      }
      if (asynchronous || !isToolValidationResult(result)) {
        errors.push({
          ...diagnostic,
          code: 'invalid_validator_result',
          message:
            'Validator must return a synchronous result with non-empty errors on failure.',
        });
        return;
      }
      if (!result.ok) {
        for (const issue of result.errors) {
          errors.push({
            ...diagnostic,
            code: 'tool_data_invalid',
            path: [...path, ...(issue.path ?? [])],
            message: issue.message,
            ...(issue.code === undefined ? {} : { validatorCode: issue.code }),
          });
        }
      }
    } catch {
      errors.push({
        ...diagnostic,
        code: 'validator_failed',
        message: 'Tool validator threw while checking block data.',
      });
    }
  });
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, data: parsed.data };
}

/** The parser already established a bounded, acyclic JSON tree without accessors. */
function frozenCopy(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(frozenCopy));
  if (value !== null && typeof value === 'object') {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, frozenCopy(child)]),
      ),
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isToolValidationResult(value: unknown): value is ToolValidationResult {
  if (!isRecord(value)) return false;
  if (value.ok === true) return value.errors === undefined;
  if (
    value.ok !== false ||
    !Array.isArray(value.errors) ||
    value.errors.length === 0
  )
    return false;
  for (const issue of value.errors) {
    if (
      !isRecord(issue) ||
      typeof issue.message !== 'string' ||
      issue.message.length === 0
    )
      return false;
    if (
      issue.code !== undefined &&
      (typeof issue.code !== 'string' || issue.code.length === 0)
    )
      return false;
    if (issue.path !== undefined) {
      if (!Array.isArray(issue.path)) return false;
      for (const part of issue.path) {
        if (
          typeof part !== 'string' &&
          !(typeof part === 'number' && Number.isSafeInteger(part) && part >= 0)
        )
          return false;
      }
    }
  }
  return true;
}
