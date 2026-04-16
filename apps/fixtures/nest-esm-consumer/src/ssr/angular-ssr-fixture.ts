import type { AngularSsrRegistrationOptions } from '@anarchitects/nest-angular-ssr';
import { join } from 'node:path';

import { bootstrapServerApplication } from '../main.server.js';

export const fixtureAngularSsrRegistration = {
  bootstrap: async () => bootstrapServerApplication,
  templatePath: join(process.cwd(), 'src/index.server.html'),
  inlineCriticalCss: false,
  routeExtractionUrl: 'http://127.0.0.1/',
  allowedHosts: ['127.0.0.1', 'localhost'],
} satisfies AngularSsrRegistrationOptions;
