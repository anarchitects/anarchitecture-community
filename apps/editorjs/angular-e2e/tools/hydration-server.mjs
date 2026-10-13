import { spawn } from 'node:child_process';
import {
  mkdirSync,
  cpSync,
  rmSync,
  createWriteStream,
  copyFileSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import {
  fixtureRoot,
  fixtureNode,
  packed,
  buildDirectory,
  reportDirectory,
} from './ssr-environment.mjs';

const [name, suffix, port, evidence = 'hydration'] = process.argv.slice(2);
if (!['hydration', 'isolation'].includes(evidence))
  throw new Error('Unknown evidence suite');
const output = reportDirectory(evidence);
mkdirSync(output, { recursive: true });
const lock = packed ? 'package-lock.json' : 'yarn.lock';
copyFileSync(join(fixtureRoot, lock), `${output}/${lock}`);
const require = createRequire(join(fixtureRoot, 'package.json'));
const build = buildDirectory(suffix === 'default' ? '' : suffix);
copyFileSync(`${build}/stats.json`, `${output}/stats-${name}.json`);
if (evidence === 'isolation') {
  rmSync(`${output}/build-${name}`, { recursive: true, force: true });
  cpSync(build, `${output}/build-${name}`, { recursive: true });
}
writeFileSync(
  `${output}/versions.json`,
  JSON.stringify(
    {
      launcherNode: process.version,
      serverNode: fixtureNode,
      playwright: createRequire(import.meta.url)(
        '@playwright/test/package.json',
      ).version,
      packages: Object.fromEntries(
        [
          '@angular/core',
          '@angular/forms',
          '@angular/platform-browser',
          '@angular/platform-server',
          '@angular/ssr',
          '@angular/build',
          '@editorjs/editorjs',
          'typescript',
        ].map((name) => [name, require(`${name}/package.json`).version]),
      ),
    },
    null,
    2,
  ),
);
const log = createWriteStream(`${output}/server-${name}.log`);
const child = spawn(fixtureNode, [`${build}/server/server.mjs`], {
  cwd: fixtureRoot,
  env: { ...process.env, PORT: port },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
child.stderr.pipe(process.stderr);
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
  log.end();
});
child.on('exit', (code, signal) => {
  log.end();
  process.exitCode = code ?? (signal === 'SIGTERM' ? 0 : 1);
});
