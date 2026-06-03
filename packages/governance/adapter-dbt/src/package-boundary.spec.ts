import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('dbt Governance adapter package boundary', () => {
  const packageRoot = path.resolve(
    fileURLToPath(new URL('..', import.meta.url)),
  );

  it('does not depend on extension, runtime, or host dbt packages', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies ?? {})).toEqual([
      '@anarchitects/governance-core',
      'yaml',
    ]);
    expect(packageJson.devDependencies).toBeUndefined();
    expect(packageJson.peerDependencies).toBeUndefined();
  });

  it('does not import dbt extension, runtime, or host packages', () => {
    const source = readSourceFiles(path.join(packageRoot, 'src')).join('\n');

    expect(source).not.toMatch(/governance-extension-dbt/);
    expect(source).not.toMatch(/governance-runtime-dbt/);
    expect(source).not.toMatch(/governance-host-dbt/);
    expect(source).not.toMatch(/packages\/governance\/extension-dbt/);
    expect(source).not.toMatch(/packages\/governance\/runtime-dbt/);
    expect(source).not.toMatch(/packages\/governance\/host-dbt/);
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
