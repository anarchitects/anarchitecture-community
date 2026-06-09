import { createHash } from 'node:crypto';

import type {
  GovernanceDiagnostic,
  GovernanceSignal,
  Measurement,
  Recommendation,
  Violation,
} from '@anarchitects/governance-core';

import type {
  DbtGovernanceRecommendationProvider,
  DbtGovernanceRecommendationProviderInput,
} from './contracts.js';
import { buildDbtGovernanceDiagnostics } from './diagnostics.js';
import { buildDbtGovernanceMetrics } from './metrics.js';
import { evaluateDbtArchitectureViolations } from './rule-pack.js';
import { buildDbtGovernanceSignals } from './signals.js';
import {
  resolveDbtGovernanceMetadata,
  type DbtGovernanceMetadataResolution,
  type DbtGovernanceMetadataResolverInput,
} from './resolvers.js';
import { toCompatibilityWorkspace } from './workspace-compat.js';

export const DBT_GOVERNANCE_RECOMMENDATION_CODES = [
  'ADD_OWNER',
  'ADD_DESCRIPTION',
  'ADD_TESTS',
  'ENABLE_CONTRACT',
  'REVIEW_CROSS_DOMAIN_DEPENDENCY',
  'REDUCE_HIGH_FAN_IN',
  'FIX_LAYER_DEPENDENCY',
] as const;

export type DbtGovernanceRecommendationCode =
  (typeof DBT_GOVERNANCE_RECOMMENDATION_CODES)[number];

export interface DbtGovernanceRecommendationMetadata
  extends Record<string, unknown> {
  code: DbtGovernanceRecommendationCode;
  governanceNodeId?: string;
  dbtUniqueId?: string;
  dependencyKey?: string;
  triggerDiagnosticCodes?: string[];
  triggerDiagnosticIds?: string[];
  triggerSignalCodes?: string[];
  triggerSignalIds?: string[];
  triggerViolationIds?: string[];
  triggerMeasurementIds?: string[];
}

export interface DbtGovernanceExtensionRecommendation extends Recommendation {
  metadata?: DbtGovernanceRecommendationMetadata;
}

interface DbtProjectLike {
  id: string;
  name?: string;
  root?: string;
  tags?: readonly string[];
  domain?: string;
  layer?: string;
  ownership?: unknown;
  metadata?: Record<string, unknown>;
}

interface RecommendationContext {
  metadataResolutions: readonly DbtGovernanceMetadataResolution[];
  diagnostics: readonly GovernanceDiagnostic[];
  signals: readonly GovernanceSignal[];
  violations: readonly Violation[];
  measurements: readonly Measurement[];
}

interface RecommendationDraft {
  code: DbtGovernanceRecommendationCode;
  title: string;
  priority: Recommendation['priority'];
  reason: string;
  description: string;
  category: string;
  governanceNodeId?: string;
  dbtUniqueId?: string;
  dependencyKey?: string;
  sourceProjectId?: string;
  targetProjectId?: string;
  relatedProjectIds: string[];
  triggerDiagnosticCodes: string[];
  triggerDiagnosticIds: string[];
  triggerSignalCodes: string[];
  triggerSignalIds: string[];
  triggerViolationIds: string[];
  triggerMeasurementIds: string[];
}

const DEFAULT_PROVIDER_ID = 'dbt-governance-recommendations';

export const dbtGovernanceRecommendationProvider =
  createDbtGovernanceRecommendationProvider();

export function createDbtGovernanceRecommendationProvider(): DbtGovernanceRecommendationProvider {
  return {
    id: DEFAULT_PROVIDER_ID,
    provideRecommendations: (input) => buildDbtGovernanceRecommendations(input),
  };
}

export function buildDbtGovernanceRecommendations(
  input: DbtGovernanceRecommendationProviderInput,
): DbtGovernanceExtensionRecommendation[] {
  const context = resolveRecommendationContext(input);
  const resolutionByNodeId = new Map(
    context.metadataResolutions.map((resolution) => [
      resolution.governanceNodeId,
      resolution,
    ]),
  );
  const drafts = [
    ...buildAddOwnerRecommendations(context, resolutionByNodeId),
    ...buildAddDescriptionRecommendations(context, resolutionByNodeId),
    ...buildAddTestsRecommendations(context, resolutionByNodeId),
    ...buildEnableContractRecommendations(context, resolutionByNodeId),
    ...buildReviewCrossDomainDependencyRecommendations(
      context,
      resolutionByNodeId,
    ),
    ...buildReduceHighFanInRecommendations(context, resolutionByNodeId),
    ...buildFixLayerDependencyRecommendations(context, resolutionByNodeId),
  ];

  return dedupeAndSortRecommendations(drafts, input.recommendations);
}

