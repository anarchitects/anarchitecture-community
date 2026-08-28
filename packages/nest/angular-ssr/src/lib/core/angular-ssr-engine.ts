/**
 * Runtime-neutral subset of Angular's application engine used by this package.
 *
 * Keeping this contract structural prevents consumers from having to resolve
 * `@angular/ssr/node` merely to configure an engine created in another bundle.
 */
export interface AngularSsrEngine<TContext = unknown> {
  handle(request: Request, requestContext?: TContext): Promise<Response | null>;
}

/** Public options accepted when this package constructs an Angular engine. */
export interface AngularSsrEngineOptions {
  allowedHosts?: readonly string[];
}
