import type {
  AiAnalysisRequest,
  DriftSignal,
  DriftSummary,
  GovernanceDependency,
  MetricSnapshot,
  SnapshotComparison,
  SnapshotMetricDelta,
  SnapshotViolation,
} from './models.js';

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
  projectScopeCount: number;
  dependencies: GovernancePayloadTruncationMetadata;
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
  dependencies?: GovernanceDependency[];
  topViolations?: SnapshotViolation[];
  projectScope?: Iterable<string>;
  dependencyLimit?: number;
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

export function scopeGovernanceDependencies(
  dependencies: readonly GovernanceDependency[],
  projectScope: Iterable<string>,
  limit?: number,
): GovernancePayloadSliceResult<GovernanceDependency> {
  const scopedProjects = new Set(projectScope);
  const filtered = dependencies.filter(
    (dependency) =>
      scopedProjects.has(dependency.source) ||
      scopedProjects.has(dependency.target),
  );

  return sliceGovernancePayloadItems(
    filtered,
    limit,
    compareGovernanceDependenciesForPayload,
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

  const dependencies =
    input.dependencies ?? input.request.inputs.dependencies ?? [];
  const topViolations =
    input.topViolations ?? input.request.inputs.topViolations ?? [];
  const projectScope = input.projectScope
    ? new Set(input.projectScope)
    : deriveProjectScopeFromViolations(topViolations);
  const dependencySlice = scopeGovernanceDependencies(
    dependencies,
    projectScope,
    input.dependencyLimit,
  );
  const totalViolationsCount =
    input.request.inputs.snapshot?.violations.length ?? topViolations.length;
  const violationLimit = normalizeLimit(
    input.topViolationsLimit,
    topViolations.length,
  );
  const payloadScope: RootCausePayloadScope = {
    projectScopeCount: projectScope.size,
    dependencies: dependencySlice.truncation,
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
        dependencies: dependencySlice.items,
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

function compareGovernanceDependenciesForPayload(
  left: GovernanceDependency,
  right: GovernanceDependency,
): number {
  return (
    left.source.localeCompare(right.source) ||
    left.target.localeCompare(right.target) ||
    left.type.localeCompare(right.type) ||
    (left.sourceFile ?? '').localeCompare(right.sourceFile ?? '')
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

function deriveProjectScopeFromViolations(
  violations: readonly SnapshotViolation[],
): Set<string> {
  const projectScope = new Set<string>();

  for (const violation of violations) {
    projectScope.add(violation.source);
    if (violation.target) {
      projectScope.add(violation.target);
    }
  }

  return projectScope;
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
