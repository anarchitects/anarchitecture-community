import {
  normalizeOutputData,
  type JsonValue,
  type ToolConstructor,
  type ToolDefinition,
  type ToolValidationResult,
} from '@anarchitects/editorjs-core';

export interface ParagraphConfig {
  placeholder?: string;
  preserveBlank?: boolean;
}

/** Inline HTML is allowed; structural validation does not sanitize it. */
export interface ParagraphData {
  text: string;
  [extension: string]: JsonValue;
}

type Options<D> = D extends unknown
  ? Omit<D, 'name' | 'kind'> & { readonly name?: string }
  : never;

export type ParagraphToolOptions<
  Tool extends ToolConstructor = ToolConstructor,
> = Options<ToolDefinition<Tool, ParagraphConfig, ParagraphData>>;

type Definition<O> = O extends unknown
  ? Omit<O, 'name'> & {
      readonly name: O extends { readonly name: infer Name extends string }
        ? Name
        : 'name' extends keyof O
          ? Extract<O['name'], string> | 'paragraph'
          : 'paragraph';
      readonly kind: 'block';
    }
  : never;

/** Inert definition. Replacement is always an explicit caller decision. */
export function defineParagraphTool<const O>(
  input: O & (O extends ParagraphToolOptions ? unknown : never),
): Definition<O> {
  // Infer the caller's loader before checking the contract: contextual Promise
  // return types otherwise widen constructors inferred through .then().
  const options = input as ParagraphToolOptions;
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
    name: options.name === undefined ? 'paragraph' : options.name,
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

function validateConfig(config: ParagraphConfig): void {
  if (config === null || typeof config !== 'object' || Array.isArray(config))
    throw new TypeError('Paragraph config must be an object.');
  for (const key of Reflect.ownKeys(config)) {
    const property = Object.getOwnPropertyDescriptor(config, key);
    if (
      !property ||
      !('value' in property) ||
      (key !== 'placeholder' && key !== 'preserveBlank') ||
      (property.value !== undefined &&
        typeof property.value !==
          (key === 'placeholder' ? 'string' : 'boolean'))
    )
      throw new TypeError(
        'Paragraph config accepts only placeholder (string) and preserveBlank (boolean).',
      );
  }
  const prototype = Object.getPrototypeOf(config);
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError('Paragraph config must be a plain object.');
}

/** A synchronous core ToolDataValidator, also callable directly with unknown data. */
export function validateParagraphData(data: unknown): ToolValidationResult {
  // Reuse core's defensive JSON boundary (cycles, accessors, depth and proxies).
  const result = normalizeOutputData({ blocks: [{ type: 'paragraph', data }] });
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
          message: 'Paragraph data requires string text.',
        },
      ],
    };
  return { ok: true };
}
