import { createHash } from 'node:crypto';

import type { Violation } from '../model/models.js';
import type {
  GovernanceSignal,
  GovernanceSignalCategory,
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  GovernanceSignalType,
} from './signals.js';
import { isAllowedDomainDependency } from './domain-dependency-policy.js';

export interface GovernanceGraphSnapshotProject {
  id: string;
  domain?: string;
}

export interface GovernanceGraphSnapshotRelation {
  id?: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind?: string;
  metadata?: Record<string, unknown>;
}

export interface GovernanceGraphSnapshot {
  extractedAt: string;
  nodes: GovernanceGraphSnapshotProject[];
  relations: GovernanceGraphSnapshotRelation[];
}

export interface GovernanceConformanceFinding {
  ruleId?: string;
  nodeId?: string;
  relationId?: string;
  relatedNodeIds: string[];
  relatedRelationIds: string[];
  category: GovernanceSignalCategory;
  severity: GovernanceSignalSeverity;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface GovernanceConformanceSnapshot {
  extractedAt: string;
  findings: GovernanceConformanceFinding[];
}

export interface BuildGovernanceSignalsOptions {
  graphSnapshot: GovernanceGraphSnapshot;
  graphSignalOptions?: BuildGovernanceGraphSignalsOptions;
  conformanceSnapshot?: GovernanceConformanceSnapshot;
  policyViolations?: Violation[];
}

export interface BuildGovernanceGraphSignalsOptions {
  allowedDomainDependencies?: Record<string, string[]>;
}

interface SignalDraft {
  type: GovernanceSignalType;
  nodeId?: string;
  relationId?: string;
  relatedNodeIds?: string[];
  relatedRelationIds?: string[];
  severity: GovernanceSignalSeverity;
  category: GovernanceSignalCategory;
  message: string;
  metadata?: Record<string, unknown>;
  source: GovernanceSignalSource;
  sourcePluginId?: string;
  createdAt: string;
  identityKey?: string;
}

const SIGNAL_ID_PREFIX = 'signal-';
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

export function buildGovernanceGraphSignals(
  snapshot: GovernanceGraphSnapshot,
  options: BuildGovernanceGraphSignalsOptions = {},
): GovernanceSignal[] {
  const nodesById = new Map(
    snapshot.nodes.map((node) => [node.id, node] as const),
  );
  const signals: GovernanceSignal[] = [];

  for (const relation of snapshot.relations) {
    const sourceNode = nodesById.get(relation.sourceNodeId);
    const targetNode = nodesById.get(relation.targetNodeId);
    const dependencyRelation = isDependencyRelation(relation);
    const sourceDomain = normalizeText(sourceNode?.domain);
    const targetDomain = normalizeText(targetNode?.domain);
    const relatedNodeIds = normalizeRelatedIds([
      relation.sourceNodeId,
      relation.targetNodeId,
    ]);
    const relationId = normalizeText(relation.id);
    const dependencyType = readStringMetadata(
      relation.metadata,
      'dependencyType',
    );

    signals.push(
      finalizeSignal({
        type: 'structural-dependency',
        nodeId: relation.sourceNodeId,
        ...(relationId ? { relationId } : {}),
        relatedNodeIds,
        ...(relationId ? { relatedRelationIds: [relationId] } : {}),
        severity: 'info',
        category: 'dependency',
        message: `Dependency: ${relation.sourceNodeId} -> ${relation.targetNodeId}.`,
        metadata: {
          ...(dependencyType ? { dependencyType } : {}),
        },
        source: 'graph',
        createdAt: snapshot.extractedAt,
      }),
    );

    if (
      dependencyRelation &&
      sourceDomain &&
      targetDomain &&
      sourceDomain !== targetDomain &&
      !isAllowedCrossDomainDependencySignal(
        relation,
        sourceDomain,
        targetDomain,
        options,
      )
    ) {
      signals.push(
        finalizeSignal({
          type: 'cross-domain-dependency',
          nodeId: relation.sourceNodeId,
          ...(relationId ? { relationId } : {}),
          relatedNodeIds,
          ...(relationId ? { relatedRelationIds: [relationId] } : {}),
          severity: 'warning',
          category: 'boundary',
          message: `Cross-domain dependency: ${relation.sourceNodeId} (${sourceDomain}) -> ${relation.targetNodeId} (${targetDomain}).`,
          metadata: {
            sourceDomain,
            targetDomain,
          },
          source: 'graph',
          createdAt: snapshot.extractedAt,
        }),
      );
    } else if (dependencyRelation && (!sourceDomain || !targetDomain)) {
      signals.push(
        finalizeSignal({
          type: 'missing-domain-context',
          nodeId: relation.sourceNodeId,
          ...(relationId ? { relationId } : {}),
          relatedNodeIds,
          ...(relationId ? { relatedRelationIds: [relationId] } : {}),
          severity: 'warning',
          category: 'boundary',
          message: `Missing domain context for dependency: ${relation.sourceNodeId} -> ${relation.targetNodeId}.`,
          metadata: {
            sourceDomain,
            targetDomain,
            missingSourceDomain: !sourceDomain,
            missingTargetDomain: !targetDomain,
          },
          source: 'graph',
          createdAt: snapshot.extractedAt,
        }),
      );
    }
  }

  return signals.sort(compareSignals);
}

export function buildGovernanceConformanceSignals(
  snapshot: GovernanceConformanceSnapshot,
): GovernanceSignal[] {
  return snapshot.findings
    .map((finding) =>
      mapConformanceFindingToSignal(finding, snapshot.extractedAt),
    )
    .sort(compareSignals);
}

export function buildGovernancePolicySignals(
  violations: Violation[],
  options: { createdAt?: string } = {},
): GovernanceSignal[] {
  const createdAt = options.createdAt ?? new Date().toISOString();

  return violations
    .flatMap((violation) => mapViolationToPolicySignal(violation, createdAt))
    .sort(compareSignals);
}

export function buildGovernanceSignals(
  options: BuildGovernanceSignalsOptions,
): GovernanceSignal[] {
  return mergeGovernanceSignals(
    buildGovernanceGraphSignals(
      options.graphSnapshot,
      options.graphSignalOptions,
    ),
    options.conformanceSnapshot
      ? buildGovernanceConformanceSignals(options.conformanceSnapshot)
      : [],
    options.policyViolations
      ? buildGovernancePolicySignals(options.policyViolations, {
          createdAt: options.graphSnapshot.extractedAt,
        })
      : [],
  );
}

export function mergeGovernanceSignals(
  ...signalGroups: GovernanceSignal[][]
): GovernanceSignal[] {
  const dedupedSignals = new Map<string, GovernanceSignal>();

  for (const signal of signalGroups.flat()) {
    if (!dedupedSignals.has(signal.id)) {
      dedupedSignals.set(signal.id, signal);
    }
  }

  return [...dedupedSignals.values()].sort(compareSignals);
}

function mapConformanceFindingToSignal(
  finding: GovernanceConformanceFinding,
  extractedAt: string,
): GovernanceSignal {
  const relatedNodeIds = normalizeRelatedIds(finding.relatedNodeIds);
  const relatedRelationIds = normalizeRelatedIds(finding.relatedRelationIds);

  return finalizeSignal({
    type: 'conformance-violation',
    nodeId: normalizeText(finding.nodeId),
    relationId: normalizeText(finding.relationId),
    relatedNodeIds,
    relatedRelationIds,
    severity: finding.severity,
    category: finding.category,
    message: finding.message,
    metadata: {
      ...(finding.ruleId ? { ruleId: finding.ruleId } : {}),
      ...(finding.metadata ? finding.metadata : {}),
    },
    source: 'conformance',
    createdAt: extractedAt,
  });
}

function mapViolationToPolicySignal(
  violation: Violation,
  createdAt: string,
): GovernanceSignal[] {
  const ruleMapping = mapPolicyRuleToSignalDescriptor(violation.ruleId);
  if (!ruleMapping) {
    return [];
  }

  const details = asRecord(violation.details);
  const nodeId = normalizeText(violation.reference?.nodeId);
  const relationId = normalizeText(violation.reference?.relationId);
  const relatedNodeIds = normalizeRelatedIds([
    nodeId,
    ...(violation.reference?.relatedNodeIds ?? []),
  ]);
  const relatedRelationIds = normalizeRelatedIds([
    relationId,
    ...(violation.reference?.relatedRelationIds ?? []),
  ]);

  return [
    finalizeSignal({
      type: ruleMapping.type,
      nodeId,
      relationId,
      relatedNodeIds,
      relatedRelationIds,
      severity: violation.severity,
      category: ruleMapping.category,
      message: violation.message,
      metadata: {
        ruleId: violation.ruleId,
        ...(details ?? {}),
        ...(violation.recommendation
          ? { recommendation: violation.recommendation }
          : {}),
      },
      source: 'policy',
      sourcePluginId: violation.sourcePluginId,
      createdAt,
      identityKey: [
        violation.ruleId,
        nodeId ?? '',
        relationId ?? '',
        relatedNodeIds.join(','),
        relatedRelationIds.join(','),
        violation.message,
      ].join('|'),
    }),
  ];
}

function isAllowedCrossDomainDependencySignal(
  relation: GovernanceGraphSnapshotRelation,
  sourceDomain: string,
  targetDomain: string,
  options: BuildGovernanceGraphSignalsOptions,
): boolean {
  const allowedDomainDependencies = options.allowedDomainDependencies;

  if (!allowedDomainDependencies || !isDependencyRelation(relation)) {
    return false;
  }

  return isAllowedDomainDependency(
    allowedDomainDependencies,
    sourceDomain,
    targetDomain,
  );
}

function mapPolicyRuleToSignalDescriptor(ruleId: string): {
  type: GovernanceSignalType;
  category: GovernanceSignalCategory;
} | null {
  switch (ruleId) {
    case 'domain-boundary':
      return {
        type: 'domain-boundary-violation',
        category: 'boundary',
      };
    case 'layer-boundary':
      return {
        type: 'layer-boundary-violation',
        category: 'boundary',
      };
    case 'ownership-presence':
      return {
        type: 'ownership-gap',
        category: 'ownership',
      };
    case 'documentation-gap':
      return {
        type: 'documentation-gap',
        category: 'documentation',
      };
    case 'project-name-convention':
      return {
        type: 'node-name-convention-violation',
        category: 'convention',
      };
    case 'tag-convention':
      return {
        type: 'tag-convention-violation',
        category: 'metadata',
      };
    case 'missing-domain':
      return {
        type: 'missing-domain-violation',
        category: 'metadata',
      };
    case 'missing-layer':
      return {
        type: 'missing-layer-violation',
        category: 'metadata',
      };
    default:
      return null;
  }
}

function finalizeSignal(draft: SignalDraft): GovernanceSignal {
  const relatedNodeIds = normalizeRelatedIds(draft.relatedNodeIds ?? []);
  const relatedRelationIds = normalizeRelatedIds(
    draft.relatedRelationIds ?? [],
  );
  const payload = {
    type: draft.type,
    nodeId: normalizeText(draft.nodeId),
    relationId: normalizeText(draft.relationId),
    relatedNodeIds,
    relatedRelationIds,
    severity: draft.severity,
    category: draft.category,
    message: draft.message,
    metadata: normalizeMetadata(draft.metadata),
    source: draft.source,
    sourcePluginId: normalizeText(draft.sourcePluginId),
    createdAt: normalizeCreatedAt(draft.createdAt),
  };

  return {
    id: `${SIGNAL_ID_PREFIX}${hashSignalIdentity(draft.identityKey ?? payload)}`,
    type: payload.type,
    ...(payload.nodeId ? { nodeId: payload.nodeId } : {}),
    ...(payload.relationId ? { relationId: payload.relationId } : {}),
    ...(payload.relatedNodeIds.length > 0
      ? { relatedNodeIds: payload.relatedNodeIds }
      : {}),
    ...(payload.relatedRelationIds.length > 0
      ? { relatedRelationIds: payload.relatedRelationIds }
      : {}),
    severity: payload.severity,
    category: payload.category,
    message: payload.message,
    ...(payload.metadata ? { metadata: payload.metadata } : {}),
    source: payload.source,
    ...(payload.sourcePluginId
      ? { sourcePluginId: payload.sourcePluginId }
      : {}),
    createdAt: payload.createdAt,
  };
}

function hashSignalIdentity(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 12);
}

