import '@angular/compiler';
import { AngularNodeAppEngine } from '@angular/ssr/node';

import {
  AngularNodeSsrRenderer,
  createAngularSsrRenderer,
} from './angular-node-ssr-renderer.js';
import { setupAngularSsrFixture } from '../../testing/angular-ssr-fixture.js';

describe('AngularNodeSsrRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a renderer instance from the factory', () => {
    const engine = {
      handle: vi.fn(),
    } as unknown as AngularNodeAppEngine;
    const renderer = createAngularSsrRenderer({ engine });

    expect(renderer).toBeInstanceOf(AngularNodeSsrRenderer);
  });

  it('uses an injected AngularNodeAppEngine when provided', async () => {
    const request = new Request('http://localhost/');
    const context = { requestId: 'ctx-1' };
    const response = new Response('ok');
    const engine = {
      handle: vi.fn().mockResolvedValue(response),
    } as unknown as AngularNodeAppEngine;

    const renderer = new AngularNodeSsrRenderer({ engine });
    const result = await renderer.render(request, context);

    expect(result).toBe(response);
    expect(engine.handle).toHaveBeenCalledWith(request, context);
  });

  it('preserves a null SSR result as a fallback signal', async () => {
    const engine = {
      handle: vi.fn().mockResolvedValue(null),
    } as unknown as AngularNodeAppEngine;
    const renderer = new AngularNodeSsrRenderer({ engine });

    await expect(
      renderer.render(new Request('http://localhost/')),
    ).resolves.toBe(null);
  });

  it('surfaces engine errors unchanged', async () => {
    const failure = new Error('render failed');
    const engine = {
      handle: vi.fn().mockRejectedValue(failure),
    } as unknown as AngularNodeAppEngine;
    const renderer = new AngularNodeSsrRenderer({ engine });

    await expect(
      renderer.render(new Request('http://localhost/')),
    ).rejects.toBe(failure);
  });

  it('rejects ambiguous configuration when both engine and options are provided', () => {
    const engine = {
      handle: vi.fn(),
    } as unknown as AngularNodeAppEngine;

    expect(
      () =>
        new AngularNodeSsrRenderer({
          engine,
          engineOptions: { allowedHosts: ['localhost'] },
        }),
    ).toThrow('Cannot provide both "engine" and "engineOptions"');
  });

  it('renders a real response with AngularNodeAppEngine', async () => {
    const fixture = await setupAngularSsrFixture();

    try {
      const renderer = createAngularSsrRenderer();
      const response = await renderer.render(new Request(fixture.requestUrl));

      expect(response).toBeInstanceOf(Response);
      expect(response?.status).toBe(200);

      const html = await response?.text();

      expect(html).toContain('SSR Fixture');
      expect(html).toContain('Angular SSR core fixture');
    } finally {
      fixture.cleanup();
    }
  });
});
