import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import type {
  HtmlRendererOptions,
  HtmlRenderResult,
} from '@anarchitects/editorjs-html';
import { createHtmlView } from './html-view';

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
  /** Per-instance overrides, snapshotted when their identity changes. */
  readonly options = input<HtmlRendererOptions<Blocks, Tunes>>();
  readonly resultChange = output<HtmlRenderResult>();

  private readonly view = createHtmlView(this.data, this.options, (result) =>
    this.resultChange.emit(result),
  );

  /** The current headless result, including diagnostics for failure or preview. */
  readonly result = this.view.result;
  protected readonly html = this.view.html;
}
