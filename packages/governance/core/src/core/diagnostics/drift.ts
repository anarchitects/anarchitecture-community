import type {
  DriftSignal,
  DriftSummary,
  GovernanceMetricFamily,
  MetricSnapshot,
  SnapshotComparison,
  SnapshotDeliveryImpactIndex,
  SnapshotDeliveryImpactIndexDelta,
  SnapshotHealthDelta,
  SnapshotMetricDelta,
  SnapshotMetricFamilyDelta,
  SnapshotSignalDeltas,
  SnapshotSignalSeverityDelta,
  SnapshotSignalSourceDelta,
  SnapshotSignalTypeDelta,
  SnapshotTopIssueDelta,
} from '../model/models.js';
import type {
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  GovernanceSignalType,
} from '../evaluation/signals.js';

const SOURCE_ORDER: GovernanceSignalSource[] = [
  'graph',
  'conformance',
  'policy',
];
const SEVERITY_ORDER: GovernanceSignalSeverity[] = ['info', 'warning', 'error'];
const TYPE_ORDER: GovernanceSignalType[] = [
  'structural-dependency',
  'cross-domain-dependency',
  'missing-domain-context',
  'circular-dependency',
  'conformance-violation',
  'domain-boundary-violation',
  'layer-boundary-violation',
  'ownership-gap',
];
const FAMILY_ORDER: GovernanceMetricFamily[] = [
  'architecture',
  'boundaries',
  'ownership',
  'documentation',
];

export function compareSnapshots(
  baseline: MetricSnapshot,
  current: MetricSnapshot,
): SnapshotComparison {
  return {
    baseline,
    current,
    metricDeltas: diffNumberMap(baseline.metrics, current.metrics),
    scoreDeltas: diffNumberMap(baseline.scores, current.scores),
    newViolations: current.violations.filter(
      (violation) => !hasViolation(baseline.violations, violation),
    ),
    resolvedViolations: baseline.violations.filter(
      (violation) => !hasViolation(current.violations, violation),
    ),
    healthDelta: diffHealth(baseline, current),
    signalDeltas: diffSignalBreakdown(baseline, current),
    metricFamilyDeltas: diffMetricBreakdown(baseline, current),
    topIssueDeltas: diffTopIssues(baseline, current),
    deliveryImpactIndexDeltas: diffDeliveryImpactIndices(baseline, current),
  };
}

