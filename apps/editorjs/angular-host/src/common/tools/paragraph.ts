import { ParagraphTool } from '@anarchitects/editorjs-tool-paragraph/browser';
import { evaluated, probe } from '../../registry/probe';
evaluated('common-paragraph');
export class Paragraph extends ParagraphTool {
  private disposed = false;
  constructor(...args: ConstructorParameters<typeof ParagraphTool>) {
    super(...args);
    probe().blockCreated++;
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    probe().blockDestroyed++;
  }
}
