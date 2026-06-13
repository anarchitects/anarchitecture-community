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
import { validateTypeScriptGovernanceModelExpansion } from '@anarchitects/governance-extension-typescript';

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
          kind: 'resource',
          sourceSystem: 'pnpm',
          extensions: expect.objectContaining({
            'governance-extension:typescript': expect.objectContaining({
              data: expect.objectContaining({
                kind: 'node',
                nodeKind: 'package-manager-package',
                packageManagerPackage: expect.objectContaining({
                  workspace: true,
                }),
              }),
            }),
          }),
        }),
        expect.objectContaining({
          id: 'web',
          name: 'web',
          root: 'apps/web',
          path: 'apps/web',
          kind: 'project',
          technology: 'typescript',
          sourceSystem: 'pnpm',
          tags: expect.arrayContaining(['type:app']),
          classification: expect.objectContaining({
            tags: expect.arrayContaining(['type:app']),
          }),
          extensions: expect.objectContaining({
            'governance-extension:typescript': expect.objectContaining({
              data: expect.objectContaining({
                kind: 'node',
                nodeKind: 'workspace-project',
              }),
            }),
          }),
        }),
        expect.objectContaining({
          id: 'customer',
          root: 'packages/customer',
          kind: 'project',
        }),
        expect.objectContaining({
          id: 'order',
          root: 'packages/order',
          kind: 'project',
        }),
      ]),
    );
    expect(result.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'typescript:workspace-member:workspace:@fixture/root->customer',
          sourceNodeId: 'workspace:@fixture/root',
          targetNodeId: 'customer',
          kind: 'traceability',
        }),
        expect.objectContaining({
          sourceNodeId: 'customer',
          targetNodeId: 'order',
          kind: 'dependency',
          extensions: expect.objectContaining({
            'governance-extension:typescript': expect.objectContaining({
              data: expect.objectContaining({
                kind: 'relation',
                relationKind: 'import',
                import: expect.objectContaining({
                  sourceFile: 'packages/customer/src/index.ts',
                  importKind: 'static-import',
                }),
              }),
            }),
          }),
        }),
        expect.objectContaining({
          sourceNodeId: 'web',
          targetNodeId: 'customer',
          kind: 'dependency',
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

  it('maps discovery projections into canonical project node fields', () => {
    const workspaceRoot = materializeFixture('pnpm');
    const adapter = createGovernanceWorkspaceAdapter({
      discoveryConfig: {
        projects: [
          {
            pattern: 'apps/*',
            name: '{segment:1}',
            tags: ['type:app'],
            projection: {
              kind: 'application',
              type: 'frontend-app',
              domain: 'commerce',
              layer: 'app',
              scope: '{segment:1}',
              metadata: {
                runtime: 'browser',
              },
            },
          },
          {
            pattern: 'packages/*',
            name: '{segment:1}',
            tags: ['type:lib'],
            projection: {
              kind: 'library',
            },
          },
        ],
      },
    });
    const result = adapter.loadWorkspace(workspaceRoot);

    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'web',
          kind: 'application',
          classification: expect.objectContaining({
            domain: 'commerce',
            layer: 'app',
            scope: 'web',
            tags: expect.arrayContaining([
              'type:app',
              'domain:commerce',
              'layer:app',
              'scope:web',
            ]),
          }),
          metadata: expect.objectContaining({
            discovery: {
              runtime: 'browser',
            },
          }),
          extensions: expect.objectContaining({
            'governance-extension:typescript': expect.objectContaining({
              data: expect.objectContaining({
                kind: 'node',
                nodeKind: 'workspace-project',
                workspaceProject: expect.objectContaining({
                  type: 'frontend-app',
                }),
              }),
            }),
          }),
        }),
        expect.objectContaining({
          id: 'customer',
          kind: 'library',
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
          kind: 'resource',
          technology: 'typescript',
          extensions: expect.objectContaining({
            'governance-extension:typescript': expect.objectContaining({
              data: expect.objectContaining({
                kind: 'node',
                nodeKind: 'tsconfig',
              }),
            }),
          }),
        }),
      ]),
    );
    expect(result.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceNodeId: 'tsconfig:tsconfig.json',
          targetNodeId: 'customer',
          kind: 'traceability',
        }),
        expect.objectContaining({
          sourceNodeId: 'tsconfig:tsconfig.json',
          targetNodeId: 'order',
          kind: 'traceability',
        }),
      ]),
    );
  });

  it('emits TypeScript expansion envelopes that remain valid for the extension validator', () => {
    const workspaceRoot = materializeFixture('pnpm');
    writeJsonFile(path.join(workspaceRoot, 'packages', 'customer'), {
      name: '@demo/customer',
      private: true,
      dependencies: {
        '@demo/order': 'workspace:*',
        react: '^19.0.0',
      },
    });

    const workspaceAdapter = createGovernanceWorkspaceAdapter({
      discoveryConfig: {
        projects: [
          { pattern: 'apps/*', name: '{segment:1}', tags: ['type:app'] },
          { pattern: 'packages/*', name: '{segment:1}', tags: ['type:lib'] },
        ],
      },
    });
    const workspaceResult = workspaceAdapter.loadWorkspace(workspaceRoot);
    const tsconfigResult = workspaceAdapter.loadWorkspace(
      materializeTsconfigFixture('alias-baseurl'),
    );

    const workspaceExpansion =
      workspaceResult.extensions?.['governance-extension:typescript'];
    const workspacePackageExpansion = readNodeExpansion(
      workspaceResult,
      (expansion) =>
        expansion.data.nodeKind === 'package-manager-package' &&
        expansion.data.packageManagerPackage?.workspace === true,
    );
    const projectNodeExpansion = readNodeExpansion(
      workspaceResult,
      (expansion) => expansion.data.nodeKind === 'workspace-project',
    );
    const externalPackageExpansion = readNodeExpansion(
      workspaceResult,
      (expansion) =>
        expansion.data.nodeKind === 'package-manager-package' &&
        expansion.data.packageManagerPackage?.external === true,
    );
    const tsconfigNodeExpansion = readNodeExpansion(
      tsconfigResult,
      (expansion) => expansion.data.nodeKind === 'tsconfig',
    );
    const workspaceMemberExpansion = readRelationExpansion(
      workspaceResult,
      (expansion) => expansion.data.relationKind === 'workspace-member',
    );
    const packageDependencyExpansion = readRelationExpansion(
      workspaceResult,
      (expansion) => expansion.data.relationKind === 'package-dependency',
    );
    const pathMappingExpansion = readRelationExpansion(
      tsconfigResult,
      (expansion) => expansion.data.relationKind === 'path-alias',
    );
    const importExpansion = readRelationExpansion(
      workspaceResult,
      (expansion) => expansion.data.relationKind === 'import',
    );

    [
      workspaceExpansion,
      workspacePackageExpansion,
      projectNodeExpansion,
      externalPackageExpansion,
      tsconfigNodeExpansion,
      workspaceMemberExpansion,
      packageDependencyExpansion,
      pathMappingExpansion,
      importExpansion,
    ].forEach((expansion) => {
      expect(expansion).toBeDefined();
      expect(expansion).toMatchObject({
        extensionId: 'governance-extension:typescript',
        contractVersion: '1',
      });
      expect(validateTypeScriptGovernanceModelExpansion(expansion)).toEqual([]);
    });
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

interface TypeScriptNodeExpansionEnvelope {
  extensionId: string;
  contractVersion: string;
  data: {
    kind: 'node';
    nodeKind: string;
    packageManagerPackage?: {
      workspace?: boolean;
      external?: boolean;
    };
  };
}

interface TypeScriptRelationExpansionEnvelope {
  extensionId: string;
  contractVersion: string;
  data: {
    kind: 'relation';
    relationKind: string;
  };
}

function readNodeExpansion(
  result: ReturnType<GovernanceWorkspaceAdapter<string>['loadWorkspace']>,
  predicate: (expansion: TypeScriptNodeExpansionEnvelope) => boolean,
): TypeScriptNodeExpansionEnvelope | undefined {
  return result.nodes
    ?.flatMap((node) => {
      const expansion = node.extensions?.['governance-extension:typescript'] as
        | TypeScriptNodeExpansionEnvelope
        | undefined;
      return expansion?.data.kind === 'node' ? [expansion] : [];
    })
    .find((expansion) => predicate(expansion));
}

function readRelationExpansion(
  result: ReturnType<GovernanceWorkspaceAdapter<string>['loadWorkspace']>,
  predicate: (expansion: TypeScriptRelationExpansionEnvelope) => boolean,
): TypeScriptRelationExpansionEnvelope | undefined {
  return result.relations
    ?.flatMap((relation) => {
      const expansion = relation.extensions?.[
        'governance-extension:typescript'
      ] as TypeScriptRelationExpansionEnvelope | undefined;
      return expansion?.data.kind === 'relation' ? [expansion] : [];
    })
    .find((expansion) => predicate(expansion));
}
