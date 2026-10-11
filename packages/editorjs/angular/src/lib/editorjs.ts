import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ErrorHandler,
  inject,
  input,
  output,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import {
  normalizeOutputData,
  type EditorJsErrorEvent,
  type EditorJsOperation,
  type EditorJsReadyEvent,
  type OutputData,
} from '@anarchitects/editorjs-core';
import type { EditorJsConfig } from './editorjs-contracts.js';
import { EDITOR_JS_LOADER, type EditorJsInstance } from './editorjs-loader.js';

@Component({
  selector: 'aa-editorjs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #holder></div>`,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class EditorJs {
  readonly config = input<EditorJsConfig>();
  readonly data = input<OutputData>();
  readonly ready = output<EditorJsReadyEvent>();
  // eslint-disable-next-line @angular-eslint/no-output-native -- The documented editor error channel is a component output, not a DOM event.
  readonly error = output<EditorJsErrorEvent>();

  private readonly holder =
    viewChild.required<ElementRef<HTMLElement>>('holder');
  readonly #loader = inject(EDITOR_JS_LOADER);
  readonly #errorHandler = inject(ErrorHandler);
  #instance: EditorJsInstance | undefined;
  #destroyed = false;
  #readinessSettled = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#destroyed = true;
      // Editor.js installs its public destroy method during readiness. A pending
      // instance is disposed by the initialization continuation once it settles.
      if (this.#readinessSettled) this.#dispose();
    });
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    afterNextRender(() => {
      if (browser && !this.#destroyed) void this.#initialize();
    });
  }

  async #initialize(): Promise<void> {
    let operation: EditorJsOperation = 'load';
    try {
      const config = this.config();
      const factory = await this.#loader();
      if (this.#destroyed) return;

      operation = 'data';
      const data = this.data();
      const normalized = normalizeOutputData(
        data === undefined ? { blocks: [] } : data,
      );
      if (!normalized.ok) {
        this.#report({
          operation,
          code: 'invalid-data',
          cause: normalized.error,
        });
        return;
      }
      operation = 'create';
      this.#instance = factory({
        holder: this.holder().nativeElement,
        config,
        data: normalized.data,
        // Document change coordination is supplied separately from owned lifecycle.
        onChange: () => undefined,
      });
      operation = 'ready';
      await this.#instance.isReady;
      this.#readinessSettled = true;
      if (this.#destroyed) this.#dispose();
      else this.ready.emit();
    } catch (cause) {
      this.#readinessSettled = true;
      this.#report({ operation, code: 'operation-failed', cause });
      this.#dispose();
    }
  }

  #report(error: EditorJsErrorEvent): void {
    if (!this.#destroyed) this.error.emit(error);
  }

  #dispose(): void {
    const instance = this.#instance;
    this.#instance = undefined;
    if (!instance) return;
    try {
      instance.destroy();
    } catch (cause) {
      // Outputs are unavailable during/after owner destruction. Cleanup failures
      // still reach Angular's error channel instead of an abandoned promise.
      if (this.#destroyed) this.#errorHandler.handleError(cause);
      else
        this.#report({ operation: 'destroy', code: 'operation-failed', cause });
    }
  }
}
