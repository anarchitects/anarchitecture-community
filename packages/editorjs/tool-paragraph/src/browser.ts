/** Browser-only: evaluating the upstream module installs its global styles. */
import Paragraph from '@editorjs/paragraph';
import type { BlockToolConstructorOptions } from '@editorjs/editorjs';
import type { ParagraphConfig, ParagraphData } from './lib/paragraph.js';

/** Bridge Editor.js's optional config to upstream's required config object. */
export class ParagraphTool extends Paragraph {
  constructor(
    options: BlockToolConstructorOptions<ParagraphData, ParagraphConfig>,
  ) {
    super({ ...options, config: options.config ?? {} });
  }
}
