import {
  buildGovernanceWorkspace,
  normalizeGovernanceGraph,
  type GovernanceWorkspaceAdapterResult,
} from '../../index.js';

describe('Phase 2 compatibility contracts', () => {
  it('keeps deprecated project and dependency adapter output functional', () => {
    const adapterResult = {
      workspaceId: 'compatibility',
      workspaceName: 'compatibility',
      workspaceRoot: '.',
      projects: [
        {
          id: 'app',
          name: 'App',
          root: 'apps/app',
          type: 'application',
          domain: 'customer',
          layer: 'app',
          tags: ['domain:customer'],
          metadata: {
            compatibility: true,
          },
        },
        {
          id: 'shared',
          name: 'Shared',
          root: 'packages/shared',
          type: 'library',
        },
      ],
      dependencies: [
        {
          sourceProjectId: 'app',
          targetProjectId: 'shared',
          type: 'static',
          metadata: {
            source: 'legacy-fixture',
          },
        },
      ],
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
          source: 'legacy-fixture',
        },
      }),
    ]);
  });

  it('prefers explicit canonical node and relation output in mixed adapter results', () => {
    const adapterResult = {
      projects: [
        {
          id: 'same-id',
          name: 'Compatibility Project',
          root: 'legacy/same-id',
        },
      ],
      dependencies: [
        {
          sourceProjectId: 'same-id',
          targetProjectId: 'compatibility-only',
          type: 'implicit',
        },
      ],
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
  });
});
