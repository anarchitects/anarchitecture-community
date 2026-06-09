import type {
  AiAnalysisRequest,
  AiAnalysisResult,
  DriftSignal,
  DriftSummary,
  GovernanceNode,
  GovernanceRelation,
  MetricSnapshot,
  SnapshotViolation,
} from '../model/models.js';
import { buildDriftSummary } from '../diagnostics/drift.js';
import {
  compareGovernanceViolationsForPriority,
  sliceGovernancePayloadItems,
} from './ai-payload.js';

export interface GovernancePrImpactContext {
  changedFilesCount: number;
  affectedNodeIds: string[];
  affectedNodeCount: number;
  affectedDomains: string[];
  affectedDomainCount: number;
  scopedRelationCount: number;
  crossDomainRelationEdges: number;
}

export interface FanoutNodeSummary {
  nodeId: string;
  fanout: number;
}

export interface GovernanceCognitiveLoadContext {
  scope: string;
  selectedNodeIds: string[];
  selectedNodeCount: number;
  affectedDomains: string[];
  affectedDomainCount: number;
  scopedRelationCount: number;
  crossDomainRelationEdges: number;
  averageFanout: number;
  maxFanout: number;
  topFanoutNodes: FanoutNodeSummary[];
  nodeId?: string;
  domain?: string;
}

export interface GovernanceRecommendationsTrendContext {
  overallTrend: DriftSignal['status'];
  worseningSignalCount: number;
  improvingSignalCount: number;
  stableSignalCount: number;
  signalCount: number;
  snapshotCount: number;
  trendWindowInsufficient: boolean;
}

export interface GovernancePersistentSmellSignal {
  type: string;
  source: string;
  count: number;
}

export interface HotspotNodeSummary {
  nodeId: string;
  count: number;
}

export interface GovernanceRefactoringSuggestionsContext {
  analyzedViolations: number;
  totalViolations: number;
  hotspotNodes: HotspotNodeSummary[];
  highFanoutNodes: HotspotNodeSummary[];
  hotspotDomains: string[];
  persistentSmellSignals: GovernancePersistentSmellSignal[];
  snapshotCount: number;
  sampledSnapshotCount: number;
}

export interface DomainCountSummary {
  domain: string;
  count: number;
}

export interface LayerCountSummary {
  layer: string;
  count: number;
}

export interface GovernanceOnboardingContext {
  nodeCount: number;
  relationCount: number;
  ownershipCoverage: number;
  domainSummary: DomainCountSummary[];
  layerSummary: LayerCountSummary[];
  topFanoutNodes: HotspotNodeSummary[];
  analyzedViolations: number;
  totalViolations: number;
}

export interface BuildPrImpactContextInput {
  affectedNodeIds: readonly string[] | readonly GovernanceNode[];
  relations: readonly GovernanceRelation[];
  nodes?: readonly GovernanceNode[];
  changedFiles?: readonly string[];
  changedFilesCount?: number;
}

export interface BuildCognitiveLoadContextInput {
  selectedNodeIds: readonly string[] | readonly GovernanceNode[];
  relations: readonly GovernanceRelation[];
  nodes?: readonly GovernanceNode[];
  scope?: string;
  nodeId?: string;
  domain?: string;
  topProjectsLimit?: number;
}

export interface BuildRecommendationsTrendContextInput {
  signals: readonly DriftSignal[];
  summary?: DriftSummary;
  snapshotCount?: number;
}

export interface BuildPersistentSmellSignalsInput {
  recentSnapshots: readonly MetricSnapshot[];
  minimumOccurrences?: number;
}

export interface BuildRefactoringSuggestionsContextInput {
  violations: readonly SnapshotViolation[];
  relations: readonly GovernanceRelation[];
  nodes: readonly GovernanceNode[];
  recentSnapshots?: readonly MetricSnapshot[];
  topProjectsLimit?: number;
  analyzedViolationsLimit?: number;
  minimumPersistentOccurrences?: number;
}

export interface BuildOnboardingContextInput {
  nodes: readonly GovernanceNode[];
  relations: readonly GovernanceRelation[];
  topViolations?: readonly SnapshotViolation[];
  topProjectsLimit?: number;
  totalViolationsCount?: number;
}

