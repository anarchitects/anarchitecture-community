import type {
  GovernanceAssessment,
  GovernanceAssessmentArtifacts,
  GovernanceWorkspaceAdapter,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';
import * as governanceCore from '@anarchitects/governance-core';
import { loadGenericWorkspaceAdapterResult } from './internal/manual-workspace/load-workspace.js';
import { loadStandaloneGovernanceProfile } from './internal/profile/load-standalone-profile.js';

export interface AgovCheckWithWorkspacePathOptions {
  profilePath: string;
  workspacePath: string;
  workspaceAdapter?: undefined;
  workspaceAdapterInput?: undefined;
}

export interface AgovCheckWithAdapterOptions<TInput = unknown> {
  profilePath: string;
  workspaceAdapter: GovernanceWorkspaceAdapter<TInput>;
  workspaceAdapterInput: TInput;
  workspacePath?: undefined;
}

export type AgovCheckOptions<TInput = unknown> =
  | AgovCheckWithWorkspacePathOptions
  | AgovCheckWithAdapterOptions<TInput>;

export type AgovAssessOptions<TInput = unknown> = AgovCheckOptions<TInput>;

export interface AgovCheckResult {
  command: 'check';
  success: boolean;
  assessment: GovernanceAssessment;
}

export interface AgovAssessResult {
  command: 'assess';
  success: boolean;
  assessment: GovernanceAssessment;
  artifacts: GovernanceAssessmentArtifacts;
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
    };
  });
}

export function runAgovAssess<TInput = unknown>(
  options: AgovAssessOptions<TInput>,
): Promise<AgovAssessResult> {
  const profile = loadStandaloneGovernanceProfile(options.profilePath).profile;
  const workspaceAdapterResult = resolveWorkspaceAdapterResult(options);

  return governanceCore
    .buildGovernanceAssessmentArtifacts({
      profile,
      workspaceAdapterResult,
    })
    .then((artifacts) => ({
      command: 'assess',
      success: !artifacts.assessment.violations.some(
        (violation) => violation.severity === 'error',
      ),
      assessment: artifacts.assessment,
      artifacts,
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
