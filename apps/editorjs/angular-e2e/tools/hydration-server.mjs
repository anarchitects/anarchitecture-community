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

const [name, suffix, port, evidence = 'hydration'] = process.argv.slice(2);
if (!['hydration', 'isolation'].includes(evidence))
  throw new Error('Unknown evidence suite');
const output = `apps/editorjs/angular-e2e/test-output/${evidence}`;
mkdirSync(output, { recursive: true });
copyFileSync('yarn.lock', `${output}/yarn.lock`);
const require = createRequire(import.meta.url);
const buildDirectory = `dist/apps/editorjs/angular-host-ssr${suffix === 'default' ? '' : suffix}`;
copyFileSync(`${buildDirectory}/stats.json`, `${output}/stats-${name}.json`);
if (evidence === 'isolation') {
  rmSync(`${output}/build-${name}`, { recursive: true, force: true });
  cpSync(buildDirectory, `${output}/build-${name}`, { recursive: true });
}
writeFileSync(
  `${output}/versions.json`,
  JSON.stringify(
    {
      node: process.version,
      packages: Object.fromEntries(
        [
          '@angular/core',
          '@angular/platform-browser',
          '@angular/platform-server',
          '@angular/ssr',
          '@angular/build',
          '@editorjs/editorjs',
          '@playwright/test',
          'typescript',
        ].map((name) => [name, require(`${name}/package.json`).version]),
      ),
    },
    null,
    2,
  ),
);
const log = createWriteStream(`${output}/server-${name}.log`);
const child = spawn(process.execPath, [`${buildDirectory}/server/server.mjs`], {
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
