import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideClientHydration,
  withNoHttpTransferCache,
} from '@angular/platform-browser';
import { provideRouter, Routes } from '@angular/router';

const routes: Routes = [
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
    provideRouter(routes),
    provideClientHydration(withNoHttpTransferCache()),
  ],
};
