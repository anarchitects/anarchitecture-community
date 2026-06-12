import {
  buildGovernanceAssessment,
  buildTopIssues,
  buildTopSignals,
  type GovernanceAssessment,
  type GovernanceSignal,
  type HealthScore,
  type Measurement,
  type Violation,
} from '../index.js';
import { coreTestWorkspace } from '../../../tests/workspace.fixtures.js';

describe('buildGovernanceAssessment', () => {
  const violations: Violation[] = [
    {
      id: 'booking-ui-domain',
      ruleId: 'domain-boundary',
      subjectId: 'booking-ui',
      severity: 'error',
      category: 'boundary',
      message: 'Cross-domain dependency.',
      reference: {
        nodeId: 'booking-ui',
        relatedNodeIds: ['booking-ui', 'platform-shell'],
      },
    },
    {
      id: 'booking-domain-ownership',
      ruleId: 'ownership-presence',
      subjectId: 'booking-domain',
      severity: 'warning',
      category: 'ownership',
      message: 'Ownership missing.',
      reference: {
        nodeId: 'booking-domain',
      },
    },
  ];

  const signals: GovernanceSignal[] = [
    {
      id: 'booking-ui-domain-signal',
      type: 'domain-boundary-violation',
      nodeId: 'booking-ui',
      relatedNodeIds: ['booking-ui', 'platform-shell'],
      severity: 'error',
      category: 'boundary',
      message: 'Cross-domain dependency.',
      metadata: {
        ruleId: 'domain-boundary',
      },
      source: 'policy',
      createdAt: '2026-05-13T09:00:00.000Z',
    },
    {
      id: 'booking-domain-ownership-signal',
      type: 'ownership-gap',
      nodeId: 'booking-domain',
      relatedNodeIds: ['booking-domain'],
      severity: 'warning',
      category: 'ownership',
      message: 'Ownership missing.',
      metadata: {
        ruleId: 'ownership-presence',
      },
      source: 'policy',
      createdAt: '2026-05-13T09:01:00.000Z',
    },
    {
      id: 'platform-shell-graph-signal',
      type: 'structural-dependency',
      nodeId: 'platform-shell',
      relatedNodeIds: ['platform-shell', 'booking-ui'],
      severity: 'info',
      category: 'dependency',
      message: 'Structural dependency.',
      source: 'graph',
      createdAt: '2026-05-13T09:02:00.000Z',
    },
  ];

  const measurements: Measurement[] = [
    {
      id: 'domain-integrity',
      name: 'Domain Integrity',
      family: 'boundaries',
      value: 0.75,
      score: 75,
      maxScore: 100,
      unit: 'ratio',
    },
    {
      id: 'ownership-coverage',
      name: 'Ownership Coverage',
      family: 'ownership',
      value: 0.66,
      score: 66,
      maxScore: 100,
      unit: 'ratio',
    },
    {
      id: 'architectural-entropy',
      name: 'Architectural Entropy',
      family: 'architecture',
      value: 0.2,
      score: 80,
      maxScore: 100,
      unit: 'ratio',
    },
  ];

  const health: HealthScore = {
    score: 74,
    status: 'warning',
    grade: 'C',
    hotspots: ['Ownership Coverage'],
    metricHotspots: [
      {
        id: 'ownership-coverage',
        name: 'Ownership Coverage',
        score: 66,
      },
    ],
    subjectHotspots: [],
    explainability: {
      summary: 'Warning due to ownership and boundary pressure.',
      statusReason: 'Score 74 is above warning threshold.',
      weakestMetrics: [
        {
          id: 'ownership-coverage',
          name: 'Ownership Coverage',
          score: 66,
        },
      ],
      dominantIssues: buildTopIssues(signals),
    },
  };

  const baseAssessmentInput = {
    workspace: coreTestWorkspace,
    profile: 'frontend-layered',
    warnings: ['Using preset defaults.'],
    exceptions: {
      summary: {
        declaredCount: 0,
        matchedCount: 0,
        suppressedPolicyViolationCount: 0,
        suppressedConformanceFindingCount: 0,
        unusedExceptionCount: 0,
        activeExceptionCount: 0,
        staleExceptionCount: 0,
        expiredExceptionCount: 0,
        reactivatedPolicyViolationCount: 0,
        reactivatedConformanceFindingCount: 0,
      },
      used: [],
      unused: [],
      suppressedFindings: [],
      reactivatedFindings: [],
    },
    violations,
    signals,
    measurements,
    health,
    recommendations: [
      {
        id: 'reduce-cross-domain-dependencies',
        title: 'Reduce cross-domain dependencies',
        priority: 'high',
        reason: 'Boundary pressure remains high.',
      },
    ],
  } satisfies Parameters<typeof buildGovernanceAssessment>[0];

  it('assembles a deterministic JSON-safe governance assessment', () => {
    const assessment = buildGovernanceAssessment(baseAssessmentInput);

    expect(assessment.workspace).toBe(coreTestWorkspace);
    expect(assessment.profile).toBe('frontend-layered');
    expect(assessment.signalBreakdown.total).toBe(3);
    expect(
      assessment.metricBreakdown.families.map((family) => family.family),
    ).toEqual(['architecture', 'boundaries', 'ownership']);
    expect(assessment.topIssues.map((issue) => issue.type)).toEqual([
      'domain-boundary-violation',
      'ownership-gap',
    ]);
    expect(assessment).not.toHaveProperty('topSignals');
    expect(
      JSON.parse(JSON.stringify(assessment)) as GovernanceAssessment,
    ).toEqual(assessment);
  });

  it('filters assessment output by report type while preserving health and recommendations', () => {
    const assessment = buildGovernanceAssessment({
      ...baseAssessmentInput,
      reportType: 'ownership',
    });

    expect(assessment.violations.map((violation) => violation.ruleId)).toEqual([
      'ownership-presence',
    ]);
    expect(
      assessment.measurements.map((measurement) => measurement.id),
    ).toEqual(['ownership-coverage']);
    expect(assessment.topIssues.map((issue) => issue.type)).toEqual([
      'ownership-gap',
    ]);
    expect(assessment.health).toBe(health);
    expect(assessment.recommendations).toEqual(
      baseAssessmentInput.recommendations,
    );
  });

  it('omits top issues when the assessment contains only info-level signals', () => {
    const assessment = buildGovernanceAssessment({
      ...baseAssessmentInput,
      signals: signals.filter((signal) => signal.severity === 'info'),
    });

    expect(assessment.topIssues).toEqual([]);
  });

  it('includes top signals only when explicitly requested', () => {
    const assessment = buildGovernanceAssessment({
      ...baseAssessmentInput,
      includeTopSignals: true,
    });

    expect(assessment.topIssues.map((issue) => issue.type)).toEqual([
      'domain-boundary-violation',
      'ownership-gap',
    ]);
    expect(assessment.topSignals?.map((signal) => signal.type)).toEqual([
      'structural-dependency',
      'ownership-gap',
      'domain-boundary-violation',
    ]);
  });

  it('preserves assessment-level extension-owned expansions without interpreting them', () => {
    const assessment = buildGovernanceAssessment({
      ...baseAssessmentInput,
      extensions: {
        'governance-extension:typescript': {
          extensionId: 'governance-extension:typescript',
          contractVersion: '1',
          data: {
            kind: 'runtime-context',
            technology: 'typescript',
            config: {
              signals: {
                importGraph: true,
              },
            },
          },
        },
      },
    });

    expect(assessment.extensions).toEqual({
      'governance-extension:typescript': {
        extensionId: 'governance-extension:typescript',
        contractVersion: '1',
        data: {
          kind: 'runtime-context',
          technology: 'typescript',
          config: {
            signals: {
              importGraph: true,
            },
          },
        },
      },
    });
  });
});

