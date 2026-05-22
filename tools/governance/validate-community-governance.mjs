import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const tempRoot = mkdtempSync(join(tmpdir(), 'governance-release-gate-'));
const npmCacheDir = join(tempRoot, 'npm-cache');

mkdirSync(npmCacheDir, { recursive: true });

const target = process.argv[2] ?? 'all';

const packages = [
  {
    projectName: 'governance-core',
    packageName: '@anarchitects/governance-core',
    root: join(workspaceRoot, 'packages/governance/core'),
    sourceIndexPath: join(
      workspaceRoot,
      'packages/governance/core/src/index.ts',
    ),
    readmePath: join(workspaceRoot, 'packages/governance/core/README.md'),
    allowedGovernanceDeps: [],
    requiredReadmeTerms: [
      '@anarchitects/governance-core',
      'GovernanceWorkspaceAdapter',
      'GovernanceWorkspaceAdapterResult',
      'buildGovernanceAssessment',
      'registerLoadedGovernanceExtensions',
    ],
  },
  {
    projectName: 'governance-adapter-typescript',
    packageName: '@anarchitects/governance-adapter-typescript',
    root: join(workspaceRoot, 'packages/governance/adapter-typescript'),
    sourceIndexPath: join(
      workspaceRoot,
      'packages/governance/adapter-typescript/src/index.ts',
    ),
    readmePath: join(
      workspaceRoot,
      'packages/governance/adapter-typescript/README.md',
    ),
    allowedGovernanceDeps: ['@anarchitects/governance-core'],
    requiredReadmeTerms: [
      '@anarchitects/governance-adapter-typescript',
      'createTypeScriptWorkspaceAdapter',
      'detectTypeScriptWorkspace',
      'parsePackageManagerWorkspace',
      'parseTsConfigResolution',
    ],
  },
  {
    projectName: 'governance-cli',
    packageName: '@anarchitects/governance-cli',
    root: join(workspaceRoot, 'packages/governance/cli'),
    sourceIndexPath: join(
      workspaceRoot,
      'packages/governance/cli/src/index.ts',
    ),
    readmePath: join(workspaceRoot, 'packages/governance/cli/README.md'),
    allowedGovernanceDeps: ['@anarchitects/governance-core'],
    requiredReadmeTerms: [
      '@anarchitects/governance-cli',
      'runAgovCheck',
      'AgovCheckOptions',
      'AgovCheckResult',
      'AgovCheckWithAdapterOptions',
      'AgovCheckWithWorkspacePathOptions',
    ],
  },
];

const commands = {
  all() {
    validatePrerequisites();
    validateManifests();
    validateReadmes();
    validateExportMetadata();
    return validatePackedArtifacts();
  },
  prerequisites() {
    validatePrerequisites();
  },
  manifests() {
    validateManifests();
  },
  readmes() {
    validateReadmes();
  },
  exports() {
    validateExportMetadata();
  },
  pack() {
    return validatePackedArtifacts();
  },
};

if (!(target in commands)) {
  throw new Error(`Unknown governance validation target "${target}".`);
}

await commands[target]();

console.log(
  JSON.stringify(
    {
      ok: true,
      target,
      packages: packages.map((entry) => entry.packageName),
    },
    null,
    2,
  ),
);

function validatePrerequisites() {
  for (const pkg of packages) {
    assertExists(join(pkg.root, 'package.json'));
    assertExists(pkg.sourceIndexPath);
    assertExists(pkg.readmePath);
  }

  assertExists(
    join(workspaceRoot, 'packages/governance/core/src/extensions/runtime.ts'),
  );
  assertExists(
    join(
      workspaceRoot,
      'packages/governance/adapter-typescript/src/workspace-adapter.ts',
    ),
  );
  assertExists(join(workspaceRoot, 'packages/governance/cli/src/check.ts'));

  const cliManifest = readJson(
    join(workspaceRoot, 'packages/governance/cli/package.json'),
  );
  const cliSource = readFileSync(
    join(workspaceRoot, 'packages/governance/cli/src/check.ts'),
    'utf8',
  );

  assert(
    !hasDependency(cliManifest, '@anarchitects/governance-adapter-typescript'),
    'Governance CLI must not depend on @anarchitects/governance-adapter-typescript.',
  );
  assert(
    !/from ['"]@anarchitects\/governance-adapter-typescript(?:\/|['"])/.test(
      cliSource,
    ),
    'Governance CLI must not import @anarchitects/governance-adapter-typescript.',
  );
}

