import { buildMetricSnapshot, type GovernanceAssessment } from '../index.js';
import { coreTestWorkspace } from '../../../tests/workspace.fixtures.js';

describe('buildMetricSnapshot', () => {
  it('builds a deterministic snapshot contract without filesystem dependencies', () => {
    const assessment: GovernanceAssessment = {
      workspace: coreTestWorkspace,
      profile: 'frontend-layered',
      warnings: [],
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
      violations: [
        {
          id: 'booking-ui-domain',
          ruleId: 'domain-boundary',
          project: 'booking-ui',
          severity: 'error',
          category: 'boundary',
          message: 'Cross-domain dependency.',
          details: {
            target: 'platform-shell',
          },
        },
      ],
      measurements: [
        {
          id: 'architectural-entropy',
          name: 'Architectural Entropy',
          family: 'architecture',
          value: 0.2,
          score: 80,
          maxScore: 100,
          unit: 'ratio',
        },
      ],
      signalBreakdown: {
        total: 1,
        bySource: [
          { source: 'graph', count: 0 },
          { source: 'conformance', count: 0 },
          { source: 'policy', count: 1 },
          { source: 'extension', count: 0 },
        ],
        byType: [{ type: 'domain-boundary-violation', count: 1 }],
        bySeverity: [
          { severity: 'info', count: 0 },
          { severity: 'warning', count: 0 },
          { severity: 'error', count: 1 },
        ],
      },
      metricBreakdown: {
        families: [
          {
            family: 'architecture',
            score: 80,
            measurements: [
              {
                id: 'architectural-entropy',
                name: 'Architectural Entropy',
                score: 80,
              },
            ],
          },
        ],
      },
      topIssues: [
        {
          type: 'domain-boundary-violation',
          source: 'policy',
          severity: 'error',
          count: 1,
          projects: ['booking-ui', 'platform-shell'],
          ruleId: 'domain-boundary',
          message: 'Cross-domain dependency.',
        },
      ],
      health: {
        score: 80,
        status: 'warning',
        grade: 'B',
        hotspots: [],
        metricHotspots: [],
        projectHotspots: [],
        explainability: {
          summary: 'Warning due to architecture.',
          statusReason: 'Score is below good threshold.',
          weakestMetrics: [],
          dominantIssues: [],
        },
      },
      recommendations: [],
    };

    const snapshot = buildMetricSnapshot(assessment, {
      timestamp: '2026-05-13T10:00:00.000Z',
      repo: 'test-repo',
      branch: 'main',
      commitSha: 'abc123',
      pluginVersion: '0.1.0',
      metricSchemaVersion: '1.1',
    });

    expect(snapshot.metrics).toEqual({
      'architectural-entropy': 0.2,
    });
    expect(snapshot.scores).toEqual({
      workspaceHealth: 80,
      'architectural-entropy': 80,
    });
    expect(snapshot.violations).toEqual([
      {
        type: 'domain-boundary',
        source: 'booking-ui',
        target: 'platform-shell',
        ruleId: 'domain-boundary',
        severity: 'error',
        message: 'Cross-domain dependency.',
      },
    ]);
  });
});
