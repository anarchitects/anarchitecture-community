import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const adrPath = join(
  workspaceRoot,
  'docs/adr/0001-governance-package-boundaries.md',
);
const hostDbtRuntimeManifestPath = join(
  workspaceRoot,
  'packages/governance/host-dbt/src/anarchitecture_dbt_governance/runtime_manifest.json',
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
      'GovernanceWorkspaceAdapterProbeResult',
      'GovernanceWorkspaceAdapterResult',
      'buildGovernanceAssessment',
      'registerLoadedGovernanceExtensions',
      'GovernanceNodeInput',
      'GovernanceRelationInput',
      'GovernanceRuntimeReference',
      'nodes',
      'relations',
    ],
  },
  {
    projectName: 'governance-adapter-dbt',
    packageName: '@anarchitects/governance-adapter-dbt',
    root: join(workspaceRoot, 'packages/governance/adapter-dbt'),
    sourceIndexPath: join(
      workspaceRoot,
      'packages/governance/adapter-dbt/src/index.ts',
    ),
    readmePath: join(
      workspaceRoot,
      'packages/governance/adapter-dbt/README.md',
    ),
    allowedGovernanceDeps: ['@anarchitects/governance-core'],
    requiredReadmeTerms: [
      '@anarchitects/governance-adapter-dbt',
      'normalizeDbtArtifacts',
      'DbtAdapterResult',
      'GovernanceWorkspaceAdapterResult',
      'nodes',
      'relations',
      'metadata.dbt',
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
      'createGovernanceWorkspaceAdapter',
      'createTypeScriptWorkspaceAdapter',
      'detectTypeScriptWorkspace',
      'parsePackageManagerWorkspace',
      'parseTsConfigResolution',
      'nodes',
      'relations',
    ],
  },
  {
    projectName: 'governance-extension-dbt',
    packageName: '@anarchitects/governance-extension-dbt',
    root: join(workspaceRoot, 'packages/governance/extension-dbt'),
    sourceIndexPath: join(
      workspaceRoot,
      'packages/governance/extension-dbt/src/index.ts',
    ),
    readmePath: join(
      workspaceRoot,
      'packages/governance/extension-dbt/README.md',
    ),
    allowedGovernanceDeps: ['@anarchitects/governance-core'],
    requiredReadmeTerms: [
      '@anarchitects/governance-extension-dbt',
      'dbtGovernanceExtension',
      'workspace.nodes',
      'workspace.relations',
      'nodeId',
      'relationId',
      'relatedNodeIds',
      'relatedRelationIds',
    ],
  },
  {
    projectName: 'governance-extension-typescript',
    packageName: '@anarchitects/governance-extension-typescript',
    root: join(workspaceRoot, 'packages/governance/extension-typescript'),
    sourceIndexPath: join(
      workspaceRoot,
      'packages/governance/extension-typescript/src/index.ts',
    ),
    readmePath: join(
      workspaceRoot,
      'packages/governance/extension-typescript/README.md',
    ),
    allowedGovernanceDeps: ['@anarchitects/governance-core'],
    requiredReadmeTerms: [
      '@anarchitects/governance-extension-typescript',
      'governanceTypeScriptExtension',
      'workspace.nodes',
      'workspace.relations',
      'nodeId',
      'relationId',
      'relatedNodeIds',
      'relatedRelationIds',
    ],
  },
  {
    projectName: 'governance-runtime-dbt',
    packageName: '@anarchitects/governance-runtime-dbt',
    root: join(workspaceRoot, 'packages/governance/runtime-dbt'),
    sourceIndexPath: join(
      workspaceRoot,
      'packages/governance/runtime-dbt/src/index.ts',
    ),
    readmePath: join(
      workspaceRoot,
      'packages/governance/runtime-dbt/README.md',
    ),
    allowedGovernanceDeps: [
      '@anarchitects/governance-adapter-dbt',
      '@anarchitects/governance-core',
      '@anarchitects/governance-extension-dbt',
    ],
    requiredReadmeTerms: [
      '@anarchitects/governance-runtime-dbt',
      'runDbtGovernanceRuntime',
      'runDbtGovernanceRuntimeFromJson',
      'DbtGovernanceRuntimeInput',
      'DbtGovernanceRuntimeResult',
      'profile',
      'adapter',
      'extension',
      'runtime',
      'nodes',
      'relations',
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
      'agov',
      '@anarchitects/governance-core',
      'nodes',
      'relations',
    ],
  },
];

