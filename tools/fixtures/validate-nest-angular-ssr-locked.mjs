import assert from 'node:assert/strict';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runFixtureAttempt } from './nest-angular-ssr-consumer-attempt.mjs';
import { assertHydration } from './nest-angular-ssr-hydration.mjs';
import {
  assertFastifyTree,
  bindArchive,
  command,
  digest,
  environmentManifest,
  fixtureEnv,
  json,
  nodeVersion,
  readJson,
  selectCells,
  verifyArchive,
} from './nest-angular-ssr-locked-support.mjs';

const publicApi = `import { NestAngularSsrModule, bootstrapNestAngularSsr, createNestAngularSsrIntegration, registerNestAngularSsrRoutes, type AngularSsrRegistrationOptions } from '@anarchitects/nest-angular-ssr';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
declare const app: NestFastifyApplication;
declare const angular: AngularSsrRegistrationOptions;
const options = { angular, routing: {} };
NestAngularSsrModule.forRoot(options);
NestAngularSsrModule.forRootAsync({ useFactory: async () => options });
void bootstrapNestAngularSsr(app, options);
void createNestAngularSsrIntegration;
void registerNestAngularSsrRoutes;
`;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const matrix = await readJson(
  new URL('./nest-angular-ssr-locked-matrix.json', import.meta.url),
);
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    cell: { type: 'string' },
    archive: { type: 'string' },
    'archive-sha256': { type: 'string' },
    'output-directory': { type: 'string' },
    'release-audit': { type: 'boolean', default: false },
  },
});
const selected = values.cell ?? positionals[0] ?? 'nest12';
assert.ok(
  positionals.length <= 1,
  'Supply only one cell or release-line selector',
);
const cellNames = selectCells(matrix, selected);
assert.ok(
  values.archive || !values['archive-sha256'],
  '--archive-sha256 requires --archive',
);
assert.equal(
  process.versions.node,
  nodeVersion,
  'Use the exact reviewed Node proof version',
);
const outputBase = join(root, 'dist/validation/nest12-ssr-740');
await mkdir(outputBase, { recursive: true });
// An explicit directory must be new: never pass with stale certification files.
const output = values['output-directory']
  ? resolve(values['output-directory'])
  : await mkdtemp(join(outputBase, `${selected}-`));
if (values['output-directory']) await mkdir(output, { recursive: false });
console.log(`Evidence: ${output}`);
const results = [];
let interrupted = false;
const interruptionHandlers = new Map(
  ['SIGINT', 'SIGTERM'].map((signal) => [
    signal,
    () => {
      interrupted = true;
      process.exitCode = signal === 'SIGINT' ? 130 : 143;
    },
  ]),
);
for (const [signal, handler] of interruptionHandlers)
  process.on(signal, handler);
