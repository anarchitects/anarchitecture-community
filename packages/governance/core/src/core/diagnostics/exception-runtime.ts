import type {
  GovernanceExceptionFinding,
  GovernanceExceptionReport,
  GovernanceExceptionStatus,
  GovernanceExceptionUsage,
  Violation,
} from '../model/models.js';
import {
  type GovernanceConformanceExceptionScope,
  type GovernanceException,
  type GovernancePolicyExceptionScope,
  buildGovernanceExceptionScopeKey,
  isConformanceExceptionScope,
  isPolicyExceptionScope,
} from './exceptions.js';
import type { GovernanceConformanceFinding } from '../evaluation/signal-builders.js';

export interface GovernanceExceptionLifecycle {
  exception: GovernanceException;
  status: GovernanceExceptionStatus;
}

export interface GovernanceExceptionMatch {
  exceptionId: string;
  scopeKey: string;
  specificity: number;
}

export interface GovernanceAppliedFinding<T> {
  finding: T;
  outcome: 'active' | 'suppressed';
  matchedExceptionId?: string;
  matchedExceptionStatus?: GovernanceExceptionStatus;
}

export interface GovernanceSuppressedFinding<T> {
  finding: T;
  outcome: 'suppressed';
  matchedExceptionId: string;
}

export interface GovernanceExceptionApplicationResult {
  declaredExceptions: GovernanceException[];
  exceptionStatuses: Record<string, GovernanceExceptionStatus>;
  policyViolations: GovernanceAppliedFinding<Violation>[];
  conformanceFindings: GovernanceAppliedFinding<GovernanceConformanceFinding>[];
  activePolicyViolations: Violation[];
  suppressedPolicyViolations: GovernanceSuppressedFinding<Violation>[];
  reactivatedPolicyViolations: GovernanceAppliedFinding<Violation>[];
  activeConformanceFindings: GovernanceConformanceFinding[];
  suppressedConformanceFindings: GovernanceSuppressedFinding<GovernanceConformanceFinding>[];
  reactivatedConformanceFindings: GovernanceAppliedFinding<GovernanceConformanceFinding>[];
}

export interface ApplyGovernanceExceptionsInput {
  exceptions: GovernanceException[];
  policyViolations: Violation[];
  conformanceFindings: GovernanceConformanceFinding[];
  asOf: Date;
}

const SOURCE_ORDER = {
  policy: 0,
  conformance: 1,
} as const;

const SEVERITY_ORDER = {
  error: 0,
  warning: 1,
  info: 2,
} as const;

export function evaluateGovernanceExceptionLifecycle(
  exception: GovernanceException,
  asOf: Date,
): GovernanceExceptionLifecycle {
  const asOfMs = asOf.getTime();
  const expiresAtMs = parseLifecycleDate(exception.review.expiresAt);
  if (expiresAtMs !== undefined && expiresAtMs < asOfMs) {
    return {
      exception,
      status: 'expired',
    };
  }

  const reviewByMs = parseLifecycleDate(exception.review.reviewBy);
  if (reviewByMs !== undefined && reviewByMs < asOfMs) {
    return {
      exception,
      status: 'stale',
    };
  }

  return {
    exception,
    status: 'active',
  };
}

export function applyGovernanceExceptions(
  input: ApplyGovernanceExceptionsInput,
): GovernanceExceptionApplicationResult {
  const lifecycles = input.exceptions.map((exception) =>
    evaluateGovernanceExceptionLifecycle(exception, input.asOf),
  );
  const exceptionStatuses = Object.fromEntries(
    lifecycles.map((entry) => [entry.exception.id, entry.status]),
  ) as Record<string, GovernanceExceptionStatus>;
  const activeExceptions = lifecycles
    .filter((entry) => entry.status === 'active')
    .map((entry) => entry.exception);
  const inactiveExceptions = lifecycles.filter(
    (entry) => entry.status !== 'active',
  );

  const policyViolations = input.policyViolations.map((violation) =>
    applyPolicyException(violation, activeExceptions),
  );
  const conformanceFindings = input.conformanceFindings.map((finding) =>
    applyConformanceException(finding, activeExceptions),
  );
  const reactivatedPolicyViolations = input.policyViolations
    .map((violation) =>
      findLifecycleMatchedPolicyViolation(violation, inactiveExceptions),
    )
    .filter(isPresent);
  const reactivatedConformanceFindings = input.conformanceFindings
    .map((finding) =>
      findLifecycleMatchedConformanceFinding(finding, inactiveExceptions),
    )
    .filter(isPresent);

  return {
    declaredExceptions: [...input.exceptions],
    exceptionStatuses,
    policyViolations,
    conformanceFindings,
    activePolicyViolations: policyViolations
      .filter((entry) => entry.outcome === 'active')
      .map((entry) => entry.finding),
    suppressedPolicyViolations: policyViolations.filter(isSuppressedFinding),
    reactivatedPolicyViolations,
    activeConformanceFindings: conformanceFindings
      .filter((entry) => entry.outcome === 'active')
      .map((entry) => entry.finding),
    suppressedConformanceFindings:
      conformanceFindings.filter(isSuppressedFinding),
    reactivatedConformanceFindings,
  };
}

