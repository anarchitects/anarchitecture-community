import type { Recommendation } from '@anarchitects/governance-core';

import type { AgovAssessOptions } from './check.js';
import { runAgovAssess } from './check.js';

export type AgovRecommendationPriority = Recommendation['priority'];

export interface AgovRecommendationsFilters {
  priority?: AgovRecommendationPriority;
}

export interface AgovRecommendationsSummary {
  total: number;
  byPriority: Array<{ priority: AgovRecommendationPriority; count: number }>;
  highestPriority: AgovRecommendationPriority | 'none';
  groupedByPriority: Array<{
    priority: AgovRecommendationPriority;
    recommendations: Array<{
      id: string;
      title: string;
    }>;
  }>;
}

export interface AgovRecommendationsResult {
  command: 'recommendations';
  workspace: {
    id: string;
    name: string;
    root: string;
  };
  profile: string;
  recommendations: Recommendation[];
  summary: AgovRecommendationsSummary;
}

export type AgovRecommendationsOptions<TInput = unknown> =
  AgovAssessOptions<TInput> & {
    filters?: AgovRecommendationsFilters;
  };

const RECOMMENDATION_PRIORITY_ORDER: ReadonlyArray<AgovRecommendationPriority> =
  ['high', 'medium', 'low'];

export async function runAgovRecommendations<TInput = unknown>(
  options: AgovRecommendationsOptions<TInput>,
): Promise<AgovRecommendationsResult> {
  const assessResult = await runAgovAssess(options);
  const recommendations =
    assessResult.artifacts.recommendations ??
    assessResult.assessment.recommendations;
  const filteredRecommendations = applyRecommendationFilters(
    recommendations,
    options.filters,
  );

  return {
    command: 'recommendations',
    workspace: {
      id: assessResult.assessment.workspace.id,
      name: assessResult.assessment.workspace.name,
      root: assessResult.assessment.workspace.root,
    },
    profile: assessResult.assessment.profile,
    recommendations: filteredRecommendations,
    summary: buildSummary(filteredRecommendations),
  };
}

function applyRecommendationFilters(
  recommendations: Recommendation[],
  filters: AgovRecommendationsFilters | undefined,
): Recommendation[] {
  const filtered = recommendations.filter((recommendation) => {
    if (filters?.priority && recommendation.priority !== filters.priority) {
      return false;
    }

    return true;
  });

  return [...filtered].sort(compareRecommendations);
}

function buildSummary(
  recommendations: Recommendation[],
): AgovRecommendationsSummary {
  const byPriority = RECOMMENDATION_PRIORITY_ORDER.map((priority) => ({
    priority,
    count: recommendations.filter(
      (recommendation) => recommendation.priority === priority,
    ).length,
  }));

  const groupedByPriority = RECOMMENDATION_PRIORITY_ORDER.map((priority) => ({
    priority,
    recommendations: recommendations
      .filter((recommendation) => recommendation.priority === priority)
      .map((recommendation) => ({
        id: recommendation.id,
        title: recommendation.title,
      })),
  }));

  const highestPriority =
    byPriority.find((entry) => entry.count > 0)?.priority ?? 'none';

  return {
    total: recommendations.length,
    byPriority,
    highestPriority,
    groupedByPriority,
  };
}

function compareRecommendations(
  left: Recommendation,
  right: Recommendation,
): number {
  const byPriority = priorityRank(right.priority) - priorityRank(left.priority);
  if (byPriority !== 0) {
    return byPriority;
  }

  const byId = left.id.localeCompare(right.id);
  if (byId !== 0) {
    return byId;
  }

  const byTitle = left.title.localeCompare(right.title);
  if (byTitle !== 0) {
    return byTitle;
  }

  return left.reason.localeCompare(right.reason);
}

function priorityRank(priority: AgovRecommendationPriority): number {
  switch (priority) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}