function checkInterruption() {
  if (interrupted)
    throw new Error('Matrix interrupted; remaining cells were not executed');
}
const report = {
  releaseAudit: values['release-audit'],
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  cells: results,
};
try {
  report.inputs = await inputHashes();
  report.npm = (await command('npm', ['--version'], root)).trim();
  report.sourceCommit = (
    await command('git', ['rev-parse', 'HEAD'], root)
  ).trim();
  report.workingTree = await command('git', ['status', '--short'], root);
  const packed = values.archive
    ? undefined
    : JSON.parse(
        await command(
          'npm',
          ['pack', '--ignore-scripts', '--json', '--pack-destination', output],
          join(root, 'packages/nest/angular-ssr'),
          { log: join(output, 'pack.log') },
        ),
      )[0];
  const archive = values.archive
    ? resolve(values.archive)
    : join(output, packed.filename);
  const bytes = await readFile(archive);
  if (values.archive) {
    verifyArchive(bytes, values['archive-sha256']);
    await cp(archive, join(output, basename(archive)));
  }
  const manifest = JSON.parse(
    await command('tar', ['-xOf', archive, 'package/package.json'], root),
  );
  report.archive = {
    file: basename(archive),
    source: values.archive ? 'external-verified-archive' : 'working-tree-pack',
    sha256: digest(bytes),
    ...(packed ? { integrity: packed.integrity } : {}),
    manifest,
  };
  for (const [name, versions] of Object.entries(matrix)) {
    checkInterruption();
    if (!cellNames.includes(name)) continue;
    const cellOutput = join(output, name);
    await mkdir(cellOutput);
    const cell = { name, versions, checks: [] };
    results.push(cell);
    const temporary = await mkdtemp(join(tmpdir(), `ssr-${name}-`));
    try {
      const lockRoot = join(
        root,
        'tools/fixtures/nest-angular-ssr-locks',
        name,
      );
      const environment = await readJson(join(lockRoot, 'package.json'));
      assert.deepEqual(
        environment,
        environmentManifest(name, versions),
        'Manifest pins changed; explicitly refresh and review this lock',
      );
      const frozenBytes = await readFile(join(lockRoot, 'package-lock.json'));
      const frozen = JSON.parse(frozenBytes);
      cell.environmentLockSha256 = digest(frozenBytes);
      cell.fastifyCopies = assertFastifyTree(frozen);
      const { pkg, lock } = bindArchive(environment, frozen, manifest, bytes);
      cell.boundLockSha256 = digest(json(lock));
      await writeFile(join(temporary, 'package.json'), json(pkg));
      await writeFile(join(temporary, 'package-lock.json'), json(lock));
      await cp(archive, join(temporary, 'candidate.tgz'));
      await writeFile(join(cellOutput, 'package.json'), json(pkg));
      await writeFile(join(cellOutput, 'package-lock.json'), json(lock));
      const installed = await check(cell, 'install', () =>
        command('npm', ['ci', '--ignore-scripts'], temporary, {
          log: join(cellOutput, 'install.log'),
        }),
      );
      if (!installed) continue;
      assert.equal(
        digest(await readFile(join(temporary, 'package-lock.json'))),
        cell.boundLockSha256,
        'npm ci changed the frozen lock',
      );
      await check(cell, 'dependency-tree', () =>
        command('npm', ['ls', '--all', '--json'], temporary, {
          log: join(cellOutput, 'installed-tree.json'),
        }),
      );
      // Fresh registry evidence is deliberately uncached. The maintenance
      // archive preserves historical compatibility, not a new security claim.
      if (
        values['release-audit'] ||
        (versions.nest.startsWith('12.') && !versions.historical)
      )
        await check(cell, 'runtime-audit', async () => {
          const audit = JSON.parse(
            await command('npm', ['audit', '--omit=dev', '--json'], temporary, {
              log: join(cellOutput, 'runtime-audit.json'),
            }),
          );
          assert.equal(
            audit.metadata?.vulnerabilities?.total,
            0,
            'Runtime advisories require review before certification',
          );
          return {
            checkedAt: new Date().toISOString(),
            vulnerabilities: audit.metadata.vulnerabilities,
          };
        });
      if (versions.direct) {
        for (const mode of ['cjs', 'esm'])
          await direct(temporary, cellOutput, cell, versions, mode);
      }
      if (versions.split) await split(temporary, cellOutput, cell);
    } catch (error) {
      cell.checks.push({
        name: 'preparation',
        status: 'failed',
        error: error.message,
      });
      if (interrupted) throw error;
    } finally {
      await rm(temporary, { recursive: true, force: true });
      cell.status =
        cell.checks.length > 0 &&
        cell.checks.every((check) => check.status === 'passed')
          ? 'passed'
          : 'failed';
      await writeFile(join(cellOutput, 'result.json'), json(cell));
      console.log(`${name}: ${cell.status}`);
    }
  }
} catch (error) {
  report.error = error.message;
  process.exitCode ||= 1;
} finally {
  for (const [signal, handler] of interruptionHandlers)
    process.off(signal, handler);
  report.status =
    !report.error &&
    !interrupted &&
    results.length > 0 &&
    results.every((cell) => cell.status === 'passed')
      ? 'passed'
      : 'failed';
  await writeFile(join(output, 'result.json'), json(report));
}
if (report.status !== 'passed') process.exitCode ||= 1;

async function check(cell, name, action) {
  try {
    checkInterruption();
    const evidence = await action();
    checkInterruption();
    cell.checks.push({
      name,
      status: 'passed',
      ...(typeof evidence === 'object' ? { evidence } : {}),
    });
    return true;
  } catch (error) {
    cell.checks.push({
      name,
      status: 'failed',
      error: error.message,
      ...error.fixtureOutput,
    });
    console.error(`${cell.name}/${name}: ${error.message.slice(0, 500)}`);
    if (interrupted) throw error;
    return false;
  }
}

