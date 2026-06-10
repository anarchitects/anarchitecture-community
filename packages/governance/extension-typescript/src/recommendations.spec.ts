import { buildTypeScriptGovernanceRecommendations } from './index.js';
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

describe('TypeScript governance recommendations', () => {
  it('emits canonical node and relation recommendations', () => {
    const workspace = createTypeScriptWorkspace({
      nodes: [
        createTypeScriptProjectNode({
          id: 'app',
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
    });

    const recommendations = buildTypeScriptGovernanceRecommendations({
      workspace,
      profile: createTypeScriptProfile(),
      context: createTypeScriptContext(workspace),
      diagnostics: [],
      signals: [],
      violations: [],
      measurements: [],
      recommendations: [],
    });

    expect(
      recommendations.map((recommendation) =>
        String(recommendation.metadata?.code ?? ''),
      ),
    ).toEqual(
      expect.arrayContaining([
        'ADD_PACKAGE_METADATA',
        'FIX_PATH_MAPPING',
        'REVIEW_EXTERNAL_PACKAGE_DEPENDENCY',
        'REDUCE_IMPORT_FAN_IN',
      ]),
    );
    expect(recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({
            code: 'ADD_PACKAGE_METADATA',
          }),
          reference: {
            nodeId: 'app',
          },
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            code: 'FIX_PATH_MAPPING',
          }),
          reference: {
            nodeId: 'tsconfig:tsconfig.base.json',
          },
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            code: 'REVIEW_EXTERNAL_PACKAGE_DEPENDENCY',
          }),
          reference: expect.objectContaining({
            relationId:
              'typescript:dependency:app->package:lodash:dependencies',
            relatedNodeIds: ['app', 'package:lodash'],
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            code: 'REDUCE_IMPORT_FAN_IN',
          }),
          reference: {
            nodeId: 'shared',
          },
        }),
      ]),
    );
  });
});
