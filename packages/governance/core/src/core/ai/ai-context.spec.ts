import {
  buildCognitiveLoadContext,
  buildDriftInterpretationAnalysis,
  buildOnboardingContext,
  buildPersistentSmellSignals,
  buildPrImpactContext,
  buildRecommendationsTrendContext,
  buildRefactoringSuggestionsContext,
  countWorseningDriftSignals,
  summarizeDriftInterpretation,
  type AiAnalysisRequest,
  type DriftSignal,
  type MetricSnapshot,
  type SnapshotViolation,
} from '../index.js';
import {
  coreTestProjects,
  coreTestWorkspace,
} from '../../../tests/workspace.fixtures.js';

function makeSnapshot(
  timestamp: string,
  violations: SnapshotViolation[],
): MetricSnapshot {
  return {
    timestamp,
    repo: 'demo',
    branch: 'main',
    commitSha: timestamp,
    pluginVersion: '0.0.2',
    metricSchemaVersion: '1',
    metrics: {},
    scores: {},
    violations,
  };
}

describe('core AI context builders', () => {
  it('builds deterministic drift interpretation analysis', () => {
    const request: AiAnalysisRequest = {
      kind: 'drift',
      generatedAt: '2026-05-24T10:00:00.000Z',
      profile: 'frontend-layered',
      inputs: {
        metadata: {
          trendWindowInsufficient: true,
          snapshotCount: 3,
        },
      },
    };
    const signals: DriftSignal[] = [
      {
        id: 'workspace-health',
        kind: 'workspace-health',
        label: 'Workspace Health',
        status: 'worsening',
        magnitude: 8,
        baseline: 80,
        current: 72,
        delta: -8,
      },
      {
        id: 'architecture',
        kind: 'metric-score',
        label: 'Architecture',
        status: 'stable',
        magnitude: 0,
        baseline: 80,
        current: 80,
        delta: 0,
      },
    ];
    const summary = {
      overallTrend: 'worsening' as const,
      worseningCount: 1,
      improvingCount: 0,
      stableCount: 1,
      topWorsening: [signals[0]],
      topImproving: [],
    };

    const analysis = summarizeDriftInterpretation(request, signals, summary);

    expect(buildDriftInterpretationAnalysis(request, signals, summary)).toEqual(
      analysis,
    );
    expect(analysis.summary).toBe(
      'Deterministic drift interpretation indicates a worsening trend (1 worsening, 0 improving, 1 stable).',
    );
    expect(analysis.recommendations[1]).toMatchObject({
      id: 'drift-validate-trend-window',
      priority: 'medium',
      reason:
        'Fewer than four snapshots were available. Treat conclusions as provisional and continue collecting trend data.',
    });
  });

  it('builds reusable PR impact and cognitive-load contexts', () => {
    const prImpact = buildPrImpactContext({
      affectedProjects: ['platform-shell', 'booking-ui'],
      dependencies: coreTestWorkspace.dependencies,
      projects: coreTestWorkspace.projects,
      changedFiles: [
        'apps/platform-shell/src/main.ts',
        'libs/booking/ui/src/lib.ts',
      ],
    });

    expect(prImpact).toEqual({
      changedFilesCount: 2,
      affectedProjects: ['booking-ui', 'platform-shell'],
      affectedProjectsCount: 2,
      affectedDomains: ['booking', 'platform'],
      affectedDomainCount: 2,
      scopedDependencyCount: 2,
      crossDomainDependencyEdges: 1,
    });

    const cognitiveLoad = buildCognitiveLoadContext({
      selectedProjects: ['platform-shell', 'booking-ui'],
      dependencies: coreTestWorkspace.dependencies,
      projects: coreTestWorkspace.projects,
      scope: 'workspace',
      topProjectsLimit: 3,
    });

    expect(cognitiveLoad).toEqual({
      scope: 'workspace',
      selectedProjects: ['booking-ui', 'platform-shell'],
      selectedProjectsCount: 2,
      affectedDomains: ['booking', 'platform'],
      affectedDomainCount: 2,
      scopedDependencyCount: 2,
      crossDomainDependencyEdges: 1,
      averageFanout: 1,
      maxFanout: 1,
      topFanoutProjects: [
        { project: 'booking-ui', fanout: 1 },
        { project: 'platform-shell', fanout: 1 },
      ],
    });
  });

  it('counts worsening drift signals and builds recommendations trend metadata', () => {
    const signals: DriftSignal[] = [
      {
        id: 'workspace-health',
        kind: 'workspace-health',
        label: 'Workspace Health',
        status: 'worsening',
        magnitude: 8,
        baseline: 80,
        current: 72,
        delta: -8,
      },
      {
        id: 'ownership',
        kind: 'metric-score',
        label: 'Ownership',
        status: 'improving',
        magnitude: 4,
        baseline: 70,
        current: 74,
        delta: 4,
      },
      {
        id: 'documentation',
        kind: 'metric-score',
        label: 'Documentation',
        status: 'stable',
        magnitude: 0,
        baseline: 90,
        current: 90,
        delta: 0,
      },
    ];

    expect(countWorseningDriftSignals(signals)).toBe(1);
    expect(
      buildRecommendationsTrendContext({
        signals,
        snapshotCount: 3,
      }),
    ).toEqual({
      overallTrend: 'stable',
      worseningSignalCount: 1,
      improvingSignalCount: 1,
      stableSignalCount: 1,
      signalCount: 3,
      snapshotCount: 3,
      trendWindowInsufficient: true,
    });
  });

  it('builds persistent smell signals, refactoring context, and onboarding context', () => {
    const recentSnapshots = [
      makeSnapshot('2026-05-22T10:00:00.000Z', [
        {
          type: 'domain-boundary',
          source: 'platform-shell',
          target: 'booking-ui',
          severity: 'error',
        },
        {
          type: 'ownership-gap',
          source: 'booking-ui',
          severity: 'warning',
        },
      ]),
      makeSnapshot('2026-05-23T10:00:00.000Z', [
        {
          type: 'domain-boundary',
          source: 'platform-shell',
          target: 'booking-ui',
          severity: 'error',
        },
        {
          type: 'ownership-gap',
          source: 'booking-ui',
          severity: 'warning',
        },
      ]),
      makeSnapshot('2026-05-24T10:00:00.000Z', [
        {
          type: 'domain-boundary',
          source: 'platform-shell',
          target: 'booking-ui',
          severity: 'error',
        },
      ]),
    ];
    const violations: SnapshotViolation[] = [
      {
        type: 'domain-boundary',
        source: 'platform-shell',
        target: 'booking-ui',
        severity: 'error',
      },
      {
        type: 'ownership-gap',
        source: 'booking-ui',
        severity: 'warning',
      },
      {
        type: 'documentation-gap',
        source: 'booking-domain',
        severity: 'info',
      },
    ];

    expect(
      buildPersistentSmellSignals({
        recentSnapshots,
      }),
    ).toEqual([
      {
        type: 'domain-boundary',
        source: 'platform-shell',
        count: 3,
      },
      {
        type: 'ownership-gap',
        source: 'booking-ui',
        count: 2,
      },
    ]);

    expect(
      buildRefactoringSuggestionsContext({
        violations,
        dependencies: coreTestWorkspace.dependencies,
        projects: coreTestProjects,
        recentSnapshots,
        topProjectsLimit: 2,
      }),
    ).toEqual({
      analyzedViolations: 3,
      totalViolations: 3,
      hotspotProjects: [
        { project: 'booking-domain', count: 1 },
        { project: 'booking-ui', count: 1 },
      ],
      highFanoutProjects: [
        { project: 'booking-ui', count: 1 },
        { project: 'platform-shell', count: 1 },
      ],
      hotspotDomains: ['booking'],
      persistentSmellSignals: [
        { type: 'domain-boundary', source: 'platform-shell', count: 3 },
        { type: 'ownership-gap', source: 'booking-ui', count: 2 },
      ],
      snapshotCount: 3,
      sampledSnapshotCount: 3,
    });

    expect(
      buildOnboardingContext({
        projects: coreTestProjects,
        dependencies: coreTestWorkspace.dependencies,
        topViolations: violations.slice(0, 2),
        totalViolationsCount: violations.length,
        topProjectsLimit: 2,
      }),
    ).toEqual({
      projectCount: 3,
      dependencyCount: 2,
      ownershipCoverage: 1,
      domainSummary: [
        { domain: 'booking', count: 2 },
        { domain: 'platform', count: 1 },
      ],
      layerSummary: [
        { layer: 'app', count: 1 },
        { layer: 'domain', count: 1 },
        { layer: 'ui', count: 1 },
      ],
      topFanoutProjects: [
        { project: 'booking-ui', count: 1 },
        { project: 'platform-shell', count: 1 },
      ],
      analyzedViolations: 2,
      totalViolations: 3,
    });
  });
});
