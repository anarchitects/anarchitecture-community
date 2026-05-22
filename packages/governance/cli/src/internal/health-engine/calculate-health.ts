import {
  DEFAULT_HEALTH_STATUS_THRESHOLDS,
  HealthScore,
  HealthMetricHotspot,
  HealthProjectHotspot,
  HealthStatus,
  HealthStatusThresholds,
  Measurement,
  Recommendation,
  GovernanceTopIssue,
  Violation,
} from '@anarchitects/governance-core';

export type MetricWeights = Partial<Record<Measurement['id'], number>>;
export interface HealthExplainabilityInput {
  topIssues?: GovernanceTopIssue[];
  projectHotspotLimit?: number;
}

export function calculateHealthScore(
  measurements: Measurement[],
  metricWeights: MetricWeights = {},
  statusThresholds: Partial<HealthStatusThresholds> = DEFAULT_HEALTH_STATUS_THRESHOLDS,
  explainabilityInput: HealthExplainabilityInput = {},
): HealthScore {
  const score = Math.round(weightedAverage(measurements, metricWeights));
  const resolvedStatusThresholds = resolveStatusThresholds(statusThresholds);
  const metricHotspots = buildMetricHotspots(measurements);
  const weakestMetrics = buildWeakestMetrics(measurements);
  const dominantIssues = buildDominantIssues(
    explainabilityInput.topIssues ?? [],
  );
  const projectHotspots = buildProjectHotspots(
    explainabilityInput.topIssues ?? [],
    explainabilityInput.projectHotspotLimit ?? 5,
  );
  const status = statusForScore(score, resolvedStatusThresholds);

  return {
    score,
    status,
    grade: gradeForScore(score),
    hotspots: metricHotspots.map((measurement) => measurement.name),
    metricHotspots,
    projectHotspots,
    explainability: {
      summary: buildExplainabilitySummary(
        score,
        status,
        weakestMetrics,
        dominantIssues,
      ),
      statusReason: buildStatusReason(score, status, resolvedStatusThresholds),
      weakestMetrics,
      dominantIssues,
    },
  };
}

function weightedAverage(
  measurements: Measurement[],
  metricWeights: MetricWeights,
): number {
  if (measurements.length === 0) {
    return 0;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const measurement of measurements) {
    const configuredWeight = metricWeights[measurement.id] ?? 1;
    const safeWeight = configuredWeight > 0 ? configuredWeight : 0;

    weightedSum += measurement.score * safeWeight;
    totalWeight += safeWeight;
  }

  if (totalWeight === 0) {
    return (
      measurements.reduce((sum, measurement) => sum + measurement.score, 0) /
      measurements.length
    );
  }

  return weightedSum / totalWeight;
}

