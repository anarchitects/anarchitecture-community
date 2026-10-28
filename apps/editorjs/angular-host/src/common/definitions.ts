import {
  validateOutputData,
  type OutputData,
  type ToolDefinition,
} from '@anarchitects/editorjs-core';
import {
  defineParagraphTool,
  validateParagraphData,
} from '@anarchitects/editorjs-tool-paragraph';
import {
  defineHeaderTool,
  validateHeaderData,
} from '@anarchitects/editorjs-tool-header';
import {
  defineListTool,
  validateListData,
} from '@anarchitects/editorjs-tool-list';
import {
  defineQuoteTool,
  validateQuoteData,
} from '@anarchitects/editorjs-tool-quote';
import {
  defineImageTool,
  validateImageData,
} from '@anarchitects/editorjs-tool-image';
import { loading, probe } from '../registry/probe';
export const asset =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="red"/></svg>',
  );
export const selection = [
  'paragraph',
  'header',
  'list',
  'quote',
  'image',
] as const;
/** Factory-owned mutable configuration. Imports stay inert on the server. */
export function definitions(label: string): readonly ToolDefinition[] {
  return [
    {
      name: 'unused',
      kind: 'block',
      source: 'lazy',
      load: () =>
        import('../registry/tools/unselected').then((m) => m.Unselected),
    },
    defineParagraphTool({
      replace: true,
      source: 'lazy',
      load: async () => {
        await loading('common-paragraph');
        return (await import('./tools/paragraph')).Paragraph;
      },
      settings: {
        config: {
          placeholder: `${label} packaged paragraph`,
          preserveBlank: true,
        },
      },
    }),
    defineHeaderTool({
      source: 'lazy',
      load: () => import('./tools/header').then((m) => m.Header),
      settings: { config: { levels: [2, 3], defaultLevel: 2 } },
    }),
    defineListTool({
      source: 'lazy',
      load: () => import('./tools/list').then((m) => m.List),
      settings: { config: { defaultStyle: 'unordered' } },
    }),
    defineQuoteTool({
      source: 'lazy',
      load: () => import('./tools/quote').then((m) => m.Quote),
      settings: {
        config: { quotePlaceholder: label, captionPlaceholder: 'Attribution' },
      },
    }),
    defineImageTool({
      source: 'lazy',
      load: () => import('./tools/image').then((m) => m.Image),
      settings: {
        config: {
          uploader: {
            async uploadByFile() {
              return upload(label);
            },
            async uploadByUrl() {
              return upload(label);
            },
          },
        },
      },
    }),
  ];
}
async function upload(label: string) {
  const state = probe();
  state.uploadStarted = (state.uploadStarted ?? 0) + 1;
  if (state.holdUpload) {
    state.holdUpload = false;
    await new Promise<void>((resolve) => {
      state.releaseUpload = resolve;
    });
    state.releaseUpload = undefined;
  }
  state.uploadFinished = (state.uploadFinished ?? 0) + 1;
  return {
    success: 1 as const,
    file: {
      url: asset,
      owner: label,
      metadata: { literal: '<host>', uploaded: true },
    },
  };
}
export const initialDocument = (label: string): OutputData => ({
  blocks: [
    { type: 'paragraph', data: { text: `${label} paragraph` } },
    { type: 'header', data: { text: `${label} heading`, level: 2 } },
    {
      type: 'list',
      data: {
        style: 'unordered',
        meta: {},
        items: [{ content: `${label} item`, meta: {}, items: [] }],
      },
    },
    {
      type: 'quote',
      data: {
        text: `${label} quote`,
        caption: 'Attribution',
        alignment: 'left',
      },
    },
    {
      type: 'image',
      data: {
        file: { url: asset, owner: label },
        caption: 'Visible caption',
        withBorder: false,
        withBackground: false,
        stretched: false,
      },
    },
  ],
});
export function validate(data: unknown): void {
  const result = validateOutputData(data, {
    unknownTools: 'reject',
    toolValidators: new Map([
      ['paragraph', validateParagraphData],
      ['header', validateHeaderData],
      ['list', validateListData],
      ['quote', validateQuoteData],
      ['image', validateImageData],
    ]),
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
}
/** Controlled fixture projection only; production renderer/policy remains host-owned. */
export function imageProjection(data: OutputData | undefined) {
  const image = data?.blocks.find((block) => block.type === 'image')?.data as
    | { file?: { url?: string }; alt?: string }
    | undefined;
  return image?.file?.url === asset
    ? { url: asset, alt: image.alt ?? null }
    : undefined;
}
