import type {
  AiAnalysisRequest,
  AiAnalysisResult,
  GovernanceAssessment,
  GovernanceRelation,
  MetricSnapshot,
  Recommendation,
  SnapshotComparison,
  SnapshotViolation,
} from '../model/models.js';
import type { DeliveryImpactAssessment } from '../diagnostics/delivery-impact.js';

export interface BuildManagementInsightsAiRequestInput {
  deliveryImpact: DeliveryImpactAssessment;
  assessment?: GovernanceAssessment;
  comparison?: SnapshotComparison;
  generatedAt?: string;
  profile?: string;
  metadata?: Record<string, unknown>;
}

export function buildRootCauseRequest(params: {
  profile: string;
  snapshot: MetricSnapshot;
  relations: GovernanceRelation[];
  topViolations?: SnapshotViolation[];
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'root-cause',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      snapshot: params.snapshot,
      relations: params.relations,
      topViolations: params.topViolations,
      metadata: params.metadata,
    },
  };
}

export function buildPrImpactRequest(params: {
  profile: string;
  affectedNodeIds: string[];
  affectedRelationIds?: string[];
  relations: GovernanceRelation[];
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'pr-impact',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      affectedNodeIds: params.affectedNodeIds,
      ...(params.affectedRelationIds
        ? { affectedRelationIds: params.affectedRelationIds }
        : {}),
      relations: params.relations,
      metadata: params.metadata,
    },
  };
}

export function buildScorecardRequest(params: {
  profile: string;
  snapshot: MetricSnapshot;
  comparison?: SnapshotComparison;
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'scorecard',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      snapshot: params.snapshot,
      comparison: params.comparison,
      metadata: params.metadata,
    },
  };
}

export function buildOnboardingRequest(params: {
  profile: string;
  relations: GovernanceRelation[];
  topViolations?: SnapshotViolation[];
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'onboarding',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      relations: params.relations,
      topViolations: params.topViolations,
      metadata: params.metadata,
    },
  };
}

export function buildCognitiveLoadRequest(params: {
  profile: string;
  affectedNodeIds: string[];
  affectedRelationIds?: string[];
  relations: GovernanceRelation[];
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'cognitive-load',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      affectedNodeIds: params.affectedNodeIds,
      ...(params.affectedRelationIds
        ? { affectedRelationIds: params.affectedRelationIds }
        : {}),
      relations: params.relations,
      metadata: params.metadata,
    },
  };
}

export function buildArchitectureRecommendationsRequest(params: {
  profile: string;
  relations: GovernanceRelation[];
  topViolations?: SnapshotViolation[];
  comparison?: SnapshotComparison;
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'recommendations',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      relations: params.relations,
      topViolations: params.topViolations,
      comparison: params.comparison,
      metadata: params.metadata,
    },
  };
}

export function buildSmellClustersRequest(params: {
  profile: string;
  relations: GovernanceRelation[];
  topViolations?: SnapshotViolation[];
  comparison?: SnapshotComparison;
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'smell-clusters',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      relations: params.relations,
      topViolations: params.topViolations,
      comparison: params.comparison,
      metadata: params.metadata,
    },
  };
}

export function buildRefactoringSuggestionsRequest(params: {
  profile: string;
  relations: GovernanceRelation[];
  topViolations?: SnapshotViolation[];
  comparison?: SnapshotComparison;
  metadata?: Record<string, unknown>;
}): AiAnalysisRequest {
  return {
    kind: 'refactoring-suggestions',
    generatedAt: new Date().toISOString(),
    profile: params.profile,
    inputs: {
      relations: params.relations,
      topViolations: params.topViolations,
      comparison: params.comparison,
      metadata: params.metadata,
    },
  };
}

export function buildManagementInsightsAiRequest(
  input: BuildManagementInsightsAiRequestInput,
): AiAnalysisRequest {
  return {
    kind: 'management-insights',
    generatedAt:
      input.generatedAt ??
      input.deliveryImpact.generatedAt ??
      new Date().toISOString(),
    profile: input.profile ?? input.deliveryImpact.profile,
    inputs: {
      metadata: {
        deliveryImpact: input.deliveryImpact,
        assessmentSummary: input.assessment
          ? {
              health: input.assessment.health,
              violationCount: input.assessment.violations.length,
              topIssues: input.assessment.topIssues.slice(0, 5),
            }
          : undefined,
        comparisonSummary: input.comparison
          ? {
              healthDelta: input.comparison.healthDelta,
              deliveryImpactIndexDeltas:
                input.comparison.deliveryImpactIndexDeltas,
            }
          : undefined,
        ...(input.metadata ?? {}),
      },
    },
  };
}