describe('buildTopIssues', () => {
  function createSignal(
    overrides: Partial<GovernanceSignal> = {},
  ): GovernanceSignal {
    return {
      id: 'signal',
      type: 'structural-dependency',
      nodeId: 'booking-ui',
      relatedNodeIds: ['booking-ui', 'platform-shell'],
      severity: 'info',
      category: 'dependency',
      message: 'Dependency: booking-ui -> platform-shell.',
      source: 'graph',
      createdAt: '2026-05-13T09:02:00.000Z',
      ...overrides,
    };
  }

  it('excludes info-level telemetry from top issues', () => {
    expect(
      buildTopIssues([
        createSignal(),
        createSignal({
          id: 'signal-2',
          nodeId: 'booking-domain',
          relatedNodeIds: ['booking-domain', 'shared-kernel'],
          message: 'Dependency: booking-domain -> shared-kernel.',
        }),
      ]),
    ).toEqual([]);
  });

  it('includes warning-level entries in top issues', () => {
    expect(
      buildTopIssues([
        createSignal({
          id: 'warning-signal',
          type: 'cross-domain-dependency',
          severity: 'warning',
          category: 'boundary',
          message: 'Cross-domain dependency.',
        }),
      ]),
    ).toEqual([
      expect.objectContaining({
        type: 'cross-domain-dependency',
        severity: 'warning',
      }),
    ]);
  });

  it('includes error-level entries in top issues', () => {
    expect(
      buildTopIssues([
        createSignal({
          id: 'error-signal',
          type: 'domain-boundary-violation',
          severity: 'error',
          category: 'boundary',
          source: 'policy',
          message: 'Cross-domain dependency.',
          metadata: {
            ruleId: 'domain-boundary',
          },
        }),
      ]),
    ).toEqual([
      expect.objectContaining({
        type: 'domain-boundary-violation',
        severity: 'error',
      }),
    ]);
  });

  it('keeps deterministic ordering while excluding info entries', () => {
    expect(
      buildTopIssues([
        createSignal({
          id: 'info-signal',
          message: 'Dependency: booking-ui -> platform-shell.',
        }),
        createSignal({
          id: 'warning-b',
          type: 'missing-domain-context',
          severity: 'warning',
          category: 'boundary',
          nodeId: 'shared-kernel',
          relatedNodeIds: ['shared-kernel', 'platform-shell'],
          message: 'Missing domain context.',
        }),
        createSignal({
          id: 'warning-a',
          type: 'cross-domain-dependency',
          severity: 'warning',
          category: 'boundary',
          message: 'Cross-domain dependency.',
        }),
        createSignal({
          id: 'error-signal',
          type: 'domain-boundary-violation',
          severity: 'error',
          category: 'boundary',
          source: 'policy',
          message: 'Policy boundary violation.',
        }),
      ]).map((issue) => issue.type),
    ).toEqual([
      'domain-boundary-violation',
      'cross-domain-dependency',
      'missing-domain-context',
    ]);
  });

  it('keeps generic relation-level issues scoped to relations', () => {
    expect(
      buildTopIssues([
        createSignal({
          id: 'generic-relation-issue',
          type: 'cross-domain-dependency',
          severity: 'warning',
          category: 'boundary',
          nodeId: 'booking-api',
          relationId: 'relation:booking-api->booking-interface',
          relatedNodeIds: ['booking-api', 'booking-interface'],
          message: 'Cross-domain dependency.',
        }),
      ]),
    ).toEqual([
      expect.objectContaining({
        subjects: ['relation:booking-api->booking-interface'],
      }),
    ]);
  });

  it('keeps only relevant missing-domain-context subjects for the missing source side', () => {
    expect(
      buildTopIssues([
        createSignal({
          id: 'missing-source-domain',
          type: 'missing-domain-context',
          severity: 'warning',
          category: 'boundary',
          nodeId: 'booking-api',
          relationId: 'relation:booking-api->booking-interface',
          relatedNodeIds: ['booking-api', 'booking-interface'],
          message: 'Missing domain context.',
          metadata: {
            missingSourceDomain: true,
            missingTargetDomain: false,
          },
        }),
      ]),
    ).toEqual([
      expect.objectContaining({
        subjects: ['booking-api', 'relation:booking-api->booking-interface'],
      }),
    ]);
  });

  it('keeps only relevant missing-domain-context subjects for the missing target side', () => {
    expect(
      buildTopIssues([
        createSignal({
          id: 'missing-target-domain',
          type: 'missing-domain-context',
          severity: 'warning',
          category: 'boundary',
          nodeId: 'booking-api',
          relationId: 'relation:booking-api->booking-interface',
          relatedNodeIds: ['booking-api', 'booking-interface'],
          message: 'Missing domain context.',
          metadata: {
            missingSourceDomain: false,
            missingTargetDomain: true,
          },
        }),
      ]),
    ).toEqual([
      expect.objectContaining({
        subjects: [
          'booking-interface',
          'relation:booking-api->booking-interface',
        ],
      }),
    ]);
  });

  it('keeps only relevant missing-domain-context subjects when both domains are missing', () => {
    expect(
      buildTopIssues([
        createSignal({
          id: 'missing-both-domains',
          type: 'missing-domain-context',
          severity: 'warning',
          category: 'boundary',
          nodeId: 'booking-api',
          relationId: 'relation:booking-api->booking-interface',
          relatedNodeIds: ['booking-api', 'booking-interface'],
          message: 'Missing domain context.',
          metadata: {
            missingSourceDomain: true,
            missingTargetDomain: true,
          },
        }),
      ]),
    ).toEqual([
      expect.objectContaining({
        subjects: [
          'booking-api',
          'booking-interface',
          'relation:booking-api->booking-interface',
        ],
      }),
    ]);
  });
});

