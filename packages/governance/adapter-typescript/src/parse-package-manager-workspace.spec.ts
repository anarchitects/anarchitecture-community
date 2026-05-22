import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePackageManagerWorkspace } from './parse-package-manager-workspace.js';

const specDir = fileURLToPath(new URL('.', import.meta.url));

describe('package manager workspace parsing', () => {
  it('parses pnpm workspace configuration deterministically', () => {
    const workspaceRoot = materializeFixture(
      'workspace-parsing/pnpm-workspace',
    );

    expect(parsePackageManagerWorkspace(workspaceRoot)).toEqual({
      packageManager: 'pnpm',
      workspaceRoot,
      patterns: ['apps/*', 'packages/*'],
      packageRoots: ['apps/storefront', 'packages/core'],
      diagnostics: [],
    });
  });

  it('parses npm workspaces from package.json arrays', () => {
    const workspaceRoot = materializeFixture(
      'workspace-parsing/npm-workspaces',
    );

    expect(parsePackageManagerWorkspace(workspaceRoot)).toEqual({
      packageManager: 'npm',
      workspaceRoot,
      patterns: ['packages/*', 'apps/*'],
      packageRoots: ['packages/alpha', 'packages/zeta', 'apps/site'],
      diagnostics: [],
    });
  });

  it('parses yarn workspaces from package.json arrays', () => {
    const workspaceRoot = materializeFixture(
      'workspace-parsing/yarn-workspaces',
    );

    expect(parsePackageManagerWorkspace(workspaceRoot)).toEqual({
      packageManager: 'yarn',
      workspaceRoot,
      patterns: ['packages/*'],
      packageRoots: ['packages/alpha', 'packages/beta'],
      diagnostics: [],
    });
  });

  it('parses object-style workspaces.packages arrays', () => {
    const workspaceRoot = materializeFixture(
      'workspace-parsing/object-workspaces',
    );

    expect(parsePackageManagerWorkspace(workspaceRoot)).toEqual({
      packageManager: 'npm',
      workspaceRoot,
      patterns: ['apps/*', 'packages/*'],
      packageRoots: ['apps/admin', 'packages/shared'],
      diagnostics: [],
    });
  });

  it('normalizes duplicate workspace patterns while preserving first-seen order', () => {
    const workspaceRoot = materializeFixture(
      'workspace-parsing/duplicate-patterns',
    );

    expect(parsePackageManagerWorkspace(workspaceRoot)).toEqual({
      packageManager: 'npm',
      workspaceRoot,
      patterns: ['apps/*', 'packages/*'],
      packageRoots: ['apps/dashboard', 'packages/design-system'],
      diagnostics: [],
    });
  });

  it('emits deterministic diagnostics for partially invalid workspace configuration', () => {
    const workspaceRoot = materializeFixture(
      'workspace-parsing/invalid-workspace-config',
    );

    expect(parsePackageManagerWorkspace(workspaceRoot)).toEqual({
      packageManager: 'pnpm',
      workspaceRoot,
      patterns: ['apps/*'],
      packageRoots: ['apps/valid-app'],
      diagnostics: [
        {
          code: 'governance.typescript_adapter.invalid_workspace_config',
          message: 'Workspace pattern must be a non-empty string.',
          source: 'governance.typescript_adapter',
          path: '/packages/1',
        },
        {
          code: 'governance.typescript_adapter.invalid_workspace_config',
          message: 'Workspace pattern must be a non-empty string.',
          source: 'governance.typescript_adapter',
          path: '/packages/2',
        },
      ],
    });
  });

  it('emits a deterministic diagnostic when patterns match no package roots', () => {
    const workspaceRoot = materializeFixture('workspace-parsing/empty-matches');

    expect(parsePackageManagerWorkspace(workspaceRoot)).toEqual({
      packageManager: 'npm',
      workspaceRoot,
      patterns: ['apps/*'],
      packageRoots: [],
      diagnostics: [
        {
          code: 'governance.typescript_adapter.no_workspace_packages_found',
          message: 'Workspace patterns did not resolve to any package roots.',
          source: 'governance.typescript_adapter',
          details: {
            patterns: ['apps/*'],
          },
        },
      ],
    });
  });

  it('emits a deterministic diagnostic for unsupported workspace shapes', () => {
    const workspaceRoot = materializeFixture(
      'workspace-parsing/unsupported-workspace-shape',
    );

    expect(parsePackageManagerWorkspace(workspaceRoot)).toEqual({
      packageManager: 'npm',
      workspaceRoot,
      patterns: [],
      packageRoots: [],
      diagnostics: [
        {
          code: 'governance.typescript_adapter.unsupported_workspace_format',
          message:
            'package.json object-style workspaces must define a "packages" array.',
          source: 'governance.typescript_adapter',
          path: '/workspaces',
        },
      ],
    });
  });

  it('keeps diagnostic ordering stable across repeated runs', () => {
    const workspaceRoot = materializeFixture(
      'workspace-parsing/invalid-workspace-config',
    );

    expect(parsePackageManagerWorkspace(workspaceRoot).diagnostics).toEqual(
      parsePackageManagerWorkspace(workspaceRoot).diagnostics,
    );
  });

  it('does not import Nx APIs', () => {
    const parserSource = readFileSync(
      path.join(specDir, 'parse-package-manager-workspace.ts'),
      'utf8',
    );
    const normalizerSource = readFileSync(
      path.join(specDir, 'normalize-workspace-patterns.ts'),
      'utf8',
    );
    const resolverSource = readFileSync(
      path.join(specDir, 'resolve-workspace-packages.ts'),
      'utf8',
    );

    expect(parserSource).not.toMatch(/from ['"]nx['"]/);
    expect(parserSource).not.toMatch(/from ['"]@nx\//);
    expect(normalizerSource).not.toMatch(/from ['"]nx['"]/);
    expect(normalizerSource).not.toMatch(/from ['"]@nx\//);
    expect(resolverSource).not.toMatch(/from ['"]nx['"]/);
    expect(resolverSource).not.toMatch(/from ['"]@nx\//);
  });
});

function fixturePath(name: string): string {
  return path.join(specDir, '..', 'tests', 'fixtures', 'fixtures', name);
}

function materializeFixture(name: string): string {
  const sourceRoot = fixturePath(name);
  const targetRoot = mkdtempSync(
    path.join(tmpdir(), 'governance-typescript-workspaces-'),
  );

  cpSync(sourceRoot, targetRoot, { recursive: true });
  materializePackageJsonTemplates(targetRoot);

  return targetRoot;
}

function materializePackageJsonTemplates(root: string): void {
  renameIfExists(root, 'fixture.package.json', 'package.json');

  for (const childEntry of readdirSync(root, { withFileTypes: true }).sort(
    (left, right) => left.name.localeCompare(right.name),
  )) {
    if (!childEntry.isDirectory()) {
      continue;
    }

    materializePackageJsonTemplates(path.join(root, childEntry.name));
  }
}

function renameIfExists(
  directory: string,
  sourceName: string,
  targetName: string,
): void {
  const sourcePath = path.join(directory, sourceName);

  if (existsSync(sourcePath)) {
    renameSync(sourcePath, path.join(directory, targetName));
  }
}