function validateManifests() {
  for (const pkg of packages) {
    const manifestPath = join(pkg.root, 'package.json');
    const manifest = readJson(manifestPath);
    const allDeps = collectDependencies(manifest);
    const governanceDeps = [...allDeps.keys()].filter((dependency) =>
      dependency.startsWith('@anarchitects/governance-'),
    );

    assert(
      manifest.type === 'module',
      `${pkg.packageName} must remain ESM-first.`,
    );
    assert(
      manifest.main === './dist/index.js' &&
        manifest.module === './dist/index.js' &&
        manifest.types === './dist/index.d.ts',
      `${pkg.packageName} must point main/module/types at dist.`,
    );
    assert(
      manifest.exports?.['./package.json'] === './package.json',
      `${pkg.packageName} must export ./package.json.`,
    );
    assert(
      manifest.exports?.['.']?.types === './dist/index.d.ts' &&
        manifest.exports?.['.']?.import === './dist/index.js' &&
        manifest.exports?.['.']?.default === './dist/index.js',
      `${pkg.packageName} must keep explicit dist exports.`,
    );
    assert(
      Array.isArray(manifest.files) &&
        manifest.files.includes('dist') &&
        manifest.files.includes('!**/*.tsbuildinfo'),
      `${pkg.packageName} must keep the dist-only files whitelist.`,
    );

    for (const dependency of governanceDeps) {
      assert(
        pkg.allowedGovernanceDeps.includes(dependency),
        `${pkg.packageName} has forbidden Governance package dependency "${dependency}".`,
      );
    }

    for (const dependency of allDeps.keys()) {
      assert(
        !isForbiddenDependency(dependency, pkg.packageName),
        `${pkg.packageName} has forbidden dependency "${dependency}".`,
      );
    }
  }
}

function validateReadmes() {
  for (const pkg of packages) {
    const readme = readFileSync(pkg.readmePath, 'utf8');

    assert(
      !containsTransitionalWording(readme),
      `${pkg.packageName} README still contains transitional wording.`,
    );

    for (const term of pkg.requiredReadmeTerms) {
      assert(
        readme.includes(term),
        `${pkg.packageName} README is missing expected public API term "${term}".`,
      );
    }

    assert(
      /## Public API\b/.test(readme),
      `${pkg.packageName} README must include a Public API section.`,
    );
  }

  const cliReadme = readFileSync(
    join(workspaceRoot, 'packages/governance/cli/README.md'),
    'utf8',
  );

  assert(
    !/depends on\s+`?@anarchitects\/governance-adapter-typescript`?/i.test(
      cliReadme,
    ),
    'Governance CLI README must not document @anarchitects/governance-adapter-typescript as a direct CLI dependency.',
  );
  assert(
    !/(yarn|npm|pnpm).+@anarchitects\/governance-adapter-typescript/i.test(
      cliReadme,
    ),
    'Governance CLI README must not instruct users to install @anarchitects/governance-adapter-typescript as a CLI dependency.',
  );
}

function validateExportMetadata() {
  for (const pkg of packages) {
    const manifest = readJson(join(pkg.root, 'package.json'));
    const packageJsonExport = manifest.exports?.['./package.json'];
    const rootExport = manifest.exports?.['.'];

    assert(
      packageJsonExport === './package.json',
      `${pkg.packageName} must export ./package.json.`,
    );
    assert(
      rootExport?.['@anarchitecture-community/source'] === './src/index.ts',
      `${pkg.packageName} must point source export at src/index.ts.`,
    );
  }
}

