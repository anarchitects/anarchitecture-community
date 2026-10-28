import { QuoteTool } from '@anarchitects/editorjs-tool-quote/browser';
import { evaluated, probe } from '../../registry/probe';
evaluated('common-quote');
export class Quote extends QuoteTool {
  private disposed = false;
  constructor(...args: ConstructorParameters<typeof QuoteTool>) {
    super(...args);
    probe().blockCreated++;
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    probe().blockDestroyed++;
  }
}
