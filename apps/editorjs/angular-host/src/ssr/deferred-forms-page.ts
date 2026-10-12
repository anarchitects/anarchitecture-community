import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EDITOR_JS_LOADER } from '@anarchitects/editorjs-angular';
import { RequestState } from './request-state';
import { observedLoader } from './observed-loader';
import { FormsEditor } from './forms-editor';

@Component({
  selector: 'aa-deferred-forms-page',
  imports: [FormsEditor],
  providers: [
    RequestState,
    { provide: EDITOR_JS_LOADER, useFactory: observedLoader },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Deferred Signal Forms authoring</h1>
    <p data-testid="marker">{{ state.initial.marker }}</p>
    @if (incremental) {
      @defer (on interaction; hydrate on interaction) {
        <section>
          <button type="button" (click)="activations = activations + 1">
            Activate form
          </button>
          <p data-testid="activations">{{ activations }}</p>
          <aa-forms-editor data-owner="A" />
        </section>
      } @placeholder {
        <button type="button">Activate form</button>
      } @loading {
        <p data-testid="loading">Loading form view</p>
      } @error {
        <p role="alert">Form view failed. Navigate away and return to retry.</p>
      }
    } @else {
      <button #activate type="button">Activate form</button>
      @defer (on interaction(activate)) {
        <aa-forms-editor data-owner="A" />
      } @placeholder {
        <p data-testid="placeholder">Activate to edit this document</p>
      } @loading {
        <p data-testid="loading">Loading form view</p>
      } @error {
        <p role="alert">Form view failed. Navigate away and return to retry.</p>
      }
    }
  `,
})
export class DeferredFormsPage {
  readonly state = inject(RequestState);
  readonly incremental =
    inject(ActivatedRoute).snapshot.data['incremental'] === true;
  activations = 0;
}
