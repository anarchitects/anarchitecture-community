import {
  AngularNodeAppEngine,
  type AngularNodeAppEngineOptions,
} from '@angular/ssr/node';

import type { AngularSsrRenderer } from './angular-ssr-contract.js';
import type { AngularSsrRegistrationOptions } from './angular-ssr-registration.js';
import { registerAngularSsrApplication } from './angular-ssr-registration-runtime.js';

export interface AngularNodeSsrRendererOptions {
  registration?: AngularSsrRegistrationOptions;
  engine?: AngularNodeAppEngine;
  engineOptions?: AngularNodeAppEngineOptions;
}

export class AngularNodeSsrRenderer<TContext = unknown>
  implements AngularSsrRenderer<TContext>
{
  private readonly registration?: Readonly<AngularSsrRegistrationOptions>;
  private readonly engineOptions?: AngularNodeAppEngineOptions;
  private engine?: Pick<AngularNodeAppEngine, 'handle'>;
  private registrationPromise?: Promise<void>;

  constructor(options: Readonly<AngularNodeSsrRendererOptions> = {}) {
    const { registration, engine, engineOptions } = options;

    if (
      registration &&
      (engine !== undefined || engineOptions !== undefined)
    ) {
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

    return this.getEngine().handle(request, requestContext);
  }

  private async ensureRegistration(): Promise<void> {
    if (!this.registration) {
      return;
    }

    this.registrationPromise ??= registerAngularSsrApplication(
      this.registration,
    ).then(() => undefined);

    await this.registrationPromise;
  }

  private getEngine(): Pick<AngularNodeAppEngine, 'handle'> {
    this.engine ??= new AngularNodeAppEngine(this.engineOptions);

    return this.engine;
  }
}

export function createAngularSsrRenderer<TContext = unknown>(
  options?: Readonly<AngularNodeSsrRendererOptions>,
): AngularNodeSsrRenderer<TContext> {
  return new AngularNodeSsrRenderer<TContext>(options);
}