export function rankTopViolations(
  violations: SnapshotViolation[],
  limit = 10,
): SnapshotViolation[] {
  const severityWeight: Record<string, number> = {
    error: 3,
    warning: 2,
    info: 1,
  };

  return [...violations]
    .sort((a, b) => {
      const severityDelta =
        (severityWeight[b.severity ?? 'info'] ?? 0) -
        (severityWeight[a.severity ?? 'info'] ?? 0);

      if (severityDelta !== 0) {
        return severityDelta;
      }

      return toViolationKey(a).localeCompare(toViolationKey(b));
    })
    .slice(0, Math.max(0, limit));
}

export function summarizeRootCause(
  request: AiAnalysisRequest,
): AiAnalysisResult {
  const violations = request.inputs.topViolations ?? [];
  const sourceCounts = countBy(violations, (violation) => violation.source);
  const typeCounts = countBy(violations, (violation) => violation.type);
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3);

  const findings = topSources.map(([source, count], index) => ({
    id: `hotspot-${index + 1}`,
    title: `Hotspot: ${source}`,
    detail: `${source} appears in ${count} of ${violations.length} prioritized violations.`,
    signals: ['top-violations', 'frequency'],
    confidence: violations.length > 0 ? count / violations.length : 0,
  }));

  if (findings.length === 0) {
    findings.push({
      id: 'no-prioritized-violations',
      title: 'No prioritized violations',
      detail:
        'No prioritized violations were available for root-cause interpretation in the selected snapshot.',
      signals: ['top-violations'],
      confidence: 1,
    });
  }

  return {
    kind: 'root-cause',
    summary:
      violations.length === 0
        ? 'No prioritized governance violations found for root-cause analysis.'
        : `Analyzed ${violations.length} prioritized violations across ${topSources.length} hotspot subjects.`,
    findings,
    recommendations: buildRuleRecommendations(typeCounts),
    metadata: {
      violationTypes: typeCounts,
      analyzedViolationCount: violations.length,
    },
  };
}

export function summarizePrImpact(
  request: AiAnalysisRequest,
): AiAnalysisResult {
  const metadata = request.inputs.metadata ?? {};
  const changedFilesCount = numberFromMetadata(metadata, 'changedFilesCount');
  const affectedNodeCount =
    request.inputs.affectedNodeIds?.length ??
    numberFromMetadata(metadata, 'affectedNodeCount');
  const affectedDomainCount = numberFromMetadata(
    metadata,
    'affectedDomainCount',
  );
  const crossDomainRelationEdges = numberFromMetadata(
    metadata,
    'crossDomainRelationEdges',
  );

  const riskScore = [
    changedFilesCount * 5,
    affectedNodeCount * 15,
    affectedDomainCount * 20,
    crossDomainRelationEdges * 10,
  ].reduce((sum, value) => sum + value, 0);
  const clampedRiskScore = Math.max(0, Math.min(100, riskScore));
  const risk =
    clampedRiskScore >= 70 ? 'high' : clampedRiskScore >= 40 ? 'medium' : 'low';

  return {
    kind: 'pr-impact',
    summary: `PR impact is ${risk} risk at ${clampedRiskScore}/100 across ${affectedNodeCount} affected node(s).`,
    findings: [
      {
        id: 'affected-nodes',
        title: 'Affected node spread',
        detail: `${affectedNodeCount} node(s), ${affectedDomainCount} domain(s), and ${crossDomainRelationEdges} cross-domain relation edge(s) are implicated.`,
        signals: ['affected-nodes', 'cross-domain-impact'],
        confidence: 1,
      },
    ],
    recommendations: buildPriorityRecommendations(risk),
    metadata: {
      changedFilesCount,
      affectedNodeCount,
      affectedDomainCount,
      crossDomainRelationEdges,
      risk: clampedRiskScore,
    },
  };
}

