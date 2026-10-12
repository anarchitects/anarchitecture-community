import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  EDITOR_JS_LOADER,
  EditorJs,
  EditorJsOperationError,
  type EditorJsChangeEvent,
  type EditorJsErrorEvent,
} from '@anarchitects/editorjs-angular';
import type { OutputData } from '@anarchitects/editorjs-core';
import { controlledLifetimeLoader, LifetimeWork } from './lifetime-probe';

const document = (text: string): OutputData => ({
  blocks: [{ type: 'paragraph', data: { text } }],
});
type Command = 'save' | 'render' | 'clear' | 'focus' | 'readonly';

@Component({
  selector: 'aa-standalone-editor',
  imports: [EditorJs, JsonPipe],
  providers: [
    LifetimeWork,
    { provide: EDITOR_JS_LOADER, useFactory: controlledLifetimeLoader },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [attr.aria-labelledby]="label() + '-label'">
      <h2 [id]="label() + '-label'">Document {{ label() }}</h2>
      <p role="status" data-testid="ready">
        {{ ready() ? 'Editor ready' : 'Editor activates in the browser' }}
      </p>
      <aa-editorjs
        [data]="replacement() ?? initial()"
        [config]="config()"
        (ready)="onReady()"
        (change)="onChange($event)"
        (error)="onError($event)"
      />
      <button type="button" (click)="replace()">Replace input</button>
      @for (command of commands; track command) {
        <button type="button" [disabled]="!ready()" (click)="run(command)">
          {{ command }}
        </button>
      }
      <p data-testid="ready-count">{{ readyCount() }}</p>
      <p data-testid="changes">{{ changes() }}</p>
      <p data-testid="error">{{ error() }}</p>
      <p data-testid="result">{{ result() }}</p>
      <pre data-testid="bound-input">{{ replacement() | json }}</pre>
      <pre data-testid="saved">{{ saved() | json }}</pre>
      <pre data-testid="last-change">{{ lastChange() | json }}</pre>
    </section>
  `,
  styles: `
    aa-editorjs {
      min-height: 8rem;
    }
  `,
})
export class StandaloneEditor {
  readonly label = input('A');
  readonly initial = input.required<OutputData>();
  readonly initialReadOnly = input(false);
  readonly config = computed(() => ({
    minHeight: 80,
    readOnly: this.initialReadOnly(),
  }));
  readonly commands: Command[] = [
    'save',
    'render',
    'clear',
    'focus',
    'readonly',
  ];
  readonly replacement = signal<OutputData | undefined>(undefined);
  readonly ready = signal(false);
  readonly readyCount = signal(0);
  readonly changes = signal(0);
  readonly error = signal('');
  readonly result = signal('');
  readonly saved = signal<OutputData | undefined>(undefined);
  readonly lastChange = signal<EditorJsChangeEvent | undefined>(undefined);
  private readonly editor = viewChild.required(EditorJs);
  readonly #work = inject(LifetimeWork);
  #revision = 0;
  #destroyed = false;
  #readonly = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#destroyed = true;
      this.#work.record('owner-destroyed');
    });
  }
  onReady(): void {
    this.#readonly = this.initialReadOnly();
    this.#work.record('output-ready');
    this.ready.set(true);
    this.readyCount.update((n) => n + 1);
  }
  onChange(event: EditorJsChangeEvent): void {
    this.#work.record('output-change');
    this.changes.update((n) => n + 1);
    this.lastChange.set(structuredClone(event));
    // Deliberately mutate the consumer's detached event, never the bound input.
    const block = event.data.blocks[0];
    if (block) block.data = { text: 'consumer mutation' };
  }
  onError(event: EditorJsErrorEvent): void {
    this.#work.record('output-error');
    this.error.set(`${event.operation}: ${event.code}`);
  }
  replace(): void {
    this.replacement.set(
      document(`${this.label()} replacement ${++this.#revision}`),
    );
  }
  async run(command: Command): Promise<void> {
    const api = this.editor().api;
    this.result.set('');
    try {
      switch (command) {
        case 'save': {
          const data = await api.save();
          if (!this.#destroyed) this.saved.set(data);
          break;
        }
        case 'render':
          await api.render(document(`${this.label()} rendered`));
          break;
        case 'clear':
          await api.clear();
          break;
        case 'focus':
          await api.focus(true);
          break;
        case 'readonly':
          this.#readonly = await api.setReadOnly(!this.#readonly);
          break;
      }
      if (!this.#destroyed) this.result.set(`${command} completed`);
    } catch (error) {
      if (!(error instanceof EditorJsOperationError)) throw error;
      if (!this.#destroyed)
        this.result.set(`${command} rejected: ${error.code}`);
    }
  }
}
