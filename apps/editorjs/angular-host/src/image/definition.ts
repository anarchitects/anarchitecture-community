import { defineImageTool } from '@anarchitects/editorjs-tool-image';
import type {
  ImageUploader,
  UploadResponse,
} from '@anarchitects/editorjs-core';
export const asset =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="red"/></svg>',
  );
export const imageData = {
  file: { url: asset, id: 'initial' },
  caption: 'Initial caption',
  withBorder: false,
  withBackground: false,
  stretched: false,
};
const pending: (() => void)[] = [];
export function releaseUploads() {
  for (const finish of pending.splice(0)) finish();
}
export const uploader: ImageUploader<Blob> = {
  async uploadByFile(file) {
    return upload(file instanceof File ? 'file' : 'blob');
  },
  async uploadByUrl() {
    return upload('url');
  },
};
async function upload(source: string): Promise<UploadResponse> {
  const mode =
    document.querySelector<HTMLSelectElement>('#upload-mode')?.value ??
    'success';
  document.documentElement.dataset['uploadStarted'] = source;
  const result = {
    success: 1 as const,
    file: {
      url: asset,
      id: source,
      meta: { width: 80, owned: true, label: '<host-metadata>' },
    },
  };
  if (mode === 'pending')
    await new Promise<void>((resolve) => pending.push(resolve));
  if (mode === 'failure')
    return { success: 0, error: { message: 'controlled failure' } };
  if (mode === 'reject') throw new Error('controlled rejection');
  if (mode === 'malformed') return { success: 1, file: { url: '' } };
  document.documentElement.dataset['uploadFinished'] = source;
  return result;
}
export const imageDefinition = defineImageTool({
  source: 'lazy',
  load: () => import('./observed').then((m) => m.ObservedImage),
  settings: { config: { uploader, captionPlaceholder: 'Caption' } },
});
