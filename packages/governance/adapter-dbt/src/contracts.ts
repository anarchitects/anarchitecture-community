import type {
  GovernanceDiagnostic,
  GovernanceWorkspaceAdapter,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

export const DBT_ADAPTER_VALIDATION_MODES = ['strict', 'lenient'] as const;

export type DbtAdapterValidationMode =
  (typeof DBT_ADAPTER_VALIDATION_MODES)[number];

export interface DbtArtifactPaths {
  projectDir?: string;
  dbtProjectPath?: string;
  manifestPath?: string;
  catalogPath?: string;
  runResultsPath?: string;
  sourcesPath?: string;
}

export interface DbtAdapterOptions {
  validationMode?: DbtAdapterValidationMode;
}

export type DbtArtifactPathField = keyof DbtArtifactPaths;

export type DbtAdapterInputField =
  | `paths.${DbtArtifactPathField}`
  | 'options.validationMode';

export interface DbtAdapterMetadataEnvelope {
  dbt?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DbtGovernanceAdapterInput {
  paths: DbtArtifactPaths;
  options?: DbtAdapterOptions;
  metadata?: DbtAdapterMetadataEnvelope;
}

export interface DbtAdapterDiagnostic extends GovernanceDiagnostic {
  path?: string;
  inputField?: DbtAdapterInputField;
}

export interface ResolvedDbtArtifactPaths {
  projectDir: string;
  dbtProjectPath: string;
  manifestPath: string;
  catalogPath?: string;
  runResultsPath?: string;
  sourcesPath?: string;
}

export interface DbtProjectContext {
  projectDir: string;
  dbtProjectPath: string;
  artifactPaths: ResolvedDbtArtifactPaths;
  diagnostics: DbtAdapterDiagnostic[];
}

export interface DbtProjectDetectionResult {
  supported: boolean;
  context?: DbtProjectContext;
  diagnostics: DbtAdapterDiagnostic[];
}

export interface DbtManifestMetadata {
  dbt_schema_version: string;
  project_name: string;
  dbt_version?: string;
  adapter_type?: string;
  generated_at?: string;
  invocation_id?: string;
  env?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DbtManifestResource {
  [key: string]: unknown;
}

export interface DbtManifest {
  metadata: DbtManifestMetadata;
  nodes: Record<string, DbtManifestResource>;
  sources?: Record<string, DbtManifestResource>;
  child_map?: Record<string, string[]>;
  parent_map?: Record<string, string[]>;
  [key: string]: unknown;
}

export interface DbtProjectConfig {
  name: string;
  version?: string | number;
  configVersion?: number;
  profile?: string;
  modelPaths?: string[];
  seedPaths?: string[];
  snapshotPaths?: string[];
  analysisPaths?: string[];
  macroPaths?: string[];
  testPaths?: string[];
  [key: string]: unknown;
}

export interface DbtArtifacts {
  manifest: DbtManifest;
  projectConfig: DbtProjectConfig;
}

export interface DbtManifestLoadResult {
  supported: boolean;
  manifest?: DbtManifest;
  diagnostics: DbtAdapterDiagnostic[];
}

export interface DbtProjectConfigLoadResult {
  supported: boolean;
  projectConfig?: DbtProjectConfig;
  diagnostics: DbtAdapterDiagnostic[];
}

export interface DbtArtifactLoadResult {
  supported: boolean;
  artifacts?: DbtArtifacts;
  diagnostics: DbtAdapterDiagnostic[];
}

export interface DbtAdapterResultMetadata extends DbtAdapterMetadataEnvelope {
  adapter: 'dbt';
  validationMode: DbtAdapterValidationMode;
  paths: ResolvedDbtArtifactPaths;
}

export interface DbtAdapterResult extends GovernanceWorkspaceAdapterResult {
  diagnostics?: DbtAdapterDiagnostic[];
  metadata?: DbtAdapterResultMetadata;
}

export type DbtGovernanceWorkspaceAdapter =
  GovernanceWorkspaceAdapter<DbtGovernanceAdapterInput>;

export function isDbtAdapterValidationMode(
  value: string,
): value is DbtAdapterValidationMode {
  return DBT_ADAPTER_VALIDATION_MODES.includes(
    value as DbtAdapterValidationMode,
  );
}
