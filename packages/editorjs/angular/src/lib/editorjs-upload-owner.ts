import { computed, signal, type DestroyRef, type Signal } from '@angular/core';
import {
  createUploadOperation,
  UploadStoppedError,
  type FileUploader,
  type ImageUploader,
  type UploadedFile,
  type UploadOperation,
  type UploadResponse,
  type UploadRetryOutcome,
  type UploadRetryPolicy,
  type UrlUploader,
} from '@anarchitects/editorjs-core';

/** Identity belongs to one owner and cannot collide with another owner's work. */
export type EditorJsUploadId = symbol;

export interface EditorJsUploadRecord {
  readonly id: EditorJsUploadId;
  readonly generation: number;
  readonly kind: 'file' | 'url';
  /** Calls observed by core, excluding retries hidden inside the host port. */
  readonly attempts: number;
  readonly status: 'active' | 'failure' | 'exception';
  /** Host-redacted presentation text; never an automatic copy of a cause/body. */
  readonly message?: string;
}

export interface EditorJsUploadOverflow {
  readonly id: EditorJsUploadId;
  readonly count: number;
}

export interface EditorJsUploadOwnerOptions<ErrorData = unknown> {
  readonly destroyRef: DestroyRef;
  /** Only opt in when repeated calls to this port are already replay-safe. */
  readonly retry?: UploadRetryPolicy<ErrorData>;
  /** Synchronous safe UI text. Invalid/throwing mappers use a generic message. */
  readonly mapError?: (outcome: UploadRetryOutcome<ErrorData>) => string;
}

export interface EditorJsUploadOwner<Uploader> {
  readonly uploader: Uploader;
  readonly generation: Signal<number>;
  readonly disposed: Signal<boolean>;
  readonly busy: Signal<boolean>;
  readonly activeCount: Signal<number>;
  readonly operations: Signal<readonly EditorJsUploadRecord[]>;
  /** Evicted failures still require acknowledgement; at most 100 detailed failures remain. */
  readonly overflow: Signal<EditorJsUploadOverflow | undefined>;
  readonly hasErrors: Signal<boolean>;
  /** Acknowledge a settled operation or the current overflow summary by identity. */
  acknowledge(id: EditorJsUploadId): void;
  /** Stop local work and clear state. Destroy the old editor before replacing its document. */
  reset(): void;
  /** Permanently stop local work. This does not abort transport or undo remote storage. */
  dispose(): void;
}

export function createEditorJsUploadOwner<
  Input,
  FileData extends UploadedFile,
  ErrorData = unknown,
>(
  uploader: ImageUploader<Input, FileData, ErrorData>,
  options: EditorJsUploadOwnerOptions<NoInfer<ErrorData>>,
): EditorJsUploadOwner<ImageUploader<Input, FileData, ErrorData>>;
export function createEditorJsUploadOwner<
  Input,
  FileData extends UploadedFile,
  ErrorData = unknown,
>(
  uploader: FileUploader<Input, FileData, ErrorData>,
  options: EditorJsUploadOwnerOptions<NoInfer<ErrorData>>,
): EditorJsUploadOwner<FileUploader<Input, FileData, ErrorData>>;
export function createEditorJsUploadOwner<
  FileData extends UploadedFile,
  ErrorData = unknown,
>(
  uploader: UrlUploader<FileData, ErrorData>,
  options: EditorJsUploadOwnerOptions<NoInfer<ErrorData>>,
): EditorJsUploadOwner<UrlUploader<FileData, ErrorData>>;
/** Optional Angular state over the existing core ports; no transport or Forms configuration. */
export function createEditorJsUploadOwner<
  Input,
  FileData extends UploadedFile,
  ErrorData = unknown,
