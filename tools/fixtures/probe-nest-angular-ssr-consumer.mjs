import assert from 'node:assert/strict';
import { realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertSsrSecurityConformance } from './nest-angular-ssr-security-conformance.mjs';
import { assertSsrHttpConformance } from './nest-angular-ssr-http-conformance.mjs';
import {
  readJson,
  fastifyVersion,
  staticVersion,
  subject,
} from './nest-angular-ssr-locked-support.mjs';

const [root, mode, nest] = process.argv.slice(2);
const require = createRequire(join(root, 'package.json'));
const resolved = {};
for (const name of [
  subject,
  '@nestjs/common',
  '@nestjs/core',
  '@nestjs/platform-fastify',
  '@angular/core',
  '@angular/ssr',
  'fastify',
  '@fastify/static',
  'typescript',
  'nx',
]) {
  const path = await realpath(require.resolve(`${name}/package.json`));
  assert.ok(
    path.startsWith(`${await realpath(root)}${sep}node_modules${sep}`),
    `Workspace leakage: ${path}`,
  );
  resolved[name] = { path, version: (await readJson(path)).version };
}
console.log(JSON.stringify({ resolved }, null, 2));
const manifestPath = require.resolve(`${subject}/package.json`);
const manifest = await readJson(manifestPath);
const exports =
  mode === 'esm'
    ? await import(
        pathToFileURL(join(dirname(manifestPath), manifest.exports['.'].import))
      )
    : require(subject);
for (const name of [
  'NestAngularSsrModule',
  'bootstrapNestAngularSsr',
  'createNestAngularSsrIntegration',
  'registerNestAngularSsrRoutes',
]) {
  assert.equal(
    typeof exports[name],
    'function',
    `Missing public export ${name}`,
  );
}
await assertSsrSecurityConformance(root, mode, {
  nest,
  fastify: fastifyVersion,
  static: staticVersion,
});
console.log(
  JSON.stringify(
    { http: await assertSsrHttpConformance(root, exports) },
    null,
    2,
  ),
);
