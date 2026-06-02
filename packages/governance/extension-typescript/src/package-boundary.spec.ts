import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('TypeScript Governance extension package boundary', () => {
  const packageRoot = path.resolve(
    fileURLToPath(new URL('..', import.meta.url)),
  );

  it('depends only on Governance Core contracts at runtime', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies ?? {})).toEqual([
      '@anarchitects/governance-core',
    ]);
    expect(packageJson.devDependencies).toBeUndefined();
    expect(packageJson.peerDependencies).toBeUndefined();
  });

  it('does not import adapter, CLI, or reporting internals', () => {
    const source = readSourceFiles(path.join(packageRoot, 'src')).join('\n');

    expect(source).not.toMatch(/governance-adapter-typescript/);
    expect(source).not.toMatch(/governance-cli/);
    expect(source).not.toMatch(/governance-reporting/);
    expect(source).not.toMatch(/packages\/governance\/adapter-typescript/);
    expect(source).not.toMatch(/packages\/governance\/cli/);
    expect(source).not.toMatch(/packages\/governance\/reporting/);
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
