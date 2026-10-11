import {
  EditorJsOperationError,
  type EditorJsApi,
  type EditorJsChangeEvent,
  type EditorJsErrorEvent,
  type EditorJsOperation,
} from './editor-contracts.js';
import type { OutputData } from './output-data.js';
import { normalizeOutputData } from './parse-output-data.js';

/** Non-DOM driver for one editor. The owner supplies readiness and destruction. */
export interface EditorJsDocumentDriver {
  save(): Promise<unknown>;
  render(data: OutputData): Promise<void>;
  /** Optional capabilities. An absent handler rejects its API call. */
  clear?(): void | Promise<void>;
  focus?(atEnd?: boolean): boolean | Promise<boolean>;
  setReadOnly?(readOnly: boolean): boolean | Promise<boolean>;
  /** Actual mode, used to recover when a failed transition partially changed it. */
  getReadOnly?(): boolean | undefined;
}

export interface EditorJsDocumentCoordinatorOptions {
  readonly driver: EditorJsDocumentDriver;
  /** Synchronous event sinks; hosts must handle their own listener exceptions. */
  readonly onChange: (event: EditorJsChangeEvent) => void;
  readonly onError: (event: EditorJsErrorEvent) => void;
}

/**
 * Per-owner document and control coordination, independent of any framework.
 * Input replacements, controls and automatic saves share one ordered queue.
 * This does not own an editor, its readiness promise, or its destruction API.
 */
export class EditorJsDocumentCoordinator {
  readonly #options: EditorJsDocumentCoordinatorOptions;
  readonly #queue: (() => Promise<void>)[] = [];
  readonly #cancellations = new Set<() => void>();
  #ready = false;
  #destroyed = false;
  #running = false;
  #mutating = false;
  #replacements = 0;
  #saveQueued = false;
  #pendingChange = false;
  #revision = 0;
  #generation = 0;
  #sequence = 0;
  #fingerprint: string | undefined;
  #needsBaseline = false;
  #readOnly = false;

