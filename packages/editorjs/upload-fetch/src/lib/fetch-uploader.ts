import {
  normalizeOutputData,
  type FileUploader,
  type UrlUploader,
  type UploadedFile,
  type UploadResponse,
} from '@anarchitects/editorjs-core';
import { FetchUploadError } from './fetch-upload-error.js';

/** Build a fresh body on every invocation. Request instances are not accepted. */
export interface FetchUploadRequest {
  url: string | URL;
  init?: RequestInit;
  /** Positive finite integer, at most 2,147,483,647 ms; omitted means no timeout. */
  timeoutMs?: number;
}

export interface FetchUploadResponseContext {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Headers;
}

export interface FetchUploadOptions<
  Input,
  FileData extends UploadedFile = UploadedFile,
  ErrorData = unknown,
> {
  request(input: Input): FetchUploadRequest;
  /** Validate unknown JSON before returning a typed result. */
  decode(
    body: unknown,
    context: FetchUploadResponseContext,
  ):
    | UploadResponse<FileData, ErrorData>
    | Promise<UploadResponse<FileData, ErrorData>>;
  /** Native Fetch is looked up at invocation. Injected methods retain this options receiver. */
  fetch?: typeof globalThis.fetch;
  /** Explicitly decode non-2xx JSON into failure; success on non-2xx is rejected. */
  decodeHttpErrors?: boolean;
}

export function createFetchFileUploader<
  F extends UploadedFile = UploadedFile,
  E = unknown,
>(options: FetchUploadOptions<Blob, F, E>): FileUploader<Blob, F, E> {
  const invoke = createInvoker(options);
  return Object.freeze({
    uploadByFile: async (input: Blob) => {
      if (typeof Blob === 'undefined' || !(input instanceof Blob))
        throw new TypeError('File upload requires a Blob.');
      return invoke(input);
    },
  });
}

export function createFetchUrlUploader<
  F extends UploadedFile = UploadedFile,
  E = unknown,
>(options: FetchUploadOptions<string, F, E>): UrlUploader<F, E> {
  const invoke = createInvoker(options);
  return Object.freeze({
    uploadByUrl: async (input: string) => {
      if (typeof input !== 'string' || !input.trim())
        throw new TypeError('URL submission requires a nonblank string.');
      return invoke(input);
    },
  });
}

