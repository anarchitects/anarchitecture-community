import type {
  GovernanceNode,
  GovernanceRelation,
  GovernanceWorkspace,
  Measurement,
} from '../model/models.js';
import type { GovernanceProfile } from './profile.js';
import type { GovernanceSignal } from './signals.js';
import {
  isGovernanceNodeDocumented,
  resolveDocumentationPresenceOptions,
} from './documentation.js';

interface SignalAggregate {
  type: GovernanceSignal['type'];
  count: number;
  weight: number;
}

export interface CalculateGovernanceMetricsInput {
  workspace: GovernanceWorkspace;
  signals: GovernanceSignal[];
  profile?: GovernanceProfile;
}

export function calculateGovernanceMetrics(
  input: CalculateGovernanceMetricsInput,
): Measurement[] {
  const { workspace, signals } = input;
  const documentationPresenceOptions = resolveDocumentationPresenceOptions(
    input.profile,
  );
  const nodes = getApplicableNodes(workspace);
  const dependencyRelations = getDependencyRelations(workspace);
  const nodeCount = nodes.length || 1;
  const dependencyRelationCount = dependencyRelations.length;
  const signalAggregates = aggregateSignals(signals);
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
  const ownedNodes = nodes.filter(hasNodeOwnership).length;
  const documentedNodes = nodes.filter((node) =>
    isGovernanceNodeDocumented(node, documentationPresenceOptions),
  ).length;

  return [
    makeScore(
      'architectural-entropy',
      'Architectural Entropy',
      'architecture',
      entropyPenaltyWeight / Math.max(dependencyRelationCount, 1),
      false,
      {
        nodeCount,
        dependencyRelationCount,
        crossDomainPenaltyWeight: Number(entropyPenaltyWeight.toFixed(4)),
      },
    ),
    makeScore(
      'dependency-complexity',
      'Dependency Complexity',
      'architecture',
      dependencyRelationCount / nodeCount / 4,
      false,
      {
        nodeCount,
        dependencyRelationCount,
      },
    ),
    makeScore(
      'domain-integrity',
      'Domain Integrity',
      'boundaries',
      domainViolationWeight / Math.max(dependencyRelationCount, 1),
      false,
      {
        dependencyRelationCount,
        violatingRelationWeight: Number(domainViolationWeight.toFixed(4)),
      },
    ),
    makeScore(
      'ownership-coverage',
      'Ownership Coverage',
      'ownership',
      ownedNodes / nodeCount,
      true,
      {
        nodeCount,
        ownedNodeCount: ownedNodes,
      },
    ),
    makeScore(
      'documentation-completeness',
      'Documentation Completeness',
      'documentation',
      documentedNodes / nodeCount,
      true,
      {
        nodeCount,
        documentedNodeCount: documentedNodes,
      },
    ),
    makeScore(
      'layer-integrity',
      'Layer Integrity',
      'boundaries',
      layerViolationWeight / Math.max(dependencyRelationCount, 1),
      false,
      {
        dependencyRelationCount,
        violatingRelationWeight: Number(layerViolationWeight.toFixed(4)),
      },
    ),
  ];
}

export const calculateMetrics = calculateGovernanceMetrics;

function getApplicableNodes(workspace: GovernanceWorkspace): GovernanceNode[] {
  return [...workspace.nodes].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function getDependencyRelations(
  workspace: GovernanceWorkspace,
): GovernanceRelation[] {
  return [...workspace.relations]
    .filter((relation) => relation.kind === 'dependency')
    .sort(
      (left, right) =>
        left.id.localeCompare(right.id) ||
        left.sourceNodeId.localeCompare(right.sourceNodeId) ||
        left.targetNodeId.localeCompare(right.targetNodeId),
    );
}

function hasNodeOwnership(node: GovernanceNode): boolean {
  return Boolean(
    node.ownership?.team ||
      (node.ownership?.contacts?.length ?? 0) > 0 ||
      (node.ownership?.stewards?.length ?? 0) > 0 ||
      node.ownership?.productOwner ||
      node.ownership?.technicalOwner ||
      node.ownership?.businessOwner,
  );
}

function makeScore(
  id: string,
  name: string,
  family: Measurement['family'],
  ratio: number,
  ratioIsPositive = false,
  metadata: Record<string, unknown> = {},
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
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
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