function resolveRecommendationContext(
  input: DbtGovernanceRecommendationProviderInput,
): RecommendationContext {
  const compatibilityWorkspace = toCompatibilityWorkspace(input.workspace);
  const metadataResolutions =
    input.metadataResolutions && input.metadataResolutions.length > 0
      ? input.metadataResolutions
      : compatibilityWorkspace.projects
          .filter((project) => hasDbtMetadata(project.metadata))
          .map((project) =>
            resolveDbtGovernanceMetadata(toResolverInput(project)),
          );
  const diagnostics =
    input.diagnostics.length > 0
      ? input.diagnostics
      : buildDbtGovernanceDiagnostics({
          workspace: input.workspace,
          profile: input.profile,
          context: input.context,
          violations: input.violations,
          signals: input.signals,
          measurements: input.measurements,
          diagnostics: [],
          metadataResolutions,
        });
  const violations =
    input.violations.length > 0
      ? input.violations
      : evaluateDbtArchitectureViolations({
          workspace: input.workspace,
          profile: input.profile,
          context: input.context,
          diagnostics,
          signals: input.signals,
          metadataResolutions,
        });
  const signals =
    input.signals.length > 0
      ? input.signals
      : buildDbtGovernanceSignals({
          workspace: input.workspace,
          profile: input.profile,
          context: input.context,
          violations,
          signals: [],
          diagnostics,
          metadataResolutions,
        });
  const measurements =
    input.measurements.length > 0
      ? input.measurements
      : buildDbtGovernanceMetrics({
          workspace: input.workspace,
          profile: input.profile,
          context: input.context,
          violations,
          signals,
          diagnostics,
          measurements: [],
          metadataResolutions,
        });

  return {
    metadataResolutions,
    diagnostics,
    signals,
    violations,
    measurements,
  };
}

function buildAddOwnerRecommendations(
  context: RecommendationContext,
  resolutionByNodeId: Map<string, DbtGovernanceMetadataResolution>,
): RecommendationDraft[] {
  const byNodeId = new Map<string, RecommendationDraft>();

  for (const diagnostic of context.diagnostics) {
    if (diagnostic.code !== 'DBT_OWNER_MISSING') {
      continue;
    }

    const nodeId = readDiagnosticNodeId(diagnostic);
    if (!nodeId) {
      continue;
    }

    upsertDraft(
      byNodeId,
      nodeId,
      createNodeRecommendationDraft({
        code: 'ADD_OWNER',
        title: 'Add dbt owner metadata',
        priority: 'medium',
        reason:
          'Owner metadata is missing, which weakens dbt accountability and governance interpretation.',
        description:
          'Add owner metadata using project.ownership.team, metadata.dbt.resource.owner, metadata.dbt.resource.group, or metadata.dbt.resource.meta.owner.',
        category: 'ownership',
        governanceNodeId: nodeId,
        dbtUniqueId: resolutionByNodeId.get(nodeId)?.dbtUniqueId,
        diagnostic: {
          id: diagnostic.id,
          code: diagnostic.code,
        },
      }),
    );
  }

  for (const signal of context.signals) {
    if (signal.metadata?.code !== 'DBT_OWNER_MISSING' || !signal.nodeId) {
      continue;
    }

    upsertDraft(
      byNodeId,
      signal.nodeId,
      createNodeRecommendationDraft({
        code: 'ADD_OWNER',
        title: 'Add dbt owner metadata',
        priority: 'medium',
        reason:
          'Owner metadata is missing, which weakens dbt accountability and governance interpretation.',
        description:
          'Add owner metadata using project.ownership.team, metadata.dbt.resource.owner, metadata.dbt.resource.group, or metadata.dbt.resource.meta.owner.',
        category: 'ownership',
        governanceNodeId: signal.nodeId,
        dbtUniqueId:
          asString(signal.metadata?.dbtUniqueId) ??
          resolutionByNodeId.get(signal.nodeId)?.dbtUniqueId,
        signal,
      }),
    );
  }

  for (const violation of context.violations) {
    if (violation.ruleId !== 'dbt/critical-models-require-owner') {
      continue;
    }

    const nodeId = readViolationNodeId(violation);
    if (!nodeId) {
      continue;
    }

    upsertDraft(
      byNodeId,
      nodeId,
      createNodeRecommendationDraft({
        code: 'ADD_OWNER',
        title: 'Add dbt owner metadata',
        priority: 'high',
        reason:
          'A critical dbt model is missing owner metadata required by the active governance rules.',
        description:
          'Add explicit owner metadata so the critical model has a clear accountable team.',
        category: 'ownership',
        governanceNodeId: nodeId,
        dbtUniqueId: resolutionByNodeId.get(nodeId)?.dbtUniqueId,
        violation,
      }),
    );
  }

  return [...byNodeId.values()];
}