function createInvoker<I, F extends UploadedFile, E>(
  options: FetchUploadOptions<I, F, E>,
) {
  if (!options || typeof options !== 'object')
    throw new TypeError('Upload options are required.');
  const {
    request,
    decode,
    fetch: injectedFetch,
    decodeHttpErrors = false,
  } = options;
  if (
    typeof request !== 'function' ||
    typeof decode !== 'function' ||
    (injectedFetch !== undefined && typeof injectedFetch !== 'function') ||
    typeof decodeHttpErrors !== 'boolean'
  )
    throw new TypeError('Invalid upload options.');

  return async (input: I): Promise<UploadResponse<F, E>> => {
    const built = request.call(options, input);
    if (built && typeof built === 'object' && 'then' in built) {
      // A mistaken async builder must not leave an unhandled rejected promise.
      void Promise.resolve(built).catch(() => undefined);
      throw new TypeError('Request construction must be synchronous.');
    }
    if (
      !built ||
      typeof built !== 'object' ||
      (typeof Request !== 'undefined' && built instanceof Request) ||
      !(
        typeof built.url === 'string' ||
        (typeof URL !== 'undefined' && built.url instanceof URL)
      ) ||
      !String(built.url).trim()
    )
      throw new TypeError('Request must provide an endpoint URL.');
    const { url, init = {}, timeoutMs } = built;
    if (
      !init ||
      typeof init !== 'object' ||
      (timeoutMs !== undefined &&
        (!Number.isInteger(timeoutMs) ||
          timeoutMs <= 0 ||
          timeoutMs > 2_147_483_647))
    )
      throw new TypeError('Invalid upload request options.');
    const transport = injectedFetch ?? globalThis.fetch;
    if (
      typeof transport !== 'function' ||
      typeof AbortController === 'undefined'
    )
      throw new FetchUploadError('unsupported');
    const controller = new AbortController();
    const signal = init.signal;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopError: FetchUploadError | undefined;
    let rejectStop!: (reason: FetchUploadError) => void;
    const stopped = new Promise<never>((_resolve, reject) => {
      rejectStop = reject;
    });
    const stop = (code: 'cancelled' | 'timeout') => {
      if (stopError) return;
      stopError = new FetchUploadError(code);
      rejectStop(stopError);
      controller.abort(stopError);
    };
    const onAbort = () => stop('cancelled');
    const work = async (): Promise<UploadResponse<F, E>> => {
      if (signal?.aborted) {
        stop('cancelled');
        throw stopError;
      }
      signal?.addEventListener('abort', onAbort, { once: true });
      if (timeoutMs !== undefined)
        timer = setTimeout(() => stop('timeout'), timeoutMs);
      let response: Response;
      try {
        response = await transport.call(
          injectedFetch ? options : globalThis,
          url,
          { ...init, signal: controller.signal },
        );
      } catch (cause) {
        throw (
          stopError ?? new FetchUploadError('network', undefined, { cause })
        );
      }
      if (stopError) throw stopError;
      if (
        !response ||
        typeof response.json !== 'function' ||
        typeof response.ok !== 'boolean' ||
        !Number.isInteger(response.status)
      )
        throw new FetchUploadError('response');
      if (!response.ok && !decodeHttpErrors)
        throw new FetchUploadError('http', response.status);
      let body: unknown;
      try {
        body = await response.json();
      } catch (cause) {
        throw (
          stopError ??
          new FetchUploadError('response', response.status, { cause })
        );
      }
      if (stopError) throw stopError;
      let mapped: UploadResponse<F, E>;
      try {
        mapped = await decode.call(
          options,
          body,
          Object.freeze({
            status: response.status,
            ok: response.ok,
            headers: response.headers,
          }),
        );
      } catch (cause) {
        throw (
          stopError ??
          new FetchUploadError('mapping', response.status, { cause })
        );
      }
      if (stopError) throw stopError;
      try {
        const result = validateResult(mapped);
        if (!response.ok && result.success === 1)
          throw new TypeError(
            'Non-success HTTP status cannot be mapped to upload success.',
          );
        return result;
      } catch (cause) {
        throw new FetchUploadError('mapping', response.status, { cause });
      }
    };
    try {
      return await Promise.race([work(), stopped]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      // Release unread bodies too, including a rejected HTTP response. This is
      // local resource cleanup, never a claim to undo remote storage.
      controller.abort();
    }
  };
}

function validateResult<F extends UploadedFile, E>(
  value: UploadResponse<F, E>,
): UploadResponse<F, E> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Invalid upload result.');
  const success = Object.getOwnPropertyDescriptor(value, 'success');
  if (!success || !('value' in success))
    throw new TypeError('Invalid upload discriminant.');
  if (success.value === 0) {
    if ('file' in value) throw new TypeError('Failure cannot contain a file.');
    return value;
  }
  if (success.value !== 1 || 'error' in value)
    throw new TypeError('Invalid upload success.');
  const file = Object.getOwnPropertyDescriptor(value, 'file');
  if (!file || !('value' in file))
    throw new TypeError('Success requires file metadata.');
  const normalized = normalizeOutputData({
    blocks: [{ type: 'image', data: { file: file.value } }],
  });
  if (!normalized.ok)
    throw new TypeError('File metadata must be JSON-compatible.');
  const clean: unknown = Reflect.get(normalized.data.blocks[0].data, 'file');
  if (
    !clean ||
    typeof clean !== 'object' ||
    Array.isArray(clean) ||
    !('url' in clean) ||
    typeof clean.url !== 'string' ||
    !clean.url.trim()
  )
    throw new TypeError('File metadata requires a nonblank URL.');
  // The host decoder owns F's schema. Core normalization validates/copies its
  // JSON representation without changing that schema or widening public ports.
  return { success: 1, file: clean as F };
}
