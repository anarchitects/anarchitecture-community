import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  EDITOR_JS_LOADER,
  EDITOR_JS_TOOL_REGISTRY,
} from '@anarchitects/editorjs-angular';
import { EditorJsControl } from '@anarchitects/editorjs-angular/forms';
import { initialDocument, editorOptions } from '../registry/definitions';
import { registryLoader } from '../registry/editor';
import { REGISTRY_FACTORY_LABEL } from '../registry/context';
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
    <pre data-testid="registry-saved">{{ saved() | json }}</pre>
  `,
})
export class RegistryFormsPage {
  readonly registry = inject(EDITOR_JS_TOOL_REGISTRY);
  readonly configLabel = inject(REGISTRY_FACTORY_LABEL).value;
  readonly state = inject(RequestState);
  readonly model = signal({ body: initialDocument(this.state.initial.marker) });
  readonly fields = form(this.model);
  readonly config = editorOptions;
  readonly ready = signal(false);
  readonly saved = signal<unknown>(undefined);
  readonly control = viewChild.required(EditorJsControl);
  async save() {
    this.saved.set(await this.control().save());
  }
}
