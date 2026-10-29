import { InjectionToken } from '@angular/core';

/** SSR host hook invoked in the page's injection context, so teardown belongs to that page. */
export const UPLOAD_REQUEST_MARKER = new InjectionToken<() => string>(
  'fixture upload request marker',
);
