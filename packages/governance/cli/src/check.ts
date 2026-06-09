import type {
  GovernanceAssessment,
  GovernanceAssessmentArtifacts,
  GovernanceExtensionDiagnostic,
  GovernanceLoadedExtension,
  GovernanceWorkspaceAdapter,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';
import * as governanceCore from '@anarchitects/governance-core';
import { loadGenericWorkspaceAdapterResult } from './internal/manual-workspace/load-workspace.js';
import { loadStandaloneGovernanceProfile } from './internal/profile/load-standalone-profile.js';

type GovernanceGraph = ReturnType<typeof governanceCore.normalizeGovernanceGraph>;

export interface AgovCheckWithWorkspacePathOptions {
  profilePath: string;
  workspacePath: string;
  workspaceAdapter?: undefined;
  workspaceAdapterInput?: undefined;
  extensions?: readonly GovernanceLoadedExtension[];
  extensionDiagnostics?: readonly GovernanceExtensionDiagnostic[];
}

export interface AgovCheckWithAdapterOptions<TInput = unknown> {
  profilePath: string;
  workspaceAdapter: GovernanceWorkspaceAdapter<TInput>;
  workspaceAdapterInput: TInput;
  workspacePath?: undefined;
  extensions?: readonly GovernanceLoadedExtension[];
  extensionDiagnostics?: readonly GovernanceExtensionDiagnostic[];
}

export type AgovCheckOptions<TInput = unknown> =
  | AgovCheckWithWorkspacePathOptions
  | AgovCheckWithAdapterOptions<TInput>;

export type AgovAssessOptions<TInput = unknown> = AgovCheckOptions<TInput>;

export interface AgovCheckResult {
  command: 'check';
  success: boolean;
  assessment: GovernanceAssessment;
  artifacts: GovernanceAssessmentArtifacts;
  graph: GovernanceGraph;
}

export interface AgovAssessResult {
  command: 'assess';
  success: boolean;
  assessment: GovernanceAssessment;
  artifacts: GovernanceAssessmentArtifacts;
  graph: GovernanceGraph;
}

const MANUAL_WORKSPACE_ADAPTER: GovernanceWorkspaceAdapter<string> = {
  id: 'governance-cli:manual-workspace',
  loadWorkspace(workspacePath: string): GovernanceWorkspaceAdapterResult {
    return loadGenericWorkspaceAdapterResult(workspacePath);
  },
};

export function runAgovCheck<TInput = unknown>(
  options: AgovCheckOptions<TInput>,
): Promise<AgovCheckResult> {
  return runAgovAssess(options).then((result) => {
    const success = !result.assessment.violations.some(
      (violation) => violation.severity === 'error',
    );

    return {
      command: 'check',
      success,
      assessment: result.assessment,
      artifacts: result.artifacts,
      graph: result.graph,
    };
  });
}

export async function runAgovAssess<TInput = unknown>(
  options: AgovAssessOptions<TInput>,
): Promise<AgovAssessResult> {
  const profile = loadStandaloneGovernanceProfile(options.profilePath).profile;
  const workspaceAdapterResult = resolveWorkspaceAdapterResult(options);
  const graph = governanceCore.normalizeGovernanceGraph(workspaceAdapterResult);
  const workspace = governanceCore.buildGovernanceWorkspace(
    workspaceAdapterResult,
  );
  const capabilities = [...(workspaceAdapterResult.capabilities ?? [])];
  const diagnostics = [...(workspaceAdapterResult.diagnostics ?? [])];
  const extensionContext = {
    workspaceRoot: workspace.root,
    profileName: profile.name,
    options: buildExtensionOptions(options),
    inventory: workspace,
    capabilities: new governanceCore.DefaultGovernanceCapabilityRegistry(
      capabilities,
    ),
  };
  const extensionRegistration =
    await governanceCore.registerLoadedGovernanceExtensionsWithDiagnostics(
      extensionContext,
      options.extensions ?? [],
      {
        diagnostics: options.extensionDiagnostics ?? [],
      },
    );

  return governanceCore
    .buildGovernanceAssessmentArtifacts({
      profile,
      workspace,
      capabilities,
      diagnostics,
      extensionRegistry: extensionRegistration.registry,
      extensionContext,
      extensionDiagnostics: extensionRegistration.diagnostics,
    })
    .then((artifacts) => ({
      command: 'assess',
      success: !artifacts.assessment.violations.some(
        (violation) => violation.severity === 'error',
      ),
      assessment: artifacts.assessment,
      artifacts,
      graph,
    }));
}

function resolveWorkspaceAdapterResult<TInput>(
  options: AgovCheckOptions<TInput>,
): GovernanceWorkspaceAdapterResult {
  if ('workspaceAdapter' in options && options.workspaceAdapter) {
    return options.workspaceAdapter.loadWorkspace(
      options.workspaceAdapterInput,
    );
  }

  return MANUAL_WORKSPACE_ADAPTER.loadWorkspace(options.workspacePath);
}

function buildExtensionOptions<TInput>(
  options: AgovAssessOptions<TInput>,
): Readonly<Record<string, unknown>> {
  return {
    profilePath: options.profilePath,
    ...(options.workspacePath ? { workspacePath: options.workspacePath } : {}),
    ...('workspaceAdapter' in options && options.workspaceAdapter
      ? { workspaceAdapterId: options.workspaceAdapter.id }
      : {}),
  };
}
