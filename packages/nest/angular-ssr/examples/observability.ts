// In an application, import these types from '@anarchitects/nest-angular-ssr'.
import type {
  AngularSsrLifecycleEvent,
  AngularSsrLifecycleObserver,
} from '../src/index.js';

// Application-owned examples, not exports from the package runtime.
export type Labels = Readonly<Record<string, string>>;

export interface Counter {
  add(value: number, labels: Labels): void;
}

export interface Histogram {
  record(seconds: number, labels: Labels): void;
}

export interface SsrMetrics {
  renders: Counter;
  failures: Counter;
  fallbacks: Counter;
  duration: Histogram;
}

function safeMethod(method: string): string {
  return [
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
    'CONNECT',
    'TRACE',
  ].includes(method)
    ? method
    : 'OTHER';
}

export function createSsrMetricsObserver(
  metrics: SsrMetrics,
): AngularSsrLifecycleObserver {
  return (event) => {
    const labels: Labels = {
      method: safeMethod(event.request.method),
      application: event.applicationId ?? 'unassigned',
    };
    switch (event.type) {
      case 'ssr.render.start':
        metrics.renders.add(1, labels);
        break;
      case 'ssr.render.success':
        metrics.duration.record(event.durationMs / 1000, {
          ...labels,
          outcome: 'success',
          status_class:
            event.statusCode >= 100 && event.statusCode < 600
              ? `${Math.floor(event.statusCode / 100)}xx`
              : 'other',
        });
        break;
      case 'ssr.render.null':
        metrics.fallbacks.add(1, labels);
        metrics.duration.record(event.durationMs / 1000, {
          ...labels,
          outcome: 'null',
          status_class: 'none',
        });
        break;
      case 'ssr.render.error':
        metrics.failures.add(1, labels);
        metrics.duration.record(event.durationMs / 1000, {
          ...labels,
          outcome: 'error',
          status_class: 'none',
        });
        break;
      default:
        // Routing (and future unrelated lifecycle events) are not renders.
        break;
    }
  };
}

export interface SsrLogRecord {
  level: 'info' | 'warn' | 'error';
  event: AngularSsrLifecycleEvent['type'];
  timestamp: number;
  applicationId?: string;
  method: string;
  durationMs?: number;
  statusCode?: number;
}

export function createSsrLoggingObserver(
  write: (record: SsrLogRecord) => void,
): AngularSsrLifecycleObserver {
  return (event) =>
    write({
      level:
        event.type === 'ssr.render.error'
          ? 'error'
          : event.type === 'ssr.host.rejected'
            ? 'warn'
            : 'info',
      event: event.type,
      timestamp: event.timestamp,
      ...(event.applicationId === undefined
        ? {}
        : { applicationId: event.applicationId }),
      method: safeMethod(event.request.method),
      ...('durationMs' in event ? { durationMs: event.durationMs } : {}),
      ...(event.type === 'ssr.render.success'
        ? { statusCode: event.statusCode }
        : {}),
    });
}
