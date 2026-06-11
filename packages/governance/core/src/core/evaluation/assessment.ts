import type {
  GovernanceAssessment,
  GovernanceExceptionReport,
  GovernanceMetricFamily,
  GovernanceTopIssue,
  Measurement,
  MetricBreakdown,
  Recommendation,
  SignalBreakdown,
  Violation,
  GovernanceWorkspace,
  HealthScore,
} from '../model/models.js';
import type {
  GovernanceSignal,
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  GovernanceSignalType,
  KnownGovernanceSignalType,
} from './signals.js';

export type GovernanceAssessmentReportType =
  | 'health'
  | 'boundaries'
  | 'ownership'
  | 'architecture';

export interface GovernanceAssessmentInput {
  workspace: GovernanceWorkspace;
  profile: string;
  warnings?: string[];
  exceptions: GovernanceExceptionReport;
  violations: Violation[];
  signals: GovernanceSignal[];
  findings?: GovernanceAssessment['findings'];
  measurements: Measurement[];
  scores?: GovernanceAssessment['scores'];
  health: HealthScore;
  recommendations?: Recommendation[];
  scope?: GovernanceAssessment['scope'];
  perspectives?: GovernanceAssessment['perspectives'];
  metadata?: GovernanceAssessment['metadata'];
  reportType?: GovernanceAssessmentReportType;
}

const SIGNAL_SOURCE_ORDER: GovernanceSignalSource[] = [
  'graph',
  'conformance',
  'policy',
  'extension',
];

const SIGNAL_SEVERITY_ORDER: GovernanceSignalSeverity[] = [
  'info',
  'warning',
  'error',
];

const SIGNAL_TYPE_ORDER: KnownGovernanceSignalType[] = [
  'structural-dependency',
  'cross-domain-dependency',
  'missing-domain-context',
  'circular-dependency',
  'conformance-violation',
  'domain-boundary-violation',
  'layer-boundary-violation',
  'ownership-gap',
  'node-name-convention-violation',
  'tag-convention-violation',
  'missing-domain-violation',
  'missing-layer-violation',
];

const METRIC_FAMILY_ORDER: GovernanceMetricFamily[] = [
  'architecture',
  'boundaries',
  'ownership',
  'documentation',
];

const TOP_ISSUE_SOURCE_ORDER: Record<GovernanceSignalSource, number> = {
  graph: 0,
  conformance: 1,
  policy: 2,
  extension: 3,
};

const TOP_ISSUE_TYPE_ORDER: Record<KnownGovernanceSignalType, number> = {
  'structural-dependency': 0,
  'cross-domain-dependency': 1,
  'missing-domain-context': 2,
  'circular-dependency': 3,
  'conformance-violation': 4,
  'domain-boundary-violation': 5,
  'layer-boundary-violation': 6,
  'ownership-gap': 7,
  'node-name-convention-violation': 8,
  'tag-convention-violation': 9,
  'missing-domain-violation': 10,
  'missing-layer-violation': 11,
};

const TOP_ISSUE_SEVERITY_ORDER: Record<GovernanceSignalSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

interface TopIssueGroup {
  issue: GovernanceTopIssue;
}

export function buildGovernanceAssessment(
  input: GovernanceAssessmentInput,
): GovernanceAssessment {
  const filteredViolations = filterViolationsForReportType(
    input.violations,
    input.reportType,
  );
  const filteredSignals = filterSignalsForReportType(
    input.signals,
    input.reportType,
  );
  const filteredMeasurements = filterMeasurementsForReportType(
    input.measurements,
    input.reportType,
  );

  return {
    workspace: input.workspace,
    profile: input.profile,
    warnings: [...(input.warnings ?? [])],
    exceptions: input.exceptions,
    violations: filteredViolations,
    ...(input.findings ? { findings: [...input.findings] } : {}),
    signals: filteredSignals,
    measurements: filteredMeasurements,
    ...(input.scores ? { scores: [...input.scores] } : {}),
    ...(input.scope ? { scope: input.scope } : {}),
    ...(input.perspectives ? { perspectives: [...input.perspectives] } : {}),
    signalBreakdown: buildSignalBreakdown(filteredSignals),
    metricBreakdown: buildMetricBreakdown(filteredMeasurements),
    topIssues: buildTopIssues(filteredSignals),
    health: input.health,
    recommendations: [...(input.recommendations ?? [])],
    ...(input.metadata ? { metadata: { ...input.metadata } } : {}),
  };
}

