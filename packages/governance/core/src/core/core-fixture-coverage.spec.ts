import type {
  GovernanceClassificationInput,
  GovernanceNodeInput,
  GovernanceOwnershipInput,
  GovernanceRelationInput,
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
      metadata: {
        sourceKind: 'example',
      },
    } satisfies GovernanceNodeInput;

    const relation = {
      sourceNodeId: 'asset-a',
      targetNodeId: 'asset-b',
      kind: 'lineage',
      metadata: {
        relationKind: 'example',
      },
    } satisfies GovernanceRelationInput;

    expect(node.kind).toBe('asset');
    expect(node.classification?.domain).toBe('customer');
    expect(node.ownership?.team).toBe('customer-platform');
    expect(relation.sourceNodeId).toBe('asset-a');
  });

  it('supports plain adapter result data through the core boundary', () => {
    const adapterResult: GovernanceWorkspaceAdapterResult = {
      ...coreTestAdapterResult,
      capabilities: [
        {
          id: 'capability:test-fixture',
          version: '1',
          data: {
            origin: 'core-fixture',
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
    expect(adapterResult.capabilities?.[0]?.id).toBe('capability:test-fixture');
    expect(adapterResult.diagnostics?.[0]?.code).toBe('fixture-warning');
  });
});
