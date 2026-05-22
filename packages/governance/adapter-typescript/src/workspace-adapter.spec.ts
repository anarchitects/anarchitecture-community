import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  renameSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { GovernanceWorkspaceAdapter } from '@anarchitects/governance-core';

import { createTypeScriptWorkspaceAdapter } from './workspace-adapter.js';

describe('createTypeScriptWorkspaceAdapter', () => {
  it('implements the Core-owned adapter contract and emits canonical adapter results', () => {
    const workspaceRoot = materializeFixture('pnpm');
    const adapter = createTypeScriptWorkspaceAdapter({
      discoveryConfig: {
        projects: [
          {
            pattern: 'apps/*',
            name: '{segment:1}',
            tags: ['type:app'],
          },
          {
            pattern: 'packages/*',
            name: '{segment:1}',
            tags: ['type:lib'],
          },
        ],
      },
    });

    const typedAdapter: GovernanceWorkspaceAdapter<string> = adapter;
    const result = typedAdapter.loadWorkspace(workspaceRoot);

    expect(result.workspaceName).toBe('@fixture/root');
    expect(result.workspaceRoot).toBe('.');
    expect(result.projects).toEqual([
      expect.objectContaining({
        id: 'web',
        root: 'apps/web',
      }),
      expect.objectContaining({
        id: 'customer',
        root: 'packages/customer',
      }),
      expect.objectContaining({
        id: 'order',
        root: 'packages/order',
      }),
    ]);
    expect(result.dependencies).toEqual([
      {
        sourceProjectId: 'customer',
        targetProjectId: 'order',
        type: 'static',
        sourceFile: 'packages/customer/src/index.ts',
      },
      {
        sourceProjectId: 'web',
        targetProjectId: 'customer',
        type: 'static',
        sourceFile: 'apps/web/src/index.ts',
      },
    ]);
    expect(result.diagnostics).toEqual([]);
  });
});

const specDir = fileURLToPath(new URL('.', import.meta.url));

function fixturePath(name: string): string {
  return path.join(
    specDir,
    '..',
    'tests',
    'fixtures',
    'typescript-adapter',
    'workspace-behavior',
    name,
  );
}

function materializeFixture(name: string): string {
  const sourceRoot = fixturePath(name);
  const root = mkdtempSync(
    path.join(tmpdir(), 'governance-typescript-workspace-adapter-'),
  );
  cpSync(sourceRoot, root, { recursive: true });
  materializePackageJsonTemplates(root);
  return root;
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

function renameIfExists(root: string, from: string, to: string): void {
  const source = path.join(root, from);

  if (existsSync(source)) {
    renameSync(source, path.join(root, to));
  }
}
