import path from 'node:path';

import type {
  GovernanceClassificationInput,
  GovernanceNodeInput,
  GovernanceOwnershipInput,
  GovernanceRelationInput,
} from '@anarchitects/governance-core';

import type {
  DbtAdapterDiagnostic,
  DbtAdapterResult,
  DbtArtifacts,
  DbtManifest,
  DbtManifestResource,
  DbtProjectContext,
} from './contracts.js';
import {
  dependencyTargetNotNormalizedDiagnostic,
  incompleteDbtMetadataDiagnostic,
  missingDbtResourceIdentityDiagnostic,
  partialDbtDependencyMappingDiagnostic,
  partialDbtNormalizationDiagnostic,
  skippedDbtResourceTypeDiagnostic,
  unresolvedDbtDependencyTargetDiagnostic,
  unsupportedDbtDependencyShapeDiagnostic,
  unsupportedDbtResourceShapeDiagnostic,
} from './diagnostics.js';
import {
  buildDbtRelationExpansion,
  buildDbtResourceNodeExpansion,
  type DbtGovernanceWorkspaceSemanticResource,
  type DbtGovernanceWorkspaceTestEvidence,
  buildDbtWorkspaceExpansion,
} from './extension-normalization.js';

const SUPPORTED_RESOURCE_TYPES = new Set([
  'model',
  'seed',
  'snapshot',
  'source',
  'exposure',
  'test',
  'metric',
  'semantic_model',
  'saved_query',
]);
const CANONICAL_DBT_ASSET_RESOURCE_TYPES = new Set([
  'model',
  'seed',
  'snapshot',
  'source',
]);
const CANONICAL_DBT_SEMANTIC_ASSET_RESOURCE_TYPES = new Set([
  'metric',
  'semantic_model',
  'saved_query',
]);
const MANIFEST_RESOURCE_COLLECTION_FIELDS = [
  'nodes',
  'sources',
  'exposures',
  'metrics',
  'semantic_models',
  'unit_tests',
  'saved_queries',
] as const;
const DBT_ARTIFACT_RELATION_KIND = 'depends_on.nodes';
const DBT_MANIFEST_SOURCE = {
  id: 'dbt-manifest',
  name: 'dbt manifest',
  type: 'artifact',
} as const;

type ResourceRecord = Record<string, unknown>;
type ManifestResourceCollectionField =
  (typeof MANIFEST_RESOURCE_COLLECTION_FIELDS)[number];

interface NormalizedResource {
  node: GovernanceNodeInput;
  resourceType: string;
  resourceRole: DbtGovernanceResourceRole;
  manifestRecord: ResourceRecord;
}

interface DependencyNodeIdsResult {
  nodeIds: string[];
  unsupported: boolean;
}

interface RelationMappingResult {
  relations: GovernanceRelationInput[];
  unresolvedCount: number;
  notNormalizedCount: number;
  unsupportedCount: number;
}

type CanonicalDbtRelationKind = 'lineage' | 'exposes';

interface DbtResourceMetadataView {
  resourceMeta: ResourceRecord;
  sourceMeta?: ResourceRecord;
  resolvedGovernanceMeta?: DbtResolvedGovernanceMeta;
}

type DbtGovernanceResourceRole =
  | 'data-asset'
  | 'semantic-asset'
  | 'consumer-context'
  | 'evidence'
  | 'workspace-context';

type DbtResolvedGovernanceField =
  | 'owner'
  | 'domain'
  | 'layer'
  | 'criticality'
  | 'publicInterface'
  | 'crossDomainApproved';

type DbtResolvedGovernanceOwnerValue = string | Record<string, unknown>;

type DbtGovernanceFieldValueMap = {
  owner: DbtResolvedGovernanceOwnerValue;
  domain: string;
  layer: string;
  criticality: string;
  publicInterface: boolean;
  crossDomainApproved: boolean;
};

type DbtResolvedGovernanceProvenance =
  | 'config.meta.anarchitects.governance'
  | 'config.meta.governance'
  | 'config.meta'
  | 'table.meta.anarchitects.governance'
  | 'table.meta.governance'
  | 'table.meta'
  | 'source.meta.anarchitects.governance'
  | 'source.meta.governance'
  | 'source.meta';

type DbtResolvedGovernanceProvenanceMap = Partial<
  Record<DbtResolvedGovernanceField, DbtResolvedGovernanceProvenance>
>;

type DbtResolvedGovernanceMeta = Partial<DbtGovernanceFieldValueMap> & {
  provenance?: DbtResolvedGovernanceProvenanceMap;
};

