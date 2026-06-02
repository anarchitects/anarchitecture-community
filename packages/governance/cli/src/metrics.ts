import type {
  GovernanceAssessment,
  MetricBreakdown,
  Measurement,
} from '@anarchitects/governance-core';

import type { AgovAssessOptions } from './check.js';
import { runAgovAssess } from './check.js';
import { loadStandaloneGovernanceProfile } from './internal/profile/load-standalone-profile.js';

export interface AgovMetricsFilters {
  family?: string;
  metric?: string;
  weakest?: number;
}

export interface AgovMetricsScope {
  mode: 'filtered';
  filters: AgovMetricsFilters;
}

export interface AgovMetricsResult {
  command: 'metrics';
  workspace: {
    id: string;
    name: string;
    root: string;
  };
  profile: string;
  scope?: AgovMetricsScope;
  health: GovernanceAssessment['health'] & {
    thresholds?: {
      goodMinScore: number;
      warningMinScore: number;
    };
  };
  measurements: Measurement[];
  metricBreakdown: MetricBreakdown;
  summary?: {
    healthScore: number;
    healthGrade: GovernanceAssessment['health']['grade'];
    healthStatus: GovernanceAssessment['health']['status'];
    measurementCount: number;
    weakestMetrics: Array<{
      id: string;
      name: string;
      score: number;
    }>;
    metricFamilyCount: number;
  };
}

export type AgovMetricsOptions<TInput = unknown> = AgovAssessOptions<TInput> & {
  filters?: AgovMetricsFilters;
};

export async function runAgovMetrics<TInput = unknown>(
  options: AgovMetricsOptions<TInput>,
): Promise<AgovMetricsResult> {
  const assessResult = await runAgovAssess(options);
  const profile = loadStandaloneGovernanceProfile(options.profilePath).profile;
  const filteredMeasurements = applyMeasurementFilters(
    assessResult.assessment.measurements,
    options.filters,
  );
  const weakestMetrics = collectWeakestMetrics(
    filteredMeasurements,
    options.filters?.weakest,
  );
  const metricFamilyCount = new Set(
    assessResult.assessment.metricBreakdown.families.map(
      (family) => family.family,
    ),
  ).size;

  return {
    command: 'metrics',
    workspace: {
      id: assessResult.assessment.workspace.id,
      name: assessResult.assessment.workspace.name,
      root: assessResult.assessment.workspace.root,
    },
    profile: assessResult.assessment.profile,
    ...(hasMetricsFilters(options.filters)
      ? { scope: { mode: 'filtered', filters: options.filters } }
      : {}),
    health: {
      ...assessResult.assessment.health,
      thresholds: {
        goodMinScore: profile.health.statusThresholds.goodMinScore,
        warningMinScore: profile.health.statusThresholds.warningMinScore,
      },
    },
    measurements: filteredMeasurements,
    metricBreakdown: assessResult.assessment.metricBreakdown,
    summary: {
      healthScore: assessResult.assessment.health.score,
      healthGrade: assessResult.assessment.health.grade,
      healthStatus: assessResult.assessment.health.status,
      measurementCount: filteredMeasurements.length,
      weakestMetrics,
      metricFamilyCount,
    },
  };
}

function hasMetricsFilters(
  filters: AgovMetricsFilters | undefined,
): filters is AgovMetricsFilters {
  return Boolean(filters?.family || filters?.metric || filters?.weakest);
}

function applyMeasurementFilters(
  measurements: Measurement[],
  filters: AgovMetricsFilters | undefined,
): Measurement[] {
  let filtered = [...measurements];

  if (filters?.family) {
    filtered = filtered.filter(
      (measurement) => measurement.family === filters.family,
    );
  }

  if (filters?.metric) {
    filtered = filtered.filter(
      (measurement) =>
        measurement.id === filters.metric ||
        measurement.name === filters.metric,
    );
  }

  return filtered.sort(compareMeasurements);
}

function collectWeakestMetrics(
  measurements: Measurement[],
  weakestLimit: number | undefined,
): Array<{
  id: string;
  name: string;
  score: number;
}> {
  const sorted = [...measurements].sort((left, right) => {
    const byScore = left.score - right.score;
    if (byScore !== 0) {
      return byScore;
    }

    return compareMeasurements(left, right);
  });

  const safeLimit =
    typeof weakestLimit === 'number' && Number.isFinite(weakestLimit)
      ? Math.max(0, weakestLimit)
      : sorted.length;

  return sorted.slice(0, safeLimit).map((measurement) => ({
    id: measurement.id,
    name: measurement.name,
    score: measurement.score,
  }));
}

function compareMeasurements(left: Measurement, right: Measurement): number {
  const byId = left.id.localeCompare(right.id);
  if (byId !== 0) {
    return byId;
  }

  const byName = left.name.localeCompare(right.name);
  if (byName !== 0) {
    return byName;
  }

  return left.family.localeCompare(right.family);
}
