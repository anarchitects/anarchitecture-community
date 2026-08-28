import { expectTypeOf } from 'vitest';

import type {
  AngularSsrLifecycleEvent,
  AngularSsrObservabilityOptions,
} from './angular-ssr-observability.js';
import {
  createAngularSsrEventDispatcher,
  type AngularSsrLifecycleEventInput,
} from './angular-ssr-observability-runtime.js';

describe('Angular SSR observability', () => {
  it('provides a discriminated public event union', () => {
    const inspectEvent = (event: AngularSsrLifecycleEvent) => {
      switch (event.type) {
        case 'ssr.api.bypass':
        case 'ssr.asset.served':
        case 'ssr.render.start':
        case 'ssr.host.rejected':
          expectTypeOf(event.request.pathname).toEqualTypeOf<string>();
          break;
        case 'ssr.render.success':
          expectTypeOf(event.statusCode).toEqualTypeOf<number>();
          expectTypeOf(event.durationMs).toEqualTypeOf<number>();
          break;
        case 'ssr.render.null':
          expectTypeOf(event.durationMs).toEqualTypeOf<number>();
          break;
        case 'ssr.render.error':
          expectTypeOf(event.error).toEqualTypeOf<unknown>();
          expectTypeOf(event.durationMs).toEqualTypeOf<number>();
          break;
        default:
          expectTypeOf(event).toEqualTypeOf<never>();
      }
    };

    expectTypeOf(inspectEvent).toBeFunction();
  });

  it('dispatches every event synchronously with shared metadata', () => {
    const observer = vi.fn();
    const options = {
      applicationId: 'storefront',
      observer,
    } satisfies AngularSsrObservabilityOptions;
    const dispatch = createAngularSsrEventDispatcher(
      options,
      () => 1_725_000_000_000,
    );
    const request = {
      method: 'get',
      pathname: '/products/42?token=secret#details',
      requestId: 'request-42',
    };
    const error = new Error('render failed');
    const inputs = [
      { type: 'ssr.api.bypass', request },
      { type: 'ssr.asset.served', request },
      { type: 'ssr.render.start', request },
      {
        type: 'ssr.render.success',
        request,
        statusCode: 200,
        durationMs: 12.5,
      },
      { type: 'ssr.render.null', request, durationMs: 4 },
      { type: 'ssr.render.error', request, error, durationMs: 3 },
      { type: 'ssr.host.rejected', request },
    ] satisfies readonly AngularSsrLifecycleEventInput[];

    expect(dispatch).toBeDefined();

    for (const input of inputs) {
      dispatch?.(input);
    }

    expect(observer).toHaveBeenCalledTimes(inputs.length);
    expect(observer).toHaveBeenNthCalledWith(1, {
      type: 'ssr.api.bypass',
      timestamp: 1_725_000_000_000,
      applicationId: 'storefront',
      request: {
        method: 'GET',
        pathname: '/products/42',
        requestId: 'request-42',
      },
    });
    expect(observer).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({
        type: 'ssr.render.error',
        error,
        durationMs: 3,
      }),
    );
  });

  it('does not create a dispatcher without observability options', () => {
    expect(createAngularSsrEventDispatcher(undefined)).toBeUndefined();
  });

  it('isolates observer failures and reports them to the error hook', () => {
    const observerError = new Error('observer failed');
    const onObserverError = vi.fn();
    const dispatch = createAngularSsrEventDispatcher({
      observer: () => {
        throw observerError;
      },
      onObserverError,
    });
    const input = {
      type: 'ssr.render.start',
      request: { method: 'GET', pathname: '/' },
    } satisfies AngularSsrLifecycleEventInput;

    expect(() => dispatch?.(input)).not.toThrow();
    expect(onObserverError).toHaveBeenCalledWith(
      observerError,
      expect.objectContaining({ type: 'ssr.render.start' }),
    );
  });

  it('isolates failures from the observer error hook', () => {
    const dispatch = createAngularSsrEventDispatcher({
      observer: () => {
        throw new Error('observer failed');
      },
      onObserverError: () => {
        throw new Error('error hook failed');
      },
    });

    expect(() =>
      dispatch?.({
        type: 'ssr.render.start',
        request: { method: 'GET', pathname: '/' },
      }),
    ).not.toThrow();
  });
});