export function buildGovernanceExceptionReport(
  application: GovernanceExceptionApplicationResult,
): GovernanceExceptionReport {
  const usageCounts = countMatchesByExceptionId(application);
  const activeExceptionCount = Object.values(
    application.exceptionStatuses,
  ).filter((status) => status === 'active').length;
  const staleExceptionCount = Object.values(
    application.exceptionStatuses,
  ).filter((status) => status === 'stale').length;
  const expiredExceptionCount = Object.values(
    application.exceptionStatuses,
  ).filter((status) => status === 'expired').length;
  const suppressedFindings = [
    ...application.suppressedPolicyViolations.map((entry) =>
      mapSuppressedPolicyViolation(entry),
    ),
    ...application.suppressedConformanceFindings.map((entry) =>
      mapSuppressedConformanceFinding(entry),
    ),
  ].sort(compareSuppressedFindings);
  const reactivatedFindings = [
    ...application.reactivatedPolicyViolations.map((entry) =>
      mapReactivatedPolicyViolation(entry),
    ),
    ...application.reactivatedConformanceFindings.map((entry) =>
      mapReactivatedConformanceFinding(entry),
    ),
  ].sort(compareSuppressedFindings);

  const used: GovernanceExceptionUsage[] = [];
  const unused: GovernanceExceptionUsage[] = [];

  for (const exception of [...application.declaredExceptions].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const matchCount = usageCounts.get(exception.id) ?? 0;
    const usage = {
      id: exception.id,
      source: exception.source,
      status: application.exceptionStatuses[exception.id],
      reason: exception.reason,
      owner: exception.owner,
      review: { ...exception.review },
      matchCount,
    };

    if (matchCount > 0) {
      used.push(usage);
    } else {
      unused.push(usage);
    }
  }

  return {
    summary: {
      declaredCount: application.declaredExceptions.length,
      matchedCount: used.length,
      suppressedPolicyViolationCount:
        application.suppressedPolicyViolations.length,
      suppressedConformanceFindingCount:
        application.suppressedConformanceFindings.length,
      unusedExceptionCount: unused.length,
      activeExceptionCount,
      staleExceptionCount,
      expiredExceptionCount,
      reactivatedPolicyViolationCount:
        application.reactivatedPolicyViolations.length,
      reactivatedConformanceFindingCount:
        application.reactivatedConformanceFindings.length,
    },
    used,
    unused,
    suppressedFindings,
    reactivatedFindings,
  };
}

export function createEmptyGovernanceExceptionReport(): GovernanceExceptionReport {
  return buildGovernanceExceptionReport(
    applyGovernanceExceptions({
      exceptions: [],
      policyViolations: [],
      conformanceFindings: [],
      asOf: new Date(0),
    }),
  );
}

function applyPolicyException(
  violation: Violation,
  exceptions: GovernanceException[],
): GovernanceAppliedFinding<Violation> {
  const bestMatch = selectBestMatch(
    exceptions
      .filter((exception) => exception.source === 'policy')
      .flatMap((exception) => {
        const match = matchPolicyException(exception.scope, violation);
        return match ? [{ ...match, exceptionId: exception.id }] : [];
      }),
  );

  if (!bestMatch) {
    return {
      finding: violation,
      outcome: 'active',
    };
  }

  return {
    finding: violation,
    outcome: 'suppressed',
    matchedExceptionId: bestMatch.exceptionId,
    matchedExceptionStatus: 'active',
  };
}

