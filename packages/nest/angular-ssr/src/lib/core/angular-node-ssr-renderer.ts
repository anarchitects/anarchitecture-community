import type { AngularSsrRenderer } from './angular-ssr-contract.js';
import type {
  AngularSsrEngine,
  AngularSsrEngineOptions,
} from './angular-ssr-engine.js';
import type { AngularSsrRegistrationInput } from './angular-ssr-registration.js';
import type { AngularSsrObservabilityOptions } from './angular-ssr-observability.js';

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
  }

  async render(
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
