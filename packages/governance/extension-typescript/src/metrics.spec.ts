import { buildTypeScriptGovernanceMetrics } from './index.js';
import {
  createDependencyRelation,
  createExternalPackageNode,
  createImportRelation,
  createPathMappingRelation,
  createTsconfigNode,
  createTypeScriptContext,
  createTypeScriptProfile,
  createTypeScriptProjectNode,
  createTypeScriptWorkspace,
} from './test-workspace.js';

describe('TypeScript governance metrics', () => {
  it('counts canonical nodes, relations, diagnostics, and signals', () => {
    const workspace = createTypeScriptWorkspace({
      nodes: [
        createTypeScriptProjectNode({
          id: 'app',
          packageJson: { name: '@repo/app' },
        }),
        createTypeScriptProjectNode({
          id: 'feature',
          packageJson: { name: '@repo/feature' },
        }),
        createTypeScriptProjectNode({
          id: 'ui',
          packageJson: { name: '@repo/ui' },
        }),
        createTypeScriptProjectNode({
          id: 'shared',
          packageJson: { name: '@repo/shared' },
        }),
        createExternalPackageNode({
          name: 'lodash',
        }),
        createTsconfigNode({
          aliases: {
            '@shared/*': ['packages/shared/*'],
            '@missing/*': ['packages/missing/*'],
          },
        }),
      ],
      relations: [
        createImportRelation({
          sourceNodeId: 'app',
          targetNodeId: 'shared',
          sourceFile: 'packages/app/src/index.ts',
          specifier: '@shared/index',
        }),
        createImportRelation({
          sourceNodeId: 'feature',
          targetNodeId: 'shared',
          sourceFile: 'packages/feature/src/index.ts',
          specifier: '@shared/index',
        }),
        createImportRelation({
          sourceNodeId: 'ui',
          targetNodeId: 'shared',
          sourceFile: 'packages/ui/src/index.ts',
          specifier: '@shared/index',
        }),
        createPathMappingRelation({
          tsconfigNodeId: 'tsconfig:tsconfig.base.json',
          targetNodeId: 'shared',
          alias: '@shared/*',
          target: 'packages/shared/*',
        }),
        createDependencyRelation({
          sourceNodeId: 'app',
          targetNodeId: 'package:lodash',
          packageName: 'lodash',
        }),
      ],
      capabilities: [
        {
          id: 'governance.typescript.workspace',
          source: 'governance-adapter:typescript',
          data: {
            packageManager: 'pnpm',
          },
        },
      ],
    });

    const measurements = buildTypeScriptGovernanceMetrics({
      workspace,
      profile: createTypeScriptProfile(),
      context: createTypeScriptContext(workspace),
      diagnostics: [],
      signals: [],
      measurements: [],
      violations: [],
    });
    const byId = new Map(
      measurements.map((measurement) => [measurement.id, measurement]),
    );

    expect([...byId.keys()]).toEqual([
      'typescript-workspace-project-count',
      'typescript-tsconfig-count',
      'typescript-import-relation-count',
      'typescript-path-mapping-count',
      'typescript-external-package-dependency-count',
      'typescript-import-hotspot-count',
      'typescript-unresolved-path-mapping-count',
    ]);
    expect(byId.get('typescript-workspace-project-count')).toEqual(
      expect.objectContaining({
        value: 4,
        metadata: expect.objectContaining({
          countedNodeIds: ['app', 'feature', 'shared', 'ui'],
        }),
        dimensions: {
          packageManager: 'pnpm',
        },
      }),
    );
    expect(byId.get('typescript-import-relation-count')).toEqual(
      expect.objectContaining({
        value: 3,
        metadata: expect.objectContaining({
          countedRelationIds: [
            'typescript:import:app->shared:@shared/index',
            'typescript:import:feature->shared:@shared/index',
            'typescript:import:ui->shared:@shared/index',
          ],
        }),
      }),
    );
    expect(byId.get('typescript-import-hotspot-count')).toEqual(
      expect.objectContaining({
        value: 1,
      }),
    );
    expect(byId.get('typescript-unresolved-path-mapping-count')).toEqual(
      expect.objectContaining({
        value: 1,
      }),
    );
  });
});
