import { buildTypeScriptGovernanceSignals } from './index.js';
import {
  createDependencyRelation,
  createImportRelation,
  createPathMappingRelation,
  createTsconfigNode,
  createTypeScriptContext,
  createTypeScriptProfile,
  createTypeScriptProjectNode,
  createTypeScriptWorkspace,
  createExternalPackageNode,
} from './test-workspace.js';

function createSignalWorkspace() {
  return createTypeScriptWorkspace({
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
  });
}

describe('TypeScript governance signals', () => {
  it('emits canonical node and relation signals and ignores compatibility workspace fields', () => {
    const workspace = createSignalWorkspace();

    const signals = buildTypeScriptGovernanceSignals({
      workspace,
      profile: createTypeScriptProfile(),
      context: createTypeScriptContext(workspace),
      diagnostics: [],
      signals: [],
      violations: [],
    });

    expect(
      signals.map((signal) => String(signal.metadata?.code ?? '')),
    ).toEqual(
      expect.arrayContaining([
        'TYPESCRIPT_IMPORT_RELATION_DETECTED',
        'TYPESCRIPT_PATH_MAPPING_RESOLVED',
        'TYPESCRIPT_EXTERNAL_PACKAGE_DEPENDENCY_DETECTED',
        'TYPESCRIPT_HIGH_IMPORT_FAN_IN',
        'TYPESCRIPT_PATH_MAPPING_UNRESOLVED',
      ]),
    );
    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relationId: 'typescript:dependency:app->package:lodash:dependencies',
          relatedNodeIds: ['app', 'package:lodash'],
          metadata: expect.objectContaining({
            code: 'TYPESCRIPT_EXTERNAL_PACKAGE_DEPENDENCY_DETECTED',
          }),
        }),
        expect.objectContaining({
          nodeId: 'shared',
          relatedRelationIds: expect.arrayContaining([
            'typescript:import:app->shared:@shared/index',
            'typescript:import:feature->shared:@shared/index',
            'typescript:import:ui->shared:@shared/index',
          ]),
          metadata: expect.objectContaining({
            code: 'TYPESCRIPT_HIGH_IMPORT_FAN_IN',
            fanIn: 3,
          }),
        }),
      ]),
    );
  });

  it('is deterministic for equivalent canonical workspaces', () => {
    const workspace = createSignalWorkspace();
    const reversedWorkspace = createTypeScriptWorkspace({
      nodes: [...workspace.nodes].reverse(),
      relations: [...workspace.relations].reverse(),
    });
    const profile = createTypeScriptProfile();

    const left = buildTypeScriptGovernanceSignals({
      workspace,
      profile,
      context: createTypeScriptContext(workspace),
      diagnostics: [],
      signals: [],
      violations: [],
    });
    const right = buildTypeScriptGovernanceSignals({
      workspace: reversedWorkspace,
      profile,
      context: createTypeScriptContext(reversedWorkspace),
      diagnostics: [],
      signals: [],
      violations: [],
    });

    expect(right).toEqual(left);
  });
});
