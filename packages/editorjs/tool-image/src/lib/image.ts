import {
  normalizeOutputData,
  type ImageUploader,
  type JsonValue,
  type ToolConstructor,
  type ToolDefinition,
  type ToolValidationResult,
  type UploadedFile,
} from '@anarchitects/editorjs-core';

export interface ImageConfig<
  Input,
  FileData extends UploadedFile = UploadedFile,
> {
  uploader: ImageUploader<Input, FileData>;
  types?: string;
  captionPlaceholder?: string;
  buttonContent?: string;
  features?: {
    border?: boolean;
    background?: boolean;
    stretch?: boolean;
    caption?: boolean | 'optional';
  };
}

export interface ImageFile extends UploadedFile {
  [extension: string]: JsonValue;
}
/** Missing alt is unset; empty alt is deliberately decorative. Caption may contain HTML. */
export interface ImageData {
  file: ImageFile;
  caption: string;
  withBorder: boolean;
  withBackground: boolean;
  stretched: boolean;
  alt?: string;
}

type Options<D, Config> = D extends { source: 'lazy'; settings?: infer S }
  ? Omit<D, 'name' | 'kind' | 'settings'> & {
      readonly name?: string;
      readonly settings: S & { config: Config };
    }
  : D extends { source: 'eager'; registration: infer R }
    ? Omit<D, 'name' | 'kind' | 'registration'> & {
        readonly name?: string;
        readonly registration: Exclude<R, ToolConstructor> & { config: Config };
      }
    : never;
export type ImageToolOptions<
  Input = unknown,
  FileData extends UploadedFile = UploadedFile,
  Tool extends ToolConstructor = ToolConstructor,
> = Options<
  ToolDefinition<Tool, ImageConfig<Input, FileData>, ImageData>,
  ImageConfig<Input, FileData>
>;
type Definition<O> = O extends unknown
  ? Omit<O, 'name'> & {
      readonly name: O extends { readonly name: infer Name extends string }
        ? Name
        : 'name' extends keyof O
          ? Extract<O['name'], string> | 'image'
          : 'image';
      readonly kind: 'block';
    }
  : never;

/** Inert and framework neutral. Both upload capabilities are mandatory. */
export function defineImageTool<const O>(
  input: O & (O extends ImageToolOptions<never> ? unknown : never),
): Definition<O> {
  const options = input as ImageToolOptions<never>;
  const settings =
    options.source === 'lazy' ? options.settings : options.registration;
  validateImageConfig(settings?.config);
  return {
    ...options,
    name: options.name === undefined ? 'image' : options.name,
    kind: 'block',
    ...(options.source === 'lazy'
      ? { settings: { ...settings } }
      : { registration: { ...settings } }),
  } as unknown as Definition<O>;
}

function dataProperties(
  value: unknown,
  keys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new TypeError(`${label} must be a plain object.`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== 'string' ||
      !keys.includes(key) ||
      !descriptor ||
      !('value' in descriptor)
    )
      throw new TypeError(`${label} has an unsupported property.`);
  }
}
/** Internal shared guard; uploader objects may be host service instances. */
export function validateImageConfig(
  config: unknown,
): asserts config is ImageConfig<never> {
  dataProperties(
    config,
    ['uploader', 'types', 'captionPlaceholder', 'buttonContent', 'features'],
    'Image config',
  );
  const uploader = config['uploader'];
  if (
    !uploader ||
    typeof uploader !== 'object' ||
    !('uploadByFile' in uploader) ||
    typeof uploader.uploadByFile !== 'function' ||
    !('uploadByUrl' in uploader) ||
    typeof uploader.uploadByUrl !== 'function'
  )
    throw new TypeError(
      'Image uploader requires uploadByFile and uploadByUrl. Explicitly reject unavailable capabilities.',
    );
  for (const key of ['types', 'captionPlaceholder', 'buttonContent'])
    if (config[key] !== undefined && typeof config[key] !== 'string')
      throw new TypeError(`Image ${key} must be a string.`);
  const features = config['features'];
  if (features !== undefined) {
    dataProperties(
      features,
      ['border', 'background', 'stretch', 'caption'],
      'Image features',
    );
    for (const key of Object.keys(features))
      if (
        features[key] !== undefined &&
        typeof features[key] !== 'boolean' &&
        !(key === 'caption' && features[key] === 'optional')
      )
        throw new TypeError(`Invalid image feature ${key}.`);
  }
}

/** Structural JSON validation only; URL, HTML and publication policy belong to the host. */
export function validateImageData(data: unknown): ToolValidationResult {
  const result = normalizeOutputData({ blocks: [{ type: 'image', data }] });
  if (!result.ok)
    return {
      ok: false,
      errors: [{ ...result.error, path: result.error.path.slice(3) }],
    };
  const block = result.data.blocks[0].data;
  const invalid = (key: string, message: string): ToolValidationResult => ({
    ok: false,
    errors: [{ code: `invalid_${key}`, path: key.split('.'), message }],
  });
  const file: unknown = Reflect.get(block, 'file');
  if (!file || typeof file !== 'object' || Array.isArray(file))
    return invalid('file', 'Image requires a file object.');
  if (!('url' in file) || typeof file.url !== 'string' || !file.url.trim())
    return invalid('file.url', 'Image requires a nonblank file URL.');
  if (typeof Reflect.get(block, 'caption') !== 'string')
    return invalid('caption', 'Image requires a string caption.');
  for (const key of ['withBorder', 'withBackground', 'stretched'])
    if (typeof Reflect.get(block, key) !== 'boolean')
      return invalid(key, `Image requires boolean ${key}.`);
  if (
    'alt' in block &&
    (typeof block.alt !== 'string' || (block.alt !== '' && !block.alt.trim()))
  )
    return invalid(
      'alt',
      'Alt must be a nonblank description or an explicitly empty decorative string; omit when unset.',
    );
  return { ok: true };
}
