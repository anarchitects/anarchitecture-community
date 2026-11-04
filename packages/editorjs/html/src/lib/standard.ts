import type {
  JsonObject,
  ToolDataValidator,
  ToolValidationResult,
} from '@anarchitects/editorjs-core';
import type { HtmlStandardProfile } from './contracts.js';
import type { Configuration } from './options.js';
import { byteLength, InputProblem } from './limits.js';

type Path = (string | number)[];
export const object = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const invalid = (path: Path): ToolValidationResult => ({
  ok: false,
  errors: [{ path, message: 'Invalid block data.' }],
});
export const counters = {
  numeric: '1',
  'upper-roman': 'I',
  'lower-roman': 'i',
  'upper-alpha': 'A',
  'lower-alpha': 'a',
} as const;
export function validStart(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 2147483647
  );
}
function validateFields(
  value: unknown,
  type: string,
): ReturnType<ToolDataValidator> {
  const data = value as JsonObject;
  if (typeof data['text'] !== 'string')
    return {
      ok: false,
      errors: [{ path: ['text'], message: 'Invalid block data.' }],
    };
  if (
    type === 'header' &&
    (typeof data['level'] !== 'number' ||
      !Number.isInteger(data['level']) ||
      data['level'] < 1 ||
      data['level'] > 6)
  )
    return {
      ok: false,
      errors: [{ path: ['level'], message: 'Invalid block data.' }],
    };
  if (type === 'quote') {
    if (typeof data['caption'] !== 'string')
      return {
        ok: false,
        errors: [{ path: ['caption'], message: 'Invalid block data.' }],
      };
    if (data['alignment'] !== 'left' && data['alignment'] !== 'center')
      return {
        ok: false,
        errors: [{ path: ['alignment'], message: 'Invalid block data.' }],
      };
  }
  return { ok: true };
}
export function validateStandard(
  data: JsonObject,
  profile: HtmlStandardProfile,
  config: Configuration,
): ToolValidationResult {
  if (profile === 'image') {
    if (!object(data['file'])) return invalid(['file']);
    if (typeof data['file']['url'] !== 'string' || !data['file']['url'].trim())
      return invalid(['file', 'url']);
    if (typeof data['caption'] !== 'string') return invalid(['caption']);
    for (const key of ['withBorder', 'withBackground', 'stretched'])
      if (typeof data[key] !== 'boolean') return invalid([key]);
    if ('alt' in data && typeof data['alt'] !== 'string')
      return invalid(['alt']);
    return { ok: true };
  }
  if (profile !== 'list') return validateFields(data, profile);
  const style = data['style'];
  if (!['ordered', 'unordered', 'checklist'].includes(style as string))
    return invalid(['style']);
  const meta = (
    value: unknown,
    path: Path,
    item: boolean,
  ): ToolValidationResult => {
    if (!object(value)) return invalid(path);
    if (style === 'ordered') {
      if ('start' in value && !validStart(value['start']))
        return invalid([...path, 'start']);
      if (
        'counterType' in value &&
        (typeof value['counterType'] !== 'string' ||
          !Object.hasOwn(counters, value['counterType']))
      )
        return invalid([...path, 'counterType']);
    }
    if (style === 'checklist' && item && typeof value['checked'] !== 'boolean')
      return invalid([...path, 'checked']);
    return { ok: true };
  };
  const items = (
    value: unknown,
    path: Path,
    depth: number,
  ): ToolValidationResult => {
    if (!Array.isArray(value)) return invalid(path);
    if (value.length && depth > config.limits.maxListDepth)
      throw new InputProblem('limit_exceeded', path);
    for (const [index, item] of value.entries()) {
      const at = [...path, index];
      if (!object(item)) return invalid(at);
      if (typeof item['content'] !== 'string')
        return invalid([...at, 'content']);
      if ('style' in item) return invalid([...at, 'style']); // Mixed-style generations are not list v2.
      const checked = meta(item['meta'], [...at, 'meta'], true);
      if (!checked.ok) return checked;
      const nested = items(item['items'], [...at, 'items'], depth + 1);
      if (!nested.ok) return nested;
    }
    return { ok: true };
  };
  const rootMeta = meta(data['meta'], ['meta'], false);
  return rootMeta.ok ? items(data['items'], ['items'], 1) : rootMeta;
}
export function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
export function classAttribute(classes: readonly string[]): string {
  return classes.length ? ` class="${classes.join(' ')}"` : '';
}
export function formatStandard(
  data: JsonObject,
  profile: HtmlStandardProfile,
  config: Configuration,
  inline: (text: string, path: Path) => string,
): string {
  const classes = config.classes;
  if (profile === 'image') {
    const tokens = [
      ...classes.image,
      ...(data['withBorder'] ? classes.imageBorder : []),
      ...(data['withBackground'] ? classes.imageBackground : []),
      ...(data['stretched'] ? classes.imageStretched : []),
    ];
    const caption = inline(data['caption'] as string, ['caption']);
    const file = data['file'] as JsonObject;
    return `<figure${classAttribute([...new Set(tokens)])}><img src="${escapeText(file['url'] as string)}" alt="${escapeText(data['alt'] as string)}" />${caption ? `<figcaption${classAttribute(classes.imageCaption)}>${caption}</figcaption>` : ''}</figure>`;
  }
  if (profile === 'list') {
    const chunks: string[] = [];
    let size = 0;
    const append = (text: string) => {
      size += byteLength(text);
      if (size > config.limits.maxOutputBytes)
        throw new InputProblem('limit_exceeded', []);
      chunks.push(text);
    };
    const style = data['style'];
    const tag = style === 'ordered' ? 'ol' : 'ul';
    const list = (
      items: JsonObject[],
      meta: JsonObject,
      path: Path,
      inheritedCounter: string,
    ) => {
      const counter =
        (meta['counterType'] as string | undefined) ?? inheritedCounter;
      const attributes =
        style === 'ordered'
          ? `${meta['start'] === undefined ? '' : ` start="${meta['start']}"`} type="${counters[counter as keyof typeof counters]}"`
          : '';
      append(
        `<${tag}${attributes}${classAttribute([...classes.list, ...(style === 'checklist' ? classes.checklist : [])])}>`,
      );
      for (const [index, item] of items.entries()) {
        const at = [...path, index];
        append(`<li${classAttribute(classes.listItem)}>`);
        // Visible text is also exposed to accessibility APIs, without editable controls.
        if (style === 'checklist')
          append(
            `<span>${(item['meta'] as JsonObject)['checked'] ? '[Completed]' : '[Not completed]'} </span>`,
          );
        append(inline(item['content'] as string, [...at, 'content']));
        if ((item['items'] as JsonObject[]).length)
          list(
            item['items'] as JsonObject[],
            item['meta'] as JsonObject,
            [...at, 'items'],
            counter,
          );
        append('</li>');
      }
      append(`</${tag}>`);
    };
    list(
      data['items'] as JsonObject[],
      data['meta'] as JsonObject,
      ['items'],
      'numeric',
    );
    return chunks.join('');
  }
  const caption =
    profile === 'quote' ? inline(data['caption'] as string, ['caption']) : '';
  const text = inline(data['text'] as string, ['text']);
  if (profile === 'paragraph')
    return `<p${classAttribute(classes.paragraph)}>${text}</p>`;
  if (profile === 'header')
    return `<h${data['level']}${classAttribute(classes.heading)}>${text}</h${data['level']}>`;
  const alignment =
    data['alignment'] === 'center' ? classes.quoteCenter : classes.quoteLeft;
  return `<figure${classAttribute(classes.quote)}><blockquote${classAttribute(alignment)}><p>${text}</p></blockquote>${caption ? `<figcaption${classAttribute(classes.quoteCaption)}>${caption}</figcaption>` : ''}</figure>`;
}
