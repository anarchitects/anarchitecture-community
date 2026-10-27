import { HeaderTool } from '@anarchitects/editorjs-tool-header/browser';

/** Probe construction only; all editing behavior remains upstream-owned. */
export class ObservedHeader extends HeaderTool {
  constructor(options: ConstructorParameters<typeof HeaderTool>[0]) {
    super(options);
    const root = document.documentElement;
    root.dataset['headerInstances'] = String(
      Number(root.dataset['headerInstances'] ?? 0) + 1,
    );
  }
}
