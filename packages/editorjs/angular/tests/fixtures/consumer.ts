import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  EDITOR_JS_LOADER,
  provideEditorJsLoader,
  type EditorJsApi,
  type EditorJsChangeEvent,
  type EditorJsConfig,
  type EditorJsErrorEvent,
  type EditorJsFactory,
  type EditorJsLoader,
  type EditorJsReadyEvent,
} from '@anarchitects/editorjs-angular';
import type {
  OutputBlockDataFor,
  OutputData,
  ToolConfiguration,
} from '@anarchitects/editorjs-core';
import type EditorJS from '@editorjs/editorjs';
import type { EditorConfig } from '@editorjs/editorjs';

interface CalloutData {
  text: string;
  tone: 'info' | 'warning';
}
interface CalloutConfig {
  label: string;
  onSelect: (text: string) => void;
}
class CalloutTool {
  constructor(
    readonly options: { data: CalloutData; config?: CalloutConfig },
  ) {}
  render(): HTMLElement {
    return document.createElement('aside');
  }
  save(): CalloutData {
    return this.options.data;
  }
}
type Blocks = OutputBlockDataFor<{
  callout: CalloutData;
  paragraph: { text: string };
}>;
type Tools = {
  callout: ToolConfiguration<typeof CalloutTool, CalloutConfig, CalloutData>;
};

export const config: EditorJsConfig<Tools> = {
  placeholder: 'Write',
  tools: {
    callout: {
      class: CalloutTool,
      config: { label: 'Note', onSelect: (text) => console.log(text) },
      toolbox: { title: 'Callout', data: { tone: 'info' } },
    },
  },
};
export const documentData: OutputData<Blocks> = {
  blocks: [{ type: 'callout', data: { text: 'Welcome', tone: 'info' } }],
};
export const unparameterizedConfig: EditorJsConfig = config;

// Type contracts reject owned properties even on existing non-literal objects.
const foreignHolder = { holder: 'outside', placeholder: 'Write' };
// @ts-expect-error holder ownership cannot be replaced
export const invalidHolder: EditorJsConfig = foreignHolder;
// @ts-expect-error deprecated holder ownership cannot be replaced
export const invalidHolderId: EditorJsConfig = { holderId: 'outside' };
// @ts-expect-error data has its own input
export const invalidData: EditorJsConfig = { data: documentData };
// @ts-expect-error consumers use readiness events instead
export const invalidReady: EditorJsConfig = { onReady: () => undefined };
// @ts-expect-error consumers use change events instead
export const invalidChange: EditorJsConfig = { onChange: () => undefined };
export const invalidTool: EditorJsConfig<Tools> = {
  tools: {
    callout: {
      class: CalloutTool,
      // @ts-expect-error preserve custom configuration validation
      config: { label: 42, onSelect: () => undefined },
    },
  },
};
// @ts-expect-error block type and data remain correlated
export const invalidBlock: Blocks = {
  type: 'callout',
  data: { text: 'Missing tone' },
};

// The installed upstream runtime structurally satisfies the replaceable seam.
export function upstreamFactory(Editor: typeof EditorJS): EditorJsFactory {
  return ({ holder, data, onChange }) => new Editor({ holder, data, onChange });
}
export function rejectUpstreamConfig(upstream: EditorConfig): EditorJsConfig {
  // @ts-expect-error raw upstream config may replace wrapper ownership
  return upstream;
}
export function replaceLoader(loader: EditorJsLoader) {
  return provideEditorJsLoader(loader);
}
export async function controls(
  api: EditorJsApi<Blocks>,
): Promise<OutputData<Blocks>> {
  await api.render(documentData);
  await api.clear();
  const focused: boolean = await api.focus(true);
  const readOnly: boolean = await api.setReadOnly(true);
  console.log(focused, readOnly);
  return api.save();
}

@Component({
  selector: 'aa-package-consumer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p>{{ document.blocks.length }}</p>',
})
export class PackageConsumer {
  readonly document = documentData;
  readonly config = config;
  readonly loader = inject(EDITOR_JS_LOADER);
  onReady(event: EditorJsReadyEvent<Blocks>): void {
    void controls(event.api);
  }
  onChange(event: EditorJsChangeEvent<Blocks>): string | undefined {
    const block = event.data.blocks[0];
    return block?.type === 'callout' ? block.data.tone : undefined;
  }
  onError(event: EditorJsErrorEvent): void {
    console.error(event.operation, event.code, event.cause);
  }
}