  /** Stable, bound facade; safe to retain or destructure, even before readiness. */
  readonly api: EditorJsApi = Object.freeze({
    save: () => this.#command('save', () => () => this.#readSnapshot()),
    render: (data: OutputData) =>
      this.#command('render', () => {
        const document = this.#normalize(data, 'render');
        this.#acceptReplacement();
        return () => this.#write(() => this.#options.driver.render(document));
      }),
    clear: () =>
      this.#command('clear', () => {
        const clear = this.#capability('clear');
        this.#acceptReplacement();
        return () => this.#write(() => clear());
      }),
    focus: (atEnd?: boolean) =>
      this.#command('focus', () => {
        const focus = this.#capability('focus');
        return () => focus(atEnd);
      }),
    setReadOnly: (readOnly: boolean) =>
      this.#command('readOnly', () => {
        const setReadOnly = this.#capability('setReadOnly');
        return () => this.#setReadOnly(() => setReadOnly(readOnly));
      }),
  });

  constructor(options: EditorJsDocumentCoordinatorOptions) {
    this.#options = options;
  }

  /** Activate once the owner's editor is usable. Pre-ready edits are ignored. */
  markReady(readOnly = false): void {
    if (this.#destroyed || this.#ready) return;
    this.#readOnly = readOnly;
    this.#ready = true;
    this.#schedule();
  }

  /** Accept an input replacement before/after readiness; undefined clears content. */
  replace(data: unknown): void {
    if (this.#destroyed) return;
    let document: OutputData;
    try {
      document = this.#normalize(
        data === undefined ? { blocks: [] } : data,
        'data',
      );
    } catch (error) {
      this.#reportAutomatic('data', error);
      return;
    }
    this.#acceptReplacement();
    this.#queue.push(async () => {
      try {
        await this.#write(() => this.#options.driver.render(document));
      } catch (cause) {
        this.#reportAutomatic('render', cause);
      }
    });
    this.#schedule();
  }

  /** Raw editor invalidation, not proof of a physical user gesture. */
  notifyChange(): void {
    if (
      this.#destroyed ||
      !this.#ready ||
      this.#readOnly ||
      this.#mutating ||
      this.#replacements > 0
    )
      return;
    this.#revision++;
    this.#sequence++;
    this.#pendingChange = true;
    if (this.#saveQueued) return;
    this.#saveQueued = true;
    const generation = this.#generation;
    this.#queue.push(async () => {
      this.#saveQueued = false;
      if (generation !== this.#generation || this.#readOnly) return;
      try {
        await this.#capture('change');
      } catch (cause) {
        this.#reportAutomatic('save', cause);
      }
    });
    this.#schedule();
  }

  /** Reject pending calls immediately; suppress outputs and cancel unstarted work. */
  dispose(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#queue.length = 0;
    this.#pendingChange = false;
    this.#fingerprint = undefined;
    for (const cancel of this.#cancellations) cancel();
    this.#cancellations.clear();
  }

  #acceptReplacement(): void {
    this.#revision++;
    this.#generation++;
    this.#pendingChange = false;
    this.#replacements++;
  }

  #normalize(data: unknown, operation: EditorJsOperation): OutputData {
    const result = normalizeOutputData(data);
    if (!result.ok)
      throw new EditorJsOperationError({
        operation,
        code: 'invalid-data',
        cause: result.error,
      });
    return result.data;
  }

  #capability<Key extends 'clear' | 'focus' | 'setReadOnly'>(
    key: Key,
  ): NonNullable<EditorJsDocumentDriver[Key]> {
    const method = this.#options.driver[key];
    if (!method) throw new Error(`Editor driver does not support ${key}.`);
    return method.bind(this.#options.driver) as NonNullable<
      EditorJsDocumentDriver[Key]
    >;
  }

  #command<T>(
    operation: EditorJsOperation,
    prepare: () => () => T | Promise<T>,
  ): Promise<T> {
    const unavailable = this.#destroyed
      ? 'destroyed'
      : !this.#ready
        ? 'not-ready'
        : undefined;
    if (unavailable) {
      const error = new EditorJsOperationError({
        operation,
        code: unavailable,
        cause: new Error(`Editor owner is ${unavailable}.`),
      });
      this.#report(error);
      return Promise.reject(error);
    }
    let run: () => T | Promise<T>;
    try {
      run = prepare();
    } catch (cause) {
      const error = this.#failure(operation, cause);
      this.#report(error);
      return Promise.reject(error);
    }
    const promise = new Promise<T>((resolve, reject) => {
      const cancel = () =>
        reject(
          new EditorJsOperationError({
            operation,
            code: 'destroyed',
            cause: new Error('Editor owner was destroyed.'),
          }),
        );
      this.#cancellations.add(cancel);
      this.#queue.push(async () => {
        try {
          const result = await run();
          if (!this.#destroyed) resolve(result);
        } catch (cause) {
          if (!this.#destroyed) {
            const error = this.#failure(operation, cause);
            // Settle before notifying a reentrant host listener.
            reject(error);
            this.#report(error);
          }
        } finally {
          this.#cancellations.delete(cancel);
        }
      });
    });
    this.#schedule();
    return promise;
  }

  #schedule(): void {
    if (!this.#ready || this.#destroyed || this.#running) return;
    this.#running = true;
    void Promise.resolve().then(() => this.#drain());
  }

  async #drain(): Promise<void> {
    try {
      while (!this.#destroyed) {
        const work = this.#queue.shift();
        if (!work) break;
        await work();
      }
    } finally {
      this.#running = false;
    }
  }

  async #write<T>(write: () => T | Promise<T>): Promise<T> {
    this.#mutating = true;
    this.#needsBaseline = true;
    try {
      const result = await write();
      if (!this.#destroyed && !this.#readOnly) await this.#capture('baseline');
      return result;
    } catch (cause) {
      this.#needsBaseline = true;
      throw cause;
    } finally {
      this.#replacements--;
      this.#mutating = false;
    }
  }

  async #setReadOnly(
    toggle: () => boolean | Promise<boolean>,
  ): Promise<boolean> {
    this.#mutating = true;
    try {
      this.#readOnly = this.#options.driver.getReadOnly?.() ?? this.#readOnly;
      // Editor.js cannot save while read-only. Capture known edits before entry,
      // and establish the rendered baseline after returning to editable mode.
      if (!this.#readOnly) await this.#capture('readOnly');
      if (this.#destroyed) return this.#readOnly;
      this.#readOnly = await toggle();
      if (!this.#destroyed && !this.#readOnly) await this.#capture('readOnly');
      return this.#readOnly;
    } catch (cause) {
      this.#needsBaseline = true;
      throw cause;
    } finally {
      this.#mutating = false;
    }
  }

  async #readSnapshot(): Promise<OutputData> {
    try {
      return this.#normalize(await this.#options.driver.save(), 'save');
    } catch (cause) {
      throw this.#failure('save', cause);
    }
  }

  async #capture(mode: 'change' | 'baseline' | 'readOnly'): Promise<void> {
    this.#readOnly = this.#options.driver.getReadOnly?.() ?? this.#readOnly;
    if (this.#readOnly) return;
    const revision = this.#revision;
    const sequence = this.#sequence;
    const saved = await this.#readSnapshot();
    if (this.#destroyed || revision !== this.#revision) return;
    const fingerprint = documentFingerprint(saved);
    const silent =
      this.#needsBaseline ||
      mode === 'baseline' ||
      (mode === 'readOnly' && !this.#pendingChange) ||
      fingerprint === this.#fingerprint;
    this.#needsBaseline = false;
    this.#fingerprint = fingerprint;
    this.#pendingChange = false;
    if (!silent) this.#options.onChange({ data: saved, sequence });
  }

  #failure(
    operation: EditorJsOperation,
    cause: unknown,
  ): EditorJsOperationError {
    return cause instanceof EditorJsOperationError
      ? cause
      : new EditorJsOperationError({
          operation,
          code: 'operation-failed',
          cause,
        });
  }

  #report(event: EditorJsErrorEvent): void {
    if (!this.#destroyed) this.#options.onError(event);
  }

  #reportAutomatic(operation: EditorJsOperation, cause: unknown): void {
    const error = this.#failure(operation, cause);
    this.#report({
      operation: error.operation,
      code: error.code,
      cause: error.cause,
    });
  }
}

/** Ignore save timestamps and object key order, preserving all other JSON fields. */
function documentFingerprint(data: OutputData): string {
  const { time: _time, ...content } = data;
  return JSON.stringify(content, (_key, value) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      );
    }
    return value;
  });
}
