import { statSync } from 'node:fs';
import path from 'node:path';

import { detectTypeScriptWorkspace } from '@anarchitects/governance-adapter-typescript';
import type {
  GovernanceAssessment,
  GovernanceExceptionReport,
  GovernanceProfile,
  GovernanceWorkspace,
} from '@anarchitects/governance-core';
import { buildGovernanceAssessment } from '@anarchitects/governance-core';
import {
  calculateHealthScore,
  buildRecommendations,
} from './internal/health-engine/calculate-health.js';
import {
  GenericWorkspaceLoadError,
  loadGenericWorkspace,
} from './internal/manual-workspace/load-workspace.js';
import { calculateMetrics } from './internal/metric-engine/calculate-metrics.js';
import { evaluatePolicies } from './internal/policy-engine/evaluate-policies.js';
import { loadStandaloneGovernanceProfile } from './internal/profile/load-standalone-profile.js';
import { buildPolicySignals } from './internal/signal-engine/index.js';

export interface AgovCheckOptions {
  workspacePath: string;
  profilePath: string;
}

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

export function runAgovCheck(options: AgovCheckOptions): AgovCheckResult {
  assertSupportedStandaloneWorkspaceInput(options.workspacePath);
  const workspace = loadGenericWorkspace(options.workspacePath).workspace;
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

function assertSupportedStandaloneWorkspaceInput(workspacePath: string): void {
  const resolvedPath = path.resolve(workspacePath);

  try {
    if (!statSync(resolvedPath).isDirectory()) {
      return;
    }
  } catch {
    return;
  }

  const detectedWorkspace = detectTypeScriptWorkspace(resolvedPath);

  if (detectedWorkspace.supported || detectedWorkspace.status === 'partial') {
    throw new GenericWorkspaceLoadError(
      `Directory input "${resolvedPath}" looks like a TypeScript workspace host. The extracted standalone CLI still expects a manual governance workspace file path. Pass a .json, .yaml, or .yml workspace document instead.`,
      'governance.workspace_loader.unsupported_extension',
      resolvedPath,
    );
  }
}
