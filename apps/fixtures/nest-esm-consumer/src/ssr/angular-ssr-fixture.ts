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
import type { AngularSsrRegistrationOptions } from '@anarchitects/nest-angular-ssr';

const INDEX_SERVER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Nest ESM Consumer Fixture</title>
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>`;

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
      <h1>Nest ESM Consumer Fixture</h1>
      <p>SSR response rendered from the ESM-oriented Nest fixture.</p>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})(class FixtureHomeComponent {});

const appRoutes: Routes = [{ path: '', component: FixtureHomeComponent }];
const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
];

async function bootstrapFixtureApplication(context: BootstrapContext) {
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

export const fixtureAngularSsrRegistration = {
  bootstrap: async () => bootstrapFixtureApplication,
  document: INDEX_SERVER_HTML,
  inlineCriticalCss: false,
  routeExtractionUrl: 'http://127.0.0.1/',
  allowedHosts: ['127.0.0.1', 'localhost'],
} satisfies AngularSsrRegistrationOptions;
