import {
  buildTopIssues,
  buildGovernanceRecommendations,
  calculateGovernanceHealth,
  calculateGovernanceMetrics,
  evaluateGovernancePolicies,
  type GovernanceNode,
  type GovernanceSignal,
  type GovernanceWorkspace,
  type GovernanceRelation,
  type Violation,
} from '../index.js';

describe('metrics and health', () => {
  it('calculates canonical node/relation metrics, health, and recommendations deterministically', () => {
    const workspace = createWorkspace(
      [
        {
          id: 'app-shell',
          name: 'app-shell',
          kind: 'application',
          classification: {
            domain: 'platform',
            layer: 'app',
          },
          tags: ['domain:platform', 'layer:app'],
          ownership: {
            team: 'platform-team',
            source: 'project-metadata',
          },
          metadata: {
            documentation: true,
          },
        },
        {
          id: 'booking-ui',
          name: 'booking-ui',
          kind: 'library',
          classification: {
            domain: 'booking',
            layer: 'ui',
          },
          tags: ['domain:booking', 'layer:ui'],
          ownership: {
            source: 'none',
          },
          metadata: {},
        },
        {
          id: 'booking-domain',
          name: 'booking-domain',
          kind: 'library',
          classification: {
            domain: 'booking',
            layer: 'domain',
          },
          tags: ['domain:booking', 'layer:domain'],
          ownership: {
            contacts: ['@booking'],
            source: 'codeowners',
          },
          metadata: {
            documentation: true,
          },
        },
      ],
      [
        {
          id: 'relation:app-shell->booking-ui',
          sourceNodeId: 'app-shell',
          targetNodeId: 'booking-ui',
          kind: 'dependency',
          metadata: {
            dependencyType: 'static',
          },
        },
        {
          id: 'relation:booking-ui->booking-domain',
          sourceNodeId: 'booking-ui',
          targetNodeId: 'booking-domain',
          kind: 'dependency',
          metadata: {
            dependencyType: 'static',
          },
        },
        {
          id: 'relation:booking-domain->app-shell:traceability',
          sourceNodeId: 'booking-domain',
          targetNodeId: 'app-shell',
          kind: 'traceability',
          metadata: {},
        },
      ],
    );

    const signals: GovernanceSignal[] = [
      {
        id: 'signal-domain',
        type: 'domain-boundary-violation',
        relationId: 'relation:app-shell->booking-ui',
        relatedNodeIds: ['app-shell', 'booking-ui'],
        severity: 'error',
        category: 'boundary',
        message: 'Cross-domain dependency.',
        source: 'policy',
        createdAt: '2026-05-23T10:00:00.000Z',
      },
      {
        id: 'signal-ownership',
        type: 'ownership-gap',
        nodeId: 'booking-ui',
        relatedNodeIds: ['booking-ui'],
        severity: 'warning',
        category: 'ownership',
        message: 'Ownership missing.',
        source: 'policy',
        createdAt: '2026-05-23T10:00:00.000Z',
      },
      {
        id: 'signal-structure',
        type: 'structural-dependency',
        relationId: 'relation:booking-ui->booking-domain',
        relatedNodeIds: ['booking-ui', 'booking-domain'],
        severity: 'info',
        category: 'dependency',
        message: 'Structural dependency.',
        source: 'graph',
        createdAt: '2026-05-23T10:00:00.000Z',
      },
      {
        id: 'signal-entropy',
        type: 'cross-domain-dependency',
        relationId: 'relation:app-shell->booking-ui',
        relatedNodeIds: ['app-shell', 'booking-ui'],
        severity: 'warning',
        category: 'boundary',
        message: 'Cross-domain dependency.',
        source: 'graph',
        createdAt: '2026-05-23T10:00:00.000Z',
      },
      {
        id: 'signal-layer',
        type: 'layer-boundary-violation',
        relationId: 'relation:app-shell->booking-ui',
        relatedNodeIds: ['app-shell', 'booking-ui'],
        severity: 'warning',
        category: 'boundary',
        message: 'Layer boundary violation.',
        source: 'policy',
        createdAt: '2026-05-23T10:00:00.000Z',
      },
    ];

    const metrics = calculateGovernanceMetrics({
      workspace,
      signals,
    });
    const reorderedMetrics = calculateGovernanceMetrics({
      workspace: createWorkspace(
        [...workspace.nodes].reverse(),
        [...workspace.relations].reverse(),
      ),
      signals: [...signals].reverse(),
    });
    const health = calculateGovernanceHealth(
      metrics,
      {
        'ownership-coverage': 2,
      },
      undefined,
      {
        topIssues: [
          {
            type: 'domain-boundary-violation',
            source: 'policy',
            severity: 'error',
            count: 2,
            subjects: [
              'relation:app-shell->booking-ui',
              'app-shell',
              'booking-ui',
            ],
            ruleId: 'domain-boundary',
            message: 'Cross-domain dependency.',
          },
          {
            type: 'ownership-gap',
            source: 'policy',
            severity: 'warning',
            count: 1,
            subjects: ['booking-ui'],
            ruleId: 'ownership-presence',
            message: 'Ownership missing.',
          },
        ],
      },
    );
    const recommendations = buildGovernanceRecommendations(
      [
        {
          id: 'violation-domain',
          ruleId: 'domain-boundary',
          subjectId: 'relation:app-shell->booking-ui',
          severity: 'error',
          category: 'boundary',
          message: 'Cross-domain dependency.',
          reference: {
            relationId: 'relation:app-shell->booking-ui',
            relatedNodeIds: ['app-shell', 'booking-ui'],
          },
        },
      ] satisfies Violation[],
      metrics,
    );

    expect(metrics.map((measurement) => measurement.id)).toEqual([
      'architectural-entropy',
      'dependency-complexity',
      'domain-integrity',
      'ownership-coverage',
      'documentation-completeness',
      'layer-integrity',
    ]);
    expect(reorderedMetrics).toEqual(metrics);
    expect(findMeasurement(metrics, 'dependency-complexity')).toMatchObject({
      value: 0.1667,
      score: 83,
      metadata: {
        nodeCount: 3,
        dependencyRelationCount: 2,
      },
    });
    expect(findMeasurement(metrics, 'ownership-coverage')).toMatchObject({
      value: 0.6667,
      score: 67,
      metadata: {
        nodeCount: 3,
        ownedNodeCount: 2,
      },
    });
    expect(
      findMeasurement(metrics, 'documentation-completeness'),
    ).toMatchObject({
      value: 0.6667,
      score: 67,
      metadata: {
        nodeCount: 3,
        documentedNodeCount: 2,
      },
    });
    expect(findMeasurement(metrics, 'domain-integrity')).toMatchObject({
      value: 0.5,
      score: 50,
      metadata: {
        dependencyRelationCount: 2,
        violatingRelationWeight: 1,
      },
    });
    expect(findMeasurement(metrics, 'layer-integrity')).toMatchObject({
      value: 0.3,
      score: 70,
      metadata: {
        dependencyRelationCount: 2,
        violatingRelationWeight: 0.6,
      },
    });
    expect(findMeasurement(metrics, 'architectural-entropy')).toMatchObject({
      value: 0.3,
      score: 70,
      metadata: {
        nodeCount: 3,
        dependencyRelationCount: 2,
        crossDomainPenaltyWeight: 0.6,
      },
    });
    expect(health.subjectHotspots).toEqual([
      {
        subjectId: 'relation:app-shell->booking-ui',
        subjectType: 'relation',
        count: 2,
        dominantIssueTypes: ['domain-boundary-violation'],
      },
      {
        subjectId: 'booking-ui',
        subjectType: 'node',
        count: 1,
        dominantIssueTypes: ['ownership-gap'],
      },
    ]);
    expect(health).toMatchObject({
      score: 68,
      status: 'critical',
      grade: 'D',
    });
    expect(recommendations[0]?.id).toBe('reduce-cross-domain-dependencies');
  });

  it('keeps documentation completeness aligned with documentation-gap violations', () => {
    const workspace = createWorkspace(
      [
        {
          id: 'documented-node',
          name: 'documented-node',
          kind: 'library',
          classification: {
            domain: 'booking',
            layer: 'ui',
          },
          tags: ['domain:booking', 'layer:ui'],
          ownership: {
            team: 'booking-team',
            source: 'project-metadata',
          },
          metadata: {
            documentation: true,
          },
        },
        {
          id: 'undocumented-node',
          name: 'undocumented-node',
          kind: 'library',
          classification: {
            domain: 'booking',
            layer: 'domain',
          },
          tags: ['domain:booking', 'layer:domain'],
          ownership: {
            team: 'booking-team',
            source: 'project-metadata',
          },
          metadata: {},
        },
      ],
      [],
    );
    const profile = {
      name: 'docs-profile',
      layers: ['ui', 'domain'],
      allowedDomainDependencies: {
        booking: ['booking'],
      },
      ownership: {
        required: false,
      },
      health: {
        statusThresholds: {
          goodMinScore: 85,
          warningMinScore: 70,
        },
      },
      metrics: {},
    };

    const metrics = calculateGovernanceMetrics({
      workspace,
      signals: [],
      profile,
    });
    const documentationGapViolations = evaluateGovernancePolicies({
      workspace,
      profile,
    }).filter((violation) => violation.ruleId === 'documentation-gap');

    expect(
      findMeasurement(metrics, 'documentation-completeness'),
    ).toMatchObject({
      value: 0.5,
      score: 50,
      metadata: {
        nodeCount: 2,
        documentedNodeCount: 1,
      },
    });
    expect(documentationGapViolations).toEqual([
      expect.objectContaining({
        subjectId: 'undocumented-node',
        reference: {
          nodeId: 'undocumented-node',
        },
      }),
    ]);
  });

  it.each([
    {
      name: 'source-missing',
      metadata: {
        missingSourceDomain: true,
        missingTargetDomain: false,
      },
      expectedNodeHotspots: ['booking-api'],
      excludedNodeHotspots: ['booking-interface'],
    },
    {
      name: 'target-missing',
      metadata: {
        missingSourceDomain: false,
        missingTargetDomain: true,
      },
      expectedNodeHotspots: ['booking-interface'],
      excludedNodeHotspots: ['booking-api'],
    },
    {
      name: 'both-missing',
      metadata: {
        missingSourceDomain: true,
        missingTargetDomain: true,
      },
      expectedNodeHotspots: ['booking-api', 'booking-interface'],
      excludedNodeHotspots: [],
    },
  ])(
    'attributes missing-domain-context node hotspots to the missing side for $name',
    ({ metadata, expectedNodeHotspots, excludedNodeHotspots }) => {
      const topIssues = buildTopIssues([
        {
          id: `signal:${metadata.missingSourceDomain ? 'source' : 'target'}:${metadata.missingTargetDomain ? 'target' : 'source'}`,
          type: 'missing-domain-context',
          nodeId: 'booking-api',
          relationId: 'relation:booking-api->booking-interface',
          relatedNodeIds: ['booking-api', 'booking-interface'],
          severity: 'warning',
          category: 'boundary',
          message: 'Missing domain context.',
          source: 'graph',
          createdAt: '2026-06-12T10:00:00.000Z',
          metadata,
        } satisfies GovernanceSignal,
      ]);
      const health = calculateGovernanceHealth([], {}, undefined, {
        topIssues,
      });
      const nodeHotspotIds = health.subjectHotspots
        .filter((hotspot) => hotspot.subjectType === 'node')
        .map((hotspot) => hotspot.subjectId);

      expect(nodeHotspotIds).toEqual(expectedNodeHotspots);
      if (excludedNodeHotspots.length > 0) {
        expect(nodeHotspotIds).not.toEqual(
          expect.arrayContaining(excludedNodeHotspots),
        );
      }
      expect(health.subjectHotspots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            subjectId: 'relation:booking-api->booking-interface',
            subjectType: 'relation',
            dominantIssueTypes: ['missing-domain-context'],
          }),
        ]),
      );
    },
  );

  it('keeps generic relation-level hotspot context out of node hotspots', () => {
    const health = calculateGovernanceHealth([], {}, undefined, {
      topIssues: [
        {
          type: 'cross-domain-dependency',
          source: 'graph',
          severity: 'warning',
          count: 1,
          subjects: [
            'booking-api',
            'booking-interface',
            'relation:booking-api->booking-interface',
          ],
          message: 'Cross-domain dependency.',
        },
      ],
    });

    expect(health.subjectHotspots).toEqual([
      {
        subjectId: 'relation:booking-api->booking-interface',
        subjectType: 'relation',
        count: 1,
        dominantIssueTypes: ['cross-domain-dependency'],
      },
    ]);
  });

  it('omits perfect metrics when fewer than three imperfect metrics exist', () => {
    const health = calculateGovernanceHealth([
      measurement(
        'documentation-completeness',
        'Documentation Completeness',
        0,
      ),
      measurement('dependency-complexity', 'Dependency Complexity', 79),
      measurement('architectural-entropy', 'Architectural Entropy', 100),
    ]);

    expect(health.explainability.weakestMetrics).toEqual([
      {
        id: 'documentation-completeness',
        name: 'Documentation Completeness',
        score: 0,
      },
      {
        id: 'dependency-complexity',
        name: 'Dependency Complexity',
        score: 79,
      },
    ]);
    expect(health.explainability.summary).not.toContain(
      'Architectural Entropy',
    );
  });

  it('keeps only the three weakest imperfect metrics', () => {
    const health = calculateGovernanceHealth([
      measurement(
        'documentation-completeness',
        'Documentation Completeness',
        0,
      ),
      measurement('dependency-complexity', 'Dependency Complexity', 79),
      measurement('architectural-entropy', 'Architectural Entropy', 100),
      measurement('layer-integrity', 'Layer Integrity', 50),
    ]);

    expect(health.explainability.weakestMetrics).toEqual([
      {
        id: 'documentation-completeness',
        name: 'Documentation Completeness',
        score: 0,
      },
      {
        id: 'layer-integrity',
        name: 'Layer Integrity',
        score: 50,
      },
      {
        id: 'dependency-complexity',
        name: 'Dependency Complexity',
        score: 79,
      },
    ]);
  });

  it('returns no weakest metrics when all metrics are perfect', () => {
    const health = calculateGovernanceHealth([
      measurement('architectural-entropy', 'Architectural Entropy', 100),
      measurement('dependency-complexity', 'Dependency Complexity', 100),
      measurement(
        'documentation-completeness',
        'Documentation Completeness',
        100,
      ),
    ]);

    expect(health.explainability.weakestMetrics).toEqual([]);
    expect(health.explainability.summary).toContain(
      'No weak metrics were detected.',
    );
    expect(health.explainability.summary).not.toContain('Weakest metrics are');
  });

  it('uses deterministic tie-breaking by metric id for equally weak metrics', () => {
    const health = calculateGovernanceHealth([
      measurement('zeta-metric', 'Zeta Metric', 50),
      measurement('alpha-metric', 'Alpha Metric', 50),
      measurement('beta-metric', 'Beta Metric', 50),
      measurement('perfect-metric', 'Perfect Metric', 100),
    ]);

    expect(health.explainability.weakestMetrics).toEqual([
      {
        id: 'alpha-metric',
        name: 'Alpha Metric',
        score: 50,
      },
      {
        id: 'beta-metric',
        name: 'Beta Metric',
        score: 50,
      },
      {
        id: 'zeta-metric',
        name: 'Zeta Metric',
        score: 50,
      },
    ]);
  });

  it('keeps dbt-like healthy measurements on the canonical 0..100 health scale', () => {
    const health = calculateGovernanceHealth([
      {
        id: 'dbt-model-count',
        name: 'dbt Model Count',
        family: 'architecture',
        value: 12,
        score: 100,
        maxScore: 100,
        unit: 'count',
      },
      {
        id: 'dbt-dependency-count',
        name: 'dbt Dependency Count',
        family: 'architecture',
        value: 18,
        score: 100,
        maxScore: 100,
        unit: 'count',
      },
      {
        id: 'dbt-layer-violation-count',
        name: 'dbt Layer Violation Count',
        family: 'boundaries',
        value: 0,
        score: 100,
        maxScore: 100,
        unit: 'count',
      },
      {
        id: 'dbt-cross-domain-dependency-count',
        name: 'dbt Cross-Domain Dependency Count',
        family: 'boundaries',
        value: 0,
        score: 100,
        maxScore: 100,
        unit: 'count',
      },
      {
        id: 'dbt-hotspot-count',
        name: 'dbt Hotspot Count',
        family: 'architecture',
        value: 0,
        score: 100,
        maxScore: 100,
        unit: 'count',
      },
      {
        id: 'dbt-ownership-completeness-ratio',
        name: 'dbt Ownership Completeness Ratio',
        family: 'ownership',
        value: 0.875,
        score: 87.5,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'dbt-test-coverage-ratio',
        name: 'dbt Test Coverage Ratio',
        family: 'documentation',
        value: 0.875,
        score: 87.5,
        maxScore: 100,
        unit: 'ratio',
      },
      {
        id: 'dbt-documentation-coverage-ratio',
        name: 'dbt Documentation Coverage Ratio',
        family: 'documentation',
        value: 1,
        score: 100,
        maxScore: 100,
        unit: 'ratio',
      },
    ]);

    expect(health).toMatchObject({
      score: 97,
      status: 'good',
      grade: 'A',
    });
  });

  it('clamps out-of-range measurement scores before averaging health', () => {
    const health = calculateGovernanceHealth([
      measurement('too-low', 'Too Low', -25),
      measurement('too-high', 'Too High', 140),
    ]);

    expect(health).toMatchObject({
      score: 50,
      status: 'critical',
      grade: 'F',
    });
  });
});

function createWorkspace(
  nodes: GovernanceNode[],
  relations: GovernanceRelation[],
): GovernanceWorkspace {
  return {
    id: 'workspace',
    name: 'workspace',
    root: '.',
    nodes,
    relations,
  };
}

function findMeasurement(
  measurements: ReturnType<typeof calculateGovernanceMetrics>,
  id: string,
) {
  return measurements.find((measurement) => measurement.id === id);
}

function measurement(id: string, name: string, score: number) {
  return {
    id,
    name,
    family: 'test',
    value: score / 100,
    score,
    maxScore: 100,
    unit: 'score',
  } as const;
}
