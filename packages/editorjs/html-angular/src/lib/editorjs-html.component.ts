import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  untracked,
} from '@angular/core';
import {
  createEditorJsHtmlRenderer,
  type HtmlRendererOptions,
  type HtmlRenderResult,
} from '@anarchitects/editorjs-html';

/** A display-only owner of one normally sanitized Angular HTML binding. */
@Component({
  selector: 'aa-editorjs-html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<div class="editorjs-html" [innerHTML]="html()"></div>',
  styles: ':host { display: block; }',
})
export class EditorJsHtmlComponent<
  Blocks extends object = Record<string, unknown>,
  Tunes extends object = Record<string, unknown>,
> {
  /** Raw Editor.js JSON or decoded data. Replace identity to recompute. */
  readonly data = input.required<unknown>();
  /** Complete per-instance options, snapshotted when their identity changes. */
  readonly options = input<HtmlRendererOptions<Blocks, Tunes>>();
  readonly resultChange = output<HtmlRenderResult>();

  private readonly renderer = computed(() => {
    const options = this.options();
    return untracked(() => createEditorJsHtmlRenderer(options));
  });

  /** The current headless result, including diagnostics for failure or preview. */
  readonly result = computed(() => {
    const renderer = this.renderer();
    const data = this.data();
    return untracked(() => renderer.render(data));
  });

  protected readonly html = computed(() => {
    const result = this.result();
    return result.status === 'failure' ? '' : result.html;
  });

  constructor() {
    effect(() => {
      const result = this.result();
      // Output subscribers must not become render dependencies.
      untracked(() => this.resultChange.emit(result));
    });
  }
}
