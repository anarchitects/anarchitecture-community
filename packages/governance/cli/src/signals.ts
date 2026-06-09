import type {
  GovernanceSignal,
  GovernanceSignalSeverity,
  SignalBreakdown,
} from '@anarchitects/governance-core';

import type { AgovAssessOptions } from './check.js';
import { runAgovAssess } from './check.js';

export type AgovSignalSource = GovernanceSignal['source'];
export type AgovSignalType = GovernanceSignal['type'];
export type AgovSignalSeverity = GovernanceSignalSeverity;

export interface AgovSignalsFilters {
  source?: string;
  type?: string;
  severity?: AgovSignalSeverity;
}

export interface AgovSignalsScope {
  mode: 'filtered';
  filters: AgovSignalsFilters;
}

export interface AgovSignalsSummary {
  total: number;
  bySource: Array<{ source: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
  extensionSignalCount: number;
}

export interface AgovSignalsResult {
  command: 'signals';
  workspace: {
    id: string;
    name: string;
    root: string;
  };
  profile: string;
  scope?: AgovSignalsScope;
  signals: GovernanceSignal[];
  signalBreakdown: SignalBreakdown;
  summary: AgovSignalsSummary;
}

export type AgovSignalsOptions<TInput = unknown> = AgovAssessOptions<TInput> & {
  filters?: AgovSignalsFilters;
};

export async function runAgovSignals<TInput = unknown>(
  options: AgovSignalsOptions<TInput>,
): Promise<AgovSignalsResult> {
  const assessResult = await runAgovAssess(options);
  const filteredSignals = applySignalFilters(
    assessResult.artifacts.signals,
    options.filters,
  );
  const signalBreakdown =
    options.filters && Object.keys(options.filters).length > 0
      ? buildSignalBreakdown(filteredSignals)
      : assessResult.assessment.signalBreakdown;

  return {
    command: 'signals',
    workspace: {
      id: assessResult.assessment.workspace.id,
      name: assessResult.assessment.workspace.name,
      root: assessResult.assessment.workspace.root,
    },
    profile: assessResult.assessment.profile,
    ...(hasSignalFilters(options.filters)
      ? { scope: { mode: 'filtered', filters: options.filters } }
      : {}),
    signals: filteredSignals,
    signalBreakdown,
    summary: buildSummary(filteredSignals),
  };
}

function hasSignalFilters(
  filters: AgovSignalsFilters | undefined,
): filters is AgovSignalsFilters {
  return Boolean(filters?.source || filters?.type || filters?.severity);
}

function applySignalFilters(
  signals: GovernanceSignal[],
  filters: AgovSignalsFilters | undefined,
): GovernanceSignal[] {
  const filtered = signals.filter((signal) => {
    if (filters?.source && signal.source !== filters.source) {
      return false;
    }

    if (filters?.type && signal.type !== filters.type) {
      return false;
    }

    if (filters?.severity && signal.severity !== filters.severity) {
      return false;
    }

    return true;
  });

  return [...filtered].sort(compareSignals);
}

function buildSignalBreakdown(signals: GovernanceSignal[]): SignalBreakdown {
  const bySource = countBy(signals, (signal) => signal.source).map(
    ([source, count]) => ({
      source: source as AgovSignalSource,
      count,
    }),
  );
  const byType = countBy(signals, (signal) => signal.type).map(
    ([type, count]) => ({
      type: type as AgovSignalType,
      count,
    }),
  );
  const bySeverity = countBy(signals, (signal) => signal.severity).map(
    ([severity, count]) => ({
      severity: severity as AgovSignalSeverity,
      count,
    }),
  );

  return {
    total: signals.length,
    bySource,
    byType,
    bySeverity,
  };
}

function buildSummary(signals: GovernanceSignal[]): AgovSignalsSummary {
  return {
    total: signals.length,
    bySource: countBy(signals, (signal) => signal.source).map(
      ([source, count]) => ({ source, count }),
    ),
    byType: countBy(signals, (signal) => signal.type).map(([type, count]) => ({
      type,
      count,
    })),
    bySeverity: countBy(signals, (signal) => signal.severity).map(
      ([severity, count]) => ({ severity, count }),
    ),
    extensionSignalCount: signals.filter(
      (signal) =>
        signal.source === 'extension' || Boolean(signal.sourcePluginId),
    ).length,
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

function compareSignals(
  left: GovernanceSignal,
  right: GovernanceSignal,
): number {
  const bySeverity = severityRank(right.severity) - severityRank(left.severity);
  if (bySeverity !== 0) {
    return bySeverity;
  }

  const bySource = left.source.localeCompare(right.source);
  if (bySource !== 0) {
    return bySource;
  }

  const byType = left.type.localeCompare(right.type);
  if (byType !== 0) {
    return byType;
  }

  const bySourceProject = readSignalSourceProjectId(left).localeCompare(
    readSignalSourceProjectId(right),
  );
  if (bySourceProject !== 0) {
    return bySourceProject;
  }

  const byTargetProject = readSignalTargetProjectId(left).localeCompare(
    readSignalTargetProjectId(right),
  );
  if (byTargetProject !== 0) {
    return byTargetProject;
  }

  const byPlugin = (left.sourcePluginId ?? '').localeCompare(
    right.sourcePluginId ?? '',
  );
  if (byPlugin !== 0) {
    return byPlugin;
  }

  const byMessage = left.message.localeCompare(right.message);
  if (byMessage !== 0) {
    return byMessage;
  }

  return left.id.localeCompare(right.id);
}

function severityRank(severity: GovernanceSignalSeverity): number {
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

function readSignalSourceProjectId(signal: GovernanceSignal): string {
  return signal.nodeId ?? '';
}

function readSignalTargetProjectId(signal: GovernanceSignal): string {
  const sourceNodeId = signal.nodeId;
  return (
    signal.relatedNodeIds?.find((nodeId) => nodeId !== sourceNodeId) ?? ''
  );
}
