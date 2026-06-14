import type {
  GovernanceAssessment,
  GovernanceCapability,
  GovernanceDiagnostic,
  GovernanceExtensionDiagnostic,
  GovernanceWorkspace,
} from '@anarchitects/governance-core';

import type { DbtGovernanceRuntimeMetadata } from './constants.js';

export type DbtGovernanceRuntimeProfileFormat = 'json' | 'yaml';

export interface DbtGovernanceRuntimeProfileConfig {
  path?: string;
  format?: DbtGovernanceRuntimeProfileFormat;
  document?: Record<string, unknown>;
}

export interface DbtGovernanceRuntimeAdapterPaths {
  projectDir?: string;
  dbtProjectPath?: string;
  manifestPath?: string;
  catalogPath?: string;
  runResultsPath?: string;
  sourcesPath?: string;
}

export interface DbtGovernanceRuntimeAdapterConfig {
  paths: DbtGovernanceRuntimeAdapterPaths;
  options?: Record<string, unknown>;
}

export interface DbtGovernanceRuntimeExtensionConfig {
  options?: Record<string, unknown>;
}

export interface DbtGovernanceRuntimeInvocationContext {
  requestId?: string;
  workingDirectory?: string;
  dryRun?: boolean;
  metadata?: Record<string, unknown>;
}

export interface DbtGovernanceRuntimeInput {
  profile?: DbtGovernanceRuntimeProfileConfig;
  adapter: DbtGovernanceRuntimeAdapterConfig;
  extension?: DbtGovernanceRuntimeExtensionConfig;
  runtime?: DbtGovernanceRuntimeInvocationContext;
}

export type DbtGovernanceRuntimeErrorStage =
  | 'input'
  | 'profile'
  | 'adapter'
  | 'extension'
  | 'assessment'
  | 'runtime';

export type DbtGovernanceRuntimeErrorCode =
  | 'governance.runtime.invalid_input'
  | 'governance.runtime.profile_invalid'
  | 'governance.runtime.adapter_failed'
  | 'governance.runtime.extension_failed'
  | 'governance.runtime.assessment_failed'
  | 'governance.runtime.internal_error';

export interface DbtGovernanceRuntimeError {
  code: DbtGovernanceRuntimeErrorCode;
  stage: DbtGovernanceRuntimeErrorStage;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export interface DbtGovernanceRuntimeBaseResult {
  runtime: DbtGovernanceRuntimeMetadata;
  diagnostics: GovernanceDiagnostic[];
  capabilities: GovernanceCapability[];
  extensionDiagnostics?: GovernanceExtensionDiagnostic[];
  workspace?: GovernanceWorkspace;
  assessment?: GovernanceAssessment;
}

export interface DbtGovernanceRuntimeSuccessResult
  extends DbtGovernanceRuntimeBaseResult {
  ok: true;
}

export interface DbtGovernanceRuntimeErrorResult
  extends DbtGovernanceRuntimeBaseResult {
  ok: false;
  error: DbtGovernanceRuntimeError;
}

export type DbtGovernanceRuntimeResult =
  | DbtGovernanceRuntimeSuccessResult
  | DbtGovernanceRuntimeErrorResult;
