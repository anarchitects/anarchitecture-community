import sanitizeHtml from 'sanitize-html';
import type { Configuration } from './options.js';
import { permitsUrl } from './options.js';
import { validStart } from './standard.js';

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
  'ol',
  'ul',
  'li',
  'img',
  'span',
  'div',
  'section',
  'aside',
  'pre',
];

/** The same sanitizer/policy boundary handles inline fields and final fragments. */
export function sanitize(
  fragment: string,
  config: Configuration,
  inline: boolean,
): { html: string; rejected: boolean; missingAlt: boolean } {
  const tags = inline ? inlineTags : [...inlineTags, ...blockTags];
  let rejected = false;
  let missingAlt = false;
  let depth = 0;
  const originals = new WeakMap<object, Record<string, string>>();
  const classes = [...new Set(Object.values(config.classes).flat())];
  const html = sanitizeHtml(fragment, {
    allowedTags: tags,
    allowedAttributes: inline
      ? { a: ['href', 'title'] }
      : {
          a: ['href', 'title'],
          img: ['src', 'alt'],
          ol: ['start', 'type'],
          '*': ['class'],
        },
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
      if (
        !inline &&
        name === 'img' &&
        (!Object.hasOwn(attributes, 'alt') ||
          (attributes['alt'] !== '' && !attributes['alt'].trim()))
      )
        missingAlt = true;
      originals.set(attributes, { ...attributes });
      for (const [key, value] of Object.entries(attributes)) {
        const allowed =
          (name === 'a' && (key === 'href' || key === 'title')) ||
          (!inline &&
            (key === 'class' ||
              (name === 'img' && ['src', 'alt'].includes(key)) ||
              (name === 'ol' && ['start', 'type'].includes(key))));
        if (!allowed) rejected = true;
        if (
          key === 'class' &&
          (inline ||
            value.split(/\s+/).some((token) => !classes.includes(token)))
        )
          rejected = true;
        if (
          (name === 'a' && key === 'href') ||
          (!inline && name === 'img' && key === 'src')
        ) {
          let safe = false;
          try {
            safe = permitsUrl(value, config.urls, name === 'img');
          } catch {
            /* Invalid URL: reject it. */
          }
          if (!safe) {
            rejected = true;
            delete attributes[key];
          }
        }
        if (
          name === 'ol' &&
          ((key === 'type' && !['1', 'a', 'A', 'i', 'I'].includes(value)) ||
            (key === 'start' &&
              (!/^[1-9][0-9]*$/.test(value) || !validStart(Number(value)))))
        ) {
          rejected = true;
          delete attributes[key];
        }
      }
    },
    onCloseTag(name, implied) {
      depth--;
      if (implied && name !== 'br' && name !== 'img') rejected = true;
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
      if (frame.tag === 'img' && !frame.attribs['src']) {
        rejected = true;
        return true;
      }
      return false;
    },
  });
  return { html, rejected, missingAlt };
}
