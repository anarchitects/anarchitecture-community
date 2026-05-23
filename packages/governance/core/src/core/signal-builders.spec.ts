import {
  buildGovernanceConformanceSignals,
  buildGovernanceGraphSignals,
  buildGovernancePolicySignals,
  mergeGovernanceSignals,
  type Violation,
} from './index.js';

describe('signal builders', () => {
  it('builds deterministic graph, conformance, and policy signals', () => {
    const graphSignals = buildGovernanceGraphSignals({
      extractedAt: '2026-05-23T10:00:00.000Z',
      projects: [
        { id: 'booking-ui', domain: 'booking' },
        { id: 'platform-shell', domain: 'platform' },
      ],
      dependencies: [
        {
          sourceProjectId: 'platform-shell',
          targetProjectId: 'booking-ui',
          type: 'static',
        },
      ],
    });
    const conformanceSignals = buildGovernanceConformanceSignals({
      extractedAt: '2026-05-23T10:00:00.000Z',
      findings: [
        {
          ruleId: 'api-contract',
          projectId: 'booking-ui',
          relatedProjectIds: ['booking-ui'],
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
        project: 'platform-shell',
        severity: 'error',
        category: 'boundary',
        message: 'Cross-domain dependency.',
        details: {
          targetProject: 'booking-ui',
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
