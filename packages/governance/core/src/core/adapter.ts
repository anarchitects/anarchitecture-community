import type { GovernanceWorkspace } from './models.js';

export interface GovernanceWorkspaceAdapterResult {
  workspace?: GovernanceWorkspace;
  workspaceId?: string;
  workspaceName?: string;
  workspaceRoot?: string;
  projects?: GovernanceProjectInput[];
  dependencies?: GovernanceDependencyInput[];
  capabilities?: GovernanceCapability[];
  diagnostics?: GovernanceDiagnostic[];
  metadata?: Record<string, unknown>;
}

export interface GovernanceProjectInput {
  id: string;
  name?: string;
  root?: string;
  type?: string;
  domain?: string;
  layer?: string;
  scope?: string;
  tags?: string[];
  ownership?: GovernanceOwnershipInput;
  metadata?: Record<string, unknown>;
}

export interface GovernanceDependencyInput {
  sourceProjectId: string;
  targetProjectId: string;
  type?: string;
  sourceFile?: string;
  metadata?: Record<string, unknown>;
}

export interface GovernanceOwnershipInput {
  team?: string;
  contacts?: string[];
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface GovernanceCapability<TData = unknown> {
  id: string;
  version?: string;
  data?: TData;
}

export interface GovernanceDiagnostic {
  code: string;
  message: string;
  source?: string;
  details?: Record<string, unknown>;
}
