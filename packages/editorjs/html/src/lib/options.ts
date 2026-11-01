import type {
  HtmlClasses,
  HtmlRendererOptions,
  HtmlUrlPolicy,
} from './contracts.js';
import { ceilings, type Limits } from './limits.js';

export interface Configuration {
  readonly mode: 'strict' | 'preview';
  readonly limits: Limits;
  readonly urls: Readonly<Required<HtmlUrlPolicy>>;
  readonly classes: Readonly<Required<HtmlClasses>>;
}
const classKeys = [
  'paragraph',
  'heading',
  'quote',
  'quoteLeft',
  'quoteCenter',
  'quoteCaption',
] as const;
interface ParsedUrl {
  readonly protocol: string;
  readonly origin: string;
  readonly username: string;
  readonly password: string;
  readonly href: string;
}
export function parseUrl(value: string, base?: string): ParsedUrl {
  const Constructor = (
    globalThis as unknown as {
      URL: new (value: string, base?: string) => ParsedUrl;
    }
  ).URL;
  return new Constructor(value, base);
}
function record(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw Error('configuration');
  const result: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== 'string' ||
      !keys.includes(key) ||
      !field ||
      !('value' in field) ||
      !field.enumerable
    )
      throw Error('configuration');
    result[key] = field.value;
  }
  return result;
}
function bool(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw Error('configuration');
  return value;
}
export function configuration(
  options: HtmlRendererOptions = {},
): Configuration {
  const raw = record(options, ['mode', 'limits', 'urls', 'classes']);
  const mode = raw['mode'] ?? 'strict';
  if (mode !== 'strict' && mode !== 'preview') throw Error('configuration');
  const configuredLimits = record(raw['limits'] ?? {}, Object.keys(ceilings));
  const limits = { ...ceilings };
  for (const key of Object.keys(ceilings) as (keyof Limits)[]) {
    const value = configuredLimits[key] ?? ceilings[key];
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > ceilings[key]
    )
      throw Error('configuration');
    limits[key] = value;
  }
  const rawUrls = record(raw['urls'] ?? {}, [
    'allowRelative',
    'allowMailto',
    'httpsOnly',
    'allowedOrigins',
  ]);
  const origins = rawUrls['allowedOrigins'] ?? [];
  if (
    !Array.isArray(origins) ||
    origins.length > 100 ||
    origins.some((origin) => {
      if (typeof origin !== 'string' || origin.length > 2048) return true;
      const parsed = parseUrl(origin);
      return (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.origin !== origin ||
        !!parsed.username ||
        !!parsed.password
      );
    })
  )
    throw Error('configuration');
  const classes = record(raw['classes'] ?? {}, classKeys);
  const classSnapshot = Object.fromEntries(
    classKeys.map((key) => {
      const values =
        classes[key] ??
        (key === 'quoteLeft'
          ? ['editorjs-quote-left']
          : key === 'quoteCenter'
            ? ['editorjs-quote-center']
            : []);
      if (
        !Array.isArray(values) ||
        values.length > 16 ||
        values.some(
          (value) =>
            typeof value !== 'string' ||
            !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(value),
        )
      )
        throw Error('configuration');
      return [key, Object.freeze([...new Set(values)])];
    }),
  ) as unknown as Required<HtmlClasses>;
  return Object.freeze({
    mode,
    limits: Object.freeze(limits),
    classes: Object.freeze(classSnapshot),
    urls: Object.freeze({
      allowRelative: bool(rawUrls['allowRelative'], true),
      allowMailto: bool(rawUrls['allowMailto'], false),
      httpsOnly: bool(rawUrls['httpsOnly'], false),
      allowedOrigins: Object.freeze([...origins]),
    }),
  });
}

export function permitsUrl(
  value: string,
  policy: Configuration['urls'],
): boolean {
  // Controls, backslashes and encoded protocol separators are never normalization shortcuts.
  if (
    !value ||
    value !== value.trim() ||
    [...value].some((character) => {
      const point = character.codePointAt(0) ?? 0;
      return (
        point <= 32 || (point >= 127 && point <= 159) || character === '\\'
      );
    }) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|20|3a|5c|7f)/i.test(value) ||
    value.startsWith('//')
  )
    return false;
  const parsed = parseUrl(value, 'https://editorjs.invalid/');
  const absolute = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value);
  if (!absolute)
    return policy.allowRelative && parsed.origin === 'https://editorjs.invalid';
  if (parsed.protocol === 'mailto:') return policy.allowMailto;
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    (policy.httpsOnly && parsed.protocol !== 'https:') ||
    parsed.username ||
    parsed.password
  )
    return false;
  return (
    policy.allowedOrigins.length === 0 ||
    policy.allowedOrigins.includes(parsed.origin)
  );
}