function applyConformanceException(
  finding: GovernanceConformanceFinding,
  exceptions: GovernanceException[],
): GovernanceAppliedFinding<GovernanceConformanceFinding> {
  const bestMatch = selectBestMatch(
    exceptions
      .filter((exception) => exception.source === 'conformance')
      .flatMap((exception) => {
        const match = matchConformanceException(exception.scope, finding);
        return match ? [{ ...match, exceptionId: exception.id }] : [];
      }),
  );

  if (!bestMatch) {
    return {
      finding,
      outcome: 'active',
    };
  }

  return {
    finding,
    outcome: 'suppressed',
    matchedExceptionId: bestMatch.exceptionId,
    matchedExceptionStatus: 'active',
  };
}

function findLifecycleMatchedPolicyViolation(
  violation: Violation,
  lifecycles: GovernanceExceptionLifecycle[],
): GovernanceAppliedFinding<Violation> | undefined {
  const bestMatch = selectBestMatch(
    lifecycles
      .filter((entry) => entry.exception.source === 'policy')
      .flatMap((entry) => {
        const match = matchPolicyException(entry.exception.scope, violation);
        return match
          ? [
              {
                ...match,
                exceptionId: entry.exception.id,
                status: entry.status,
              },
            ]
          : [];
      }),
  );

  if (!bestMatch || bestMatch.status === 'active') {
    return undefined;
  }

  return {
    finding: violation,
    outcome: 'active',
    matchedExceptionId: bestMatch.exceptionId,
    matchedExceptionStatus: bestMatch.status,
  };
}

function findLifecycleMatchedConformanceFinding(
  finding: GovernanceConformanceFinding,
  lifecycles: GovernanceExceptionLifecycle[],
): GovernanceAppliedFinding<GovernanceConformanceFinding> | undefined {
  const bestMatch = selectBestMatch(
    lifecycles
      .filter((entry) => entry.exception.source === 'conformance')
      .flatMap((entry) => {
        const match = matchConformanceException(entry.exception.scope, finding);
        return match
          ? [
              {
                ...match,
                exceptionId: entry.exception.id,
                status: entry.status,
              },
            ]
          : [];
      }),
  );

  if (!bestMatch || bestMatch.status === 'active') {
    return undefined;
  }

  return {
    finding,
    outcome: 'active',
    matchedExceptionId: bestMatch.exceptionId,
    matchedExceptionStatus: bestMatch.status,
  };
}

function matchPolicyException(
  scope: GovernanceException['scope'],
  violation: Violation,
): Omit<GovernanceExceptionMatch, 'exceptionId'> | null {
  if (!isPolicyExceptionScope(scope)) {
    return null;
  }

  const reference = violation.reference;

  if (scope.ruleId !== violation.ruleId) {
    return null;
  }

  if (scope.nodeId && scope.nodeId !== normalizeText(reference?.nodeId)) {
    return null;
  }

  if (
    scope.relationId &&
    scope.relationId !== normalizeText(reference?.relationId)
  ) {
    return null;
  }

  if (
    scope.relatedNodeIds &&
    !areEqualRelatedIds(scope.relatedNodeIds, reference?.relatedNodeIds ?? [])
  ) {
    return null;
  }

  if (
    scope.relatedRelationIds &&
    !areEqualRelatedIds(
      scope.relatedRelationIds,
      reference?.relatedRelationIds ?? [],
    )
  ) {
    return null;
  }

  return {
    scopeKey: buildGovernanceExceptionScopeKey(scope),
    specificity: getPolicySpecificity(scope),
  };
}

function matchConformanceException(
  scope: GovernanceException['scope'],
  finding: GovernanceConformanceFinding,
): Omit<GovernanceExceptionMatch, 'exceptionId'> | null {
  if (!isConformanceExceptionScope(scope)) {
    return null;
  }

  if (scope.ruleId && scope.ruleId !== finding.ruleId) {
    return null;
  }

  if (scope.category && scope.category !== finding.category) {
    return null;
  }

  if (scope.nodeId && scope.nodeId !== finding.nodeId) {
    return null;
  }

  if (scope.relationId && scope.relationId !== finding.relationId) {
    return null;
  }

  if (
    scope.relatedNodeIds &&
    !areEqualRelatedIds(scope.relatedNodeIds, finding.relatedNodeIds)
  ) {
    return null;
  }

  if (
    scope.relatedRelationIds &&
    !areEqualRelatedIds(scope.relatedRelationIds, finding.relatedRelationIds)
  ) {
    return null;
  }

  return {
    scopeKey: buildGovernanceExceptionScopeKey(scope),
    specificity: getConformanceSpecificity(scope),
  };
}

