import '@angular/compiler';

import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  bootstrapApplication,
  type BootstrapContext,
} from '@angular/platform-browser';
import { provideRouter, RouterOutlet, type Routes } from '@angular/router';
import {
  RenderMode,
  provideServerRendering,
  type ServerRoute,
  withRoutes,
} from '@angular/ssr';

const FixtureAppComponent = Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})(class FixtureAppComponent {});

const FixtureHomeComponent = Component({
  selector: 'fixture-home',
  template: `
    <main>
      <h1>Nest CJS Consumer Fixture</h1>
      <p>SSR response rendered from the CommonJS-oriented Nest fixture.</p>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})(class FixtureHomeComponent {});

const appRoutes: Routes = [{ path: '', component: FixtureHomeComponent }];
const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
];

export async function bootstrapServerApplication(context: BootstrapContext) {
  return bootstrapApplication(
    FixtureAppComponent,
    {
      providers: [
        provideRouter(appRoutes),
        provideServerRendering(withRoutes(serverRoutes)),
      ],
    },
    context,
  );
}
