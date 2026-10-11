import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormField, form, type FormValueControl } from '@angular/forms/signals';
import {
  EditorJsControl,
  type EditorJsControlConfig,
} from '@anarchitects/editorjs-angular/forms';
import type {
  EditorJsChangeEvent,
  EditorJsErrorEvent,
  OutputData,
} from '@anarchitects/editorjs-core';

export function valueContract(
  control: EditorJsControl,
): FormValueControl<OutputData> {
  control.focus({ preventScroll: true });
  control.disabled();
  control.readonly();
  control.invalid();
  control.pending();
  control.touched();
  control.dirty();
  control.required();
  control.errors();
  control.name();
  control.touch.subscribe(() => undefined);
  return control;
}
export const config: EditorJsControlConfig = { placeholder: 'Write' };
const foreignReadOnly = { readOnly: true };
// @ts-expect-error availability is reserved for the Forms adapter
export const rejectedReadOnly: EditorJsControlConfig = foreignReadOnly;
// @ts-expect-error document ownership belongs to the value model
export const rejectedData: EditorJsControlConfig = { data: { blocks: [] } };
// @ts-expect-error holder belongs to the composed standalone editor
export const rejectedHolder: EditorJsControlConfig = { holder: 'other' };
// @ts-expect-error value controls do not support nullable documents
export const rejectedValue: ReturnType<EditorJsControl['value']> = null;

@Component({
  selector: 'aa-forms-consumer',
  imports: [EditorJsControl, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aa-editorjs-control
      [formField]="fields.body"
      [config]="config"
      aria-label="Article"
      aria-describedby="article-errors"
      (touch)="onReady($event)"
      (ready)="onReady($event)"
      (change)="onChange($event)"
      (error)="onError($event)"
    />
  `,
})
export class FormsConsumer {
  readonly model = signal<{ body: OutputData }>({ body: { blocks: [] } });
  readonly fields = form(this.model);
  readonly config = config;
  onReady(event: void): void {
    void event;
  }
  onChange(event: EditorJsChangeEvent): void {
    void event;
  }
  onError(event: EditorJsErrorEvent): void {
    void event;
  }
}