export function buildRecommendations(
  violations: Violation[],
  measurements: Measurement[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (violations.some((violation) => violation.ruleId === 'domain-boundary')) {
    recommendations.push({
      id: 'reduce-cross-domain-dependencies',
      title: 'Reduce cross-domain dependencies',
      priority: 'high',
      reason:
        'Domain boundary violations indicate tight coupling across business domains.',
    });
  }

  if (
    violations.some((violation) => violation.ruleId === 'ownership-presence')
  ) {
    recommendations.push({
      id: 'improve-ownership-coverage',
      title: 'Improve ownership coverage',
      priority: 'medium',
      reason:
        'Unowned projects slow down incident response and architectural decision making.',
    });
  }

  if (
    (measurements.find(
      (measurement) => measurement.id === 'dependency-complexity',
    )?.score ?? 100) < 60
  ) {
    recommendations.push({
      id: 'reduce-dependency-complexity',
      title: 'Reduce dependency complexity',
      priority: 'medium',
      reason:
        'High dependency complexity increases blast radius and maintenance cost.',
    });
  }

  return recommendations;
}

function gradeForScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function statusForScore(
  score: number,
  thresholds: HealthStatusThresholds,
): HealthStatus {
  if (score >= thresholds.goodMinScore) {
    return 'good';
  }

  if (score >= thresholds.warningMinScore) {
    return 'warning';
  }

  return 'critical';
}

function resolveStatusThresholds(
  thresholds: Partial<HealthStatusThresholds>,
): HealthStatusThresholds {
  const goodMinScore =
    typeof thresholds.goodMinScore === 'number' &&
    Number.isFinite(thresholds.goodMinScore)
      ? thresholds.goodMinScore
      : DEFAULT_HEALTH_STATUS_THRESHOLDS.goodMinScore;
  const warningMinScore =
    typeof thresholds.warningMinScore === 'number' &&
    Number.isFinite(thresholds.warningMinScore)
      ? thresholds.warningMinScore
      : DEFAULT_HEALTH_STATUS_THRESHOLDS.warningMinScore;

  if (goodMinScore <= warningMinScore) {
    return DEFAULT_HEALTH_STATUS_THRESHOLDS;
  }

  return {
    goodMinScore,
    warningMinScore,
  };
}

function buildMetricHotspots(
  measurements: Measurement[],
): HealthMetricHotspot[] {
  return [...measurements]
    .filter((measurement) => measurement.score < 60)
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .map((measurement) => ({
      id: measurement.id,
      name: measurement.name,
      score: measurement.score,
    }));
}

function buildWeakestMetrics(
  measurements: Measurement[],
): HealthMetricHotspot[] {
  return [...measurements]
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((measurement) => ({
      id: measurement.id,
      name: measurement.name,
      score: measurement.score,
    }));
}

function buildDominantIssues(
  topIssues: GovernanceTopIssue[],
): GovernanceTopIssue[] {
  return topIssues.slice(0, 3);
}

function buildProjectHotspots(
  topIssues: GovernanceTopIssue[],
  limit: number,
): HealthProjectHotspot[] {
  const counts = new Map<
    string,
    { count: number; typeCounts: Map<GovernanceTopIssue['type'], number> }
  >();

  for (const issue of topIssues) {
    if (!isHealthDrivingIssue(issue)) {
      continue;
    }

    for (const project of issue.projects) {
      const current = counts.get(project) ?? {
        count: 0,
        typeCounts: new Map<GovernanceTopIssue['type'], number>(),
      };

      current.count += issue.count;
      current.typeCounts.set(
        issue.type,
        (current.typeCounts.get(issue.type) ?? 0) + issue.count,
      );
      counts.set(project, current);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, Math.max(1, limit))
    .map(([project, details]) => ({
      project,
      count: details.count,
      dominantIssueTypes: [...details.typeCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([type]) => type),
    }));
}

function isHealthDrivingIssue(issue: GovernanceTopIssue): boolean {
  return issue.type !== 'structural-dependency';
}

function buildStatusReason(
  score: number,
  status: HealthStatus,
  thresholds: HealthStatusThresholds,
): string {
  if (status === 'good') {
    return `Score ${score} meets the Good threshold (${thresholds.goodMinScore}).`;
  }

  if (status === 'warning') {
    return `Score ${score} is below the Good threshold (${thresholds.goodMinScore}) but meets the Warning threshold (${thresholds.warningMinScore}).`;
  }

  return `Score ${score} is below the Warning threshold (${thresholds.warningMinScore}), so status is Critical.`;
}

function buildExplainabilitySummary(
  score: number,
  status: HealthStatus,
  weakestMetrics: HealthMetricHotspot[],
  dominantIssues: GovernanceTopIssue[],
): string {
  const weakestMetricsSummary =
    weakestMetrics.length > 0
      ? weakestMetrics
          .map((metric) => `${metric.name} (${metric.score})`)
          .join(', ')
      : 'none';
  const dominantIssuesSummary =
    dominantIssues.length > 0
      ? dominantIssues
          .map((issue) => `${issue.type} x${issue.count}`)
          .join(', ')
      : 'none';

  return `Overall health is ${formatHealthStatus(
    status,
  )} at ${score}/100. Weakest metrics: ${weakestMetricsSummary}. Dominant issues: ${dominantIssuesSummary}.`;
}

function formatHealthStatus(status: HealthStatus): string {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}
