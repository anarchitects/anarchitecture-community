import type { DbtGovernanceMetadataResolution } from './resolvers.js';

const DBT_EVIDENCE_RESOURCE_TYPES = new Set(['test']);
const DBT_PUBLIC_MODEL_DOCUMENTATION_RESOURCE_TYPES = new Set(['model']);
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

export function isDbtGovernedAssetResolution(
  resolution: DbtGovernanceMetadataResolution,
): boolean {
  const resourceType = getDbtResolutionResourceType(resolution);

  if (resourceType === undefined) {
    return !isDbtEvidenceResource(resolution);
  }

  return DBT_GOVERNED_ASSET_RESOURCE_TYPES.has(resourceType);
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
