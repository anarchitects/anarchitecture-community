import { QuoteTool } from '@anarchitects/editorjs-tool-quote/browser';

/** Probe construction only; all editing behavior remains upstream-owned. */
export class ObservedQuote extends QuoteTool {
  constructor(options: ConstructorParameters<typeof QuoteTool>[0]) {
    super(options);
    const root = document.documentElement;
    root.dataset['quoteInstances'] = String(
      Number(root.dataset['quoteInstances'] ?? 0) + 1,
    );
  }
}