function buildAddDescriptionRecommendations(
  context: RecommendationContext,
  resolutionByNodeId: Map<string, DbtGovernanceMetadataResolution>,
): RecommendationDraft[] {
  const byNodeId = new Map<string, RecommendationDraft>();

  for (const signal of context.signals) {
    if (
      signal.metadata?.code !== 'DBT_DESCRIPTION_MISSING' &&
      signal.metadata?.code !== 'DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE'
    ) {
      continue;
    }

    if (!signal.nodeId) {
      continue;
    }

    upsertDraft(
      byNodeId,
      signal.nodeId,
      createNodeRecommendationDraft({
        code: 'ADD_DESCRIPTION',
        title: 'Add dbt model description',
        priority:
          signal.metadata?.code === 'DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE'
            ? 'high'
            : 'medium',
        reason:
          signal.metadata?.code === 'DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE'
            ? 'A public/governed dbt model is undocumented.'
            : 'This dbt model is missing descriptive documentation.',
        description:
          'Add a dbt description so downstream consumers understand the model purpose and usage.',
        category: 'documentation',
        governanceNodeId: signal.nodeId,
        dbtUniqueId:
          asString(signal.metadata?.dbtUniqueId) ??
          resolutionByNodeId.get(signal.nodeId)?.dbtUniqueId,
        signal,
      }),
    );
  }

  for (const violation of context.violations) {
    if (violation.ruleId !== 'dbt/public-models-require-description') {
      continue;
    }

    const nodeId = readViolationNodeId(violation);
    if (!nodeId) {
      continue;
    }

    upsertDraft(
      byNodeId,
      nodeId,
      createNodeRecommendationDraft({
        code: 'ADD_DESCRIPTION',
        title: 'Add dbt model description',
        priority: 'high',
        reason:
          'A public/governed dbt model is missing description metadata required by the active governance rules.',
        description:
          'Add dbt description/docs metadata for the public/governed model.',
        category: 'documentation',
        governanceNodeId: nodeId,
        dbtUniqueId: resolutionByNodeId.get(nodeId)?.dbtUniqueId,
        violation,
      }),
    );
  }

  return [...byNodeId.values()];
}

function buildAddTestsRecommendations(
  context: RecommendationContext,
  resolutionByNodeId: Map<string, DbtGovernanceMetadataResolution>,
): RecommendationDraft[] {
  const byNodeId = new Map<string, RecommendationDraft>();

  for (const signal of context.signals) {
    if (
      signal.metadata?.code !== 'DBT_TESTS_MISSING' &&
      signal.metadata?.code !== 'DBT_CRITICAL_MODEL_WITHOUT_TESTS_CANDIDATE'
    ) {
      continue;
    }

    if (!signal.nodeId) {
      continue;
    }

    upsertDraft(
      byNodeId,
      signal.nodeId,
      createNodeRecommendationDraft({
        code: 'ADD_TESTS',
        title: 'Add dbt tests',
        priority:
          signal.metadata?.code === 'DBT_CRITICAL_MODEL_WITHOUT_TESTS_CANDIDATE'
            ? 'high'
            : 'medium',
        reason:
          signal.metadata?.code === 'DBT_CRITICAL_MODEL_WITHOUT_TESTS_CANDIDATE'
            ? 'A critical dbt model does not have tests.'
            : 'This dbt model does not currently expose tests.',
        description:
          'Add relevant dbt tests for the model so governance checks can rely on validated behavior.',
        category: 'documentation',
        governanceNodeId: signal.nodeId,
        dbtUniqueId:
          asString(signal.metadata?.dbtUniqueId) ??
          resolutionByNodeId.get(signal.nodeId)?.dbtUniqueId,
        signal,
      }),
    );
  }

  for (const violation of context.violations) {
    if (violation.ruleId !== 'dbt/critical-models-require-tests') {
      continue;
    }

    const nodeId = readViolationNodeId(violation);
    if (!nodeId) {
      continue;
    }

    upsertDraft(
      byNodeId,
      nodeId,
      createNodeRecommendationDraft({
        code: 'ADD_TESTS',
        title: 'Add dbt tests',
        priority: 'high',
        reason:
          'A critical dbt model is missing tests required by the active governance rules.',
        description:
          'Add appropriate dbt tests for the critical model before treating it as governed output.',
        category: 'documentation',
        governanceNodeId: nodeId,
        dbtUniqueId: resolutionByNodeId.get(nodeId)?.dbtUniqueId,
        violation,
      }),
    );
  }

  return [...byNodeId.values()];
}

