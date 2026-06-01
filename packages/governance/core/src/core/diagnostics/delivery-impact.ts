import type {
  GovernanceAssessment,
  GovernanceMetricFamily,
  GovernanceTopIssue,
  Measurement,
  SnapshotComparison,
  Violation,
} from '../model/models.js';

export type GovernanceAudience = 'management' | 'technical-lead' | 'developer';

export type GovernanceInsightCategory =
  | 'cost-of-change'
  | 'time-to-market'
  | 'delivery-risk'
  | 'predictability'
  | 'maintainability'
  | 'ownership'
  | (string & {});

export interface GovernanceInsightDriver {
  id: string;
  label: string;
  value?: number | string;
  score?: number;
  unit?: 'ratio' | 'count' | 'score';
  trend?: 'improving' | 'stable' | 'worsening';
  explanation?: string;
}

export interface GovernanceInsight {
  id: string;
  audience: GovernanceAudience;
  category: GovernanceInsightCategory;
  severity: 'low' | 'medium' | 'high';
  title: string;
  summary: string;
  drivers: GovernanceInsightDriver[];
  relatedMeasurements: string[];
  relatedSignals: string[];
  relatedViolations: string[];
}

export interface DeliveryImpactIndex {
  id: string;
  name: string;
  score: number;
  risk: 'low' | 'medium' | 'high';
  trend?: 'improving' | 'stable' | 'worsening';
  drivers: GovernanceInsightDriver[];
}

export interface DeliveryImpactAssessment {
  generatedAt: string;
  profile: string;
  indices: DeliveryImpactIndex[];
  insights: GovernanceInsight[];
  drivers: GovernanceInsightDriver[];
}

export interface BuildDeliveryImpactAssessmentInput {
  assessment: GovernanceAssessment;
  comparison?: SnapshotComparison;
}

const DRIVER_ORDER = [
  'cross-domain-coordination-friction',
  'architectural-erosion-risk',
  'ownership-ambiguity',
  'change-impact-radius-pressure',
  'cost-of-change-pressure',
  'onboarding-friction',
  'delivery-predictability-pressure',
] as const;

export function buildDeliveryImpactAssessment(
  input: BuildDeliveryImpactAssessmentInput,
): DeliveryImpactAssessment {
  const { assessment, comparison } = input;
  const drivers = mapGovernanceDrivers(assessment, comparison);
  const costOfChange = buildCostOfChangeIndex(assessment, comparison, drivers);
  const timeToMarket = buildTimeToMarketRiskIndex(
    assessment,
    comparison,
    drivers,
  );
  const indices = [costOfChange, timeToMarket].sort(
    (left, right) =>
      right.score - left.score || left.id.localeCompare(right.id),
  );

  return {
    generatedAt: new Date().toISOString(),
    profile: assessment.profile,
    indices,
    insights: buildGovernanceInsights(assessment, indices, drivers),
    drivers,
  };
}

export const calculateDeliveryImpact = buildDeliveryImpactAssessment;

export function summarizeDeliveryImpact(
  assessment: DeliveryImpactAssessment,
): string {
  const highestRiskIndex = [...assessment.indices].sort(
    (left, right) =>
      right.score - left.score || left.id.localeCompare(right.id),
  )[0];

  if (!highestRiskIndex) {
    return 'No delivery-impact indices were produced.';
  }

  const topDrivers = assessment.drivers
    .slice(0, 3)
    .map((driver) => driver.label);
  const driverSummary =
    topDrivers.length > 0 ? ` Top drivers: ${topDrivers.join(', ')}.` : '';

  return `${highestRiskIndex.name} is currently ${highestRiskIndex.risk} risk at ${highestRiskIndex.score}/100.${driverSummary}`;
}

