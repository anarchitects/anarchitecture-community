import { inject, signal } from '@angular/core';
import {
  EDITOR_JS_LOADER,
  type EditorJsLoader,
} from '@anarchitects/editorjs-angular';
import type { OutputData } from '@anarchitects/editorjs-core';
import type { ValidationError } from '@angular/forms/signals';

/** Per-card test controls. Real Editor.js still captures every snapshot. */
export class FormsWork {
  readonly armed = signal(false);
  readonly held = signal(false);
  readonly heldDocument = signal<OutputData | undefined>(undefined);
  readonly validating = signal(false);
  readonly submitting = signal(false);
  failNext = false;
  #resume?: () => void;
  #review?: (error: ValidationError | undefined) => void;
  #persist?: (success: boolean) => void;

  hold(snapshot: OutputData): Promise<void> {
    this.heldDocument.set(snapshot);
    this.held.set(true);
    return new Promise((resolve) => {
      this.#resume = () => {
        this.#resume = undefined;
        this.held.set(false);
        resolve();
      };
    });
  }
  release(): void {
    this.#resume?.();
  }

  review(abortSignal: AbortSignal): Promise<ValidationError | undefined> {
    this.validating.set(true);
    return new Promise((resolve) => {
      const finish = (error?: ValidationError) => {
        abortSignal.removeEventListener('abort', abort);
        if (this.#review === finish) {
          this.#review = undefined;
          this.validating.set(false);
        }
        resolve(error);
      };
      const abort = () => finish();
      this.#review = finish;
      if (abortSignal.aborted) abort();
      else abortSignal.addEventListener('abort', abort, { once: true });
    });
  }
  finishReview(rejected: boolean): void {
    this.#review?.(
      rejected
        ? { kind: 'review', message: 'Document needs review.' }
        : undefined,
    );
  }
  persist(): Promise<boolean> {
    this.submitting.set(true);
    return new Promise((resolve) => {
      this.#persist = (success) => {
        this.#persist = undefined;
        this.submitting.set(false);
        resolve(success);
      };
    });
  }
  finishSubmission(success: boolean): void {
    this.#persist?.(success);
  }
}

export function controlledFormsLoader(): EditorJsLoader {
  const load = inject(EDITOR_JS_LOADER, { skipSelf: true });
  const work = inject(FormsWork);
  return async () => {
    const create = await load();
    return (options) => {
      const editor = create(options);
      return {
        isReady: editor.isReady,
        render: (data) => editor.render(data),
        clear: () => editor.clear(),
        focus: (atEnd) => editor.focus(atEnd),
        get readOnly() {
          return editor.readOnly;
        },
        destroy: () => editor.destroy(),
        save: async () => {
          const hold = work.armed();
          work.armed.set(false);
          const fail = work.failNext;
          work.failNext = false;
          const snapshot = await editor.save();
          if (hold) await work.hold(snapshot);
          if (fail) throw new Error('Host-requested save failure');
          return snapshot;
        },
      };
    };
  };
}
