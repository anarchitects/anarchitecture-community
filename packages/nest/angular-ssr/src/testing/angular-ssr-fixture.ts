import { createHash } from 'node:crypto';

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
  ɵdestroyAngularServerApp,
  ɵextractRoutesAndCreateRouteTree,
  ɵgetOrCreateAngularServerApp,
  ɵsetAngularAppEngineManifest,
  ɵsetAngularAppManifest,
} from '@angular/ssr';

const FIXTURE_URL = 'http://localhost/';
const INDEX_SERVER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Angular SSR Fixture</title>
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

function createServerAsset(text: string) {
  return {
    text: async () => text,
    hash: createHash('sha256').update(text).digest('hex'),
    size: Buffer.byteLength(text),
  };
}

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

export async function setupAngularSsrFixture(url = FIXTURE_URL) {
  const manifest = {
    baseHref: '/',
    assets: {
      'index.server.html': createServerAsset(INDEX_SERVER_HTML),
    },
    bootstrap: async () => bootstrapFixtureApplication,
    inlineCriticalCss: false,
  } as const;

  const { routeTree, errors } = await ɵextractRoutesAndCreateRouteTree({
    url: new URL(url),
    manifest,
  });

  if (errors.length > 0) {
    throw new Error(
      `Angular SSR fixture route extraction failed:\n${errors.join('\n')}`,
    );
  }

  ɵdestroyAngularServerApp();
  ɵsetAngularAppManifest({
    ...manifest,
    routes: routeTree.toObject(),
  });
  ɵsetAngularAppEngineManifest({
    entryPoints: {
      '': async () => ({
        ɵgetOrCreateAngularServerApp,
        ɵdestroyAngularServerApp,
      }),
    },
    basePath: '/',
    supportedLocales: {},
    allowedHosts: ['localhost'],
  });

  return {
    requestUrl: url,
    cleanup() {
      ɵdestroyAngularServerApp();
    },
  };
}