export function summarizeDriftInterpretation(
  request: AiAnalysisRequest,
  signals: readonly DriftSignal[],
  summary: DriftSummary,
): AiAnalysisResult {
  const findings = signals.map((signal) => ({
    id: `drift-${signal.id}`,
    title: signal.label,
    detail: `Status is ${signal.status} with delta ${formatSignedDelta(
      signal.delta,
    )} and magnitude ${signal.magnitude.toFixed(3)}.`,
    signals: ['drift-analysis', 'snapshot-comparison'],
    confidence: 1,
  }));

  return {
    kind: 'drift',
    summary: `Deterministic drift interpretation indicates a ${summary.overallTrend} trend (${summary.worseningCount} worsening, ${summary.improvingCount} improving, ${summary.stableCount} stable).`,
    findings,
    recommendations: [
      {
        id: 'drift-review-regressing-signals',
        title: 'Review Regressing Signals First',
        priority: summary.worseningCount > 0 ? 'high' : 'low',
        reason:
          summary.worseningCount > 0
            ? `There are ${summary.worseningCount} worsening drift signals. Prioritize investigation of those signals before broader refactoring.`
            : 'No worsening drift signals were detected in this comparison window.',
      },
      {
        id: 'drift-validate-trend-window',
        title: 'Validate Trend Window Confidence',
        priority: 'medium',
        reason: isTrendWindowInsufficient(request)
          ? 'Fewer than four snapshots were available. Treat conclusions as provisional and continue collecting trend data.'
          : 'Trend window is sufficient for directional interpretation. Continue monitoring for persistence across future snapshots.',
      },
    ],
    metadata: {
      trend: summary.overallTrend,
      worseningCount: summary.worseningCount,
      improvingCount: summary.improvingCount,
      stableCount: summary.stableCount,
      signalCount: signals.length,
      topWorsening: summary.topWorsening,
      topImproving: summary.topImproving,
      ...request.inputs.metadata,
    },
  };
}

export const buildDriftInterpretationAnalysis = summarizeDriftInterpretation;

export function buildPrImpactContext(
  input: BuildPrImpactContextInput,
): GovernancePrImpactContext {
  const selection = resolveNodeSelection(input.affectedNodeIds, input.nodes);
  const scopedRelations = input.relations.filter(
    (relation) =>
      selection.nodeIds.has(relation.sourceNodeId) ||
      selection.nodeIds.has(relation.targetNodeId),
  );
  const affectedDomains = uniqueSortedStrings(
    selection.nodes
      .map(readNodeDomain)
      .filter((domain): domain is string => Boolean(domain)),
  );

  return {
    changedFilesCount:
      input.changedFilesCount ?? input.changedFiles?.length ?? 0,
    affectedNodeIds: [...selection.nodeIds].sort((left, right) =>
      left.localeCompare(right),
    ),
    affectedNodeCount: selection.nodeIds.size,
    affectedDomains,
    affectedDomainCount: affectedDomains.length,
    scopedRelationCount: scopedRelations.length,
    crossDomainRelationEdges: countCrossDomainRelations(
      scopedRelations,
      selection.nodesById,
    ),
  };
}

export function buildCognitiveLoadContext(
  input: BuildCognitiveLoadContextInput,
): GovernanceCognitiveLoadContext {
  const selection = resolveNodeSelection(input.selectedNodeIds, input.nodes);
  const scopedRelations = input.relations.filter(
    (relation) =>
      selection.nodeIds.has(relation.sourceNodeId) ||
      selection.nodeIds.has(relation.targetNodeId),
  );
  const fanoutByProject = new Map<string, number>();

  for (const relation of scopedRelations) {
    if (!selection.nodeIds.has(relation.sourceNodeId)) {
      continue;
    }

    fanoutByProject.set(
      relation.sourceNodeId,
      (fanoutByProject.get(relation.sourceNodeId) ?? 0) + 1,
    );
  }

  const fanoutValues = [...fanoutByProject.values()];
  const averageFanout =
    fanoutValues.length > 0
      ? Number(
          (
            fanoutValues.reduce((sum, value) => sum + value, 0) /
            fanoutValues.length
          ).toFixed(2),
        )
      : 0;
  const maxFanout = fanoutValues.length > 0 ? Math.max(...fanoutValues) : 0;
  const affectedDomains = uniqueSortedStrings(
    selection.nodes
      .map(readNodeDomain)
      .filter((domain): domain is string => Boolean(domain)),
  );
  const topFanoutNodes = [...fanoutByProject.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, Math.max(1, input.topProjectsLimit ?? 10))
    .map(([nodeId, fanout]) => ({ nodeId, fanout }));

  return {
    scope: input.scope ?? 'workspace',
    ...(input.nodeId ? { nodeId: input.nodeId } : {}),
    ...(input.domain ? { domain: input.domain } : {}),
    selectedNodeIds: [...selection.nodeIds].sort((left, right) =>
      left.localeCompare(right),
    ),
    selectedNodeCount: selection.nodeIds.size,
    affectedDomains,
    affectedDomainCount: affectedDomains.length,
    scopedRelationCount: scopedRelations.length,
    crossDomainRelationEdges: countCrossDomainRelations(
      scopedRelations,
      selection.nodesById,
    ),
    averageFanout,
    maxFanout,
    topFanoutNodes,
  };
}

