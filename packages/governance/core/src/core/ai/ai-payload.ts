import type {
  AiAnalysisRequest,
  DriftSignal,
  DriftSummary,
  GovernanceRelation,
  MetricSnapshot,
  SnapshotComparison,
  SnapshotMetricDelta,
  SnapshotViolation,
} from '../model/models.js';

export interface GovernancePayloadTruncationMetadata {
  totalCount: number;
  selectedCount: number;
  limit: number;
  truncated: boolean;
}

export interface GovernancePayloadSliceResult<T> {
  items: T[];
  truncation: GovernancePayloadTruncationMetadata;
}

export interface RootCausePayloadScope {
  nodeScopeCount: number;
  relations: GovernancePayloadTruncationMetadata;
  violations: GovernancePayloadTruncationMetadata;
}

export interface DriftPayloadScope {
  signals: GovernancePayloadTruncationMetadata;
  metricDeltas: GovernancePayloadTruncationMetadata;
  scoreDeltas: GovernancePayloadTruncationMetadata;
  newViolations: GovernancePayloadTruncationMetadata;
  resolvedViolations: GovernancePayloadTruncationMetadata;
}

export interface ScorecardPayloadScope {
  snapshotViolations: GovernancePayloadTruncationMetadata;
  metricDeltas: GovernancePayloadTruncationMetadata;
  scoreDeltas: GovernancePayloadTruncationMetadata;
}

export interface ScopedGovernanceAiRequestResult<TScope> {
  request: AiAnalysisRequest;
  payloadScope: TScope;
}

export interface BuildScopedRootCauseRequestInput {
  request: AiAnalysisRequest;
  relations?: GovernanceRelation[];
  topViolations?: SnapshotViolation[];
  nodeScope?: Iterable<string>;
  relationLimit?: number;
  topViolationsLimit?: number;
}

export interface BuildScopedDriftRequestInput {
  request: AiAnalysisRequest;
  comparison?: SnapshotComparison;
  signals?: DriftSignal[];
  summary?: DriftSummary;
  signalLimit?: number;
  deltaLimit?: number;
  violationLimit?: number;
}

export interface BuildScopedScorecardRequestInput {
  request: AiAnalysisRequest;
  snapshot?: MetricSnapshot;
  comparison?: SnapshotComparison;
  violationLimit?: number;
  deltaLimit?: number;
}

export function buildGovernancePayloadTruncationMetadata(
  totalCount: number,
  selectedCount: number,
  limit: number,
): GovernancePayloadTruncationMetadata {
  return {
    totalCount,
    selectedCount,
    limit,
    truncated: selectedCount < totalCount,
  };
}

export function sliceGovernancePayloadItems<T>(
  items: readonly T[],
  limit: number | undefined,
  compare: (left: T, right: T) => number,
): GovernancePayloadSliceResult<T> {
  const normalizedLimit = normalizeLimit(limit, items.length);
  const sorted = [...items].sort(compare);
  const selected = sorted.slice(0, normalizedLimit);

  return {
    items: selected,
    truncation: buildGovernancePayloadTruncationMetadata(
      sorted.length,
      selected.length,
      normalizedLimit,
    ),
  };
}

export function scopeGovernanceRelations(
  relations: readonly GovernanceRelation[],
  nodeScope: Iterable<string>,
  limit?: number,
): GovernancePayloadSliceResult<GovernanceRelation> {
  const scopedNodes = new Set(nodeScope);
  const filtered = relations.filter(
    (relation) =>
      scopedNodes.has(relation.sourceNodeId) ||
      scopedNodes.has(relation.targetNodeId),
  );

  return sliceGovernancePayloadItems(
    filtered,
    limit,
    compareGovernanceRelationsForPayload,
  );
}

export function compareGovernanceViolationsForPriority(
  left: SnapshotViolation,
  right: SnapshotViolation,
): number {
  return (
    rankViolationSeverity(right.severity) -
      rankViolationSeverity(left.severity) ||
    (left.source ?? '').localeCompare(right.source ?? '') ||
    (left.type ?? '').localeCompare(right.type ?? '') ||
    (left.target ?? '').localeCompare(right.target ?? '')
  );
}