function selectBestMatch(
  matches: (GovernanceExceptionMatch & {
    status?: GovernanceExceptionStatus;
  })[],
):
  | (GovernanceExceptionMatch & {
      status?: GovernanceExceptionStatus;
    })
  | null {
  if (matches.length === 0) {
    return null;
  }

  return [...matches].sort(compareExceptionMatches)[0] ?? null;
}

function compareExceptionMatches(
  left: GovernanceExceptionMatch,
  right: GovernanceExceptionMatch,
): number {
  if (left.specificity !== right.specificity) {
    return right.specificity - left.specificity;
  }

  const scopeComparison = left.scopeKey.localeCompare(right.scopeKey);
  if (scopeComparison !== 0) {
    return scopeComparison;
  }

  return left.exceptionId.localeCompare(right.exceptionId);
}

function getPolicySpecificity(scope: GovernancePolicyExceptionScope): number {
  return [
    scope.nodeId,
    scope.relationId,
    scope.relatedNodeIds?.length ? 'relatedNodeIds' : undefined,
    scope.relatedRelationIds?.length ? 'relatedRelationIds' : undefined,
  ].filter(Boolean).length;
}

function getConformanceSpecificity(
  scope: GovernanceConformanceExceptionScope,
): number {
  return [
    scope.ruleId,
    scope.category,
    scope.nodeId,
    scope.relationId,
    scope.relatedNodeIds?.length ? 'relatedNodeIds' : undefined,
    scope.relatedRelationIds?.length ? 'relatedRelationIds' : undefined,
  ].filter(Boolean).length;
}

