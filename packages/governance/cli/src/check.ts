import type {
  GovernanceAssessment,
  GovernanceExceptionReport,
  GovernanceProfile,
  GovernanceWorkspaceAdapter,
  GovernanceWorkspaceAdapterResult,
  GovernanceWorkspace,
} from '@anarchitects/governance-core';
import {
  buildGovernancePolicySignals,
  buildGovernanceRecommendations,
  buildGovernanceAssessment,
  buildGovernanceWorkspace,
  buildTopIssues,
  calculateGovernanceHealth,
  calculateGovernanceMetrics,
  evaluateGovernancePolicies,
} from '@anarchitects/governance-core';
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
}

const EMPTY_EXCEPTION_REPORT: GovernanceExceptionReport = {
  summary: {
    declaredCount: 0,
    matchedCount: 0,
    suppressedPolicyViolationCount: 0,
    suppressedConformanceFindingCount: 0,
    unusedExceptionCount: 0,
    activeExceptionCount: 0,
    staleExceptionCount: 0,
    expiredExceptionCount: 0,
    reactivatedPolicyViolationCount: 0,
    reactivatedConformanceFindingCount: 0,
  },
  used: [],
  unused: [],
  suppressedFindings: [],
  reactivatedFindings: [],
};

const MANUAL_WORKSPACE_ADAPTER: GovernanceWorkspaceAdapter<string> = {
  id: 'governance-cli:manual-workspace',
  loadWorkspace(workspacePath: string): GovernanceWorkspaceAdapterResult {
    return loadGenericWorkspaceAdapterResult(workspacePath);
  },
};

export function runAgovCheck<TInput = unknown>(
  options: AgovCheckOptions<TInput>,
): AgovCheckResult {
  const workspace = resolveWorkspace(options);
  const profile = loadStandaloneGovernanceProfile(options.profilePath).profile;
  const assessment = buildStandaloneGovernanceAssessment({
    workspace,
    profile,
  });

  return {
    command: 'check',
    success: !assessment.violations.some(
      (violation) => violation.severity === 'error',
    ),
    assessment,
  };
}

export function runAgovAssess<TInput = unknown>(
  options: AgovAssessOptions<TInput>,
): AgovAssessResult {
  const result = runAgovCheck(options);

  return {
    command: 'assess',
    success: result.success,
    assessment: result.assessment,
  };
}

function buildStandaloneGovernanceAssessment(input: {
  workspace: GovernanceWorkspace;
  profile: GovernanceProfile;
}): GovernanceAssessment {
  const violations = evaluateGovernancePolicies(input.workspace, input.profile);
  const signals = buildGovernancePolicySignals(violations, {
    createdAt: '1970-01-01T00:00:00.000Z',
  });
  const measurements = calculateGovernanceMetrics({
    workspace: input.workspace,
    signals,
  });
  const health = calculateGovernanceHealth(
    measurements,
    input.profile.metrics,
    input.profile.health.statusThresholds,
    {
      topIssues: buildTopIssues(signals),
    },
  );

  return buildGovernanceAssessment({
    workspace: input.workspace,
    profile: input.profile.name,
    warnings: [],
    exceptions: EMPTY_EXCEPTION_REPORT,
    violations,
    signals,
    measurements,
    health,
    recommendations: buildGovernanceRecommendations(violations, measurements),
  });
}

function resolveWorkspace<TInput>(
  options: AgovCheckOptions<TInput>,
): GovernanceWorkspace {
  if ('workspaceAdapter' in options && options.workspaceAdapter) {
    return buildGovernanceWorkspace(
      options.workspaceAdapter.loadWorkspace(options.workspaceAdapterInput),
    );
  }

  return buildGovernanceWorkspace(
    MANUAL_WORKSPACE_ADAPTER.loadWorkspace(options.workspacePath),
  );
}
