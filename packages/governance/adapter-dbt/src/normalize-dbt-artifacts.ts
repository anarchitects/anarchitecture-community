import path from 'node:path';

import type {
  GovernanceDependencyInput,
  GovernanceNodeInput,
  GovernanceOwnershipInput,
  GovernanceProjectInput,
} from '@anarchitects/governance-core';
import {
  governanceDependenciesToRelations,
  governanceProjectsToNodes,
} from '@anarchitects/governance-core';

import type {
  DbtAdapterDiagnostic,
  DbtAdapterResult,
  DbtArtifacts,
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

const SUPPORTED_NODE_RESOURCE_TYPES = new Set(['model', 'seed', 'snapshot']);
const SUPPORTED_SOURCE_RESOURCE_TYPES = new Set(['source']);
const SUPPORTED_EXPOSURE_RESOURCE_TYPES = new Set(['exposure']);
const DBT_ARTIFACT_DEPENDENCY_KIND = 'depends_on.nodes';

type ResourceRecord = Record<string, unknown>;

interface NormalizedResource {
  project: GovernanceProjectInput;
  nodeMetadata: Record<string, unknown>;
  path?: string;
  kind: GovernanceNodeInput['kind'];
}

interface DependencyNodeIdsResult {
  nodeIds: string[];
  unsupported: boolean;
}

interface DependencyMappingResult {
  dependencies: GovernanceDependencyInput[];
  unresolvedCount: number;
  notNormalizedCount: number;
  unsupportedCount: number;
}

export function normalizeDbtArtifacts(
  projectContext: DbtProjectContext,
  artifacts: DbtArtifacts,
): DbtAdapterResult {
  const diagnostics: DbtAdapterDiagnostic[] = [];
  const normalizedProjects: GovernanceProjectInput[] = [];
  const normalizedResourcesById = new Map<string, NormalizedResource>();
  let skippedCount = 0;
  let invalidCount = 0;

  for (const resource of Object.values(artifacts.manifest.nodes)) {
    const normalized = normalizeDbtManifestResource(
      resource,
      projectContext,
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

    normalizedProjects.push(normalized.project);
    normalizedResourcesById.set(normalized.project.id, normalized);
  }

  for (const resource of Object.values(artifacts.manifest.sources ?? {})) {
    const normalized = normalizeDbtManifestResource(
      resource,
      projectContext,
      diagnostics,
    );

    if (!normalized) {
      invalidCount += 1;
      continue;
    }

    normalizedProjects.push(normalized.project);
    normalizedResourcesById.set(normalized.project.id, normalized);
  }

  for (const resource of Object.values(artifacts.manifest.exposures ?? {})) {
    const normalized = normalizeDbtManifestResource(
      resource,
      projectContext,
      diagnostics,
    );

    if (!normalized) {
      invalidCount += 1;
      continue;
    }

    normalizedProjects.push(normalized.project);
    normalizedResourcesById.set(normalized.project.id, normalized);
  }

  if (skippedCount > 0 || invalidCount > 0) {
    diagnostics.push(
      partialDbtNormalizationDiagnostic({
        normalizedCount: normalizedProjects.length,
        skippedCount,
        invalidCount,
      }),
    );
  }

  const nodes = governanceProjectsToNodes(normalizedProjects).map((node) => {
    const normalized = normalizedResourcesById.get(node.id);

    return {
      ...node,
      kind: normalized?.kind ?? node.kind,
      technology: 'dbt',
      sourceSystem: 'dbt',
      path: normalized?.path,
      authority: 'discovered',
      confidence: 1,
      metadata: normalized?.nodeMetadata ?? node.metadata ?? {},
    };
  });

  const dependencyMapping = mapDbtDependencies(
    artifacts,
    normalizedResourcesById,
    diagnostics,
  );
  const relations = governanceDependenciesToRelations(
    dependencyMapping.dependencies,
  );

  if (
    dependencyMapping.unresolvedCount > 0 ||
    dependencyMapping.notNormalizedCount > 0 ||
    dependencyMapping.unsupportedCount > 0
  ) {
    diagnostics.push(
      partialDbtDependencyMappingDiagnostic({
        mappedCount: dependencyMapping.dependencies.length,
        unresolvedCount: dependencyMapping.unresolvedCount,
        notNormalizedCount: dependencyMapping.notNormalizedCount,
        unsupportedCount: dependencyMapping.unsupportedCount,
      }),
    );
  }

  return {
    workspaceId: `dbt:${artifacts.projectConfig.name}`,
    workspaceName: artifacts.projectConfig.name,
    workspaceRoot: projectContext.projectDir,
    projects: normalizedProjects,
    nodes,
    dependencies: dependencyMapping.dependencies,
    relations,
    diagnostics: [...projectContext.diagnostics, ...diagnostics],
  };
}

function mapDbtDependencies(
  artifacts: DbtArtifacts,
  normalizedResourcesById: ReadonlyMap<string, NormalizedResource>,
  diagnostics: DbtAdapterDiagnostic[],
): DependencyMappingResult {
  const manifestResourcesById = collectManifestResources(artifacts);
  const dependencies: GovernanceDependencyInput[] = [];
  const dependencyKeys = new Set<string>();
  let unresolvedCount = 0;
  let notNormalizedCount = 0;
  let unsupportedCount = 0;

  for (const sourceUniqueId of normalizedResourcesById.keys()) {
    const sourceResource = manifestResourcesById.get(sourceUniqueId);

    if (!sourceResource) {
      continue;
    }

    const sourceRecord = asRecord(sourceResource);
    if (!sourceRecord) {
      diagnostics.push(
        unsupportedDbtDependencyShapeDiagnostic(sourceUniqueId, 'depends_on'),
      );
      unsupportedCount += 1;
      continue;
    }

    const dependsOn = readDependsOnNodeIds(
      sourceRecord,
      sourceUniqueId,
      diagnostics,
    );
    if (dependsOn.unsupported) {
      unsupportedCount += 1;
      continue;
    }

    for (const targetUniqueId of dependsOn.nodeIds) {
      const dependencyKey = `${sourceUniqueId}->${targetUniqueId}`;
      if (dependencyKeys.has(dependencyKey)) {
        continue;
      }

      const targetResource = manifestResourcesById.get(targetUniqueId);
      if (!targetResource) {
        diagnostics.push(
          unresolvedDbtDependencyTargetDiagnostic(
            sourceUniqueId,
            targetUniqueId,
          ),
        );
        unresolvedCount += 1;
        continue;
      }

      if (!normalizedResourcesById.has(targetUniqueId)) {
        diagnostics.push(
          dependencyTargetNotNormalizedDiagnostic(
            sourceUniqueId,
            targetUniqueId,
          ),
        );
        notNormalizedCount += 1;
        continue;
      }

      dependencyKeys.add(dependencyKey);
      dependencies.push({
        sourceProjectId: sourceUniqueId,
        targetProjectId: targetUniqueId,
        type: 'static',
        metadata: buildDependencyMetadata(
          sourceUniqueId,
          sourceRecord,
          targetUniqueId,
          targetResource,
        ),
      });
    }
  }

  return {
    dependencies,
    unresolvedCount,
    notNormalizedCount,
    unsupportedCount,
  };
}

function buildDependencyMetadata(
  sourceUniqueId: string,
  sourceResource: ResourceRecord,
  targetUniqueId: string,
  targetResource: DbtManifestResource,
): Record<string, unknown> {
  const targetRecord = asRecord(targetResource) ?? {};
  const targetResourceType = readOptionalString(targetRecord.resource_type);
  const dependencyKind = targetResourceType === 'source' ? 'source' : 'ref';

  return {
    dbt: {
      source: buildDependencyEndpoint(sourceUniqueId, sourceResource),
      target: buildDependencyEndpoint(targetUniqueId, targetRecord),
      lineage: {
        dependencyKind,
        artifactDependencyKind: DBT_ARTIFACT_DEPENDENCY_KIND,
        ...(dependencyKind === 'ref'
          ? {
              ref: {
                packageName: readOptionalString(targetRecord.package_name),
                name: readOptionalString(targetRecord.name),
                fqn: readOptionalStringArray(targetRecord.fqn),
              },
            }
          : {}),
        ...(dependencyKind === 'source'
          ? {
              source: {
                packageName: readOptionalString(targetRecord.package_name),
                sourceName: readOptionalString(targetRecord.source_name),
                name: readOptionalString(targetRecord.name),
              },
            }
          : {}),
      },
    },
  };
}

function buildDependencyEndpoint(
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
  artifacts: DbtArtifacts,
): Map<string, DbtManifestResource> {
  const resources = new Map<string, DbtManifestResource>();

  for (const [uniqueId, resource] of Object.entries(artifacts.manifest.nodes)) {
    resources.set(uniqueId, resource);
  }

  for (const [uniqueId, resource] of Object.entries(
    artifacts.manifest.sources ?? {},
  )) {
    resources.set(uniqueId, resource);
  }

  for (const [uniqueId, resource] of Object.entries(
    artifacts.manifest.exposures ?? {},
  )) {
    resources.set(uniqueId, resource);
  }

  return resources;
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
  const resourceMeta = asRecord(record.meta) ?? {};
  const group = readOptionalString(record.group);
  const fqn = readStringArray(record.fqn);
  const fullyQualifiedName = fqn.length > 0 ? fqn.join('.') : undefined;

  const classification = deriveClassification(resourceMeta, resourceTags);
  const kind = resourceKind(resourceType);
  const rootPath = absoluteSourcePath
    ? path.dirname(absoluteSourcePath)
    : projectContext.projectDir;
  const dbtMetadata = buildDbtResourceMetadata(record, {
    uniqueId,
    packageName,
    resourceName,
    fullyQualifiedName,
    fqn,
    sourcePath: absoluteSourcePath,
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

  return {
    kind,
    path: absoluteSourcePath,
    project: {
      id: uniqueId,
      name: resourceName,
      root: rootPath,
      type: kind,
      tags: resourceTags,
      ...(classification.domain ? { domain: classification.domain } : {}),
      ...(classification.layer ? { layer: classification.layer } : {}),
      ...(classification.scope ? { scope: classification.scope } : {}),
      ...(normalizeOwner(record.owner, group)
        ? { ownership: normalizeOwner(record.owner, group) }
        : {}),
      metadata: {
        dbt: dbtMetadata,
      },
    },
    nodeMetadata: {
      dbt: dbtMetadata,
    },
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
      meta: asRecord(resource.meta) ?? {},
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

  if (!readOptionalString(relation?.relationName)) {
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

function deriveClassification(
  meta: ResourceRecord,
  tags: readonly string[],
): {
  domain?: string;
  layer?: string;
  scope?: string;
} {
  const governanceMeta = asRecord(meta.governance);
  const scope =
    readOptionalString(governanceMeta?.scope ?? meta.scope) ?? inferScope(tags);

  return {
    ...(readOptionalString(governanceMeta?.domain ?? meta.domain)
      ? { domain: readOptionalString(governanceMeta?.domain ?? meta.domain) }
      : {}),
    ...(readOptionalString(governanceMeta?.layer ?? meta.layer)
      ? { layer: readOptionalString(governanceMeta?.layer ?? meta.layer) }
      : {}),
    ...(scope ? { scope } : {}),
  };
}

function inferScope(tags: readonly string[]): string | undefined {
  const scopedTag = tags.find((tag) => tag.startsWith('scope:'));
  return scopedTag?.split(':').slice(1).join(':');
}

function normalizeOwner(
  owner: unknown,
  group?: string,
): GovernanceOwnershipInput | undefined {
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

  if (group) {
    return {
      team: group,
      source: 'dbt-manifest',
    };
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

function resourceKind(resourceType: string): GovernanceNodeInput['kind'] {
  return resourceType === 'exposure' || resourceType === 'source'
    ? 'resource'
    : 'asset';
}

function isSupportedResourceType(resourceType: string): boolean {
  return (
    SUPPORTED_NODE_RESOURCE_TYPES.has(resourceType) ||
    SUPPORTED_SOURCE_RESOURCE_TYPES.has(resourceType) ||
    SUPPORTED_EXPOSURE_RESOURCE_TYPES.has(resourceType)
  );
}

function isSkippedResource(resource: DbtManifestResource): boolean {
  const record = asRecord(resource);
  const resourceType = readOptionalString(record?.resource_type) ?? 'unknown';
  return !isSupportedResourceType(resourceType);
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
