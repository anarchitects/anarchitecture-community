import {
  bootstrapApplication,
  provideClientHydration,
  type BootstrapContext,
} from '@angular/platform-browser';
import { provideServerRendering, withRoutes, RenderMode } from '@angular/ssr';
import { App, Shell } from './app';
import { provideRouter } from '@angular/router';
export default (context: BootstrapContext) =>
  bootstrapApplication(
    Shell,
    {
      providers: [
        provideClientHydration(),
        provideRouter([{ path: '**', component: App }]),
        provideServerRendering(
          withRoutes([{ path: '**', renderMode: RenderMode.Server }]),
        ),
      ],
    },
    context,
  );