export function summarizeDrift(
  comparison: SnapshotComparison,
  threshold = 0.02,
): DriftSignal[] {
  const signals: DriftSignal[] = [];

  const workspaceHealthDelta = comparison.scoreDeltas.find(
    (delta) => delta.id === 'workspaceHealth',
  );
  if (workspaceHealthDelta) {
    signals.push(
      createScoreLikeSignal(
        'workspaceHealth',
        'workspace-health',
        'Workspace Health',
        workspaceHealthDelta,
        threshold,
        comparison.healthDelta
          ? {
              baselineStatus: comparison.healthDelta.baselineStatus,
              currentStatus: comparison.healthDelta.currentStatus,
              baselineGrade: comparison.healthDelta.baselineGrade,
              currentGrade: comparison.healthDelta.currentGrade,
            }
          : undefined,
      ),
    );
  }

  for (const delta of comparison.scoreDeltas) {
    if (delta.id === 'workspaceHealth') {
      continue;
    }

    signals.push(
      createScoreLikeSignal(
        delta.id,
        'metric-score',
        formatMetricScoreLabel(delta.id),
        delta,
        threshold,
      ),
    );
  }

  for (const delta of comparison.metricFamilyDeltas ?? []) {
    signals.push(
      createScoreLikeSignal(
        `metric-family:${delta.family}`,
        'metric-family',
        `Metric Family: ${formatMetricFamily(delta.family)}`,
        delta,
        threshold,
      ),
    );
  }

  for (const delta of comparison.signalDeltas?.bySource ?? []) {
    signals.push(
      createCountLikeSignal(
        `signal-source:${delta.source}`,
        'signal-source',
        `Signal Source: ${delta.source}`,
        delta,
      ),
    );
  }

  for (const delta of comparison.signalDeltas?.byType ?? []) {
    signals.push(
      createCountLikeSignal(
        `signal-type:${delta.type}`,
        'signal-type',
        `Signal Type: ${formatSignalType(delta.type)}`,
        delta,
      ),
    );
  }

  for (const delta of comparison.signalDeltas?.bySeverity ?? []) {
    signals.push(
      createCountLikeSignal(
        `signal-severity:${delta.severity}`,
        'signal-severity',
        `Signal Severity: ${delta.severity}`,
        delta,
      ),
    );
  }

  for (const delta of comparison.topIssueDeltas ?? []) {
    signals.push(
      createCountLikeSignal(
        buildTopIssueSignalId(delta),
        'top-issue',
        `Top Issue: ${delta.message}`,
        {
          baseline: delta.baselineCount,
          current: delta.currentCount,
          delta: delta.delta,
        },
        {
          type: delta.type,
          source: delta.source,
          severity: delta.severity,
          ruleId: delta.ruleId,
          subjects: delta.subjects,
        },
      ),
    );
  }

  signals.push({
    id: 'violation-footprint',
    kind: 'violation-footprint',
    label: 'Violation Footprint',
    status: classifyCountDelta(
      comparison.newViolations.length - comparison.resolvedViolations.length,
    ),
    magnitude: Math.abs(
      comparison.newViolations.length - comparison.resolvedViolations.length,
    ),
    baseline: comparison.baseline.violations.length,
    current: comparison.current.violations.length,
    delta: round(
      comparison.current.violations.length -
        comparison.baseline.violations.length,
    ),
    details: {
      newViolations: comparison.newViolations.length,
      resolvedViolations: comparison.resolvedViolations.length,
    },
  });

  return signals.sort(compareDriftSignals);
}

export function buildDriftSummary(signals: DriftSignal[]): DriftSummary {
  const worsening = signals
    .filter((signal) => signal.status === 'worsening')
    .sort(compareSignalsByMagnitude);
  const improving = signals
    .filter((signal) => signal.status === 'improving')
    .sort(compareSignalsByMagnitude);
  const stableCount = signals.filter(
    (signal) => signal.status === 'stable',
  ).length;

  return {
    overallTrend:
      worsening.length > improving.length
        ? 'worsening'
        : improving.length > worsening.length
          ? 'improving'
          : 'stable',
    worseningCount: worsening.length,
    improvingCount: improving.length,
    stableCount,
    topWorsening: worsening.slice(0, 5),
    topImproving: improving.slice(0, 5),
  };
}

function diffNumberMap(
  baseline: Record<string, number>,
  current: Record<string, number>,
): SnapshotMetricDelta[] {
  const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);

  return [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((id) => {
      const before = baseline[id] ?? 0;
      const after = current[id] ?? 0;
      return {
        id,
        baseline: before,
        current: after,
        delta: round(after - before),
      };
    });
}

function diffHealth(
  baseline: MetricSnapshot,
  current: MetricSnapshot,
): SnapshotHealthDelta | undefined {
  if (!baseline.health || !current.health) {
    return undefined;
  }

  return {
    baselineScore: baseline.health.score,
    currentScore: current.health.score,
    scoreDelta: round(current.health.score - baseline.health.score),
    baselineStatus: baseline.health.status,
    currentStatus: current.health.status,
    baselineGrade: baseline.health.grade,
    currentGrade: current.health.grade,
  };
}

