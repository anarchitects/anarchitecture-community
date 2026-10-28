import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form, disabled, readonly } from '@angular/forms/signals';
import {
  EDITOR_JS_LOADER,
  EDITOR_JS_TOOL_REGISTRY,
} from '@anarchitects/editorjs-angular';
import { EditorJsControl } from '@anarchitects/editorjs-angular/forms';
import { initialDocument, editorOptions } from '../registry/definitions';
import { registryLoader } from '../registry/editor';
import type { OutputData } from '@anarchitects/editorjs-core';
import * as common from '../common/definitions';
import { COMMON_TOOLS, REGISTRY_FACTORY_LABEL } from '../registry/context';
import { RequestState } from './request-state';

@Component({
  selector: 'aa-registry-forms-page',
  imports: [EditorJsControl, FormField, JsonPipe],
  providers: [
    RequestState,
    { provide: EDITOR_JS_LOADER, useFactory: registryLoader },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p data-testid="registry-config-label">{{ configLabel }}</p>
    <h1>Registry Forms</h1>
    <p data-testid="marker">{{ state.initial.marker }}</p>
    <aa-editorjs-control
      [formField]="fields.body"
      [config]="config"
      aria-label="Registry body"
      (ready)="ready.set(true)"
    />
    <p data-testid="registry-ready">{{ ready() }}</p>
    <p data-testid="registry-dirty">{{ fields.body().dirty() }}</p>
    <p data-testid="registry-touched">{{ fields.body().touched() }}</p>
    <button type="button" (click)="save()" [disabled]="!ready()">
      Save registry
    </button>
    @if (commonTools) {
      <button type="button" (click)="readOnly.update(invert)">Read only</button>
      <button type="button" (click)="unavailable.update(invert)">
        Disable
      </button>
      <button type="button" (click)="reset()">Reset</button>
      <p data-testid="registry-disabled">{{ fields.body().disabled() }}</p>
      <p data-testid="registry-readonly">{{ fields.body().readonly() }}</p>
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
export class RegistryFormsPage {
  readonly registry = inject(EDITOR_JS_TOOL_REGISTRY);
  readonly configLabel = inject(REGISTRY_FACTORY_LABEL).value;
  readonly state = inject(RequestState);
  readonly commonTools = inject(COMMON_TOOLS);
  readonly readOnly = signal(false);
  readonly unavailable = signal(false);
  readonly invert = (value: boolean) => !value;
  readonly initial = () =>
    this.commonTools
      ? common.initialDocument(this.state.initial.marker)
      : initialDocument(this.state.initial.marker);
  readonly model = signal({ body: this.initial() });
  readonly fields = form(this.model, (path) => {
    disabled(path.body, () => this.unavailable());
    readonly(path.body, () => this.readOnly());
  });
  readonly config = editorOptions;
  readonly ready = signal(false);
  readonly saved = signal<OutputData | undefined>(undefined);
  readonly control = viewChild.required(EditorJsControl);
  readonly projection = computed(() => common.imageProjection(this.saved()));
  reset() {
    this.fields().reset({ body: this.initial() });
    this.saved.set(undefined);
  }
  async save() {
    const saved = await this.control().save();
    if (this.commonTools) common.validate(saved);
    this.saved.set(saved);
  }
}
