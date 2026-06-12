import type {
  GovernanceAuthority,
  GovernanceClassificationInput,
  GovernanceConfidence,
  GovernanceDiagnostic,
  GovernanceNodeInput,
  GovernanceOwnershipInput,
  GovernanceRelationInput,
  GovernanceSource,
} from '@anarchitects/governance-core';

export type TypeScriptWorkspaceDetectionStatus =
  | 'supported'
  | 'partial'
  | 'unsupported';

export interface TypeScriptWorkspaceIndicators {
  packageJson: boolean;
  pnpmWorkspace: boolean;
  packageManagerWorkspaces: boolean;
  tsconfig: boolean;
  tsconfigBase: boolean;
}

export interface TypeScriptWorkspaceDetectionDiagnostic
  extends GovernanceDiagnostic {
  path?: string;
}

export interface TypeScriptWorkspaceDetectionResult {
  status: TypeScriptWorkspaceDetectionStatus;
  supported: boolean;
  workspaceRoot: string;
  indicators: TypeScriptWorkspaceIndicators;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

export type TypeScriptWorkspacePackageManager = 'pnpm' | 'npm' | 'yarn';

export interface WorkspacePackageResolution {
  packageManager?: TypeScriptWorkspacePackageManager;
  workspaceRoot: string;
  patterns: string[];
  packageRoots: string[];
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

export interface TsConfigResolutionModel {
  workspaceRoot: string;
  configFiles: string[];
  baseUrl?: string;
  pathAliases: Record<string, string[]>;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

export interface TypeScriptProjectDiscoveryRule {
  pattern: string;
  name?: string;
  tags?: string[];
  projection?: TypeScriptProjectDiscoveryProjection;
}

export interface TypeScriptProjectDiscoveryConfig {
  projects: TypeScriptProjectDiscoveryRule[];
}

export interface TypeScriptProjectDiscoveryProjection {
  domain?: string;
  layer?: string;
  scope?: string;
  type?: string;
  kind?: GovernanceNodeInput['kind'];
  metadata?: Record<string, unknown>;
}

export interface TypeScriptPackageGovernanceMetadataFieldMapping {
  domain?: string;
  layer?: string;
  scope?: string;
  owner?: string;
}

export interface TypeScriptPackageGovernanceMetadataConfig {
  sourceFile: string;
  path: string[];
  fields: TypeScriptPackageGovernanceMetadataFieldMapping;
}

export interface TypeScriptPackageGovernanceMetadata {
  domain?: string;
  layer?: string;
  scope?: string;
  owner?: string;
}

export interface TypeScriptProjectDiscoveryResult {
  workspaceRoot: string;
  projects: TypeScriptDiscoveredProject[];
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

export interface TypeScriptDiscoveredProject {
  id: string;
  name?: string;
  root?: string;
  kind?: GovernanceNodeInput['kind'];
  type?: string;
  domain?: string;
  layer?: string;
  scope?: string;
  tags?: string[];
  ownership?: GovernanceOwnershipInput;
  metadata?: Record<string, unknown>;
}

export interface TypeScriptSourceFileNode {
  filePath: string;
  projectName?: string;
}

export type TypeScriptImportKind =
  | 'static-import'
  | 're-export'
  | 'dynamic-import';

export interface TypeScriptImportEdge {
  sourceFile: string;
  specifier: string;
  kind: TypeScriptImportKind;
  resolvedFile?: string;
  external: boolean;
}

export interface TypeScriptImportGraph {
  workspaceRoot: string;
  files: TypeScriptSourceFileNode[];
  imports: TypeScriptImportEdge[];
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

export interface TypeScriptProjectRelationMappingResult {
  relations: GovernanceRelationInput[];
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

export interface TypeScriptPackageNodeInput extends GovernanceNodeInput {
  metadata?: {
    packageManager?: Record<string, unknown>;
    typescript?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface TypeScriptGraphArtifactNode {
  id: string;
  name: string;
  kind: GovernanceNodeInput['kind'];
  technology?: string;
  sourceSystem?: string;
  root?: string;
  path?: string;
  tags?: string[];
  classification?: GovernanceClassificationInput;
  ownership?: GovernanceOwnershipInput;
  source?: GovernanceSource;
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}