export function buildScopedRootCauseRequest(
  input: BuildScopedRootCauseRequestInput,
): ScopedGovernanceAiRequestResult<RootCausePayloadScope> {
  assertRequestKind(input.request, 'root-cause');

  const relations = input.relations ?? input.request.inputs.relations ?? [];
  const topViolations =
    input.topViolations ?? input.request.inputs.topViolations ?? [];
  const nodeScope = input.nodeScope
    ? new Set(input.nodeScope)
    : deriveNodeScopeFromViolations(topViolations);
  const relationSlice = scopeGovernanceRelations(
    relations,
    nodeScope,
    input.relationLimit,
  );
  const totalViolationsCount =
    input.request.inputs.snapshot?.violations.length ?? topViolations.length;
  const violationLimit = normalizeLimit(
    input.topViolationsLimit,
    topViolations.length,
  );
  const payloadScope: RootCausePayloadScope = {
    nodeScopeCount: nodeScope.size,
    relations: relationSlice.truncation,
    violations: buildGovernancePayloadTruncationMetadata(
      totalViolationsCount,
      topViolations.length,
      violationLimit,
    ),
  };

  return {
    request: {
      ...input.request,
      inputs: {
        ...input.request.inputs,
        topViolations,
        relations: relationSlice.items,
        metadata: mergePayloadScopeMetadata(
          input.request.inputs.metadata,
          payloadScope,
        ),
      },
    },
    payloadScope,
  };
}

export function buildScopedDriftRequest(
  input: BuildScopedDriftRequestInput,
): ScopedGovernanceAiRequestResult<DriftPayloadScope> {
  assertRequestKind(input.request, 'drift');

  const comparison = input.comparison ?? input.request.inputs.comparison;
  const signals = input.signals ?? [];
  const summary = input.summary;
  const signalSlice = sliceGovernancePayloadItems(
    signals,
    input.signalLimit,
    compareDriftSignalsForPayload,
  );
  const metricDeltaSlice = sliceGovernancePayloadItems(
    comparison?.metricDeltas ?? [],
    input.deltaLimit,
    compareSnapshotDeltasForPayload,
  );
  const scoreDeltaSlice = sliceGovernancePayloadItems(
    comparison?.scoreDeltas ?? [],
    input.deltaLimit,
    compareSnapshotDeltasForPayload,
  );
  const newViolationSlice = sliceGovernancePayloadItems(
    comparison?.newViolations ?? [],
    input.violationLimit,
    compareGovernanceViolationsForPriority,
  );
  const resolvedViolationSlice = sliceGovernancePayloadItems(
    comparison?.resolvedViolations ?? [],
    input.violationLimit,
    compareGovernanceViolationsForPriority,
  );
  const payloadScope: DriftPayloadScope = {
    signals: signalSlice.truncation,
    metricDeltas: metricDeltaSlice.truncation,
    scoreDeltas: scoreDeltaSlice.truncation,
    newViolations: newViolationSlice.truncation,
    resolvedViolations: resolvedViolationSlice.truncation,
  };

  return {
    request: {
      ...input.request,
      inputs: {
        ...input.request.inputs,
        comparison: comparison
          ? {
              ...comparison,
              baseline: redactMetricSnapshot(comparison.baseline),
              current: redactMetricSnapshot(comparison.current),
              metricDeltas: metricDeltaSlice.items,
              scoreDeltas: scoreDeltaSlice.items,
              newViolations: newViolationSlice.items,
              resolvedViolations: resolvedViolationSlice.items,
            }
          : undefined,
        metadata: {
          ...(input.request.inputs.metadata ?? {}),
          signals: signalSlice.items,
          ...(summary ? { driftSummary: summary } : {}),
          payloadScope: mergePayloadScope(
            readPayloadScope(input.request.inputs.metadata),
            payloadScope,
          ),
        },
      },
    },
    payloadScope,
  };
}

