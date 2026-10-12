import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { disabled, form, FormField, readonly } from '@angular/forms/signals';
import { EDITOR_JS_LOADER } from '@anarchitects/editorjs-angular';
import { EditorJsControl } from '@anarchitects/editorjs-angular/forms';
import { RequestState } from './request-state';
import { observedLoader } from './observed-loader';

@Component({
  selector: 'aa-forms-page',
  imports: [EditorJsControl, FormField],
  providers: [
    RequestState,
    { provide: EDITOR_JS_LOADER, useFactory: observedLoader },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Signal Forms authoring</h1>
    <p data-testid="marker">{{ state.initial.marker }}</p>
    <form
      method="post"
      action="/fixture-submit"
      (submit)="$event.preventDefault()"
    >
      <fieldset [disabled]="!ready()">
        <legend id="editor-label">Document</legend>
        <p id="editor-status" role="status">
          {{ ready() ? 'Editor ready' : 'Editor activates in the browser' }}
        </p>
        <aa-editorjs-control
          [formField]="fields.body"
          aria-labelledby="editor-label"
          aria-describedby="editor-status"
          (ready)="ready.set(true)"
        />
        <button type="submit">Submit fixture</button>
      </fieldset>
    </form>
    <dl
      data-testid="form-state"
      [attr.data-disabled]="fields.body().disabled()"
      [attr.data-readonly]="fields.body().readonly()"
      [attr.data-dirty]="fields.body().dirty()"
      [attr.data-touched]="fields.body().touched()"
      [attr.data-pending]="fields.body().pending()"
      [attr.data-submitting]="fields().submitting()"
    >
      <dt>Editing</dt>
      <dd>{{ ready() ? 'Ready' : 'Unavailable until browser activation' }}</dd>
    </dl>
  `,
  styles: `
    aa-editorjs-control {
      min-height: 8rem;
    }
  `,
})
export class FormsPage {
  readonly state = inject(RequestState);
  readonly ready = signal(false);
  readonly model = signal({
    body: structuredClone(this.state.initial.document),
  });
  readonly fields = form(this.model, (path) => {
    disabled(path.body, () => this.state.initial.disabled);
    readonly(path.body, () => this.state.initial.readonly);
  });
}
