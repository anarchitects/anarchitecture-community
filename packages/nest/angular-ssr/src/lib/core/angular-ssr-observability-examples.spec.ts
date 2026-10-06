import {
  createSsrLoggingObserver,
  createSsrMetricsObserver,
} from '../../../examples/observability.js';
import type { AngularSsrLifecycleEvent } from './angular-ssr-observability.js';
import { createAngularSsrEventDispatcher } from './angular-ssr-observability-runtime.js';

describe('documented observability adapters', () => {
  it('counts attempts, failures and fallbacks separately and converts all durations to seconds', () => {
    const metrics = {
      renders: { add: vi.fn() },
      failures: { add: vi.fn() },
      fallbacks: { add: vi.fn() },
      duration: { record: vi.fn() },
    };
    const observe = createSsrMetricsObserver(metrics);
    const common = {
      timestamp: 1,
      applicationId: 'storefront',
      request: {
        method: 'CUSTOM-SENSITIVE-METHOD',
        pathname: '/users/private?token=secret',
        requestId: 'unique-id',
      },
    };
    const events: AngularSsrLifecycleEvent[] = [
      { ...common, type: 'ssr.render.start' },
      {
        ...common,
        type: 'ssr.render.success',
        statusCode: 500,
        durationMs: 1250,
      },
      { ...common, type: 'ssr.render.start' },
      { ...common, type: 'ssr.render.null', durationMs: 250 },
      { ...common, type: 'ssr.render.start' },
      {
        ...common,
        type: 'ssr.render.error',
        error: new Error('secret'),
        durationMs: 500,
      },
      { ...common, type: 'ssr.api.bypass' },
      { ...common, type: 'ssr.asset.served' },
      { ...common, type: 'ssr.host.rejected' },
    ];
    events.forEach(observe);
    const labels = { method: 'OTHER', application: 'storefront' };
    expect(metrics.renders.add.mock.calls).toEqual([
      [1, labels],
      [1, labels],
      [1, labels],
    ]);
    expect(metrics.failures.add.mock.calls).toEqual([[1, labels]]);
    expect(metrics.fallbacks.add.mock.calls).toEqual([[1, labels]]);
    expect(metrics.duration.record.mock.calls).toEqual([
      [1.25, { ...labels, outcome: 'success', status_class: '5xx' }],
      [0.25, { ...labels, outcome: 'null', status_class: 'none' }],
      [0.5, { ...labels, outcome: 'error', status_class: 'none' }],
    ]);
  });

  it('logs an allowlist of fields, excluding thrown values and request identifiers', () => {
    const write = vi.fn();
    const observe = createSsrLoggingObserver(write);
    observe({
      type: 'ssr.render.error',
      timestamp: 42,
      durationMs: 2,
      request: {
        method: 'GET',
        pathname: '/users/private',
        requestId: 'secret',
      },
      error: { message: 'password', stack: 'private file path' },
    });
    expect(write).toHaveBeenCalledExactlyOnceWith({
      level: 'error',
      event: 'ssr.render.error',
      timestamp: 42,
      method: 'GET',
      durationMs: 2,
    });
  });

  it('routes synchronous sink failures through the existing observer error handler', () => {
    const failure = new Error('sink unavailable');
    const onObserverError = vi.fn();
    const dispatch = createAngularSsrEventDispatcher({
      observer: createSsrLoggingObserver(() => {
        throw failure;
      }),
      onObserverError,
    });
    expect(() =>
      dispatch?.({
        type: 'ssr.render.start',
        request: { method: 'GET', pathname: '/' },
      }),
    ).not.toThrow();
    expect(onObserverError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ type: 'ssr.render.start' }),
    );
  });
});
