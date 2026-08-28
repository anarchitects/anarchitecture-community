import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expectTypeOf } from 'vitest';

import type { AngularNodeSsrRendererOptions } from '../core/angular-node-ssr-renderer.js';
import type { AngularSsrObservabilityOptions } from '../core/angular-ssr-observability.js';
import type { AngularSsrRegistrationOptions } from '../core/angular-ssr-registration.js';
import type { BootstrapNestAngularSsrOptions } from './nest-angular-ssr-bootstrap.js';
import type { CreateNestAngularSsrIntegrationOptions } from './nest-angular-ssr-integration.js';
import { normalizeNestAngularSsrOptions } from './nest-angular-ssr-options.js';
import type { RegisterNestAngularSsrRoutesOptions } from './nest-angular-ssr-routing.js';

describe('normalizeNestAngularSsrOptions', () => {
  const observability = {
    applicationId: 'storefront',
    observer: vi.fn(),
  } satisfies AngularSsrObservabilityOptions;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exposes observability directly on low-level APIs only', () => {
    const rendererOptions = {
      observability,
    } satisfies AngularNodeSsrRendererOptions;
    const integrationOptions = {
      observability,
    } satisfies CreateNestAngularSsrIntegrationOptions;
    const routingOptions = {
      observability,
    } satisfies RegisterNestAngularSsrRoutesOptions;

    expect(rendererOptions.observability).toBe(observability);
    expect(integrationOptions.observability).toBe(observability);
    expect(routingOptions.observability).toBe(observability);
    expectTypeOf<
      NonNullable<BootstrapNestAngularSsrOptions['integration']>
    >().not.toHaveProperty('observability');
    expectTypeOf<
      BootstrapNestAngularSsrOptions['routing']
    >().not.toHaveProperty('observability');
  });

  it('propagates the same observability instance for a custom renderer', async () => {
    const renderer = { render: vi.fn().mockResolvedValue(null) };
    const normalized = await normalizeNestAngularSsrOptions({
      observability,
      integration: { renderer },
      routing: { browserAssetsDir: '/tmp/browser-assets' },
    });

    expect(normalized.integration.observability).toBe(observability);
    expect(normalized.routing.observability).toBe(observability);
    expect(normalized.integration.renderer).toBe(renderer);
  });

  it('propagates the same observability instance in legacy registration mode', async () => {
    const registration = {
      bootstrap: vi.fn(),
      templatePath: '/tmp/index.server.html',
    } satisfies AngularSsrRegistrationOptions;
    const normalized = await normalizeNestAngularSsrOptions({
      angular: registration,
      observability,
      routing: { browserAssetsDir: '/tmp/browser-assets' },
    });

    expect(normalized.integration.observability).toBe(observability);
    expect(normalized.routing.observability).toBe(observability);
    expect(normalized.integration.rendererOptions?.registration).toBe(
      registration,
    );
  });

  it('propagates the same observability instance in build-output mode', async () => {
    const root = await createBuildOutput();

    try {
      const normalized = await normalizeNestAngularSsrOptions({
        angular: {
          buildOutput: { root, importStrategy: 'native' },
          allowedHosts: ['storefront.example.com'],
        },
        observability,
        routing: {},
      });

      expect(normalized.integration.observability).toBe(observability);
      expect(normalized.routing.observability).toBe(observability);
      expect(normalized.routing.browserAssetsDir).toBe(join(root, 'browser'));
      expect(normalized.routing.allowedHosts).toEqual([
        'storefront.example.com',
      ]);
      expect(normalized.integration.rendererOptions?.engine).toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function createBuildOutput(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'ssr-observability-output-'));

  await mkdir(join(root, 'browser'), { recursive: true });
  await mkdir(join(root, 'server'), { recursive: true });
  await writeFile(join(root, 'browser/index.html'), '<app-root></app-root>');
  await writeFile(
    join(root, 'server/server.mjs'),
    'export const angularSsrEngine = { async handle() { return new Response(); } };',
  );

  return root;
}
