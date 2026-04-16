import { fileURLToPath } from 'node:url';

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

import type { AngularSsrRegistrationOptions } from '../lib/core/angular-ssr-registration.js';
import {
  registerAngularSsrApplication,
  resetAngularSsrRegistration,
} from '../lib/core/angular-ssr-registration-runtime.js';

const FIXTURE_URL = 'http://localhost/';
const FIXTURE_TEMPLATE_PATH = fileURLToPath(
  new URL('./index.server.html', import.meta.url),
);

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
      <h1>SSR Fixture</h1>
      <p>Angular SSR core fixture</p>
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

export function createAngularSsrFixtureRegistration(
  url = FIXTURE_URL,
): AngularSsrRegistrationOptions {
  return {
    bootstrap: async () => bootstrapFixtureApplication,
    templatePath: FIXTURE_TEMPLATE_PATH,
    inlineCriticalCss: false,
    routeExtractionUrl: url,
    allowedHosts: ['localhost'],
  };
}

export async function setupAngularSsrFixture(url = FIXTURE_URL) {
  const registration = createAngularSsrFixtureRegistration(url);
  const fixture = await registerAngularSsrApplication(registration);

  return {
    registration,
    requestUrl: fixture.requestUrl,
    cleanup() {
      fixture.cleanup();
    },
  };
}

export function cleanupAngularSsrFixture(): void {
  resetAngularSsrRegistration();
}
