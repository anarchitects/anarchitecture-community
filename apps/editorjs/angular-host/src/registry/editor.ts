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
  EDITOR_JS_LOADER,
  type EditorJsErrorEvent,
} from '@anarchitects/editorjs-angular';
import type { OutputData } from '@anarchitects/editorjs-core';
import { editorOptions, initialDocument } from './definitions';
import * as common from '../common/definitions';
import { probe } from './probe';

export function registryLoader() {
  const load = inject(EDITOR_JS_LOADER, { skipSelf: true });
  return async () => {
    const create = await load();
    return (options: Parameters<typeof create>[0]) => {
      const raw = create(options);
      probe().created++;
      return {
        isReady: raw.isReady,
        save: () => raw.save(),
        render: (data: OutputData) => raw.render(data),
        clear: () => raw.clear(),
        focus: (atEnd?: boolean) => raw.focus(atEnd),
        get readOnly() {
          return raw.readOnly;
        },
        destroy: () => {
          raw.destroy();
          probe().destroyed++;
        },
      };
    };
  };
}
@Component({
  selector: 'aa-registry-editor',
  imports: [EditorJs, JsonPipe],
  providers: [{ provide: EDITOR_JS_LOADER, useFactory: registryLoader }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aa-editorjs
      aria-label="Document editor"
      [config]="config"
      [data]="data()"
      (ready)="ready.update(increment)"
      (error)="onError($event)"
    />
    <p data-testid="registry-ready">{{ ready() }}</p>
    <p data-testid="registry-error">{{ error() }}</p>
    <button type="button" (click)="save()" [disabled]="!ready()">
      Save registry
    </button>
    @if (common()) {
      <button type="button" (click)="render()" [disabled]="!saved()">
        Render saved
      </button>
      <button type="button" (click)="toggleReadOnly()">Read only</button>
      @if (projection(); as image) {
        <img
          data-testid="rendered-image"
          [src]="image.url"
          [attr.alt]="image.alt"
        />
      }
    }
    <pre data-testid="registry-saved">{{ saved() | json }}</pre>
  `,
})
export class RegistryEditor {
  readonly label = input.required<string>();
  readonly common = input(false);
  readonly data = computed(() =>
    this.common()
      ? common.initialDocument(this.label())
      : initialDocument(this.label()),
  );
  readonly projection = computed(() => common.imageProjection(this.saved()));
  readonly config = editorOptions;
  readonly ready = signal(0);
  readonly error = signal('');
  readonly saved = signal<OutputData | undefined>(undefined);
  readonly increment = (n: number) => n + 1;
  readonly editor = viewChild.required(EditorJs);
  onError(event: EditorJsErrorEvent) {
    this.error.set(`${event.operation}:${event.code}:${String(event.cause)}`);
  }
  private readOnly = false;
  async toggleReadOnly() {
    this.readOnly = await this.editor().api.setReadOnly(!this.readOnly);
  }
  async render() {
    const data = this.saved();
    if (data) await this.editor().api.render(data);
  }
  async save() {
    const saved = await this.editor().api.save();
    if (this.common()) common.validate(saved);
    this.saved.set(saved);
  }
}
