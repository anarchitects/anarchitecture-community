import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  resource,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  FormField,
  disabled,
  form,
  readonly,
  submit,
  validate,
  validateAsync,
} from '@angular/forms/signals';
import { EDITOR_JS_LOADER } from '@anarchitects/editorjs-angular';
import { EditorJsControl } from '@anarchitects/editorjs-angular/forms';
import type {
  EditorJsChangeEvent,
  EditorJsErrorEvent,
  OutputData,
} from '@anarchitects/editorjs-core';
import { controlledFormsLoader, FormsWork } from './forms-work';
import { Ownership } from './ownership';

const document = (text: string): OutputData => ({
  blocks: [{ type: 'paragraph', data: { text } }],
});
function contentError(data: OutputData) {
  return data.blocks.some((block) => {
    const text = (block.data as { text?: unknown }).text;
    return typeof text === 'string' && text.trim();
  })
    ? undefined
    : { kind: 'content', message: 'Write a paragraph.' };
}

@Component({
  selector: 'aa-forms-card',
  imports: [EditorJsControl, FormField, ReactiveFormsModule, JsonPipe],
  providers: [
    { provide: FormsWork, useFactory: () => new FormsWork() },
    { provide: EDITOR_JS_LOADER, useFactory: controlledFormsLoader },
  ],
  templateUrl: './forms-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormsCard implements OnInit {
  readonly label = input.required<string>();
  readonly legacy = input(false);
  readonly model = signal<{ body: OutputData }>({ body: document('Initial') });
  readonly legacyBody = new FormControl<OutputData>(document('Initial'), {
    nonNullable: true,
  });
  readonly unavailable = signal(false);
  readonly readOnly = signal(false);
  readonly reviewRound = signal(0);
  readonly work = inject(FormsWork);
  readonly fields = form(this.model, (path) => {
    disabled(path.body, () => this.unavailable());
    readonly(path.body, () => this.readOnly());
    validate(path.body, ({ value }) => contentError(value()));
    validateAsync(path.body, {
      params: ({ value }) =>
        this.reviewRound()
          ? { value: value(), round: this.reviewRound() }
          : undefined,
      factory: (params) =>
        resource({
          params,
          loader: ({ abortSignal }) => this.work.review(abortSignal),
        }),
      onSuccess: (error) => error,
      onError: () => ({
        kind: 'validation-service',
        message: 'Review unavailable.',
      }),
    });
  });
  readonly mounted = signal(true);
  readonly ready = signal(false);
  readonly readyCount = signal(0);
  readonly changes = signal(0);
  readonly touches = signal(0);
  readonly lastChange = signal<EditorJsChangeEvent | undefined>(undefined);
  readonly operationError = signal('');
  readonly errorCount = signal(0);
  readonly captured = signal<OutputData | undefined>(undefined);
  readonly result = signal('');
  readonly config = { minHeight: 80 };
  private readonly editor = viewChild(EditorJsControl);
  readonly #ownership = inject(Ownership);

  ngOnInit(): void {
    const initial = document(`${this.label()} initial`);
    this.model.set({ body: initial });
    this.legacyBody.setValue(initial);
  }
  value(): OutputData {
    return this.legacy() ? this.legacyBody.value : this.model().body;
  }
  dirty(): boolean {
    return this.legacy() ? this.legacyBody.dirty : this.fields.body().dirty();
  }
  touched(): boolean {
    return this.legacy()
      ? this.legacyBody.touched
      : this.fields.body().touched();
  }
  onReady(): void {
    this.ready.set(true);
    this.readyCount.update((n) => n + 1);
    this.#ownership.outputs.update((n) => n + 1);
  }
  onChange(event: EditorJsChangeEvent): void {
    this.lastChange.set(event);
    this.changes.update((n) => n + 1);
    this.#ownership.outputs.update((n) => n + 1);
  }
  onTouch(): void {
    this.touches.update((n) => n + 1);
    this.#ownership.outputs.update((n) => n + 1);
  }
  onError(event: EditorJsErrorEvent): void {
    this.operationError.set(`${event.operation}: ${event.code}`);
    this.errorCount.update((n) => n + 1);
    this.#ownership.outputs.update((n) => n + 1);
  }
  write(invalid = false): void {
    const next = invalid
      ? { blocks: [{ type: '', data: {} }] }
      : document(`${this.label()} replacement`);
    this.operationError.set('');
    if (this.legacy()) {
      this.editor()?.reset();
      this.legacyBody.setValue(next);
    } else this.model.set({ body: next });
  }
  reset(empty = false): void {
    const next = empty ? { blocks: [] } : document(`${this.label()} reset`);
    this.operationError.set('');
    if (this.legacy()) {
      this.editor()?.reset();
      this.legacyBody.reset(next);
    } else this.fields.body().reset(next);
  }
  resetSame(): void {
    if (this.legacy()) {
      this.editor()?.reset();
      this.legacyBody.reset(this.legacyBody.value);
    } else this.fields.body().reset(this.model().body);
  }
  toggleDisabled(): void {
    this.unavailable.update((v) => !v);
    if (this.legacy()) {
      if (this.unavailable()) this.legacyBody.disable();
      else this.legacyBody.enable();
    }
  }
  toggleMount(): void {
    this.ready.set(false);
    this.mounted.update((v) => !v);
  }
  focus(): void {
    this.editor()?.focus();
  }
  mutateEvent(): void {
    const event = this.lastChange();
    if (!event?.data.blocks[0]) return;
    (event.data.blocks[0].data as { text?: string }).text = 'Mutated event';
    this.lastChange.set({ ...event });
  }
  async save(): Promise<void> {
    const editor = this.editor();
    if (!editor) return;
    this.result.set('Saving');
    try {
      this.captured.set(await editor.save());
      this.result.set('Captured');
    } catch {
      this.result.set('Capture rejected');
    }
  }
  async persist(): Promise<void> {
    const editor = this.editor();
    if (!editor) return;
    this.result.set('Submit requested');
    try {
      await submit(this.fields, {
        ignoreValidators: 'none',
        action: async () => {
          const snapshot = await editor.save();
          const error = contentError(snapshot);
          if (error) return { ...error, fieldTree: this.fields.body };
          this.captured.set(snapshot);
          this.result.set('Submitting');
          if (await this.work.persist()) {
            this.result.set('Submitted');
            return undefined;
          }
          this.result.set('Submission rejected');
          return {
            kind: 'server',
            message: 'Save failed. Try again.',
            fieldTree: this.fields.body,
          };
        },
      });
    } catch {
      this.result.set('Capture rejected');
    }
  }
}