function mapGovernanceDrivers(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined,
): GovernanceInsightDriver[] {
  const drivers = [
    buildMeasurementDriver({
      id: 'cross-domain-coordination-friction',
      label: 'Cross-domain coordination friction',
      measurement: findMeasurement(assessment.measurements, 'domain-integrity'),
      issues: assessment.topIssues.filter(isCrossDomainIssue),
      violations: assessment.violations.filter(isCrossDomainViolation),
      familyDelta: findMetricFamilyDelta(comparison, 'boundaries'),
    }),
    buildMeasurementDriver({
      id: 'architectural-erosion-risk',
      label: 'Architectural erosion risk',
      measurement: findMeasurement(assessment.measurements, 'layer-integrity'),
      issues: assessment.topIssues.filter(isLayerIssue),
      violations: assessment.violations.filter(isLayerViolation),
      familyDelta: findMetricFamilyDelta(comparison, 'boundaries'),
    }),
    buildMeasurementDriver({
      id: 'ownership-ambiguity',
      label: 'Ownership ambiguity',
      measurement: findMeasurement(
        assessment.measurements,
        'ownership-coverage',
      ),
      issues: assessment.topIssues.filter(isOwnershipIssue),
      violations: assessment.violations.filter(isOwnershipViolation),
      familyDelta: findMetricFamilyDelta(comparison, 'ownership'),
    }),
    buildMeasurementDriver({
      id: 'change-impact-radius-pressure',
      label: 'Impact radius pressure',
      measurement: findMeasurement(
        assessment.measurements,
        'dependency-complexity',
      ),
      issues: assessment.topIssues.filter(isDependencyIssue),
      violations: [],
      familyDelta: findMetricFamilyDelta(comparison, 'architecture'),
    }),
    buildMeasurementDriver({
      id: 'cost-of-change-pressure',
      label: 'Cost of change pressure',
      measurement: findMeasurement(
        assessment.measurements,
        'architectural-entropy',
      ),
      issues: assessment.topIssues.filter(isDependencyIssue),
      violations: [],
      familyDelta: findMetricFamilyDelta(comparison, 'architecture'),
    }),
    buildMeasurementDriver({
      id: 'onboarding-friction',
      label: 'Onboarding friction',
      measurement: findMeasurement(
        assessment.measurements,
        'documentation-completeness',
      ),
      issues: [],
      violations: [],
      familyDelta: findMetricFamilyDelta(comparison, 'documentation'),
    }),
    buildDeliveryPredictabilityDriver(assessment, comparison),
  ].filter(isPresent);

  return drivers.sort(
    (left, right) =>
      DRIVER_ORDER.indexOf(left.id as (typeof DRIVER_ORDER)[number]) -
      DRIVER_ORDER.indexOf(right.id as (typeof DRIVER_ORDER)[number]),
  );
}

function buildCostOfChangeIndex(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined,
  drivers: GovernanceInsightDriver[],
): DeliveryImpactIndex {
  const score = weightedAverage([
    invertMetricScore(
      findMeasurement(assessment.measurements, 'dependency-complexity'),
    ),
    invertMetricScore(
      findMeasurement(assessment.measurements, 'architectural-entropy'),
    ),
    invertMetricScore(
      findMeasurement(assessment.measurements, 'domain-integrity'),
    ),
    invertMetricScore(
      findMeasurement(assessment.measurements, 'layer-integrity'),
    ),
    invertMetricScore(
      findMeasurement(assessment.measurements, 'ownership-coverage'),
    ),
    invertMetricScore(
      findMeasurement(assessment.measurements, 'documentation-completeness'),
    ),
    comparison?.healthDelta
      ? Math.max(0, -comparison.healthDelta.scoreDelta)
      : undefined,
  ]);

  return {
    id: 'cost-of-change',
    name: 'Cost of Change Index',
    score,
    risk: riskFromScore(score),
    trend: trendFromComparison(comparison?.healthDelta?.scoreDelta),
    drivers: selectDrivers(drivers, [
      'change-impact-radius-pressure',
      'cost-of-change-pressure',
      'architectural-erosion-risk',
      'cross-domain-coordination-friction',
      'ownership-ambiguity',
      'onboarding-friction',
    ]),
  };
}

