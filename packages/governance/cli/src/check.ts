import type {
  GovernanceAssessment,
  GovernanceAssessmentArtifacts,
  GovernanceExtensionDiagnostic,
  GovernanceLoadedExtension,
  GovernanceSignal,
  GovernanceSignalSeverity,
  GovernanceSignalSource,
  GovernanceTopSignal,
  GovernanceWorkspaceAdapter,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';
import * as governanceCore from '@anarchitects/governance-core';
import { loadGenericWorkspaceAdapterResult } from './internal/manual-workspace/load-workspace.js';
import { loadStandaloneGovernanceProfile } from './internal/profile/load-standalone-profile.js';

type GovernanceGraph = ReturnType<
  typeof governanceCore.normalizeGovernanceGraph
>;

const TOP_SIGNAL_SOURCE_ORDER: Record<GovernanceSignalSource, number> = {
  graph: 0,
  conformance: 1,
  policy: 2,
  extension: 3,
};

const TOP_SIGNAL_SEVERITY_ORDER: Record<GovernanceSignalSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

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

export type AgovAssessOptions<TInput = unknown> = AgovCheckOptions<TInput> & {
  includeTopSignals?: boolean;
};

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
      includeTopSignals: options.includeTopSignals,
      workspace,
      capabilities,
      diagnostics,
      extensionRegistry: extensionRegistration.registry,
      extensionContext,
      extensionDiagnostics: extensionRegistration.diagnostics,
    })
    .then((artifacts) => {
      const assessment = normalizeAssessmentTopSignals(artifacts, options);

      return {
        command: 'assess',
        success: !assessment.violations.some(
          (violation) => violation.severity === 'error',
        ),
        assessment,
        artifacts:
          assessment === artifacts.assessment
            ? artifacts
            : { ...artifacts, assessment },
        graph,
      };
    });
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
    ...(options.includeTopSignals
      ? { includeTopSignals: options.includeTopSignals }
      : {}),
    ...(options.workspacePath ? { workspacePath: options.workspacePath } : {}),
    ...('workspaceAdapter' in options && options.workspaceAdapter
      ? { workspaceAdapterId: options.workspaceAdapter.id }
      : {}),
  };
}

function normalizeAssessmentTopSignals<TInput>(
  artifacts: GovernanceAssessmentArtifacts,
  options: AgovAssessOptions<TInput>,
): GovernanceAssessment {
  if (!options.includeTopSignals || artifacts.assessment.topSignals) {
    return artifacts.assessment;
  }

  return {
    ...artifacts.assessment,
    topSignals: buildFallbackTopSignals(artifacts.signals),
  };
}

function buildFallbackTopSignals(
  signals: GovernanceSignal[],
): GovernanceTopSignal[] {
  const groups = new Map<string, GovernanceTopSignal>();

  for (const signal of signals) {
    const key = [
      signal.type,
      signal.source,
      signal.severity,
      signal.nodeId ?? '',
      signal.relationId ?? '',
      (signal.relatedNodeIds ?? []).join(','),
      (signal.relatedRelationIds ?? []).join(','),
    ].join('|');
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      existing.subjects = [
        ...new Set([...existing.subjects, ...subjectsFromSignal(signal)]),
      ].sort((left, right) => left.localeCompare(right));
      if (!existing.ruleId) {
        existing.ruleId = readRuleId(signal);
      }
      if (!existing.sourcePluginId) {
        existing.sourcePluginId = signal.sourcePluginId;
      }
      continue;
    }

    groups.set(key, {
      type: signal.type,
      source: signal.source,
      severity: signal.severity,
      count: 1,
      subjects: subjectsFromSignal(signal),
      ruleId: readRuleId(signal),
      message: signal.message,
      sourcePluginId: signal.sourcePluginId,
    });
  }

  return [...groups.values()].sort(
    (left: GovernanceTopSignal, right: GovernanceTopSignal) => {
    const sourceOrder =
      TOP_SIGNAL_SOURCE_ORDER[left.source] -
      TOP_SIGNAL_SOURCE_ORDER[right.source];
    if (sourceOrder !== 0) {
      return sourceOrder;
    }

    const severityOrder =
      TOP_SIGNAL_SEVERITY_ORDER[left.severity] -
      TOP_SIGNAL_SEVERITY_ORDER[right.severity];
    if (severityOrder !== 0) {
      return severityOrder;
    }

    const typeOrder = left.type.localeCompare(right.type);
    if (typeOrder !== 0) {
      return typeOrder;
    }

    const subjectsOrder = left.subjects
      .join(',')
      .localeCompare(right.subjects.join(','));
    if (subjectsOrder !== 0) {
      return subjectsOrder;
    }

      return left.message.localeCompare(right.message);
    },
  );
}

function subjectsFromSignal(signal: GovernanceSignal): string[] {
  return [
    ...new Set(
      [
        signal.nodeId,
        signal.relationId,
        ...(signal.relatedNodeIds ?? []),
        ...(signal.relatedRelationIds ?? []),
      ].filter((value): value is string => Boolean(value)),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function readRuleId(signal: GovernanceSignal): string | undefined {
  const ruleId = signal.metadata?.ruleId;
  return typeof ruleId === 'string' && ruleId.length > 0 ? ruleId : undefined;
}