function buildEnableContractRecommendations(
  context: RecommendationContext,
  resolutionByNodeId: Map<string, DbtGovernanceMetadataResolution>,
): RecommendationDraft[] {
  const byNodeId = new Map<string, RecommendationDraft>();

  for (const signal of context.signals) {
    if (
      signal.metadata?.code !==
      'DBT_CONTRACT_MISSING_FOR_PUBLIC_MODEL_CANDIDATE'
    ) {
      continue;
    }

    if (!signal.nodeId) {
      continue;
    }

    upsertDraft(
      byNodeId,
      signal.nodeId,
      createNodeRecommendationDraft({
        code: 'ENABLE_CONTRACT',
        title: 'Enable dbt contract',
        priority: 'high',
        reason: 'A public/governed dbt model is missing an enforced contract.',
        description:
          'Enable and define a dbt contract for the public/governed model so downstream interfaces stay explicit.',
        category: 'documentation',
        governanceNodeId: signal.nodeId,
        dbtUniqueId:
          asString(signal.metadata?.dbtUniqueId) ??
          resolutionByNodeId.get(signal.nodeId)?.dbtUniqueId,
        signal,
      }),
    );
  }

  for (const violation of context.violations) {
    if (violation.ruleId !== 'dbt/public-models-require-contract') {
      continue;
    }

    const nodeId = readViolationNodeId(violation);
    if (!nodeId) {
      continue;
    }

    upsertDraft(
      byNodeId,
      nodeId,
      createNodeRecommendationDraft({
        code: 'ENABLE_CONTRACT',
        title: 'Enable dbt contract',
        priority: 'high',
        reason:
          'A public/governed dbt model is missing contract enforcement required by the active governance rules.',
        description:
          'Enable and define the dbt contract for this public/governed model.',
        category: 'documentation',
        governanceNodeId: nodeId,
        dbtUniqueId: resolutionByNodeId.get(nodeId)?.dbtUniqueId,
        violation,
      }),
    );
  }

  return [...byNodeId.values()];
}

function buildReviewCrossDomainDependencyRecommendations(
  context: RecommendationContext,
  resolutionByNodeId: Map<string, DbtGovernanceMetadataResolution>,
): RecommendationDraft[] {
  const byDependencyKey = new Map<string, RecommendationDraft>();

  for (const signal of context.signals) {
    if (signal.metadata?.code !== 'DBT_CROSS_DOMAIN_DEPENDENCY_DETECTED') {
      continue;
    }

    const dependencyKey = readDependencyKeyFromSignal(signal);
    if (!dependencyKey) {
      continue;
    }

    const sourceSignalNodeId = readSignalSourceProjectId(signal);

    upsertDraft(
      byDependencyKey,
      dependencyKey,
      createDependencyRecommendationDraft({
        code: 'REVIEW_CROSS_DOMAIN_DEPENDENCY',
        title: 'Review cross-domain dbt dependency',
        priority: 'medium',
        reason:
          'This dbt dependency crosses domain boundaries and should be reviewed for approval or redesign.',
        description:
          'Review whether the cross-domain dependency is intentional, approved, and still aligned with the domain policy.',
        category: 'dependency',
        dependencyKey,
        sourceProjectId: readSignalSourceProjectId(signal),
        targetProjectId: readSignalTargetProjectId(signal),
        relatedProjectIds: signal.relatedNodeIds ?? [],
        dbtUniqueId: sourceSignalNodeId
          ? resolutionByNodeId.get(sourceSignalNodeId)?.dbtUniqueId
          : undefined,
        signal,
      }),
    );
  }

  for (const violation of context.violations) {
    if (violation.ruleId !== 'dbt/cross-domain-dependencies-require-approval') {
      continue;
    }

    const sourceProjectId = readViolationNodeId(violation);
    const targetProjectId = readViolationTargetNodeId(violation);
    const dependencyKey =
      sourceProjectId && targetProjectId
        ? `${sourceProjectId}->${targetProjectId}`
        : undefined;
    if (!dependencyKey) {
      continue;
    }

    if (!sourceProjectId) {
      continue;
    }

    upsertDraft(
      byDependencyKey,
      dependencyKey,
      createDependencyRecommendationDraft({
        code: 'REVIEW_CROSS_DOMAIN_DEPENDENCY',
        title: 'Review cross-domain dbt dependency',
        priority: 'high',
        reason:
          'A cross-domain dbt dependency violates the active approval policy.',
        description:
          'Review, approve, or redesign the cross-domain dependency so it matches the configured domain policy.',
        category: 'dependency',
        dependencyKey,
        sourceProjectId,
        targetProjectId,
        relatedProjectIds: normalizeRelatedProjectIds([
          sourceProjectId,
          targetProjectId,
        ]),
        dbtUniqueId: resolutionByNodeId.get(sourceProjectId)?.dbtUniqueId,
        violation,
      }),
    );
  }

  return [...byDependencyKey.values()];
}