export function summarizeScorecard(
  request: AiAnalysisRequest,
): AiAnalysisResult {
  const snapshot = request.inputs.snapshot;
  const comparison = request.inputs.comparison;
  const healthScore = snapshot?.health?.score ?? 0;

  return {
    kind: 'scorecard',
    summary: comparison?.healthDelta
      ? `Current health is ${healthScore}/100 with a ${comparison.healthDelta.scoreDelta} point delta from the baseline.`
      : `Current health is ${healthScore}/100.`,
    findings: [
      {
        id: 'workspace-health',
        title: 'Workspace health score',
        detail: snapshot?.health
          ? `${snapshot.health.score}/100 (${snapshot.health.status}, grade ${snapshot.health.grade}).`
          : 'No health score was available in the snapshot.',
        signals: ['workspace-health'],
        confidence: 1,
      },
    ],
    recommendations:
      comparison?.healthDelta && comparison.healthDelta.scoreDelta < 0
        ? [
            {
              id: 'recover-health-score',
              title: 'Recover degraded health score',
              priority: 'high',
              reason:
                'The current snapshot is worse than the baseline and should be investigated before the next release.',
            },
          ]
        : [],
    metadata: {
      scoreDelta: comparison?.healthDelta?.scoreDelta,
    },
  };
}

export function summarizeOnboarding(
  request: AiAnalysisRequest,
): AiAnalysisResult {
  const relationCount = request.inputs.relations?.length ?? 0;
  const topViolationCount = request.inputs.topViolations?.length ?? 0;

  return {
    kind: 'onboarding',
    summary:
      relationCount === 0
        ? 'No relation graph details were available for onboarding analysis.'
        : `Prepared onboarding analysis from ${relationCount} relation edge(s) and ${topViolationCount} prioritized violation(s).`,
    findings: [
      {
        id: 'relation-surface',
        title: 'Relation surface',
        detail: `${relationCount} relation edge(s) were included for the onboarding brief.`,
        signals: ['relation-surface'],
        confidence: 1,
      },
    ],
    recommendations:
      topViolationCount > 0
        ? [
            {
              id: 'review-prioritized-hotspots',
              title: 'Review prioritized hotspots first',
              priority: 'medium',
              reason:
                'New contributors should start with the highest-severity governance hotspots to understand architectural risk quickly.',
            },
          ]
        : [],
    metadata: {
      relationCount,
      topViolationCount,
    },
  };
}

export function summarizeManagementInsights(
  request: AiAnalysisRequest,
): AiAnalysisResult {
  const metadata = asRecord(request.inputs.metadata);
  const deliveryImpact = asRecord(metadata?.deliveryImpact) as
    | DeliveryImpactAssessment
    | undefined;

  if (!deliveryImpact || deliveryImpact.indices.length === 0) {
    return {
      kind: 'management-insights',
      summary:
        'No delivery-impact indices were available for management-insights AI handoff.',
      findings: [
        {
          id: 'no-delivery-impact-indices',
          title: 'No delivery-impact indices',
          detail:
            'The payload did not include Cost of Change, Time-to-Market Risk, or other delivery-impact indices to interpret.',
          signals: ['delivery-impact'],
          confidence: 1,
        },
      ],
      recommendations: [],
      metadata: {
        indexCount: 0,
      },
    };
  }

  const highestRiskIndex = [...deliveryImpact.indices].sort(
    (left, right) =>
      right.score - left.score || left.id.localeCompare(right.id),
  )[0];
  const topDriver = deliveryImpact.drivers[0];

  return {
    kind: 'management-insights',
    summary: `Prepared AI handoff input for ${deliveryImpact.indices.length} delivery-impact indices. Highest current pressure: ${highestRiskIndex.name} (${highestRiskIndex.risk}, score ${highestRiskIndex.score}).`,
    findings: [
      {
        id: `index-${highestRiskIndex.id}`,
        title: `${highestRiskIndex.name} is the highest current delivery pressure`,
        detail: `${highestRiskIndex.name} is ${highestRiskIndex.score}/100 with ${highestRiskIndex.risk} risk.`,
        signals: highestRiskIndex.drivers.map((driver) => driver.id),
        confidence: 1,
      },
      ...(topDriver
        ? [
            {
              id: `driver-${topDriver.id}`,
              title: `Primary investment driver: ${topDriver.label}`,
              detail:
                topDriver.explanation ??
                `${topDriver.label} is the strongest current delivery-impact driver.`,
              signals: [topDriver.id],
              confidence: topDriver.score ? topDriver.score / 100 : 0.6,
            },
          ]
        : []),
    ],
    recommendations: [
      {
        id: 'trace-delivery-pressure',
        title: 'Trace delivery pressure to concrete architecture work',
        priority: highestRiskIndex.risk === 'high' ? 'high' : 'medium',
        reason:
          'Management-facing delivery-impact signals are strongest when they stay tied to the concrete governance evidence already present in the payload.',
      },
    ],
    metadata: {
      indexCount: deliveryImpact.indices.length,
      driverCount: deliveryImpact.drivers.length,
    },
  };
}

