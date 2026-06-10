import type { Violation } from '@anarchitects/governance-core';

import type { AgovAssessOptions } from './check.js';
import { runAgovAssess } from './check.js';

export type AgovViolationSeverity = Violation['severity'];

export interface AgovViolationsFilters {
  severity?: AgovViolationSeverity;
  rule?: string;
  category?: string;
  subject?: string;
  sourcePlugin?: string;
}

export interface AgovViolationsSummary {
  total: number;
  bySeverity: Array<{ severity: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  byRule: Array<{ rule: string; count: number }>;
  bySubject: Array<{ subject: string; count: number }>;
  bySourcePlugin: Array<{ sourcePlugin: string; count: number }>;
}

export interface AgovViolationsScope {
  mode: 'filtered';
  filters: AgovViolationsFilters;
}

export interface AgovViolationsResult {
  command: 'violations';
  workspace: {
    id: string;
    name: string;
    root: string;
  };
  profile: string;
  scope?: AgovViolationsScope;
  violations: Violation[];
  summary: AgovViolationsSummary;
}

export type AgovViolationsOptions<TInput = unknown> =
  AgovAssessOptions<TInput> & {
    filters?: AgovViolationsFilters;
  };

export async function runAgovViolations<TInput = unknown>(
  options: AgovViolationsOptions<TInput>,
): Promise<AgovViolationsResult> {
  const assessResult = await runAgovAssess(options);
  const filteredViolations = applyViolationFilters(
    assessResult.artifacts.violations,
    options.filters,
  );

  return {
    command: 'violations',
    workspace: {
      id: assessResult.assessment.workspace.id,
      name: assessResult.assessment.workspace.name,
      root: assessResult.assessment.workspace.root,
    },
    profile: assessResult.assessment.profile,
    ...(hasViolationFilters(options.filters)
      ? { scope: { mode: 'filtered', filters: options.filters } }
      : {}),
    violations: filteredViolations,
    summary: buildSummary(filteredViolations),
  };
}

function hasViolationFilters(
  filters: AgovViolationsFilters | undefined,
): filters is AgovViolationsFilters {
  return Boolean(
    filters?.severity ||
      filters?.rule ||
      filters?.category ||
      filters?.subject ||
      filters?.sourcePlugin,
  );
}

function applyViolationFilters(
  violations: Violation[],
  filters: AgovViolationsFilters | undefined,
): Violation[] {
  const filtered = violations.filter((violation) => {
    if (filters?.severity && violation.severity !== filters.severity) {
      return false;
    }

    if (filters?.rule && violation.ruleId !== filters.rule) {
      return false;
    }

    if (filters?.category && violation.category !== filters.category) {
      return false;
    }

    if (
      filters?.subject &&
      readViolationSubjectKey(violation) !== filters.subject
    ) {
      return false;
    }

    if (filters?.sourcePlugin) {
      if ((violation.sourcePluginId ?? '') !== filters.sourcePlugin) {
        return false;
      }
    }

    return true;
  });

  return [...filtered].sort(compareViolations);
}

function buildSummary(violations: Violation[]): AgovViolationsSummary {
  return {
    total: violations.length,
    bySeverity: countBy(violations, (violation) => violation.severity).map(
      ([severity, count]) => ({ severity, count }),
    ),
    byCategory: countBy(violations, (violation) => violation.category).map(
      ([category, count]) => ({ category, count }),
    ),
    byRule: countBy(violations, (violation) => violation.ruleId).map(
      ([rule, count]) => ({ rule, count }),
    ),
    bySubject: countBy(violations, readViolationSubjectKey).map(
      ([subject, count]) => ({ subject, count }),
    ),
    bySourcePlugin: countBy(
      violations,
      (violation) => violation.sourcePluginId ?? 'none',
    ).map(([sourcePlugin, count]) => ({ sourcePlugin, count })),
  };
}

function countBy<T>(
  values: T[],
  projector: (value: T) => string,
): Array<[string, number]> {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = projector(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) =>
    left[0].localeCompare(right[0]),
  );
}

function compareViolations(left: Violation, right: Violation): number {
  const bySeverity = severityRank(right.severity) - severityRank(left.severity);
  if (bySeverity !== 0) {
    return bySeverity;
  }

  const byRule = left.ruleId.localeCompare(right.ruleId);
  if (byRule !== 0) {
    return byRule;
  }

  const byCategory = left.category.localeCompare(right.category);
  if (byCategory !== 0) {
    return byCategory;
  }

  const bySubject = readViolationSubjectKey(left).localeCompare(
    readViolationSubjectKey(right),
  );
  if (bySubject !== 0) {
    return bySubject;
  }

  const byMessage = left.message.localeCompare(right.message);
  if (byMessage !== 0) {
    return byMessage;
  }

  return (left.sourcePluginId ?? '').localeCompare(right.sourcePluginId ?? '');
}

function severityRank(severity: Violation['severity']): number {
  switch (severity) {
    case 'error':
      return 3;
    case 'warning':
      return 2;
    case 'info':
      return 1;
    default:
      return 0;
  }
}

function readViolationSubjectKey(violation: Violation): string {
  return (
    violation.subjectId ??
    violation.reference?.relationId ??
    violation.reference?.nodeId ??
    'unknown'
  );
}
