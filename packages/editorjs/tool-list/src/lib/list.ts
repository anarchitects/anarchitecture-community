import {
  normalizeOutputData,
  type JsonValue,
  type ToolConstructor,
  type ToolDefinition,
  type ToolValidationResult,
} from '@anarchitects/editorjs-core';

export type ListStyle = 'ordered' | 'unordered' | 'checklist';
export type ListCounterType =
  | 'numeric'
  | 'upper-roman'
  | 'lower-roman'
  | 'upper-alpha'
  | 'lower-alpha';
export interface ListConfig {
  defaultStyle?: ListStyle;
  maxLevel?: number;
  counterTypes?: readonly ListCounterType[];
}

type Metadata = { [extension: string]: JsonValue };
type OrderedMetadata = Metadata & {
  start?: number;
  counterType?: ListCounterType;
};
type ItemMetadata<S extends ListStyle> = S extends 'checklist'
  ? Metadata & { checked: boolean }
  : S extends 'ordered'
    ? OrderedMetadata
    : Metadata;
/** Current 2.0.9 nested item generation; style is inherited from the root. */
export type ListItem<S extends ListStyle = ListStyle> = S extends ListStyle
  ? {
      content: string;
      meta: ItemMetadata<S>;
      items: ListItem<S>[];
      [extension: string]: JsonValue;
    }
  : never;
/** Saved values, not configuration defaults. No legacy flat-list generation. */
export type ListData<S extends ListStyle = ListStyle> = S extends ListStyle
  ? {
      style: S;
      meta: S extends 'ordered' ? OrderedMetadata : Metadata;
      items: ListItem<S>[];
      [extension: string]: JsonValue;
    }
  : never;

type Options<D> = D extends unknown
  ? Omit<D, 'name' | 'kind'> & { readonly name?: string }
  : never;

export type ListToolOptions<Tool extends ToolConstructor = ToolConstructor> =
  Options<ToolDefinition<Tool, ListConfig, ListData>>;

type Definition<O> = O extends unknown
  ? Omit<O, 'name'> & {
      readonly name: O extends { readonly name: infer Name extends string }
        ? Name
        : 'name' extends keyof O
          ? Extract<O['name'], string> | 'list'
          : 'list';
      readonly kind: 'block';
    }
  : never;

