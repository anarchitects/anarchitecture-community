import type { AngularSsrRenderer } from './angular-ssr-contract.js';
import type {
  AngularSsrEngine,
  AngularSsrEngineOptions,
} from './angular-ssr-engine.js';
import type { AngularSsrRegistrationInput } from './angular-ssr-registration.js';
import type { AngularSsrObservabilityOptions } from './angular-ssr-observability.js';
import {
  createAngularSsrEventDispatcher,
  type AngularSsrEventDispatcher,
} from './angular-ssr-observability-runtime.js';

export interface AngularNodeSsrRendererOptions {
  registration?: AngularSsrRegistrationInput;
  engine?: AngularSsrEngine;
  engineOptions?: AngularSsrEngineOptions;
  observability?: Readonly<AngularSsrObservabilityOptions>;
}

export class AngularNodeSsrRenderer<TContext = unknown>
  implements AngularSsrRenderer<TContext>
{
  private readonly registration?: Readonly<AngularSsrRegistrationInput>;
  private readonly engineOptions?: AngularSsrEngineOptions;
  private engine?: AngularSsrEngine;
  private enginePromise?: Promise<AngularSsrEngine>;
  private registrationPromise?: Promise<void>;
  private readonly dispatch?: AngularSsrEventDispatcher;

  constructor(options: Readonly<AngularNodeSsrRendererOptions> = {}) {
    const { registration, engine, engineOptions } = options;

    if (registration && (engine !== undefined || engineOptions !== undefined)) {
      throw new Error(
        'Cannot provide "registration" together with "engine" or "engineOptions" to AngularNodeSsrRenderer.',
      );
    }

    if (engine && engineOptions) {
      throw new Error(
        'Cannot provide both "engine" and "engineOptions" to AngularNodeSsrRenderer.',
      );
    }

    this.registration = registration;
    this.engineOptions = engineOptions;
    this.engine = engine;
    this.dispatch = createAngularSsrEventDispatcher(options.observability);
  }

  render(
    request: Request,
    requestContext?: TContext,
  ): Promise<Response | null> {
    return this.dispatch
      ? this.renderObserved(this.dispatch, request, requestContext)
      : this.renderRequest(request, requestContext);
  }

  private async renderObserved(
    dispatch: AngularSsrEventDispatcher,
    request: Request,
    requestContext?: TContext,
  ): Promise<Response | null> {
    const eventRequest = {
      method: request.method,
      pathname: new URL(request.url).pathname,
    };

    dispatch({ type: 'ssr.render.start', request: eventRequest });
    // Include lazy initialization, but exclude synchronous observer work.
    const startedAt = performance.now();
    let response: Response | null;

    try {
      response = await this.renderRequest(request, requestContext);
    } catch (error) {
      dispatch({
        type: 'ssr.render.error',
        request: eventRequest,
        durationMs: performance.now() - startedAt,
        error,
      });
      throw error;
    }

    const durationMs = performance.now() - startedAt;
    dispatch(
      response === null
        ? { type: 'ssr.render.null', request: eventRequest, durationMs }
        : {
            type: 'ssr.render.success',
            request: eventRequest,
            durationMs,
            statusCode: response.status,
          },
    );

    return response;
  }

  private async renderRequest(
    request: Request,
    requestContext?: TContext,
  ): Promise<Response | null> {
    await this.ensureRegistration();

    return (await this.getEngine()).handle(request, requestContext);
  }

  private async ensureRegistration(): Promise<void> {
    const registration = this.registration;

    if (!registration) {
      return;
    }

    this.registrationPromise ??= import(
      './angular-ssr-registration-runtime.js'
    ).then(({ registerAngularSsrApplication }) =>
      registerAngularSsrApplication(registration).then(() => undefined),
    );

    await this.registrationPromise;
  }

  private async getEngine(): Promise<AngularSsrEngine> {
    if (this.engine) {
      return this.engine;
    }

    this.enginePromise ??= import('@angular/ssr/node').then(
      ({ AngularNodeAppEngine }) =>
        new AngularNodeAppEngine(this.engineOptions) as AngularSsrEngine,
    );

    this.engine = await this.enginePromise;
    return this.engine;
  }
}

export function createAngularSsrRenderer<TContext = unknown>(
  options?: Readonly<AngularNodeSsrRendererOptions>,
): AngularNodeSsrRenderer<TContext> {
  return new AngularNodeSsrRenderer<TContext>(options);
}