function buildReduceHighFanInRecommendations(
  context: RecommendationContext,
  resolutionByNodeId: Map<string, DbtGovernanceMetadataResolution>,
): RecommendationDraft[] {
  const byNodeId = new Map<string, RecommendationDraft>();
  const hotspotMeasurement = context.measurements.find(
    (measurement) => measurement.id === 'dbt-hotspot-count',
  );
  const hotspotMeasurementNodes = readStringArray(
    hotspotMeasurement?.metadata,
    'countedResourceIds',
  );

  for (const signal of context.signals) {
    if (
      signal.metadata?.code !== 'DBT_HIGH_FAN_IN' &&
      signal.metadata?.code !== 'DBT_ARCHITECTURAL_HOTSPOT_CANDIDATE'
    ) {
      continue;
    }

    if (!signal.nodeId) {
      continue;
    }

    upsertDraft(
      byNodeId,
      signal.nodeId,
      createNodeRecommendationDraft({
        code: 'REDUCE_HIGH_FAN_IN',
        title: 'Reduce dbt fan-in',
        priority:
          signal.metadata?.code === 'DBT_ARCHITECTURAL_HOTSPOT_CANDIDATE'
            ? 'high'
            : 'medium',
        reason:
          signal.metadata?.code === 'DBT_ARCHITECTURAL_HOTSPOT_CANDIDATE'
            ? 'This dbt model is an architectural hotspot with concentrated dependency pressure.'
            : 'This dbt model has high fan-in and may be too central.',
        description:
          'Consider splitting responsibilities, introducing intermediate models, or reducing coupling around this model.',
        category: 'dependency',
        governanceNodeId: signal.nodeId,
        dbtUniqueId:
          asString(signal.metadata?.dbtUniqueId) ??
          resolutionByNodeId.get(signal.nodeId)?.dbtUniqueId,
        signal,
        measurementId:
          hotspotMeasurement && hotspotMeasurementNodes.includes(signal.nodeId)
            ? hotspotMeasurement.id
            : undefined,
      }),
    );
  }

  if (hotspotMeasurement) {
    for (const nodeId of hotspotMeasurementNodes) {
      upsertDraft(
        byNodeId,
        nodeId,
        createNodeRecommendationDraft({
          code: 'REDUCE_HIGH_FAN_IN',
          title: 'Reduce dbt fan-in',
          priority: 'medium',
          reason:
            'The dbt hotspot metric indicates concentrated dependency pressure around this model.',
          description:
            'Consider splitting responsibilities, introducing intermediate models, or reducing coupling around this model.',
          category: 'dependency',
          governanceNodeId: nodeId,
          dbtUniqueId: resolutionByNodeId.get(nodeId)?.dbtUniqueId,
          measurementId: hotspotMeasurement.id,
        }),
      );
    }
  }

  return [...byNodeId.values()];
}

