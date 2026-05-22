import {
  buildDriftSummary,
  compareSnapshots,
  summarizeDrift,
  type MetricSnapshot,
} from './index.js';

function makeSnapshot(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    timestamp: '2026-05-13T10:00:00.000Z',
    repo: 'test-repo',
    branch: 'main',
    commitSha: 'abc123',
    pluginVersion: '0.1.0',
    metricSchemaVersion: '1.1',
    metrics: {
      'architectural-entropy': 0.2,
    },
    scores: {
      workspaceHealth: 80,
      'architectural-entropy': 80,
    },
    violations: [],
    health: {
      score: 80,
      status: 'warning',
      grade: 'B',
    },
    signalBreakdown: {
      total: 0,
      bySource: [
        { source: 'graph', count: 0 },
        { source: 'conformance', count: 0 },
        { source: 'policy', count: 0 },
      ],
      byType: [],
      bySeverity: [
        { severity: 'info', count: 0 },
        { severity: 'warning', count: 0 },
        { severity: 'error', count: 0 },
      ],
    },
    metricBreakdown: {
      families: [
        {
          family: 'architecture',
          score: 80,
          measurements: [],
        },
      ],
    },
    topIssues: [],
    ...overrides,
  };
}

describe('core drift comparison', () => {
  it('compares identical snapshots without meaningful drift', () => {
    const baseline = makeSnapshot();
    const comparison = compareSnapshots(baseline, makeSnapshot());
    const signals = summarizeDrift(comparison);
    const summary = buildDriftSummary(signals);

    expect(comparison.metricDeltas).toEqual([
      {
        id: 'architectural-entropy',
        baseline: 0.2,
        current: 0.2,
        delta: 0,
      },
    ]);
    expect(comparison.newViolations).toEqual([]);
    expect(comparison.resolvedViolations).toEqual([]);
    expect(summary.overallTrend).toBe('stable');
    expect(signals.every((signal) => signal.status === 'stable')).toBe(true);
  });

  it('captures changed health score and metric family deltas', () => {
    const comparison = compareSnapshots(
      makeSnapshot(),
      makeSnapshot({
        metrics: {
          'architectural-entropy': 0.15,
        },
        scores: {
          workspaceHealth: 76,
          'architectural-entropy': 84,
        },
        health: {
          score: 76,
          status: 'warning',
          grade: 'B',
        },
        metricBreakdown: {
          families: [
            {
              family: 'architecture',
              score: 84,
              measurements: [],
            },
          ],
        },
      }),
    );

    expect(comparison.metricDeltas).toEqual([
      {
        id: 'architectural-entropy',
        baseline: 0.2,
        current: 0.15,
        delta: -0.05,
      },
    ]);
    expect(comparison.healthDelta).toEqual({
      baselineScore: 80,
      currentScore: 76,
      scoreDelta: -4,
      baselineStatus: 'warning',
      currentStatus: 'warning',
      baselineGrade: 'B',
      currentGrade: 'B',
    });
    expect(comparison.metricFamilyDeltas).toEqual([
      {
        family: 'architecture',
        baseline: 80,
        current: 84,
        delta: 4,
      },
    ]);
  });
});