function normalizeCreatedAt(value: string): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : new Date(0).toISOString();
}

function normalizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  const entries = Object.entries(metadata)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeRelatedIds(ids: (string | undefined)[]): string[] {
  return [...new Set(ids.map(normalizeText).filter(isPresent))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isDependencyRelation(
  relation: GovernanceGraphSnapshotRelation,
): boolean {
  const kind = normalizeText(relation.kind);
  return kind === undefined || kind === 'dependency';
}

function compareSignals(
  left: GovernanceSignal,
  right: GovernanceSignal,
): number {
  const sourceOrder =
    SOURCE_SORT_ORDER[left.source] - SOURCE_SORT_ORDER[right.source];
  if (sourceOrder !== 0) {
    return sourceOrder;
  }

  const severityOrder =
    SEVERITY_SORT_ORDER[left.severity] - SEVERITY_SORT_ORDER[right.severity];
  if (severityOrder !== 0) {
    return severityOrder;
  }

  const typeComparison = left.type.localeCompare(right.type);
  if (typeComparison !== 0) {
    return typeComparison;
  }

  const scopeComparison = [
    left.nodeId ?? '',
    left.relationId ?? '',
    (left.relatedNodeIds ?? []).join(','),
    (left.relatedRelationIds ?? []).join(','),
  ]
    .join('|')
    .localeCompare(
      [
        right.nodeId ?? '',
        right.relationId ?? '',
        (right.relatedNodeIds ?? []).join(','),
        (right.relatedRelationIds ?? []).join(','),
      ].join('|'),
    );
  if (scopeComparison !== 0) {
    return scopeComparison;
  }

  return left.id.localeCompare(right.id);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readStringMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}
