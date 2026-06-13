import {
  createDbtGovernanceModelExpansion,
  type DbtGovernanceNodeExpansionData,
  type DbtGovernanceRelationExpansionData,
  type DbtGovernanceWorkspaceExpansionData,
} from '@anarchitects/governance-extension-dbt';

import type { DbtArtifacts, DbtProjectContext } from './contracts.js';

export function buildDbtWorkspaceExpansion(
  projectContext: DbtProjectContext,
  artifacts: DbtArtifacts,
  projectNodeIds: readonly string[],
) {
  return createDbtGovernanceModelExpansion({
    kind: 'workspace',
    technology: 'dbt',
    projectName: artifacts.projectConfig.name,
    ...(artifacts.projectConfig.version !== undefined
      ? { projectVersion: artifacts.projectConfig.version }
      : {}),
    ...(artifacts.projectConfig.profile
      ? { profile: artifacts.projectConfig.profile }
      : {}),
    ...(artifacts.projectConfig.configVersion !== undefined
      ? { configVersion: artifacts.projectConfig.configVersion }
      : {}),
    artifactPaths: {
      projectDir: projectContext.projectDir,
      dbtProjectPath: projectContext.dbtProjectPath,
      manifestPath: projectContext.artifactPaths.manifestPath,
      ...(projectContext.artifactPaths.catalogPath
        ? { catalogPath: projectContext.artifactPaths.catalogPath }
        : {}),
      ...(projectContext.artifactPaths.runResultsPath
        ? { runResultsPath: projectContext.artifactPaths.runResultsPath }
        : {}),
      ...(projectContext.artifactPaths.sourcesPath
        ? { sourcesPath: projectContext.artifactPaths.sourcesPath }
        : {}),
    },
    manifest: {
      projectName: artifacts.manifest.metadata.project_name,
      dbtSchemaVersion: artifacts.manifest.metadata.dbt_schema_version,
      ...(artifacts.manifest.metadata.dbt_version
        ? { dbtVersion: artifacts.manifest.metadata.dbt_version }
        : {}),
      ...(artifacts.manifest.metadata.adapter_type
        ? { adapterType: artifacts.manifest.metadata.adapter_type }
        : {}),
      ...(artifacts.manifest.metadata.generated_at
        ? { generatedAt: artifacts.manifest.metadata.generated_at }
        : {}),
      ...(artifacts.manifest.metadata.invocation_id
        ? { invocationId: artifacts.manifest.metadata.invocation_id }
        : {}),
    },
    projectNodeIds: [...projectNodeIds].sort(),
  } satisfies DbtGovernanceWorkspaceExpansionData);
}

export function buildDbtProjectNodeExpansion(
  metadata: Record<string, unknown>,
) {
  return createDbtGovernanceModelExpansion({
    kind: 'node',
    technology: 'dbt',
    nodeKind: 'project',
    resourceType: 'project',
    project: readRecord(metadata, 'project'),
    identity: readRecord(metadata, 'identity'),
    relation: readRecord(metadata, 'relation'),
  } satisfies DbtGovernanceNodeExpansionData);
}

export function buildDbtResourceNodeExpansion(
  resourceType: string,
  metadata: Record<string, unknown>,
) {
  return createDbtGovernanceModelExpansion({
    kind: 'node',
    technology: 'dbt',
    nodeKind: 'resource',
    resourceType,
    identity: readRecord(metadata, 'identity'),
    resource: readRecord(metadata, 'resource'),
    relation: readRecord(metadata, 'relation'),
    validation: readRecord(metadata, 'validation'),
    documentation: readRecord(metadata, 'documentation'),
  } satisfies DbtGovernanceNodeExpansionData);
}

export function buildDbtRelationExpansion(
  relationKind: DbtGovernanceRelationExpansionData['relationKind'],
  metadata: Record<string, unknown>,
) {
  return createDbtGovernanceModelExpansion({
    kind: 'relation',
    technology: 'dbt',
    relationKind,
    source: readRecord(metadata, 'source'),
    target: readRecord(metadata, 'target'),
    lineage: readRecord(metadata, 'lineage'),
  } satisfies DbtGovernanceRelationExpansionData);
}

function readRecord(
  metadata: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = metadata[key];
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
