import { ImageTool } from '@anarchitects/editorjs-tool-image/browser';
import { evaluated, probe } from '../../registry/probe';
import { asset } from '../definitions';
import type { PasteEvent } from '@editorjs/editorjs';
evaluated('common-image');
export class Image extends ImageTool {
  private disposed = false;
  private readonly fixtureEvents = new AbortController();
  constructor(...args: ConstructorParameters<typeof ImageTool>) {
    super(...args);
    probe().blockCreated++;
  }
  override render() {
    const root = super.render();
    root.addEventListener(
      'fixture-upload',
      () => {
        void this.onPaste(
          new CustomEvent('pattern', {
            detail: { key: 'image', data: asset },
          }) as PasteEvent,
        );
      },
      { signal: this.fixtureEvents.signal },
    );
    return root;
  }
  override destroy() {
    if (this.disposed) return;
    this.disposed = true;
    probe().blockDestroyed++;
    this.fixtureEvents.abort();
    super.destroy();
  }
}
