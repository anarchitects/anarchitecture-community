import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { EDITOR_JS_LOADER } from '@anarchitects/editorjs-angular';
import { RequestState } from './request-state';
import { observedLoader } from './observed-loader';
import { FormsEditor } from './forms-editor';

@Component({
  selector: 'aa-forms-page',
  imports: [FormsEditor],
  providers: [
    RequestState,
    { provide: EDITOR_JS_LOADER, useFactory: observedLoader },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Signal Forms authoring</h1>
    <p data-testid="marker">{{ state.initial.marker }}</p>
    <button type="button" (click)="showA.set(!showA())">Toggle A</button>
    <button type="button" (click)="showB.set(!showB())">Toggle B</button>
    @if (showA()) {
      <aa-forms-editor data-owner="A" />
    }
    @if (showB()) {
      <aa-forms-editor data-owner="B" />
    }
  `,
})
export class FormsPage {
  readonly state = inject(RequestState);
  readonly showA = signal(true);
  readonly showB = signal(false);
}
