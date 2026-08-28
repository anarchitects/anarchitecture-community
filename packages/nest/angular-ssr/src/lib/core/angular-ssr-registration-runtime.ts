import { createHash } from 'node:crypto';

import {
  ɵdestroyAngularServerApp as destroyAngularServerApp,
  ɵextractRoutesAndCreateRouteTree as extractRoutesAndCreateRouteTree,
  ɵgetOrCreateAngularServerApp as getOrCreateAngularServerApp,
  ɵsetAngularAppEngineManifest as setAngularAppEngineManifest,
  ɵsetAngularAppManifest as setAngularAppManifest,
} from '@angular/ssr';

import {
  createAngularSsrRegistration,
  type AngularSsrRegistrationInput,
  type ResolvedAngularSsrRegistrationOptions,
} from './angular-ssr-registration.js';

const DEFAULT_BASE_HREF = '/';
const DEFAULT_INLINE_CRITICAL_CSS = false;
const DEFAULT_ROUTE_EXTRACTION_URL = 'http://localhost/';
const INDEX_SERVER_DOCUMENT_PATH = 'index.server.html';

export interface RegisteredAngularSsrApplication {
  readonly requestUrl: string;
  cleanup(): void;
}

export async function registerAngularSsrApplication(
  options: Readonly<AngularSsrRegistrationInput>,
): Promise<RegisteredAngularSsrApplication> {
  const registration = await resolveAngularSsrRegistration(options);
  const requestUrl = createRouteExtractionUrl(registration.routeExtractionUrl);
  const baseHref = normalizeBaseHref(registration.baseHref);
  const manifest = {
    baseHref,
    assets: {
      [INDEX_SERVER_DOCUMENT_PATH]: createServerAsset(registration.document),
    },
    bootstrap: registration.bootstrap,
    inlineCriticalCss:
      registration.inlineCriticalCss ?? DEFAULT_INLINE_CRITICAL_CSS,
  } as const;
  const { routeTree, errors } = await extractRoutesAndCreateRouteTree({
    url: requestUrl,
    manifest,
  });

  if (errors.length > 0) {
    throw new Error(
      `Angular SSR route extraction failed:\n${errors.join('\n')}`,
    );
  }

  destroyAngularServerApp();
  setAngularAppManifest({
    ...manifest,
    routes: routeTree.toObject(),
  });
  setAngularAppEngineManifest({
    entryPoints: {
      '': async () => ({
        ɵgetOrCreateAngularServerApp: getOrCreateAngularServerApp,
        ɵdestroyAngularServerApp: destroyAngularServerApp,
      }),
    },
    basePath: baseHref,
    supportedLocales: {},
    allowedHosts: [...(registration.allowedHosts ?? [])],
  });

  return {
    requestUrl: requestUrl.toString(),
    cleanup: resetAngularSsrRegistration,
  };
}

export function resetAngularSsrRegistration(): void {
  destroyAngularServerApp();
}

async function resolveAngularSsrRegistration(
  options: Readonly<AngularSsrRegistrationInput>,
): Promise<ResolvedAngularSsrRegistrationOptions> {
  if ('document' in options) {
    return options;
  }

  return createAngularSsrRegistration(options);
}

function createRouteExtractionUrl(
  value: AngularSsrRegistrationInput['routeExtractionUrl'],
): URL {
  if (value instanceof URL) {
    return new URL(value.toString());
  }

  return new URL(value ?? DEFAULT_ROUTE_EXTRACTION_URL);
}

function createServerAsset(text: string) {
  return {
    text: async () => text,
    hash: createHash('sha256').update(text).digest('hex'),
    size: Buffer.byteLength(text),
  };
}

function normalizeBaseHref(baseHref: string | undefined): string {
  const value = baseHref?.trim() ?? DEFAULT_BASE_HREF;

  if (value === '') {
    return DEFAULT_BASE_HREF;
  }

  return value.startsWith('/') ? value : `/${value}`;
}
