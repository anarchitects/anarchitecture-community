import type {
  GovernanceClassificationInput,
  GovernanceEvidence,
  GovernanceNodeInput,
  GovernanceOwnershipInput,
  GovernancePerspective,
  GovernanceRelationInput,
  GovernanceSource,
  GovernanceWorkspaceAdapterResult,
  GovernanceSignal,
  GovernanceSignalCategory,
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  GovernanceSignalType,
} from './index.js';
import {
  coreTestAdapterResult,
  coreTestWorkspace,
  coreTestWorkspaceWithDanglingDependency,
  findDanglingDependencies,
} from '../../tests/workspace.fixtures.js';

describe('Core fixtures', () => {
  it('provide a plain governance workspace with valid dependency references', () => {
    expect(coreTestWorkspace.projects).toHaveLength(3);
    expect(coreTestWorkspace.dependencies).toHaveLength(2);
    expect(findDanglingDependencies(coreTestWorkspace)).toEqual([]);
  });

  it('includes an edge-case workspace with a dangling dependency target', () => {
    const danglingDependencies = findDanglingDependencies(
      coreTestWorkspaceWithDanglingDependency,
    );

    expect(danglingDependencies).toHaveLength(1);
    expect(danglingDependencies[0]).toMatchObject({
      source: 'booking-ui',
      target: 'missing-project',
      type: 'static',
    });
  });
});

describe('Core signal contracts', () => {
  it('support plain signal data through the core boundary', () => {
    const category: GovernanceSignalCategory = 'boundary';
    const severity: GovernanceSignalSeverity = 'warning';
    const source: GovernanceSignalSource = 'policy';
    const type: GovernanceSignalType = 'domain-boundary-violation';

    const signal: GovernanceSignal = {
      id: 'signal-domain-boundary',
      type,
      sourceProjectId: 'platform-shell',
      targetProjectId: 'booking-ui',
      relatedProjectIds: ['platform-shell', 'booking-ui'],
      severity,
      category,
      message: 'Platform shell should not depend on booking UI directly.',
      source,
      createdAt: '2026-05-13T00:00:00.000Z',
    };

    expect(signal).toMatchObject({
      type: 'domain-boundary-violation',
      category: 'boundary',
      severity: 'warning',
      source: 'policy',
    });
  });
});

describe('Core adapter contract coverage', () => {
  it('exports technology-neutral graph input contracts through the core boundary', () => {
    const classification = {
      domain: 'customer',
      boundedContext: 'account-management',
      capability: 'identity',
      layer: 'data',
      scope: 'internal',
      system: 'customer-platform',
      product: 'customer-portal',
      tags: ['critical'],
      metadata: {
        classificationKind: 'example',
      },
    } satisfies GovernanceClassificationInput;

    const ownership = {
      team: 'customer-platform',
      contacts: ['customer-platform@example.com'],
      stewards: ['data-steward@example.com'],
      productOwner: 'product-owner@example.com',
      technicalOwner: 'technical-owner@example.com',
      businessOwner: 'business-owner@example.com',
      source: 'catalog',
      metadata: {
        ownershipKind: 'example',
      },
    } satisfies GovernanceOwnershipInput;

    const perspective = {
      id: 'implemented-reality',
      name: 'Implemented Reality',
      description: 'Facts discovered from implementation artifacts.',
    } satisfies GovernancePerspective;

    const source = {
      id: 'source:catalog',
      name: 'Catalog',
      type: 'governance-catalog',
      metadata: {
        endpoint: 'catalog',
      },
    } satisfies GovernanceSource;

    const evidence = [
      {
        id: 'evidence:asset-a',
        type: 'catalog-entry',
        source,
        reference: 'assets/a',
        description: 'Catalog entry for Asset A.',
        authority: 'authoritative',
        confidence: 1,
        metadata: {
          sourceVersion: '1',
        },
      },
    ] satisfies GovernanceEvidence[];

    const node = {
      id: 'asset-a',
      name: 'Asset A',
      kind: 'asset',
      technology: 'data-platform',
      sourceSystem: 'catalog',
      path: 'assets/a',
      tags: ['critical'],
      classification,
      ownership,
      perspective,
      source,
      evidence,
      authority: 'discovered',
      confidence: 0.95,
      metadata: {
        sourceKind: 'example',
      },
    } satisfies GovernanceNodeInput;

    const relation = {
      sourceNodeId: 'asset-a',
      targetNodeId: 'asset-b',
      kind: 'lineage',
      perspective,
      source,
      evidence,
      authority: 'inferred',
      confidence: 0.75,
      metadata: {
        relationKind: 'example',
      },
    } satisfies GovernanceRelationInput;

    expect(node.kind).toBe('asset');
    expect(node.classification?.domain).toBe('customer');
    expect(node.ownership?.team).toBe('customer-platform');
    expect(node.perspective?.id).toBe('implemented-reality');
    expect(node.evidence?.[0]?.authority).toBe('authoritative');
    expect(relation.sourceNodeId).toBe('asset-a');
    expect(relation.confidence).toBe(0.75);
  });

  it('supports plain adapter result data through the core boundary', () => {
    const adapterResult: GovernanceWorkspaceAdapterResult = {
      ...coreTestAdapterResult,
      nodes: [
        {
          id: 'asset-a',
          kind: 'asset',
        },
      ],
      relations: [
        {
          sourceNodeId: 'asset-a',
          targetNodeId: 'booking-ui',
          kind: 'traceability',
        },
      ],
      capabilities: [
        {
          id: 'capability:test-fixture',
          version: '1',
          source: 'adapter',
          producer: 'core-fixture',
          data: {
            origin: 'core-fixture',
          },
          metadata: {
            category: 'fixture',
          },
        },
      ],
      diagnostics: [
        {
          code: 'fixture-warning',
          message: 'Fixture diagnostic',
          source: 'test',
        },
      ],
    };

    expect(adapterResult.projects).toHaveLength(3);
    expect(adapterResult.dependencies).toHaveLength(2);
    expect(adapterResult.nodes?.[0]?.id).toBe('asset-a');
    expect(adapterResult.relations?.[0]?.kind).toBe('traceability');
    expect(adapterResult.capabilities?.[0]?.id).toBe('capability:test-fixture');
    expect(adapterResult.capabilities?.[0]?.source).toBe('adapter');
    expect(adapterResult.diagnostics?.[0]?.code).toBe('fixture-warning');
  });

  it('keeps adapter result capabilities optional', () => {
    const adapterResult: GovernanceWorkspaceAdapterResult = {
      projects: [],
      dependencies: [],
    };

    expect(adapterResult.capabilities).toBeUndefined();
  });
});