const commands = {
  all() {
    validatePrerequisites();
    validateManifests();
    validateReadmes();
    validateAdrLinks();
    validateExportMetadata();
    validateRuntimeVersionSync();
    validateSourceBoundaries();
    validateCanonicalContractScans();
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
  runtimeVersions() {
    validateRuntimeVersionSync();
  },
  boundaries() {
    validateSourceBoundaries();
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
  assertExists(adrPath);

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
  assertExists(
    join(
      workspaceRoot,
      'packages/governance/adapter-dbt/src/normalize-dbt-artifacts.ts',
    ),
  );
  assertExists(
    join(workspaceRoot, 'packages/governance/extension-dbt/src/index.ts'),
  );
  assertExists(
    join(workspaceRoot, 'packages/governance/runtime-dbt/src/runtime.ts'),
  );
  assertExists(
    join(workspaceRoot, 'packages/governance/runtime-dbt/src/json-boundary.ts'),
  );
  assertExists(hostDbtRuntimeManifestPath);
  assertExists(
    join(
      workspaceRoot,
      'packages/governance/extension-typescript/src/index.ts',
    ),
  );
  assertExists(join(workspaceRoot, 'packages/governance/cli/src/check.ts'));

  const cliManifest = readJson(
    join(workspaceRoot, 'packages/governance/cli/package.json'),
  );
  const cliSource = readFileSync(
    join(workspaceRoot, 'packages/governance/cli/src/agov.ts'),
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
  const forbiddenReadmePatterns = [
    /GovernanceProjectInput/,
    /GovernanceDependencyInput/,
    /GovernanceProject\b/,
    /GovernanceDependency\b/,
    /workspace\.projects/,
    /workspace\.dependencies/,
  ];

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

    for (const pattern of forbiddenReadmePatterns) {
      assert(
        !pattern.test(readme),
        `${pkg.packageName} README still contains a legacy contract term: ${pattern}`,
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

function validateAdrLinks() {
  const supportingDocs = [
    join(workspaceRoot, 'docs/governance-package-boundaries.md'),
    join(workspaceRoot, 'docs/governance-release-conventions.md'),
  ];

  for (const filePath of supportingDocs) {
    const source = readFileSync(filePath, 'utf8');
    assert(
      source.includes('./adr/0001-governance-package-boundaries.md'),
      `${relativePath(filePath)} must link to ADR 0001.`,
    );
  }

  for (const pkg of packages) {
    const readme = readFileSync(pkg.readmePath, 'utf8');
    assert(
      readme.includes(
        '../../../docs/adr/0001-governance-package-boundaries.md',
      ),
      `${pkg.packageName} README must link to ADR 0001.`,
    );
  }
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

function validateRuntimeVersionSync() {
  validateHostRuntimeManifestSync();
  validateNoHardcodedGovernanceSelfVersions();
}

function validateHostRuntimeManifestSync() {
  const runtimeManifest = readJson(
    join(workspaceRoot, 'packages/governance/runtime-dbt/package.json'),
  );
  const hostRuntimeManifest = readJson(hostDbtRuntimeManifestPath);

  assert(
    hostRuntimeManifest.runtimePackage === runtimeManifest.name,
    'governance-host-dbt runtime_manifest.json must pin @anarchitects/governance-runtime-dbt as runtimePackage.',
  );
  assert(
    hostRuntimeManifest.runtimeVersion === runtimeManifest.version,
    `governance-host-dbt runtime_manifest.json runtimeVersion must match ${runtimeManifest.name}@${runtimeManifest.version}.`,
  );
}

function validateNoHardcodedGovernanceSelfVersions() {
  for (const pkg of packages) {
    const manifest = readJson(join(pkg.root, 'package.json'));
    const versionPattern = new RegExp(
      String.raw`['"\`]${escapeRegExp(manifest.version)}['"\`]`,
    );

    for (const filePath of collectImplementationFiles(join(pkg.root, 'src'))) {
      const source = readFileSync(filePath, 'utf8');

      assert(
        !versionPattern.test(source),
        `${pkg.packageName} must not hardcode its own package version in production source: ${relativePath(filePath)}.`,
      );
    }
  }
}

function validateSourceBoundaries() {
  validateCoreSourceBoundaries();
  validateDbtAdapterSourceBoundaries();
  validateAdapterSourceBoundaries();
  validateDbtExtensionSourceBoundaries();
  validateTypeScriptExtensionSourceBoundaries();
  validateDbtRuntimeSourceBoundaries();
  validateCliSourceBoundaries();
}

function validateCoreSourceBoundaries() {
  const sourceRoot = join(workspaceRoot, 'packages/governance/core/src');
  const forbiddenPatterns = [
    /from ['"]@anarchitects\/governance-cli(?:\/|['"])/,
    /from ['"]@anarchitects\/governance-adapter-[^'"]+(?:\/|['"])/,
    /from ['"]@nx\//,
    /from ['"]nx['"]/,
    /anarchitecture-plugins/,
    /tsconfig\.json/,
    /tsconfig\.base\.json/,
  ];

  validateSourceFiles(sourceRoot, forbiddenPatterns, 'Governance Core');
}

function validateAdapterSourceBoundaries() {
  const sourceRoot = join(
    workspaceRoot,
    'packages/governance/adapter-typescript/src',
  );
  const forbiddenPatterns = [
    /from ['"]@anarchitects\/governance-cli(?:\/|['"])/,
    /from ['"]@nx\//,
    /from ['"]nx['"]/,
    /anarchitecture-plugins/,
    /@anarchitects\/governance-core\//,
  ];

  validateSourceFiles(
    sourceRoot,
    forbiddenPatterns,
    'Governance TypeScript adapter',
  );
}

function validateDbtAdapterSourceBoundaries() {
  const sourceRoot = join(workspaceRoot, 'packages/governance/adapter-dbt/src');
  const forbiddenPatterns = [
    /from ['"]@anarchitects\/governance-cli(?:\/|['"])/,
    /from ['"]@nx\//,
    /from ['"]nx['"]/,
    /anarchitecture-plugins/,
    /@anarchitects\/governance-core\//,
  ];

  validateSourceFiles(sourceRoot, forbiddenPatterns, 'Governance dbt adapter');
}

function validateDbtExtensionSourceBoundaries() {
  const sourceRoot = join(
    workspaceRoot,
    'packages/governance/extension-dbt/src',
  );
  const forbiddenPatterns = [
    /from ['"]@anarchitects\/governance-cli(?:\/|['"])/,
    /from ['"]@anarchitects\/governance-adapter-[^'"]+(?:\/|['"])/,
    /from ['"]@nx\//,
    /from ['"]nx['"]/,
    /anarchitecture-plugins/,
    /@anarchitects\/governance-core\//,
  ];

  validateSourceFiles(
    sourceRoot,
    forbiddenPatterns,
    'Governance dbt extension',
  );
}

function validateTypeScriptExtensionSourceBoundaries() {
  const sourceRoot = join(
    workspaceRoot,
    'packages/governance/extension-typescript/src',
  );
  const forbiddenPatterns = [
    /from ['"]@anarchitects\/governance-cli(?:\/|['"])/,
    /from ['"]@anarchitects\/governance-adapter-[^'"]+(?:\/|['"])/,
    /from ['"]@nx\//,
    /from ['"]nx['"]/,
    /anarchitecture-plugins/,
    /@anarchitects\/governance-core\//,
  ];

  validateSourceFiles(
    sourceRoot,
    forbiddenPatterns,
    'Governance TypeScript extension',
  );
}

function validateDbtRuntimeSourceBoundaries() {
  const sourceRoot = join(workspaceRoot, 'packages/governance/runtime-dbt/src');
  const forbiddenPatterns = [
    /from ['"]@anarchitects\/governance-cli(?:\/|['"])/,
    /from ['"]@anarchitects\/governance-adapter-dbt\/.+['"]/,
    /from ['"]@anarchitects\/governance-extension-dbt\/.+['"]/,
    /from ['"]@anarchitects\/governance-core\/.+['"]/,
    /from ['"]@nx\//,
    /from ['"]nx['"]/,
    /from ['"]nx\/src.+['"]/,
    /from ['"]child_process['"]/,
    /from ['"]node:child_process['"]/,
    /from ['"]execa['"]/,
    /from ['"]cross-spawn['"]/,
    /anarchitecture-plugins/,
    /governance-host-dbt/,
    /packages\/governance\/host-dbt/,
    /['"`]\s*dbt\s+(build|parse|run|test|docs|source)\b/i,
  ];

  validateSourceFiles(sourceRoot, forbiddenPatterns, 'Governance dbt runtime');
}

function validateCliSourceBoundaries() {
  const sourceRoot = join(workspaceRoot, 'packages/governance/cli/src');
  const forbiddenPatterns = [
    /from ['"]@anarchitects\/governance-adapter-[^'"]+(?:\/|['"])/,
    /from ['"]@nx\//,
    /from ['"]nx['"]/,
    /anarchitecture-plugins/,
    /@anarchitects\/governance-core\//,
    /tsconfig\.json/,
    /tsconfig\.base\.json/,
    /conventional source folders/,
    /package\.json declares a TypeScript dependency/,
  ];

  validateSourceFiles(sourceRoot, forbiddenPatterns, 'Governance CLI');
}

function validateSourceFiles(sourceRoot, forbiddenPatterns, label) {
  for (const filePath of collectImplementationFiles(sourceRoot)) {
    const source = readFileSync(filePath, 'utf8');

    for (const pattern of forbiddenPatterns) {
      assert(
        !pattern.test(source),
        `${label} contains a forbidden boundary pattern in ${relativePath(filePath)}: ${pattern}`,
      );
    }
  }
}

function validateCanonicalContractScans() {
  const productionRoots = [
    'packages/governance/core/src',
    'packages/governance/adapter-dbt/src',
    'packages/governance/adapter-typescript/src',
    'packages/governance/extension-dbt/src',
    'packages/governance/extension-typescript/src',
    'packages/governance/runtime-dbt/src',
    'packages/governance/cli/src',
  ].map((relative) => join(workspaceRoot, relative));
  const forbiddenPatterns = [
    /GovernanceProjectInput|GovernanceDependencyInput|GovernanceProject|GovernanceDependency|GovernanceCompatibilityWorkspace/,
    /workspace\.projects|workspace\.dependencies/,
    /\bprojectId\b|\btargetProjectId\b|\brelatedProjectIds\b|\baffectedProjects\b|Violation\.project/,
    /\bprojectOverrides\b|\bProjectNameConventionOptions\b|\bProjectRootConventionOptions\b/,
  ];

  for (const sourceRoot of productionRoots) {
    for (const filePath of collectImplementationFiles(sourceRoot)) {
      const source = readFileSync(filePath, 'utf8');
      for (const pattern of forbiddenPatterns) {
        assert(
          !pattern.test(source),
          `Canonical contract scan failed in ${relativePath(filePath)}: ${pattern}`,
        );
      }
    }
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

    if (pkg.packageName === '@anarchitects/governance-cli') {
      const manifest = readJson(join(pkg.root, 'package.json'));
      const binPath = manifest.bin?.agov;

      assert(
        binPath === './dist/bin/agov.js',
        'Governance CLI must expose agov at ./dist/bin/agov.js.',
      );
      assert(
        packedFiles.includes('dist/bin/agov.js'),
        'Governance CLI tarball must include dist/bin/agov.js.',
      );

      const builtBinPath = join(pkg.root, 'dist/bin/agov.js');
      assertExists(builtBinPath);

      const builtBin = readFileSync(builtBinPath, 'utf8');
      assert(
        builtBin.startsWith('#!/usr/bin/env node'),
        'Governance CLI built agov executable must preserve the node shebang.',
      );
    }

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

  if (owner === '@anarchitects/governance-runtime-dbt') {
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertExists(filePath) {
  assert(
    existsSync(filePath),
    `Expected file to exist: ${filePath.replace(`${workspaceRoot}/`, '')}`,
  );
}

function collectImplementationFiles(directory) {
  return readDirectoryRecursively(directory)
    .filter(
      (filePath) =>
        filePath.endsWith('.ts') &&
        !filePath.endsWith('.spec.ts') &&
        !filePath.endsWith('.test.ts') &&
        !filePath.endsWith('.fixtures.ts'),
    )
    .sort((left, right) => left.localeCompare(right));
}

function readDirectoryRecursively(directory) {
  return readFileTree(directory);
}

function readFileTree(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = join(directory, entry.name);
    return entry.isDirectory() ? readFileTree(resolved) : [resolved];
  });
}

function relativePath(filePath) {
  return filePath.replace(`${workspaceRoot}/`, '');
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
