import {
  normalizeOutputData,
  type JsonValue,
  type ToolConstructor,
  type ToolDefinition,
  type ToolValidationResult,
} from '@anarchitects/editorjs-core';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface HeaderConfig {
  placeholder?: string;
  levels?: readonly HeadingLevel[];
  defaultLevel?: HeadingLevel;
}

/** Inline HTML is allowed; structural validation does not sanitize it. */
export interface HeaderData {
  text: string;
  level: HeadingLevel;
  [extension: string]: JsonValue;
}

type Options<D> = D extends unknown
  ? Omit<D, 'name' | 'kind'> & { readonly name?: string }
  : never;

export type HeaderToolOptions<Tool extends ToolConstructor = ToolConstructor> =
  Options<ToolDefinition<Tool, HeaderConfig, HeaderData>>;

type Definition<O> = O extends unknown
  ? Omit<O, 'name'> & {
      readonly name: O extends { readonly name: infer Name extends string }
        ? Name
        : 'name' extends keyof O
          ? Extract<O['name'], string> | 'header'
          : 'header';
      readonly kind: 'block';
    }
  : never;

/** Inert definition. Replacement is always an explicit caller decision. */
export function defineHeaderTool<const O>(
  input: O & (O extends HeaderToolOptions ? unknown : never),
): Definition<O> {
  // Infer the caller's loader before checking the contract: contextual Promise
  // return types otherwise widen constructors inferred through .then().
  const options = input as HeaderToolOptions;
  const settings =
    options.source === 'lazy'
      ? options.settings
      : typeof options.registration === 'function'
        ? undefined
        : options.registration;
  if (settings?.config !== undefined) validateConfig(settings.config);
  // Core snapshots toolbar/tune/toolbox containers on composition; this helper
  // detaches the immediate settings container while preserving config identity.
  const definition = {
    ...options,
    name: options.name === undefined ? 'header' : options.name,
    kind: 'block' as const,
    ...(options.source === 'lazy'
      ? settings === undefined
        ? {}
        : { settings: { ...settings } }
      : typeof options.registration === 'function'
        ? {}
        : { registration: { ...options.registration } }),
  };
  return definition as unknown as Definition<O>;
}

function validateConfig(config: HeaderConfig): void {
  if (config === null || typeof config !== 'object' || Array.isArray(config))
    throw new TypeError('Header config must be an object.');
  for (const key of Reflect.ownKeys(config)) {
    const property = Object.getOwnPropertyDescriptor(config, key);
    if (
      !property ||
      !('value' in property) ||
      !['placeholder', 'levels', 'defaultLevel'].includes(String(key)) ||
      typeof key !== 'string'
    )
      throw new TypeError(
        'Header config accepts only placeholder, levels and defaultLevel as data properties.',
      );
  }
  const prototype = Object.getPrototypeOf(config);
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError('Header config must be a plain object.');
  if (
    config.placeholder !== undefined &&
    typeof config.placeholder !== 'string'
  )
    throw new TypeError('Header placeholder must be a string.');
  if (config.defaultLevel !== undefined && !isHeadingLevel(config.defaultLevel))
    throw new TypeError(
      'Header defaultLevel must be an integer from 1 through 6.',
    );
  if (config.levels !== undefined) {
    if (
      !Array.isArray(config.levels) ||
      config.levels.length === 0 ||
      config.levels.length > 6
    )
      throw new TypeError('Header levels must be a nonempty array.');
    const levels = new Set<HeadingLevel>();
    for (let index = 0; index < config.levels.length; index++) {
      const entry = Object.getOwnPropertyDescriptor(config.levels, index);
      if (
        !entry ||
        !('value' in entry) ||
        !isHeadingLevel(entry.value) ||
        levels.has(entry.value)
      )
        throw new TypeError(
          'Header levels must contain unique integers from 1 through 6.',
        );
      levels.add(entry.value);
    }
    if (config.defaultLevel === undefined || !levels.has(config.defaultLevel))
      throw new TypeError(
        'Header levels require an explicit defaultLevel included in that set.',
      );
  }
}

function isHeadingLevel(value: unknown): value is HeadingLevel {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 6
  );
}

/** A synchronous core ToolDataValidator, also callable directly with unknown data. */
export function validateHeaderData(data: unknown): ToolValidationResult {
  // Reuse core's defensive JSON boundary (cycles, accessors, depth and proxies).
  const result = normalizeOutputData({ blocks: [{ type: 'header', data }] });
  if (!result.ok)
    return {
      ok: false,
      errors: [{ ...result.error, path: result.error.path.slice(3) }],
    };
  const block = result.data.blocks[0].data;
  if (!('text' in block) || typeof block.text !== 'string')
    return {
      ok: false,
      errors: [
        {
          code: 'invalid_text',
          path: ['text'],
          message: 'Header data requires string text.',
        },
      ],
    };
  if (!('level' in block) || !isHeadingLevel(block.level))
    return {
      ok: false,
      errors: [
        {
          code: 'invalid_level',
          path: ['level'],
          message: 'Header data requires an integer level from 1 through 6.',
        },
      ],
    };
  return { ok: true };
}
