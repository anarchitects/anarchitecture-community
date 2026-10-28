import {
  ChangeDetectionStrategy,
  type DestroyRef,
  Component,
  inject,
  viewChild,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import {
  createEditorJsUploadOwner,
  EDITOR_JS_LOADER,
  EditorJs,
  EditorJsOperationError,
  provideEditorJsLoader,
  provideEditorJsTools,
  EDITOR_JS_TOOL_REGISTRY,
  type EditorJsToolContribution,
  type EditorJsToolProviderOptions,
  type EditorJsApi,
  type EditorJsChangeEvent,
  type EditorJsConfig,
  type EditorJsCreateOptions,
  type EditorJsInstance,
  type EditorJsOperation,
  type EditorJsTools,
  type EditorJsErrorEvent,
  type EditorJsFactory,
  type EditorJsLoader,
  type EditorJsReadyEvent,
} from '@anarchitects/editorjs-angular';
import type {
  OutputBlockDataFor,
  OutputData,
  ToolConfiguration,
  ToolDefinition,
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
export const registrations: EditorJsTools = config.tools!;
export function createRaw(
  factory: EditorJsFactory,
  options: EditorJsCreateOptions,
): EditorJsInstance {
  return factory(options);
}
export function operationOf(event: EditorJsErrorEvent): EditorJsOperation {
  return event.operation;
}

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

const toolDefinition = {
  name: 'callout',
  kind: 'block',
  source: 'eager',
  registration: {
    class: CalloutTool,
    config: { label: 'Note', onSelect: (text: string) => text },
  },
} as const satisfies ToolDefinition<
  typeof CalloutTool,
  CalloutConfig,
  CalloutData
>;
export const toolContribution: EditorJsToolContribution<
  readonly [typeof toolDefinition]
> = [toolDefinition];
export const toolOptions: EditorJsToolProviderOptions = {
  inherit: true,
  select: ['callout'],
};
export const toolProviders: EnvironmentProviders = provideEditorJsTools(
  toolContribution,
  toolOptions,
);
export const toolFactoryProviders = provideEditorJsTools({
  factory: () => toolContribution,
});
export function optionalRegistry() {
  return inject(EDITOR_JS_TOOL_REGISTRY, { optional: true });
}
// @ts-expect-error Environment providers do not belong in an element injector.
export const invalidElementProvider: Provider = toolProviders;
export function invalidToolContributions() {
  // @ts-expect-error Factories require an explicit wrapper.
  provideEditorJsTools(() => [toolDefinition]);
  // @ts-expect-error Contribution factories must return definitions synchronously.
  provideEditorJsTools({ factory: async () => [toolDefinition] });
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
  imports: [EditorJs],
  template:
    '<aa-editorjs [config]="config" [data]="document" (ready)="onReady($event)" (change)="onChange($event)" (error)="onError($event)" />',
})
export class PackageConsumer {
  readonly editor = viewChild.required(EditorJs);
  readonly document = documentData;
  readonly config = config;
  readonly loader = inject(EDITOR_JS_LOADER);
  onReady(event: EditorJsReadyEvent): void {
    void event;
  }
  async save(): Promise<OutputData | undefined> {
    const api: EditorJsApi = this.editor().api;
    try {
      await api.render(documentData);
      await api.clear();
      await api.focus(true);
      await api.setReadOnly(false);
      return await api.save();
    } catch (error) {
      if (error instanceof EditorJsOperationError)
        console.error(error.operation, error.code);
      return undefined;
    }
  }
  onChange(event: EditorJsChangeEvent): unknown {
    const block = event.data.blocks[0];
    // The component cannot assert custom tool schemas on saved runtime data.
    return block?.data;
  }
  onError(event: EditorJsErrorEvent): void {
    console.error(event.operation, event.code, event.cause);
  }
}

export function reconcileBoundData(editor: EditorJs): void {
  editor.invalidate();
  editor.reconcile();
}

// Public capability inference and generic metadata are checked without Forms.
export function uploadContracts(destroyRef: DestroyRef) {
  const files = createEditorJsUploadOwner(
    {
      async uploadByFile(input: Uint8Array) {
        return {
          success: 1 as const,
          file: { url: '/image', bytes: input.length },
        };
      },
    },
    { destroyRef },
  );
  const urls = createEditorJsUploadOwner(
    {
      async uploadByUrl(url: string) {
        return { success: 0 as const, error: { denied: url.length > 0 } };
      },
    },
    {
      destroyRef,
      mapError: (outcome) =>
        outcome.kind === 'failure' && outcome.response.error?.denied
          ? 'Denied'
          : 'Failed',
    },
  );
  void files.uploader.uploadByFile(new Uint8Array()).then((result) => {
    if (result.success) {
      const bytes: number = result.file.bytes;
      void bytes;
    }
  });
  // @ts-expect-error File-only owners do not fabricate URL support.
  void files.uploader.uploadByUrl;
  // @ts-expect-error URL-only owners do not fabricate file support.
  void urls.uploader.uploadByFile;
  // @ts-expect-error Presentation signals are readonly.
  files.activeCount.set(2);
  // @ts-expect-error An owner needs at least one existing upload capability.
  createEditorJsUploadOwner({}, { destroyRef });
  return { files, urls };
}
