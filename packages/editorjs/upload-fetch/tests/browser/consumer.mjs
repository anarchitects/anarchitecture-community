import EditorJS from '@editorjs/editorjs';
import { ImageTool } from '@anarchitects/editorjs-tool-image/browser';
import {
  composeImageUploader,
  createUploadOperation,
} from '@anarchitects/editorjs-core';
import {
  createFetchFileUploader,
  createFetchUrlUploader,
  FetchUploadError,
} from '@anarchitects/editorjs-upload-fetch/browser';
import { createUploads } from './uploads.js';

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>';
const decode = (body) => body;
let editor;
let mode = 'ok';
const files = createFetchFileUploader({
  request(blob) {
    const body = new FormData();
    body.append('picture', blob, 'fallback.svg');
    return {
      url: `/upload?mode=${mode}`,
      init: { method: 'POST', body, headers: { 'X-Host': 'image' } },
    };
  },
  decode,
});
const urls = createFetchUrlUploader({
  request(url) {
    return {
      url: `/upload?mode=${mode}`,
      init: {
        method: 'POST',
        body: JSON.stringify({ url }),
        headers: { 'Content-Type': 'application/json' },
      },
    };
  },
  decode,
});
window.uploads = {
  async mount(data) {
    if (editor) editor.destroy();
    editor = new EditorJS({
      holder: 'editor',
      tools: {
        image: {
          class: ImageTool,
          config: { uploader: composeImageUploader(files, urls) },
        },
      },
      data: data ?? {
        blocks: [
          {
            type: 'image',
            data: {
              file: {},
              caption: '',
              withBorder: false,
              withBackground: false,
              stretched: false,
            },
          },
        ],
      },
    });
    await editor.isReady;
  },
  setMode(value) {
    mode = value;
  },
  async paste(kind) {
    const event =
      kind === 'url'
        ? new CustomEvent('pattern', {
            detail: {
              data: 'https://untrusted.invalid/no-fetch.svg',
              key: 'image',
            },
          })
        : new CustomEvent('file', {
            detail: {
              file:
                kind === 'file'
                  ? new File([svg], 'chosen.svg', { type: 'image/svg+xml' })
                  : new Blob([svg], { type: 'image/svg+xml' }),
            },
          });
    await editor.blocks.getBlockByIndex(0).call('onPaste', event);
  },
  save: () => editor.save(),
  async exercise(mode, settings = {}) {
    const owner = new AbortController();
    const uploader = createFetchUrlUploader({
      request: (url) => ({
        url: `/upload?mode=${mode}`,
        timeoutMs: settings.timeoutMs,
        init: {
          method: 'POST',
          body: JSON.stringify({ url }),
          signal: owner.signal,
        },
      }),
      decodeHttpErrors: settings.decodeHttpErrors,
      decode: settings.mappingError
        ? () => {
            throw new Error('private');
          }
        : decode,
    });
    const promise = uploader.uploadByUrl(
      'https://untrusted.invalid/no-fetch.svg',
    );
    if (settings.cancel) setTimeout(() => owner.abort(), 30);
    try {
      return { result: await promise };
    } catch (error) {
      return { code: error.code, status: error.status, message: error.message };
    }
  },
  async retry(key, replaySafe = false, bytes = 'same-payload') {
    const uploader = createFetchFileUploader({
      request: (blob) => ({
        url: '/idempotent',
        timeoutMs: 500,
        init: {
          method: 'POST',
          body: blob,
          headers: { 'Idempotency-Key': key },
        },
      }),
      decode,
    });
    const attempts = [];
    const operation = createUploadOperation(
      () => uploader.uploadByFile(new Blob([bytes])),
      {
        onAttempt: (attempt) => attempts.push(attempt),
        ...(replaySafe
          ? {
              retry: {
                maxAttempts: 2,
                replaySafe: true,
                delayMs: 0,
                shouldRetry: (outcome) =>
                  outcome.kind === 'exception' &&
                  outcome.error instanceof FetchUploadError &&
                  outcome.error.code === 'timeout',
                schedule: (resume, delay) => {
                  const timer = setTimeout(resume, delay);
                  return () => clearTimeout(timer);
                },
              },
            }
          : {}),
      },
    );
    try {
      return { result: await operation.result, attempts };
    } catch (error) {
      return { code: error.code, status: error.status, attempts };
    }
  },
  async recipe() {
    const uploader = createUploads();
    return [
      await uploader.uploadByFile(new Blob([svg])),
      await uploader.uploadByUrl('https://untrusted.invalid/source'),
    ];
  },
};
