import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('dbt Governance runtime package boundary', () => {
  const packageRoot = path.resolve(
    fileURLToPath(new URL('..', import.meta.url)),
  );
  const allowedRuntimeDependencies = [
    '@anarchitects/governance-adapter-dbt',
    '@anarchitects/governance-core',
    '@anarchitects/governance-extension-dbt',
  ];

  it('depends only on public Governance adapter, extension, and Core packages at runtime', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies ?? {})).toEqual(
      allowedRuntimeDependencies,
    );
    expect(packageJson.dependencies).not.toHaveProperty('governance-host-dbt');
    expect(packageJson.dependencies).not.toHaveProperty(
      '@anarchitects/governance-host-dbt',
    );
    expect(packageJson.dependencies).not.toHaveProperty(
      'anarchitecture-plugins',
    );
    expect(packageJson.dependencies).not.toHaveProperty('@nx/devkit');
    expect(packageJson.dependencies).not.toHaveProperty('execa');
    expect(packageJson.dependencies).not.toHaveProperty('cross-spawn');
    expect(packageJson.devDependencies).toBeUndefined();
    expect(packageJson.peerDependencies).toBeUndefined();
  });

  it('does not import forbidden host, plugin, Nx, private adapter, or private extension modules', () => {
    const source = readSourceFiles(path.join(packageRoot, 'src')).join('\n');

    expect(source).not.toMatch(/@anarchitects\/governance-adapter-dbt\/.+/);
    expect(source).not.toMatch(/@anarchitects\/governance-extension-dbt\/.+/);
    expect(source).not.toMatch(/packages\/governance\/host-dbt/);
    expect(source).not.toMatch(/governance-host-dbt/);
    expect(source).not.toMatch(/governance-plugin-dbt/);
    expect(source).not.toMatch(/anarchitecture-plugins/);
    expect(source).not.toMatch(/from ['"]@nx\/.+['"]/);
    expect(source).not.toMatch(/from ['"]nx\/src.+['"]/);
  });

  it('does not use process spawning, shell execution, or direct dbt command invocation in production code', () => {
    const source = readSourceFiles(path.join(packageRoot, 'src')).join('\n');

    expect(source).not.toMatch(/from ['"]child_process['"]/);
    expect(source).not.toMatch(/from ['"]node:child_process['"]/);
    expect(source).not.toMatch(/from ['"]execa['"]/);
    expect(source).not.toMatch(/from ['"]cross-spawn['"]/);
    expect(source).not.toMatch(
      /\b(exec|execFile|fork|spawn|spawnSync|execSync)\s*\(/,
    );
    expect(source).not.toMatch(
      /['"`]\s*dbt\s+(build|parse|run|test|docs|source)\b/i,
    );
  });

  it('does not reintroduce legacy project or dependency contracts in production code', () => {
    const source = readSourceFiles(path.join(packageRoot, 'src')).join('\n');

    expect(source).not.toMatch(/\bGovernanceProject\b/);
    expect(source).not.toMatch(/\bGovernanceDependency\b/);
    expect(source).not.toMatch(/\bGovernanceProjectInput\b/);
    expect(source).not.toMatch(/\bGovernanceDependencyInput\b/);
    expect(source).not.toMatch(/\bworkspace\.projects\b/);
    expect(source).not.toMatch(/\bworkspace\.dependencies\b/);
  });
});

function readSourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      return readSourceFiles(entryPath);
    }

    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) {
      return [];
    }

    return [readFileSync(entryPath, 'utf8')];
  });
}
