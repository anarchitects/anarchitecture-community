import type { GovernanceWorkspaceAdapterResult } from './adapter.js';
import { normalizeGovernanceGraph } from './graph-normalization.js';

describe('Governance graph normalization', () => {
  it('normalizes legacy project and dependency adapter results', () => {
    const adapterResult = {
      projects: [
        {
          id: 'project-a',
          name: 'Project A',
          root: 'packages/project-a',
          type: 'library',
          tags: ['domain:customer'],
          metadata: {
            projectKind: 'example',
          },
        },
        {
          id: 'project-b',
          name: 'Project B',
          root: 'packages/project-b',
        },
      ],
      dependencies: [
        {
          sourceProjectId: 'project-a',
          targetProjectId: 'project-b',
          type: 'static',
          metadata: {
            dependencyKind: 'example',
          },
        },
      ],
    } satisfies GovernanceWorkspaceAdapterResult;

    const graph = normalizeGovernanceGraph(adapterResult);

    expect(graph.nodes).toEqual([
      {
        id: 'project-a',
        name: 'Project A',
        kind: 'library',
        root: 'packages/project-a',
        tags: ['domain:customer'],
        metadata: {
          projectKind: 'example',
        },
      },
      {
        id: 'project-b',
        name: 'Project B',
        kind: 'project',
        root: 'packages/project-b',
        tags: [],
        metadata: {},
      },
    ]);
    expect(graph.relations).toEqual([
      {
        id: 'legacy:project-a->project-b:static:0',
        sourceNodeId: 'project-a',
        targetNodeId: 'project-b',
        kind: 'dependency',
        metadata: {
          dependencyKind: 'example',
          dependencyType: 'static',
        },
      },
    ]);
  });

  it('normalizes canonical node and relation adapter results', () => {
    const adapterResult = {
      nodes: [
        {
          id: 'asset-a',
          name: 'Asset A',
          kind: 'asset',
          technology: 'generic',
          sourceSystem: 'inventory',
          path: 'assets/a',
          tags: ['critical'],
          perspective: {
            id: 'implemented-reality',
            name: 'Implemented Reality',
          },
          source: {
            id: 'source:inventory',
            name: 'Inventory',
            type: 'catalog',
          },
          evidence: [
            {
              id: 'evidence:asset-a',
              type: 'catalog-entry',
              source: 'source:inventory',
              reference: 'assets/a',
              authority: 'authoritative',
              confidence: 1,
            },
          ],
          authority: 'discovered',
          confidence: 0.9,
          metadata: {
            assetKind: 'example',
          },
        },
        {
          id: 'asset-b',
          kind: 'resource',
        },
      ],
      relations: [
        {
          sourceNodeId: 'asset-a',
          targetNodeId: 'asset-b',
          kind: 'lineage',
          authority: 'inferred',
          confidence: 0.7,
          metadata: {
            relationKind: 'example',
          },
        },
      ],
    } satisfies GovernanceWorkspaceAdapterResult;

    const graph = normalizeGovernanceGraph(adapterResult);

    expect(graph.nodes).toEqual([
      {
        id: 'asset-a',
        name: 'Asset A',
        kind: 'asset',
        technology: 'generic',
        sourceSystem: 'inventory',
        path: 'assets/a',
        tags: ['critical'],
        perspective: {
          id: 'implemented-reality',
          name: 'Implemented Reality',
        },
        source: {
          id: 'source:inventory',
          name: 'Inventory',
          type: 'catalog',
        },
        evidence: [
          {
            id: 'evidence:asset-a',
            type: 'catalog-entry',
            source: 'source:inventory',
            reference: 'assets/a',
            authority: 'authoritative',
            confidence: 1,
          },
        ],
        authority: 'discovered',
        confidence: 0.9,
        metadata: {
          assetKind: 'example',
        },
      },
      {
        id: 'asset-b',
        kind: 'resource',
        tags: [],
        metadata: {},
      },
    ]);
    expect(graph.relations).toEqual([
      {
        id: 'canonical:asset-a->asset-b:lineage:0',
        sourceNodeId: 'asset-a',
        targetNodeId: 'asset-b',
        kind: 'lineage',
        authority: 'inferred',
        confidence: 0.7,
        metadata: {
          relationKind: 'example',
        },
      },
    ]);
  });

  it('normalizes mixed legacy and canonical adapter results deterministically', () => {
    const adapterResult = {
      projects: [
        {
          id: 'shared-id',
          name: 'Legacy Shared',
          root: 'legacy/shared',
        },
        {
          id: 'legacy-only',
          name: 'Legacy Only',
        },
      ],
      dependencies: [
        {
          sourceProjectId: 'legacy-only',
          targetProjectId: 'shared-id',
          type: 'implicit',
        },
      ],
      nodes: [
        {
          id: 'shared-id',
          name: 'Canonical Shared',
          kind: 'asset',
          path: 'canonical/shared',
        },
      ],
      relations: [
        {
          id: 'canonical-relation',
          sourceNodeId: 'shared-id',
          targetNodeId: 'legacy-only',
          kind: 'traceability',
        },
      ],
    } satisfies GovernanceWorkspaceAdapterResult;

    const graph = normalizeGovernanceGraph(adapterResult);

    expect(graph.nodes).toEqual([
      {
        id: 'shared-id',
        name: 'Canonical Shared',
        kind: 'asset',
        path: 'canonical/shared',
        tags: [],
        metadata: {},
      },
      {
        id: 'legacy-only',
        name: 'Legacy Only',
        kind: 'project',
        tags: [],
        metadata: {},
      },
    ]);
    expect(graph.relations).toEqual([
      {
        id: 'legacy:legacy-only->shared-id:implicit:0',
        sourceNodeId: 'legacy-only',
        targetNodeId: 'shared-id',
        kind: 'dependency',
        metadata: {
          dependencyType: 'implicit',
        },
      },
      {
        id: 'canonical-relation',
        sourceNodeId: 'shared-id',
        targetNodeId: 'legacy-only',
        kind: 'traceability',
        metadata: {},
      },
    ]);
  });
});
