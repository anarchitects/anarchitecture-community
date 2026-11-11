// Unprivileged verification of the retained bytes in a clean consumer directory.
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { assert, sha256 } from './execution.mjs';

export function verifyConsumers(packages, directory) {
  const evidence = [];
  for (const p of packages.filter((p) => p.channel === 'npm')) {
    const consumer = mkdtempSync(join(tmpdir(), 'community-release-consumer-'));
    try {
      const included = [
        p,
        ...p.dependencies
          .map((d) => packages.find((other) => other.project === d.project))
          .filter(Boolean),
      ];
      const dependencies = {
        ...Object.fromEntries(
          p.dependencies
            .filter((d) => d.channel === 'npm')
            .map((d) => [d.name, d.version]),
        ),
        ...Object.fromEntries(
          included
            .filter((d) => d.channel === 'npm')
            .map((d) => [
              d.name,
              `file:${resolve(directory, d.project, d.files[0].name)}`,
            ]),
        ),
      };
      writeFileSync(
        join(consumer, 'package.json'),
        JSON.stringify({
          name: 'release-consumer',
          private: true,
          version: '0.0.0',
          dependencies,
        }),
      );
      execFileSync(
        'npm',
        [
          'install',
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          '--registry=https://registry.npmjs.org/',
        ],
        {
          cwd: consumer,
          env: {
            ...process.env,
            NODE_OPTIONS: '',
            NPM_CONFIG_USERCONFIG: join(consumer, '.npmrc'),
            NPM_CONFIG_CACHE: join(consumer, '.npm-cache'),
          },
          stdio: 'inherit',
          timeout: 180_000,
        },
      );
      // Confirm the installer consumed the reviewed files, including declarations,
      // styles and README, without source aliases or lifecycle-generated outputs.
      for (const f of p.files[0].inventory) {
        assert(
          f.path.startsWith('package/') && !f.path.includes('..'),
          'Invalid npm inventory',
        );
        const installed = join(
          consumer,
          'node_modules',
          p.name,
          f.path.slice('package/'.length),
        );
        assert(
          sha256(readFileSync(installed)) === f.sha256,
          `Installed bytes differ: ${p.name}/${f.path}`,
        );
      }
      const lock = readFileSync(join(consumer, 'package-lock.json'));
      const relative = `evidence/${p.project}-package-lock.json`;
      mkdirSync(resolve(directory, 'evidence'), { recursive: true });
      writeFileSync(resolve(directory, relative), lock);
      evidence.push({
        project: p.project,
        kind: 'clean npm installation and installed-file identity',
        path: relative,
        sha256: sha256(lock),
        size: lock.length,
      });
    } finally {
      rmSync(consumer, { recursive: true, force: true });
    }
  }
  return evidence;
}
