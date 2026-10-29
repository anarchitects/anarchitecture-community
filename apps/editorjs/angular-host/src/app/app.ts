import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EDITOR_JS_LOADER } from '@anarchitects/editorjs-angular';
import { FormsCard } from './forms-card';
import { EditorCard } from './editor-card';
import { observedLoader, Ownership } from './ownership';
import { UploadPage } from '../upload/upload-page';

@Component({
  selector: 'aa-root',
  imports: [EditorCard, FormsCard, UploadPage],
  providers: [{ provide: EDITOR_JS_LOADER, useFactory: observedLoader }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly uploadMode =
    new URLSearchParams(location.search).has('upload') ||
    new URLSearchParams(location.search).has('forms-upload');
  readonly uploadForms = new URLSearchParams(location.search).has(
    'forms-upload',
  );
  readonly formsMode = new URLSearchParams(location.search).has('forms');
  readonly ownership = inject(Ownership);
}
