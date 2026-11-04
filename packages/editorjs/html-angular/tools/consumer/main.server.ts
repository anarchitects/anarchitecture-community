import { provideEditorJsHtml } from '@anarchitects/editorjs-html-angular';
import {
  bootstrapApplication,
  provideClientHydration,
  type BootstrapContext,
} from '@angular/platform-browser';
import { provideServerRendering, withRoutes, RenderMode } from '@angular/ssr';
import { routes, Shell } from './app';
import { provideRouter } from '@angular/router';
export default (context: BootstrapContext) =>
  bootstrapApplication(
    Shell,
    {
      providers: [
        provideClientHydration(),
        provideRouter(routes),
        provideEditorJsHtml({ classes: { paragraph: ['application'] } }),
        provideServerRendering(
          withRoutes([{ path: '**', renderMode: RenderMode.Server }]),
        ),
      ],
    },
    context,
  );
