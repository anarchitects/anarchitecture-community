import { buildTypeScriptGovernanceDiagnostics } from './index.js';
import {
  createImportRelation,
  createTsconfigNode,
  createTypeScriptContext,
  createTypeScriptProfile,
  createTypeScriptProjectNode,
  createTypeScriptWorkspace,
  createPathMappingRelation,
} from './test-workspace.js';

describe('TypeScript governance diagnostics', () => {
  it('emits canonical node and relation diagnostics from workspace nodes and relations only', () => {
    const workspace = createTypeScriptWorkspace({
      nodes: [
        createTypeScriptProjectNode({
          id: 'app',
        }),
        createTypeScriptProjectNode({
          id: 'shared',
          packageJson: {
            name: '@repo/shared',
          },
        }),
        createTsconfigNode({
          aliases: {
            '@shared/*': ['packages/shared/*'],
            '@missing/*': ['packages/missing/*'],
          },
        }),
        {
          id: 'other',
          kind: 'service',
          tags: [],
          metadata: {},
        },
      ],
      relations: [
        createImportRelation({
          sourceNodeId: 'app',
          targetNodeId: 'shared',
        }),
        createPathMappingRelation({
          tsconfigNodeId: 'tsconfig:tsconfig.base.json',
          targetNodeId: 'shared',
          alias: '@shared/*',
          target: 'packages/shared/*',
        }),
      ],
    });

    const diagnostics = buildTypeScriptGovernanceDiagnostics({
      workspace,
      profile: createTypeScriptProfile(),
      context: createTypeScriptContext(workspace),
      diagnostics: [],
      signals: [],
      measurements: [],
      violations: [],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'TYPESCRIPT_IMPORT_METADATA_INCOMPLETE',
      'TYPESCRIPT_PATH_MAPPING_UNRESOLVED',
      'TYPESCRIPT_PROJECT_PACKAGE_METADATA_MISSING',
    ]);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'TYPESCRIPT_PROJECT_PACKAGE_METADATA_MISSING',
          reference: {
            nodeId: 'app',
          },
        }),
        expect.objectContaining({
          code: 'TYPESCRIPT_IMPORT_METADATA_INCOMPLETE',
          reference: expect.objectContaining({
            nodeId: 'app',
            relationId: 'typescript:import:app->shared:unknown',
            relatedNodeIds: ['app', 'shared'],
            relatedRelationIds: ['typescript:import:app->shared:unknown'],
          }),
          details: expect.objectContaining({
            missingFields: ['sourceFile', 'specifier'],
          }),
        }),
        expect.objectContaining({
          code: 'TYPESCRIPT_PATH_MAPPING_UNRESOLVED',
          reference: {
            nodeId: 'tsconfig:tsconfig.base.json',
          },
          details: expect.objectContaining({
            alias: '@missing/*',
            declaredTargets: ['packages/missing/*'],
          }),
        }),
      ]),
    );
  });
});