async function direct(temporary, cellOutput, cell, versions, mode) {
  const fixture = `nest-${mode}-consumer`;
  const app = join(temporary, mode);
  await copyFixture(join(root, 'apps/fixtures', fixture), app);
  // The consumer is outside the repository; its only dependencies are the
  // frozen installation in its temporary parent. No tsconfig source references.
  await writeFile(
    join(app, 'package.json'),
    json({
      name: `consumer-${mode}`,
      private: true,
      type: mode === 'esm' ? 'module' : 'commonjs',
    }),
  );
  const tsconfig = await readJson(join(app, 'tsconfig.app.json'));
  delete tsconfig.references;
  tsconfig.compilerOptions.ignoreDeprecations = versions.typescript.startsWith(
    '5.',
  )
    ? '5.0'
    : '6.0';
  await writeFile(join(app, 'tsconfig.app.json'), json(tsconfig));
  await writeFile(join(app, 'nx.json'), '{}\n');
  await writeFile(
    join(app, 'project.json'),
    json({
      name: `consumer-${mode}`,
      targets: {
        build: {
          executor: 'nx:run-commands',
          options: { command: 'tsc --project tsconfig.app.json' },
        },
      },
    }),
  );
  await writeFile(join(app, 'public-api.mts'), publicApi);
  await writeFile(join(app, 'public-api.cts'), publicApi);
  await writeFile(
    join(app, 'tsconfig.public.json'),
    json({
      compilerOptions: {
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        types: ['node'],
      },
      files: ['public-api.mts', 'public-api.cts'],
    }),
  );
  await check(cell, `${mode}-declarations`, () =>
    command(
      process.execPath,
      [
        join(temporary, 'node_modules/typescript/bin/tsc'),
        '-p',
        'tsconfig.public.json',
      ],
      app,
      { log: join(cellOutput, `${mode}-declarations.log`) },
    ),
  );
  const built = await check(cell, `${mode}-build`, () =>
    nx(temporary, ['run', `consumer-${mode}:build`], app, {
      log: join(cellOutput, `${mode}-build.log`),
    }),
  );
  await check(cell, `${mode}-exports-security`, () =>
    command(
      process.execPath,
      [
        join(root, 'tools/fixtures/probe-nest-angular-ssr-consumer.mjs'),
        temporary,
        mode,
        versions.nest,
      ],
      temporary,
      {
        log: join(cellOutput, `${mode}-exports-security.log`),
        timeoutMs: 60_000,
      },
    ),
  );
  if (!built) return;
  for (const api of ['module', 'async', 'explicit']) {
    await check(cell, `${mode}-${api}-http`, async () => {
      const result = await runFixtureAttempt(
        fixture,
        { appDir: app, port: 0, env: fixtureEnv({ NEST_SSR_API: api }) },
        { mode: 'direct', label: `${mode}/${api}` },
      );
      await writeFile(
        join(cellOutput, `${mode}-${api}-http.json`),
        json(result),
      );
      assert.equal(result.result, 'direct', result.summary);
    });
  }
}

