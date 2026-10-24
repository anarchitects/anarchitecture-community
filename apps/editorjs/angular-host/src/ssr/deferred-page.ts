import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EDITOR_JS_LOADER } from '@anarchitects/editorjs-angular';
import { RequestState } from './request-state';
import { observedLoader } from './observed-loader';
import { StandaloneEditor } from './standalone-editor';

@Component({
  selector: 'aa-deferred-page',
  imports: [StandaloneEditor],
  providers: [
    RequestState,
    { provide: EDITOR_JS_LOADER, useFactory: observedLoader },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Deferred authoring</h1>
    <p data-testid="marker">{{ state.initial.marker }}</p>
    @if (incremental) {
      @defer (on interaction; hydrate on interaction) {
        <section>
          <button type="button" (click)="activated = true">
            Activate editor
          </button>
          <p data-testid="activated">{{ activated }}</p>
          <aa-standalone-editor
            data-owner="A"
            [initial]="state.initial.document"
            [initialReadOnly]="state.initial.readonly"
          />
        </section>
      } @placeholder {
        <button type="button">Activate editor</button>
      } @loading {
        <p data-testid="loading">Loading editor view</p>
      } @error {
        <p role="alert">
          Editor view failed. Navigate away and return to retry.
        </p>
      }
    } @else {
      <button #activate type="button" [disabled]="!rendered()">
        Activate editor
      </button>
      @defer (on interaction(activate)) {
        <aa-standalone-editor
          data-owner="A"
          [initial]="state.initial.document"
          [initialReadOnly]="state.initial.readonly"
        />
      } @placeholder {
        <p data-testid="placeholder">Activate to edit this document</p>
      } @loading {
        <p data-testid="loading">Loading editor view</p>
      } @error {
        <p role="alert">
          Editor view failed. Navigate away and return to retry.
        </p>
      }
    }
  `,
})
export class DeferredPage {
  readonly rendered = signal(false);
  readonly state = inject(RequestState);
  readonly incremental =
    inject(ActivatedRoute).snapshot.data['incremental'] === true;
  activated = false;

  constructor() {
    // Shell rendering does not establish that this lazy route's listeners exist.
    afterNextRender(() => this.rendered.set(true));
  }
}
