import { JsonPipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  resource,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import {
  FormField,
  disabled,
  form,
  readonly,
  required,
  submit,
  validate,
  validateAsync,
} from '@angular/forms/signals';
import {
  createEditorJsUploadOwner,
  EDITOR_JS_LOADER,
} from '@anarchitects/editorjs-angular';
import {
  EditorJsControl,
  type EditorJsControlConfig,
} from '@anarchitects/editorjs-angular/forms';
import {
  composeToolRegistry,
  createToolResolver,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  type OutputData,
} from '@anarchitects/editorjs-core';
import { defineImageTool } from '@anarchitects/editorjs-tool-image';
import { UPLOAD_BACKEND } from './backend';
import { controlledFormsLoader, FormsWork } from '../app/forms-work';

const initial = (): OutputData => ({
  blocks: [
    {
      type: 'image',
      data: {
        caption: 'Visible caption',
        withBorder: false,
        withBackground: false,
        stretched: false,
      },
    },
  ],
});

@Component({
  selector: 'aa-forms-upload-editor',
  imports: [EditorJsControl, FormField, JsonPipe],
  providers: [
    { provide: FormsWork, useFactory: () => new FormsWork() },
    { provide: EDITOR_JS_LOADER, useFactory: controlledFormsLoader },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [attr.aria-label]="label()" [attr.aria-busy]="owner.busy()">
      <h2>{{ label() }}</h2>
      <p role="status" data-testid="ready">
        {{ ready() ? 'ready' : 'waiting' }}
      </p>
      <p role="status">
        Uploads: <span data-testid="active">{{ owner.activeCount() }}</span>
      </p>
      <!-- No native form: click/Enter cannot navigate before hydration. -->
      <div #surface [inert]="locked()" [attr.inert]="locked() ? '' : null">
        <label>Title <input [formField]="fields.title" /></label>
        @if (config(); as configured) {
          <aa-editorjs-control
            aria-label="Article body"
            [formField]="fields.body"
            [config]="configured"
            (ready)="ready.set(true)"
            (error)="editorError.set($event.operation + ': ' + $event.code)"
          />
        }
        <button
          type="button"
          [disabled]="!ready() || unavailable() || readOnly()"
          (click)="uploadUrl()"
        >
          Upload URL
        </button>
      </div>
      <button
        type="button"
        [disabled]="
          !ready() ||
          locked() ||
          owner.busy() ||
          owner.hasErrors() ||
          unavailable() ||
          readOnly()
        "
        (click)="persist()"
      >
        Submit
      </button>
      <button type="button" (click)="persist()">Programmatic submit</button>
      <button type="button" (click)="overflowFailures()">
        Fill failure history
      </button>
      <button type="button" (click)="reset(false)">Reset</button>
      <button type="button" (click)="reset(true)">Reset same value</button>
      <button type="button" (click)="unavailable.set(!unavailable())">
        Toggle disabled
      </button>
      <button type="button" (click)="readOnly.set(!readOnly())">
        Toggle readonly
      </button>
      <button type="button" (click)="reviewRound.update(increment)">
        Start validation
      </button>
      <button type="button" (click)="work.finishReview(false)">
        Accept validation
      </button>
      <button type="button" (click)="work.armed.set(true)">
        Hold snapshot
      </button>
      <button type="button" (click)="work.release()">Release snapshot</button>
      <button type="button" (click)="work.failNext = true">
        Fail snapshot
      </button>
      <button type="button" (click)="work.finishSubmission(true)">
        Accept submission
      </button>
      <button type="button" (click)="work.finishSubmission(false)">
        Reject submission
      </button>
      @for (operation of owner.operations(); track operation.id) {
        <div data-testid="operation">
          {{ operation.kind }} {{ operation.status }} attempts={{
            operation.attempts
          }}
          @if (operation.status !== 'active') {
            <button type="button" (click)="owner.acknowledge(operation.id)">
              Acknowledge
            </button>
          }
        </div>
      }
      @if (owner.overflow(); as overflow) {
        <button type="button" (click)="owner.acknowledge(overflow.id)">
          Acknowledge overflow
        </button>
      }
      @for (error of fields().errorSummary(); track $index) {
        <p role="alert">{{ error.kind }}: {{ error.message }}</p>
      }
      <p data-testid="flags">
        dirty={{ fields.body().dirty() }} touched={{
          fields.body().touched()
        }}
        pending={{ fields().pending() }} submitting={{
          fields().submitting()
        }}
        locked={{ locked() }}
      </p>
      <p data-testid="result">{{ result() }}</p>
      <p data-testid="editor-error">{{ editorError() }}</p>
      <p data-testid="persist-count">{{ persistCount() }}</p>
      <p data-testid="snapshot-held">{{ work.held() }}</p>
      <pre data-testid="saved">{{ saved() | json }}</pre>
    </section>
  `,
})
export class FormsUploadEditor implements OnInit {
  readonly label = input('A');
  readonly document = input<OutputData>();
  readonly replacement = output<OutputData>();
  readonly backend = inject(UPLOAD_BACKEND);
  readonly destroyRef = inject(DestroyRef);
  readonly work = inject(FormsWork);
  readonly locked = signal(false);
  readonly unavailable = signal(false);
  readonly readOnly = signal(false);
  readonly owner = createEditorJsUploadOwner(this.backend.uploader, {
    destroyRef: this.destroyRef,
    mapError: () => 'Upload could not be completed.',
    retry: {
      maxAttempts: 2,
      replaySafe: true,
      delayMs: 20,
      shouldRetry: (outcome) =>
        outcome.kind === 'failure' &&
        outcome.response.error?.code === 'retryable',
      schedule: (resume, delay) => {
        const timer = setTimeout(resume, delay);
        return () => clearTimeout(timer);
      },
    },
  });
  readonly model = signal({ title: 'Article', body: initial() });
  readonly reviewRound = signal(0);
  readonly fields = form(this.model, (path) => {
    required(path.title);
    disabled(path.body, () => this.unavailable());
    readonly(path.body, () => this.readOnly());
    validate(path.body, () => [
      ...(this.owner.busy()
        ? [
            {
              kind: 'upload-busy',
              message: 'Wait for uploads before submitting.',
            },
          ]
        : []),
      ...this.owner
        .operations()
        .filter((op) => op.status !== 'active')
        .map((op) => ({ kind: 'upload-failed', message: op.message })),
      ...(this.owner.overflow()
        ? [
            {
              kind: 'upload-failed',
              message:
                'Additional uploads failed. Review before acknowledging.',
            },
          ]
        : []),
    ]);
    validateAsync(path.body, {
      // Validation keys describe content; save() produces a new capture time.
      params: ({ value }) =>
        this.reviewRound()
          ? JSON.stringify([this.reviewRound(), value().blocks])
          : undefined,
      factory: (params) =>
        resource({
          params,
          loader: ({ abortSignal }) => this.work.review(abortSignal),
        }),
      onSuccess: (error) => error,
      onError: () => ({ kind: 'review', message: 'Review unavailable.' }),
    });
  });
  readonly config = signal<EditorJsControlConfig | undefined>(undefined);
  readonly ready = signal(false);
  readonly editorError = signal('');
  readonly result = signal('');
  readonly saved = signal<OutputData | undefined>(undefined);
  readonly persistCount = signal(0);
  readonly increment = (n: number) => n + 1;
  private readonly editor = viewChild(EditorJsControl);
  private readonly surface = viewChild<ElementRef<HTMLElement>>('surface');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  ngOnInit() {
    const body = this.document();
    if (body) this.fields().reset({ title: 'Article', body });
  }
  constructor() {
    // Gate immediately, before Angular updates inert/Forms-owned inputs.
    const allowed = () =>
      !this.locked() &&
      !this.unavailable() &&
      !this.readOnly() &&
      !this.owner.disposed();
    const resolver = createToolResolver(
      composeToolRegistry(
        [
          [
            defineImageTool({
              source: 'lazy',
              load: () =>
                import('../image/observed').then((m) => m.ObservedImage),
              settings: {
                config: {
                  uploader: {
                    uploadByFile: (file: Blob) =>
                      allowed()
                        ? this.owner.uploader.uploadByFile(file)
                        : Promise.resolve({ success: 0 as const }),
                    uploadByUrl: (url: string) =>
                      allowed()
                        ? this.owner.uploader.uploadByUrl(url)
                        : Promise.resolve({ success: 0 as const }),
                  },
                },
              },
            }),
          ],
        ],
        { profile: EDITOR_JS_2_31_7_TOOL_PROFILE },
      ),
    );
    this.destroyRef.onDestroy(() => {
      resolver.dispose();
      this.work.release();
      this.work.finishReview(false);
      this.work.finishSubmission(false);
    });
    afterNextRender(() => {
      void resolver
        .resolve()
        .then((tools) => {
          if (!this.destroyRef.destroyed)
            this.config.set({ tools, defaultBlock: 'image', minHeight: 80 });
        })
        .catch(() => {
          if (!this.destroyRef.destroyed) this.editorError.set('tool-loading');
        });
      const surface = this.surface()?.nativeElement;
      const gate = (event: Event) => {
        if (!this.locked()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      const events = [
        'pointerdown',
        'pointerup',
        'mouseup',
        'touchstart',
        'dblclick',
        'keyup',
        'mousedown',
        'click',
        'keydown',
        'beforeinput',
        'input',
        'paste',
        'cut',
        'drop',
      ];
      for (const name of events) surface?.addEventListener(name, gate, true);
      this.destroyRef.onDestroy(() => {
        for (const name of events)
          surface?.removeEventListener(name, gate, true);
      });
    });
  }
  async overflowFailures() {
    await Promise.all(
      Array.from({ length: 101 }, () =>
        this.owner.uploader.uploadByUrl('fixture'),
      ),
    );
  }
  async uploadUrl() {
    if (!this.ready() || this.locked() || this.unavailable() || this.readOnly())
      return;
    const { pasteInto } = await import('../image/observed');
    const { asset } = await import('../image/definition');
    if (
      this.destroyRef.destroyed ||
      this.locked() ||
      this.unavailable() ||
      this.readOnly()
    )
      return;
    await pasteInto(
      this.host.nativeElement,
      new CustomEvent('pattern', { detail: { key: 'image', data: asset } }),
    );
  }
  reset(same: boolean) {
    const body = same ? this.model().body : initial();
    this.ready.set(false);
    this.locked.set(true);
    this.editor()?.reset();
    // DestroyRef disposes uploads after the old child editor/tool is removed.
    this.fields().reset({ title: 'Article', body });
    this.replacement.emit(body); // Parent destroys this component and its tool generation.
  }
  async persist() {
    const editor = this.editor();
    if (
      !editor ||
      !this.ready() ||
      this.destroyRef.destroyed ||
      this.locked() ||
      this.unavailable() ||
      this.readOnly() ||
      this.owner.disposed()
    )
      return;
    if (this.owner.busy() || this.owner.hasErrors()) {
      this.result.set('Uploads block submission');
      return;
    }
    this.locked.set(true);
    const generation = this.owner.generation();
    const current = () =>
      this.ready() &&
      !this.destroyRef.destroyed &&
      !this.owner.disposed() &&
      this.owner.generation() === generation &&
      !this.owner.busy() &&
      !this.owner.hasErrors() &&
      !this.unavailable() &&
      !this.readOnly();
    try {
      const snapshot = await editor.save();
      if (!current()) return;
      this.model.update((value) => ({ ...value, body: snapshot }));
      const accepted = await submit(this.fields, {
        ignoreValidators: 'none',
        action: async () => {
          if (!current())
            return { kind: 'superseded', message: 'Document changed.' };
          this.persistCount.update(this.increment);
          this.saved.set(snapshot);
          const success = await this.work.persist();
          if (!current()) return undefined;
          return success
            ? undefined
            : {
                kind: 'server',
                message: 'Save failed. Try again.',
                fieldTree: this.fields.title,
              };
        },
      });
      if (current())
        this.result.set(accepted ? 'Submitted' : 'Submission blocked');
    } catch {
      if (current()) this.result.set('Snapshot failed');
    } finally {
      this.locked.set(false);
    }
  }
}
