import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const packageRoot = join(workspaceRoot, 'packages/nest/angular-ssr');
const docsOutputPath = join(
  workspaceRoot,
  'docs/validation/nest-angular-ssr-consumers.md',
);

const fixtures = {
  'nest-cjs-consumer': {
    appDir: join(workspaceRoot, 'apps/fixtures/nest-cjs-consumer'),
    port: 3311,
    attempts: [{ mode: 'direct', label: 'direct' }],
  },
  'nest-esm-consumer': {
    appDir: join(workspaceRoot, 'apps/fixtures/nest-esm-consumer'),
    port: 3312,
    attempts: [{ mode: 'direct', label: 'direct' }],
  },
};

const target = process.argv[2] ?? 'all';

if (!(target in fixtures) && target !== 'all') {
  throw new Error(`Unknown fixture target "${target}".`);
}

const fixtureNames =
  target === 'all' ? Object.keys(fixtures) : [target];

await runCommand('yarn', ['nx', 'sync'], {
  cwd: workspaceRoot,
});

await runCommand('yarn', ['nx', 'build', 'nest-angular-ssr'], {
  cwd: workspaceRoot,
});

const tempDir = await mkdtemp(join(tmpdir(), 'nest-angular-ssr-pack-'));
const npmCacheDir = join(tempDir, 'npm-cache');
const tarballName = (await runCommand(
  'npm',
  ['pack', '--pack-destination', tempDir],
  {
    cwd: packageRoot,
    captureStdout: true,
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
  },
)).trim();
const tarballPath = join(tempDir, tarballName);

const results = [];

try {
  for (const fixtureName of fixtureNames) {
    results.push(await validateFixture(fixtureName, fixtures[fixtureName], tarballPath));
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

if (target === 'all') {
  await mkdir(dirname(docsOutputPath), { recursive: true });
  await writeFile(docsOutputPath, renderResults(results));
}

const failed = results.some((result) => result.result === 'unsupported');

for (const result of results) {
  console.log(JSON.stringify(result, null, 2));
}

if (failed) {
  process.exitCode = 1;
}

async function validateFixture(name, fixture, tarballPath) {
  await cleanFixtureInstall(fixture.appDir);

  await runCommand('npm', ['install', '--package-lock=false'], {
    cwd: fixture.appDir,
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
  });
  await runCommand(
    'npm',
    ['install', '--package-lock=false', '--no-save', tarballPath],
    {
      cwd: fixture.appDir,
      env: {
        ...process.env,
        npm_config_cache: npmCacheDir,
      },
    },
  );
  await runCommand('npm', ['run', 'build'], { cwd: fixture.appDir });

  const attempts = [];

  for (const attempt of fixture.attempts) {
    const outcome = await runFixtureAttempt(name, fixture, attempt);
    attempts.push(outcome);

    if (outcome.result === 'direct' || outcome.result === 'interop') {
      return {
        fixture: name,
        result: outcome.result,
        mode: attempt.mode,
        summary: outcome.summary,
        attempts,
      };
    }
  }

  return {
    fixture: name,
    result: 'unsupported',
    mode: fixture.attempts[fixture.attempts.length - 1].mode,
    summary: attempts[attempts.length - 1]?.summary ?? 'Unsupported.',
    attempts,
  };
}

async function runFixtureAttempt(name, fixture, attempt) {
  const env = {
    ...process.env,
    PORT: String(fixture.port),
    NEST_SSR_CONSUMPTION_MODE: attempt.mode,
  };
  const child = spawn('npm', ['run', 'start'], {
    cwd: fixture.appDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const started = await waitForServer(
    `http://127.0.0.1:${fixture.port}/`,
    child,
  );

  if (!started.ok) {
    return {
      mode: attempt.mode,
      result: 'unsupported',
      summary: `${attempt.label} startup failed: ${started.reason}`,
      stdout,
      stderr,
    };
  }

  try {
    await assertHttpBehavior(fixture.port, name);

    return {
      mode: attempt.mode,
      result: attempt.mode === 'direct' ? 'direct' : 'interop',
      summary:
        attempt.mode === 'direct'
          ? 'Direct package consumption worked.'
          : 'Direct consumption failed; dynamic-import interop worked.',
      stdout,
      stderr,
    };
  } finally {
    child.kill('SIGTERM');
    await waitForExit(child);
  }
}

async function assertHttpBehavior(port, fixtureName) {
  const assetResponse = await fetch(`http://127.0.0.1:${port}/main.js`);
  const assetBody = await assetResponse.text();
  if (!assetResponse.ok || !assetBody.includes(fixtureName)) {
    throw new Error('Static asset assertion failed.');
  }

  const ssrResponse = await fetch(`http://127.0.0.1:${port}/`);
  const ssrBody = await ssrResponse.text();
  if (!ssrResponse.ok || !ssrBody.includes('Fixture')) {
    throw new Error('SSR route assertion failed.');
  }

  const apiResponse = await fetch(`http://127.0.0.1:${port}/api/health`);
  const apiBody = await apiResponse.text();
  if (!apiResponse.ok || apiBody !== 'ok') {
    throw new Error('API bypass assertion failed.');
  }
}

async function cleanFixtureInstall(appDir) {
  await rm(join(appDir, 'node_modules'), { recursive: true, force: true });
  await rm(join(appDir, 'package-lock.json'), { force: true });
  await rm(join(appDir, 'dist'), { recursive: true, force: true });
}

async function waitForServer(url, child) {
  const start = Date.now();
  while (Date.now() - start < 20000) {
    if (child.exitCode !== null) {
      return {
        ok: false,
        reason: `process exited with code ${child.exitCode}`,
      };
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return { ok: true };
      }
    } catch {}

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }

  return { ok: false, reason: 'server did not start in time' };
}

function waitForExit(child) {
  return new Promise((resolvePromise) => {
    if (child.exitCode !== null) {
      resolvePromise();
      return;
    }
    child.once('exit', () => resolvePromise());
  });
}

function renderResults(results) {
  const rows = results
    .map(
      (result) =>
        `| ${result.fixture} | ${result.result} | ${result.mode} | ${result.summary} |`,
    )
    .join('\n');

  return `# Nest Angular SSR Consumer Validation

These fixture apps install the packed \`@anarchitects/nest-angular-ssr\` tarball and exercise it through \`NestAngularSsrModule.forRoot(...)\`.

| Fixture | Classification | Mode | Summary |
| --- | --- | --- | --- |
${rows}
`;
}

async function runCommand(command, args, options) {
  const { cwd, captureStdout = false, env = process.env } = options;

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: captureStdout ? ['ignore', 'pipe', 'inherit'] : 'inherit',
      env,
    });

    let stdout = '';
    if (captureStdout && child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
    }

    child.once('exit', (code) => {
      if (code === 0) {
        resolvePromise(stdout);
        return;
      }

      rejectPromise(
        new Error(`${command} ${args.join(' ')} failed with exit code ${code}`),
      );
    });
  });
}
