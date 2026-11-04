import {
  bootstrapApplication,
  provideClientHydration,
} from '@angular/platform-browser';
import { App, Shell } from './app';
import { provideRouter } from '@angular/router';
bootstrapApplication(Shell, {
  providers: [
    provideClientHydration(),
    provideRouter([{ path: '**', component: App }]),
  ],
}).catch(console.error);
