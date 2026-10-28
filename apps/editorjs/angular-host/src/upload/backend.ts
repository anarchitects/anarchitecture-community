import { InjectionToken, signal } from '@angular/core';
import type {
  ImageUploader,
  UploadResponse,
  UploadedFile,
} from '@anarchitects/editorjs-core';
import { asset } from '../image/definition';

type Failure = { code: 'denied' | 'retryable'; secret: string };
export type Backend = ReturnType<typeof createBackend>;
export const UPLOAD_BACKEND = new InjectionToken<Backend>(
  'fixture upload backend',
);

/** Page-owned controlled backend shared by both editors. No requests or mutable module state. */
export function createBackend() {
  const mode = signal('held-success');
  const calls = signal(0);
  const completed = signal(0);
  const pending: (() => void)[] = [];
  const upload = async (
    kind: string,
  ): Promise<UploadResponse<UploadedFile, Failure>> => {
    calls.update((n) => n + 1);
    const selected = mode();
    if (selected.startsWith('held-'))
      await new Promise<void>((resolve) => pending.push(resolve));
    completed.update((n) => n + 1);
    if (selected === 'retry') {
      mode.set('held-success');
      return {
        success: 0,
        error: { code: 'retryable', secret: 'PRIVATE_BACKEND_DETAIL' },
      };
    }
    if (selected.endsWith('failure'))
      return {
        success: 0,
        error: { code: 'denied', secret: 'PRIVATE_BACKEND_DETAIL' },
      };
    if (selected.endsWith('exception'))
      throw new Error('PRIVATE_TRANSPORT_DETAIL');
    return {
      success: 1,
      file: { url: asset, kind, metadata: { stored: true } } as UploadedFile,
    };
  };
  const uploader: ImageUploader<Blob, UploadedFile, Failure> = {
    uploadByFile: () => upload('file'),
    uploadByUrl: () => upload('url'),
  };
  return {
    uploader,
    mode,
    calls,
    completed,
    release: () => {
      for (const resume of pending.splice(0)) resume();
    },
  };
}
