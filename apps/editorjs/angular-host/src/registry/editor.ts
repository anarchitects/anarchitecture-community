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
    <pre data-testid="registry-saved">{{ saved() | json }}</pre>
  `,
})
export class RegistryEditor {
  readonly label = input.required<string>();
  readonly data = computed(() => initialDocument(this.label()));
  readonly config = editorOptions;
  readonly ready = signal(0);
  readonly error = signal('');
  readonly saved = signal<OutputData | undefined>(undefined);
  readonly increment = (n: number) => n + 1;
  readonly editor = viewChild.required(EditorJs);
  onError(event: EditorJsErrorEvent) {
    this.error.set(`${event.operation}:${event.code}:${String(event.cause)}`);
  }
  async save() {
    this.saved.set(await this.editor().api.save());
  }
}