export function normalizeDbtArtifacts(
  projectContext: DbtProjectContext,
  artifacts: DbtArtifacts,
): DbtAdapterResult {
  const diagnostics: DbtAdapterDiagnostic[] = [];
  const normalizedResourcesById = new Map<string, NormalizedResource>();
  const workspaceTestEvidence: DbtGovernanceWorkspaceTestEvidence[] = [];
  const workspaceSemanticResources: DbtGovernanceWorkspaceSemanticResource[] =
    [];
  let skippedCount = 0;
  let invalidCount = 0;

  for (const [, resource] of collectManifestResourceEntries(
    artifacts.manifest,
  )) {
    const resourceType = readManifestResourceType(resource);
    const resourceRole = getDbtGovernanceResourceRole(resourceType);

    if (!isSupportedResourceType(resourceType)) {
      const normalized = normalizeDbtManifestResource(
        resource,
        projectContext,
        undefined,
        diagnostics,
      );

      if (!normalized) {
        skippedCount += 1;
      }

      continue;
    }

    if (!resourceRole) {
      skippedCount += 1;
      continue;
    }

    if (resourceRole === 'evidence') {
      const testEvidence = normalizeDbtTestEvidence(resource, projectContext);
      if (testEvidence) {
        workspaceTestEvidence.push(testEvidence);
      }
      continue;
    }

    if (resourceRole === 'consumer-context') {
      const semanticResource = normalizeDbtSemanticResourceContext(
        resource,
        projectContext,
        resourceRole,
      );
      if (semanticResource) {
        workspaceSemanticResources.push(semanticResource);
      }
      continue;
    }

    const normalized = normalizeDbtManifestResource(
      resource,
      projectContext,
      resourceRole,
      diagnostics,
    );

    if (!normalized) {
      if (isSkippedResource(resource)) {
        skippedCount += 1;
      } else {
        invalidCount += 1;
      }
      continue;
    }

    normalizedResourcesById.set(normalized.node.id, normalized);

    if (resourceRole === 'semantic-asset') {
      const semanticResource = normalizeDbtSemanticResourceContext(
        resource,
        projectContext,
        resourceRole,
        normalized.node.id,
      );
      if (semanticResource) {
        workspaceSemanticResources.push(semanticResource);
      }
    }
  }

  if (skippedCount > 0 || invalidCount > 0) {
    diagnostics.push(
      partialDbtNormalizationDiagnostic({
        normalizedCount: normalizedResourcesById.size,
        skippedCount,
        invalidCount,
      }),
    );
  }

  const relationMapping = mapDbtRelations(
    artifacts.manifest,
    normalizedResourcesById,
    diagnostics,
  );

  if (
    relationMapping.unresolvedCount > 0 ||
    relationMapping.notNormalizedCount > 0 ||
    relationMapping.unsupportedCount > 0
  ) {
    diagnostics.push(
      partialDbtDependencyMappingDiagnostic({
        mappedCount: relationMapping.relations.length,
        unresolvedCount: relationMapping.unresolvedCount,
        notNormalizedCount: relationMapping.notNormalizedCount,
        unsupportedCount: relationMapping.unsupportedCount,
      }),
    );
  }

  const nodes = [...normalizedResourcesById.values()]
    .map((entry) => entry.node)
    .sort((left, right) => left.id.localeCompare(right.id));
  const relations = [...relationMapping.relations].sort(
    (left, right) =>
      (left.id ?? '').localeCompare(right.id ?? '') ||
      left.sourceNodeId.localeCompare(right.sourceNodeId) ||
      left.targetNodeId.localeCompare(right.targetNodeId) ||
      (left.kind ?? '').localeCompare(right.kind ?? ''),
  );

  return {
    workspaceId: `dbt:${artifacts.projectConfig.name}`,
    workspaceName: artifacts.projectConfig.name,
    workspaceRoot: projectContext.projectDir,
    nodes,
    relations,
    diagnostics: [...projectContext.diagnostics, ...diagnostics],
    extensions: {
      'governance-extension:dbt': buildDbtWorkspaceExpansion(
        projectContext,
        artifacts,
        nodes.map((node) => node.id),
        workspaceTestEvidence,
        workspaceSemanticResources,
      ),
    },
    metadata: {
      adapter: 'dbt',
      paths: projectContext.artifactPaths,
    },
  };
}

function mapDbtRelations(
  manifest: DbtManifest,
  normalizedResourcesById: ReadonlyMap<string, NormalizedResource>,
  diagnostics: DbtAdapterDiagnostic[],
): RelationMappingResult {
  const manifestResourcesById = collectManifestResources(manifest);
  const relations: GovernanceRelationInput[] = [];
  const relationKeys = new Set<string>();
  let unresolvedCount = 0;
  let notNormalizedCount = 0;
  let unsupportedCount = 0;

  for (const sourceUniqueId of [...normalizedResourcesById.keys()].sort()) {
    const sourceResource = normalizedResourcesById.get(sourceUniqueId);
    if (!sourceResource) {
      continue;
    }

    if (sourceResource.resourceRole !== 'data-asset') {
      continue;
    }

    const dependsOn = readDependsOnNodeIds(
      sourceResource.manifestRecord,
      sourceUniqueId,
      diagnostics,
    );
    if (dependsOn.unsupported) {
      unsupportedCount += 1;
      continue;
    }

    for (const targetUniqueId of [...dependsOn.nodeIds].sort()) {
      const relationKey = `${sourceUniqueId}->${targetUniqueId}`;
      if (relationKeys.has(relationKey)) {
        continue;
      }

      const targetManifestResource = manifestResourcesById.get(targetUniqueId);
      if (!targetManifestResource) {
        diagnostics.push(
          unresolvedDbtDependencyTargetDiagnostic(
            sourceUniqueId,
            targetUniqueId,
          ),
        );
        unresolvedCount += 1;
        continue;
      }

      const targetResourceType = readManifestResourceType(
        targetManifestResource,
      );
      if (getDbtGovernanceResourceRole(targetResourceType) !== 'data-asset') {
        continue;
      }

      const targetResource = normalizedResourcesById.get(targetUniqueId);
      if (!targetResource) {
        diagnostics.push(
          dependencyTargetNotNormalizedDiagnostic(
            sourceUniqueId,
            targetUniqueId,
          ),
        );
        notNormalizedCount += 1;
        continue;
      }

      relationKeys.add(relationKey);
      const relationKind = buildDbtRelationKind(sourceResource.resourceType);
      const relationMetadata = buildRelationMetadata(
        sourceUniqueId,
        sourceResource.manifestRecord,
        targetUniqueId,
        targetResource.manifestRecord,
        relationKind,
      );
      relations.push({
        id: buildDbtRelationId(sourceUniqueId, targetUniqueId, relationKind),
        sourceNodeId: sourceUniqueId,
        targetNodeId: targetUniqueId,
        kind: toCanonicalRelationKind(relationKind),
        source: DBT_MANIFEST_SOURCE,
        authority: 'discovered',
        confidence: 1,
        extensions: {
          'governance-extension:dbt': buildDbtRelationExpansion(
            relationKind,
            relationMetadata.dbt as Record<string, unknown>,
          ),
        },
        metadata: {},
      });
    }
  }

  return {
    relations,
    unresolvedCount,
    notNormalizedCount,
    unsupportedCount,
  };
}

