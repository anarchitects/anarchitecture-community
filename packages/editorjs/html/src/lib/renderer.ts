import {
  validateOutputData,
  type JsonObject,
  type ToolDataValidator,
} from '@anarchitects/editorjs-core';
import type {
  EditorJsHtmlRenderer,
  HtmlDiagnostic,
  HtmlRendererOptions,
  HtmlRenderResult,
} from './contracts.js';
import { boundedInput, byteLength, InputProblem } from './limits.js';
import { configuration, type Configuration } from './options.js';
import { sanitize } from './safety.js';

const messages = {
  invalid_configuration: 'Renderer configuration is invalid.',
  invalid_document:
    'Expected a valid JSON Editor.js document with valid, unique IDs.',
  invalid_block_data: 'Saved data does not match the supported block profile.',
  unknown_block: 'No renderer is available for this saved block type.',
  unknown_tune: 'No renderer is available for this saved tune.',
  unsafe_html:
    'HTML violates the rendering policy or requires structural repair.',
  limit_exceeded: 'Content exceeds a configured resource limit.',
  diagnostics_truncated: 'Additional diagnostics were omitted.',
  render_failed: 'Rendering could not be completed.',
} as const;
const validators = new Map<string, ToolDataValidator>([
  ['paragraph', (data) => validateFields(data, 'paragraph')],
  ['header', (data) => validateFields(data, 'header')],
  ['quote', (data) => validateFields(data, 'quote')],
]);
function validateFields(
  value: unknown,
  type: string,
): ReturnType<ToolDataValidator> {
  const data = value as JsonObject;
  if (typeof data['text'] !== 'string')
    return {
      ok: false,
      errors: [{ path: ['text'], message: messages.invalid_block_data }],
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
      errors: [{ path: ['level'], message: messages.invalid_block_data }],
    };
  if (type === 'quote') {
    if (typeof data['caption'] !== 'string')
      return {
        ok: false,
        errors: [{ path: ['caption'], message: messages.invalid_block_data }],
      };
    if (data['alignment'] !== 'left' && data['alignment'] !== 'center')
      return {
        ok: false,
        errors: [{ path: ['alignment'], message: messages.invalid_block_data }],
      };
  }
  return { ok: true };
}
function failure(
  code: HtmlDiagnostic['code'],
  stage: HtmlDiagnostic['stage'],
  path: readonly (string | number)[] = [],
): HtmlRenderResult {
  return {
    status: 'failure',
    diagnostics: [{ code, stage, path, message: messages[code] }],
  };
}
function classAttribute(classes: readonly string[]): string {
  // Tokens were validated and detached from trusted configuration.
  return classes.length ? ` class="${classes.join(' ')}"` : '';
}
function render(input: unknown, config: Configuration): HtmlRenderResult {
  let bounded: unknown;
  try {
    bounded = boundedInput(input, config.limits);
  } catch (error) {
    return error instanceof InputProblem
      ? failure(
          error.kind,
          error.kind === 'limit_exceeded' ? 'limits' : 'structure',
          error.path,
        )
      : failure('invalid_document', 'structure');
  }
  const parsed = validateOutputData(bounded);
  if (!parsed.ok)
    return failure('invalid_document', 'structure', parsed.errors[0]?.path);
  const diagnostics: HtmlDiagnostic[] = [];
  const add = (item: Omit<HtmlDiagnostic, 'message'>) => {
    if (diagnostics.length < config.limits.maxDiagnostics)
      diagnostics.push({ ...item, message: messages[item.code] });
    else if (diagnostics.length === config.limits.maxDiagnostics)
      diagnostics.push({
        code: 'diagnostics_truncated',
        stage: 'limits',
        path: [],
        message: messages.diagnostics_truncated,
      });
  };
  const output: string[] = [];
  let outputBytes = 0;
  for (const [blockIndex, block] of parsed.data.blocks.entries()) {
    const path = ['blocks', blockIndex] as const;
    const context = {
      blockIndex,
      type: block.type,
      ...(block.id === undefined ? {} : { id: block.id }),
    };
    const validator = validators.get(block.type);
    if (!validator) {
      add({
        ...context,
        code: 'unknown_block',
        stage: 'profile',
        path: [...path, 'type'],
      });
      continue;
    }
    const tunes = Object.keys(block.tunes ?? {});
    if (tunes.length) {
      for (const tune of tunes.sort())
        add({
          ...context,
          code: 'unknown_tune',
          stage: 'profile',
          tune,
          path: [...path, 'tunes', tune],
        });
      continue;
    }
    const valid = validator(block.data, context);
    if (!valid.ok) {
      for (const issue of valid.errors)
        add({
          ...context,
          code: 'invalid_block_data',
          stage: 'profile',
          path: [...path, 'data', ...(issue.path ?? [])],
        });
      continue;
    }
    try {
      const data = block.data as JsonObject;
      const field = (key: string) => {
        const clean = sanitize(data[key] as string, config, true);
        if (clean.rejected)
          add({
            ...context,
            code: 'unsafe_html',
            stage: 'safety',
            path: [...path, 'data', key],
          });
        return clean.html;
      };
      // Inspect fields in path order so diagnostics remain stable before truncation.
      const caption = block.type === 'quote' ? field('caption') : '';
      const text = field('text');
      let fragment: string;
      if (block.type === 'paragraph')
        fragment = `<p${classAttribute(config.classes.paragraph)}>${text}</p>`;
      else if (block.type === 'header')
        fragment = `<h${data['level']}${classAttribute(config.classes.heading)}>${text}</h${data['level']}>`;
      else {
        const alignment =
          data['alignment'] === 'center'
            ? config.classes.quoteCenter
            : config.classes.quoteLeft;
        fragment = `<figure${classAttribute(config.classes.quote)}><blockquote${classAttribute(alignment)}><p>${text}</p></blockquote>${caption ? `<figcaption${classAttribute(config.classes.quoteCaption)}>${caption}</figcaption>` : ''}</figure>`;
      }
      // Formatting cannot create an escape hatch around the final common boundary.
      outputBytes += byteLength(fragment);
      if (outputBytes > config.limits.maxOutputBytes)
        return failure('limit_exceeded', 'limits', path);
      const clean = sanitize(fragment, config, false);
      if (clean.rejected)
        add({ ...context, code: 'unsafe_html', stage: 'safety', path });
      if (byteLength(clean.html) > config.limits.maxOutputBytes)
        return failure('limit_exceeded', 'limits', path);
      output.push(clean.html);
    } catch {
      return failure('render_failed', 'safety', path);
    }
  }
  if (config.mode === 'strict' && diagnostics.length)
    return { status: 'failure', diagnostics };
  const html = output.join('');
  if (byteLength(html) > config.limits.maxOutputBytes)
    return failure('limit_exceeded', 'limits');
  return {
    status: config.mode === 'strict' ? 'success' : 'preview',
    html,
    diagnostics,
  };
}

/** Capture immutable per-instance options; no global or request-owned state. */
export function createEditorJsHtmlRenderer(
  options?: HtmlRendererOptions,
): EditorJsHtmlRenderer {
  let config: Configuration;
  try {
    config = configuration(options);
  } catch {
    return Object.freeze({
      render: () => failure('invalid_configuration', 'configuration'),
    });
  }
  return Object.freeze({ render: (input: unknown) => render(input, config) });
}

/** Render supported saved JSON; only a strict success contains complete HTML. */
export function renderEditorJsHtml(
  input: unknown,
  options?: HtmlRendererOptions,
): HtmlRenderResult {
  return createEditorJsHtmlRenderer(options).render(input);
}
