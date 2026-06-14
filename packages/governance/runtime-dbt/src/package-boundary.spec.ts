import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('dbt Governance runtime package boundary', () => {
  const packageRoot = path.resolve(
    fileURLToPath(new URL('..', import.meta.url)),
  );

  it('depends only on public Governance adapter, extension, and Core packages at runtime', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies ?? {})).toEqual([
      '@anarchitects/governance-adapter-dbt',
      '@anarchitects/governance-extension-dbt',
      '@anarchitects/governance-core',
    ]);
    expect(packageJson.devDependencies).toBeUndefined();
    expect(packageJson.peerDependencies).toBeUndefined();
  });

  it('does not import adapter or extension internals, host, plugin, Nx runtime, or dbt CLI packages', () => {
    const source = readSourceFiles(path.join(packageRoot, 'src')).join('\n');

    expect(source).not.toMatch(/@anarchitects\/governance-adapter-dbt\/.+/);
    expect(source).not.toMatch(/@anarchitects\/governance-extension-dbt\/.+/);
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
