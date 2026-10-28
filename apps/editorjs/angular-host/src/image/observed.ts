import { ImageTool } from '@anarchitects/editorjs-tool-image/browser';
import type { PasteEvent } from '@editorjs/editorjs';
const live = new Map<HTMLElement, ImageTool>();
export class ObservedImage extends ImageTool {
  override render() {
    const root = super.render();
    live.set(root, this);
    document.documentElement.dataset['imageInstances'] = String(live.size);
    return root;
  }
  override destroy() {
    super.destroy();
    for (const [root, tool] of live) if (tool === this) live.delete(root);
  }
}
export async function pasteInto(holder: HTMLElement, event: PasteEvent) {
  const tool = [...live].find(([root]) => holder.contains(root))?.[1];
  if (!tool) throw new Error('No live image owner');
  await tool.onPaste(event);
}
