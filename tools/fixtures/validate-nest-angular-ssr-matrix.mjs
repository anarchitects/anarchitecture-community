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
const matrix = JSON.parse(
  await readFile(
    join(
      workspaceRoot,
      'tools/fixtures/nest-angular-ssr-compatibility-matrix.json',
    ),
    'utf8',
  ),
);
const selectedCell = process.argv[2] ?? 'all';
const cellNames = selectedCell === 'all' ? Object.keys(matrix) : [selectedCell];

if (cellNames.some((name) => !(name in matrix))) {
  throw new Error(`Unknown compatibility cell "${selectedCell}".`);
}

if (Number(process.versions.node.split('.')[0]) !== 24) {
  throw new Error(
    `Compatibility tests require Node 24; received ${process.version}.`,
  );
}

await run('yarn', ['nx', 'run', 'nest-angular-ssr:build'], workspaceRoot);
const packRoot = await mkdtemp(join(tmpdir(), 'nest-angular-ssr-matrix-pack-'));
const npmCache = join(packRoot, 'npm-cache');
const tarballName = (
  await run(
    'npm',
    ['pack', '--pack-destination', packRoot],
    packageRoot,
    true,
    {
      npm_config_cache: npmCache,
    },
  )
).trim();
const tarballPath = join(packRoot, tarballName);

try {
  for (const cellName of cellNames) {
    await validateCell(cellName, matrix[cellName], tarballPath, npmCache);
  }
} finally {
  await rm(packRoot, { recursive: true, force: true });
}

async function validateCell(name, versions, tarballPath, npmCache) {
  const cellRoot = await mkdtemp(join(tmpdir(), `nest-angular-ssr-${name}-`));

  try {
    await cp(join(workspaceRoot, 'apps/fixtures/nest-cjs-consumer'), cellRoot, {
      recursive: true,
      filter: (source) =>
        !/(node_modules|dist|package-lock\.json)$/.test(source),
    });

    const packageJsonPath = join(cellRoot, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    for (const dependency of Object.keys(packageJson.dependencies)) {
      if (dependency.startsWith('@angular/')) {
        packageJson.dependencies[dependency] = versions.angular;
      }
    }
    packageJson.dependencies['@anarchitects/nest-angular-ssr'] = tarballPath;
    packageJson.devDependencies.nx = versions.nx;
    packageJson.devDependencies.typescript = versions.typescript;
    await writeFile(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`,
    );
    for (const tsconfigName of ['tsconfig.json', 'tsconfig.app.json']) {
      const tsconfigPath = join(cellRoot, tsconfigName);
      const tsconfig = JSON.parse(await readFile(tsconfigPath, 'utf8'));
      tsconfig.compilerOptions ??= {};
      tsconfig.compilerOptions.ignoreDeprecations =
        versions.typescript.startsWith('5.') ? '5.0' : '6.0';
      delete tsconfig.references;
      await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
    }
    await writeFile(
      join(cellRoot, 'project.json'),
      `${JSON.stringify(
        {
          name: 'consumer',
          root: '.',
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: { command: 'npm run build' },
            },
          },
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(
      join(cellRoot, 'nx.json'),
      `${JSON.stringify({ defaultBase: 'main' }, null, 2)}\n`,
    );

    await run('npm', ['install', '--package-lock=false'], cellRoot, false, {
      npm_config_cache: npmCache,
    });
    await run('npx', ['nx', 'run', 'consumer:build'], cellRoot);
    await run(
      'node',
      ['-e', "require('@anarchitects/nest-angular-ssr')"],
      cellRoot,
    );
    console.log(`Compatibility cell ${name} passed.`, versions);
  } finally {
    await rm(cellRoot, { recursive: true, force: true });
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
