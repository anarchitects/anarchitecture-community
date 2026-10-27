import { ParagraphTool } from '@anarchitects/editorjs-tool-paragraph/browser';

/** Instrument construction only; all rendering/saving comes from the shipped class. */
export class ObservedParagraph extends ParagraphTool {
  constructor(options: ConstructorParameters<typeof ParagraphTool>[0]) {
    super(options);
    document.documentElement.dataset['paragraphInstances'] = String(
      Number(document.documentElement.dataset['paragraphInstances'] ?? 0) + 1,
    );
  }
}
