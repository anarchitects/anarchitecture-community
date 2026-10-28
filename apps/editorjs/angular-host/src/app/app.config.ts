import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideEditorJsTools } from '@anarchitects/editorjs-angular';
import { paragraphDefinition } from '../paragraph/definition';
import { quoteDefinition } from '../quote/definition';
import { listDefinition } from '../list/definition';
import { headerDefinition } from '../header/definition';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideEditorJsTools({
      factory: () =>
        new URLSearchParams(location.search).has('quote')
          ? [quoteDefinition]
          : [],
    }),
    provideEditorJsTools({
      factory: () =>
        new URLSearchParams(location.search).has('list')
          ? [listDefinition]
          : [],
    }),
    provideEditorJsTools({
      factory: () =>
        new URLSearchParams(location.search).has('header')
          ? [headerDefinition]
          : [],
    }),
    provideEditorJsTools({
      factory: () =>
        new URLSearchParams(location.search).has('paragraph')
          ? [paragraphDefinition]
          : [],
    }),
  ],
};
