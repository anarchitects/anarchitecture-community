import { AngularNodeAppEngine } from '@angular/ssr/node';

/**
 * Construct the engine inside the Angular server bundle. Nest imports this
 * structural contract at runtime, preserving a single Angular runtime.
 */
export const angularSsrEngine = new AngularNodeAppEngine({
  allowedHosts: (process.env['NG_ALLOWED_HOSTS'] ?? 'localhost,127.0.0.1')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
});
