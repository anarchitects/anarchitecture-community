import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { ApplicationRef } from '@angular/core';
import type { BootstrapContext } from '@angular/platform-browser';
import { expectTypeOf, test } from 'vitest';

import {
  AngularSsrRegistrationOptions,
  AngularSsrServerBootstrapLoader,
  createAngularSsrRegistration,
  type ResolvedAngularSsrRegistrationOptions,
} from './angular-ssr-registration.js';

test('exports a public registration contract that consumers can type without Angular private APIs', () => {
  const registration = {
    bootstrap: async () => async (_context: BootstrapContext) =>
      ({}) as ApplicationRef,
    templatePath: '/tmp/index.server.html',
    baseHref: '/',
    inlineCriticalCss: false,
    routeExtractionUrl: 'http://localhost/',
    allowedHosts: ['localhost'],
  } satisfies AngularSsrRegistrationOptions;
  const bootstrapLoader: AngularSsrServerBootstrapLoader =
    registration.bootstrap;

  expectTypeOf(bootstrapLoader).toBeFunction();
  expectTypeOf(registration).toMatchTypeOf<AngularSsrRegistrationOptions>();
});

test('reads template content into a resolved registration', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'angular-ssr-registration-'));
  const templatePath = join(directory, 'index.server.html');

  try {
    await writeFile(
      templatePath,
      '<!doctype html><html><body><app-root></app-root></body></html>',
    );

    const registration = await createAngularSsrRegistration({
      bootstrap: async () => async (_context: BootstrapContext) =>
        ({}) as ApplicationRef,
      templatePath,
    });

    expectTypeOf(
      registration,
    ).toMatchTypeOf<ResolvedAngularSsrRegistrationOptions>();
    expect(registration.templatePath).toBe(templatePath);
    expect(registration.document).toContain('<app-root></app-root>');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('fails when the template file does not exist', async () => {
  await expect(
    createAngularSsrRegistration({
      bootstrap: async () => async (_context: BootstrapContext) =>
        ({}) as ApplicationRef,
      templatePath: join(tmpdir(), 'missing-angular-ssr-template.html'),
    }),
  ).rejects.toThrow('Failed to read Angular SSR template');
});

test('fails when the template path is not a readable file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'angular-ssr-registration-'));
  const templatePath = join(directory, 'templates');

  try {
    await mkdir(templatePath);

    await expect(
      createAngularSsrRegistration({
        bootstrap: async () => async (_context: BootstrapContext) =>
          ({}) as ApplicationRef,
        templatePath,
      }),
    ).rejects.toThrow('Failed to read Angular SSR template');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
