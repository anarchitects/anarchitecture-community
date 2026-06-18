import type { DbtGovernanceMetadataResolution } from './resolvers.js';

const DBT_EVIDENCE_RESOURCE_TYPES = new Set(['test']);
const DBT_WORKSPACE_CONTEXT_RESOURCE_TYPES = new Set(['project']);
const DBT_PUBLIC_MODEL_DOCUMENTATION_RESOURCE_TYPES = new Set(['model']);
const DBT_OWNERSHIP_RESOURCE_TYPES = new Set(['model', 'source']);
const DBT_GOVERNED_ASSET_RESOURCE_TYPES = new Set([
  'model',
  'seed',
  'snapshot',
  'source',
  'exposure',
  'metric',
  'semantic_model',
  'saved_query',
]);
const DBT_TEST_COVERAGE_RESOURCE_TYPES = new Set(['model', 'source']);

export function getDbtResolutionResourceType(
  resolution: DbtGovernanceMetadataResolution,
): string | undefined {
  const explicitResourceType = normalizeResourceType(resolution.resourceType);
  if (explicitResourceType) {
    return explicitResourceType;
  }

  return (
    inferDbtResourceTypeFromId(resolution.dbtUniqueId) ??
    inferDbtResourceTypeFromId(resolution.governanceNodeId)
  );
}

export function isDbtEvidenceResource(
  resolution: DbtGovernanceMetadataResolution,
): boolean {
  const resourceType = getDbtResolutionResourceType(resolution);
  return (
    resourceType !== undefined && DBT_EVIDENCE_RESOURCE_TYPES.has(resourceType)
  );
}

export function isDbtWorkspaceContextResource(
  resolution: DbtGovernanceMetadataResolution,
): boolean {
  const resourceType = getDbtResolutionResourceType(resolution);
  return (
    resourceType !== undefined &&
    DBT_WORKSPACE_CONTEXT_RESOURCE_TYPES.has(resourceType)
  );
}

export function isDbtGovernedAssetResolution(
  resolution: DbtGovernanceMetadataResolution,
): boolean {
  const resourceType = getDbtResolutionResourceType(resolution);

  if (resourceType === undefined) {
    return !isDbtEvidenceResource(resolution);
  }

  return DBT_GOVERNED_ASSET_RESOURCE_TYPES.has(resourceType);
}

export function isDbtOwnershipResourceType(
  resourceType: string | undefined,
): boolean {
  return (
    resourceType !== undefined && DBT_OWNERSHIP_RESOURCE_TYPES.has(resourceType)
  );
}

export function isDbtOwnershipTarget(
  resolution: DbtGovernanceMetadataResolution,
): boolean {
  return isDbtOwnershipResourceType(getDbtResolutionResourceType(resolution));
}

export function isDbtTestCoverageResourceType(
  resourceType: string | undefined,
): boolean {
  return (
    resourceType !== undefined &&
    DBT_TEST_COVERAGE_RESOURCE_TYPES.has(resourceType)
  );
}

export function isDbtTestCoverageTarget(
  resolution: DbtGovernanceMetadataResolution,
): boolean {
  return isDbtTestCoverageResourceType(
    getDbtResolutionResourceType(resolution),
  );
}

export function isDbtDocumentationTarget(
  resolution: DbtGovernanceMetadataResolution,
): boolean {
  return isDbtGovernedAssetResolution(resolution);
}

export function isDbtPublicModelDocumentationTarget(
  resolution: DbtGovernanceMetadataResolution,
): boolean {
  const resourceType = getDbtResolutionResourceType(resolution);

  if (resourceType === undefined) {
    return !isDbtEvidenceResource(resolution);
  }

  return DBT_PUBLIC_MODEL_DOCUMENTATION_RESOURCE_TYPES.has(resourceType);
}

export function isDbtContractTarget(
  resolution: DbtGovernanceMetadataResolution,
): boolean {
  const resourceType = getDbtResolutionResourceType(resolution);

  return isDbtGovernedAssetResolution(resolution) && resourceType !== 'source';
}

export function isDbtDagShapeTarget(
  resolution: DbtGovernanceMetadataResolution,
): boolean {
  return (
    !isDbtEvidenceResource(resolution) &&
    !isDbtWorkspaceContextResource(resolution)
  );
}

function normalizeResourceType(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function inferDbtResourceTypeFromId(
  id: string | undefined,
): string | undefined {
  if (!id) {
    return undefined;
  }

  if (id.startsWith('model.')) return 'model';
  if (id.startsWith('source.')) return 'source';
  if (id.startsWith('seed.')) return 'seed';
  if (id.startsWith('snapshot.')) return 'snapshot';
  if (id.startsWith('exposure.')) return 'exposure';
  if (id.startsWith('test.')) return 'test';
  if (id.startsWith('metric.')) return 'metric';
  if (id.startsWith('semantic_model.')) return 'semantic_model';
  if (id.startsWith('saved_query.')) return 'saved_query';
  if (id.startsWith('dbt.project.')) return 'project';

  return undefined;
}