export function countWorseningDriftSignals(
  signals: readonly DriftSignal[],
): number {
  return signals.filter((signal) => signal.status === 'worsening').length;
}

export function buildRecommendationsTrendContext(
  input: BuildRecommendationsTrendContextInput,
): GovernanceRecommendationsTrendContext {
  const summary = input.summary ?? buildDriftSummary([...input.signals]);
  const snapshotCount = input.snapshotCount ?? 0;

  return {
    overallTrend: summary.overallTrend,
    worseningSignalCount: summary.worseningCount,
    improvingSignalCount: summary.improvingCount,
    stableSignalCount: summary.stableCount,
    signalCount: input.signals.length,
    snapshotCount,
    trendWindowInsufficient: snapshotCount > 0 && snapshotCount < 4,
  };
}

export function buildPersistentSmellSignals(
  input: BuildPersistentSmellSignalsInput,
): GovernancePersistentSmellSignal[] {
  const minimumOccurrences = Math.max(1, input.minimumOccurrences ?? 2);
  const persistentKeyCounts = new Map<string, number>();

  for (const snapshot of input.recentSnapshots) {
    const uniqueKeys = new Set(
      snapshot.violations.map((violation) =>
        buildPersistentViolationKey(violation),
      ),
    );

    for (const key of uniqueKeys) {
      persistentKeyCounts.set(key, (persistentKeyCounts.get(key) ?? 0) + 1);
    }
  }

  return [...persistentKeyCounts.entries()]
    .filter(([, count]) => count >= minimumOccurrences)
    .map(([key, count]) => {
      const [type, source] = key.split('|');
      return {
        type: type ?? 'unknown',
        source: source ?? 'unknown',
        count,
      };
    })
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.type.localeCompare(right.type) ||
        left.source.localeCompare(right.source),
    );
}

export function buildRefactoringSuggestionsContext(
  input: BuildRefactoringSuggestionsContextInput,
): GovernanceRefactoringSuggestionsContext {
  const prioritizedViolations = sliceGovernancePayloadItems(
    input.violations,
    input.analyzedViolationsLimit ?? 10,
    compareGovernanceViolationsForPriority,
  ).items;
  const hotspotCounts = new Map<string, number>();
  for (const violation of prioritizedViolations) {
    hotspotCounts.set(
      violation.source,
      (hotspotCounts.get(violation.source) ?? 0) + 1,
    );
  }

  const fanoutCounts = new Map<string, number>();
  for (const relation of input.relations) {
    fanoutCounts.set(
      relation.sourceNodeId,
      (fanoutCounts.get(relation.sourceNodeId) ?? 0) + 1,
    );
  }

  const topProjectsLimit = Math.max(1, input.topProjectsLimit ?? 5);
  const hotspotNodes = [...hotspotCounts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, topProjectsLimit)
    .map(([nodeId, count]) => ({ nodeId, count }));
  const highFanoutNodes = [...fanoutCounts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, topProjectsLimit)
    .map(([nodeId, count]) => ({ nodeId, count }));
  const nodesById = new Map(
    input.nodes.map((node) => [node.id, node] as const),
  );
  const hotspotDomains = uniqueSortedStrings(
    hotspotNodes
      .map((entry) => readNodeDomain(nodesById.get(entry.nodeId)))
      .filter((domain): domain is string => Boolean(domain)),
  );
  const recentSnapshots = input.recentSnapshots ?? [];

  return {
    analyzedViolations: prioritizedViolations.length,
    totalViolations: input.violations.length,
    hotspotNodes,
    highFanoutNodes,
    hotspotDomains,
    persistentSmellSignals: buildPersistentSmellSignals({
      recentSnapshots,
      minimumOccurrences: input.minimumPersistentOccurrences,
    }),
    snapshotCount: recentSnapshots.length,
    sampledSnapshotCount: recentSnapshots.length,
  };
}