function diffSignalBreakdown(
  baseline: MetricSnapshot,
  current: MetricSnapshot,
): SnapshotSignalDeltas | undefined {
  if (!baseline.signalBreakdown || !current.signalBreakdown) {
    return undefined;
  }

  return {
    bySource: SOURCE_ORDER.map((source) =>
      createSourceDelta(
        source,
        countForSource(baseline, source),
        countForSource(current, source),
      ),
    ),
    byType: TYPE_ORDER.flatMap((type) => {
      const before = countForType(baseline, type);
      const after = countForType(current, type);
      return before === 0 && after === 0
        ? []
        : [
            {
              type,
              baseline: before,
              current: after,
              delta: round(after - before),
            } satisfies SnapshotSignalTypeDelta,
          ];
    }),
    bySeverity: SEVERITY_ORDER.map((severity) =>
      createSeverityDelta(
        severity,
        countForSeverity(baseline, severity),
        countForSeverity(current, severity),
      ),
    ),
  };
}

function diffMetricBreakdown(
  baseline: MetricSnapshot,
  current: MetricSnapshot,
): SnapshotMetricFamilyDelta[] | undefined {
  if (!baseline.metricBreakdown || !current.metricBreakdown) {
    return undefined;
  }

  const baselineFamilies = new Map(
    baseline.metricBreakdown.families.map((entry) => [
      entry.family,
      entry.score,
    ]),
  );
  const currentFamilies = new Map(
    current.metricBreakdown.families.map((entry) => [
      entry.family,
      entry.score,
    ]),
  );

  return FAMILY_ORDER.flatMap((family) => {
    const before = baselineFamilies.get(family);
    const after = currentFamilies.get(family);

    if (before === undefined || after === undefined) {
      return [];
    }

    return [
      {
        family,
        baseline: before,
        current: after,
        delta: round(after - before),
      },
    ];
  });
}

function diffTopIssues(
  baseline: MetricSnapshot,
  current: MetricSnapshot,
): SnapshotTopIssueDelta[] | undefined {
  if (!baseline.topIssues || !current.topIssues) {
    return undefined;
  }

  const baselineIssues = new Map(
    baseline.topIssues.map((issue) => [topIssueKey(issue), issue] as const),
  );
  const currentIssues = new Map(
    current.topIssues.map((issue) => [topIssueKey(issue), issue] as const),
  );
  const keys = new Set([...baselineIssues.keys(), ...currentIssues.keys()]);

  return [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const before = baselineIssues.get(key);
      const after = currentIssues.get(key);
      const template = after ?? before;

      if (!template) {
        throw new Error(`Unable to resolve top issue delta for key "${key}".`);
      }

      const subjects = [
        ...new Set([...(before?.subjects ?? []), ...(after?.subjects ?? [])]),
      ].sort((a, b) => a.localeCompare(b));

      return {
        type: template.type,
        source: template.source,
        severity: template.severity,
        ruleId: template.ruleId,
        message: template.message,
        baselineCount: before?.count ?? 0,
        currentCount: after?.count ?? 0,
        delta: round((after?.count ?? 0) - (before?.count ?? 0)),
        subjects,
      };
    });
}

function diffDeliveryImpactIndices(
  baseline: MetricSnapshot,
  current: MetricSnapshot,
): SnapshotDeliveryImpactIndexDelta[] | undefined {
  const baselineIndices = new Map(
    (baseline.deliveryImpact?.indices ?? []).map((index) => [index.id, index]),
  );
  const currentIndices = new Map(
    (current.deliveryImpact?.indices ?? []).map((index) => [index.id, index]),
  );
  const sharedIds = [...baselineIndices.keys()]
    .filter((id) => currentIndices.has(id))
    .sort((left, right) => left.localeCompare(right));

  if (sharedIds.length === 0) {
    return undefined;
  }

  return sharedIds.map((id) => {
    const before = baselineIndices.get(id) as SnapshotDeliveryImpactIndex;
    const after = currentIndices.get(id) as SnapshotDeliveryImpactIndex;

    return {
      id,
      baselineScore: before.score,
      currentScore: after.score,
      scoreDelta: round(after.score - before.score),
      baselineRisk: before.risk,
      currentRisk: after.risk,
    };
  });
}

