import {
  buildGovernanceWorkspace,
  type GovernanceWorkspaceAdapterResult,
} from '../adapter/adapter.js';
import { normalizeGovernanceGraph } from './graph-normalization.js';

describe('Governance graph normalization', () => {
  it('builds a canonical workspace with nodes and relations only', () => {
    const adapterResult = {
      workspaceId: 'workspace-id',
      workspaceName: 'Workspace Name',
      workspaceRoot: '/repo',
      nodes: [
        {
          id: 'service-a',
          name: 'Service A',
          kind: 'service',
          tags: ['customer-facing'],
          extensions: {
            'governance-extension:typescript': {
              extensionId: 'governance-extension:typescript',
              contractVersion: '1',
              data: {
                kind: 'node',
                technology: 'typescript',
              },
            },
          },
          metadata: {
            area: 'checkout',
          },
        },
      ],
      relations: [
        {
          sourceNodeId: 'service-a',
          targetNodeId: 'service-a',
          kind: 'traceability',
          extensions: {
            'governance-extension:typescript': {
              extensionId: 'governance-extension:typescript',
              contractVersion: '1',
              data: {
                kind: 'relation',
                technology: 'typescript',
              },
            },
          },
          metadata: {
            source: 'fixture',
          },
        },
      ],
      capabilities: [{ id: 'capability:graph' }],
      diagnostics: [
        {
          code: 'node-relation-ready',
          message: 'canonical graph',
        },
      ],
      extensions: {
        'governance-extension:typescript': {
          extensionId: 'governance-extension:typescript',
          contractVersion: '1',
          data: {
            kind: 'workspace',
            technology: 'typescript',
          },
        },
      },
      metadata: {
        owner: 'governance-core',
      },
    } satisfies GovernanceWorkspaceAdapterResult;

    const workspace = buildGovernanceWorkspace(adapterResult);

    expect(workspace).toEqual({
      id: 'workspace-id',
      name: 'Workspace Name',
      root: '/repo',
      nodes: [
        {
          id: 'service-a',
          name: 'Service A',
          kind: 'service',
          tags: ['customer-facing'],
          extensions: {
            'governance-extension:typescript': {
              extensionId: 'governance-extension:typescript',
              contractVersion: '1',
              data: {
                kind: 'node',
                technology: 'typescript',
              },
            },
          },
          metadata: {
            area: 'checkout',
          },
        },
      ],
      relations: [
        {
          id: 'canonical:service-a->service-a:traceability:0',
          sourceNodeId: 'service-a',
          targetNodeId: 'service-a',
          kind: 'traceability',
          extensions: {
            'governance-extension:typescript': {
              extensionId: 'governance-extension:typescript',
              contractVersion: '1',
              data: {
                kind: 'relation',
                technology: 'typescript',
              },
            },
          },
          metadata: {
            source: 'fixture',
          },
        },
      ],
      capabilities: [{ id: 'capability:graph' }],
      diagnostics: [
        {
          code: 'node-relation-ready',
          message: 'canonical graph',
        },
      ],
      extensions: {
        'governance-extension:typescript': {
          extensionId: 'governance-extension:typescript',
          contractVersion: '1',
          data: {
            kind: 'workspace',
            technology: 'typescript',
          },
        },
      },
      metadata: {
        owner: 'governance-core',
      },
    });
    expect('projects' in workspace).toBe(false);
    expect('dependencies' in workspace).toBe(false);
  });

  it('normalizes canonical node defaults and preserves canonical fields', () => {
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
        kind: 'unknown',
        tags: [],
        metadata: {},
      },
    ]);
    expect(graph.relations).toEqual([]);
  });

  it('normalizes relation defaults, preserves canonical fields, and generates deterministic ids', () => {
    const adapterResult = {
      relations: [
        {
          sourceNodeId: 'asset-a',
          targetNodeId: 'asset-b',
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
          authority: 'inferred',
          confidence: 0.7,
        },
        {
          id: 'relation-b',
          sourceNodeId: 'asset-b',
          targetNodeId: 'asset-c',
          kind: 'lineage',
          metadata: {
            relationKind: 'example',
          },
        },
      ],
    } satisfies GovernanceWorkspaceAdapterResult;

    const graph = normalizeGovernanceGraph(adapterResult);

    expect(graph.nodes).toEqual([]);
    expect(graph.relations).toEqual([
      {
        id: 'canonical:asset-a->asset-b:unknown:0',
        sourceNodeId: 'asset-a',
        targetNodeId: 'asset-b',
        kind: 'unknown',
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
        authority: 'inferred',
        confidence: 0.7,
        metadata: {},
      },
      {
        id: 'relation-b',
        sourceNodeId: 'asset-b',
        targetNodeId: 'asset-c',
        kind: 'lineage',
        metadata: {
          relationKind: 'example',
        },
      },
    ]);
  });

  it('deduplicates canonical nodes and relations by id using the last definition', () => {
    const graph = normalizeGovernanceGraph({
      nodes: [
        {
          id: 'shared-id',
          kind: 'asset',
          metadata: {
            source: 'first',
          },
        },
        {
          id: 'shared-id',
          kind: 'resource',
          tags: ['final'],
          metadata: {
            source: 'last',
          },
        },
      ],
      relations: [
        {
          id: 'relation-id',
          sourceNodeId: 'a',
          targetNodeId: 'b',
          kind: 'traceability',
          metadata: {
            source: 'first',
          },
        },
        {
          id: 'relation-id',
          sourceNodeId: 'a',
          targetNodeId: 'c',
          kind: 'lineage',
          metadata: {
            source: 'last',
          },
        },
      ],
    });

    expect(graph.nodes).toEqual([
      {
        id: 'shared-id',
        kind: 'resource',
        tags: ['final'],
        metadata: {
          source: 'last',
        },
      },
    ]);
    expect(graph.relations).toEqual([
      {
        id: 'relation-id',
        sourceNodeId: 'a',
        targetNodeId: 'c',
        kind: 'lineage',
        metadata: {
          source: 'last',
        },
      },
    ]);
  });

  it('does not fall back to legacy project and dependency inputs', () => {
    const workspace = buildGovernanceWorkspace({
      workspace: {
        id: 'nested',
        name: 'Nested',
        root: '/nested',
        nodes: [],
        relations: [],
        projects: [
          {
            id: 'nested-legacy-project',
            name: 'Nested Legacy Project',
            root: 'packages/nested-legacy',
            type: 'library',
            tags: [],
            metadata: {},
          },
        ],
        dependencies: [
          {
            source: 'nested-legacy-project',
            target: 'nested-legacy-project',
            type: 'static',
          },
        ],
      } as unknown as GovernanceWorkspaceAdapterResult['workspace'],
    } as unknown as GovernanceWorkspaceAdapterResult);

    expect(workspace.nodes).toEqual([]);
    expect(workspace.relations).toEqual([]);
  });
});