function buildFixLayerDependencyRecommendations(
  context: RecommendationContext,
  resolutionByNodeId: Map<string, DbtGovernanceMetadataResolution>,
): RecommendationDraft[] {
  const byDependencyKey = new Map<string, RecommendationDraft>();

  for (const signal of context.signals) {
    if (signal.metadata?.code !== 'DBT_LAYER_BYPASS_CANDIDATE') {
      continue;
    }

    const dependencyKey = readDependencyKeyFromSignal(signal);
    if (!dependencyKey) {
      continue;
    }

    const sourceSignalNodeId = readSignalSourceProjectId(signal);

    upsertDraft(
      byDependencyKey,
      dependencyKey,
      createDependencyRecommendationDraft({
        code: 'FIX_LAYER_DEPENDENCY',
        title: 'Fix dbt layer dependency',
        priority: 'medium',
        reason:
          'This dbt dependency appears to bypass the expected layer progression.',
        description:
          'Align the dependency with the configured layer policy or refactor through the expected intermediate layer.',
        category: 'boundary',
        dependencyKey,
        sourceProjectId: readSignalSourceProjectId(signal),
        targetProjectId: readSignalTargetProjectId(signal),
        relatedProjectIds: signal.relatedNodeIds ?? [],
        dbtUniqueId: sourceSignalNodeId
          ? resolutionByNodeId.get(sourceSignalNodeId)?.dbtUniqueId
          : undefined,
        signal,
      }),
    );
  }

  for (const violation of context.violations) {
    if (violation.ruleId !== 'dbt/no-disallowed-layer-dependency') {
      continue;
    }

    const sourceProjectId = readViolationNodeId(violation);
    const targetProjectId = readViolationTargetNodeId(violation);
    const dependencyKey =
      sourceProjectId && targetProjectId
        ? `${sourceProjectId}->${targetProjectId}`
        : undefined;
    if (!dependencyKey) {
      continue;
    }

    if (!sourceProjectId) {
      continue;
    }

    upsertDraft(
      byDependencyKey,
      dependencyKey,
      createDependencyRecommendationDraft({
        code: 'FIX_LAYER_DEPENDENCY',
        title: 'Fix dbt layer dependency',
        priority: 'high',
        reason: 'This dbt dependency violates the configured layer policy.',
        description:
          'Refactor the dependency so the source model depends only on allowed upstream layers, or update the rule config when intentional.',
        category: 'boundary',
        dependencyKey,
        sourceProjectId,
        targetProjectId,
        relatedProjectIds: normalizeRelatedProjectIds([
          sourceProjectId,
          targetProjectId,
        ]),
        dbtUniqueId: resolutionByNodeId.get(sourceProjectId)?.dbtUniqueId,
        violation,
      }),
    );
  }

  return [...byDependencyKey.values()];
}

function createNodeRecommendationDraft(input: {
  code: DbtGovernanceRecommendationCode;
  title: string;
  priority: Recommendation['priority'];
  reason: string;
  description: string;
  category: string;
  governanceNodeId: string;
  dbtUniqueId?: string;
  diagnostic?: { id?: string; code?: string };
  signal?: GovernanceSignal;
  violation?: Violation;
  measurementId?: string;
}): RecommendationDraft {
  return {
    code: input.code,
    title: input.title,
    priority: input.priority,
    reason: input.reason,
    description: input.description,
    category: input.category,
    governanceNodeId: input.governanceNodeId,
    dbtUniqueId: input.dbtUniqueId,
    relatedProjectIds: [input.governanceNodeId],
    triggerDiagnosticCodes: input.diagnostic?.code
      ? [input.diagnostic.code]
      : [],
    triggerDiagnosticIds:
      input.diagnostic?.id && input.diagnostic.id.length > 0
        ? [input.diagnostic.id]
        : [],
    triggerSignalCodes: input.signal?.metadata?.code
      ? [String(input.signal.metadata.code)]
      : [],
    triggerSignalIds: input.signal?.id ? [input.signal.id] : [],
    triggerViolationIds: input.violation?.id ? [input.violation.id] : [],
    triggerMeasurementIds:
      input.measurementId && input.measurementId.length > 0
        ? [input.measurementId]
        : [],
  };
}

function createDependencyRecommendationDraft(input: {
  code: DbtGovernanceRecommendationCode;
  title: string;
  priority: Recommendation['priority'];
  reason: string;
  description: string;
  category: string;
  dependencyKey: string;
  sourceProjectId?: string;
  targetProjectId?: string;
  relatedProjectIds: string[];
  dbtUniqueId?: string;
  signal?: GovernanceSignal;
  violation?: Violation;
}): RecommendationDraft {
  return {
    code: input.code,
    title: input.title,
    priority: input.priority,
    reason: input.reason,
    description: input.description,
    category: input.category,
    dependencyKey: input.dependencyKey,
    sourceProjectId: input.sourceProjectId,
    targetProjectId: input.targetProjectId,
    relatedProjectIds: normalizeRelatedProjectIds(input.relatedProjectIds),
    dbtUniqueId: input.dbtUniqueId,
    triggerDiagnosticCodes: [],
    triggerDiagnosticIds: [],
    triggerSignalCodes: input.signal?.metadata?.code
      ? [String(input.signal.metadata.code)]
      : [],
    triggerSignalIds: input.signal?.id ? [input.signal.id] : [],
    triggerViolationIds: input.violation?.id ? [input.violation.id] : [],
    triggerMeasurementIds: [],
  };
}

