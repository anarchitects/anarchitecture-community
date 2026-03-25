import {
  AngularNodeAppEngine,
  type AngularNodeAppEngineOptions,
} from '@angular/ssr/node';

import type { AngularSsrRenderer } from './angular-ssr-contract.js';

export interface AngularNodeSsrRendererOptions {
  engine?: AngularNodeAppEngine;
  engineOptions?: AngularNodeAppEngineOptions;
}

export class AngularNodeSsrRenderer<TContext = unknown>
  implements AngularSsrRenderer<TContext>
{
  private readonly engine: Pick<AngularNodeAppEngine, 'handle'>;

  constructor(options: Readonly<AngularNodeSsrRendererOptions> = {}) {
    const { engine, engineOptions } = options;

    if (engine && engineOptions) {
      throw new Error(
        'Cannot provide both "engine" and "engineOptions" to AngularNodeSsrRenderer.',
      );
    }

    this.engine = engine ?? new AngularNodeAppEngine(engineOptions);
  }

  render(
    request: Request,
    requestContext?: TContext,
  ): Promise<Response | null> {
    return this.engine.handle(request, requestContext);
  }
}

export function createAngularSsrRenderer<TContext = unknown>(
  options?: Readonly<AngularNodeSsrRendererOptions>,
): AngularNodeSsrRenderer<TContext> {
  return new AngularNodeSsrRenderer<TContext>(options);
}
