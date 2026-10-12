import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { hydration } from './hydration';
import { provideRouter, Routes } from '@angular/router';

const routes: Routes = [
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
    provideRouter(routes),
    hydration,
  ],
};