export function buildOnboardingContext(
  input: BuildOnboardingContextInput,
): GovernanceOnboardingContext {
  const domainCounts = new Map<string, number>();
  const layerCounts = new Map<string, number>();
  const fanoutCounts = new Map<string, number>();

  for (const node of input.nodes) {
    const domain = readNodeDomain(node);
    if (domain) {
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    }

    const layer = readNodeLayer(node);
    if (layer) {
      layerCounts.set(layer, (layerCounts.get(layer) ?? 0) + 1);
    }
  }

  for (const relation of input.relations) {
    fanoutCounts.set(
      relation.sourceNodeId,
      (fanoutCounts.get(relation.sourceNodeId) ?? 0) + 1,
    );
  }

  const topProjectsLimit = Math.max(1, input.topProjectsLimit ?? 5);
  const ownedProjectsCount = input.nodes.filter((node) =>
    Boolean(node.ownership?.team),
  ).length;
  const analyzedViolations = input.topViolations?.length ?? 0;

  return {
    nodeCount: input.nodes.length,
    relationCount: input.relations.length,
    ownershipCoverage:
      input.nodes.length > 0
        ? Number((ownedProjectsCount / input.nodes.length).toFixed(3))
        : 0,
    domainSummary: [...domainCounts.entries()]
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .map(([domain, count]) => ({ domain, count })),
    layerSummary: [...layerCounts.entries()]
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .map(([layer, count]) => ({ layer, count })),
    topFanoutNodes: [...fanoutCounts.entries()]
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .slice(0, topProjectsLimit)
      .map(([nodeId, count]) => ({ nodeId, count })),
    analyzedViolations,
    totalViolations: input.totalViolationsCount ?? analyzedViolations,
  };
}

function resolveNodeSelection(
  selectedNodes: readonly string[] | readonly GovernanceNode[],
  allNodes: readonly GovernanceNode[] | undefined,
): {
  nodeIds: Set<string>;
  nodes: GovernanceNode[];
  nodesById: Map<string, GovernanceNode>;
} {
  const selectedNodeIds = new Set<string>();
  const selectedNodeRecords: GovernanceNode[] = [];
  const selectedNodeById = new Map<string, GovernanceNode>();

  if (
    selectedNodes.length > 0 &&
    typeof selectedNodes[0] === 'object' &&
    selectedNodes[0] !== null
  ) {
    for (const node of selectedNodes as readonly GovernanceNode[]) {
      selectedNodeIds.add(node.id);
      selectedNodeRecords.push(node);
      selectedNodeById.set(node.id, node);
    }
  } else {
    const projectLookup = new Map(
      (allNodes ?? []).map((node) => [node.id, node] as const),
    );

    for (const nodeId of selectedNodes as readonly string[]) {
      selectedNodeIds.add(nodeId);
      const node = projectLookup.get(nodeId);
      if (node) {
        selectedNodeRecords.push(node);
        selectedNodeById.set(node.id, node);
      }
    }
  }

  return {
    nodeIds: selectedNodeIds,
    nodes: selectedNodeRecords.sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    nodesById: selectedNodeById,
  };
}

function countCrossDomainRelations(
  relations: readonly GovernanceRelation[],
  nodesById: ReadonlyMap<string, GovernanceNode>,
): number {
  return relations.filter((relation) => {
    const sourceDomain = readNodeDomain(nodesById.get(relation.sourceNodeId));
    const targetDomain = readNodeDomain(nodesById.get(relation.targetNodeId));

    return Boolean(
      sourceDomain && targetDomain && sourceDomain !== targetDomain,
    );
  }).length;
}

function readNodeDomain(node: GovernanceNode | undefined): string | undefined {
  const domain = node?.classification?.domain ?? node?.classification?.scope;
  return typeof domain === 'string' && domain.length > 0 ? domain : undefined;
}

function readNodeLayer(node: GovernanceNode | undefined): string | undefined {
  const layer = node?.classification?.layer;
  return typeof layer === 'string' && layer.length > 0 ? layer : undefined;
}

function buildPersistentViolationKey(violation: SnapshotViolation): string {
  return `${violation.type}|${violation.source}`;
}

function uniqueSortedStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isTrendWindowInsufficient(request: AiAnalysisRequest): boolean {
  return request.inputs.metadata?.trendWindowInsufficient === true;
}

function formatSignedDelta(delta: number): string {
  return `${delta > 0 ? '+' : ''}${delta.toFixed(3)}`;
}