async function validatePackedArtifacts() {
  for (const pkg of packages) {
    const distIndexJs = join(pkg.root, 'dist/index.js');
    const distIndexDts = join(pkg.root, 'dist/index.d.ts');

    assertExists(distIndexJs);
    assertExists(distIndexDts);

    const packResult = await runCommand(
      'npm',
      ['pack', '--dry-run', '--json'],
      {
        cwd: pkg.root,
        env: {
          ...process.env,
          npm_config_cache: npmCacheDir,
        },
      },
    );
    const parsed = JSON.parse(packResult.stdout);
    const [packInfo] = parsed;
    const packedFiles = packInfo.files.map((entry) => entry.path);

    assert(
      packedFiles.includes('README.md'),
      `${pkg.packageName} tarball must include README.md.`,
    );
    assert(
      packedFiles.includes('package.json'),
      `${pkg.packageName} tarball must include package.json.`,
    );
    assert(
      packedFiles.includes('dist/index.js'),
      `${pkg.packageName} tarball must include dist/index.js.`,
    );
    assert(
      packedFiles.includes('dist/index.d.ts'),
      `${pkg.packageName} tarball must include dist/index.d.ts.`,
    );

    for (const packedFile of packedFiles) {
      assert(
        packedFile === 'README.md' ||
          packedFile === 'package.json' ||
          packedFile.startsWith('dist/'),
        `${pkg.packageName} tarball contains unexpected file "${packedFile}".`,
      );
      assert(
        !packedFile.endsWith('.tsbuildinfo'),
        `${pkg.packageName} tarball must not publish tsbuildinfo files.`,
      );
      assert(
        !/(^|\/)(tests?|fixtures?|coverage|test-output|src)(\/|$)/.test(
          packedFile,
        ),
        `${pkg.packageName} tarball must not publish test, fixture, coverage, or src content: "${packedFile}".`,
      );
    }
  }
}

function containsTransitionalWording(source) {
  return (
    /\bsplit\b/i.test(source) ||
    /\bmigration\b/i.test(source) ||
    /\bmigrated\b/i.test(source) ||
    /\bprepared\b/i.test(source) ||
    /future extraction/i.test(source) ||
    /\bplaceholder\b/i.test(source) ||
    /anarchitecture-plugins/i.test(source) ||
    /Community\/Plugins/i.test(source)
  );
}

function isForbiddenDependency(dependency, owner) {
  if (
    dependency === 'nx' ||
    dependency.startsWith('@nx/') ||
    dependency === '@anarchitects/governance-adapter-nx' ||
    dependency === '@anarchitects/nx-governance' ||
    dependency.includes('anarchitecture-plugins')
  ) {
    return true;
  }

  if (owner === '@anarchitects/governance-core') {
    return (
      dependency === '@anarchitects/governance-cli' ||
      /^@anarchitects\/governance-adapter-/.test(dependency)
    );
  }

  if (owner === '@anarchitects/governance-adapter-typescript') {
    return dependency === '@anarchitects/governance-cli';
  }

  if (owner === '@anarchitects/governance-cli') {
    return /^@anarchitects\/governance-adapter-/.test(dependency);
  }

  return false;
}

function hasDependency(manifest, dependencyName) {
  return collectDependencies(manifest).has(dependencyName);
}

function collectDependencies(manifest) {
  return new Map(
    Object.entries({
      ...(manifest.dependencies ?? {}),
      ...(manifest.peerDependencies ?? {}),
      ...(manifest.optionalDependencies ?? {}),
    }),
  );
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function assertExists(filePath) {
  assert(
    existsSync(filePath),
    `Expected file to exist: ${filePath.replace(`${workspaceRoot}/`, '')}`,
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? workspaceRoot,
      env: options.env ?? process.env,
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

    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
        new Error(
          [
            `Command failed: ${command} ${args.join(' ')}`,
            stderr.trim(),
            stdout.trim(),
          ]
            .filter(Boolean)
            .join('\n'),
        ),
      );
    });
  });
}