function createScoreLikeSignal(
  id: string,
  kind: DriftSignal['kind'],
  label: string,
  delta: SnapshotMetricDelta | SnapshotMetricFamilyDelta,
  threshold: number,
  details?: Record<string, unknown>,
): DriftSignal {
  return {
    id,
    kind,
    label,
    status: classifyScoreDelta(delta.delta, threshold),
    magnitude: Math.abs(delta.delta),
    baseline: delta.baseline,
    current: delta.current,
    delta: delta.delta,
    details,
  };
}

function createCountLikeSignal(
  id: string,
  kind: DriftSignal['kind'],
  label: string,
  delta: { baseline: number; current: number; delta: number },
  details?: Record<string, unknown>,
): DriftSignal {
  return {
    id,
    kind,
    label,
    status: classifyCountDelta(delta.delta),
    magnitude: Math.abs(delta.delta),
    baseline: delta.baseline,
    current: delta.current,
    delta: delta.delta,
    details,
  };
}

function createSourceDelta(
  source: GovernanceSignalSource,
  baseline: number,
  current: number,
): SnapshotSignalSourceDelta {
  return {
    source,
    baseline,
    current,
    delta: round(current - baseline),
  };
}

function createSeverityDelta(
  severity: GovernanceSignalSeverity,
  baseline: number,
  current: number,
): SnapshotSignalSeverityDelta {
  return {
    severity,
    baseline,
    current,
    delta: round(current - baseline),
  };
}

function countForSource(
  snapshot: MetricSnapshot,
  source: GovernanceSignalSource,
): number {
  return (
    snapshot.signalBreakdown?.bySource.find((entry) => entry.source === source)
      ?.count ?? 0
  );
}

function countForType(
  snapshot: MetricSnapshot,
  type: GovernanceSignalType,
): number {
  return (
    snapshot.signalBreakdown?.byType.find((entry) => entry.type === type)
      ?.count ?? 0
  );
}

function countForSeverity(
  snapshot: MetricSnapshot,
  severity: GovernanceSignalSeverity,
): number {
  return (
    snapshot.signalBreakdown?.bySeverity.find(
      (entry) => entry.severity === severity,
    )?.count ?? 0
  );
}

function topIssueKey(issue: {
  type: GovernanceSignalType;
  source: GovernanceSignalSource;
  severity: GovernanceSignalSeverity;
  ruleId?: string;
  message: string;
}): string {
  return [
    issue.type,
    issue.source,
    issue.severity,
    issue.ruleId ?? '',
    issue.message,
  ].join('|');
}

function buildTopIssueSignalId(delta: SnapshotTopIssueDelta): string {
  return `top-issue:${topIssueKey(delta)}`;
}

function compareDriftSignals(a: DriftSignal, b: DriftSignal): number {
  return a.id.localeCompare(b.id);
}

function compareSignalsByMagnitude(a: DriftSignal, b: DriftSignal): number {
  return b.magnitude - a.magnitude || a.id.localeCompare(b.id);
}

function classifyScoreDelta(
  delta: number,
  threshold: number,
): DriftSignal['status'] {
  if (Math.abs(delta) < threshold) {
    return 'stable';
  }

  return delta > 0 ? 'improving' : 'worsening';
}

function classifyCountDelta(delta: number): DriftSignal['status'] {
  if (delta === 0) {
    return 'stable';
  }

  return delta < 0 ? 'improving' : 'worsening';
}

function formatMetricScoreLabel(id: string): string {
  return id
    .split('-')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function formatMetricFamily(family: GovernanceMetricFamily): string {
  return family[0].toUpperCase() + family.slice(1);
}

function formatSignalType(type: GovernanceSignalType): string {
  return type
    .split('-')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function hasViolation(
  haystack: MetricSnapshot['violations'],
  needle: MetricSnapshot['violations'][number],
): boolean {
  return haystack.some(
    (candidate) =>
      candidate.type === needle.type &&
      candidate.source === needle.source &&
      candidate.target === needle.target,
  );
}