function upsertDraft(
  map: Map<string, RecommendationDraft>,
  key: string,
  incoming: RecommendationDraft,
): void {
  const existing = map.get(key);

  if (!existing) {
    map.set(key, incoming);
    return;
  }

  existing.priority = maxPriority(existing.priority, incoming.priority);
  existing.triggerDiagnosticCodes = mergeStrings(
    existing.triggerDiagnosticCodes,
    incoming.triggerDiagnosticCodes,
  );
  existing.triggerDiagnosticIds = mergeStrings(
    existing.triggerDiagnosticIds,
    incoming.triggerDiagnosticIds,
  );
  existing.triggerSignalCodes = mergeStrings(
    existing.triggerSignalCodes,
    incoming.triggerSignalCodes,
  );
  existing.triggerSignalIds = mergeStrings(
    existing.triggerSignalIds,
    incoming.triggerSignalIds,
  );
  existing.triggerViolationIds = mergeStrings(
    existing.triggerViolationIds,
    incoming.triggerViolationIds,
  );
  existing.triggerMeasurementIds = mergeStrings(
    existing.triggerMeasurementIds,
    incoming.triggerMeasurementIds,
  );
  existing.relatedProjectIds = mergeStrings(
    existing.relatedProjectIds,
    incoming.relatedProjectIds,
  );
  existing.dbtUniqueId ??= incoming.dbtUniqueId;
  existing.governanceNodeId ??= incoming.governanceNodeId;
  existing.sourceProjectId ??= incoming.sourceProjectId;
  existing.targetProjectId ??= incoming.targetProjectId;
  existing.dependencyKey ??= incoming.dependencyKey;
}

function dedupeAndSortRecommendations(
  drafts: RecommendationDraft[],
  existingRecommendations: readonly Recommendation[],
): DbtGovernanceExtensionRecommendation[] {
  const byKey = new Map<string, RecommendationDraft>();

  for (const draft of drafts) {
    upsertDraft(byKey, recommendationIdentityKey(draft), draft);
  }

  const existingKeys = new Set(
    existingRecommendations
      .map(existingRecommendationIdentityKey)
      .filter(Boolean),
  );

  return [...byKey.values()]
    .map((draft) => createRecommendation(draft))
    .filter(
      (recommendation) =>
        !existingKeys.has(existingRecommendationIdentityKey(recommendation)),
    )
    .sort(compareRecommendations);
}

function createRecommendation(
  draft: RecommendationDraft,
): DbtGovernanceExtensionRecommendation {
  const id = createRecommendationId(draft);

  return {
    id,
    title: draft.title,
    priority: draft.priority,
    reason: draft.reason,
    description: draft.description,
    category: draft.category,
    reference: {
      ...(draft.governanceNodeId ? { nodeId: draft.governanceNodeId } : {}),
      ...(draft.dependencyKey ? { relationId: draft.dependencyKey } : {}),
      ...(draft.sourceProjectId
        ? { nodeId: draft.sourceProjectId }
        : {}),
      ...(draft.relatedProjectIds.length > 0
        ? { relatedNodeIds: draft.relatedProjectIds }
        : {}),
    },
    ...(draft.triggerSignalIds.length > 0
      ? { signalIds: draft.triggerSignalIds }
      : {}),
    ...(draft.triggerMeasurementIds.length > 0
      ? { measurementIds: draft.triggerMeasurementIds }
      : {}),
    metadata: {
      code: draft.code,
      technology: 'dbt',
      boundary: 'extension',
      ...(draft.governanceNodeId
        ? { governanceNodeId: draft.governanceNodeId }
        : {}),
      ...(draft.dbtUniqueId ? { dbtUniqueId: draft.dbtUniqueId } : {}),
      ...(draft.dependencyKey ? { dependencyKey: draft.dependencyKey } : {}),
      ...(draft.triggerDiagnosticCodes.length > 0
        ? { triggerDiagnosticCodes: draft.triggerDiagnosticCodes }
        : {}),
      ...(draft.triggerDiagnosticIds.length > 0
        ? { triggerDiagnosticIds: draft.triggerDiagnosticIds }
        : {}),
      ...(draft.triggerSignalCodes.length > 0
        ? { triggerSignalCodes: draft.triggerSignalCodes }
        : {}),
      ...(draft.triggerSignalIds.length > 0
        ? { triggerSignalIds: draft.triggerSignalIds }
        : {}),
      ...(draft.triggerViolationIds.length > 0
        ? { triggerViolationIds: draft.triggerViolationIds }
        : {}),
      ...(draft.triggerMeasurementIds.length > 0
        ? { triggerMeasurementIds: draft.triggerMeasurementIds }
        : {}),
    },
  };
}

function createRecommendationId(draft: RecommendationDraft): string {
  return `dbt-recommendation-${createHash('sha256')
    .update(recommendationIdentityKey(draft))
    .digest('hex')
    .slice(0, 16)}`;
}

