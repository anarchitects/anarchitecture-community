import {
  normalizeOutputData,
  type JsonValue,
  type ToolConstructor,
  type ToolDefinition,
  type ToolValidationResult,
} from '@anarchitects/editorjs-core';

export type QuoteAlignment = 'left' | 'center';

export interface QuoteConfig {
  quotePlaceholder?: string;
  captionPlaceholder?: string;
  defaultAlignment?: QuoteAlignment;
}

/** Inline HTML is allowed; structural validation does not sanitize it. */
export interface QuoteData {
  text: string;
  caption: string;
  alignment: QuoteAlignment;
  [extension: string]: JsonValue;
}

type Options<D> = D extends unknown
  ? Omit<D, 'name' | 'kind'> & { readonly name?: string }
  : never;

export type QuoteToolOptions<Tool extends ToolConstructor = ToolConstructor> =
  Options<ToolDefinition<Tool, QuoteConfig, QuoteData>>;

type Definition<O> = O extends unknown
  ? Omit<O, 'name'> & {
      readonly name: O extends { readonly name: infer Name extends string }
        ? Name
        : 'name' extends keyof O
          ? Extract<O['name'], string> | 'quote'
          : 'quote';
      readonly kind: 'block';
    }
  : never;

/** Inert definition. Replacement is always an explicit caller decision. */
export function defineQuoteTool<const O>(
  input: O & (O extends QuoteToolOptions ? unknown : never),
): Definition<O> {
  // Infer the caller's loader before checking the contract: contextual Promise
  // return types otherwise widen constructors inferred through .then().
  const options = input as QuoteToolOptions;
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
    name: options.name === undefined ? 'quote' : options.name,
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

function validateConfig(config: QuoteConfig): void {
  if (config === null || typeof config !== 'object' || Array.isArray(config))
    throw new TypeError('Quote config must be a plain object.');
  const prototype = Object.getPrototypeOf(config);
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError('Quote config must be a plain object.');
  for (const key of Reflect.ownKeys(config)) {
    const property = Object.getOwnPropertyDescriptor(config, key);
    if (
      !property ||
      !('value' in property) ||
      typeof key !== 'string' ||
      !['quotePlaceholder', 'captionPlaceholder', 'defaultAlignment'].includes(
        key,
      )
    )
      throw new TypeError(
        'Quote config accepts only quotePlaceholder, captionPlaceholder and defaultAlignment as data properties.',
      );
  }
  for (const key of ['quotePlaceholder', 'captionPlaceholder'] as const) {
    if (config[key] !== undefined && typeof config[key] !== 'string')
      throw new TypeError(`Quote ${key} must be a string.`);
  }
  if (
    config.defaultAlignment !== undefined &&
    !isAlignment(config.defaultAlignment)
  )
    throw new TypeError('Quote defaultAlignment must be left or center.');
}

function isAlignment(value: unknown): value is QuoteAlignment {
  return value === 'left' || value === 'center';
}

/** A synchronous core validator; it never inserts defaults or rewrites data. */
export function validateQuoteData(data: unknown): ToolValidationResult {
  const result = normalizeOutputData({ blocks: [{ type: 'quote', data }] });
  if (!result.ok)
    return {
      ok: false,
      errors: [{ ...result.error, path: result.error.path.slice(3) }],
    };
  const block = result.data.blocks[0].data;
  for (const key of ['text', 'caption'] as const) {
    if (typeof Reflect.get(block, key) !== 'string')
      return {
        ok: false,
        errors: [
          {
            code: `invalid_${key}`,
            path: [key],
            message: `Quote data requires string ${key}.`,
          },
        ],
      };
  }
  if (!('alignment' in block) || !isAlignment(block.alignment))
    return {
      ok: false,
      errors: [
        {
          code: 'invalid_alignment',
          path: ['alignment'],
          message: 'Quote data requires left or center alignment.',
        },
      ],
    };
  return { ok: true };
}
