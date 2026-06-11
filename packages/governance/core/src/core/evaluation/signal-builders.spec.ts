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

  it('suppresses warning-level cross-domain signals for allowed domain dependencies', () => {
    const allowedGraphSignals = buildGovernanceGraphSignals(
      {
        extractedAt: '2026-05-23T10:00:00.000Z',
        nodes: [
          { id: 'booking-domain', domain: 'booking' },
          { id: 'shared-kernel', domain: 'shared' },
        ],
        relations: [
          {
            id: 'booking-domain->shared-kernel',
            sourceNodeId: 'booking-domain',
            targetNodeId: 'shared-kernel',
            kind: 'dependency',
            metadata: {
              dependencyType: 'static',
            },
          },
        ],
      },
      {
        allowedDomainDependencies: {
          booking: ['shared'],
        },
      },
    );

    expect(allowedGraphSignals.map((signal) => signal.type)).toEqual([
      'structural-dependency',
    ]);
    expect(
      allowedGraphSignals.some(
        (signal) =>
          signal.type === 'cross-domain-dependency' &&
          signal.severity === 'warning',
      ),
    ).toBe(false);
  });

  it('keeps warning-level cross-domain signals for disallowed domain dependencies', () => {
    const graphSignals = buildGovernanceGraphSignals(
      {
        extractedAt: '2026-05-23T10:00:00.000Z',
        nodes: [
          { id: 'booking-domain', domain: 'booking' },
          { id: 'shared-kernel', domain: 'shared' },
        ],
        relations: [
          {
            id: 'booking-domain->shared-kernel',
            sourceNodeId: 'booking-domain',
            targetNodeId: 'shared-kernel',
            kind: 'dependency',
            metadata: {
              dependencyType: 'static',
            },
          },
        ],
      },
      {
        allowedDomainDependencies: {
          booking: [],
        },
      },
    );

    expect(graphSignals.map((signal) => signal.type)).toEqual([
      'structural-dependency',
      'cross-domain-dependency',
    ]);
    expect(
      graphSignals.some(
        (signal) =>
          signal.type === 'cross-domain-dependency' &&
          signal.severity === 'warning',
      ),
    ).toBe(true);
  });

  it('does not emit cross-domain dependency signals for same-domain dependencies', () => {
    const graphSignals = buildGovernanceGraphSignals(
      {
        extractedAt: '2026-05-23T10:00:00.000Z',
        nodes: [
          { id: 'booking-api', domain: 'booking' },
          { id: 'booking-domain', domain: 'booking' },
        ],
        relations: [
          {
            id: 'booking-api->booking-domain',
            sourceNodeId: 'booking-api',
            targetNodeId: 'booking-domain',
            kind: 'dependency',
          },
        ],
      },
      {
        allowedDomainDependencies: {
          booking: ['shared'],
        },
      },
    );

    expect(graphSignals.map((signal) => signal.type)).toEqual([
      'structural-dependency',
    ]);
  });

  it('does not emit boundary warning signals for non-dependency relations', () => {
    const graphSignals = buildGovernanceGraphSignals({
      extractedAt: '2026-05-23T10:00:00.000Z',
      nodes: [
        { id: 'booking-domain', domain: 'booking' },
        { id: 'shared-kernel', domain: 'shared' },
      ],
      relations: [
        {
          id: 'booking-domain->shared-kernel:traceability',
          sourceNodeId: 'booking-domain',
          targetNodeId: 'shared-kernel',
          kind: 'traceability',
        },
      ],
    });

    expect(graphSignals.map((signal) => signal.type)).toEqual([
      'structural-dependency',
    ]);
  });

  it('maps the remaining built-in core policy violations into policy signals', () => {
    const policySignals = buildGovernancePolicySignals([
      {
        id: 'policy-missing-domain',
        ruleId: 'missing-domain',
        subjectId: 'booking-ui',
        severity: 'warning',
        category: 'metadata',
        message: 'Missing domain.',
        reference: {
          nodeId: 'booking-ui',
          relatedNodeIds: ['booking-ui'],
        },
      } satisfies Violation,
      {
        id: 'policy-missing-layer',
        ruleId: 'missing-layer',
        subjectId: 'booking-ui',
        severity: 'warning',
        category: 'metadata',
        message: 'Missing layer.',
        reference: {
          nodeId: 'booking-ui',
          relatedNodeIds: ['booking-ui'],
        },
      } satisfies Violation,
      {
        id: 'policy-tag-convention',
        ruleId: 'tag-convention',
        subjectId: 'booking-ui',
        severity: 'warning',
        category: 'metadata',
        message: 'Invalid tag.',
        reference: {
          nodeId: 'booking-ui',
          relatedNodeIds: ['booking-ui'],
        },
      } satisfies Violation,
      {
        id: 'policy-name-convention',
        ruleId: 'project-name-convention',
        subjectId: 'booking-ui',
        severity: 'warning',
        category: 'convention',
        message: 'Invalid node name.',
        reference: {
          nodeId: 'booking-ui',
          relatedNodeIds: ['booking-ui'],
        },
      } satisfies Violation,
    ]);

    expect(policySignals.map((signal) => signal.type)).toEqual([
      'missing-domain-violation',
      'missing-layer-violation',
      'node-name-convention-violation',
      'tag-convention-violation',
    ]);
  });
});
