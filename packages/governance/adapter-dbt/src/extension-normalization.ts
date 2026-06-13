import type {
  GovernanceExtensionContractIssue,
  GovernanceExtensionModelExpansion,
} from '@anarchitects/governance-core';

import type { DbtArtifacts, DbtProjectContext } from './contracts.js';

const DBT_GOVERNANCE_EXTENSION_ID = 'governance-extension:dbt';
const DBT_GOVERNANCE_EXPANSION_CONTRACT_VERSION = '1';

interface DbtGovernanceWorkspaceExpansionData {
  kind: 'workspace';
  technology: 'dbt';
  projectName: string;
  projectVersion?: string | number;
  profile?: string;
  configVersion?: number;
  artifactPaths?: {
    projectDir?: string;
    dbtProjectPath?: string;
    manifestPath?: string;
    catalogPath?: string;
    runResultsPath?: string;
    sourcesPath?: string;
  };
  manifest?: {
    projectName: string;
    dbtSchemaVersion: string;
    dbtVersion?: string;
    adapterType?: string;
    generatedAt?: string;
    invocationId?: string;
  };
  projectNodeIds?: string[];
}

interface DbtGovernanceNodeExpansionData {
  kind: 'node';
  technology: 'dbt';
  nodeKind: 'project' | 'resource' | 'unknown';
  resourceType:
    | 'project'
    | 'model'
    | 'seed'
    | 'snapshot'
    | 'source'
    | 'exposure'
    | 'test'
    | 'metric'
    | 'semantic_model'
    | 'saved_query'
    | 'unknown'
    | (string & {});
  project?: Record<string, unknown>;
  identity?: Record<string, unknown>;
  resource?: Record<string, unknown>;
  relation?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  documentation?: Record<string, unknown>;
}

interface DbtGovernanceRelationExpansionData {
  kind: 'relation';
  technology: 'dbt';
  relationKind:
    | 'lineage'
    | 'exposes'
    | 'tests'
    | 'dependency'
    | 'uses-package'
    | 'unknown';
  source?: Record<string, unknown>;
  target?: Record<string, unknown>;
  lineage?: Record<string, unknown>;
}

type DbtGovernanceModelExpansionData =
  | DbtGovernanceWorkspaceExpansionData
  | DbtGovernanceNodeExpansionData
  | DbtGovernanceRelationExpansionData;

interface CreateDbtGovernanceModelExpansionOptions {
  contractVersion?: string;
  diagnostics?: readonly GovernanceExtensionContractIssue[];
  metadata?: Record<string, unknown>;
}

function createDbtGovernanceModelExpansion<
  TData extends DbtGovernanceModelExpansionData,
>(
  data: TData,
  options: CreateDbtGovernanceModelExpansionOptions = {},
): GovernanceExtensionModelExpansion<TData> {
  return {
    extensionId: DBT_GOVERNANCE_EXTENSION_ID,
    contractVersion:
      options.contractVersion ?? DBT_GOVERNANCE_EXPANSION_CONTRACT_VERSION,
    data,
    ...(options.diagnostics ? { diagnostics: options.diagnostics } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {}),
  };
}

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
