import {
  AngularNodeSsrRenderer,
  createAngularSsrRenderer,
} from './angular-node-ssr-renderer.js';
import type { AngularSsrRenderer } from './angular-ssr-contract.js';
import type { AngularSsrLifecycleEvent } from './angular-ssr-observability.js';

const { constructEngine, registerApplication } = vi.hoisted(() => ({
  constructEngine: vi.fn(),
  registerApplication: vi.fn(),
}));

vi.mock('@angular/ssr/node', () => ({
  AngularNodeAppEngine: class {
    constructor() {
      constructEngine();
    }
  },
}));

vi.mock('./angular-ssr-registration-runtime.js', () => ({
  registerAngularSsrApplication: registerApplication,
}));

describe('renderer observability', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it.each([200, 302, 404, 500])(
    'preserves a response with status %i and emits one start/success pair',
    async (status) => {
      const observer = vi.fn();
      const now = vi.spyOn(performance, 'now');
      let monotonicTime = 10;
      let wallTime = 1_000;
      now.mockImplementation(() => monotonicTime);
      vi.spyOn(Date, 'now').mockImplementation(() => wallTime);
      const response = new Response('untouched body', { status });
      const request = new Request(
        'https://example.com/products?secret=1#item',
        {
          method: 'HEAD',
          headers: { authorization: 'secret', 'x-request-id': 'untrusted' },
        },
      );
      const context = { requestId: 'application-owned' };
      const handle = vi.fn(async () => {
        expect(observer).toHaveBeenCalledTimes(1);
        expect(observer.mock.calls[0][0].type).toBe('ssr.render.start');
        monotonicTime = 22.5;
        // Wall-clock adjustments must not affect render duration.
        wallTime = 500;
        return response;
      });
      const renderer: AngularSsrRenderer<typeof context> =
        createAngularSsrRenderer({
          engine: { handle },
          observability: { observer, applicationId: 'storefront' },
        });

      await expect(renderer.render(request, context)).resolves.toBe(response);

      expect(handle).toHaveBeenCalledWith(request, context);
      expect(response.bodyUsed).toBe(false);
      expect(observer.mock.calls.map(([event]) => event)).toEqual([
        {
          type: 'ssr.render.start',
          timestamp: 1_000,
          applicationId: 'storefront',
          request: { method: 'HEAD', pathname: '/products' },
        },
        {
          type: 'ssr.render.success',
          timestamp: 500,
          applicationId: 'storefront',
          request: { method: 'HEAD', pathname: '/products' },
          statusCode: status,
          durationMs: 12.5,
        },
      ]);
    },
  );

  it('preserves null and reports its duration without a status code', async () => {
    const observer = vi.fn();
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(4)
      .mockReturnValueOnce(7.5);
    const renderer = new AngularNodeSsrRenderer({
      engine: { handle: vi.fn().mockResolvedValue(null) },
      observability: { observer },
    });

    await expect(
      renderer.render(new Request('http://localhost/')),
    ).resolves.toBeNull();

    expect(observer).toHaveBeenCalledTimes(2);
    expect(observer.mock.calls[0][0].type).toBe('ssr.render.start');
    expect(observer.mock.calls[1][0]).toEqual({
      type: 'ssr.render.null',
      timestamp: expect.any(Number),
      request: { method: 'GET', pathname: '/' },
      durationMs: 3.5,
    });
  });

  it.each(['throw', 'reject'] as const)(
    'preserves the exact engine failure (%s) and reports its duration',
    async (mode) => {
      // The engine can throw any value, not just Error instances.
      const failure = { reason: 'render failed' };
      const observer = vi.fn();
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(20)
        .mockReturnValueOnce(25);
      const renderer = createAngularSsrRenderer({
        engine: {
          handle: vi.fn(() => {
            if (mode === 'throw') throw failure;
            return Promise.reject(failure);
          }),
        },
        observability: { observer },
      });

      await expect(
        renderer.render(new Request('http://localhost/')),
      ).rejects.toBe(failure);

      expect(observer).toHaveBeenCalledTimes(2);
      expect(observer.mock.calls[0][0].type).toBe('ssr.render.start');
      expect(observer.mock.calls[1][0]).toEqual({
        type: 'ssr.render.error',
        timestamp: expect.any(Number),
        request: { method: 'GET', pathname: '/' },
        durationMs: 5,
        error: failure,
      });
      expect(observer.mock.calls[1][0].error).toBe(failure);
    },
  );

  it.each(['registration', 'engine'] as const)(
    'observes lazy %s initialization failures on every attempt',
    async (stage) => {
      const failure = new Error('initialization failed');
      const observer = vi.fn();
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(3)
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(11);
      registerApplication.mockRejectedValueOnce(failure);
      constructEngine.mockImplementationOnce(() => {
        throw failure;
      });
      const renderer = createAngularSsrRenderer({
        ...(stage === 'registration'
          ? {
              registration: {
                bootstrap: vi.fn(),
                templatePath: '/unused.html',
              },
            }
          : {}),
        observability: { observer },
      });

      for (let attempt = 0; attempt < 2; attempt++) {
        await expect(
          renderer.render(new Request('http://localhost/')),
        ).rejects.toBe(failure);
      }

      expect(observer.mock.calls.map(([event]) => event.type)).toEqual([
        'ssr.render.start',
        'ssr.render.error',
        'ssr.render.start',
        'ssr.render.error',
      ]);
      expect(observer.mock.calls[1][0]).toMatchObject({
        error: failure,
        durationMs: 3,
      });
      expect(observer.mock.calls[3][0]).toMatchObject({
        error: failure,
        durationMs: 1,
      });
      expect(
        stage === 'registration' ? registerApplication : constructEngine,
      ).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['success', 'null', 'error'] as const)(
    'isolates observer and error-hook failures for %s',
    async (outcome) => {
      const failure = new Error('engine failed');
      const observerFailure = new Error('observer failed');
      const response = outcome === 'null' ? null : new Response('ok');
      const observer = vi.fn(() => {
        throw observerFailure;
      });
      const onObserverError = vi.fn(() => {
        throw new Error('error hook failed');
      });
      const renderer = createAngularSsrRenderer({
        engine: {
          handle: vi.fn(async () => {
            if (outcome === 'error') throw failure;
            return response;
          }),
        },
        observability: { observer, onObserverError },
      });

      const result = renderer.render(new Request('http://localhost/'));
      if (outcome === 'error') {
        await expect(result).rejects.toBe(failure);
      } else {
        await expect(result).resolves.toBe(response);
      }

      expect(observer).toHaveBeenCalledTimes(2);
      expect(onObserverError).toHaveBeenCalledTimes(2);
      expect(onObserverError).toHaveBeenNthCalledWith(
        1,
        observerFailure,
        expect.objectContaining({ type: 'ssr.render.start' }),
      );
      expect(onObserverError).toHaveBeenNthCalledWith(
        2,
        observerFailure,
        expect.objectContaining({ type: `ssr.render.${outcome}` }),
      );
    },
  );

  it('keeps timing and outcomes local to overlapping requests', async () => {
    let time = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => time);
    const events: AngularSsrLifecycleEvent[] = [];
    const pending = new Map<
      string,
      {
        resolve: (response: Response | null) => void;
        reject: (error: unknown) => void;
      }
    >();
    const renderer = createAngularSsrRenderer({
      engine: {
        handle: vi.fn(
          (request) =>
            new Promise<Response | null>((resolve, reject) => {
              pending.set(new URL(request.url).pathname, { resolve, reject });
            }),
        ),
      },
      observability: {
        applicationId: 'concurrent',
        observer: (event) => {
          events.push(event);
        },
      },
    });

    const success = renderer.render(new Request('http://localhost/success'));
    time = 5;
    const declined = renderer.render(new Request('http://localhost/null'));
    time = 10;
    const failed = renderer.render(new Request('http://localhost/error'));
    // Allow each call to reach its engine without timers or sleeps.
    await Promise.resolve();
    await Promise.resolve();
    expect(pending.size).toBe(3);

    time = 20;
    pending.get('/null')?.resolve(null);
    await expect(declined).resolves.toBeNull();
    time = 30;
    const failure = new Error('concurrent failure');
    pending.get('/error')?.reject(failure);
    await expect(failed).rejects.toBe(failure);
    time = 50;
    const response = new Response('ok');
    pending.get('/success')?.resolve(response);
    await expect(success).resolves.toBe(response);

    expect(
      events.map((event) => [
        event.type,
        event.request.pathname,
        'durationMs' in event ? event.durationMs : undefined,
      ]),
    ).toEqual([
      ['ssr.render.start', '/success', undefined],
      ['ssr.render.start', '/null', undefined],
      ['ssr.render.start', '/error', undefined],
      ['ssr.render.null', '/null', 15],
      ['ssr.render.error', '/error', 20],
      ['ssr.render.success', '/success', 50],
    ]);
    expect(events.every((event) => event.applicationId === 'concurrent')).toBe(
      true,
    );
  });

  it('excludes synchronous observer work from the render duration', async () => {
    let time = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => time);
    const observer = vi.fn<(event: AngularSsrLifecycleEvent) => void>(() => {
      time += 100;
    });
    const renderer = createAngularSsrRenderer({
      engine: {
        handle: async () => {
          time += 5;
          return null;
        },
      },
      observability: { observer },
    });

    await renderer.render(new Request('http://localhost/'));

    expect(observer.mock.calls[1][0]).toMatchObject({ durationMs: 5 });
  });

  it('does not read clocks when observability is unconfigured', async () => {
    const monotonicClock = vi.spyOn(performance, 'now');
    const wallClock = vi.spyOn(Date, 'now');
    const response = new Response('ok');
    const failure = new Error('failed');
    const renderer = createAngularSsrRenderer({
      engine: {
        handle: vi
          .fn()
          .mockResolvedValueOnce(response)
          .mockResolvedValueOnce(null)
          .mockRejectedValueOnce(failure),
      },
    });
    const request = new Request('http://localhost/');
    monotonicClock.mockClear();
    wallClock.mockClear();

    await expect(renderer.render(request)).resolves.toBe(response);
    await expect(renderer.render(request)).resolves.toBeNull();
    await expect(renderer.render(request)).rejects.toBe(failure);

    expect(monotonicClock).not.toHaveBeenCalled();
    expect(wallClock).not.toHaveBeenCalled();
  });
});
