import type {
  GovernanceDiagnostic,
  GovernanceDependencyInput,
  GovernanceProjectInput,
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
}

export interface TypeScriptProjectDiscoveryConfig {
  projects: TypeScriptProjectDiscoveryRule[];
}

export interface TypeScriptProjectDiscoveryResult {
  workspaceRoot: string;
  projects: GovernanceProjectInput[];
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
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

export interface TypeScriptProjectDependencyMappingResult {
  dependencies: GovernanceDependencyInput[];
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}
