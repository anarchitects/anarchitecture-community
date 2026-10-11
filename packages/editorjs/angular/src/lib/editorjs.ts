import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ErrorHandler,
  inject,
  input,
  output,
  PLATFORM_ID,
  untracked,
  viewChild,
} from '@angular/core';
import {
  normalizeOutputData,
  EditorJsDocumentCoordinator,
  type EditorJsChangeEvent,
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
  // eslint-disable-next-line @angular-eslint/no-output-native -- The agreed saved-document channel is an Angular output.
  readonly change = output<EditorJsChangeEvent>();
  // eslint-disable-next-line @angular-eslint/no-output-native -- The documented editor error channel is a component output, not a DOM event.
  readonly error = output<EditorJsErrorEvent>();

  private readonly holder =
    viewChild.required<ElementRef<HTMLElement>>('holder');
  readonly #loader = inject(EDITOR_JS_LOADER);
  readonly #errorHandler = inject(ErrorHandler);
  #instance: EditorJsInstance | undefined;
  #destroyed = false;
  #readinessSettled = false;
  #started = false;
  #observedConfig: EditorJsConfig | undefined;
  #observedData: OutputData | undefined;
  readonly #documents = new EditorJsDocumentCoordinator({
    driver: {
      save: () => this.#instance!.save(),
      render: (data) => this.#instance!.render(data),
      clear: () => this.#instance!.clear(),
      focus: (atEnd) => this.#instance!.focus(atEnd),
      setReadOnly: (readOnly) => this.#instance!.readOnly.toggle(readOnly),
      getReadOnly: () => this.#instance!.readOnly.isEnabled,
    },
    onChange: (event) => {
      if (!this.#destroyed) this.change.emit(event);
    },
    onError: (event) => this.#report(event),
  });
  /** One stable facade per component, available before readiness with guarded calls. */
  readonly api = this.#documents.api;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#destroyed = true;
      this.#documents.dispose();
      // Editor.js installs its public destroy method during readiness. A pending
      // instance is disposed by the initialization continuation once it settles.
      if (this.#readinessSettled) this.#dispose();
    });
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    afterNextRender(() => {
      if (browser && !this.#destroyed) void this.#initialize();
    });
    afterRenderEffect(() => {
      const data = this.data();
      const config = this.config();
      untracked(() => this.#syncInputs(data, config));
    });
  }

  #syncInputs(
    data: OutputData | undefined,
    config: EditorJsConfig | undefined,
  ): void {
    if (!this.#started || this.#destroyed) return;
    if (config !== this.#observedConfig) {
      this.#observedConfig = config;
      this.#report({
        operation: 'config',
        code: 'config-changed',
        cause: new Error(
          'Configuration is initialization-only; recreate the component to reconfigure it.',
        ),
      });
    }
    if (this.#instance && data !== this.#observedData) {
      this.#observedData = data;
      this.#documents.replace(data);
    }
  }

  async #initialize(): Promise<void> {
    let operation: EditorJsOperation = 'load';
    try {
      const config = this.config();
      this.#observedConfig = config;
      this.#started = true;
      const factory = await this.#loader();
      if (this.#destroyed) return;

      operation = 'data';
      const data = this.data();
      this.#observedData = data;
      const normalized = normalizeOutputData(
        data === undefined ? { blocks: [] } : data,
      );
      if (!normalized.ok) {
        this.#report({
          operation,
          code: 'invalid-data',
          cause: normalized.error,
        });
        this.#dispose();
        return;
      }
      operation = 'create';
      this.#instance = factory({
        holder: this.holder().nativeElement,
        config,
        data: normalized.data,
        onChange: () => this.#documents.notifyChange(),
      });
      operation = 'ready';
      await this.#instance.isReady;
      this.#readinessSettled = true;
      if (this.#destroyed) this.#dispose();
      else {
        this.#syncInputs(this.data(), this.config());
        this.#documents.markReady(
          this.#instance.readOnly.isEnabled ?? config?.readOnly ?? false,
        );
        this.ready.emit();
      }
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
    this.#documents.dispose();
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
