/**
 * Safe request metadata shared by every SSR lifecycle event.
 *
 * The pathname never contains a query string or fragment. Request IDs are
 * supplied by the hosting platform when available; this package never creates
 * one implicitly.
 */
export interface AngularSsrEventRequest {
  readonly method: string;
  readonly pathname: string;
  readonly requestId?: string;
}

export type AngularSsrLifecycleEventType =
  | 'ssr.api.bypass'
  | 'ssr.asset.served'
  | 'ssr.render.start'
  | 'ssr.render.success'
  | 'ssr.render.null'
  | 'ssr.render.error'
  | 'ssr.host.rejected';

/** Shared fields present on every SSR lifecycle event. */
export interface AngularSsrLifecycleEventBase<
  TType extends AngularSsrLifecycleEventType,
> {
  readonly type: TType;
  /** Unix epoch timestamp in milliseconds. */
  readonly timestamp: number;
  /** Optional stable identifier for the configured Angular application. */
  readonly applicationId?: string;
  readonly request: Readonly<AngularSsrEventRequest>;
}

/** The request matched the Nest API prefix and bypassed SSR. */
export type AngularSsrApiBypassEvent =
  AngularSsrLifecycleEventBase<'ssr.api.bypass'>;

/** An existing browser asset was served without invoking SSR. */
export type AngularSsrAssetServedEvent =
  AngularSsrLifecycleEventBase<'ssr.asset.served'>;

/** Rendering has started for an SSR candidate. */
export type AngularSsrRenderStartEvent =
  AngularSsrLifecycleEventBase<'ssr.render.start'>;

/** Rendering produced an HTTP response. */
export interface AngularSsrRenderSuccessEvent
  extends AngularSsrLifecycleEventBase<'ssr.render.success'> {
  readonly statusCode: number;
  /** Monotonic render duration in milliseconds. */
  readonly durationMs: number;
}

/** Rendering returned null and the host must continue its fallback flow. */
export interface AngularSsrRenderNullEvent
  extends AngularSsrLifecycleEventBase<'ssr.render.null'> {
  /** Monotonic render duration in milliseconds. */
  readonly durationMs: number;
}

/** Rendering failed and the original error will be rethrown. */
export interface AngularSsrRenderErrorEvent
  extends AngularSsrLifecycleEventBase<'ssr.render.error'> {
  readonly error: unknown;
  /** Monotonic render duration in milliseconds. */
  readonly durationMs: number;
}

/** Runtime host validation rejected the request before SSR. */
export type AngularSsrHostRejectedEvent =
  AngularSsrLifecycleEventBase<'ssr.host.rejected'>;

/**
 * Vendor-neutral event model for Angular SSR routing and rendering.
 *
 * Additional namespaced event variants, such as cache lifecycle events, can
 * extend this union without replacing the observer API.
 */
export type AngularSsrLifecycleEvent =
  | AngularSsrApiBypassEvent
  | AngularSsrAssetServedEvent
  | AngularSsrRenderStartEvent
  | AngularSsrRenderSuccessEvent
  | AngularSsrRenderNullEvent
  | AngularSsrRenderErrorEvent
  | AngularSsrHostRejectedEvent;

/**
 * Synchronous lifecycle observer.
 *
 * Returned values are ignored and promises are not awaited. Buffer or enqueue
 * asynchronous instrumentation work in the consuming application.
 */
export type AngularSsrLifecycleObserver = (
  event: AngularSsrLifecycleEvent,
) => void;

/** Called when the lifecycle observer throws synchronously. */
export type AngularSsrObserverErrorHandler = (
  error: unknown,
  event: AngularSsrLifecycleEvent,
) => void;

/** Vendor-neutral observability configuration shared by every SSR layer. */
export interface AngularSsrObservabilityOptions {
  readonly observer: AngularSsrLifecycleObserver;
  readonly applicationId?: string;
  /**
   * Receives synchronous observer failures. Errors thrown by this handler are
   * also isolated and never affect SSR request handling.
   */
  readonly onObserverError?: AngularSsrObserverErrorHandler;
}
