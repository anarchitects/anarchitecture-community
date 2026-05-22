import type {
  GovernanceAssessment,
  GovernanceExceptionReport,
  GovernanceProfile,
  GovernanceWorkspaceAdapter,
  GovernanceWorkspaceAdapterResult,
  GovernanceWorkspace,
} from '@anarchitects/governance-core';
import {
  buildGovernanceAssessment,
  buildGovernanceWorkspace,
} from '@anarchitects/governance-core';
import {
  calculateHealthScore,
  buildRecommendations,
} from './internal/health-engine/calculate-health.js';
import { loadGenericWorkspaceAdapterResult } from './internal/manual-workspace/load-workspace.js';
import { calculateMetrics } from './internal/metric-engine/calculate-metrics.js';
import { evaluatePolicies } from './internal/policy-engine/evaluate-policies.js';
import { loadStandaloneGovernanceProfile } from './internal/profile/load-standalone-profile.js';
import { buildPolicySignals } from './internal/signal-engine/index.js';

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

export interface AgovCheckResult {
  command: 'check';
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

function buildStandaloneGovernanceAssessment(input: {
  workspace: GovernanceWorkspace;
  profile: GovernanceProfile;
}): GovernanceAssessment {
  const violations = evaluatePolicies(input.workspace, input.profile);
  const signals = buildPolicySignals(violations, {
    createdAt: '1970-01-01T00:00:00.000Z',
  });
  const measurements = calculateMetrics({
    workspace: input.workspace,
    signals,
  });
  const assessmentPreview = buildGovernanceAssessment({
    workspace: input.workspace,
    profile: input.profile.name,
    exceptions: EMPTY_EXCEPTION_REPORT,
    violations,
    signals,
    measurements,
    health: calculateHealthScore(measurements, input.profile.metrics),
    recommendations: buildRecommendations(violations, measurements),
  });
  const health = calculateHealthScore(
    measurements,
    input.profile.metrics,
    input.profile.health.statusThresholds,
    {
      topIssues: assessmentPreview.topIssues,
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
    recommendations: buildRecommendations(violations, measurements),
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
