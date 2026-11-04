import type {
  HtmlBlockRegistration,
  HtmlStandardProfile,
  HtmlTuneRegistration,
} from './contracts.js';

export const standardProfiles: readonly HtmlStandardProfile[] = Object.freeze([
  'paragraph',
  'header',
  'quote',
  'list',
  'image',
]);
export type BlockRegistration =
  | { readonly profile: HtmlStandardProfile }
  | HtmlBlockRegistration;
export interface Registrations {
  readonly blocks: ReadonlyMap<string, BlockRegistration>;
  readonly tunes: ReadonlyMap<string, HtmlTuneRegistration>;
}
function fields(value: unknown, allowed: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw Error('configuration');
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== 'string' ||
      !allowed.includes(key) ||
      !descriptor ||
      !('value' in descriptor) ||
      !descriptor.enumerable
    )
      throw Error('configuration');
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}
function entries(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 1000)
    throw Error('configuration');
  const output: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor || !('value' in descriptor)) throw Error('configuration');
    output.push(descriptor.value);
  }
  if (Reflect.ownKeys(value).length !== value.length + 1)
    throw Error('configuration');
  return output;
}
function name(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 128)
    throw Error('configuration');
  return value;
}
export function registrations(raw: Record<string, unknown>): Registrations {
  const blocks = new Map<string, BlockRegistration>(
    standardProfiles.map((profile) => [profile, Object.freeze({ profile })]),
  );
  const tunes = new Map<string, HtmlTuneRegistration>();
  const seen = new Set<string>();
  for (const kind of ['profiles', 'blocks'] as const) {
    for (const value of entries(raw[kind])) {
      const entry = fields(
        value,
        kind === 'profiles'
          ? ['name', 'profile', 'override']
          : ['name', 'validate', 'render', 'override'],
      );
      const key = name(entry['name']);
      if (
        seen.has(key) ||
        (blocks.has(key) && entry['override'] !== true) ||
        (entry['override'] !== undefined &&
          typeof entry['override'] !== 'boolean') ||
        (entry['override'] === true && !blocks.has(key))
      )
        throw Error('configuration');
      seen.add(key);
      if (kind === 'profiles') {
        if (!standardProfiles.includes(entry['profile'] as HtmlStandardProfile))
          throw Error('configuration');
        blocks.set(
          key,
          Object.freeze({ profile: entry['profile'] as HtmlStandardProfile }),
        );
      } else {
        if (
          typeof entry['validate'] !== 'function' ||
          typeof entry['render'] !== 'function'
        )
          throw Error('configuration');
        blocks.set(
          key,
          Object.freeze({ ...entry }) as unknown as HtmlBlockRegistration,
        );
      }
    }
  }
  for (const value of entries(raw['tunes'])) {
    const entry = fields(value, ['name', 'validate', 'render', 'ignore']);
    const key = name(entry['name']);
    if (
      tunes.has(key) ||
      typeof entry['validate'] !== 'function' ||
      (entry['ignore'] === true
        ? entry['render'] !== undefined
        : (entry['ignore'] !== undefined && entry['ignore'] !== false) ||
          typeof entry['render'] !== 'function')
    )
      throw Error('configuration');
    tunes.set(
      key,
      Object.freeze({ ...entry }) as unknown as HtmlTuneRegistration,
    );
  }
  // Maps are private and never handed to callbacks or consumers.
  return Object.freeze({ blocks, tunes });
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
