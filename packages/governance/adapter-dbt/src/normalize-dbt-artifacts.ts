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

    const record = asRecord(sourceResource);
    if (!record) {
      diagnostics.push(
        unsupportedDbtDependencyShapeDiagnostic(sourceUniqueId, 'depends_on'),
      );
      unsupportedCount += 1;
      continue;
    }

    const dependsOn = readDependsOnNodeIds(record, sourceUniqueId, diagnostics);
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
  targetUniqueId: string,
  targetResource: DbtManifestResource,
): Record<string, unknown> {
  const targetRecord = asRecord(targetResource) ?? {};
  const targetResourceType = readOptionalString(targetRecord.resource_type);
  const dependencyKind = targetResourceType === 'source' ? 'source' : 'ref';

  return {
    dbt: {
      sourceUniqueId,
      targetUniqueId,
      dependencyKind,
      artifactDependencyKind: DBT_ARTIFACT_DEPENDENCY_KIND,
      ...(dependencyKind === 'ref'
        ? {
            ref: {
              packageName: readOptionalString(targetRecord.package_name),
              name: readOptionalString(targetRecord.name),
              fqn: readStringArray(targetRecord.fqn),
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
      missingDbtResourceIdentityDiagnostic(resourceType, 'unique_id'),
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
      ),
    );
    return undefined;
  }

  const resourceName = readResourceName(record);
  if (!resourceName) {
    diagnostics.push(
      missingDbtResourceIdentityDiagnostic(resourceType, 'name', uniqueId),
    );
    return undefined;
  }

  const originalFilePath = readOptionalString(record.original_file_path);
  const absoluteSourcePath = originalFilePath
    ? path.join(projectContext.projectDir, originalFilePath)
    : undefined;
  const resourceTags = readStringArray(record.tags);
  const resourceMeta = asRecord(record.meta) ?? {};
  const materialization = readMaterialization(record);
  const group = readOptionalString(record.group);
  const owner = normalizeOwner(record.owner, group);
  const fqn = readStringArray(record.fqn);
  const fullyQualifiedName = fqn.length > 0 ? fqn.join('.') : undefined;
  const description = readOptionalString(record.description);
  const docs = asRecord(record.docs);
  const database = readOptionalString(record.database);
  const schema = readOptionalString(record.schema);
  const alias = readOptionalString(record.alias);

  const classification = deriveClassification(resourceMeta, resourceTags);
  const kind = resourceKind(resourceType);
  const rootPath = absoluteSourcePath
    ? path.dirname(absoluteSourcePath)
    : projectContext.projectDir;

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
      ...(owner ? { ownership: owner } : {}),
      metadata: {
        dbt: {
          uniqueId,
          packageName,
          resourceName,
          fullyQualifiedName,
          fqn,
          resourceType,
          materialization,
          tags: resourceTags,
          meta: resourceMeta,
          group,
          owner: record.owner,
          path: readOptionalString(record.path),
          originalFilePath,
          sourcePath: absoluteSourcePath,
          database,
          schema,
          alias,
          description,
          hasDescription: Boolean(description),
          docs,
          hasDocs: docs !== undefined,
          docsShow: typeof docs?.show === 'boolean' ? docs.show : undefined,
        },
      },
    },
    nodeMetadata: {
      dbt: {
        uniqueId,
        packageName,
        resourceName,
        fullyQualifiedName,
        fqn,
        resourceType,
        materialization,
        tags: resourceTags,
        meta: resourceMeta,
        group,
        owner: record.owner,
        path: readOptionalString(record.path),
        originalFilePath,
        sourcePath: absoluteSourcePath,
        database,
        schema,
        alias,
        description,
        hasDescription: Boolean(description),
        docs,
        hasDocs: docs !== undefined,
        docsShow: typeof docs?.show === 'boolean' ? docs.show : undefined,
      },
    },
  };
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

function readResourceName(resource: ResourceRecord): string | undefined {
  return readOptionalString(resource.name);
}

function readMaterialization(resource: ResourceRecord): string | undefined {
  const config = asRecord(resource.config);
  return (
    readOptionalString(config?.materialized) ??
    readOptionalString(resource.materialized)
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

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.trim().length > 0,
      )
    : [];
}
