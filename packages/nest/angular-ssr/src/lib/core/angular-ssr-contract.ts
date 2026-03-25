/**
 * Request shape for the framework-agnostic SSR contract.
 *
 * This package uses the Web Fetch API request/response model as its public
 * boundary, even when later integrations adapt from Node or Nest runtimes.
 */
export type AngularSsrRequest = globalThis.Request;

export type AngularSsrResponse = globalThis.Response;

/**
 * Minimal rendering contract for request-driven SSR.
 */
export interface AngularSsrRenderer<TContext = unknown> {
  /**
   * Returning null means SSR did not handle the request and the caller must
   * continue with its own fallback or not-found flow.
   */
  render(
    request: AngularSsrRequest,
    requestContext?: TContext
  ): Promise<AngularSsrResponse | null>;
}
