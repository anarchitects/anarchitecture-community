import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ApplicationRef, Type } from '@angular/core';
import type { BootstrapContext } from '@angular/platform-browser';

export type AngularSsrServerBootstrap =
  | Type<unknown>
  | ((context: BootstrapContext) => Promise<ApplicationRef>);

export type AngularSsrServerBootstrapLoader =
  () => Promise<AngularSsrServerBootstrap>;

export interface AngularSsrRegistrationOptions {
  bootstrap: AngularSsrServerBootstrapLoader;
  templatePath: string;
  baseHref?: string;
  inlineCriticalCss?: boolean;
  routeExtractionUrl?: string | URL;
  allowedHosts?: readonly string[];
}

export interface ResolvedAngularSsrRegistrationOptions {
  bootstrap: AngularSsrServerBootstrapLoader;
  templatePath: string;
  document: string;
  baseHref?: string;
  inlineCriticalCss?: boolean;
  routeExtractionUrl?: string | URL;
  allowedHosts?: readonly string[];
}

export type AngularSsrRegistrationInput =
  | AngularSsrRegistrationOptions
  | ResolvedAngularSsrRegistrationOptions;

export async function createAngularSsrRegistration(
  options: Readonly<AngularSsrRegistrationOptions>,
): Promise<ResolvedAngularSsrRegistrationOptions> {
  const templatePath = resolve(options.templatePath);

  try {
    return {
      ...options,
      templatePath,
      document: await readFile(templatePath, 'utf8'),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown template read error.';

    throw new Error(
      `Failed to read Angular SSR template from "${templatePath}": ${message}`,
    );
  }
}
