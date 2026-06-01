import { createHash } from 'node:crypto';

import type { Violation } from '../model/models.js';
import type {
  GovernanceSignal,
  GovernanceSignalCategory,
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  GovernanceSignalType,
} from './signals.js';

export interface GovernanceGraphSnapshotProject {
  id: string;
  domain?: string;
}

export interface GovernanceGraphSnapshotDependency {
  sourceProjectId: string;
  targetProjectId: string;
  type?: string;
}

export interface GovernanceGraphSnapshot {
  extractedAt: string;
  projects: GovernanceGraphSnapshotProject[];
  dependencies: GovernanceGraphSnapshotDependency[];
}

export interface GovernanceConformanceFinding {
  ruleId?: string;
  projectId?: string;
  relatedProjectIds: string[];
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
  conformanceSnapshot?: GovernanceConformanceSnapshot;
  policyViolations?: Violation[];
}

interface SignalDraft {
  type: GovernanceSignalType;
  sourceProjectId?: string;
  targetProjectId?: string;
  relatedProjectIds: string[];
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
): GovernanceSignal[] {
  const projectsById = new Map(
    snapshot.projects.map((project) => [project.id, project] as const),
  );
  const signals: GovernanceSignal[] = [];

  for (const dependency of snapshot.dependencies) {
    const sourceProject = projectsById.get(dependency.sourceProjectId);
    const targetProject = projectsById.get(dependency.targetProjectId);
    const sourceDomain = normalizeText(sourceProject?.domain);
    const targetDomain = normalizeText(targetProject?.domain);
    const relatedProjectIds = normalizeRelatedProjectIds([
      dependency.sourceProjectId,
      dependency.targetProjectId,
    ]);

    signals.push(
      finalizeSignal({
        type: 'structural-dependency',
        sourceProjectId: dependency.sourceProjectId,
        targetProjectId: dependency.targetProjectId,
        relatedProjectIds,
        severity: 'info',
        category: 'dependency',
        message: `Dependency: ${dependency.sourceProjectId} -> ${dependency.targetProjectId}.`,
        metadata: {
          dependencyType: dependency.type,
        },
        source: 'graph',
        createdAt: snapshot.extractedAt,
      }),
    );

    if (sourceDomain && targetDomain && sourceDomain !== targetDomain) {
      signals.push(
        finalizeSignal({
          type: 'cross-domain-dependency',
          sourceProjectId: dependency.sourceProjectId,
          targetProjectId: dependency.targetProjectId,
          relatedProjectIds,
          severity: 'warning',
          category: 'boundary',
          message: `Cross-domain dependency: ${dependency.sourceProjectId} (${sourceDomain}) -> ${dependency.targetProjectId} (${targetDomain}).`,
          metadata: {
            sourceDomain,
            targetDomain,
          },
          source: 'graph',
          createdAt: snapshot.extractedAt,
        }),
      );
    } else if (!sourceDomain || !targetDomain) {
      signals.push(
        finalizeSignal({
          type: 'missing-domain-context',
          sourceProjectId: dependency.sourceProjectId,
          targetProjectId: dependency.targetProjectId,
          relatedProjectIds,
          severity: 'warning',
          category: 'boundary',
          message: `Missing domain context for dependency: ${dependency.sourceProjectId} -> ${dependency.targetProjectId}.`,
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
    buildGovernanceGraphSignals(options.graphSnapshot),
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
  const relatedProjectIds = normalizeRelatedProjectIds(
    finding.relatedProjectIds,
  );
  const targetProjectId =
    relatedProjectIds.length === 1 ? relatedProjectIds[0] : undefined;

  return finalizeSignal({
    type: 'conformance-violation',
    sourceProjectId: finding.projectId,
    targetProjectId,
    relatedProjectIds,
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
  const targetProjectId = normalizeText(
    asString(details?.targetProject ?? details?.target),
  );
  const sourceProjectId = normalizeText(violation.project);
  const relatedProjectIds = normalizeRelatedProjectIds([
    sourceProjectId,
    targetProjectId,
  ]);

  return [
    finalizeSignal({
      type: ruleMapping.type,
      sourceProjectId,
      targetProjectId,
      relatedProjectIds,
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
        sourceProjectId ?? '',
        targetProjectId ?? '',
        violation.message,
      ].join('|'),
    }),
  ];
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
    default:
      return null;
  }
}

function finalizeSignal(draft: SignalDraft): GovernanceSignal {
  const relatedProjectIds = normalizeRelatedProjectIds(draft.relatedProjectIds);
  const payload = {
    type: draft.type,
    sourceProjectId: normalizeText(draft.sourceProjectId),
    targetProjectId: normalizeText(draft.targetProjectId),
    relatedProjectIds,
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
    ...(payload.sourceProjectId
      ? { sourceProjectId: payload.sourceProjectId }
      : {}),
    ...(payload.targetProjectId
      ? { targetProjectId: payload.targetProjectId }
      : {}),
    relatedProjectIds: payload.relatedProjectIds,
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

function normalizeRelatedProjectIds(
  projectIds: (string | undefined)[],
): string[] {
  return [...new Set(projectIds.map(normalizeText).filter(isPresent))].sort(
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
    left.sourceProjectId ?? '',
    left.targetProjectId ?? '',
    left.relatedProjectIds.join(','),
  ]
    .join('|')
    .localeCompare(
      [
        right.sourceProjectId ?? '',
        right.targetProjectId ?? '',
        right.relatedProjectIds.join(','),
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

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}