function areEqualRelatedIds(left: string[], right: string[]): boolean {
  const normalizedLeft = normalizeRelatedIds(left);
  const normalizedRight = normalizeRelatedIds(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((id, index) => id === normalizedRight[index]);
}

function normalizeRelatedIds(ids: (string | undefined)[]): string[] {
  return [...new Set(ids.map(normalizeText).filter(isPresent))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function countMatchesByExceptionId(
  application: GovernanceExceptionApplicationResult,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const entry of [
    ...application.suppressedPolicyViolations,
    ...application.suppressedConformanceFindings,
    ...application.reactivatedPolicyViolations.filter(
      (finding) => typeof finding.matchedExceptionId === 'string',
    ),
    ...application.reactivatedConformanceFindings.filter(
      (finding) => typeof finding.matchedExceptionId === 'string',
    ),
  ]) {
    if (entry.matchedExceptionId) {
      counts.set(
        entry.matchedExceptionId,
        (counts.get(entry.matchedExceptionId) ?? 0) + 1,
      );
    }
  }

  return counts;
}

function mapSuppressedPolicyViolation(
  entry: GovernanceSuppressedFinding<Violation>,
): GovernanceExceptionFinding {
  const reference = entry.finding.reference;
  const nodeId = normalizeText(reference?.nodeId);
  const relationId = normalizeText(reference?.relationId);
  const relatedNodeIds = normalizeRelatedIds([
    nodeId,
    ...(reference?.relatedNodeIds ?? []),
  ]);
  const relatedRelationIds = normalizeRelatedIds([
    relationId,
    ...(reference?.relatedRelationIds ?? []),
  ]);

  return {
    kind: 'policy-violation',
    exceptionId: entry.matchedExceptionId,
    source: 'policy',
    ruleId: entry.finding.ruleId,
    category: entry.finding.category,
    severity: entry.finding.severity,
    status: 'active',
    ...(nodeId ? { nodeId } : {}),
    ...(relationId ? { relationId } : {}),
    relatedNodeIds,
    relatedRelationIds,
    message: entry.finding.message,
    ...(entry.finding.sourcePluginId
      ? { sourcePluginId: entry.finding.sourcePluginId }
      : {}),
  };
}

function mapSuppressedConformanceFinding(
  entry: GovernanceSuppressedFinding<GovernanceConformanceFinding>,
): GovernanceExceptionFinding {
  return {
    kind: 'conformance-finding',
    exceptionId: entry.matchedExceptionId,
    source: 'conformance',
    ...(entry.finding.ruleId ? { ruleId: entry.finding.ruleId } : {}),
    category: entry.finding.category,
    severity: entry.finding.severity,
    status: 'active',
    ...(entry.finding.nodeId ? { nodeId: entry.finding.nodeId } : {}),
    ...(entry.finding.relationId
      ? { relationId: entry.finding.relationId }
      : {}),
    relatedNodeIds: [...entry.finding.relatedNodeIds].sort((a, b) =>
      a.localeCompare(b),
    ),
    relatedRelationIds: [...entry.finding.relatedRelationIds].sort((a, b) =>
      a.localeCompare(b),
    ),
    message: entry.finding.message,
    ...(normalizeText(entry.finding.metadata?.sourcePluginId)
      ? {
          sourcePluginId: normalizeText(entry.finding.metadata?.sourcePluginId),
        }
      : {}),
  };
}

function mapReactivatedPolicyViolation(
  entry: GovernanceExceptionApplicationResult['reactivatedPolicyViolations'][number],
): GovernanceExceptionFinding {
  const reference = entry.finding.reference;
  const nodeId = normalizeText(reference?.nodeId);
  const relationId = normalizeText(reference?.relationId);
  const relatedNodeIds = normalizeRelatedIds([
    nodeId,
    ...(reference?.relatedNodeIds ?? []),
  ]);
  const relatedRelationIds = normalizeRelatedIds([
    relationId,
    ...(reference?.relatedRelationIds ?? []),
  ]);

  return {
    kind: 'policy-violation',
    exceptionId: entry.matchedExceptionId ?? 'unknown-exception',
    source: 'policy',
    status: entry.matchedExceptionStatus ?? 'stale',
    ruleId: entry.finding.ruleId,
    category: entry.finding.category,
    severity: entry.finding.severity,
    ...(nodeId ? { nodeId } : {}),
    ...(relationId ? { relationId } : {}),
    relatedNodeIds,
    relatedRelationIds,
    message: entry.finding.message,
    ...(entry.finding.sourcePluginId
      ? { sourcePluginId: entry.finding.sourcePluginId }
      : {}),
  };
}

function mapReactivatedConformanceFinding(
  entry: GovernanceExceptionApplicationResult['reactivatedConformanceFindings'][number],
): GovernanceExceptionFinding {
  return {
    kind: 'conformance-finding',
    exceptionId: entry.matchedExceptionId ?? 'unknown-exception',
    source: 'conformance',
    status: entry.matchedExceptionStatus ?? 'stale',
    ...(entry.finding.ruleId ? { ruleId: entry.finding.ruleId } : {}),
    category: entry.finding.category,
    severity: entry.finding.severity,
    ...(entry.finding.nodeId ? { nodeId: entry.finding.nodeId } : {}),
    ...(entry.finding.relationId
      ? { relationId: entry.finding.relationId }
      : {}),
    relatedNodeIds: [...entry.finding.relatedNodeIds].sort((a, b) =>
      a.localeCompare(b),
    ),
    relatedRelationIds: [...entry.finding.relatedRelationIds].sort((a, b) =>
      a.localeCompare(b),
    ),
    message: entry.finding.message,
    ...(normalizeText(entry.finding.metadata?.sourcePluginId)
      ? {
          sourcePluginId: normalizeText(entry.finding.metadata?.sourcePluginId),
        }
      : {}),
  };
}

function compareSuppressedFindings(
  left: GovernanceExceptionFinding,
  right: GovernanceExceptionFinding,
): number {
  const sourceOrder = SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source];
  if (sourceOrder !== 0) {
    return sourceOrder;
  }

  const severityOrder =
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
  if (severityOrder !== 0) {
    return severityOrder;
  }

  const ruleComparison = (left.ruleId ?? '').localeCompare(right.ruleId ?? '');
  if (ruleComparison !== 0) {
    return ruleComparison;
  }

  const referenceScopeComparison = [
    left.nodeId ?? '',
    left.relationId ?? '',
    left.relatedNodeIds.join(','),
    left.relatedRelationIds.join(','),
  ]
    .join('|')
    .localeCompare(
      [
        right.nodeId ?? '',
        right.relationId ?? '',
        right.relatedNodeIds.join(','),
        right.relatedRelationIds.join(','),
      ].join('|'),
    );
  if (referenceScopeComparison !== 0) {
    return referenceScopeComparison;
  }

  return left.message.localeCompare(right.message);
}

function parseLifecycleDate(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.includes('T') ? value : `${value}T00:00:00.000Z`;
  const timestamp = Date.parse(normalized);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid governance exception lifecycle date "${value}".`);
  }

  return timestamp;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isSuppressedFinding<T>(
  finding: GovernanceAppliedFinding<T>,
): finding is GovernanceSuppressedFinding<T> {
  return (
    finding.outcome === 'suppressed' &&
    typeof finding.matchedExceptionId === 'string'
  );
}
