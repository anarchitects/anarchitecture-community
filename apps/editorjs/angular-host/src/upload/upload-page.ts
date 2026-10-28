import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { UploadEditor } from './upload-editor';
import { createBackend, UPLOAD_BACKEND } from './backend';

@Component({
  selector: 'aa-upload-page',
  imports: [UploadEditor],
  providers: [{ provide: UPLOAD_BACKEND, useFactory: createBackend }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Independent uploads</h1>
    <label
      >Next outcome
      <select #outcome (change)="backend.mode.set(outcome.value)">
        @for (mode of modes; track mode) {
          <option [value]="mode">{{ mode }}</option>
        }
      </select>
    </label>
    <button type="button" (click)="backend.release()">Release uploads</button>
    <button type="button" (click)="mounted.set(!mounted())">Toggle A</button>
    <button type="button" (click)="revision.update(increment)">
      Replace A with same document
    </button>
    <span data-testid="backend-calls">{{ backend.calls() }}</span>
    <span data-testid="backend-completed">{{ backend.completed() }}</span>
    @if (mounted()) {
      @for (generation of [revision()]; track generation) {
        <aa-upload-editor data-owner="A" label="A" />
      }
    }
    <aa-upload-editor data-owner="B" label="B" />
  `,
})
export class UploadPage {
  readonly backend = inject(UPLOAD_BACKEND);
  readonly modes = [
    'held-success',
    'held-failure',
    'held-exception',
    'success',
    'failure',
    'exception',
    'retry',
  ];
  readonly mounted = signal(true);
  readonly revision = signal(0);
  readonly increment = (value: number) => value + 1;
}