/** Inert definition. Replacement is always an explicit caller decision. */
export function defineListTool<const O>(
  input: O & (O extends ListToolOptions ? unknown : never),
): Definition<O> {
  // Infer the caller's loader before checking the contract: contextual Promise
  // return types otherwise widen constructors inferred through .then().
  const options = input as ListToolOptions;
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
    name: options.name === undefined ? 'list' : options.name,
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

const styles: readonly string[] = ['ordered', 'unordered', 'checklist'];
const counters: readonly string[] = [
  'numeric',
  'upper-roman',
  'lower-roman',
  'upper-alpha',
  'lower-alpha',
];

function validateConfig(config: ListConfig): void {
  if (config === null || typeof config !== 'object' || Array.isArray(config))
    throw new TypeError('List config must be a plain object.');
  const prototype = Object.getPrototypeOf(config);
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError('List config must be a plain object.');
  for (const key of Reflect.ownKeys(config)) {
    const property = Object.getOwnPropertyDescriptor(config, key);
    if (
      !property ||
      !('value' in property) ||
      typeof key !== 'string' ||
      !['defaultStyle', 'maxLevel', 'counterTypes'].includes(key)
    )
      throw new TypeError(
        'List config accepts only defaultStyle, maxLevel and counterTypes as data properties.',
      );
  }
  if (
    config.defaultStyle !== undefined &&
    !styles.includes(config.defaultStyle)
  )
    throw new TypeError(
      'List defaultStyle must be ordered, unordered or checklist.',
    );
  if (config.maxLevel !== undefined && !positiveInteger(config.maxLevel))
    throw new TypeError('List maxLevel must be a positive integer.');
  if (config.counterTypes !== undefined) {
    if (
      !Array.isArray(config.counterTypes) ||
      !config.counterTypes.length ||
      config.counterTypes.length > counters.length
    )
      throw new TypeError(
        'List counterTypes must be a nonempty unique array of supported counter types.',
      );
    const seen = new Set<string>();
    for (let i = 0; i < config.counterTypes.length; i++) {
      const entry = Object.getOwnPropertyDescriptor(config.counterTypes, i);
      if (
        !entry ||
        !('value' in entry) ||
        !counters.includes(entry.value) ||
        seen.has(entry.value)
      )
        throw new TypeError(
          'List counterTypes must be a nonempty unique array of supported counter types.',
        );
      seen.add(entry.value);
    }
  }
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
function object(value: unknown): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
type Path = (string | number)[];
function invalid(
  code: string,
  path: Path,
  message: string,
): ToolValidationResult {
  return { ok: false, errors: [{ code, path, message }] };
}

/** Validates the current nested generation without migration, defaults or mutation. */
export function validateListData(data: unknown): ToolValidationResult {
  // Core bounds depth and rejects non-JSON values, accessors, cycles and unreadable proxies.
  const parsed = normalizeOutputData({ blocks: [{ type: 'list', data }] });
  if (!parsed.ok)
    return {
      ok: false,
      errors: [{ ...parsed.error, path: parsed.error.path.slice(3) }],
    };
  const root = parsed.data.blocks[0].data;
  if (!object(root))
    return invalid('invalid_data', [], 'List data must be an object.');
  if (typeof root['style'] !== 'string' || !styles.includes(root['style']))
    return invalid(
      'invalid_style',
      ['style'],
      'List data requires ordered, unordered or checklist style.',
    );
  const style = root['style'];
  const meta = checkMeta(root['meta'], ['meta'], style, false);
  if (!meta.ok) return meta;
  return checkItems(root['items'], ['items'], style);
}

function checkMeta(
  value: JsonValue | undefined,
  path: Path,
  style: string,
  item: boolean,
): ToolValidationResult {
  if (!object(value))
    return invalid(
      'invalid_meta',
      path,
      'Current list data requires a metadata object.',
    );
  if (style === 'checklist' && item && typeof value['checked'] !== 'boolean')
    return invalid(
      'invalid_checked',
      [...path, 'checked'],
      'Checklist items require boolean checked metadata.',
    );
  if (style === 'ordered') {
    if ('start' in value && !positiveInteger(value['start']))
      return invalid(
        'invalid_start',
        [...path, 'start'],
        'Ordered start must be a positive integer.',
      );
    if (
      'counterType' in value &&
      (typeof value['counterType'] !== 'string' ||
        !counters.includes(value['counterType']))
    )
      return invalid(
        'invalid_counter_type',
        [...path, 'counterType'],
        'Ordered counterType must be a supported counter type.',
      );
  }
  return { ok: true };
}

function checkItems(
  value: JsonValue | undefined,
  path: Path,
  style: string,
): ToolValidationResult {
  if (!Array.isArray(value))
    return invalid(
      'invalid_items',
      path,
      'Current list data requires an items array.',
    );
  for (let index = 0; index < value.length; index++) {
    const item = value[index];
    const itemPath = [...path, index];
    if (!object(item))
      return invalid(
        'invalid_item',
        itemPath,
        'Current list items must be objects; migrate legacy data explicitly.',
      );
    if (typeof item['content'] !== 'string')
      return invalid(
        'invalid_content',
        [...itemPath, 'content'],
        'List items require string content.',
      );
    const meta = checkMeta(item['meta'], [...itemPath, 'meta'], style, true);
    if (!meta.ok) return meta;
    const children = checkItems(item['items'], [...itemPath, 'items'], style);
    if (!children.ok) return children;
  }
  return { ok: true };
}
