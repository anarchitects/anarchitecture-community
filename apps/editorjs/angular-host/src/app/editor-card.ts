import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  EditorJs,
  EditorJsOperationError,
  type EditorJsChangeEvent,
  type EditorJsErrorEvent,
} from '@anarchitects/editorjs-angular';
import type { OutputData } from '@anarchitects/editorjs-core';
import { Ownership } from './ownership';

const document = (text: string): OutputData => ({
  blocks: [{ type: 'paragraph', data: { text } }],
});

type Command = 'save' | 'render' | 'clear' | 'focus' | 'readOnly' | 'invalid';

@Component({
  selector: 'aa-editor-card',
  imports: [EditorJs, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editor-card.html',
})
export class EditorCard {
  readonly label = input.required<string>();
  readonly initial = computed(() => document(`${this.label()} initial`));
  readonly replacement = signal<OutputData | undefined>(undefined);
  readonly config = { minHeight: 80 };
  readonly mounted = signal(true);
  readonly ready = signal(false);
  readonly readinessCount = signal(0);
  readonly changes = signal(0);
  readonly lastChange = signal<EditorJsChangeEvent | undefined>(undefined);
  readonly saved = signal<OutputData | undefined>(undefined);
  readonly error = signal('');
  readonly result = signal('');
  readonly readOnly = signal(false);
  private readonly editor = viewChild(EditorJs);
  readonly #ownership = inject(Ownership);

  onReady(): void {
    this.#ownership.outputs.update((count) => count + 1);
    this.readinessCount.update((count) => count + 1);
    this.ready.set(true);
  }

  onChange(event: EditorJsChangeEvent): void {
    this.#ownership.outputs.update((count) => count + 1);
    this.changes.update((count) => count + 1);
    this.lastChange.set(event);
  }

  onError(event: EditorJsErrorEvent): void {
    this.#ownership.outputs.update((count) => count + 1);
    this.error.set(`${event.operation}: ${event.code}`);
  }

  toggleMount(): void {
    this.ready.set(false);
    this.error.set('');
    this.result.set('');
    this.readOnly.set(false);
    this.replacement.set(undefined);
    this.mounted.update((value) => !value);
  }

  replaceInput(): void {
    this.replacement.set(document(`${this.label()} input replacement`));
  }

  async run(command: Command): Promise<void> {
    const api = this.editor()?.api;
    if (!api) return;
    this.error.set('');
    this.result.set('');
    try {
      switch (command) {
        case 'save':
          this.saved.set(await api.save());
          break;
        case 'render':
          await api.render(document(`${this.label()} rendered`));
          break;
        case 'clear':
          await api.clear();
          break;
        case 'focus':
          await api.focus(true);
          break;
        case 'readOnly':
          this.readOnly.set(await api.setReadOnly(!this.readOnly()));
          break;
        case 'invalid':
          await api.render({ blocks: [{ type: '', data: {} }] });
          break;
      }
      this.result.set(`${command} completed`);
    } catch (error) {
      // The package emits the same live error through its output. Catch the
      // imperative rejection too, as every consumer of the promise must do.
      if (!(error instanceof EditorJsOperationError)) throw error;
      this.result.set(`${command} rejected`);
    }
  }
}
