import { ListTool } from '@anarchitects/editorjs-tool-list/browser';

/** Probe construction only; all editing behavior remains upstream-owned. */
export class ObservedList extends ListTool {
  constructor(options: ConstructorParameters<typeof ListTool>[0]) {
    super(options);
    const root = document.documentElement;
    root.dataset['listInstances'] = String(
      Number(root.dataset['listInstances'] ?? 0) + 1,
    );
  }
}