function buildTimeToMarketRiskIndex(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined,
  drivers: GovernanceInsightDriver[],
): DeliveryImpactIndex {
  const conformancePressure = clampScore(
    assessment.topIssues
      .filter((issue) => issue.type === 'conformance-violation')
      .reduce((sum, issue) => sum + issue.count * 10, 0),
  );
  const score = weightedAverage([
    invertMetricScore(
      findMeasurement(assessment.measurements, 'domain-integrity'),
    ),
    invertMetricScore(
      findMeasurement(assessment.measurements, 'ownership-coverage'),
    ),
    invertMetricScore(
      findMeasurement(assessment.measurements, 'dependency-complexity'),
    ),
    invertMetricScore(
      findMeasurement(assessment.measurements, 'layer-integrity'),
    ),
    invertMetricScore(
      findMeasurement(assessment.measurements, 'documentation-completeness'),
    ),
    100 - assessment.health.score,
    conformancePressure,
    comparison?.healthDelta
      ? Math.max(0, -comparison.healthDelta.scoreDelta)
      : undefined,
  ]);

  return {
    id: 'time-to-market-risk',
    name: 'Time-to-Market Risk Index',
    score,
    risk: riskFromScore(score),
    trend: trendFromComparison(comparison?.healthDelta?.scoreDelta),
    drivers: selectDrivers(drivers, [
      'cross-domain-coordination-friction',
      'ownership-ambiguity',
      'change-impact-radius-pressure',
      'architectural-erosion-risk',
      'onboarding-friction',
      'delivery-predictability-pressure',
    ]),
  };
}

function buildGovernanceInsights(
  assessment: GovernanceAssessment,
  indices: DeliveryImpactIndex[],
  drivers: GovernanceInsightDriver[],
): GovernanceInsight[] {
  const highestIndex = [...indices].sort(
    (left, right) =>
      right.score - left.score || left.id.localeCompare(right.id),
  )[0];
  const topDrivers = drivers.slice(0, 3);

  const insights: GovernanceInsight[] = [];

  for (const index of indices) {
    if (index.risk === 'low') {
      continue;
    }

    insights.push({
      id: index.id,
      audience: 'management',
      category:
        index.id === 'cost-of-change' ? 'cost-of-change' : 'time-to-market',
      severity: index.risk,
      title: index.name,
      summary: `${index.name} is ${index.score}/100 with ${index.risk} risk.`,
      drivers: index.drivers.slice(0, 3),
      relatedMeasurements: index.drivers.map((driver) => driver.id),
      relatedSignals: assessment.topIssues
        .slice(0, 5)
        .map((issue) => issue.type),
      relatedViolations: assessment.violations
        .slice(0, 5)
        .map((violation) => violation.ruleId),
    });
  }

  if (highestIndex || topDrivers.length > 0) {
    insights.push({
      id: 'architecture-investment-drivers',
      audience: 'technical-lead',
      category: 'delivery-risk',
      severity: highestIndex?.risk ?? 'low',
      title: 'Architecture Investment Drivers',
      summary:
        topDrivers.length > 0
          ? `Top delivery-impact drivers are ${topDrivers
              .map((driver) => driver.label)
              .join(', ')}.`
          : 'No dominant delivery-impact drivers were detected.',
      drivers: topDrivers,
      relatedMeasurements: assessment.measurements
        .slice(0, 6)
        .map((measurement) => measurement.id),
      relatedSignals: assessment.topIssues
        .slice(0, 6)
        .map((issue) => issue.type),
      relatedViolations: assessment.violations
        .slice(0, 6)
        .map((violation) => violation.ruleId),
    });
  }

  return insights.sort((left, right) => left.id.localeCompare(right.id));
}