function recommendationIdentityKey(
  draft: RecommendationDraft | Recommendation,
): string {
  const metadata = asRecord('metadata' in draft ? draft.metadata : undefined);
  const reference = 'reference' in draft ? draft.reference : undefined;
  const code =
    'code' in draft ? draft.code : (asString(metadata?.code) ?? draft.title);
  const relationId =
    'dependencyKey' in draft ? draft.dependencyKey : reference?.relationId;
  const nodeId =
    'governanceNodeId' in draft
      ? draft.governanceNodeId
      : reference?.nodeId;
  const targetProjectId =
    'targetProjectId' in draft
      ? draft.targetProjectId
      : readTargetNodeIdFromReference(reference);

  return [
    code,
    relationId ?? '',
    nodeId ?? '',
    targetProjectId ?? '',
    draft.reason,
  ]
    .join('|')
    .trim();
}

function existingRecommendationIdentityKey(
  recommendation: Recommendation,
): string {
  return recommendationIdentityKey(recommendation);
}

function compareRecommendations(
  left: DbtGovernanceExtensionRecommendation,
  right: DbtGovernanceExtensionRecommendation,
): number {
  return (
    priorityRank(left.priority) - priorityRank(right.priority) ||
    left.title.localeCompare(right.title) ||
    (left.reference?.nodeId ?? '').localeCompare(
      right.reference?.nodeId ?? '',
    ) ||
    readTargetNodeIdFromReference(left.reference).localeCompare(
      readTargetNodeIdFromReference(right.reference),
    ) ||
    left.id.localeCompare(right.id)
  );
}

function maxPriority(
  left: Recommendation['priority'],
  right: Recommendation['priority'],
): Recommendation['priority'] {
  return priorityRank(left) <= priorityRank(right) ? left : right;
}

function priorityRank(priority: Recommendation['priority']): number {
  switch (priority) {
    case 'high':
      return 0;
    case 'medium':
      return 1;
    case 'low':
    default:
      return 2;
  }
}

function mergeStrings(
  left: readonly string[],
  right: readonly string[],
): string[] {
  return [...new Set([...left, ...right])].sort();
}

function readDiagnosticNodeId(
  diagnostic: GovernanceDiagnostic,
): string | undefined {
  return (
    diagnostic.reference?.nodeId ??
    asString(asRecord(diagnostic.details)?.governanceNodeId)
  );
}

function readDependencyKeyFromSignal(
  signal: GovernanceSignal,
): string | undefined {
  const explicitKey = asString(signal.metadata?.dependencyKey);
  if (explicitKey) {
    return explicitKey;
  }

  const sourceNodeId = readSignalSourceProjectId(signal);
  const targetNodeId = readSignalTargetProjectId(signal);
  if (sourceNodeId && targetNodeId) {
    return `${sourceNodeId}->${targetNodeId}`;
  }

  return undefined;
}

function readStringArray(value: unknown, key: string): string[] {
  const array = asRecord(value)?.[key];
  return Array.isArray(array)
    ? array.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function readViolationNodeId(violation: Violation): string | undefined {
  return violation.subjectId ?? violation.reference?.nodeId;
}

function readViolationTargetNodeId(violation: Violation): string | undefined {
  const sourceNodeId = readViolationNodeId(violation);
  return violation.reference?.relatedNodeIds?.find(
    (nodeId) => nodeId !== sourceNodeId,
  );
}

function readSignalSourceProjectId(signal: GovernanceSignal): string | undefined {
  return signal.nodeId;
}

function readSignalTargetProjectId(signal: GovernanceSignal): string | undefined {
  const sourceNodeId = signal.nodeId;
  return signal.relatedNodeIds?.find((nodeId) => nodeId !== sourceNodeId);
}

function readTargetNodeIdFromReference(
  reference: Recommendation['reference'] | undefined,
): string {
  if (!reference) {
    return '';
  }

  return (
    reference.relatedNodeIds?.find((nodeId) => nodeId !== reference.nodeId) ??
    ''
  );
}

function normalizeRelatedProjectIds(
  values: readonly (string | undefined)[],
): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ].sort();
}

function hasDbtMetadata(
  metadata: unknown,
): metadata is Record<string, unknown> {
  return Boolean(asRecord(asRecord(metadata)?.dbt));
}

function toResolverInput(
  project: DbtProjectLike,
): DbtGovernanceMetadataResolverInput {
  return {
    id: project.id,
    name: project.name,
    root: project.root,
    tags: project.tags,
    domain: project.domain,
    layer: project.layer,
    ownership: asRecord(project.ownership),
    metadata: project.metadata,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
