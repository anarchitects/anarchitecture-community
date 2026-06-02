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
      packageGovernanceMetadataConfig:
        DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
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
    expect(result.nodes).toEqual([
      expect.objectContaining({
        id: 'web',
        name: 'web',
        root: 'apps/web',
        path: 'apps/web',
        kind: 'application',
        technology: 'typescript',
        sourceSystem: 'typescript',
        tags: expect.arrayContaining(['type:app']),
        classification: expect.objectContaining({
          tags: expect.arrayContaining(['type:app']),
        }),
        metadata: expect.objectContaining({
          projectType: 'application',
          compatibilityProjectType: 'unknown',
        }),
      }),
      expect.objectContaining({
        id: 'customer',
        root: 'packages/customer',
        kind: 'library',
        tags: expect.arrayContaining(['type:lib']),
      }),
      expect.objectContaining({
        id: 'order',
        root: 'packages/order',
        kind: 'library',
        tags: expect.arrayContaining(['type:lib']),
      }),
    ]);
    expect(result.relations).toEqual([
      expect.objectContaining({
        id: 'legacy:customer->order:static:0',
        sourceNodeId: 'customer',
        targetNodeId: 'order',
        kind: 'dependency',
        metadata: expect.objectContaining({
          dependencyType: 'static',
          compatibilityDependencyType: 'static',
          sourceFile: 'packages/customer/src/index.ts',
        }),
      }),
      expect.objectContaining({
        id: 'legacy:web->customer:static:1',
        sourceNodeId: 'web',
        targetNodeId: 'customer',
        kind: 'dependency',
        metadata: expect.objectContaining({
          dependencyType: 'static',
          compatibilityDependencyType: 'static',
          sourceFile: 'apps/web/src/index.ts',
        }),
      }),
    ]);
    expect(result.nodes?.map((node) => node.id)).toEqual(
      result.projects?.map((project) => project.id),
    );
    expect(
      result.relations?.map((relation) => ({
        sourceProjectId: relation.sourceNodeId,
        targetProjectId: relation.targetNodeId,
        type: relation.metadata?.dependencyType,
        sourceFile: relation.metadata?.sourceFile,
      })),
    ).toEqual(result.dependencies);
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

  it('creates a compatible adapter without host-owned discovery defaults in the CLI', () => {
    const workspaceRoot = materializeFixture('pnpm');

    const created = createGovernanceWorkspaceAdapter();
    const typedCreated: GovernanceWorkspaceAdapter<string> = created;
    const typedDefault: GovernanceWorkspaceAdapter<string> =
      governanceWorkspaceAdapter;

    expect(typedCreated.loadWorkspace(workspaceRoot).projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'web' }),
        expect.objectContaining({ id: 'customer' }),
        expect.objectContaining({ id: 'order' }),
      ]),
    );
    expect(typedDefault.id).toBe('governance-adapter:typescript');
  });

  it('implements the optional Core-owned probe contract', () => {
    const adapter = createGovernanceWorkspaceAdapter();

    expect(adapter.probe).toBeTypeOf('function');

    const result = adapter.probe?.(materializeFixture('pnpm'));
    expect(result).toMatchObject({
      supported: true,
      confidence: 'high',
    });
  });

  it('includes metadata diagnostics in loadWorkspace results and continues discovery', () => {
    const workspaceRoot = materializeFixture('pnpm');
    writeJsonFile(path.join(workspaceRoot, 'packages', 'customer'), {
      name: '@fixture/customer',
      governance: {
        domain: 42,
      },
    });

    const adapter = createGovernanceWorkspaceAdapter();
    const result = adapter.loadWorkspace(workspaceRoot);

    expect(result.projects).toEqual(
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

  it('passes package metadata config through createGovernanceWorkspaceAdapter to discovery', () => {
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

    expect(result.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'customer',
          domain: 'booking',
          layer: 'domain',
          scope: 'booking',
          metadata: expect.objectContaining({ owner: 'booking-team' }),
          tags: expect.arrayContaining([
            'domain:booking',
            'layer:domain',
            'scope:booking',
          ]),
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
