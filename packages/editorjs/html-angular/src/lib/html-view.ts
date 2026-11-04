import {
  computed,
  effect,
  inject,
  untracked,
  type Signal,
} from '@angular/core';
import {
  createEditorJsHtmlRenderer,
  type HtmlRenderResult,
} from '@anarchitects/editorjs-html';
import {
  EDITOR_JS_HTML_CONFIG,
  resolveOptions,
  snapshotOptions,
} from './configuration';

/** One per-owner reactive path for both presentation APIs; no document state in DI. */
export function createHtmlView(
  data: Signal<unknown>,
  options: Signal<unknown>,
  notify: (result: HtmlRenderResult) => void,
) {
  const configured = snapshotOptions(
    inject(EDITOR_JS_HTML_CONFIG, { optional: true }) ?? undefined,
  );
  const renderer = computed(() => {
    const instance = options();
    return untracked(() =>
      createEditorJsHtmlRenderer(resolveOptions(configured, instance)),
    );
  });
  const result = computed(() => {
    const current = renderer();
    const input = data();
    return untracked(() => current.render(input));
  });
  const html = computed(() => {
    const current = result();
    return current.status === 'failure' ? '' : current.html;
  });
  effect(() => {
    const current = result();
    untracked(() => notify(current));
  });
  return { result, html };
}
