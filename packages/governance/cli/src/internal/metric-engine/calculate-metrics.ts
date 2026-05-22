import type {
  GovernanceSignal,
  GovernanceWorkspace,
  Measurement,
} from '@anarchitects/governance-core';
import {
  aggregateSignals,
  isEntropyPenaltyAggregate,
  sumSignalAggregateCounts,
  sumSignalAggregateWeights,
} from './aggregate-signals.js';

export interface MetricEngineInput {
  workspace: GovernanceWorkspace;
  signals: GovernanceSignal[];
}

export function calculateMetrics(input: MetricEngineInput): Measurement[] {
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