function buildRelationMetadata(
  sourceUniqueId: string,
  sourceResource: ResourceRecord,
  targetUniqueId: string,
  targetResource: ResourceRecord,
  relationKind: CanonicalDbtRelationKind,
): Record<string, unknown> {
  const targetResourceType = readOptionalString(targetResource.resource_type);
  const dependencyKind = targetResourceType === 'source' ? 'source' : 'ref';

  return {
    dbt: {
      source: buildRelationEndpoint(sourceUniqueId, sourceResource),
      target: buildRelationEndpoint(targetUniqueId, targetResource),
      lineage: {
        relationKind,
        dependencyKind,
        artifactDependencyKind: DBT_ARTIFACT_RELATION_KIND,
        ...(dependencyKind === 'ref'
          ? {
              ref: {
                packageName: readOptionalString(targetResource.package_name),
                name: readOptionalString(targetResource.name),
                fqn: readOptionalStringArray(targetResource.fqn),
              },
            }
          : {}),
        ...(dependencyKind === 'source'
          ? {
              source: {
                packageName: readOptionalString(targetResource.package_name),
                sourceName: readOptionalString(targetResource.source_name),
                name: readOptionalString(targetResource.name),
              },
            }
          : {}),
      },
    },
  };
}

function buildRelationEndpoint(
  uniqueId: string,
  resource: ResourceRecord,
): Record<string, unknown> {
  const relationName = readOptionalString(resource.relation_name);

  return {
    identity: {
      uniqueId,
      ...(readOptionalString(resource.resource_type)
        ? { resourceType: readOptionalString(resource.resource_type) }
        : {}),
      ...(readOptionalString(resource.package_name)
        ? { packageName: readOptionalString(resource.package_name) }
        : {}),
      ...(readOptionalString(resource.name)
        ? { resourceName: readOptionalString(resource.name) }
        : {}),
      ...(readOptionalString(resource.source_name)
        ? { sourceName: readOptionalString(resource.source_name) }
        : {}),
      ...(readOptionalStringArray(resource.fqn)
        ? { fqn: readOptionalStringArray(resource.fqn) }
        : {}),
    },
    relation: {
      ...(readOptionalString(resource.database)
        ? { database: readOptionalString(resource.database) }
        : {}),
      ...(readOptionalString(resource.schema)
        ? { schema: readOptionalString(resource.schema) }
        : {}),
      ...(readOptionalString(resource.alias)
        ? { alias: readOptionalString(resource.alias) }
        : {}),
      ...(relationName ? { relationName } : {}),
    },
  };
}

function collectManifestResources(
  manifest: DbtManifest,
): Map<string, DbtManifestResource> {
  return new Map(collectManifestResourceEntries(manifest));
}

function collectManifestResourceEntries(
  manifest: DbtManifest,
): Array<[string, DbtManifestResource]> {
  const manifestRecord = asRecord(manifest) ?? {};
  const entries: Array<[string, DbtManifestResource]> = [];

  for (const field of MANIFEST_RESOURCE_COLLECTION_FIELDS) {
    const collection = readManifestResourceCollection(manifestRecord, field);
    for (const [uniqueId, resource] of Object.entries(collection)) {
      entries.push([uniqueId, resource]);
    }
  }

  return entries.sort((left, right) => left[0].localeCompare(right[0]));
}

function readManifestResourceCollection(
  manifest: ResourceRecord,
  field: ManifestResourceCollectionField,
): Record<string, DbtManifestResource> {
  const collection = manifest[field];
  const record = asRecord(collection);

  if (!record) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(record).filter((entry) => entry[1] !== undefined),
  ) as Record<string, DbtManifestResource>;
}

function readDependsOnNodeIds(
  resource: ResourceRecord,
  sourceUniqueId: string,
  diagnostics: DbtAdapterDiagnostic[],
): DependencyNodeIdsResult {
  const dependsOn = resource.depends_on;
  if (dependsOn === undefined) {
    return { nodeIds: [], unsupported: false };
  }

  const dependsOnRecord = asRecord(dependsOn);
  if (!dependsOnRecord) {
    diagnostics.push(
      unsupportedDbtDependencyShapeDiagnostic(sourceUniqueId, 'depends_on'),
    );
    return { nodeIds: [], unsupported: true };
  }

  const nodes = dependsOnRecord.nodes;
  if (nodes === undefined) {
    return { nodeIds: [], unsupported: false };
  }

  if (
    !Array.isArray(nodes) ||
    nodes.some(
      (entry) => typeof entry !== 'string' || entry.trim().length === 0,
    )
  ) {
    diagnostics.push(
      unsupportedDbtDependencyShapeDiagnostic(
        sourceUniqueId,
        'depends_on.nodes',
      ),
    );
    return { nodeIds: [], unsupported: true };
  }

  return {
    nodeIds: nodes.map((entry) => entry.trim()),
    unsupported: false,
  };
}

