import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type PackageManifest = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  files?: string[];
};

describe('Governance package architectural boundary regression', () => {
  it('keeps package manifests free of forbidden cross-package and Nx runtime dependencies', () => {
    const repoRoot = resolveRepoRoot();

    const cliManifest = readManifest(
      path.join(repoRoot, 'packages/governance/cli/package.json'),
    );
    const coreManifest = readManifest(
      path.join(repoRoot, 'packages/governance/core/package.json'),
    );
    const adapterManifest = readManifest(
      path.join(
        repoRoot,
        'packages/governance/adapter-typescript/package.json',
      ),
    );

    const cliDependencies = allDependencyNames(cliManifest);
    const coreDependencies = allDependencyNames(coreManifest);
    const adapterDependencies = allDependencyNames(adapterManifest);

    for (const dependencyName of cliDependencies) {
      expect(dependencyName).not.toMatch(/^@anarchitects\/governance-adapter-/);
      expect(dependencyName).not.toBe('nx');
      expect(dependencyName).not.toMatch(/^@nx\//);
      expect(dependencyName).not.toBe('@anarchitects/nx-governance');
    }

    for (const dependencyName of coreDependencies) {
      expect(dependencyName).not.toBe('@anarchitects/governance-cli');
      expect(dependencyName).not.toMatch(/^@anarchitects\/governance-adapter-/);
      expect(dependencyName).not.toBe('nx');
      expect(dependencyName).not.toMatch(/^@nx\//);
      expect(dependencyName).not.toBe('@anarchitects/nx-governance');
    }

    for (const dependencyName of adapterDependencies) {
      expect(dependencyName).not.toBe('@anarchitects/governance-cli');
      expect(dependencyName).not.toBe('nx');
      expect(dependencyName).not.toMatch(/^@nx\//);
      expect(dependencyName).not.toBe('@anarchitects/nx-governance');
    }
  });

  it('keeps implementation imports within ADR 0001 boundaries', () => {
    const repoRoot = resolveRepoRoot();

    const cliFiles = collectImplementationFiles(
      path.join(repoRoot, 'packages/governance/cli/src'),
    );
    const coreFiles = collectImplementationFiles(
      path.join(repoRoot, 'packages/governance/core/src'),
    );
    const adapterFiles = collectImplementationFiles(
      path.join(repoRoot, 'packages/governance/adapter-typescript/src'),
    );

    for (const filePath of cliFiles) {
      const source = readFileSync(filePath, 'utf8');

      expect(source).not.toMatch(
        /from ['"]@anarchitects\/governance-adapter-[^'"]+(?:\/|['"])/,
      );
      expect(source).not.toMatch(/from ['"]nx['"]/);
      expect(source).not.toMatch(/from ['"]@nx\//);
      expect(source).not.toMatch(/from ['"]@anarchitects\/nx-governance['"]/);
      expect(source).not.toMatch(/anarchitecture-plugins/);
    }

    for (const filePath of coreFiles) {
      const source = readFileSync(filePath, 'utf8');

      expect(source).not.toMatch(
        /from ['"]@anarchitects\/governance-cli(?:\/|['"])/,
      );
      expect(source).not.toMatch(
        /from ['"]@anarchitects\/governance-adapter-[^'"]+(?:\/|['"])/,
      );
      expect(source).not.toMatch(/from ['"]nx['"]/);
      expect(source).not.toMatch(/from ['"]@nx\//);
      expect(source).not.toMatch(/from ['"]@anarchitects\/nx-governance['"]/);
      expect(source).not.toMatch(/anarchitecture-plugins/);
    }

    for (const filePath of adapterFiles) {
      const source = readFileSync(filePath, 'utf8');

      expect(source).not.toMatch(
        /from ['"]@anarchitects\/governance-cli(?:\/|['"])/,
      );
      expect(source).not.toMatch(/from ['"]nx['"]/);
      expect(source).not.toMatch(/from ['"]@nx\//);
      expect(source).not.toMatch(/from ['"]@anarchitects\/nx-governance['"]/);
      expect(source).not.toMatch(/anarchitecture-plugins/);
    }
  });

  it('prevents TypeScript-specific adapter inference heuristics in CLI runtime resolution', () => {
    const agovFilePath = path.join(
      resolveRepoRoot(),
      'packages/governance/cli/src/agov.ts',
    );
    const source = readFileSync(agovFilePath, 'utf8');

    expect(source).not.toMatch(/tsconfig\.json/);
    expect(source).not.toMatch(/tsconfig\.base\.json/);
    expect(source).not.toMatch(/\*\*\/\*\.ts/);
    expect(source).not.toMatch(/\.ts\b/);
  });

  it('keeps publish file lists focused on built artifacts without test fixture leakage', () => {
    const repoRoot = resolveRepoRoot();
    const manifests = [
      readManifest(path.join(repoRoot, 'packages/governance/cli/package.json')),
      readManifest(
        path.join(repoRoot, 'packages/governance/core/package.json'),
      ),
      readManifest(
        path.join(
          repoRoot,
          'packages/governance/adapter-typescript/package.json',
        ),
      ),
    ];

    for (const manifest of manifests) {
      const files = manifest.files ?? [];

      expect(files).toContain('dist');
      expect(files).not.toContain('src');
      expect(files).not.toContain('tests');
      expect(files.join(' ')).not.toMatch(/fixtures?/i);
    }
  });
});

function resolveRepoRoot(): string {
  const sourceRoot = fileURLToPath(new URL('.', import.meta.url));
  return path.resolve(sourceRoot, '../../../../');
}

function readManifest(filePath: string): PackageManifest {
  return JSON.parse(readFileSync(filePath, 'utf8')) as PackageManifest;
}

function allDependencyNames(manifest: PackageManifest): string[] {
  const names = new Set<string>([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);

  return [...names].sort((left, right) => left.localeCompare(right));
}

function collectImplementationFiles(directory: string): string[] {
  const collected: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      collected.push(...collectImplementationFiles(resolved));
      continue;
    }

    if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.fixtures.ts')
    ) {
      collected.push(resolved);
    }
  }

  return collected.sort((left, right) => left.localeCompare(right));
}
