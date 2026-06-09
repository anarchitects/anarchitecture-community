import {
  buildGovernanceWorkspace,
  normalizeGovernanceGraph,
  type GovernanceWorkspaceAdapterResult,
} from '../../index.js';

describe('Phase 2 compatibility contracts', () => {
  it('uses canonical workspace node and relation output from nested workspace input', () => {
    const adapterResult = {
      workspace: {
        id: 'compatibility',
        name: 'compatibility',
        root: '.',
        nodes: [
          {
            id: 'app',
            name: 'App',
            kind: 'application',
            tags: ['domain:customer'],
            classification: {
              domain: 'customer',
              layer: 'app',
            },
            metadata: {
              compatibility: true,
            },
          },
          {
            id: 'shared',
            name: 'Shared',
            kind: 'library',
            tags: [],
            metadata: {},
          },
        ],
        relations: [
          {
            id: 'canonical:app->shared:dependency:0',
            sourceNodeId: 'app',
            targetNodeId: 'shared',
            kind: 'dependency',
            metadata: {
              dependencyType: 'static',
              source: 'nested-workspace',
            },
          },
        ],
      },
    } satisfies GovernanceWorkspaceAdapterResult;

    const workspace = buildGovernanceWorkspace(adapterResult);
    const graph = normalizeGovernanceGraph(adapterResult);

    expect(workspace.nodes.map((node) => node.id)).toEqual(['app', 'shared']);
    expect(workspace.relations).toEqual([
      expect.objectContaining({
        sourceNodeId: 'app',
        targetNodeId: 'shared',
        kind: 'dependency',
      }),
    ]);
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'app',
          kind: 'application',
          classification: {
            domain: 'customer',
            layer: 'app',
          },
        }),
      ]),
    );
    expect(graph.relations).toEqual([
      expect.objectContaining({
        sourceNodeId: 'app',
        targetNodeId: 'shared',
        kind: 'dependency',
        metadata: {
          dependencyType: 'static',
          source: 'nested-workspace',
        },
      }),
    ]);
  });

  it('prefers top-level canonical node and relation output over nested workspace canonical data', () => {
    const adapterResult = {
      workspace: {
        id: 'workspace',
        name: 'workspace',
        root: '/workspace',
        nodes: [
          {
            id: 'same-id',
            name: 'Nested Canonical Node',
            kind: 'resource',
            tags: [],
            metadata: {},
          },
        ],
        relations: [
          {
            id: 'canonical:same-id->nested-only:traceability:0',
            sourceNodeId: 'same-id',
            targetNodeId: 'nested-only',
            kind: 'traceability',
            metadata: {},
          },
        ],
      },
      nodes: [
        {
          id: 'same-id',
          name: 'Canonical Node',
          kind: 'asset',
          technology: 'catalog',
          path: 'canonical/same-id',
        },
      ],
      relations: [
        {
          id: 'canonical-relation',
          sourceNodeId: 'same-id',
          targetNodeId: 'compatibility-only',
          kind: 'traceability',
        },
      ],
    } satisfies GovernanceWorkspaceAdapterResult;

    const graph = normalizeGovernanceGraph(adapterResult);

    expect(graph.nodes).toEqual([
      expect.objectContaining({
        id: 'same-id',
        name: 'Canonical Node',
        kind: 'asset',
        technology: 'catalog',
        path: 'canonical/same-id',
      }),
    ]);
    expect(graph.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'canonical-relation',
          kind: 'traceability',
        }),
      ]),
    );
    expect(graph.relations).toHaveLength(1);
  });
});
