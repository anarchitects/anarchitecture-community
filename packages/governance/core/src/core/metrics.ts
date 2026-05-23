import type { Measurement, GovernanceWorkspace } from './models.js';
import type { GovernanceSignal } from './signals.js';

interface SignalAggregate {
  type: GovernanceSignal['type'];
  count: number;
  weight: number;
}

export interface CalculateGovernanceMetricsInput {
  workspace: GovernanceWorkspace;
  signals: GovernanceSignal[];
}

export function calculateGovernanceMetrics(
  input: CalculateGovernanceMetricsInput,
): Measurement[] {
  const { workspace, signals } = input;
  const dependencyCount = workspace.dependencies.length;
  const projectCount = workspace.projects.length || 1;
  const signalAggregates = aggregateSignals(signals);
  const structuralDependencyCount = sumSignalAggregateCounts(
    signalAggregates,
    (aggregate) => aggregate.type === 'structural-dependency',
  );
  const canonicalDependencyCount =
    structuralDependencyCount > 0 ? structuralDependencyCount : dependencyCount;
  const entropyPenaltyWeight = sumSignalAggregateWeights(
    signalAggregates,
    isEntropyPenaltyAggregate,
  );
  const layerViolationWeight = sumSignalAggregateWeights(
    signalAggregates,
    (aggregate) => aggregate.type === 'layer-boundary-violation',
  );
  const domainViolationWeight = sumSignalAggregateWeights(
    signalAggregates,
    (aggregate) => aggregate.type === 'domain-boundary-violation',
  );
  const ownedProjects = workspace.projects.filter(
    (project) =>
      Boolean(project.ownership?.team) ||
      (project.ownership?.contacts?.length ?? 0) > 0,
  ).length;

  const documentedProjects = workspace.projects.filter((project) => {
    const doc = project.metadata.documentation;
    return doc === true || doc === 'true';
  }).length;

  return [
    makeScore(
      'architectural-entropy',
      'Architectural Entropy',
      'architecture',
      entropyPenaltyWeight / Math.max(canonicalDependencyCount, 1),
    ),
    makeScore(
      'dependency-complexity',
      'Dependency Complexity',
      'architecture',
      canonicalDependencyCount / projectCount / 4,
    ),
    makeScore(
      'domain-integrity',
      'Domain Integrity',
      'boundaries',
      domainViolationWeight / Math.max(canonicalDependencyCount, 1),
    ),
    makeScore(
      'ownership-coverage',
      'Ownership Coverage',
      'ownership',
      ownedProjects / projectCount,
      true,
    ),
    makeScore(
      'documentation-completeness',
      'Documentation Completeness',
      'documentation',
      documentedProjects / projectCount,
      true,
    ),
    makeScore(
      'layer-integrity',
      'Layer Integrity',
      'boundaries',
      layerViolationWeight / Math.max(canonicalDependencyCount, 1),
    ),
  ];
}

export const calculateMetrics = calculateGovernanceMetrics;

function makeScore(
  id: string,
  name: string,
  family: Measurement['family'],
  ratio: number,
  ratioIsPositive = false,
): Measurement {
  const bounded = Math.max(0, Math.min(1, ratio));
  const value = Number(bounded.toFixed(4));
  const score = ratioIsPositive
    ? Math.round(value * 100)
    : Math.round((1 - value) * 100);

  return {
    id,
    name,
    family,
    value,
    score,
    maxScore: 100,
    unit: 'ratio',
  };
}

function aggregateSignals(signals: GovernanceSignal[]): SignalAggregate[] {
  const aggregates = new Map<GovernanceSignal['type'], SignalAggregate>();

  for (const signal of signals) {
    const existing = aggregates.get(signal.type) ?? {
      type: signal.type,
      count: 0,
      weight: 0,
    };
    existing.count += 1;
    existing.weight += signalSeverityWeight(signal.severity);
    aggregates.set(signal.type, existing);
  }

  return [...aggregates.values()];
}

function sumSignalAggregateCounts(
  aggregates: SignalAggregate[],
  predicate: (aggregate: SignalAggregate) => boolean,
): number {
  return aggregates
    .filter(predicate)
    .reduce((sum, aggregate) => sum + aggregate.count, 0);
}

function sumSignalAggregateWeights(
  aggregates: SignalAggregate[],
  predicate: (aggregate: SignalAggregate) => boolean,
): number {
  return aggregates
    .filter(predicate)
    .reduce((sum, aggregate) => sum + aggregate.weight, 0);
}

function isEntropyPenaltyAggregate(aggregate: SignalAggregate): boolean {
  return (
    aggregate.type === 'cross-domain-dependency' ||
    aggregate.type === 'missing-domain-context' ||
    aggregate.type === 'circular-dependency'
  );
}

function signalSeverityWeight(severity: GovernanceSignal['severity']): number {
  switch (severity) {
    case 'error':
      return 1;
    case 'warning':
      return 0.6;
    case 'info':
    default:
      return 0.25;
  }
}
