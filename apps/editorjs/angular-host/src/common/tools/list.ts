import { ListTool } from '@anarchitects/editorjs-tool-list/browser';
import { evaluated, probe } from '../../registry/probe';
evaluated('common-list');
export class List extends ListTool {
  private disposed = false;
  constructor(...args: ConstructorParameters<typeof ListTool>) {
    super(...args);
    probe().blockCreated++;
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    probe().blockDestroyed++;
  }
}
