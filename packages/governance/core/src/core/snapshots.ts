import type {
  GovernanceAssessment,
  MetricSnapshot,
  SnapshotDeliveryImpactSummary,
  SnapshotViolation,
} from './models.js';
import type { DeliveryImpactAssessment } from './delivery-impact.js';

const SNAPSHOT_DELIVERY_IMPACT_TOP_DRIVERS_LIMIT = 5;

export interface GovernanceSnapshotMetadata {
  timestamp: string;
  repo: string;
  branch: string;
  commitSha: string;
  pluginVersion: string;
  metricSchemaVersion: string;
  deliveryImpact?: SnapshotDeliveryImpactSummary;
}

export function buildMetricSnapshot(
  assessment: GovernanceAssessment,
  metadata: GovernanceSnapshotMetadata,
): MetricSnapshot {
  const metrics = Object.fromEntries(
    assessment.measurements.map((measurement) => [
      measurement.id,
      measurement.value,
    ]),
  );
  const scores = {
    workspaceHealth: assessment.health.score,
    ...Object.fromEntries(
      assessment.measurements.map((measurement) => [
        measurement.id,
        measurement.score,
      ]),
    ),
  };

  const violations: SnapshotViolation[] = assessment.violations.map(
    (violation) => ({
      type: violation.ruleId,
      source: violation.project,
      target: asString(violation.details?.target),
      ruleId: violation.ruleId,
      severity: violation.severity,
      message: violation.message,
    }),
  );

  return {
    ...metadata,
    metrics,
    scores,
    violations,
    health: {
      score: assessment.health.score,
      status: assessment.health.status,
      grade: assessment.health.grade,
    },
    signalBreakdown: assessment.signalBreakdown,
    metricBreakdown: assessment.metricBreakdown,
    topIssues: assessment.topIssues,
    deliveryImpact: metadata.deliveryImpact,
  };
}

export function buildSnapshotDeliveryImpactSummary(
  deliveryImpact: DeliveryImpactAssessment,
): SnapshotDeliveryImpactSummary {
  return {
    indices: [...deliveryImpact.indices]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((index) => ({
        id: index.id,
        score: index.score,
        risk: index.risk,
      })),
    topDrivers: deliveryImpact.drivers
      .slice(0, SNAPSHOT_DELIVERY_IMPACT_TOP_DRIVERS_LIMIT)
      .map((driver) => ({
        id: driver.id,
        label: driver.label,
        value: driver.value,
        score: driver.score,
        unit: driver.unit,
        trend: driver.trend,
      })),
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