function buildMeasurementDriver(input: {
  id: string;
  label: string;
  measurement: Measurement | undefined;
  issues: GovernanceTopIssue[];
  violations: Violation[];
  familyDelta?: number;
}): GovernanceInsightDriver | undefined {
  const measurementPressure = input.measurement
    ? 100 - input.measurement.score
    : undefined;
  const issueCount = input.issues.reduce((sum, issue) => sum + issue.count, 0);
  const violationCount = input.violations.length;
  const score = clampScore(
    Math.max(measurementPressure ?? 0, issueCount * 15, violationCount * 20),
  );

  if (score <= 0) {
    return undefined;
  }

  return {
    id: input.id,
    label: input.label,
    score,
    unit: 'score',
    trend: trendFromComparison(input.familyDelta),
    explanation: input.measurement
      ? `${input.measurement.name} is ${input.measurement.score}/100 with ${issueCount} top issue(s) and ${violationCount} violation(s).`
      : `${issueCount} top issue(s) and ${violationCount} violation(s) contribute to this driver.`,
  };
}

function buildDeliveryPredictabilityDriver(
  assessment: GovernanceAssessment,
  comparison: SnapshotComparison | undefined,
): GovernanceInsightDriver {
  return {
    id: 'delivery-predictability-pressure',
    label: 'Delivery predictability pressure',
    score: clampScore(100 - assessment.health.score),
    unit: 'score',
    trend: trendFromComparison(comparison?.healthDelta?.scoreDelta),
    explanation: `Workspace health is ${assessment.health.score}/100 (${assessment.health.status}).`,
  };
}

function selectDrivers(
  drivers: GovernanceInsightDriver[],
  ids: string[],
): GovernanceInsightDriver[] {
  const idSet = new Set(ids);
  return drivers.filter((driver) => idSet.has(driver.id));
}

function findMeasurement(
  measurements: Measurement[],
  id: string,
): Measurement | undefined {
  return measurements.find((measurement) => measurement.id === id);
}

function findMetricFamilyDelta(
  comparison: SnapshotComparison | undefined,
  family: GovernanceMetricFamily,
): number | undefined {
  return comparison?.metricFamilyDeltas?.find(
    (delta) => delta.family === family,
  )?.delta;
}

function invertMetricScore(
  measurement: Measurement | undefined,
): number | undefined {
  return measurement ? 100 - measurement.score : undefined;
}

function weightedAverage(values: Array<number | undefined>): number {
  const present = values.filter(
    (value): value is number => value !== undefined,
  );
  if (present.length === 0) {
    return 0;
  }

  return clampScore(
    Math.round(present.reduce((sum, value) => sum + value, 0) / present.length),
  );
}

function trendFromComparison(
  delta: number | undefined,
): GovernanceInsightDriver['trend'] {
  if (delta === undefined || delta === 0) {
    return 'stable';
  }

  return delta > 0 ? 'improving' : 'worsening';
}

function riskFromScore(score: number): DeliveryImpactIndex['risk'] {
  if (score >= 70) {
    return 'high';
  }
  if (score >= 40) {
    return 'medium';
  }
  return 'low';
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isCrossDomainIssue(issue: GovernanceTopIssue): boolean {
  return issue.type === 'cross-domain-dependency';
}

function isLayerIssue(issue: GovernanceTopIssue): boolean {
  return issue.type === 'layer-boundary-violation';
}

function isOwnershipIssue(issue: GovernanceTopIssue): boolean {
  return issue.type === 'ownership-gap';
}

function isDependencyIssue(issue: GovernanceTopIssue): boolean {
  return (
    issue.type === 'structural-dependency' ||
    issue.type === 'circular-dependency'
  );
}

function isCrossDomainViolation(violation: Violation): boolean {
  return violation.ruleId === 'domain-boundary';
}

function isLayerViolation(violation: Violation): boolean {
  return violation.ruleId === 'layer-boundary';
}

function isOwnershipViolation(violation: Violation): boolean {
  return violation.ruleId === 'ownership-presence';
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}
