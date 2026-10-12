import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import {
  disabled,
  form,
  FormField,
  readonly,
  submit,
  validate,
  validateAsync,
} from '@angular/forms/signals';
import { EDITOR_JS_LOADER } from '@anarchitects/editorjs-angular';
import { EditorJsControl } from '@anarchitects/editorjs-angular/forms';
import type {
  EditorJsErrorEvent,
  OutputData,
} from '@anarchitects/editorjs-core';
import { FormsWork } from '../app/forms-work';
import { RequestState } from './request-state';
import { controlledLifetimeLoader, LifetimeWork } from './lifetime-probe';

function contentError(data: OutputData) {
  return data.blocks.some((block) => {
    const text = (block.data as { text?: unknown }).text;
    return typeof text === 'string' && text.trim();
  })
    ? undefined
    : { kind: 'content', message: 'Write a paragraph.' };
}
const document = (text: string): OutputData => ({
  blocks: [{ type: 'paragraph', data: { text } }],
});

@Component({
  selector: 'aa-forms-editor',
  imports: [EditorJsControl, FormField, JsonPipe],
  providers: [
    LifetimeWork,
    { provide: FormsWork, useFactory: () => new FormsWork() },
    { provide: EDITOR_JS_LOADER, useFactory: controlledLifetimeLoader },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form method="post" action="/fixture-submit" (submit)="persist($event)">
      <fieldset [disabled]="!ready() || fields().submitting()">
        <legend>Document</legend>
        <p role="status">
          {{ ready() ? 'Editor ready' : 'Editor activates in the browser' }}
        </p>
        <label>Private fixture note <input [formField]="fields.note" /></label>
        <aa-editorjs-control
          [formField]="fields.body"
          [config]="config"
          aria-label="Document"
          (ready)="onReady()"
          (change)="output('change')"
          (touch)="output('touch')"
          (error)="onError($event)"
        />
        <button type="submit">Submit fixture</button>
      </fieldset>
    </form>
    <button type="button" (click)="write()">External write</button>
    <button type="button" (click)="reset('new')">Reset document</button>
    <button type="button" (click)="reset('same')">Reset same value</button>
    <button type="button" (click)="reset('empty')">Reset empty</button>
    <button type="button" (click)="unavailable.set(!unavailable())">
      Toggle disabled
    </button>
    <button type="button" (click)="readOnly.set(!readOnly())">
      Toggle readonly
    </button>
    <button type="button" (click)="reviewRound.set(reviewRound() + 1)">
      Start validation
    </button>
    <button type="button" (click)="work.finishReview(false)">
      Accept validation
    </button>
    <button type="button" (click)="work.finishReview(true)">
      Reject validation
    </button>
    <button type="button" (click)="work.finishSubmission(true)">
      Complete submission
    </button>
    <button type="button" (click)="work.finishSubmission(false)">
      Reject submission
    </button>
    <button type="button" (click)="save()">Capture snapshot</button>
    <button type="button" (click)="editor()?.focus()">Focus editor</button>
    <dl
      data-testid="form-state"
      [attr.data-disabled]="fields.body().disabled()"
      [attr.data-readonly]="fields.body().readonly()"
      [attr.data-dirty]="fields.body().dirty()"
      [attr.data-touched]="fields.body().touched()"
      [attr.data-pending]="fields.body().pending()"
      [attr.data-invalid]="fields.body().invalid()"
      [attr.data-submitting]="fields().submitting()"
    >
      <dt>Ready</dt>
      <dd data-testid="ready-count">{{ readyCount() }}</dd>
      <dt>Changes</dt>
      <dd data-testid="changes">{{ changes() }}</dd>
      <dt>Touches</dt>
      <dd data-testid="touches">{{ touches() }}</dd>
      <dt>Value</dt>
      <dd data-testid="value">{{ model().body | json }}</dd>
      <dt>Errors</dt>
      <dd data-testid="errors">{{ fields.body().errors() | json }}</dd>
      <dt>Operation</dt>
      <dd data-testid="result">{{ result() }}</dd>
      <dt>Snapshot</dt>
      <dd data-testid="captured">{{ captured() | json }}</dd>
      <dt>Submissions</dt>
      <dd data-testid="submissions">{{ submissions() }}</dd>
    </dl>
  `,
  styles: `
    aa-editorjs-control {
      min-height: 8rem;
    }
  `,
})
export class FormsEditor {
  readonly owner =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.getAttribute(
      'data-owner',
    ) ?? 'A';
  readonly state = inject(RequestState);
  readonly lifetime = inject(LifetimeWork);
  readonly work = inject(FormsWork);
  readonly ready = signal(false);
  readonly readyCount = signal(0);
  readonly changes = signal(0);
  readonly touches = signal(0);
  readonly submissions = signal(0);
  readonly result = signal('');
  readonly captured = signal<OutputData | undefined>(undefined);
  readonly unavailable = signal(this.state.initial.disabled);
  readonly readOnly = signal(this.state.initial.readonly);
  readonly reviewRound = signal(0);
  readonly model = signal({
    body: structuredClone(this.state.initial.document),
    note: 'synthetic-private-note',
  });
  readonly config = { minHeight: 80 };
  readonly editor = viewChild(EditorJsControl);
  readonly #injector = inject(Injector);
  readonly fields = form(
    this.model,
    (path) => {
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
            // Validation metadata has its own injection context. The host owns this work.
            injector: this.#injector,
            params,
            loader: async ({ abortSignal }) => {
              this.lifetime.record('validation-start');
              abortSignal.addEventListener(
                'abort',
                () => this.lifetime.record('validation-aborted'),
                { once: true },
              );
              const error = await this.work.review(abortSignal);
              this.lifetime.record('validation-settled');
              return error;
            },
          }),
        onSuccess: (error) => error,
        onError: () => ({
          kind: 'review-service',
          message: 'Review unavailable.',
        }),
      });
    },
    // Stable across server requests, distinct for simultaneous native forms.
    { name: `editor-fixture-${this.owner}` },
  );
  #destroyed = false;
  // Fence host-owned asynchronous results; native Forms and the editor retain their own state.
  #epoch = 0;
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#destroyed = true;
      this.#epoch++;
      this.work.finishSubmission(false);
      this.lifetime.record('owner-destroyed');
    });
  }
  onReady(): void {
    this.ready.set(true);
    this.readyCount.update((n) => n + 1);
    this.lifetime.record('output-ready');
  }
  output(kind: 'change' | 'touch'): void {
    (kind === 'change' ? this.changes : this.touches).update((n) => n + 1);
    this.lifetime.record(`output-${kind}`);
  }
  onError(event: EditorJsErrorEvent): void {
    this.result.set(event.code);
    this.lifetime.record(`output-error-${event.code}`);
  }
  write(): void {
    this.#epoch++;
    this.model.update((value) => ({
      ...value,
      body: document('External replacement'),
    }));
  }
  reset(mode: 'new' | 'same' | 'empty'): void {
    this.#epoch++;
    this.reviewRound.set(0);
    this.fields().reset({
      ...this.model(),
      body:
        mode === 'same'
          ? this.model().body
          : mode === 'empty'
            ? { blocks: [] }
            : document('Native reset'),
    });
    this.captured.set(undefined);
    this.result.set('Reset');
  }
  async save(): Promise<void> {
    const epoch = this.#epoch;
    try {
      const snapshot = await this.editor()!.save();
      if (this.#destroyed || epoch !== this.#epoch) return;
      this.captured.set(snapshot);
      this.result.set('Captured');
    } catch {
      if (!this.#destroyed && epoch === this.#epoch)
        this.result.set('Capture rejected');
    }
  }
  async persist(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.ready() || this.fields().submitting()) return;
    const epoch = this.#epoch;
    const current = () => !this.#destroyed && epoch === this.#epoch;
    try {
      await submit(this.fields, {
        ignoreValidators: 'none',
        action: async () => {
          const snapshot = await this.editor()!.save();
          if (!current()) return;
          const error = contentError(snapshot);
          if (error) return { ...error, fieldTree: this.fields.body };
          this.captured.set(snapshot);
          this.submissions.update((n) => n + 1);
          this.lifetime.record('submission-start');
          this.result.set('Submitting');
          const success = await this.work.persist();
          if (!current()) return;
          this.result.set(success ? 'Submitted' : 'Submission rejected');
          if (!success)
            return {
              kind: 'server',
              message: 'Save failed.',
              fieldTree: this.fields.body,
            };
          return undefined;
        },
      });
    } catch {
      if (current()) this.result.set('Capture rejected');
    }
  }
}
