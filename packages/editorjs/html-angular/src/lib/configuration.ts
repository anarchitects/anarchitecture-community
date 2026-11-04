import { InjectionToken, type Provider } from '@angular/core';
import type { HtmlRendererOptions } from '@anarchitects/editorjs-html';

/** Nearest complete configuration. Prefer provideEditorJsHtml for immutable provisioning. */
export const EDITOR_JS_HTML_CONFIG = new InjectionToken<HtmlRendererOptions>(
  'editorjs-html.config',
);

/** Snapshots rendering options now; usable in application, route and element providers. */
export function provideEditorJsHtml<
  Blocks extends object = Record<string, unknown>,
  Tunes extends object = Record<string, unknown>,
>(options: HtmlRendererOptions<Blocks, Tunes> = {}): Provider[] {
  return [
    { provide: EDITOR_JS_HTML_CONFIG, useValue: snapshotOptions(options) },
  ];
}

// A malformed snapshot is sent through the headless invalid-configuration path.
const invalid = Object.freeze({ invalidConfigurationSnapshot: true });

/** Copy configuration data, preserving callback identity without invoking accessors. */
export function snapshotOptions(
  options: unknown,
): Readonly<Record<string, unknown>> {
  let remaining = 10_000;
  const ancestors = new Set<object>();
  function copy(value: unknown, depth: number): unknown {
    if (--remaining < 0 || depth > 32) throw Error('configuration');
    if (value === null || typeof value !== 'object') return value;
    if (ancestors.has(value)) throw Error('configuration');
    const array = Array.isArray(value);
    if (
      !array &&
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      throw Error('configuration');
    const keys = Reflect.ownKeys(value);
    if (keys.length > remaining) throw Error('configuration');
    const result: object = array ? [] : (Object.create(null) as object);
    ancestors.add(value);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || !descriptor || !('value' in descriptor))
        throw Error('configuration');
      if (array && key === 'length') {
        if (descriptor.value > 1000) throw Error('configuration');
        (result as unknown[]).length = descriptor.value;
        continue;
      }
      if (!descriptor.enumerable) throw Error('configuration');
      Object.defineProperty(result, key, {
        value: copy(descriptor.value, depth + 1),
        enumerable: true,
      });
    }
    ancestors.delete(value);
    return Object.freeze(result);
  }
  try {
    if (options === undefined) return Object.freeze({});
    if (!options || typeof options !== 'object' || Array.isArray(options))
      return invalid;
    return copy(options, 0) as Readonly<Record<string, unknown>>;
  } catch {
    return invalid;
  }
}

/** Only top-level defined options overlay. Nested values and registries replace. */
export function resolveOptions(
  configured: Readonly<Record<string, unknown>>,
  instance: unknown,
): HtmlRendererOptions {
  const explicit = snapshotOptions(instance);
  if (configured === invalid || explicit === invalid)
    return invalid as unknown as HtmlRendererOptions;
  const combined: Record<string, unknown> = Object.assign(
    Object.create(null) as Record<string, unknown>,
    configured,
  );
  const names = [
    'mode',
    'limits',
    'urls',
    'classes',
    'profiles',
    'blocks',
    'tunes',
  ];
  for (const [key, value] of Object.entries(explicit)) {
    if (value !== undefined || !names.includes(key)) combined[key] = value;
  }
  // The headless renderer owns option names, semantic validation and hard ceilings.
  return combined as HtmlRendererOptions;
}
