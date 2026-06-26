import type {
  GovernanceExtensionContractIssue,
  GovernanceExtensionModelExpansion,
} from '@anarchitects/governance-core';

import type { DbtArtifacts, DbtProjectContext } from './contracts.js';

const DBT_GOVERNANCE_EXTENSION_ID = 'governance-extension:dbt';
const DBT_GOVERNANCE_EXPANSION_CONTRACT_VERSION = '1';

export interface DbtGovernanceWorkspaceTestEvidence {
  uniqueId: string;
  name: string;
  packageName: string;
  resourceType: 'test';
  testType?: string;
  dependsOnNodeIds: string[];
  targetNodeIds: string[];
  originalFilePath?: string;
  sourcePath?: string;
  tags?: string[];
  meta?: Record<string, unknown>;
}

interface DbtGovernanceWorkspaceExpansionData {
  kind: 'workspace';
  technology: 'dbt';
  projectName: string;
  projectVersion?: string | number;
  profile?: string;
  configVersion?: number;
  project?: Record<string, unknown>;
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
  testEvidence?: DbtGovernanceWorkspaceTestEvidence[];
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
  testEvidence: readonly DbtGovernanceWorkspaceTestEvidence[] = [],
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
    project: {
      name: artifacts.projectConfig.name,
      ...(artifacts.projectConfig.version !== undefined
        ? { version: artifacts.projectConfig.version }
        : {}),
      ...(artifacts.projectConfig.configVersion !== undefined
        ? { configVersion: artifacts.projectConfig.configVersion }
        : {}),
      ...(artifacts.projectConfig.profile
        ? { profile: artifacts.projectConfig.profile }
        : {}),
      ...(artifacts.projectConfig.modelPaths
        ? { modelPaths: artifacts.projectConfig.modelPaths }
        : {}),
      ...(artifacts.projectConfig.seedPaths
        ? { seedPaths: artifacts.projectConfig.seedPaths }
        : {}),
      ...(artifacts.projectConfig.snapshotPaths
        ? { snapshotPaths: artifacts.projectConfig.snapshotPaths }
        : {}),
      ...(artifacts.projectConfig.analysisPaths
        ? { analysisPaths: artifacts.projectConfig.analysisPaths }
        : {}),
      ...(artifacts.projectConfig.macroPaths
        ? { macroPaths: artifacts.projectConfig.macroPaths }
        : {}),
      ...(artifacts.projectConfig.testPaths
        ? { testPaths: artifacts.projectConfig.testPaths }
        : {}),
    },
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
    ...(testEvidence.length > 0
      ? {
          testEvidence: [...testEvidence]
            .map((entry) => ({
              uniqueId: entry.uniqueId,
              name: entry.name,
              packageName: entry.packageName,
              resourceType: entry.resourceType,
              ...(entry.testType ? { testType: entry.testType } : {}),
              dependsOnNodeIds: [...entry.dependsOnNodeIds].sort(),
              targetNodeIds: [...entry.targetNodeIds].sort(),
              ...(entry.originalFilePath
                ? { originalFilePath: entry.originalFilePath }
                : {}),
              ...(entry.sourcePath ? { sourcePath: entry.sourcePath } : {}),
              ...(entry.tags ? { tags: [...entry.tags].sort() } : {}),
              ...(entry.meta ? { meta: structuredClone(entry.meta) } : {}),
            }))
            .sort((left, right) => left.uniqueId.localeCompare(right.uniqueId)),
        }
      : {}),
  } satisfies DbtGovernanceWorkspaceExpansionData);
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