export function summarizeArchitectureRecommendations(
  request: AiAnalysisRequest,
): AiAnalysisResult {
  return summarizeViolationDrivenRequest(
    request,
    'recommendations',
    'Architecture recommendations',
    'Generate architecture work items from the strongest governance hotspots.',
  );
}

export function summarizeCognitiveLoad(
  request: AiAnalysisRequest,
): AiAnalysisResult {
  const affectedNodeIds = request.inputs.affectedNodeIds ?? [];
  const relations = request.inputs.relations ?? [];
  const score = Math.max(
    0,
    Math.min(100, affectedNodeIds.length * 15 + relations.length * 2),
  );
  const risk = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

  return {
    kind: 'cognitive-load',
    summary: `Estimated cognitive load is ${risk} risk at ${score}/100.`,
    findings: [
      {
        id: 'cognitive-load-surface',
        title: 'Cognitive load surface',
        detail: `${affectedNodeIds.length} affected node(s) and ${relations.length} relation edge(s) contribute to the current change context.`,
        signals: ['affected-nodes', 'relation-count'],
        confidence: 0.8,
      },
    ],
    recommendations: buildPriorityRecommendations(risk),
    metadata: {
      score,
      affectedNodeCount: affectedNodeIds.length,
      relationCount: relations.length,
    },
  };
}

export function summarizeSmellClusters(
  request: AiAnalysisRequest,
): AiAnalysisResult {
  return summarizeViolationDrivenRequest(
    request,
    'smell-clusters',
    'Smell clusters',
    'Group recurring hotspots before choosing remediation sequencing.',
  );
}

export function summarizeRefactoringSuggestions(
  request: AiAnalysisRequest,
): AiAnalysisResult {
  return summarizeViolationDrivenRequest(
    request,
    'refactoring-suggestions',
    'Refactoring suggestions',
    'Start with the most repeated hotspot patterns before broad cleanup.',
  );
}

function summarizeViolationDrivenRequest(
  request: AiAnalysisRequest,
  kind: AiAnalysisRequest['kind'],
  title: string,
  recommendationReason: string,
): AiAnalysisResult {
  const violations = request.inputs.topViolations ?? [];
  const rankedViolations = rankTopViolations(violations, 5);

  return {
    kind,
    summary:
      rankedViolations.length === 0
        ? `No prioritized violations were available for ${title.toLowerCase()}.`
        : `Prepared ${title.toLowerCase()} from ${rankedViolations.length} prioritized violation(s).`,
    findings: rankedViolations.map((violation, index) => ({
      id: `violation-${index + 1}`,
      title: violation.ruleId ?? violation.type,
      detail: violation.message ?? `${violation.type} at ${violation.source}.`,
      signals: [violation.type, violation.ruleId ?? 'violation'],
      confidence: 1,
    })),
    recommendations:
      rankedViolations.length > 0
        ? [
            {
              id: `${kind}-focus`,
              title,
              priority: 'medium',
              reason: recommendationReason,
            },
          ]
        : [],
  };
}

function buildRuleRecommendations(
  typeCounts: Record<string, number>,
): Recommendation[] {
  return Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([type]) => ({
      id: `address-${type}`,
      title: `Address ${type}`,
      priority: 'medium' as const,
      reason: `${type} is recurring in the prioritized violation set.`,
    }));
}

function buildPriorityRecommendations(
  risk: 'low' | 'medium' | 'high',
): Recommendation[] {
  if (risk === 'low') {
    return [];
  }

  return [
    {
      id: 'reduce-change-risk',
      title: 'Reduce change risk',
      priority: risk === 'high' ? 'high' : 'medium',
      reason:
        'The current change surface spans enough projects and coupling to justify targeted architectural risk reduction before further expansion.',
    },
  ];
}

function countBy<T>(
  items: T[],
  keySelector: (item: T) => string,
): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = keySelector(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function numberFromMetadata(
  metadata: Record<string, unknown>,
  key: string,
): number {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toViolationKey(violation: SnapshotViolation): string {
  return [
    violation.ruleId ?? '',
    violation.type,
    violation.source,
    violation.target ?? '',
    violation.message ?? '',
  ].join('|');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
