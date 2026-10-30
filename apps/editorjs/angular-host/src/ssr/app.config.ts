import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { hydration } from './hydration';
import {
  provideRouter,
  Routes,
  withComponentInputBinding,
} from '@angular/router';
import { provideEditorJsTools } from '@anarchitects/editorjs-angular';
import { RequestState } from './request-state';
import { UPLOAD_REQUEST_MARKER } from '../upload/request-marker';

const routes: Routes = [
  {
    path: 'forms-upload',
    data: { forms: true },
    loadComponent: () =>
      import('../upload/upload-page').then((m) => m.UploadPage),
  },
  {
    path: 'upload',
    data: { forms: false },
    providers: [
      provideEditorJsTools([
        {
          name: 'image',
          kind: 'block',
          source: 'lazy',
          load: async () => {
            throw new Error(
              'Explicit tools must override this shared definition',
            );
          },
        },
      ]),
    ],
    loadComponent: () =>
      import('../upload/upload-page').then((m) => m.UploadPage),
  },
  {
    path: 'tools',
    loadChildren: () => import('./registry-routes').then((m) => m.routes),
  },
  {
    path: 'registry',
    loadChildren: () => import('./registry-routes').then((m) => m.routes),
  },
  {
    path: 'forms-deferred',
    loadComponent: () =>
      import('./deferred-forms-page').then((m) => m.DeferredFormsPage),
  },
  {
    path: 'forms-incremental',
    data: { incremental: true },
    loadComponent: () =>
      import('./deferred-forms-page').then((m) => m.DeferredFormsPage),
  },
  {
    path: 'deferred',
    loadComponent: () => import('./deferred-page').then((m) => m.DeferredPage),
  },
  {
    path: 'incremental',
    data: { incremental: true },
    loadComponent: () => import('./deferred-page').then((m) => m.DeferredPage),
  },
  {
    path: '',
    loadComponent: () => import('./public-page').then((m) => m.PublicPage),
  },
  {
    path: 'standalone',
    loadComponent: () =>
      import('./standalone-page').then((m) => m.StandalonePage),
  },
  {
    path: 'forms',
    loadComponent: () => import('./forms-page').then((m) => m.FormsPage),
  },
  {
    path: 'sample/public',
    loadComponent: () => import('./public-page').then((m) => m.PublicPage),
  },
  {
    path: 'sample/standalone',
    data: { sample: true },
    loadComponent: () =>
      import('./standalone-page').then((m) => m.StandalonePage),
  },
  {
    path: 'sample/forms',
    data: { sample: true },
    loadComponent: () => import('./forms-page').then((m) => m.FormsPage),
  },
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    {
      provide: UPLOAD_REQUEST_MARKER,
      // Called by the page, not here: RequestState's DestroyRef must belong to
      // the component rather than a cached route/application injector.
      useValue: () => new RequestState().initial.marker,
    },
    provideRouter(routes, withComponentInputBinding()),
    hydration,
  ],
};
