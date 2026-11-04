import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join } from 'node:path';
import { files, sha } from './artifacts.mjs';

const require = createRequire(import.meta.url);

export function headlessBrowserIdentity(plan) {
  // executablePath() describes full Chromium, but launch({ headless: true })
  // uses the headless shell. CI deliberately installs only that shell.
  plan ??= execFileSync(
    process.execPath,
    [
      join(dirname(require.resolve('playwright-core/package.json')), 'cli.js'),
      'install',
      '--dry-run',
      '--only-shell',
      'chromium',
    ],
    { encoding: 'utf8', timeout: 10_000 },
  );
  // Ask the installed Playwright CLI for its platform/revision-specific path.
  // Fail closed if its output contract changes; never guess a cache directory.
  const matches = [
    ...plan.matchAll(
      /^.*\(playwright chromium-headless-shell v[^\r\n]+\)\r?\n[ \t]+Install location:[ \t]+([^\r\n]+)$/gm,
    ),
  ];
  assert.equal(
    matches.length,
    1,
    'Expected one Playwright headless-shell installation',
  );
  const directory = matches[0][1].trim();
  assert(isAbsolute(directory), 'Expected an absolute headless-shell path');
  const manifest = files(directory);
  assert(Object.keys(manifest).length > 0, 'Empty headless-shell installation');
  // Include the executable and its runtime resources, not another browser's binary.
  return { directory, digest: sha(JSON.stringify(manifest)) };
}
