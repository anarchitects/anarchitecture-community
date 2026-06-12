import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { GovernanceWorkspaceAdapter } from '@anarchitects/governance-core';

import {
  DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
  createGovernanceWorkspaceAdapter,
  createTypeScriptWorkspaceAdapter,
  governanceWorkspaceAdapter,
} from './workspace-adapter.js';

describe('createTypeScriptWorkspaceAdapter', () => {
  it('implements the Core adapter contract with canonical nodes and relations only', () => {
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
      packageGovernanceMetadataConfig:
        DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
    });

    const typedAdapter: GovernanceWorkspaceAdapter<string> = adapter;
    const result = typedAdapter.loadWorkspace(workspaceRoot);

    expect(result.workspaceName).toBe('@fixture/root');
    expect(result.workspaceRoot).toBe('.');
    expect(result).not.toHaveProperty('projects');
    expect(result).not.toHaveProperty('dependencies');
    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workspace:@fixture/root',
          kind: 'package-manager-package',
          sourceSystem: 'pnpm',
        }),
        expect.objectContaining({
          id: 'web',
          name: 'web',
          root: 'apps/web',
          path: 'apps/web',
          kind: 'typescript-workspace-project',
          technology: 'typescript',
          sourceSystem: 'pnpm',
          tags: expect.arrayContaining(['type:app']),
          classification: expect.objectContaining({
            tags: expect.arrayContaining(['type:app']),
          }),
        }),
        expect.objectContaining({
          id: 'customer',
          root: 'packages/customer',
          kind: 'typescript-workspace-project',
        }),
        expect.objectContaining({
          id: 'order',
          root: 'packages/order',
          kind: 'typescript-workspace-project',
        }),
      ]),
    );
    expect(result.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'typescript:workspace-member:workspace:@fixture/root->customer',
          sourceNodeId: 'workspace:@fixture/root',
          targetNodeId: 'customer',
          kind: 'workspace-member',
        }),
        expect.objectContaining({
          sourceNodeId: 'customer',
          targetNodeId: 'order',
          kind: 'import',
          metadata: {
            typescript: {
              import: expect.objectContaining({
                sourceFile: 'packages/customer/src/index.ts',
                importKind: 'static-import',
              }),
            },
          },
        }),
        expect.objectContaining({
          sourceNodeId: 'web',
          targetNodeId: 'customer',
          kind: 'import',
        }),
      ]),
    );
    expect(result.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'governance.typescript.workspace',
        }),
        expect.objectContaining({
          id: 'governance.typescript.tsconfig',
        }),
      ]),
    );
    expect(result.diagnostics).toEqual([]);
  });
});

describe('generic Governance adapter exports', () => {
  it('exports a deterministic default package governance metadata config', () => {
    expect(DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG).toEqual({
      sourceFile: 'package.json',
      path: ['governance'],
      fields: {
        domain: 'domain',
        layer: 'layer',
        scope: 'scope',
        owner: 'owner',
      },
    });
  });

  it('creates a canonical adapter without CLI-owned discovery defaults', () => {
    const workspaceRoot = materializeFixture('pnpm');

    const created = createGovernanceWorkspaceAdapter();
    const typedCreated: GovernanceWorkspaceAdapter<string> = created;
    const typedDefault: GovernanceWorkspaceAdapter<string> =
      governanceWorkspaceAdapter;

    expect(typedCreated.loadWorkspace(workspaceRoot).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'workspace:@fixture/root' }),
        expect.objectContaining({ id: 'web' }),
        expect.objectContaining({ id: 'customer' }),
        expect.objectContaining({ id: 'order' }),
      ]),
    );
    expect(typedDefault.id).toBe('governance-adapter:typescript');
  });

  it('includes metadata diagnostics in canonical loadWorkspace results and continues discovery', () => {
    const workspaceRoot = materializeFixture('pnpm');
    writeJsonFile(path.join(workspaceRoot, 'packages', 'customer'), {
      name: '@fixture/customer',
      governance: {
        domain: 42,
      },
    });

    const adapter = createGovernanceWorkspaceAdapter();
    const result = adapter.loadWorkspace(workspaceRoot);

    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'web' }),
        expect.objectContaining({ id: 'customer' }),
        expect.objectContaining({ id: 'order' }),
      ]),
    );
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'governance.typescript_adapter.invalid_package_governance_metadata_field',
          severity: 'warning',
          kind: 'warning',
          category: 'configuration',
          path: '/package.json/governance/domain',
        }),
      ]),
    );
  });

  it('passes package metadata config through createGovernanceWorkspaceAdapter to canonical node metadata', () => {
    const workspaceRoot = materializeFixture('pnpm');
    writeJsonFile(path.join(workspaceRoot, 'packages', 'customer'), {
      name: '@fixture/customer',
      anarchitects: {
        governance: {
          domain: 'booking',
          layer: 'domain',
          scope: 'booking',
          owner: 'booking-team',
        },
      },
    });

    const adapter = createGovernanceWorkspaceAdapter({
      packageGovernanceMetadataConfig: {
        ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
        path: ['anarchitects', 'governance'],
      },
    });
    const result = adapter.loadWorkspace(workspaceRoot);

    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'customer',
          classification: expect.objectContaining({
            domain: 'booking',
            layer: 'domain',
            scope: 'booking',
          }),
          ownership: expect.objectContaining({
            team: 'booking-team',
            source: 'project-metadata',
          }),
          tags: expect.arrayContaining([
            'domain:booking',
            'layer:domain',
            'scope:booking',
          ]),
        }),
      ]),
    );
  });

  it('emits tsconfig nodes and path-mapping relations when tsconfig artifacts are present', () => {
    const workspaceRoot = materializeTsconfigFixture('alias-baseurl');
    const adapter = createGovernanceWorkspaceAdapter({
      discoveryConfig: {
        projects: [
          { pattern: 'apps/*', name: '{segment:1}', tags: ['type:app'] },
          { pattern: 'packages/*', name: '{segment:1}', tags: ['type:lib'] },
        ],
      },
    });
    const result = adapter.loadWorkspace(workspaceRoot);

    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'tsconfig:tsconfig.json',
          kind: 'typescript-tsconfig',
          technology: 'typescript',
        }),
      ]),
    );
    expect(result.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceNodeId: 'tsconfig:tsconfig.json',
          targetNodeId: 'customer',
          kind: 'path-mapping',
        }),
        expect.objectContaining({
          sourceNodeId: 'tsconfig:tsconfig.json',
          targetNodeId: 'order',
          kind: 'path-mapping',
        }),
      ]),
    );
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

function materializeTsconfigFixture(name: string): string {
  const sourceRoot = path.join(
    specDir,
    '..',
    'tests',
    'fixtures',
    'typescript-adapter',
    'tsconfig-alias-resolution',
    name,
  );
  const root = mkdtempSync(
    path.join(tmpdir(), 'governance-typescript-workspace-adapter-tsconfig-'),
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

function writeJsonFile(root: string, value: Record<string, unknown>): void {
  writeFileSync(path.join(root, 'package.json'), JSON.stringify(value), 'utf8');
}
