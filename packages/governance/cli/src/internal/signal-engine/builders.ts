import { createHash } from 'node:crypto';

import type { Violation } from '@anarchitects/governance-core';
import type {
  GovernanceSignal,
  GovernanceSignalCategory,
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  GovernanceSignalType,
} from './types.js';

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
  conformanceSnapshot: GovernanceConformanceSnapshot;
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

export function buildGraphSignals(
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
      continue;
    }

    if (!sourceDomain || !targetDomain) {
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

export function buildConformanceSignals(
  snapshot: GovernanceConformanceSnapshot,
): GovernanceSignal[] {
  return snapshot.findings
    .map((finding) =>
      mapConformanceFindingToSignal(finding, snapshot.extractedAt),
    )
    .sort(compareSignals);
}

export function buildGovernanceSignals(
  options: BuildGovernanceSignalsOptions,
): GovernanceSignal[] {
  return mergeGovernanceSignals(
    buildGraphSignals(options.graphSnapshot),
    buildConformanceSignals(options.conformanceSnapshot),
  );
}

export interface BuildPolicySignalsOptions {
  createdAt?: string;
}

export function buildPolicySignals(
  violations: Violation[],
  options: BuildPolicySignalsOptions = {},
): GovernanceSignal[] {
  const createdAt = options.createdAt ?? new Date().toISOString();

  return violations
    .flatMap((violation) => mapViolationToPolicySignal(violation, createdAt))
    .sort(compareSignals);
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
    metadata: finding.metadata ? { ...finding.metadata } : undefined,
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
  const targetProjectId = normalizeText(asString(details?.targetProject));
  const sourceProjectId = normalizeText(violation.project);
  const relatedProjectIds = normalizeRelatedProjectIds([
    sourceProjectId,
    targetProjectId,
  ]);

  const metadata: Record<string, unknown> = {
    ruleId: violation.ruleId,
    ...(details ?? {}),
    ...(violation.recommendation
      ? { recommendation: violation.recommendation }
      : {}),
  };

  return [
    finalizeSignal({
      type: ruleMapping.type,
      sourceProjectId,
      targetProjectId,
      relatedProjectIds,
      severity: violation.severity,
      category: ruleMapping.category,
      message: violation.message,
      metadata,
      source: 'policy',
      sourcePluginId: violation.sourcePluginId,
      createdAt,
      identityKey: [
        'policy',
        violation.ruleId,
        sourceProjectId ?? '',
        targetProjectId ?? '',
        violation.severity,
        relatedProjectIds.join(','),
      ].join('|'),
    }),
  ];
}

function finalizeSignal(draft: SignalDraft): GovernanceSignal {
  const normalizedSourceProjectId = normalizeText(draft.sourceProjectId);
  const normalizedTargetProjectId = normalizeText(draft.targetProjectId);
  const normalizedRelatedProjectIds = normalizeRelatedProjectIds(
    draft.relatedProjectIds,
  );
  const metadata =
    draft.metadata && Object.keys(draft.metadata).length > 0
      ? { ...draft.metadata }
      : undefined;

  return {
    id: buildSignalId({
      source: draft.source,
      type: draft.type,
      category: draft.category,
      sourceProjectId: normalizedSourceProjectId,
      targetProjectId: normalizedTargetProjectId,
      message: draft.message,
      relatedProjectIds: normalizedRelatedProjectIds,
      identityKey: draft.identityKey,
    }),
    type: draft.type,
    sourceProjectId: normalizedSourceProjectId,
    targetProjectId: normalizedTargetProjectId,
    relatedProjectIds: normalizedRelatedProjectIds,
    severity: draft.severity,
    category: draft.category,
    message: draft.message,
    metadata,
    source: draft.source,
    sourcePluginId: draft.sourcePluginId,
    createdAt: draft.createdAt,
  };
}

function normalizeRelatedProjectIds(
  values: Array<string | undefined>,
): string[] {
  return [
    ...new Set(
      values.map(normalizeText).filter((value): value is string => !!value),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function buildSignalId(input: {
  source: GovernanceSignalSource;
  type: GovernanceSignalType;
  category: GovernanceSignalCategory;
  sourceProjectId?: string;
  targetProjectId?: string;
  message: string;
  relatedProjectIds: string[];
  identityKey?: string;
}): string {
  const seed =
    input.identityKey ??
    [
      input.source,
      input.type,
      input.category,
      input.sourceProjectId ?? '',
      input.targetProjectId ?? '',
      input.message,
      input.relatedProjectIds.join(','),
    ].join('|');

  const hash = createHash('sha256').update(seed).digest('hex').slice(0, 16);
  return `${SIGNAL_ID_PREFIX}${hash}`;
}

function compareSignals(a: GovernanceSignal, b: GovernanceSignal): number {
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

  return a.id.localeCompare(b.id);
}

function normalizeText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mapPolicyRuleToSignalDescriptor(
  ruleId: string,
): { type: GovernanceSignalType; category: GovernanceSignalCategory } | null {
  if (ruleId === 'domain-boundary') {
    return {
      type: 'domain-boundary-violation',
      category: 'boundary',
    };
  }

  if (ruleId === 'layer-boundary') {
    return {
      type: 'layer-boundary-violation',
      category: 'boundary',
    };
  }

  if (ruleId === 'ownership-presence') {
    return {
      type: 'ownership-gap',
      category: 'ownership',
    };
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
