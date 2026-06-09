import type { GovernanceConformanceCategory } from '../evaluation/signals.js';

export type GovernanceExceptionSource = 'policy' | 'conformance';

export interface GovernanceExceptionReview {
  createdAt?: string;
  reviewBy?: string;
  expiresAt?: string;
}

export interface GovernancePolicyExceptionScope {
  source: 'policy';
  ruleId: string;
  nodeId?: string;
  relationId?: string;
  relatedNodeIds?: string[];
  relatedRelationIds?: string[];
}

export interface GovernanceConformanceExceptionScope {
  source: 'conformance';
  ruleId?: string;
  category?: GovernanceConformanceCategory;
  nodeId?: string;
  relationId?: string;
  relatedNodeIds?: string[];
  relatedRelationIds?: string[];
}

export type GovernanceExceptionScope =
  | GovernancePolicyExceptionScope
  | GovernanceConformanceExceptionScope;

export interface GovernanceException {
  id: string;
  source: GovernanceExceptionSource;
  scope: GovernanceExceptionScope;
  reason: string;
  owner: string;
  review: GovernanceExceptionReview;
}

export function normalizeGovernanceException(
  exception: GovernanceException,
): GovernanceException {
  const id = normalizeRequiredString(exception.id, 'Exception id');
  const source = normalizeExceptionSource(exception.source);
  const reason = normalizeRequiredString(exception.reason, 'Exception reason');
  const owner = normalizeRequiredString(exception.owner, 'Exception owner');
  const review = normalizeGovernanceExceptionReview(exception.review);
  const scope = normalizeGovernanceExceptionScope(exception.scope);

  if (scope.source !== source) {
    throw new Error(
      `Exception "${id}" has source "${source}" but scope source "${scope.source}".`,
    );
  }

  return {
    id,
    source,
    scope,
    reason,
    owner,
    review,
  };
}

export function buildGovernanceExceptionScopeKey(
  scope: GovernanceExceptionScope,
): string {
  const normalizedScope = normalizeGovernanceExceptionScope(scope);

  if (isPolicyExceptionScope(normalizedScope)) {
    return [
      normalizedScope.source,
      normalizedScope.ruleId,
      normalizedScope.nodeId ?? '',
      normalizedScope.relationId ?? '',
      (normalizedScope.relatedNodeIds ?? []).join(','),
      (normalizedScope.relatedRelationIds ?? []).join(','),
    ].join('|');
  }

  return [
    normalizedScope.source,
    normalizedScope.ruleId ?? '',
    normalizedScope.category ?? '',
    normalizedScope.nodeId ?? '',
    normalizedScope.relationId ?? '',
    (normalizedScope.relatedNodeIds ?? []).join(','),
    (normalizedScope.relatedRelationIds ?? []).join(','),
  ].join('|');
}

export function isPolicyExceptionScope(
  scope: GovernanceExceptionScope,
): scope is GovernancePolicyExceptionScope {
  return scope.source === 'policy';
}

export function isConformanceExceptionScope(
  scope: GovernanceExceptionScope,
): scope is GovernanceConformanceExceptionScope {
  return scope.source === 'conformance';
}

function normalizeGovernanceExceptionReview(
  review: GovernanceExceptionReview,
): GovernanceExceptionReview {
  const createdAt = normalizeOptionalString(review.createdAt);
  const reviewBy = normalizeOptionalString(review.reviewBy);
  const expiresAt = normalizeOptionalString(review.expiresAt);

  if (!reviewBy && !expiresAt) {
    throw new Error(
      'Governance exception review must define reviewBy or expiresAt.',
    );
  }

  return {
    ...(createdAt ? { createdAt } : {}),
    ...(reviewBy ? { reviewBy } : {}),
    ...(expiresAt ? { expiresAt } : {}),
  };
}

function normalizeGovernanceExceptionScope(
  scope: GovernanceExceptionScope,
): GovernanceExceptionScope {
  if (scope.source === 'policy') {
    const nodeId = normalizeOptionalString(scope.nodeId);
    const relationId = normalizeOptionalString(scope.relationId);
    const relatedNodeIds = normalizeRelatedIds(scope.relatedNodeIds);
    const relatedRelationIds = normalizeRelatedIds(scope.relatedRelationIds);

    if (
      !nodeId &&
      !relationId &&
      relatedNodeIds.length === 0 &&
      relatedRelationIds.length === 0
    ) {
      throw new Error(
        'Policy exception scope must define nodeId, relationId, relatedNodeIds, or relatedRelationIds.',
      );
    }

    return {
      source: 'policy',
      ruleId: normalizeRequiredString(scope.ruleId, 'Policy exception ruleId'),
      ...(nodeId ? { nodeId } : {}),
      ...(relationId ? { relationId } : {}),
      ...(relatedNodeIds.length > 0 ? { relatedNodeIds } : {}),
      ...(relatedRelationIds.length > 0 ? { relatedRelationIds } : {}),
    };
  }

  const ruleId = normalizeOptionalString(scope.ruleId);
  const category = normalizeOptionalCategory(scope.category);
  const nodeId = normalizeOptionalString(scope.nodeId);
  const relationId = normalizeOptionalString(scope.relationId);
  const relatedNodeIds = normalizeRelatedIds(scope.relatedNodeIds);
  const relatedRelationIds = normalizeRelatedIds(scope.relatedRelationIds);

  if (
    !ruleId &&
    !category &&
    !nodeId &&
    !relationId &&
    relatedNodeIds.length === 0 &&
    relatedRelationIds.length === 0
  ) {
    throw new Error(
      'Conformance exception scope must define ruleId, category, nodeId, relationId, relatedNodeIds, or relatedRelationIds.',
    );
  }

  return {
    source: 'conformance',
    ...(ruleId ? { ruleId } : {}),
    ...(category ? { category } : {}),
    ...(nodeId ? { nodeId } : {}),
    ...(relationId ? { relationId } : {}),
    ...(relatedNodeIds.length > 0 ? { relatedNodeIds } : {}),
    ...(relatedRelationIds.length > 0 ? { relatedRelationIds } : {}),
  };
}

function normalizeExceptionSource(
  source: GovernanceExceptionSource,
): GovernanceExceptionSource {
  if (source === 'policy' || source === 'conformance') {
    return source;
  }

  throw new Error(`Unsupported governance exception source "${source}".`);
}

function normalizeRequiredString(value: string, label: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function normalizeOptionalString(
  value: string | undefined,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeRelatedIds(relatedIds: string[] | undefined): string[] {
  if (!Array.isArray(relatedIds)) {
    return [];
  }

  return [
    ...new Set(
      relatedIds
        .map(normalizeOptionalString)
        .filter((value): value is string => !!value),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function normalizeOptionalCategory(
  category: GovernanceConformanceCategory | undefined,
): GovernanceConformanceCategory | undefined {
  return normalizeOptionalString(category) as
    | GovernanceConformanceCategory
    | undefined;
}