function normalizeDbtManifestResource(
  resource: DbtManifestResource,
  projectContext: DbtProjectContext,
  resourceRole: DbtGovernanceResourceRole | undefined,
  diagnostics: DbtAdapterDiagnostic[],
): NormalizedResource | undefined {
  const record = asRecord(resource);

  if (!record) {
    diagnostics.push(
      unsupportedDbtResourceShapeDiagnostic(
        'unknown',
        'dbt manifest resource must be an object.',
      ),
    );
    return undefined;
  }

  const resourceType = readOptionalString(record.resource_type) ?? 'unknown';
  const originalFilePath = readOptionalString(record.original_file_path);
  const diagnosticSourcePath = originalFilePath
    ? path.join(projectContext.projectDir, originalFilePath)
    : undefined;

  if (!isSupportedResourceType(resourceType)) {
    diagnostics.push(
      skippedDbtResourceTypeDiagnostic(
        resourceType,
        readOptionalString(record.unique_id),
      ),
    );
    return undefined;
  }

  const uniqueId = readOptionalString(record.unique_id);
  if (!uniqueId) {
    diagnostics.push(
      missingDbtResourceIdentityDiagnostic(
        resourceType,
        'unique_id',
        undefined,
        diagnosticSourcePath,
      ),
    );
    return undefined;
  }

  const packageName = readOptionalString(record.package_name);
  if (!packageName) {
    diagnostics.push(
      missingDbtResourceIdentityDiagnostic(
        resourceType,
        'package_name',
        uniqueId,
        diagnosticSourcePath,
      ),
    );
    return undefined;
  }

  const resourceName = readOptionalString(record.name);
  if (!resourceName) {
    diagnostics.push(
      missingDbtResourceIdentityDiagnostic(
        resourceType,
        'name',
        uniqueId,
        diagnosticSourcePath,
      ),
    );
    return undefined;
  }

  const absoluteSourcePath = originalFilePath
    ? path.join(projectContext.projectDir, originalFilePath)
    : undefined;
  const resourceTags = readStringArray(record.tags);
  const metadataView = readDbtResourceMetadataView(record, resourceType);
  const group = readOptionalString(record.group);
  const fqn = readStringArray(record.fqn);
  const fullyQualifiedName = fqn.length > 0 ? fqn.join('.') : undefined;
  const classification = deriveClassification(
    metadataView.resourceMeta,
    metadataView.resolvedGovernanceMeta,
    resourceTags,
  );
  const ownership = normalizeOwnership(
    record,
    group,
    metadataView.resolvedGovernanceMeta,
  );
  const dbtMetadata = buildDbtResourceMetadata(record, {
    uniqueId,
    packageName,
    resourceName,
    fullyQualifiedName,
    fqn,
    sourcePath: absoluteSourcePath,
    metadataView,
  });
  const incompleteMetadataFields = collectIncompleteMetadataFields(
    resourceType,
    dbtMetadata,
  );

  if (incompleteMetadataFields.length > 0) {
    diagnostics.push(
      incompleteDbtMetadataDiagnostic(
        uniqueId,
        incompleteMetadataFields,
        absoluteSourcePath,
      ),
    );
  }

  if (!resourceRole) {
    return undefined;
  }

  return {
    resourceType,
    resourceRole,
    manifestRecord: record,
    node: {
      id: uniqueId,
      name: resourceName,
      kind: toCanonicalNodeKind(resourceType),
      technology: 'dbt',
      sourceSystem: 'dbt',
      root: absoluteSourcePath
        ? path.dirname(absoluteSourcePath)
        : projectContext.projectDir,
      ...(absoluteSourcePath ? { path: absoluteSourcePath } : {}),
      tags: resourceTags,
      ...(classification ? { classification } : {}),
      ...(ownership ? { ownership } : {}),
      source: DBT_MANIFEST_SOURCE,
      authority: 'discovered',
      confidence: 1,
      extensions: {
        'governance-extension:dbt': buildDbtResourceNodeExpansion(
          resourceType,
          dbtMetadata,
        ),
      },
      metadata: buildCanonicalNodeMetadata(resourceRole, dbtMetadata),
    },
  };
}

