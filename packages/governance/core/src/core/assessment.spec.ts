import {
  buildGovernanceAssessment,
  buildTopIssues,
  type GovernanceAssessment,
  type GovernanceSignal,
  type HealthScore,
  type Measurement,
  type Violation,
} from './index.js';
import { coreTestWorkspace } from '../../tests/workspace.fixtures.js';

describe('buildGovernanceAssessment', () => {
  const violations: Violation[] = [
    {
      id: 'booking-ui-domain',
      ruleId: 'domain-boundary',
      project: 'booking-ui',
      severity: 'error',
      category: 'boundary',
      message: 'Cross-domain dependency.',
    },
    {
      id: 'booking-domain-ownership',
      ruleId: 'ownership-presence',
      project: 'booking-domain',
      severity: 'warning',
      category: 'ownership',
      message: 'Ownership missing.',
    },
  ];

  const signals: GovernanceSignal[] = [
    {
      id: 'booking-ui-domain-signal',
      type: 'domain-boundary-violation',
      sourceProjectId: 'booking-ui',
      targetProjectId: 'platform-shell',
      relatedProjectIds: ['booking-ui', 'platform-shell'],
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
      sourceProjectId: 'booking-domain',
      relatedProjectIds: ['booking-domain'],
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
      sourceProjectId: 'platform-shell',
      targetProjectId: 'booking-ui',
      relatedProjectIds: ['platform-shell', 'booking-ui'],
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
    projectHotspots: [],
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
      'structural-dependency',
    ]);
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
});
