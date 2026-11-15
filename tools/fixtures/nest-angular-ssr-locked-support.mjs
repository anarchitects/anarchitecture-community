import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { stopServer } from './nest-angular-ssr-consumer-attempt.mjs';

export const subject = '@anarchitects/nest-angular-ssr';
export const nodeVersion = '24.22.3';
export const fastifyVersion = '5.12.8';
export const staticVersion = '10.1.11';
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const digest = (value, algorithm = 'sha256') =>
  createHash(algorithm).update(value).digest('hex');
export const readJson = async (path) =>
  JSON.parse(await readFile(path, 'utf8'));

// Clear ambient source conditions, aliases and npm peer-bypass configuration.
// npm still uses its ordinary credential/config locations for registry access.
export function fixtureEnv(extra = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      /^(NODE_PATH|NODE_OPTIONS|TS_NODE.*|npm_config_.*|NPM_CONFIG_.*)$/i.test(
        key,
      )
    )
      delete env[key];
  }
  delete env.FORCE_COLOR;
  return {
    ...env,
    NX_NO_CLOUD: 'true',
    NX_CLOUD_DISTRIBUTED_EXECUTION: 'false',
    NX_DAEMON: 'false',
    NX_ISOLATE_PLUGINS: 'false',
    NX_INTERACTIVE: 'false',
    npm_config_force: 'false',
    npm_config_legacy_peer_deps: 'false',
    npm_config_strict_peer_deps: 'true',
    npm_config_engine_strict: 'true',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    ...extra,
  };
}

export async function command(
  executable,
  args,
  cwd,
  { log, timeoutMs = 300_000, env = {} } = {},
) {
  let output = '';
  let stdout = '';
  let stderr = '';
  let closed = false;
  const grouped = process.platform !== 'win32';
  const child = spawn(executable, args, {
    cwd,
    env: fixtureEnv(env),
    detached: grouped,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    output += chunk;
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
    stderr += chunk;
  });
  const controller = new AbortController();
  const interrupt = (signal) => {
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    controller.abort(new Error(`Fixture command interrupted by ${signal}`));
  };
  const onInt = () => interrupt('SIGINT');
  const onTerm = () => interrupt('SIGTERM');
  process.once('SIGINT', onInt);
  process.once('SIGTERM', onTerm);
  let timer;
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (status, signal) => {
        closed = true;
        resolve(status ?? signal);
      });
      controller.signal.addEventListener(
        'abort',
        () => reject(controller.signal.reason),
        { once: true },
      );
      timer = setTimeout(
        () => reject(new Error(`Command timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });
    assert.equal(
      code,
      0,
      `${executable} ${args.join(' ')} failed (${code}).\n${output.slice(-8000)}`,
    );
    return stdout;
  } finally {
    clearTimeout(timer);
    process.off('SIGINT', onInt);
    process.off('SIGTERM', onTerm);
    await stopServer(child, grouped, () => closed, 2_000);
    if (log) {
      await writeFile(log, stdout);
      await writeFile(`${log}.stderr.log`, stderr);
    }
  }
}

export function environmentManifest(name, versions) {
  const dependencies = {
    '@fastify/static': staticVersion,
    fastify: fastifyVersion,
    'reflect-metadata': '0.2.2',
    rxjs: '7.8.2',
    tslib: '2.8.1',
  };
  for (const name of ['common', 'core', 'platform-fastify'])
    dependencies[`@nestjs/${name}`] = versions.nest;
  for (const name of [
    'common',
    'compiler',
    'core',
    'platform-browser',
    'platform-server',
    'router',
  ])
    dependencies[`@angular/${name}`] = versions.angular;
  dependencies['@angular/ssr'] = versions.angularBuild;
  const devDependencies = {
    '@types/node': '24.10.1',
    typescript: versions.typescript,
    nx: versions.nx,
  };
  if (versions.split)
    Object.assign(devDependencies, {
      '@angular/build': versions.angularBuild,
      '@angular/compiler-cli': versions.angular,
      '@nx/js': versions.nx,
      '@nx/webpack': versions.nx,
      webpack: '5.107.2',
      'webpack-cli': '7.0.0',
      playwright: '1.64.0',
    });
  return {
    name: `ssr-${name.toLowerCase()}`,
    version: '0.0.0',
    private: true,
    engines: { node: nodeVersion },
    dependencies,
    devDependencies,
    // Consumer-owned: this must constrain every nested Fastify, including 11.1.29.
    overrides: {
      fastify: '$fastify',
      ...(versions.split && versions.angularBuild === '22.2.7'
        ? {
            // Angular's optional OXC WASM binding pins emnapi alpha.6, whereas
            // wasm-runtime 1.2.6/1.2.7 exclude that peer. Keep a narrowly scoped,
            // peer-compatible tooling pin; native platform builds are still required.
            '@oxc-parser/binding-wasm32-wasi': {
              '@napi-rs/wasm-runtime': '1.2.5',
            },
          }
        : {}),
    },
  };
}

// Freeze third-party dependencies separately from the changing subject archive.
// Only the subject's genuine manifest and byte identity are bound here. npm ci
// then validates the combined graph with strict peers; no peer range is rewritten.
export function bindArchive(environment, frozen, manifest, bytes) {
  assert.equal(manifest.name, subject);
  assert.equal(frozen.lockfileVersion, 3);
  assert.deepEqual(frozen.packages[''].dependencies, environment.dependencies);
  assert.deepEqual(
    frozen.packages[''].devDependencies,
    environment.devDependencies,
  );
  for (const name of Object.keys({
    ...manifest.dependencies,
    ...manifest.peerDependencies,
  })) {
    assert.ok(
      frozen.packages[`node_modules/${name}`],
      `Freeze ${name} in the environment before binding this archive`,
    );
  }
  assert.ok(
    !manifest.optionalDependencies &&
      !manifest.bundleDependencies &&
      !manifest.bundledDependencies,
    'Archive dependency layout changed; review the fixture binding',
  );
  const pkg = structuredClone(environment);
  pkg.dependencies[subject] = 'file:./candidate.tgz';
  const lock = structuredClone(frozen);
  lock.packages[''].dependencies = structuredClone(pkg.dependencies);
  const entry = {
    version: manifest.version,
    resolved: 'file:candidate.tgz',
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
  };
  for (const key of [
    'license',
    'engines',
    'dependencies',
    'peerDependencies',
    'peerDependenciesMeta',
  ]) {
    if (manifest[key]) entry[key] = structuredClone(manifest[key]);
  }
  lock.packages[`node_modules/${subject}`] = entry;
  return { pkg, lock };
}

export function assertFastifyTree(lock) {
  const copies = Object.entries(lock.packages).filter(([path]) =>
    /(^|\/)node_modules\/fastify$/.test(path),
  );
  assert.ok(copies.length > 0, 'No Fastify in the lock');
  for (const [path, entry] of copies)
    assert.equal(entry.version, fastifyVersion, `Unpatched Fastify: ${path}`);
  return Object.fromEntries(
    copies.map(([path, entry]) => [path, entry.version]),
  );
}