export function filterViolationsForReportType(
  violations: Violation[],
  reportType: GovernanceAssessmentReportType | undefined,
): Violation[] {
  if (reportType === 'boundaries') {
    return violations.filter((violation) => violation.category === 'boundary');
  }

  if (reportType === 'ownership') {
    return violations.filter((violation) => violation.category === 'ownership');
  }

  if (reportType === 'architecture') {
    return violations.filter((violation) => violation.category !== 'ownership');
  }

  return violations;
}

export function filterMeasurementsForReportType(
  measurements: Measurement[],
  reportType: GovernanceAssessmentReportType | undefined,
): Measurement[] {
  if (reportType === 'boundaries') {
    return measurements.filter(
      (measurement) => measurement.family === 'boundaries',
    );
  }

  if (reportType === 'ownership') {
    return measurements.filter(
      (measurement) => measurement.family === 'ownership',
    );
  }

  if (reportType === 'architecture') {
    return measurements.filter(
      (measurement) =>
        measurement.family !== 'ownership' &&
        measurement.family !== 'documentation',
    );
  }

  return measurements;
}

export function filterSignalsForReportType(
  signals: GovernanceSignal[],
  reportType: GovernanceAssessmentReportType | undefined,
): GovernanceSignal[] {
  if (reportType === 'boundaries') {
    return signals.filter((signal) => signal.category === 'boundary');
  }

  if (reportType === 'ownership') {
    return signals.filter((signal) => signal.category === 'ownership');
  }

  if (reportType === 'architecture') {
    return signals.filter((signal) => signal.category !== 'ownership');
  }

  return signals;
}

export function buildSignalBreakdown(
  signals: GovernanceSignal[],
): SignalBreakdown {
  const sourceCounts = new Map<string, number>();
  const typeCounts = new Map<GovernanceSignalType, number>();
  const severityCounts = new Map<GovernanceSignalSeverity, number>();

  for (const signal of signals) {
    sourceCounts.set(signal.source, (sourceCounts.get(signal.source) ?? 0) + 1);
    typeCounts.set(signal.type, (typeCounts.get(signal.type) ?? 0) + 1);
    severityCounts.set(
      signal.severity,
      (severityCounts.get(signal.severity) ?? 0) + 1,
    );
  }

  return {
    total: signals.length,
    bySource: [
      ...SIGNAL_SOURCE_ORDER.map((source) => ({
        source,
        count: sourceCounts.get(source) ?? 0,
      })),
      ...sortKnownThenAlphabetical<GovernanceSignalSource>(
        [...sourceCounts.keys()] as GovernanceSignalSource[],
        SIGNAL_SOURCE_ORDER,
      )
        .filter((source) => !SIGNAL_SOURCE_ORDER.includes(source))
        .map((source) => ({
          source,
          count: sourceCounts.get(source) ?? 0,
        })),
    ],
    byType: sortKnownThenAlphabetical(
      [...typeCounts.keys()],
      SIGNAL_TYPE_ORDER,
    ).flatMap((type) => {
      const count = typeCounts.get(type) ?? 0;

      return count > 0 ? [{ type, count }] : [];
    }),
    bySeverity: SIGNAL_SEVERITY_ORDER.map((severity) => ({
      severity,
      count: severityCounts.get(severity) ?? 0,
    })),
  };
}

export function buildMetricBreakdown(
  measurements: Measurement[],
): MetricBreakdown {
  const measurementsByFamily = new Map<GovernanceMetricFamily, Measurement[]>();

  for (const measurement of measurements) {
    const existing = measurementsByFamily.get(measurement.family) ?? [];
    existing.push(measurement);
    measurementsByFamily.set(measurement.family, existing);
  }

  const orderedFamilies = sortKnownThenAlphabetical(
    [...measurementsByFamily.keys()],
    METRIC_FAMILY_ORDER,
  );

  return {
    families: orderedFamilies.flatMap((family) => {
      const familyMeasurements = (measurementsByFamily.get(family) ?? [])
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((measurement) => ({
          id: measurement.id,
          name: measurement.name,
          score: measurement.score,
        }));

      if (familyMeasurements.length === 0) {
        return [];
      }

      const averageScore =
        familyMeasurements.reduce(
          (sum, measurement) => sum + measurement.score,
          0,
        ) / familyMeasurements.length;

      return [
        {
          family,
          score: Math.round(averageScore),
          measurements: familyMeasurements,
        },
      ];
    }),
  };
}

