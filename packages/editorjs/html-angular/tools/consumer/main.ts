import { provideEditorJsHtml } from '@anarchitects/editorjs-html-angular';
import {
  bootstrapApplication,
  provideClientHydration,
} from '@angular/platform-browser';
import { routes, Shell } from './app';
import { provideRouter } from '@angular/router';
bootstrapApplication(Shell, {
  providers: [
    provideClientHydration(),
    provideRouter(routes),
    provideEditorJsHtml({ classes: { paragraph: ['application'] } }),
  ],
}).catch(console.error);