function normalizeDbtTestEvidence(
  resource: DbtManifestResource,
  projectContext: DbtProjectContext,
): DbtGovernanceWorkspaceTestEvidence | undefined {
  const record = asRecord(resource);
  if (!record) {
    return undefined;
  }

  const uniqueId = readOptionalString(record.unique_id);
  const name = readOptionalString(record.name);
  const packageName = readOptionalString(record.package_name);
  if (!uniqueId || !name || !packageName) {
    return undefined;
  }

  const dependsOn = readDependsOnNodeIds(record, uniqueId, []);
  const originalFilePath = readOptionalString(record.original_file_path);
  const sourcePath = originalFilePath
    ? path.join(projectContext.projectDir, originalFilePath)
    : undefined;
  const tags = readStringArray(record.tags);
  const meta = asRecord(record.meta);
  const testType = readDbtTestType(record);

  return {
    uniqueId,
    name,
    packageName,
    resourceType: 'test',
    ...(testType ? { testType } : {}),
    dependsOnNodeIds: [...dependsOn.nodeIds].sort(),
    targetNodeIds: [...dependsOn.nodeIds].sort(),
    ...(originalFilePath ? { originalFilePath } : {}),
    ...(sourcePath ? { sourcePath } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(meta ? { meta: cloneStructuredValue(meta) } : {}),
  };
}

function normalizeDbtSemanticResourceContext(
  resource: DbtManifestResource,
  projectContext: DbtProjectContext,
  resourceRole: 'semantic-asset' | 'consumer-context',
  canonicalNodeId?: string,
): DbtGovernanceWorkspaceSemanticResource | undefined {
  const record = asRecord(resource);
  if (!record) {
    return undefined;
  }

  const resourceType = readManifestResourceType(record);
  if (!isDbtSemanticWorkspaceResourceType(resourceType)) {
    return undefined;
  }

  const uniqueId = readOptionalString(record.unique_id);
  const name = readOptionalString(record.name);
  const packageName = readOptionalString(record.package_name);
  if (!uniqueId || !name || !packageName) {
    return undefined;
  }

  const dependsOn = readDependsOnNodeIds(record, uniqueId, []);
  const originalFilePath = readOptionalString(record.original_file_path);
  const sourcePath = originalFilePath
    ? path.join(projectContext.projectDir, originalFilePath)
    : undefined;
  const fqn = readStringArray(record.fqn);
  const fullyQualifiedName = fqn.length > 0 ? fqn.join('.') : undefined;
  const docs = asRecord(record.docs);
  const description = readOptionalString(record.description);
  const meta = asRecord(record.meta);

  return {
    uniqueId,
    resourceType,
    role: resourceRole,
    name,
    packageName,
    ...(canonicalNodeId ? { canonicalNodeId } : {}),
    ...(fullyQualifiedName ? { fullyQualifiedName } : {}),
    ...(fqn.length > 0 ? { fqn } : {}),
    ...(readOptionalString(record.type)
      ? { subtype: readOptionalString(record.type) }
      : {}),
    dependsOnNodeIds: [...dependsOn.nodeIds].sort(),
    ...(originalFilePath ? { originalFilePath } : {}),
    ...(sourcePath ? { sourcePath } : {}),
    ...(readOptionalString(record.group)
      ? { group: readOptionalString(record.group) }
      : {}),
    ...(readOptionalValue(record.owner) !== undefined
      ? { owner: cloneStructuredValue(readOptionalValue(record.owner)) }
      : {}),
    ...(meta ? { meta: cloneStructuredValue(meta) } : {}),
    ...(description ? { description } : {}),
    ...(docs ? { docs: cloneStructuredValue(docs) } : {}),
  };
}

function buildDbtResourceMetadata(
  resource: ResourceRecord,
  options: {
    uniqueId: string;
    packageName: string;
    resourceName: string;
    fullyQualifiedName?: string;
    fqn: string[];
    sourcePath?: string;
    metadataView: DbtResourceMetadataView;
  },
): Record<string, unknown> {
  const docs = asRecord(resource.docs);
  const description = readOptionalString(resource.description);
  const relationName = readOptionalString(resource.relation_name);
  const contract = readContract(resource);
  const tests = readOptionalValue(resource.tests);

  return {
    identity: {
      uniqueId: options.uniqueId,
      packageName: options.packageName,
      resourceName: options.resourceName,
      resourceType: readOptionalString(resource.resource_type),
      ...(readOptionalString(resource.source_name)
        ? { sourceName: readOptionalString(resource.source_name) }
        : {}),
      ...(options.fullyQualifiedName
        ? { fullyQualifiedName: options.fullyQualifiedName }
        : {}),
      ...(options.fqn.length > 0 ? { fqn: options.fqn } : {}),
    },
    resource: {
      tags: readStringArray(resource.tags),
      meta: cloneStructuredValue(options.metadataView.resourceMeta),
      ...(options.metadataView.sourceMeta
        ? {
            sourceMeta: cloneStructuredValue(options.metadataView.sourceMeta),
          }
        : {}),
      ...(options.metadataView.resolvedGovernanceMeta
        ? {
            resolvedGovernanceMeta: cloneStructuredValue(
              options.metadataView.resolvedGovernanceMeta,
            ),
          }
        : {}),
      ...(readMaterialization(resource)
        ? { materialization: readMaterialization(resource) }
        : {}),
      ...(readOptionalString(resource.group)
        ? { group: readOptionalString(resource.group) }
        : {}),
      ...(readOptionalValue(resource.owner) !== undefined
        ? { owner: readOptionalValue(resource.owner) }
        : {}),
      ...(readOptionalString(resource.type)
        ? { subtype: readOptionalString(resource.type) }
        : {}),
    },
    relation: {
      ...(readOptionalString(resource.path)
        ? { path: readOptionalString(resource.path) }
        : {}),
      ...(readOptionalString(resource.original_file_path)
        ? {
            originalFilePath: readOptionalString(resource.original_file_path),
          }
        : {}),
      ...(options.sourcePath ? { sourcePath: options.sourcePath } : {}),
      ...(readOptionalString(resource.database)
        ? { database: readOptionalString(resource.database) }
        : {}),
      ...(readOptionalString(resource.schema)
        ? { schema: readOptionalString(resource.schema) }
        : {}),
      ...(readOptionalString(resource.alias)
        ? { alias: readOptionalString(resource.alias) }
        : {}),
      ...(relationName ? { relationName } : {}),
    },
    validation: {
      ...(tests !== undefined ? { tests } : {}),
      ...(contract !== undefined ? { contract } : {}),
    },
    documentation: {
      ...(description ? { description } : {}),
      hasDescription: Boolean(description),
      ...(docs ? { docs } : {}),
      hasDocs: docs !== undefined,
      ...(typeof docs?.show === 'boolean' ? { docsShow: docs.show } : {}),
    },
  };
}

function collectIncompleteMetadataFields(
  resourceType: string,
  metadata: Record<string, unknown>,
): string[] {
  const dbtMetadata = asRecord(metadata);
  const relation = asRecord(dbtMetadata?.relation);
  const validation = asRecord(dbtMetadata?.validation);
  const documentation = asRecord(dbtMetadata?.documentation);
  const missingFields: string[] = [];

  if (
    isCanonicalDbtAssetResourceType(resourceType) &&
    !readOptionalString(relation?.relationName)
  ) {
    missingFields.push('relation.relationName');
  }

  if (
    resourceType === 'model' ||
    resourceType === 'seed' ||
    resourceType === 'snapshot' ||
    resourceType === 'source'
  ) {
    if (readOptionalValue(validation?.tests) === undefined) {
      missingFields.push('validation.tests');
    }
  }

  if (
    resourceType === 'model' ||
    resourceType === 'seed' ||
    resourceType === 'snapshot'
  ) {
    if (readOptionalValue(validation?.contract) === undefined) {
      missingFields.push('validation.contract');
    }
  }

  if (
    documentation &&
    documentation.hasDescription === false &&
    documentation.hasDocs === false
  ) {
    missingFields.push('documentation.description');
  }

  return missingFields;
}

function buildCanonicalNodeMetadata(
  resourceRole: DbtGovernanceResourceRole,
  dbtMetadata: Record<string, unknown>,
): Record<string, unknown> {
  if (resourceRole !== 'data-asset' && resourceRole !== 'semantic-asset') {
    return {};
  }

  const documentation = asRecord(dbtMetadata.documentation);
  const documented =
    documentation?.hasDescription === true || documentation?.hasDocs === true;

  return {
    governance: {
      kind: 'asset',
      assetKind: resourceRole === 'semantic-asset' ? 'semantic' : 'data',
    },
    ...(documented ? { documentation: true } : {}),
  };
}

function deriveClassification(
  meta: ResourceRecord,
  resolvedGovernanceMeta: DbtResolvedGovernanceMeta | undefined,
  tags: readonly string[],
): GovernanceClassificationInput | undefined {
  const governanceMeta = asRecord(meta.governance);
  const scope =
    readOptionalString(governanceMeta?.scope ?? meta.scope) ?? inferScope(tags);
  const domain = readOptionalString(
    resolvedGovernanceMeta?.domain ?? governanceMeta?.domain ?? meta.domain,
  );
  const layer = readOptionalString(
    resolvedGovernanceMeta?.layer ?? governanceMeta?.layer ?? meta.layer,
  );

  if (!domain && !layer && !scope && tags.length === 0) {
    return undefined;
  }

  return {
    ...(domain ? { domain } : {}),
    ...(layer ? { layer } : {}),
    ...(scope ? { scope } : {}),
    ...(tags.length > 0 ? { tags: [...tags] } : {}),
  };
}

function readDbtResourceMetadataView(
  resource: ResourceRecord,
  resourceType: string,
): DbtResourceMetadataView {
  const resourceMeta = asRecord(resource.meta) ?? {};
  const configMeta = asRecord(asRecord(resource.config)?.meta) ?? {};
  const sourceMeta =
    resourceType === 'source' ? asRecord(resource.source_meta) : undefined;
  const resolvedGovernanceMeta = resolveDbtGovernanceMeta(
    resourceMeta,
    configMeta,
    sourceMeta,
  );

  return {
    resourceMeta,
    ...(sourceMeta ? { sourceMeta } : {}),
    ...(resolvedGovernanceMeta ? { resolvedGovernanceMeta } : {}),
  };
}

function resolveDbtGovernanceMeta(
  resourceMeta: ResourceRecord,
  configMeta: ResourceRecord,
  sourceMeta: ResourceRecord | undefined,
): DbtResolvedGovernanceMeta | undefined {
  const resolvedGovernanceMeta: DbtResolvedGovernanceMeta = {};
  const provenance: DbtResolvedGovernanceProvenanceMap = {};

  applyResolvedGovernanceOwnerField(
    resolvedGovernanceMeta,
    provenance,
    resourceMeta,
    configMeta,
    sourceMeta,
  );
  applyResolvedGovernanceStringField(
    resolvedGovernanceMeta,
    provenance,
    resourceMeta,
    configMeta,
    sourceMeta,
    'domain',
  );
  applyResolvedGovernanceStringField(
    resolvedGovernanceMeta,
    provenance,
    resourceMeta,
    configMeta,
    sourceMeta,
    'layer',
  );
  applyResolvedGovernanceStringField(
    resolvedGovernanceMeta,
    provenance,
    resourceMeta,
    configMeta,
    sourceMeta,
    'criticality',
  );
  applyResolvedGovernanceBooleanField(
    resolvedGovernanceMeta,
    provenance,
    resourceMeta,
    configMeta,
    sourceMeta,
    'publicInterface',
  );
  applyResolvedGovernanceBooleanField(
    resolvedGovernanceMeta,
    provenance,
    resourceMeta,
    configMeta,
    sourceMeta,
    'crossDomainApproved',
  );

  if (Object.keys(provenance).length > 0) {
    resolvedGovernanceMeta.provenance = provenance;
  }

  return Object.keys(resolvedGovernanceMeta).length > 0
    ? resolvedGovernanceMeta
    : undefined;
}

function applyResolvedGovernanceOwnerField(
  resolvedGovernanceMeta: DbtResolvedGovernanceMeta,
  provenance: DbtResolvedGovernanceProvenanceMap,
  resourceMeta: ResourceRecord,
  configMeta: ResourceRecord,
  sourceMeta: ResourceRecord | undefined,
): void {
  const resolvedValue = resolveGovernanceOwnerField(
    resourceMeta,
    configMeta,
    sourceMeta,
  );

  if (resolvedValue) {
    resolvedGovernanceMeta.owner = resolvedValue.value;
    provenance.owner = resolvedValue.provenance;
  }
}

function applyResolvedGovernanceStringField(
  resolvedGovernanceMeta: DbtResolvedGovernanceMeta,
  provenance: DbtResolvedGovernanceProvenanceMap,
  resourceMeta: ResourceRecord,
  configMeta: ResourceRecord,
  sourceMeta: ResourceRecord | undefined,
  field: 'domain' | 'layer' | 'criticality',
): void {
  const resolvedValue = resolveGovernanceStringField(
    resourceMeta,
    configMeta,
    sourceMeta,
    field,
  );

  if (resolvedValue) {
    resolvedGovernanceMeta[field] = resolvedValue.value;
    provenance[field] = resolvedValue.provenance;
  }
}

function applyResolvedGovernanceBooleanField(
  resolvedGovernanceMeta: DbtResolvedGovernanceMeta,
  provenance: DbtResolvedGovernanceProvenanceMap,
  resourceMeta: ResourceRecord,
  configMeta: ResourceRecord,
  sourceMeta: ResourceRecord | undefined,
  field: 'publicInterface' | 'crossDomainApproved',
): void {
  const resolvedValue = resolveGovernanceBooleanField(
    resourceMeta,
    configMeta,
    sourceMeta,
    field,
  );

  if (resolvedValue) {
    resolvedGovernanceMeta[field] = resolvedValue.value;
    provenance[field] = resolvedValue.provenance;
  }
}

function resolveGovernanceOwnerField(
  resourceMeta: ResourceRecord,
  configMeta: ResourceRecord,
  sourceMeta: ResourceRecord | undefined,
):
  | {
      value: DbtResolvedGovernanceOwnerValue;
      provenance: DbtResolvedGovernanceProvenance;
    }
  | undefined {
  const configCompanionGovernanceMeta = readCompanionGovernanceMeta(configMeta);
  const resourceCompanionGovernanceMeta =
    readCompanionGovernanceMeta(resourceMeta);
  const sourceCompanionGovernanceMeta = readCompanionGovernanceMeta(sourceMeta);
  const configGovernanceMeta = asRecord(configMeta.governance);
  const resourceGovernanceMeta = asRecord(resourceMeta.governance);
  const sourceGovernanceMeta = asRecord(sourceMeta?.governance);
  const candidates: Array<{
    value: unknown;
    provenance: DbtResolvedGovernanceProvenance;
  }> = [
    {
      value: configCompanionGovernanceMeta?.owner,
      provenance: 'config.meta.anarchitects.governance',
    },
    {
      value: configGovernanceMeta?.owner,
      provenance: 'config.meta.governance',
    },
    {
      value: configMeta.owner,
      provenance: 'config.meta',
    },
    {
      value: resourceCompanionGovernanceMeta?.owner,
      provenance: 'table.meta.anarchitects.governance',
    },
    {
      value: resourceGovernanceMeta?.owner,
      provenance: 'table.meta.governance',
    },
    {
      value: resourceMeta.owner,
      provenance: 'table.meta',
    },
    {
      value: sourceCompanionGovernanceMeta?.owner,
      provenance: 'source.meta.anarchitects.governance',
    },
    {
      value: sourceGovernanceMeta?.owner,
      provenance: 'source.meta.governance',
    },
    {
      value: sourceMeta?.owner,
      provenance: 'source.meta',
    },
  ];

  for (const candidate of candidates) {
    const value = normalizeResolvedGovernanceOwnerValue(candidate.value);
    if (value) {
      return {
        value,
        provenance: candidate.provenance,
      };
    }
  }

  return undefined;
}

function resolveGovernanceStringField(
  resourceMeta: ResourceRecord,
  configMeta: ResourceRecord,
  sourceMeta: ResourceRecord | undefined,
  field: 'domain' | 'layer' | 'criticality',
):
  | {
      value: string;
      provenance: DbtResolvedGovernanceProvenance;
    }
  | undefined {
  const configCompanionGovernanceMeta = readCompanionGovernanceMeta(configMeta);
  const resourceCompanionGovernanceMeta =
    readCompanionGovernanceMeta(resourceMeta);
  const sourceCompanionGovernanceMeta = readCompanionGovernanceMeta(sourceMeta);
  const configGovernanceMeta = asRecord(configMeta.governance);
  const resourceGovernanceMeta = asRecord(resourceMeta.governance);
  const sourceGovernanceMeta = asRecord(sourceMeta?.governance);
  const candidates: Array<{
    value: unknown;
    provenance: DbtResolvedGovernanceProvenance;
  }> = [
    {
      value: readCompanionGovernanceFieldValue(
        configCompanionGovernanceMeta,
        field,
      ),
      provenance: 'config.meta.anarchitects.governance',
    },
    {
      value: configGovernanceMeta?.[field],
      provenance: 'config.meta.governance',
    },
    {
      value: configMeta[field],
      provenance: 'config.meta',
    },
    {
      value: readCompanionGovernanceFieldValue(
        resourceCompanionGovernanceMeta,
        field,
      ),
      provenance: 'table.meta.anarchitects.governance',
    },
    {
      value: resourceGovernanceMeta?.[field],
      provenance: 'table.meta.governance',
    },
    {
      value: resourceMeta[field],
      provenance: 'table.meta',
    },
    {
      value: readCompanionGovernanceFieldValue(
        sourceCompanionGovernanceMeta,
        field,
      ),
      provenance: 'source.meta.anarchitects.governance',
    },
    {
      value: sourceGovernanceMeta?.[field],
      provenance: 'source.meta.governance',
    },
    {
      value: sourceMeta?.[field],
      provenance: 'source.meta',
    },
  ];

  for (const candidate of candidates) {
    const value = readOptionalString(candidate.value);
    if (value) {
      return {
        value,
        provenance: candidate.provenance,
      };
    }
  }

  return undefined;
}

function resolveGovernanceBooleanField(
  resourceMeta: ResourceRecord,
  configMeta: ResourceRecord,
  sourceMeta: ResourceRecord | undefined,
  field: 'publicInterface' | 'crossDomainApproved',
):
  | {
      value: boolean;
      provenance: DbtResolvedGovernanceProvenance;
    }
  | undefined {
  const configCompanionGovernanceMeta = readCompanionGovernanceMeta(configMeta);
  const resourceCompanionGovernanceMeta =
    readCompanionGovernanceMeta(resourceMeta);
  const sourceCompanionGovernanceMeta = readCompanionGovernanceMeta(sourceMeta);
  const candidates: Array<{
    value: unknown;
    provenance: DbtResolvedGovernanceProvenance;
  }> = [
    {
      value: configCompanionGovernanceMeta?.[field],
      provenance: 'config.meta.anarchitects.governance',
    },
    {
      value: resourceCompanionGovernanceMeta?.[field],
      provenance: 'table.meta.anarchitects.governance',
    },
    {
      value: sourceCompanionGovernanceMeta?.[field],
      provenance: 'source.meta.anarchitects.governance',
    },
  ];

  for (const candidate of candidates) {
    if (typeof candidate.value === 'boolean') {
      return {
        value: candidate.value,
        provenance: candidate.provenance,
      };
    }
  }

  return undefined;
}

function readCompanionGovernanceMeta(
  meta: ResourceRecord | undefined,
): ResourceRecord | undefined {
  return asRecord(asRecord(meta?.anarchitects)?.governance);
}

function readCompanionGovernanceFieldValue(
  companionGovernanceMeta: ResourceRecord | undefined,
  field: 'domain' | 'layer' | 'criticality',
): unknown {
  return companionGovernanceMeta?.[field];
}

function normalizeResolvedGovernanceOwnerValue(
  value: unknown,
): DbtResolvedGovernanceOwnerValue | undefined {
  const owner = normalizeOwner(value);
  if (!owner) {
    return undefined;
  }

  const team = readOptionalString(owner.team);
  const contact = owner.contacts?.[0];

  if (typeof value === 'string' && team) {
    return team;
  }

  const record = asRecord(value);
  if (record) {
    return {
      ...(readOptionalString(record.name)
        ? { name: readOptionalString(record.name) }
        : {}),
      ...(readOptionalString(record.team)
        ? { team: readOptionalString(record.team) }
        : {}),
      ...(contact ? { email: contact } : {}),
    };
  }

  return team;
}

function inferScope(tags: readonly string[]): string | undefined {
  const scopedTag = tags.find((tag) => tag.startsWith('scope:'));
  return scopedTag?.split(':').slice(1).join(':');
}

function normalizeOwnership(
  resource: ResourceRecord,
  group?: string,
  resolvedGovernanceMeta?: DbtResolvedGovernanceMeta,
): GovernanceOwnershipInput | undefined {
  return (
    normalizeOwner(resource.owner) ??
    normalizeOwner(group) ??
    normalizeOwner(resolvedGovernanceMeta?.owner)
  );
}

function normalizeOwner(owner: unknown): GovernanceOwnershipInput | undefined {
  if (typeof owner === 'string' && owner.trim().length > 0) {
    return {
      team: owner,
      source: 'dbt-manifest',
    };
  }

  const record = asRecord(owner);
  if (record) {
    const name =
      readOptionalString(record.name) ?? readOptionalString(record.team);
    const email = readOptionalString(record.email);

    if (name || email) {
      return {
        ...(name ? { team: name } : {}),
        ...(email ? { contacts: [email] } : {}),
        source: 'dbt-manifest',
      };
    }
  }

  return undefined;
}

function readMaterialization(resource: ResourceRecord): string | undefined {
  const config = asRecord(resource.config);
  return (
    readOptionalString(config?.materialized) ??
    readOptionalString(resource.materialized)
  );
}

function readContract(resource: ResourceRecord): unknown {
  const config = asRecord(resource.config);
  return (
    readOptionalValue(config?.contract) ?? readOptionalValue(resource.contract)
  );
}

function cloneStructuredValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneStructuredValue(entry)) as T;
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        cloneStructuredValue(entry),
      ]),
    ) as T;
  }

  return value;
}

