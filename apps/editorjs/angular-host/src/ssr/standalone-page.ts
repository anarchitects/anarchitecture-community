import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { EDITOR_JS_LOADER, EditorJs } from '@anarchitects/editorjs-angular';
import { RequestState } from './request-state';
import { observedLoader } from './observed-loader';

@Component({
  selector: 'aa-standalone-page',
  imports: [EditorJs],
  providers: [
    RequestState,
    { provide: EDITOR_JS_LOADER, useFactory: observedLoader },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Standalone authoring</h1>
    <p data-testid="marker">{{ state.initial.marker }}</p>
    <section aria-labelledby="editor-label" aria-describedby="editor-status">
      <h2 id="editor-label">Document</h2>
      <p id="editor-status" role="status">
        {{ ready() ? 'Editor ready' : 'Editor activates in the browser' }}
      </p>
      <aa-editorjs
        [data]="state.initial.document"
        [config]="config"
        (ready)="ready.set(true)"
      />
    </section>
  `,
  styles: `
    aa-editorjs {
      min-height: 8rem;
    }
  `,
})
export class StandalonePage {
  readonly state = inject(RequestState);
  readonly ready = signal(false);
  readonly config = { minHeight: 80, readOnly: this.state.initial.readonly };
}
