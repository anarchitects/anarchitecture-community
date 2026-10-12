import {
  provideClientHydration,
  withNoHttpTransferCache,
} from '@angular/platform-browser';

export const hydration = provideClientHydration(withNoHttpTransferCache());