function toCanonicalNodeKind(
  _resourceType: string,
): GovernanceNodeInput['kind'] {
  return 'resource';
}

function buildDbtRelationKind(
  sourceResourceType: string,
): CanonicalDbtRelationKind {
  void sourceResourceType;
  return 'lineage';
}

function toCanonicalRelationKind(
  _relationKind: CanonicalDbtRelationKind,
): GovernanceRelationInput['kind'] {
  return 'dependency';
}

function buildDbtRelationId(
  sourceNodeId: string,
  targetNodeId: string,
  relationKind: CanonicalDbtRelationKind,
): string {
  return `dbt:${relationKind}:${sourceNodeId}->${targetNodeId}`;
}

function readManifestResourceType(resource: DbtManifestResource): string {
  const record = asRecord(resource);
  return readOptionalString(record?.resource_type) ?? 'unknown';
}

function readDbtTestType(resource: ResourceRecord): string | undefined {
  const testMetadata = asRecord(resource.test_metadata);
  return (
    readOptionalString(testMetadata?.name) ?? readOptionalString(resource.type)
  );
}

function isCanonicalDbtAssetResourceType(resourceType: string): boolean {
  return CANONICAL_DBT_ASSET_RESOURCE_TYPES.has(resourceType);
}

function isCanonicalDbtSemanticAssetResourceType(
  resourceType: string,
): boolean {
  return CANONICAL_DBT_SEMANTIC_ASSET_RESOURCE_TYPES.has(resourceType);
}

