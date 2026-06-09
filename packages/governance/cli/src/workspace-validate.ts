import {
  buildGovernanceWorkspace,
  type GovernanceCapability,
  type GovernanceDiagnostic,
  type GovernanceWorkspace,
  type GovernanceWorkspaceAdapter,
  type GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

import {
  GenericWorkspaceLoadError,
  GenericWorkspaceValidationError,
  loadGenericWorkspace,
  type GenericWorkspaceValidationIssue,
} from './internal/manual-workspace/load-workspace.js';
import { toCompatibilityWorkspace } from './workspace-compat.js';

export interface AgovWorkspaceValidateSummary {
  status: 'valid' | 'invalid';
  workspaceName?: string;
  projectCount: number;
  dependencyCount: number;
  errorCount: number;
  diagnosticCount: number;
  warningCount: number;
}

export interface AgovWorkspaceValidateAdapterMetadata {
  id: string;
  capabilities: GovernanceCapability[];
  diagnostics: GovernanceDiagnostic[];
  metadata?: Record<string, unknown>;
}

export interface AgovWorkspaceValidateResult {
  command: 'workspace validate';
  success: boolean;
  workspacePath?: string;
  adapterPackage?: string;
  adapter?: AgovWorkspaceValidateAdapterMetadata;
  workspace?: GovernanceWorkspace;
  errors?: GenericWorkspaceValidationIssue[];
  diagnostics?: GovernanceDiagnostic[];
  summary: AgovWorkspaceValidateSummary;
}

export interface AgovWorkspaceValidateWithWorkspacePathOptions {
  workspacePath: string;
  workspaceAdapter?: undefined;
  workspaceAdapterInput?: undefined;
  adapterPackage?: undefined;
}

export interface AgovWorkspaceValidateWithAdapterOptions<TInput = unknown> {
  workspaceAdapter: GovernanceWorkspaceAdapter<TInput>;
  workspaceAdapterInput: TInput;
  adapterPackage?: string;
  workspacePath?: undefined;
}

export type AgovWorkspaceValidateOptions<TInput = unknown> =
  | AgovWorkspaceValidateWithWorkspacePathOptions
  | AgovWorkspaceValidateWithAdapterOptions<TInput>;

export async function runAgovWorkspaceValidate<TInput = unknown>(
  options: AgovWorkspaceValidateOptions<TInput>,
): Promise<AgovWorkspaceValidateResult> {
  if (typeof options.workspacePath === 'string') {
    try {
      const loadedWorkspace = loadGenericWorkspace(options.workspacePath);

      return {
        command: 'workspace validate',
        success: true,
        workspacePath: loadedWorkspace.filePath,
        workspace: loadedWorkspace.workspace,
        summary: buildValidSummary(loadedWorkspace.workspace),
      };
    } catch (error) {
      if (error instanceof GenericWorkspaceValidationError) {
        return {
          command: 'workspace validate',
          success: false,
          workspacePath: error.filePath,
          errors: [...error.issues],
          summary: {
            status: 'invalid',
            projectCount: 0,
            dependencyCount: 0,
            errorCount: error.issues.length,
            diagnosticCount: 0,
            warningCount: 0,
          },
        };
      }

      if (error instanceof GenericWorkspaceLoadError) {
        const diagnostics = [
          {
            code: error.code,
            message: error.message,
            source: 'governance-cli:workspace-loader',
            details: {
              filePath: error.filePath,
            },
          },
        ];

        return {
          command: 'workspace validate',
          success: false,
          workspacePath: error.filePath,
          diagnostics,
          summary: {
            status: 'invalid',
            projectCount: 0,
            dependencyCount: 0,
            errorCount: 0,
            diagnosticCount: diagnostics.length,
            warningCount: countWarningDiagnostics(diagnostics),
          },
        };
      }

      throw error;
    }
  }

  const adapterResult = options.workspaceAdapter.loadWorkspace(
    options.workspaceAdapterInput,
  );
  const diagnostics = [...(adapterResult.diagnostics ?? [])];
  const workspace = buildGovernanceWorkspace(adapterResult);
  const adapterMetadata = toAdapterMetadata(
    options.workspaceAdapter.id,
    adapterResult,
  );
  const summary = buildAdapterSummary(workspace, diagnostics);

  if (summary.errorCount > 0) {
    return {
      command: 'workspace validate',
      success: false,
      ...(options.adapterPackage
        ? { adapterPackage: options.adapterPackage }
        : {}),
      adapter: adapterMetadata,
      diagnostics,
      summary,
    };
  }

  return {
    command: 'workspace validate',
    success: true,
    ...(options.adapterPackage
      ? { adapterPackage: options.adapterPackage }
      : {}),
    adapter: adapterMetadata,
    workspace,
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
    summary,
  };
}

function toAdapterMetadata(
  adapterId: string,
  adapterResult: GovernanceWorkspaceAdapterResult,
): AgovWorkspaceValidateAdapterMetadata {
  return {
    id: adapterId,
    capabilities: [...(adapterResult.capabilities ?? [])],
    diagnostics: [...(adapterResult.diagnostics ?? [])],
    ...(adapterResult.metadata ? { metadata: adapterResult.metadata } : {}),
  };
}

function buildValidSummary(
  workspace: GovernanceWorkspace,
): AgovWorkspaceValidateSummary {
  const compatibilityWorkspace = toCompatibilityWorkspace(workspace);
  return {
    status: 'valid',
    workspaceName: workspace.name,
    projectCount: compatibilityWorkspace.projects.length,
    dependencyCount: compatibilityWorkspace.dependencies.length,
    errorCount: 0,
    diagnosticCount: 0,
    warningCount: 0,
  };
}

function buildAdapterSummary(
  workspace: GovernanceWorkspace,
  diagnostics: GovernanceDiagnostic[],
): AgovWorkspaceValidateSummary {
  const compatibilityWorkspace = toCompatibilityWorkspace(workspace);
  const errorCount = countErrorDiagnostics(diagnostics);

  return {
    status: errorCount > 0 ? 'invalid' : 'valid',
    workspaceName: workspace.name,
    projectCount: compatibilityWorkspace.projects.length,
    dependencyCount: compatibilityWorkspace.dependencies.length,
    errorCount,
    diagnosticCount: diagnostics.length,
    warningCount: countWarningDiagnostics(diagnostics),
  };
}

function getDiagnosticSeverity(
  diagnostic: GovernanceDiagnostic,
): GovernanceDiagnostic['severity'] | undefined {
  if (typeof diagnostic.severity === 'string') {
    return diagnostic.severity;
  }

  const details = diagnostic.details as
    | {
        severity?: unknown;
      }
    | undefined;

  return typeof details?.severity === 'string' ? details.severity : undefined;
}

function isErrorDiagnostic(diagnostic: GovernanceDiagnostic): boolean {
  return getDiagnosticSeverity(diagnostic) === 'error';
}

function countErrorDiagnostics(diagnostics: GovernanceDiagnostic[]): number {
  return diagnostics.filter(isErrorDiagnostic).length;
}

function countWarningDiagnostics(diagnostics: GovernanceDiagnostic[]): number {
  return diagnostics.filter(
    (diagnostic) => getDiagnosticSeverity(diagnostic) === 'warning',
  ).length;
}
