import {
  buildDriftSummary,
  buildRootCauseRequest,
  buildScorecardRequest,
  buildScopedDriftRequest,
  buildScopedRootCauseRequest,
  buildScopedScorecardRequest,
  buildGovernancePayloadTruncationMetadata,
  compareGovernanceViolationsForPriority,
  scopeGovernanceDependencies,
  sliceGovernancePayloadItems,
  type AiAnalysisRequest,
  type DriftSignal,
  type MetricSnapshot,
  type SnapshotComparison,
  type SnapshotViolation,
} from './index.js';
import { coreTestWorkspace } from '../../tests/workspace.fixtures.js';

function makeSnapshot(overrides: Partial<MetricSnapshot> = {}): MetricSnapshot {
  return {
    timestamp: '2026-05-24T10:00:00.000Z',
    repo: 'demo',
    branch: 'main',
    commitSha: 'abc123',
    pluginVersion: '0.0.2',
    metricSchemaVersion: '1',
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
    ...overrides,
  };
}

describe('core AI payload helpers', () => {
  it('builds deterministic truncation metadata and slices payload items', () => {
    expect(buildGovernancePayloadTruncationMetadata(5, 2, 2)).toEqual({
      totalCount: 5,
      selectedCount: 2,
      limit: 2,
      truncated: true,
    });

    expect(
      sliceGovernancePayloadItems(
        [{ id: 'b' }, { id: 'a' }, { id: 'c' }],
        2,
        (left, right) => left.id.localeCompare(right.id),
      ),
    ).toEqual({
      items: [{ id: 'a' }, { id: 'b' }],
      truncation: {
        totalCount: 3,
        selectedCount: 2,
        limit: 2,
        truncated: true,
      },
    });
  });

  it('scopes dependencies and prioritizes violations deterministically', () => {
    const dependencySlice = scopeGovernanceDependencies(
      coreTestWorkspace.dependencies,
      new Set(['platform-shell', 'booking-ui']),
      1,
    );

    expect(dependencySlice.items).toEqual([
      {
        source: 'booking-ui',
        target: 'booking-domain',
        type: 'static',
      },
    ]);
    expect(dependencySlice.truncation.truncated).toBe(true);

    const violations: SnapshotViolation[] = [
      {
        type: 'ownership-gap',
        source: 'platform-shell',
        severity: 'warning',
      },
      {
        type: 'domain-boundary',
        source: 'booking-ui',
        target: 'booking-domain',
        severity: 'error',
      },
      {
        type: 'domain-boundary',
        source: 'booking-domain',
        severity: 'error',
      },
    ];

    expect(
      [...violations].sort(compareGovernanceViolationsForPriority),
    ).toEqual([
      {
        type: 'domain-boundary',
        source: 'booking-domain',
        severity: 'error',
      },
      {
        type: 'domain-boundary',
        source: 'booking-ui',
        target: 'booking-domain',
        severity: 'error',
      },
      {
        type: 'ownership-gap',
        source: 'platform-shell',
        severity: 'warning',
      },
    ]);
  });

  it('builds a scoped root-cause request with dependency truncation metadata', () => {
    const snapshot = makeSnapshot({
      violations: [
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
      ],
    });
    const prioritizedViolations = snapshot.violations.slice(0, 2);
    const request = buildRootCauseRequest({
      profile: 'frontend-layered',
      snapshot,
      dependencies: coreTestWorkspace.dependencies,
      topViolations: prioritizedViolations,
      metadata: {
        snapshotPath: 'snapshots/latest.json',
      },
    });

    const scoped = buildScopedRootCauseRequest({
      request,
      dependencyLimit: 1,
      topViolationsLimit: 2,
    });

    expect(scoped.request.inputs.dependencies).toHaveLength(1);
    expect(scoped.payloadScope).toEqual({
      projectScopeCount: 2,
      dependencies: {
        totalCount: 2,
        selectedCount: 1,
        limit: 1,
        truncated: true,
      },
      violations: {
        totalCount: 3,
        selectedCount: 2,
        limit: 2,
        truncated: true,
      },
    });
    expect(scoped.request.inputs.metadata).toMatchObject({
      snapshotPath: 'snapshots/latest.json',
      payloadScope: scoped.payloadScope,
    });
  });

  it('builds a scoped drift request with sliced signals, deltas, and violations', () => {
    const comparison: SnapshotComparison = {
      baseline: makeSnapshot({
        timestamp: '2026-05-23T10:00:00.000Z',
        commitSha: 'base123',
        violations: [
          {
            type: 'ownership-gap',
            source: 'booking-ui',
            severity: 'warning',
          },
        ],
      }),
      current: makeSnapshot({
        timestamp: '2026-05-24T10:00:00.000Z',
        commitSha: 'head123',
        violations: [
          {
            type: 'domain-boundary',
            source: 'platform-shell',
            target: 'booking-ui',
            severity: 'error',
          },
        ],
      }),
      metricDeltas: [
        {
          id: 'architectural-entropy',
          baseline: 0.2,
          current: 0.35,
          delta: 0.15,
        },
        { id: 'ownership-coverage', baseline: 0.8, current: 0.7, delta: -0.1 },
      ],
      scoreDeltas: [
        { id: 'workspaceHealth', baseline: 80, current: 72, delta: -8 },
        { id: 'architecture', baseline: 80, current: 70, delta: -10 },
      ],
      newViolations: [
        {
          type: 'domain-boundary',
          source: 'platform-shell',
          target: 'booking-ui',
          severity: 'error',
        },
        {
          type: 'ownership-gap',
          source: 'booking-domain',
          severity: 'warning',
        },
      ],
      resolvedViolations: [
        {
          type: 'documentation-gap',
          source: 'booking-ui',
          severity: 'info',
        },
        {
          type: 'ownership-gap',
          source: 'platform-shell',
          severity: 'warning',
        },
      ],
      healthDelta: {
        baselineScore: 80,
        currentScore: 72,
        scoreDelta: -8,
        baselineStatus: 'warning',
        currentStatus: 'warning',
        baselineGrade: 'B',
        currentGrade: 'C',
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
        status: 'worsening',
        magnitude: 10,
        baseline: 80,
        current: 70,
        delta: -10,
      },
    ];
    const summary = buildDriftSummary(signals);
    const request: AiAnalysisRequest = {
      kind: 'drift',
      generatedAt: '2026-05-24T10:00:00.000Z',
      profile: 'frontend-layered',
      inputs: {
        comparison,
        metadata: {
          trendWindowInsufficient: true,
        },
      },
    };

    const scoped = buildScopedDriftRequest({
      request,
      comparison,
      signals,
      summary,
      signalLimit: 1,
      deltaLimit: 1,
      violationLimit: 1,
    });

    expect(scoped.request.inputs.metadata).toMatchObject({
      trendWindowInsufficient: true,
      signals: [signals[1]],
      driftSummary: summary,
      payloadScope: scoped.payloadScope,
    });
    expect(scoped.request.inputs.comparison).toMatchObject({
      baseline: {
        timestamp: '2026-05-23T10:00:00.000Z',
        metrics: {},
        scores: {},
        violations: [],
      },
      current: {
        timestamp: '2026-05-24T10:00:00.000Z',
        metrics: {},
        scores: {},
        violations: [],
      },
      metricDeltas: [
        {
          id: 'architectural-entropy',
          baseline: 0.2,
          current: 0.35,
          delta: 0.15,
        },
      ],
      scoreDeltas: [
        { id: 'architecture', baseline: 80, current: 70, delta: -10 },
      ],
      newViolations: [
        {
          type: 'domain-boundary',
          source: 'platform-shell',
          target: 'booking-ui',
          severity: 'error',
        },
      ],
      resolvedViolations: [
        {
          type: 'ownership-gap',
          source: 'platform-shell',
          severity: 'warning',
        },
      ],
    });
    expect(scoped.payloadScope).toEqual({
      signals: { totalCount: 2, selectedCount: 1, limit: 1, truncated: true },
      metricDeltas: {
        totalCount: 2,
        selectedCount: 1,
        limit: 1,
        truncated: true,
      },
      scoreDeltas: {
        totalCount: 2,
        selectedCount: 1,
        limit: 1,
        truncated: true,
      },
      newViolations: {
        totalCount: 2,
        selectedCount: 1,
        limit: 1,
        truncated: true,
      },
      resolvedViolations: {
        totalCount: 2,
        selectedCount: 1,
        limit: 1,
        truncated: true,
      },
    });
  });

  it('builds a scoped scorecard request with redacted comparison snapshots', () => {
    const snapshot = makeSnapshot({
      violations: [
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
      ],
    });
    const comparison: SnapshotComparison = {
      baseline: makeSnapshot({
        timestamp: '2026-05-23T10:00:00.000Z',
        commitSha: 'base123',
      }),
      current: snapshot,
      metricDeltas: [
        {
          id: 'architectural-entropy',
          baseline: 0.2,
          current: 0.25,
          delta: 0.05,
        },
        { id: 'ownership-coverage', baseline: 0.8, current: 0.7, delta: -0.1 },
      ],
      scoreDeltas: [
        { id: 'workspaceHealth', baseline: 80, current: 76, delta: -4 },
        { id: 'architecture', baseline: 80, current: 75, delta: -5 },
      ],
      newViolations: snapshot.violations,
      resolvedViolations: [],
    };
    const request = buildScorecardRequest({
      profile: 'frontend-layered',
      snapshot,
      comparison,
      metadata: {
        snapshotPath: 'snapshots/current.json',
      },
    });

    const scoped = buildScopedScorecardRequest({
      request,
      snapshot,
      comparison,
      violationLimit: 1,
      deltaLimit: 1,
    });

    expect(scoped.request.inputs.snapshot?.violations).toEqual([
      {
        type: 'domain-boundary',
        source: 'platform-shell',
        target: 'booking-ui',
        severity: 'error',
      },
    ]);
    expect(scoped.request.inputs.comparison).toMatchObject({
      baseline: {
        timestamp: '2026-05-23T10:00:00.000Z',
        violations: [],
      },
      current: {
        timestamp: '2026-05-24T10:00:00.000Z',
        violations: [],
      },
      metricDeltas: [
        { id: 'ownership-coverage', baseline: 0.8, current: 0.7, delta: -0.1 },
      ],
      scoreDeltas: [
        { id: 'architecture', baseline: 80, current: 75, delta: -5 },
      ],
      newViolations: [],
      resolvedViolations: [],
    });
    expect(scoped.request.inputs.metadata).toMatchObject({
      snapshotPath: 'snapshots/current.json',
      payloadScope: scoped.payloadScope,
    });
  });
});
