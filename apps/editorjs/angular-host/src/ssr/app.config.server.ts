import {
  mergeApplicationConfig,
  ApplicationConfig,
  ErrorHandler,
  REQUEST_CONTEXT,
  inject,
} from '@angular/core';
import type { RequestContext } from './request-context';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: ErrorHandler,
      useFactory: () => {
        const context = inject(REQUEST_CONTEXT, {
          optional: true,
        }) as RequestContext | null;
        return {
          handleError(error: unknown) {
            if (context) context.errors++;
            console.error(error);
          },
        };
      },
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
