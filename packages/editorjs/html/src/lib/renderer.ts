import {
  validateOutputData,
  type JsonObject,
} from '@anarchitects/editorjs-core';
import type {
  EditorJsHtmlRenderer,
  HtmlDiagnostic,
  HtmlRendererOptions,
  HtmlRenderResult,
  HtmlRenderContext,
} from './contracts.js';
import { boundedInput, byteLength, InputProblem } from './limits.js';
import { configuration, type Configuration } from './options.js';
import { deepFreeze } from './registrations.js';
import { escapeText, formatStandard, validateStandard } from './standard.js';
import { sanitize } from './safety.js';

const messages = {
  invalid_configuration: 'Renderer configuration is invalid.',
  invalid_document:
    'Expected a valid JSON Editor.js document with valid, unique IDs.',
  invalid_block_data: 'Saved data does not match the supported block profile.',
  invalid_tune_data: 'Saved data does not match the registered tune.',
  missing_alt:
    'Image requires authored alt text or explicit decorative empty alt.',
  callback_failed: 'A registered callback failed its synchronous contract.',
  unknown_block: 'No renderer is available for this saved block type.',
  unknown_tune: 'No renderer is available for this saved tune.',
  unsafe_html:
    'HTML violates the rendering policy or requires structural repair.',
  limit_exceeded: 'Content exceeds a configured resource limit.',
  diagnostics_truncated: 'Additional diagnostics were omitted.',
  render_failed: 'Rendering could not be completed.',
} as const;
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
class CallbackProblem extends Error {}
function invoke(run: () => unknown): unknown {
  try {
    return run();
  } catch (error) {
    if (error instanceof InputProblem) throw error;
    throw new CallbackProblem();
  }
}
function synchronous(value: unknown): unknown {
  // Observe native rejected async returns without adopting arbitrary thenables.
  if (value instanceof Promise) {
    void value.catch(() => undefined);
    throw new CallbackProblem();
  }
  return value;
}
function guard(run: (data: unknown) => boolean, data: unknown): boolean {
  try {
    const result = synchronous(run(data));
    if (typeof result !== 'boolean') throw new CallbackProblem();
    return result;
  } catch {
    throw new CallbackProblem();
  }
}
function comparePaths(a: HtmlDiagnostic, b: HtmlDiagnostic): number {
  for (let index = 0; index < Math.min(a.path.length, b.path.length); index++) {
    const left = a.path[index],
      right = b.path[index];
    if (left === right) continue;
    if (typeof left === 'number' && typeof right === 'number')
      return left - right;
    return String(left) < String(right) ? -1 : 1;
  }
  return (
    a.path.length - b.path.length ||
    (a.stage < b.stage ? -1 : a.stage > b.stage ? 1 : 0)
  );
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
  deepFreeze(parsed.data);
  const diagnostics: HtmlDiagnostic[] = [];
  const add = (items: HtmlDiagnostic[]) => {
    for (const item of items.sort(comparePaths)) {
      if (diagnostics.length < config.limits.maxDiagnostics)
        diagnostics.push(item);
      else if (diagnostics.length === config.limits.maxDiagnostics)
        diagnostics.push({
          code: 'diagnostics_truncated',
          stage: 'limits',
          path: [],
          message: messages.diagnostics_truncated,
        });
    }
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
    const local: HtmlDiagnostic[] = [];
    const report = (
      code: HtmlDiagnostic['code'],
      stage: HtmlDiagnostic['stage'],
      at: readonly (string | number)[],
      tune?: string,
    ) => {
      local.push({
        ...context,
        code,
        stage,
        path: at,
        message: messages[code],
        ...(tune === undefined ? {} : { tune }),
      });
    };
    const registration = config.registrations.blocks.get(block.type);
    if (!registration) {
      report('unknown_block', 'profile', [...path, 'type']);
      add(local);
      continue;
    }
    let active = true;
    let callbackPath: readonly (string | number)[] = [...path, 'data'];
    let callbackTune: string | undefined;
    let helperBytes = 0;
    const checkHelper = (text: string) => {
      if (!active || typeof text !== 'string') throw new CallbackProblem();
      if (byteLength(text) > config.limits.maxStringBytes)
        throw new InputProblem('limit_exceeded', callbackPath);
    };
    const trackHelper = (text: string) => {
      helperBytes += byteLength(text);
      if (helperBytes > config.limits.maxOutputBytes)
        throw new InputProblem('limit_exceeded', callbackPath);
      return text;
    };
    const inline = (text: string, at: readonly (string | number)[]) => {
      const clean = sanitize(text, config, true);
      if (clean.rejected) report('unsafe_html', 'safety', at, callbackTune);
      return clean.html;
    };
    const callbackContext: HtmlRenderContext = Object.freeze({
      blockIndex,
      // boundedInput and core validation established JSON before this readonly view.
      block: block as HtmlRenderContext['block'],
      escapeText: (text: string) => {
        checkHelper(text);
        return trackHelper(escapeText(text));
      },
      inline: (text: string) => {
        checkHelper(text);
        return trackHelper(inline(text, callbackPath));
      },
    });
    const cleanFragment = (value: unknown): string => {
      const fragment = synchronous(value);
      if (typeof fragment !== 'string') throw new CallbackProblem();
      outputBytes += byteLength(fragment);
      if (outputBytes > config.limits.maxOutputBytes)
        throw new InputProblem('limit_exceeded', callbackPath);
      const clean = sanitize(fragment, config, false);
      if (clean.rejected)
        report('unsafe_html', 'safety', callbackPath, callbackTune);
      if (clean.missingAlt)
        report('missing_alt', 'profile', callbackPath, callbackTune);
      if (byteLength(clean.html) > config.limits.maxOutputBytes)
        throw new InputProblem('limit_exceeded', callbackPath);
      return clean.html;
    };
    try {
      const data = block.data as JsonObject;
      let valid = true;
      if ('profile' in registration) {
        const validation = validateStandard(data, registration.profile, config);
        if (!validation.ok) {
          valid = false;
          for (const issue of validation.errors)
            report('invalid_block_data', 'profile', [
              ...path,
              'data',
              ...(issue.path ?? []),
            ]);
        } else if (
          registration.profile === 'image' &&
          (data['alt'] === undefined ||
            (data['alt'] !== '' && !(data['alt'] as string).trim()))
        ) {
          valid = false;
          report('missing_alt', 'profile', [...path, 'data', 'alt']);
        }
      } else if (!guard(registration.validate, data)) {
        valid = false;
        report('invalid_block_data', 'profile', callbackPath);
      }
      // Validate all saved tunes before invoking any formatting callback.
      for (const name of Object.keys(block.tunes ?? {}).sort()) {
        callbackTune = name;
        callbackPath = [...path, 'tunes', name];
        const tune = config.registrations.tunes.get(name);
        if (!tune) {
          valid = false;
          report('unknown_tune', 'profile', callbackPath, name);
        } else if (!guard(tune.validate, block.tunes?.[name])) {
          valid = false;
          report('invalid_tune_data', 'profile', callbackPath, name);
        }
      }
      if (!valid) {
        add(local);
        continue;
      }
      callbackPath = [...path, 'data'];
      callbackTune = undefined;
      let fragment = cleanFragment(
        'profile' in registration
          ? formatStandard(data, registration.profile, config, (text, at) =>
              inline(text, [...path, 'data', ...at]),
            )
          : invoke(() => registration.render(data, callbackContext)),
      );
      for (const [name, tune] of config.registrations.tunes) {
        if (!Object.hasOwn(block.tunes ?? {}, name) || tune.ignore) continue;
        callbackPath = [...path, 'tunes', name];
        callbackTune = name;
        fragment = cleanFragment(
          invoke(() =>
            tune.render(fragment, block.tunes?.[name], callbackContext),
          ),
        );
      }
      // Missing alt in callback output cannot silently become decorative or partial publication.
      if (!local.some((item) => item.code === 'missing_alt'))
        output.push(fragment);
    } catch (error) {
      if (error instanceof InputProblem)
        return failure(
          'limit_exceeded',
          'limits',
          error.path[0] === 'blocks'
            ? error.path
            : [...path, 'data', ...error.path],
        );
      if (!(error instanceof CallbackProblem))
        return failure('render_failed', 'safety', path);
      // No exception text or successful partial block is exposed.
      report('callback_failed', 'profile', callbackPath, callbackTune);
    } finally {
      active = false;
    }
    add(local);
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
export function createEditorJsHtmlRenderer<
  Blocks extends object = Record<string, unknown>,
  Tunes extends object = Record<string, unknown>,
>(options?: HtmlRendererOptions<Blocks, Tunes>): EditorJsHtmlRenderer {
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
export function renderEditorJsHtml<
  Blocks extends object = Record<string, unknown>,
  Tunes extends object = Record<string, unknown>,
>(
  input: unknown,
  options?: HtmlRendererOptions<Blocks, Tunes>,
): HtmlRenderResult {
  return createEditorJsHtmlRenderer(options).render(input);
}
