import { HeaderTool } from '@anarchitects/editorjs-tool-header/browser';
import { evaluated, probe } from '../../registry/probe';
evaluated('common-header');
export class Header extends HeaderTool {
  private disposed = false;
  constructor(...args: ConstructorParameters<typeof HeaderTool>) {
    super(...args);
    probe().blockCreated++;
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    probe().blockDestroyed++;
  }
}