describe('buildTopSignals', () => {
  function createSignal(
    overrides: Partial<GovernanceSignal> = {},
  ): GovernanceSignal {
    return {
      id: 'signal',
      type: 'structural-dependency',
      nodeId: 'booking-ui',
      relatedNodeIds: ['booking-ui', 'platform-shell'],
      severity: 'info',
      category: 'dependency',
      message: 'Dependency: booking-ui -> platform-shell.',
      source: 'graph',
      createdAt: '2026-05-13T09:02:00.000Z',
      ...overrides,
    };
  }

  it('includes info-level telemetry when requested', () => {
    expect(
      buildTopSignals([
        createSignal(),
        createSignal({
          id: 'warning-signal',
          type: 'cross-domain-dependency',
          severity: 'warning',
          category: 'boundary',
          message: 'Cross-domain dependency.',
        }),
      ]).map((signal) => signal.severity),
    ).toEqual(['info', 'warning']);
  });

  it('keeps deterministic ordering across info, warning, and error signals', () => {
    expect(
      buildTopSignals([
        createSignal({
          id: 'error-signal',
          type: 'domain-boundary-violation',
          severity: 'error',
          category: 'boundary',
          source: 'policy',
          message: 'Policy boundary violation.',
        }),
        createSignal({
          id: 'warning-signal',
          type: 'cross-domain-dependency',
          severity: 'warning',
          category: 'boundary',
          message: 'Cross-domain dependency.',
        }),
        createSignal({
          id: 'info-signal-b',
          nodeId: 'booking-domain',
          relatedNodeIds: ['booking-domain', 'shared-kernel'],
          message: 'Dependency: booking-domain -> shared-kernel.',
        }),
        createSignal({
          id: 'info-signal-a',
          message: 'Dependency: booking-ui -> platform-shell.',
        }),
      ]).map((signal) => `${signal.source}:${signal.severity}:${signal.type}`),
    ).toEqual([
      'graph:info:structural-dependency',
      'graph:info:structural-dependency',
      'graph:warning:cross-domain-dependency',
      'policy:error:domain-boundary-violation',
    ]);
  });
});