function isDbtSemanticWorkspaceResourceType(
  resourceType: string,
): resourceType is 'exposure' | 'metric' | 'semantic_model' | 'saved_query' {
  return (
    resourceType === 'exposure' ||
    resourceType === 'metric' ||
    resourceType === 'semantic_model' ||
    resourceType === 'saved_query'
  );
}

function getDbtGovernanceResourceRole(
  resourceType: string,
): DbtGovernanceResourceRole | undefined {
  if (isCanonicalDbtAssetResourceType(resourceType)) {
    return 'data-asset';
  }

  if (isCanonicalDbtSemanticAssetResourceType(resourceType)) {
    return 'semantic-asset';
  }

  if (resourceType === 'exposure') {
    return 'consumer-context';
  }

  if (resourceType === 'test') {
    return 'evidence';
  }

  if (resourceType === 'project') {
    return 'workspace-context';
  }

  return undefined;
}

function isSupportedResourceType(resourceType: string): boolean {
  return SUPPORTED_RESOURCE_TYPES.has(resourceType);
}

function isSkippedResource(resource: DbtManifestResource): boolean {
  return !isSupportedResourceType(readManifestResourceType(resource));
}

function asRecord(value: unknown): ResourceRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as ResourceRecord)
    : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function readOptionalValue<T = unknown>(value: T): T | undefined {
  return value === undefined || value === null ? undefined : value;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.trim().length > 0,
      )
    : [];
}

function readOptionalStringArray(value: unknown): string[] | undefined {
  const values = readStringArray(value);
  return values.length > 0 ? values : undefined;
}
