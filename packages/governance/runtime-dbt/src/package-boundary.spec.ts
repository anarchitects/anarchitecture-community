import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('dbt Governance runtime package boundary', () => {
  const packageRoot = path.resolve(
    fileURLToPath(new URL('..', import.meta.url)),
  );

  it('has no runtime package dependencies yet', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies).toBeUndefined();
    expect(packageJson.devDependencies).toBeUndefined();
    expect(packageJson.peerDependencies).toBeUndefined();
  });

  it('does not import host, plugin, Nx runtime, or dbt CLI packages', () => {
    const source = readSourceFiles(path.join(packageRoot, 'src')).join('\n');

    expect(source).not.toMatch(/governance-host-dbt/);
    expect(source).not.toMatch(/governance-plugin-dbt/);
    expect(source).not.toMatch(/@nx\//);
    expect(source).not.toMatch(/\bnx\b/);
    expect(source).not.toMatch(/\bdbt\b.*\b(cli|command|commands)\b/i);
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
