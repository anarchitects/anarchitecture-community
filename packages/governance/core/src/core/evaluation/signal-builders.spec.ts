import {
  buildGovernanceConformanceSignals,
  buildGovernanceGraphSignals,
  buildGovernancePolicySignals,
  mergeGovernanceSignals,
  type Violation,
} from '../index.js';

describe('signal builders', () => {
  it('builds deterministic graph, conformance, and policy signals', () => {
    const graphSignals = buildGovernanceGraphSignals({
      extractedAt: '2026-05-23T10:00:00.000Z',
      nodes: [
        { id: 'booking-ui', domain: 'booking' },
        { id: 'platform-shell', domain: 'platform' },
      ],
      relations: [
        {
          id: 'platform-shell->booking-ui',
          sourceNodeId: 'platform-shell',
          targetNodeId: 'booking-ui',
          kind: 'dependency',
          metadata: {
            dependencyType: 'static',
          },
        },
      ],
    });
    const conformanceSignals = buildGovernanceConformanceSignals({
      extractedAt: '2026-05-23T10:00:00.000Z',
      findings: [
        {
          ruleId: 'api-contract',
          nodeId: 'booking-ui',
          relatedNodeIds: ['booking-ui'],
          relatedRelationIds: [],
          category: 'compliance',
          severity: 'warning',
          message: 'Contract mismatch.',
        },
      ],
    });
    const policySignals = buildGovernancePolicySignals([
      {
        id: 'policy-1',
        ruleId: 'domain-boundary',
        subjectId: 'platform-shell',
        severity: 'error',
        category: 'boundary',
        message: 'Cross-domain dependency.',
        reference: {
          nodeId: 'platform-shell',
          relatedNodeIds: ['booking-ui', 'platform-shell'],
        },
      } satisfies Violation,
    ]);

    const merged = mergeGovernanceSignals(
      graphSignals,
      conformanceSignals,
      policySignals,
    );

    expect(graphSignals.map((signal) => signal.type)).toEqual([
      'structural-dependency',
      'cross-domain-dependency',
    ]);
    expect(conformanceSignals[0]?.type).toBe('conformance-violation');
    expect(policySignals[0]?.type).toBe('domain-boundary-violation');
    expect(merged).toHaveLength(4);
  });
});
