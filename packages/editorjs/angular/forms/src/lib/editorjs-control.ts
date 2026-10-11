import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  model,
  output,
  signal,
  type OnChanges,
  type OnInit,
  type SimpleChanges,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { EditorJs } from '@anarchitects/editorjs-angular';
import {
  normalizeOutputData,
  type EditorJsChangeEvent,
  type EditorJsErrorEvent,
  type EditorJsReadyEvent,
  type OutputData,
} from '@anarchitects/editorjs-core';
import type { EditorJsControlConfig } from './editorjs-control-config.js';

@Component({
  selector: 'aa-editorjs-control',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editorData(); as document) {
      <aa-editorjs
        [data]="document"
        [config]="config()"
        (ready)="ready.emit()"
        (change)="acceptChange($event)"
        (error)="error.emit($event)"
      />
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class EditorJsControl
  implements FormValueControl<OutputData>, OnChanges, OnInit
{
  readonly value = model<OutputData>({ blocks: [] });
  readonly config = input<EditorJsControlConfig>();
  readonly ready = output<EditorJsReadyEvent>();
  // eslint-disable-next-line @angular-eslint/no-output-native -- Same saved-document channel as the standalone component.
  readonly change = output<EditorJsChangeEvent>();
  // eslint-disable-next-line @angular-eslint/no-output-native -- Same typed operation errors as the standalone component.
  readonly error = output<EditorJsErrorEvent>();

  // Only inbound writes reach the child. The form remains the value owner.
  protected readonly editorData = signal<OutputData | undefined>(undefined);
  #published: OutputData | undefined;
  #inputSeen = false;
  #validInput = false;
  #destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#destroyed = true;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.#inputSeen = true;
      this.#project(this.value());
    }
  }

  ngOnInit(): void {
    if (!this.#inputSeen) this.#project(this.value());
  }

  protected acceptChange(event: EditorJsChangeEvent): void {
    if (this.#destroyed || !this.#validInput) return;
    // Forms can attach tracking metadata to the model. Keep the public event detached.
    const result = normalizeOutputData(event.data);
    if (!result.ok) {
      this.error.emit({
        operation: 'data',
        code: 'invalid-data',
        cause: result.error,
      });
      return;
    }
    this.#published = result.data;
    this.value.set(result.data);
    // A model listener can synchronously remove this control.
    if (!this.#destroyed) this.change.emit(event);
  }

  #project(value: OutputData): void {
    if (value === this.#published && this.#validInput) return;
    this.#published = undefined;
    // Signal Forms decorates array items with symbol-keyed identity metadata.
    const result = normalizeOutputData(value, { symbolKeys: 'omit' });
    this.#validInput = result.ok;
    if (!result.ok) {
      this.error.emit({
        operation: 'data',
        code: 'invalid-data',
        cause: result.error,
      });
      return;
    }
    this.editorData.set(result.data);
  }
}
