import { createHash } from 'node:crypto';
import { browserRuntimeIdentity } from '../../../../packages/editorjs/html-angular/tools/packed/browser-identity.mjs';
import { platformIdentity } from './packed-artifacts.mjs';
import { usesBrowser } from './packed-phases.mjs';

/** One process observes one installed browser; hashing 89 records must not reread it 89 times. */
export function executionIdentityReader() {
  let browser;
  return (phase) =>
    createHash('sha256')
      .update(
        JSON.stringify({
          node: process.version,
          platform: platformIdentity(),
          environment: Object.fromEntries(
            ['CI', 'NODE_OPTIONS', 'NG_BUILD_MAX_WORKERS'].map((name) => [
              name,
              process.env[name] ?? null,
            ]),
          ),
          browser: usesBrowser(phase)
            ? (browser ??= browserRuntimeIdentity())
            : null,
        }),
      )
      .digest('hex');
}
