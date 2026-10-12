import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'sample/public', renderMode: RenderMode.Prerender },
  { path: 'sample/standalone', renderMode: RenderMode.Prerender },
  { path: 'sample/forms', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Server },
];
