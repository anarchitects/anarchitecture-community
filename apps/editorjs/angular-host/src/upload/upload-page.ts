import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import type { OutputData } from '@anarchitects/editorjs-core';
import { FormsUploadEditor } from './forms-upload-editor';
import { UploadEditor } from './upload-editor';
import { createBackend, UPLOAD_BACKEND } from './backend';
import { UPLOAD_REQUEST_MARKER } from './request-marker';

@Component({
  selector: 'aa-upload-page',
  imports: [UploadEditor, FormsUploadEditor],
  providers: [{ provide: UPLOAD_BACKEND, useFactory: createBackend }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Independent uploads</h1>
    <p data-testid="marker">{{ requestMarker }}</p>
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
        @if (forms()) {
          <aa-forms-upload-editor
            data-owner="A"
            label="A"
            [document]="documentA()"
            (replacement)="documentA.set($event); revision.update(increment)"
          />
        } @else {
          <aa-upload-editor data-owner="A" label="A" />
        }
      }
    }
    @if (forms()) {
      @for (generation of [revisionB()]; track generation) {
        <aa-forms-upload-editor
          data-owner="B"
          label="B"
          [document]="documentB()"
          (replacement)="documentB.set($event); revisionB.update(increment)"
        />
      }
    } @else {
      <aa-upload-editor data-owner="B" label="B" />
    }
  `,
})
export class UploadPage {
  readonly requestMarker =
    inject(UPLOAD_REQUEST_MARKER, { optional: true })?.() ?? 'public-default';
  readonly forms = input(false);
  readonly documentA = signal<OutputData | undefined>(undefined);
  readonly documentB = signal<OutputData | undefined>(undefined);
  readonly revisionB = signal(0);
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