async function split(temporary, cellOutput, cell) {
  const relative = 'apps/fixtures/nest-angular-split';
  const fixtureRoot = join(temporary, relative);
  await copyFixture(join(root, relative), fixtureRoot);
  const backend = join(fixtureRoot, 'backend');
  await writeFile(
    join(backend, 'package.json'),
    json({ name: 'nest-angular-split-backend', private: true }),
  );
  const config = await readJson(join(backend, 'tsconfig.app.json'));
  delete config.references;
  await writeFile(join(backend, 'tsconfig.app.json'), json(config));
  await writeFile(
    join(temporary, 'tsconfig.base.json'),
    json({
      compilerOptions: {
        strict: true,
        target: 'es2022',
        module: 'nodenext',
        moduleResolution: 'nodenext',
        skipLibCheck: true,
      },
    }),
  );
  await writeFile(join(temporary, 'nx.json'), json({ plugins: [] }));
  // Existing fixture targets are reused in the isolated workspace, without a
  // dependency edge back to the package's workspace source.
  for (const part of ['frontend', 'backend']) {
    const path = join(fixtureRoot, part, 'project.json');
    const project = await readJson(path);
    project.implicitDependencies = [];
    project.targets = { 'fixture-build': project.targets['fixture-build'] };
    project.targets['fixture-build'].dependsOn =
      part === 'backend' ? ['nest-angular-split-frontend:fixture-build'] : [];
    project.targets['fixture-build'].cache = false;
    delete project.targets['fixture-build'].inputs;
    await writeFile(path, json(project));
  }
  const built = await check(cell, 'split-build', () =>
    nx(
      temporary,
      ['run', 'nest-angular-split-backend:fixture-build'],
      temporary,
      { log: join(cellOutput, 'split-build.log') },
    ),
  );
  if (!built) return;
  await check(cell, 'split-output-boundary', async () => {
    const bundle = await readFile(join(backend, 'dist/main.js'), 'utf8');
    assert.ok(
      !bundle.includes('@angular/compiler'),
      'Angular compiler leaked into the Nest CJS bundle',
    );
    const server = await readFile(
      join(temporary, 'dist', relative, 'frontend/server/server.mjs'),
      'utf8',
    );
    assert.match(server, /angularSsrEngine/);
  });
  await check(cell, 'split-http-hydration', async () => {
    let browser;
    const result = await runFixtureAttempt(
      'split',
      {
        appDir: temporary,
        port: 0,
        entry: `${relative}/backend/dist/main.js`,
        readyPath: '/api',
        env: fixtureEnv(),
      },
      { mode: 'direct', label: 'split' },
      {
        startupTimeoutMs: 30_000,
        verify: async (port, _name, signal) => {
          for (const [path, status, text] of [
            ['/', 200, 'Rendered by the Angular server bundle.'],
            ['/api', 200, 'Hello API'],
            ['/api/missing', 404],
            ['/missing.css', 404],
            ['/favicon.ico', 200],
          ]) {
            const response = await fetch(`http://127.0.0.1:${port}${path}`, {
              signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
            });
            assert.equal(response.status, status, path);
            const body = await response.text();
            if (text) assert.ok(body.includes(text), path);
          }
          for (const path of ['/', '/favicon.ico']) {
            const response = await fetch(`http://127.0.0.1:${port}${path}`, {
              method: 'HEAD',
              signal: AbortSignal.timeout(5_000),
            });
            assert.equal(response.status, 200);
            assert.equal(await response.text(), '');
          }
          const redirect = await fetch(`http://127.0.0.1:${port}/redirect`, {
            redirect: 'manual',
            signal: AbortSignal.timeout(5_000),
          });
          assert.ok([301, 302, 303, 307, 308].includes(redirect.status));
          assert.equal(redirect.headers.get('location'), '/');
          await redirect.body?.cancel();
          browser = await assertHydration(temporary, port);
        },
      },
    );
    await writeFile(
      join(cellOutput, 'split-http.json'),
      json({ ...result, browser }),
    );
    assert.equal(result.result, 'direct', result.summary);
    return browser;
  });
}

async function copyFixture(source, destination) {
  await cp(source, destination, {
    recursive: true,
    filter: (path) =>
      !/(?:^|\/)(?:node_modules|dist|\.nx|package-lock\.json)$/.test(path),
  });
}

async function nx(installation, args, cwd, options) {
  const packageRoot = join(installation, 'node_modules/nx');
  const { bin } = await readJson(join(packageRoot, 'package.json'));
  return command(
    process.execPath,
    [join(packageRoot, typeof bin === 'string' ? bin : bin.nx), ...args],
    cwd,
    options,
  );
}

async function inputHashes() {
  const paths = [
    'package.json',
    'yarn.lock',
    '.github/workflows/ci.yml',
    '.github/workflows/release-prepare.yml',
    'tools/release/consumer.mjs',
    'tools/release/ssr-certification.mjs',
    'packages/nest/angular-ssr/package.json',
    'packages/nest/angular-ssr/README.md',
    'packages/nest/angular-ssr/vite.config.mts',
  ];
  const visit = async (directory) => {
    for (const entry of await readdir(join(root, directory), {
      withFileTypes: true,
    })) {
      if (['node_modules', 'dist', '.nx', 'out-tsc'].includes(entry.name))
        continue;
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) paths.push(path);
    }
  };
  for (const directory of [
    'packages/nest/angular-ssr/src',
    'apps/fixtures/nest-cjs-consumer',
    'apps/fixtures/nest-esm-consumer',
    'apps/fixtures/nest-angular-split',
    'tools/fixtures/nest-angular-ssr-locks',
  ])
    await visit(directory);
  for (const entry of await readdir(join(root, 'tools/fixtures'))) {
    if (entry.includes('nest-angular-ssr') && /\.(mjs|json)$/.test(entry))
      paths.push(`tools/fixtures/${entry}`);
  }
  return Object.fromEntries(
    await Promise.all(
      paths
        .sort()
        .map(async (path) => [path, digest(await readFile(join(root, path)))]),
    ),
  );
}
