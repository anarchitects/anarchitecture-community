import sanitizeHtml from 'sanitize-html';
import type { Configuration } from './options.js';
import { permitsUrl } from './options.js';

const inlineTags = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'mark',
  'code',
  'br',
  'a',
];
const blockTags = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'figure',
  'blockquote',
  'figcaption',
];

/** The same sanitizer/policy boundary handles inline fields and final fragments. */
export function sanitize(
  fragment: string,
  config: Configuration,
  inline: boolean,
): { html: string; rejected: boolean } {
  const tags = inline ? inlineTags : [...inlineTags, ...blockTags];
  let rejected = false;
  let depth = 0;
  const originals = new WeakMap<object, Record<string, string>>();
  const classes = [...new Set(Object.values(config.classes).flat())];
  const html = sanitizeHtml(fragment, {
    allowedTags: tags,
    allowedAttributes: inline
      ? { a: ['href', 'title'] }
      : { a: ['href', 'title'], '*': ['class'] },
    allowedClasses: inline ? {} : { '*': classes },
    allowedSchemes: config.urls.allowMailto
      ? ['http', 'https', 'mailto']
      : ['http', 'https'],
    allowProtocolRelative: false,
    parseStyleAttributes: false,
    nestingLimit: 32,
    onOpenTag(name, attributes) {
      depth++;
      if (depth > 32 || !tags.includes(name)) rejected = true;
      originals.set(attributes, { ...attributes });
      for (const [key, value] of Object.entries(attributes)) {
        const allowed =
          (name === 'a' && (key === 'href' || key === 'title')) ||
          (!inline && key === 'class');
        if (!allowed) rejected = true;
        if (
          key === 'class' &&
          (inline ||
            value.split(/\s+/).some((token) => !classes.includes(token)))
        )
          rejected = true;
        if (name === 'a' && key === 'href') {
          let safe = false;
          try {
            safe = permitsUrl(value, config.urls);
          } catch {
            /* Invalid URL: reject it. */
          }
          if (!safe) {
            rejected = true;
            delete attributes[key];
          }
        }
      }
    },
    onCloseTag(name, implied) {
      depth--;
      if (implied && name !== 'br') rejected = true;
    },
    exclusiveFilter(frame) {
      const before = originals.get(frame.attribs);
      if (
        before &&
        Object.entries(before).some(
          ([key, value]) => frame.attribs[key] !== value,
        )
      )
        rejected = true;
      return false;
    },
  });
  return { html, rejected };
}
