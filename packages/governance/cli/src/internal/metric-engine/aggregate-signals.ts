import {
  type GovernanceSignal,
  type GovernanceSignalSeverity,
  type GovernanceSignalSource,
  type GovernanceSignalType,
} from '@anarchitects/governance-core';

export interface SignalAggregate {
  key: string;
  source: GovernanceSignalSource;
  type: GovernanceSignalType;
  severity: GovernanceSignalSeverity;
  sourceProjectId?: string;
  targetProjectId?: string;
  relatedProjectIds: string[];
  count: number;
  unitWeight: number;
  totalWeight: number;
}

const SOURCE_SORT_ORDER: Record<GovernanceSignalSource, number> = {
  graph: 0,
  conformance: 1,
  policy: 2,
  extension: 3,
};

const SEVERITY_SORT_ORDER: Record<GovernanceSignalSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

const SIGNAL_SEVERITY_WEIGHTS: Record<GovernanceSignalSeverity, number> = {
  info: 0.25,
  warning: 0.6,
  error: 1.0,
};

const SIGNAL_TYPE_WEIGHTS: Record<GovernanceSignalType, number> = {
  'structural-dependency': 1.0,
  'cross-domain-dependency': 0.7,
  'missing-domain-context': 0.85,
  'circular-dependency': 1.0,
  'conformance-violation': 1.0,
  'domain-boundary-violation': 1.0,
  'layer-boundary-violation': 0.75,
  'ownership-gap': 0.5,
};

export function aggregateSignals(
  signals: GovernanceSignal[],
): SignalAggregate[] {
  const groupedSignals = new Map<string, SignalAggregate>();

  for (const signal of signals) {
    const key = signalAggregateKey(signal);
    const existing = groupedSignals.get(key);
    const unitWeight = signalWeight(signal);

    if (existing) {
      existing.count += 1;
      existing.totalWeight = roundWeight(existing.count * existing.unitWeight);
      continue;
    }

    groupedSignals.set(key, {
      key,
      source: signal.source,
      type: signal.type,
      severity: signal.severity,
      sourceProjectId: signal.sourceProjectId,
      targetProjectId: signal.targetProjectId,
      relatedProjectIds: [...signal.relatedProjectIds],
      count: 1,
      unitWeight,
      totalWeight: roundWeight(unitWeight),
    });
  }

  return [...groupedSignals.values()].sort(compareSignalAggregates);
}

export function sumSignalAggregateCounts(
  aggregates: SignalAggregate[],
  predicate: (aggregate: SignalAggregate) => boolean,
): number {
  return aggregates
    .filter(predicate)
    .reduce((total, aggregate) => total + aggregate.count, 0);
}

export function sumSignalAggregateWeights(
  aggregates: SignalAggregate[],
  predicate: (aggregate: SignalAggregate) => boolean,
): number {
  const weightedTotal = aggregates
    .filter(predicate)
    .reduce((total, aggregate) => total + aggregate.totalWeight, 0);

  return roundWeight(weightedTotal);
}

export function isEntropyPenaltyAggregate(aggregate: SignalAggregate): boolean {
  return aggregate.type !== 'structural-dependency';
}

function signalAggregateKey(signal: GovernanceSignal): string {
  return [
    signal.source,
    signal.type,
    signal.severity,
    signal.sourceProjectId ?? '',
    signal.targetProjectId ?? '',
    signal.relatedProjectIds.join(','),
  ].join('|');
}

function signalWeight(signal: GovernanceSignal): number {
  return roundWeight(
    SIGNAL_TYPE_WEIGHTS[signal.type] * SIGNAL_SEVERITY_WEIGHTS[signal.severity],
  );
}

function compareSignalAggregates(
  a: SignalAggregate,
  b: SignalAggregate,
): number {
  const sourceOrder = SOURCE_SORT_ORDER[a.source] - SOURCE_SORT_ORDER[b.source];
  if (sourceOrder !== 0) {
    return sourceOrder;
  }

  const typeOrder = a.type.localeCompare(b.type);
  if (typeOrder !== 0) {
    return typeOrder;
  }

  const severityOrder =
    SEVERITY_SORT_ORDER[a.severity] - SEVERITY_SORT_ORDER[b.severity];
  if (severityOrder !== 0) {
    return severityOrder;
  }

  const sourceProjectOrder = (a.sourceProjectId ?? '').localeCompare(
    b.sourceProjectId ?? '',
  );
  if (sourceProjectOrder !== 0) {
    return sourceProjectOrder;
  }

  const targetProjectOrder = (a.targetProjectId ?? '').localeCompare(
    b.targetProjectId ?? '',
  );
  if (targetProjectOrder !== 0) {
    return targetProjectOrder;
  }

  return a.relatedProjectIds
    .join(',')
    .localeCompare(b.relatedProjectIds.join(','));
}

function roundWeight(value: number): number {
  return Number(value.toFixed(4));
}
