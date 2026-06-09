import type {
  GovernanceCapability,
  GovernanceDiagnostic,
  GovernanceWorkspaceAdapterResult,
} from '../adapter/adapter.js';
import { buildGovernanceWorkspace } from '../adapter/adapter.js';
import { toGovernanceCompatibilityWorkspace } from '../compatibility/internal-workspace.js';
import { buildGovernanceAssessment, buildTopIssues } from './assessment.js';
import {
  applyGovernanceExceptions,
  buildGovernanceExceptionReport,
  createEmptyGovernanceExceptionReport,
  type GovernanceExceptionApplicationResult,
} from '../diagnostics/exception-runtime.js';
import {
  applyGovernanceEnrichers,
  collectGovernanceMeasurements,
  collectGovernanceSignals,
  evaluateGovernanceRulePacks,
  type GovernanceExtensionDiagnostic,
  type GovernanceExtensionHostContext,
  type GovernanceExtensionRegistry,
} from '../../extensions/index.js';
import {
  buildGovernanceRecommendations,
  calculateGovernanceHealth,
} from './health.js';
import { calculateGovernanceMetrics } from './metrics.js';
import type {
  GovernanceAssessment,
  GovernanceWorkspace,
  Measurement,
  Recommendation,
  Violation,
} from '../model/models.js';
import type { GovernanceException } from '../diagnostics/exceptions.js';
import type { GovernanceProfile } from './profile.js';
import { evaluateGovernancePolicies } from './built-in-rules.js';
import {
  buildGovernanceConformanceSignals,
  buildGovernanceGraphSignals,
  buildGovernancePolicySignals,
  mergeGovernanceSignals,
  type GovernanceConformanceFinding,
  type GovernanceConformanceSnapshot,
  type GovernanceGraphSnapshot,
} from './signal-builders.js';
import type { GovernanceSignal } from './signals.js';

export interface BuildGovernanceAssessmentArtifactsInput {
  profile: GovernanceProfile;
  workspaceAdapterResult?: GovernanceWorkspaceAdapterResult;
  workspace?: GovernanceWorkspace;
  warnings?: string[];
  exceptions?: GovernanceException[];
  conformanceFindings?: GovernanceConformanceFinding[];
  graphSnapshot?: GovernanceGraphSnapshot;
  capabilities?: GovernanceCapability[];
  diagnostics?: GovernanceDiagnostic[];
  extensionRegistry?: GovernanceExtensionRegistry;
  extensionContext?: GovernanceExtensionHostContext;
  extensionDiagnostics?: GovernanceExtensionDiagnostic[];
  asOf?: Date;
}

export interface GovernanceAssessmentArtifacts {
  workspace: GovernanceWorkspace;
  assessment: GovernanceAssessment;
  violations: Violation[];
  signals: GovernanceSignal[];
  measurements: Measurement[];
  recommendations: Recommendation[];
  exceptionApplication: GovernanceExceptionApplicationResult;
  extensionDiagnostics: GovernanceExtensionDiagnostic[];
  capabilities: GovernanceCapability[];
  diagnostics: GovernanceDiagnostic[];
}

