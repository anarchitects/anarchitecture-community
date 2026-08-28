import type {
  AngularSsrLifecycleEvent,
  AngularSsrObservabilityOptions,
} from './angular-ssr-observability.js';

type DistributiveOmit<T, TKeys extends PropertyKey> = T extends unknown
  ? Omit<T, TKeys>
  : never;

export type AngularSsrLifecycleEventInput = DistributiveOmit<
  AngularSsrLifecycleEvent,
  'timestamp' | 'applicationId'
>;

export type AngularSsrEventDispatcher = (
  event: AngularSsrLifecycleEventInput,
) => void;

/** Internal synchronous dispatcher shared by renderer and routing adapters. */
export function createAngularSsrEventDispatcher(
  options: Readonly<AngularSsrObservabilityOptions> | undefined,
  now: () => number = Date.now,
): AngularSsrEventDispatcher | undefined {
  if (!options) {
    return undefined;
  }

  return (input) => {
    const event = {
      ...input,
      timestamp: now(),
      ...(options.applicationId === undefined
        ? {}
        : { applicationId: options.applicationId }),
      request: normalizeRequest(input.request),
    } as AngularSsrLifecycleEvent;

    try {
      options.observer(event);
    } catch (error) {
      try {
        options.onObserverError?.(error, event);
      } catch {
        // Instrumentation must never change SSR request handling.
      }
    }
  };
}

function normalizeRequest(
  request: AngularSsrLifecycleEventInput['request'],
): AngularSsrLifecycleEvent['request'] {
  return {
    method: request.method.toUpperCase(),
    pathname: stripQueryAndFragment(request.pathname),
    ...(request.requestId === undefined
      ? {}
      : { requestId: request.requestId }),
  };
}

function stripQueryAndFragment(pathname: string): string {
  const queryIndex = pathname.indexOf('?');
  const fragmentIndex = pathname.indexOf('#');
  const boundary = [queryIndex, fragmentIndex]
    .filter((index) => index >= 0)
    .reduce((minimum, index) => Math.min(minimum, index), pathname.length);

  return pathname.slice(0, boundary);
}
