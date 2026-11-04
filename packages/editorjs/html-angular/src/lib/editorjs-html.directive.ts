import { Directive, input, output } from '@angular/core';
import type {
  HtmlRendererOptions,
  HtmlRenderResult,
} from '@anarchitects/editorjs-html';
import { createHtmlView } from './html-view';

/** Owns the children of an otherwise empty div, article or section. */
@Directive({
  selector:
    'div[aaEditorjsHtml], article[aaEditorjsHtml], section[aaEditorjsHtml]',
  exportAs: 'aaEditorjsHtml',
  host: { '[innerHTML]': 'html()' },
})
export class EditorJsHtmlDirective<
  Blocks extends object = Record<string, unknown>,
  Tunes extends object = Record<string, unknown>,
> {
  readonly data = input.required<unknown>({ alias: 'aaEditorjsHtml' });
  readonly options = input<HtmlRendererOptions<Blocks, Tunes> | undefined>(
    undefined,
    // Qualify host bindings while retaining the component's programmatic API.
    // eslint-disable-next-line @angular-eslint/no-input-rename
    { alias: 'aaEditorjsHtmlOptions' },
  );
  readonly resultChange = output<HtmlRenderResult>({
    // Avoid collisions with other directives on the consumer-owned element.
    // eslint-disable-next-line @angular-eslint/no-output-rename
    alias: 'aaEditorjsHtmlResultChange',
  });
  private readonly view = createHtmlView(this.data, this.options, (result) =>
    this.resultChange.emit(result),
  );
  readonly result = this.view.result;
  protected readonly html = this.view.html;
}