export function buildTopIssues(
  signals: GovernanceSignal[],
): GovernanceTopIssue[] {
  const groups = new Map<string, TopIssueGroup>();

  for (const signal of signals) {
    const key = buildGroupKey(signal);
    const existing = groups.get(key);

    if (existing) {
      existing.issue.count += 1;
      existing.issue.subjects = mergeSubjects(existing.issue.subjects, signal);
      if (!existing.issue.ruleId) {
        existing.issue.ruleId = readRuleId(signal);
      }
      if (!existing.issue.sourcePluginId) {
        existing.issue.sourcePluginId = signal.sourcePluginId;
      }
      continue;
    }

    groups.set(key, {
      issue: {
        type: signal.type,
        source: signal.source,
        severity: signal.severity,
        count: 1,
        subjects: subjectsFromSignal(signal),
        ruleId: readRuleId(signal),
        message: signal.message,
        sourcePluginId: signal.sourcePluginId,
      },
    });
  }

  return [...groups.values()]
    .map((group) => group.issue)
    .sort(compareTopIssues);
}

function buildGroupKey(signal: GovernanceSignal): string {
  return [
    signal.type,
    signal.source,
    signal.severity,
    signal.nodeId ?? '',
    signal.relationId ?? '',
    (signal.relatedNodeIds ?? []).join(','),
    (signal.relatedRelationIds ?? []).join(','),
  ].join('|');
}

function subjectsFromSignal(signal: GovernanceSignal): string[] {
  return [
    ...new Set(
      [
        signal.nodeId,
        signal.relationId,
        ...(signal.relatedNodeIds ?? []),
        ...(signal.relatedRelationIds ?? []),
      ].filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function mergeSubjects(
  existingSubjects: string[],
  signal: GovernanceSignal,
): string[] {
  return [
    ...new Set([...existingSubjects, ...subjectsFromSignal(signal)]),
  ].sort((a, b) => a.localeCompare(b));
}

function readRuleId(signal: GovernanceSignal): string | undefined {
  const ruleId = signal.metadata?.ruleId;
  return typeof ruleId === 'string' && ruleId.length > 0 ? ruleId : undefined;
}

function compareTopIssues(
  a: GovernanceTopIssue,
  b: GovernanceTopIssue,
): number {
  const severityOrder =
    TOP_ISSUE_SEVERITY_ORDER[a.severity] - TOP_ISSUE_SEVERITY_ORDER[b.severity];
  if (severityOrder !== 0) {
    return severityOrder;
  }

  const countOrder = b.count - a.count;
  if (countOrder !== 0) {
    return countOrder;
  }

  const knownTypeOrderA =
    TOP_ISSUE_TYPE_ORDER[a.type as KnownGovernanceSignalType];
  const knownTypeOrderB =
    TOP_ISSUE_TYPE_ORDER[b.type as KnownGovernanceSignalType];
  const typeOrder = knownTypeOrderA - knownTypeOrderB;
  if (
    knownTypeOrderA !== undefined &&
    knownTypeOrderB !== undefined &&
    typeOrder !== 0
  ) {
    return typeOrder;
  }

  if (!(a.type in TOP_ISSUE_TYPE_ORDER) || !(b.type in TOP_ISSUE_TYPE_ORDER)) {
    const dynamicTypeOrder = a.type.localeCompare(b.type);
    if (dynamicTypeOrder !== 0) {
      return dynamicTypeOrder;
    }
  }

  const sourceOrder =
    TOP_ISSUE_SOURCE_ORDER[a.source] - TOP_ISSUE_SOURCE_ORDER[b.source];
  if (sourceOrder !== 0) {
    return sourceOrder;
  }

  const subjectsOrder = a.subjects
    .join(',')
    .localeCompare(b.subjects.join(','));
  if (subjectsOrder !== 0) {
    return subjectsOrder;
  }

  return a.message.localeCompare(b.message);
}

function sortKnownThenAlphabetical<T extends string>(
  values: T[],
  knownOrder: readonly T[],
): T[] {
  const seen = new Set(values);
  const orderedKnown = knownOrder.filter((value) => seen.has(value));
  const orderedExtras = values
    .filter((value) => !knownOrder.includes(value))
    .sort((a, b) => a.localeCompare(b));

  return [...orderedKnown, ...orderedExtras];
}
