import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { EDITOR_JS_LOADER } from '@anarchitects/editorjs-angular';
import { RequestState } from './request-state';
import { observedLoader } from './observed-loader';
import { StandaloneEditor } from './standalone-editor';

@Component({
  selector: 'aa-standalone-page',
  imports: [StandaloneEditor],
  providers: [
    RequestState,
    { provide: EDITOR_JS_LOADER, useFactory: observedLoader },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Standalone authoring</h1>
    <p data-testid="marker">{{ state.initial.marker }}</p>
    <button type="button" (click)="mounted.set(!mounted())">Toggle A</button>
    <button type="button" (click)="second.set(!second())">Toggle B</button>
    @if (mounted()) {
      <aa-standalone-editor
        data-owner="A"
        label="A"
        [initial]="state.initial.document"
        [initialReadOnly]="state.initial.readonly"
      />
    }
    @if (second()) {
      <aa-standalone-editor
        data-owner="B"
        label="B"
        [initial]="secondDocument"
      />
    }
  `,
})
export class StandalonePage {
  readonly state = inject(RequestState);
  readonly mounted = signal(true);
  readonly second = signal(false);
  readonly secondDocument = {
    blocks: [{ type: 'paragraph', data: { text: 'B initial' } }],
  };
}