export async function buildGovernanceAssessmentArtifacts(
  input: BuildGovernanceAssessmentArtifactsInput,
): Promise<GovernanceAssessmentArtifacts> {
  const workspace = resolveWorkspace(input);
  const extensionDiagnostics = [...(input.extensionDiagnostics ?? [])];
  const diagnostics = [...(input.diagnostics ?? [])];
  const capabilities = [...(input.capabilities ?? [])];
  const registry = input.extensionRegistry;
  const context = input.extensionContext;

  const enrichedWorkspace =
    registry && context
      ? await applyGovernanceEnrichers(registry, {
          workspace,
          profile: input.profile,
          context,
        })
      : workspace;

  const builtInViolations = evaluateGovernancePolicies({
    workspace: enrichedWorkspace,
    profile: input.profile,
  });
  const exceptionApplication = applyGovernanceExceptions({
    exceptions: input.exceptions ?? [],
    policyViolations: builtInViolations,
    conformanceFindings: input.conformanceFindings ?? [],
    asOf: input.asOf ?? new Date(),
  });
  const extensionViolations =
    registry && context
      ? await evaluateGovernanceRulePacks(registry, {
          workspace: enrichedWorkspace,
          profile: input.profile,
          context,
        })
      : [];
  const violations = [
    ...exceptionApplication.activePolicyViolations,
    ...extensionViolations,
  ];

  const graphSignals = buildGovernanceGraphSignals(
    input.graphSnapshot ?? buildGraphSnapshotFromWorkspace(enrichedWorkspace),
  );
  const policySignals = buildGovernancePolicySignals(
    exceptionApplication.activePolicyViolations,
    {
      createdAt: input.graphSnapshot?.extractedAt ?? new Date().toISOString(),
    },
  );
  const conformanceSignals =
    exceptionApplication.activeConformanceFindings.length > 0
      ? buildGovernanceConformanceSignals({
          extractedAt:
            input.graphSnapshot?.extractedAt ?? new Date().toISOString(),
          findings: exceptionApplication.activeConformanceFindings,
        } satisfies GovernanceConformanceSnapshot)
      : [];
  const coreSignals = mergeGovernanceSignals(
    graphSignals,
    conformanceSignals,
    policySignals,
  );
  const extensionSignals =
    registry && context
      ? await collectGovernanceSignals(registry, {
          workspace: enrichedWorkspace,
          profile: input.profile,
          violations,
          signals: coreSignals,
          context,
        })
      : [];
  const signals = mergeGovernanceSignals(coreSignals, extensionSignals);

  const coreMeasurements = calculateGovernanceMetrics({
    workspace: enrichedWorkspace,
    signals,
  });
  const extensionMeasurements =
    registry && context
      ? await collectGovernanceMeasurements(registry, {
          workspace: enrichedWorkspace,
          profile: input.profile,
          signals,
          measurements: coreMeasurements,
          violations,
          context,
        })
      : [];
  const measurements = [...coreMeasurements, ...extensionMeasurements];
  const topIssues = buildTopIssues(signals);
  const recommendations = buildGovernanceRecommendations(
    violations,
    measurements,
  );
  const health = calculateGovernanceHealth(
    measurements,
    input.profile.metrics,
    input.profile.health.statusThresholds,
    {
      topIssues,
    },
  );
  const assessment = buildGovernanceAssessment({
    workspace: enrichedWorkspace,
    profile: input.profile.name,
    warnings: input.warnings ?? [],
    exceptions:
      input.exceptions && input.exceptions.length > 0
        ? buildGovernanceExceptionReport(exceptionApplication)
        : createEmptyGovernanceExceptionReport(),
    violations,
    signals,
    measurements,
    health,
    recommendations,
  });

  return {
    workspace: enrichedWorkspace,
    assessment,
    violations,
    signals,
    measurements,
    recommendations,
    exceptionApplication,
    extensionDiagnostics,
    capabilities,
    diagnostics,
  };
}

function resolveWorkspace(
  input: BuildGovernanceAssessmentArtifactsInput,
): GovernanceWorkspace {
  if (input.workspace) {
    return input.workspace;
  }

  if (input.workspaceAdapterResult) {
    return buildGovernanceWorkspace(input.workspaceAdapterResult);
  }

  throw new Error(
    'buildGovernanceAssessmentArtifacts requires either workspace or workspaceAdapterResult.',
  );
}

function buildGraphSnapshotFromWorkspace(
  workspace: GovernanceWorkspace,
): GovernanceGraphSnapshot {
  const compatibilityWorkspace = toGovernanceCompatibilityWorkspace(workspace);

  return {
    extractedAt: new Date().toISOString(),
    projects: compatibilityWorkspace.projects.map((project) => ({
      id: project.id,
      domain: project.domain,
    })),
    dependencies: compatibilityWorkspace.dependencies.map((dependency) => ({
      sourceProjectId: dependency.source,
      targetProjectId: dependency.target,
      type: dependency.type,
    })),
  };
}
