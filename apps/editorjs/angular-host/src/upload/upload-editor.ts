import { JsonPipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  createEditorJsUploadOwner,
  EditorJs,
  type EditorJsConfig,
} from '@anarchitects/editorjs-angular';
import {
  composeToolRegistry,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  createToolResolver,
  type OutputData,
} from '@anarchitects/editorjs-core';
import { defineImageTool } from '@anarchitects/editorjs-tool-image';
import { UPLOAD_BACKEND } from './backend';

@Component({
  selector: 'aa-upload-editor',
  imports: [EditorJs, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [attr.aria-label]="label()" [attr.aria-busy]="owner.busy()">
      <h2>{{ label() }}</h2>
      <p role="status" data-testid="ready">
        {{ ready() ? 'ready' : 'waiting' }}
      </p>
      <p role="status">
        Active: <span data-testid="active">{{ owner.activeCount() }}</span>
      </p>
      @if (config(); as configured) {
        <aa-editorjs
          [config]="configured"
          [data]="initial"
          (ready)="ready.set(true)"
          (error)="editorError.set($event.code)"
        />
      }
      <button type="button" [disabled]="!ready()" (click)="uploadUrl()">
        Upload URL
      </button>
      <button type="button" [disabled]="!ready()" (click)="save()">Save</button>
      @for (operation of owner.operations(); track operation.id) {
        <div data-testid="operation">
          {{ operation.kind }} {{ operation.status }} attempts={{
            operation.attempts
          }}
          @if (operation.status !== 'active') {
            <p role="alert">{{ operation.message }}</p>
            <button type="button" (click)="owner.acknowledge(operation.id)">
              Acknowledge
            </button>
          }
        </div>
      }
      <p data-testid="editor-error">{{ editorError() }}</p>
      <pre data-testid="saved">{{ saved() | json }}</pre>
    </section>
  `,
})
export class UploadEditor {
  readonly label = input('A');
  readonly backend = inject(UPLOAD_BACKEND);
  readonly destroyRef = inject(DestroyRef);
  readonly owner = createEditorJsUploadOwner(this.backend.uploader, {
    destroyRef: this.destroyRef,
    mapError: () => 'Upload could not be completed.',
    // This controlled backend has no side effects. Production ports need their own replay guarantee.
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
  readonly initial: OutputData = {
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
  };
  readonly ready = signal(false);
  readonly config = signal<EditorJsConfig | undefined>(undefined);
  readonly saved = signal<OutputData | undefined>(undefined);
  readonly editorError = signal('');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly editor = viewChild(EditorJs);

  constructor() {
    // The registry is per editor. Its explicit complete map overrides a deliberately unusable parent definition.
    const resolver = createToolResolver(
      composeToolRegistry(
        [
          [
            defineImageTool({
              source: 'lazy',
              load: () =>
                import('../image/observed').then(
                  (module) => module.ObservedImage,
                ),
              settings: { config: { uploader: this.owner.uploader } },
            }),
          ],
        ],
        { profile: EDITOR_JS_2_31_7_TOOL_PROFILE },
      ),
    );
    this.destroyRef.onDestroy(() => resolver.dispose());
    // Resolve tools only after the browser renders; SSR imports remain inert.
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
    });
  }
  async uploadUrl() {
    const { pasteInto } = await import('../image/observed');
    const { asset } = await import('../image/definition');
    if (this.destroyRef.destroyed) return;
    await pasteInto(
      this.host.nativeElement,
      new CustomEvent('pattern', { detail: { key: 'image', data: asset } }),
    );
  }
  async save() {
    const data = await this.editor()?.api.save();
    if (!this.destroyRef.destroyed) this.saved.set(data);
  }
}