>(
  uploader: Partial<ImageUploader<Input, FileData, ErrorData>>,
  options: EditorJsUploadOwnerOptions<ErrorData>,
): EditorJsUploadOwner<Partial<ImageUploader<Input, FileData, ErrorData>>> {
  let backend: typeof uploader | undefined = uploader;
  let file = uploader?.uploadByFile;
  let url = uploader?.uploadByUrl;
  if (
    (!file && !url) ||
    (file !== undefined && typeof file !== 'function') ||
    (url !== undefined && typeof url !== 'function')
  )
    throw new TypeError('Supply a file uploader, URL uploader, or both.');
  const { destroyRef } = options;
  let retry = options.retry;
  let mapError = options.mapError;
  if (mapError !== undefined && typeof mapError !== 'function')
    throw new TypeError('Upload error mapper must be callable.');
  const state = signal<{
    generation: number;
    disposed: boolean;
    operations: readonly EditorJsUploadRecord[];
    overflow?: EditorJsUploadOverflow;
  }>({ generation: 0, disposed: false, operations: Object.freeze([]) });
  const handles = new Map<
    EditorJsUploadId,
    UploadOperation<FileData, ErrorData>
  >();
  const current = (generation: number) =>
    !state().disposed && state().generation === generation;
  const activeCount = computed(
    () => state().operations.filter((item) => item.status === 'active').length,
  );

  function message(outcome: UploadRetryOutcome<ErrorData>): string {
    try {
      const value: unknown = mapError?.(Object.freeze(outcome));
      if (typeof value === 'string' && value.trim()) return value;
      // Observe an accidentally async mapper without storing or displaying its result.
      if (value && (typeof value === 'object' || typeof value === 'function'))
        void Promise.resolve(value).catch(() => undefined);
    } catch {
      /* Presentation failure cannot replace the port's result/cause. */
    }
    return 'Upload failed. Please try again.';
  }

  function settle(
    id: EditorJsUploadId,
    generation: number,
    outcome?: UploadRetryOutcome<ErrorData>,
  ): void {
    handles.delete(id);
    if (!current(generation)) return;
    const text = outcome ? message(outcome) : undefined;
    // A host mapper can reset/dispose reentrantly.
    if (!current(generation)) return;
    state.update((previous) => {
      let operations = previous.operations.flatMap((item) =>
        item.id !== id
          ? [item]
          : outcome
            ? [Object.freeze({ ...item, status: outcome.kind, message: text })]
            : [],
      );
      const failures = operations.filter((item) => item.status !== 'active');
      let overflow = previous.overflow;
      if (failures.length > 100) {
        const evicted = new Set(
          failures.slice(0, failures.length - 100).map((item) => item.id),
        );
        operations = operations.filter((item) => !evicted.has(item.id));
        overflow = Object.freeze({
          id: overflow?.id ?? Symbol('upload-overflow'),
          count: (overflow?.count ?? 0) + evicted.size,
        });
      }
      return { ...previous, operations: Object.freeze(operations), overflow };
    });
  }

  function run(
    kind: 'file' | 'url',
    work: () => Promise<UploadResponse<FileData, ErrorData>>,
  ) {
    if (state().disposed) return Promise.reject(new UploadStoppedError());
    const id = Symbol('upload');
    const generation = state().generation;
    let operation: UploadOperation<FileData, ErrorData>;
    try {
      operation = createUploadOperation(work, {
        retry,
        onAttempt: (attempts) => {
          if (current(generation))
            state.update((previous) => ({
              ...previous,
              operations: Object.freeze(
                previous.operations.map((item) =>
                  item.id === id ? Object.freeze({ ...item, attempts }) : item,
                ),
              ),
            }));
        },
      });
    } catch (error) {
      // Invalid core policy rejects before any transport work or activity record.
      return Promise.reject(error);
    }
    handles.set(id, operation);
    state.update((previous) => ({
      ...previous,
      operations: Object.freeze([
        ...previous.operations,
        Object.freeze({
          id,
          generation,
          kind,
          attempts: 0,
          status: 'active' as const,
        }),
      ]),
    }));
    return operation.result.then(
      (response) => {
        settle(
          id,
          generation,
          response.success === 0 ? { kind: 'failure', response } : undefined,
        );
        return response;
      },
      (error: unknown) => {
        settle(id, generation, { kind: 'exception', error });
        throw error;
      },
    );
  }

  const wrapped: Partial<ImageUploader<Input, FileData, ErrorData>> = {};
  if (file)
    wrapped.uploadByFile = (input) =>
      run('file', () => file!.call(backend, input));
  if (url)
    wrapped.uploadByUrl = (input) =>
      run('url', () => url!.call(backend, input));
  let unregister: (() => void) | undefined;
  function clear(disposed: boolean): void {
    if (state().disposed) return;
    const pending = [...handles.values()];
    handles.clear();
    state.set({
      generation: state().generation + 1,
      disposed,
      operations: Object.freeze([]),
    });
    if (disposed) {
      backend = undefined;
      file = undefined;
      url = undefined;
      mapError = undefined;
      retry = undefined;
      unregister?.();
      unregister = undefined;
    }
    const errors: unknown[] = [];
    for (const handle of pending) {
      try {
        handle.stop();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, 'Upload scheduler cleanup failed.');
  }
  const dispose = () => clear(true);
  if (destroyRef.destroyed) dispose();
  else unregister = destroyRef.onDestroy(dispose);
  return Object.freeze({
    uploader: Object.freeze(wrapped),
    generation: computed(() => state().generation),
    disposed: computed(() => state().disposed),
    activeCount,
    busy: computed(() => activeCount() > 0),
    operations: computed(() => state().operations),
    overflow: computed(() => state().overflow),
    hasErrors: computed(
      () =>
        !!state().overflow ||
        state().operations.some((item) => item.status !== 'active'),
    ),
    acknowledge(id: EditorJsUploadId): void {
      state.update((previous) => ({
        ...previous,
        operations: Object.freeze(
          previous.operations.filter(
            (item) => item.id !== id || item.status === 'active',
          ),
        ),
        overflow: previous.overflow?.id === id ? undefined : previous.overflow,
      }));
    },
    reset: () => clear(false),
    dispose,
  });
}
