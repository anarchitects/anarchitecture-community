import { Location } from '@angular/common';
import { inject, REQUEST } from '@angular/core';
import type { Routes } from '@angular/router';
import { provideEditorJsTools } from '@anarchitects/editorjs-angular';
import { REGISTRY_LABEL, REGISTRY_FACTORY_LABEL } from '../registry/context';
import { definitions, selection } from '../registry/definitions';

/** Route-owned inert definitions; never serialize tool configuration/constructors. */
export const routes: Routes = [
  {
    path: '',
    providers: [
      {
        provide: REGISTRY_FACTORY_LABEL,
        useFactory: () => ({ value: undefined }),
      },
      {
        provide: REGISTRY_LABEL,
        useFactory: () => {
          const request = inject(REQUEST, { optional: true });
          const url = new URL(
            request?.url ?? inject(Location).path(),
            'http://localhost',
          );
          const candidate = url.searchParams.get('marker') ?? 'public-default';
          const label = /^[a-zA-Z0-9_-]{1,48}$/.test(candidate)
            ? candidate
            : 'public-default';
          return label;
        },
      },
      provideEditorJsTools(
        {
          factory: () => {
            const label = inject(REGISTRY_LABEL);
            const tools = definitions(label);
            inject(REGISTRY_FACTORY_LABEL).value = label;
            return tools;
          },
        },
        { select: selection },
      ),
    ],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./registry-page').then((m) => m.RegistryPage),
      },
      {
        path: 'forms',
        loadComponent: () =>
          import('./registry-forms-page').then((m) => m.RegistryFormsPage),
      },
    ],
  },
];
