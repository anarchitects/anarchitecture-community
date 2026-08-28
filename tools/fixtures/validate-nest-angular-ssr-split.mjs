import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const packageRoot = join(workspaceRoot, 'packages/nest/angular-ssr');
const fixtureRoot = join(workspaceRoot, 'apps/fixtures/nest-angular-split');
const tempRoot = await mkdtemp(join(tmpdir(), 'nest-angular-ssr-split-'));
const npmCache = join(tmpdir(), 'nest-angular-ssr-split-npm-cache');
const port = 3320;

try {
  await run('yarn', ['nx', 'run', 'nest-angular-ssr:build'], workspaceRoot);
  const tarballName = (
    await run(
      'npm',
      ['pack', '--pack-destination', tempRoot],
      packageRoot,
      true,
    )
  ).trim();
  const tarballPath = join(tempRoot, tarballName);

  await cp(fixtureRoot, join(tempRoot, 'apps/fixtures/nest-angular-split'), {
    recursive: true,
    filter: (source) => !/(node_modules|dist)$/.test(source),
  });
  await prepareWorkspace(tarballPath);
  await run('npm', ['install', '--package-lock=false'], tempRoot, false, {
    npm_config_cache: npmCache,
  });
  await run(
    'npx',
    ['nx', 'run', 'nest-angular-split-backend:fixture-build', '--skipNxCache'],
    tempRoot,
  );

  const nestBundle = await readFile(
    join(tempRoot, 'apps/fixtures/nest-angular-split/backend/dist/main.js'),
    'utf8',
  );
  if (nestBundle.includes('@angular/compiler')) {
    throw new Error(
      'The CommonJS Nest bundle unexpectedly contains an @angular/compiler import.',
    );
  }

  const child = spawn(
    'node',
    ['apps/fixtures/nest-angular-split/backend/dist/main.js'],
    {
      cwd: tempRoot,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk.toString()));
  child.stderr.on('data', (chunk) => (output += chunk.toString()));

  try {
    await waitForServer(child, output);
    await assertResponse('/', 200, 'Rendered by the Angular server bundle.');
    await assertRedirect('/redirect', '/');
    await assertResponse('/favicon.ico', 200);
    await assertResponse('/api', 200, 'Hello API');
    await assertResponse('/', 400, 'not allowed', {
      'x-forwarded-host': 'invalid.example',
    });
    console.log('Split Angular/Nest build-output fixture passed.');
  } finally {
    child.kill('SIGTERM');
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function prepareWorkspace(tarballPath) {
  const backendPackagePath = join(
    tempRoot,
    'apps/fixtures/nest-angular-split/backend/package.json',
  );
  const backendPackage = JSON.parse(await readFile(backendPackagePath, 'utf8'));
  backendPackage.dependencies['@anarchitects/nest-angular-ssr'] = tarballPath;
  backendPackage.devDependencies = {
    '@nx/webpack': '23.1.2',
    webpack: '5.107.2',
    'webpack-cli': '^7.0.0',
  };
  await writeFile(
    backendPackagePath,
    `${JSON.stringify(backendPackage, null, 2)}\n`,
  );

  const backendTsconfigPath = join(
    tempRoot,
    'apps/fixtures/nest-angular-split/backend/tsconfig.app.json',
  );
  const backendTsconfig = JSON.parse(
    await readFile(backendTsconfigPath, 'utf8'),
  );
  backendTsconfig.references = [];
  await writeFile(
    backendTsconfigPath,
    `${JSON.stringify(backendTsconfig, null, 2)}\n`,
  );

  await writeFile(
    join(tempRoot, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        workspaces: ['apps/fixtures/nest-angular-split/backend'],
        devDependencies: {
          '@angular/build': '22.1.6',
          '@angular/common': '22.1.4',
          '@angular/compiler': '22.1.4',
          '@angular/compiler-cli': '22.1.4',
          '@angular/core': '22.1.4',
          '@angular/platform-browser': '22.1.4',
          '@angular/platform-server': '22.1.4',
          '@angular/router': '22.1.4',
          '@angular/ssr': '22.1.6',
          '@nx/js': '23.1.2',
          '@nx/webpack': '23.1.2',
          nx: '23.1.2',
          tslib: '^2.8.0',
          typescript: '6.0.3',
          webpack: '5.107.2',
          'webpack-cli': '^7.0.0',
          'zone.js': '^0.16.0',
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(tempRoot, 'nx.json'),
    `${JSON.stringify(
      {
        plugins: [
          {
            plugin: '@nx/webpack/plugin',
            options: { buildTargetName: 'build' },
          },
        ],
        targetDefaults: {
          '@angular/build:application': { dependsOn: ['^build'] },
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(tempRoot, 'tsconfig.base.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          target: 'es2022',
          module: 'nodenext',
          moduleResolution: 'nodenext',
          skipLibCheck: true,
        },
      },
      null,
      2,
    )}\n`,
  );
}

async function waitForServer(child, output) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Split fixture exited before startup.\n${output}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Split fixture did not start.\n${output}`);
}

async function assertResponse(path, status, includes, headers) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
  const body = await response.text();
  if (response.status !== status || (includes && !body.includes(includes))) {
    throw new Error(
      `${path} returned ${response.status}; expected ${status}. Body: ${body}`,
    );
  }
}

async function assertRedirect(path, location) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    redirect: 'manual',
  });
  if (
    ![301, 302, 303, 307, 308].includes(response.status) ||
    response.headers.get('location') !== location
  ) {
    throw new Error(
      `${path} did not redirect to ${location}; received ${response.status} ${response.headers.get('location')}.`,
    );
  }
}

function run(command, args, cwd, capture = false, extraEnv = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    });
    let stdout = '';
    child.stdout?.on('data', (chunk) => (stdout += chunk.toString()));
    child.once('exit', (code) => {
      if (code === 0) resolvePromise(stdout);
      else
        rejectPromise(
          new Error(`${command} ${args.join(' ')} exited with ${code}.`),
        );
    });
  });
}
