import {
  provideClientHydration,
  withEventReplay,
  withNoHttpTransferCache,
  withNoIncrementalHydration,
} from '@angular/platform-browser';

/** Build replacement shared by browser and server; preserves explicit replay. */
export const hydration = provideClientHydration(
  withNoHttpTransferCache(),
  withNoIncrementalHydration(),
  withEventReplay(),
);