export function buildScopedScorecardRequest(
  input: BuildScopedScorecardRequestInput,
): ScopedGovernanceAiRequestResult<ScorecardPayloadScope> {
  assertRequestKind(input.request, 'scorecard');

  const snapshot = input.snapshot ?? input.request.inputs.snapshot;
  const comparison = input.comparison ?? input.request.inputs.comparison;
  const snapshotViolationSlice = sliceGovernancePayloadItems(
    snapshot?.violations ?? [],
    input.violationLimit,
    compareGovernanceViolationsForPriority,
  );
  const metricDeltaSlice = sliceGovernancePayloadItems(
    comparison?.metricDeltas ?? [],
    input.deltaLimit,
    compareSnapshotDeltasForPayload,
  );
  const scoreDeltaSlice = sliceGovernancePayloadItems(
    comparison?.scoreDeltas ?? [],
    input.deltaLimit,
    compareSnapshotDeltasForPayload,
  );
  const payloadScope: ScorecardPayloadScope = {
    snapshotViolations: snapshotViolationSlice.truncation,
    metricDeltas: metricDeltaSlice.truncation,
    scoreDeltas: scoreDeltaSlice.truncation,
  };

  return {
    request: {
      ...input.request,
      inputs: {
        ...input.request.inputs,
        snapshot: snapshot
          ? {
              ...snapshot,
              violations: snapshotViolationSlice.items,
            }
          : undefined,
        comparison: comparison
          ? {
              ...comparison,
              baseline: {
                ...redactMetricSnapshot(comparison.baseline),
                violations: [],
              },
              current: {
                ...redactMetricSnapshot(comparison.current),
                violations: [],
              },
              metricDeltas: metricDeltaSlice.items,
              scoreDeltas: scoreDeltaSlice.items,
              newViolations: [],
              resolvedViolations: [],
            }
          : undefined,
        metadata: mergePayloadScopeMetadata(
          input.request.inputs.metadata,
          payloadScope,
        ),
      },
    },
    payloadScope,
  };
}

function compareGovernanceRelationsForPayload(
  left: GovernanceRelation,
  right: GovernanceRelation,
): number {
  return (
    left.sourceNodeId.localeCompare(right.sourceNodeId) ||
    left.targetNodeId.localeCompare(right.targetNodeId) ||
    left.kind.localeCompare(right.kind) ||
    left.id.localeCompare(right.id)
  );
}

function compareDriftSignalsForPayload(
  left: DriftSignal,
  right: DriftSignal,
): number {
  return right.magnitude - left.magnitude || left.id.localeCompare(right.id);
}

function compareSnapshotDeltasForPayload(
  left: SnapshotMetricDelta,
  right: SnapshotMetricDelta,
): number {
  return (
    Math.abs(right.delta) - Math.abs(left.delta) ||
    left.id.localeCompare(right.id)
  );
}

function rankViolationSeverity(
  severity: SnapshotViolation['severity'],
): number {
  if (severity === 'error') {
    return 3;
  }

  if (severity === 'warning') {
    return 2;
  }

  if (severity === 'info') {
    return 1;
  }

  return 0;
}

function deriveNodeScopeFromViolations(
  violations: readonly SnapshotViolation[],
): Set<string> {
  const nodeScope = new Set<string>();

  for (const violation of violations) {
    nodeScope.add(violation.source);
    if (violation.target) {
      nodeScope.add(violation.target);
    }
  }

  return nodeScope;
}

function assertRequestKind(
  request: AiAnalysisRequest,
  expectedKind: AiAnalysisRequest['kind'],
): void {
  if (request.kind !== expectedKind) {
    throw new Error(
      `Expected an AI analysis request of kind "${expectedKind}", received "${request.kind}".`,
    );
  }
}

function normalizeLimit(limit: number | undefined, totalCount: number): number {
  if (typeof limit !== 'number' || Number.isNaN(limit)) {
    return totalCount;
  }

  return Math.max(0, Math.trunc(limit));
}

function redactMetricSnapshot(snapshot: MetricSnapshot): MetricSnapshot {
  return {
    timestamp: snapshot.timestamp,
    repo: snapshot.repo,
    branch: snapshot.branch,
    commitSha: snapshot.commitSha,
    pluginVersion: snapshot.pluginVersion,
    metricSchemaVersion: snapshot.metricSchemaVersion,
    metrics: {},
    scores: {},
    violations: [],
  };
}

function mergePayloadScopeMetadata(
  metadata: Record<string, unknown> | undefined,
  payloadScope: object,
): Record<string, unknown> {
  return {
    ...metadata,
    payloadScope: mergePayloadScope(readPayloadScope(metadata), payloadScope),
  };
}

function readPayloadScope(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const value = metadata?.payloadScope;

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function mergePayloadScope(
  currentPayloadScope: Record<string, unknown> | undefined,
  nextPayloadScope: object,
): Record<string, unknown> {
  return {
    ...(currentPayloadScope ?? {}),
    ...nextPayloadScope,
  };
}
