import { createHash } from 'node:crypto';

import type {
  GovernanceDiagnostic,
  GovernanceProfile,
  GovernanceRelation,
  GovernanceSignal,
  GovernanceSignalCategory,
  GovernanceSignalSeverity,
  GovernanceSignalType,
} from '@anarchitects/governance-core';

import type {
  DbtGovernanceSignalProvider,
  DbtGovernanceSignalProviderInput,
} from './contracts.js';
import {
  isDbtDocumentationTarget,
  isDbtTestCoverageTarget,
} from './applicability.js';
import {
  buildDbtInferredTestNodeIdsByTarget,
  getDbtMetadata,
  getDbtDependencyRelations,
  normalizeIds,
  toRelationKey,
  toResolverInput,
} from './dbt-graph.js';
import { buildDbtGovernanceDiagnostics } from './diagnostics.js';
import {
  resolveDbtGovernanceMetadata,
  type DbtGovernanceMetadataResolution,
  type DbtMetadataResolution,
} from './resolvers.js';

export const DBT_GOVERNANCE_SIGNAL_SOURCE = 'governance.dbt_extension';

export const DBT_GOVERNANCE_SIGNAL_CODES = [
  'DBT_LAYER_RESOLVED',
  'DBT_LAYER_DEPENDENCY_DETECTED',
  'DBT_LAYER_DIRECTION_CANDIDATE',
  'DBT_LAYER_BYPASS_CANDIDATE',
  'DBT_DOMAIN_RESOLVED',
  'DBT_CROSS_DOMAIN_DEPENDENCY_DETECTED',
  'DBT_SHARED_MODEL_DEPENDENCY_CANDIDATE',
  'DBT_OWNER_RESOLVED',
  'DBT_OWNER_MISSING',
  'DBT_OWNER_INCONSISTENT_CANDIDATE',
  'DBT_DESCRIPTION_PRESENT',
  'DBT_DESCRIPTION_MISSING',
  'DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE',
  'DBT_TESTS_PRESENT',
  'DBT_TESTS_MISSING',
  'DBT_CRITICAL_MODEL_WITHOUT_TESTS_CANDIDATE',
  'DBT_CONTRACT_ENABLED',
  'DBT_CONTRACT_MISSING_FOR_PUBLIC_MODEL_CANDIDATE',
  'DBT_HIGH_FAN_IN',
  'DBT_HIGH_FAN_OUT',
  'DBT_ARCHITECTURAL_HOTSPOT_CANDIDATE',
] as const;

export type DbtGovernanceSignalCode =
  (typeof DBT_GOVERNANCE_SIGNAL_CODES)[number];

export interface DbtGovernanceSignalMetadata extends Record<string, unknown> {
  code: DbtGovernanceSignalCode;
  governanceNodeId?: string;
  dbtUniqueId?: string;
  dependencyKey?: string;
  sourceLayer?: string;
  targetLayer?: string;
  sourceDomain?: string;
  targetDomain?: string;
  sourceOwner?: string;
  targetOwner?: string;
  materializationCategory?: string;
  publicInterface?: boolean;
  criticality?: string;
  testsPresent?: boolean;
  contractPresent?: boolean;
  documentationPresent?: boolean;
  fanIn?: number;
  fanOut?: number;
  threshold?: number;
  combinedFan?: number;
  layerOrder?: string[];
  diagnosticCodes?: string[];
  relatedDiagnosticIds?: string[];
  resolutionStatus?: string;
  dependencyType?: string;
}

export interface DbtGovernanceExtensionSignal extends GovernanceSignal {
  metadata?: DbtGovernanceSignalMetadata;
}

export interface DbtGovernanceSignalProviderOptions {
  layerOrder?: readonly string[];
  highFanInThreshold?: number;
  highFanOutThreshold?: number;
  hotspotCombinedThreshold?: number;
  criticalityLevelsRequiringTests?: readonly string[];
}

interface SignalDraft {
  code: DbtGovernanceSignalCode;
  type: GovernanceSignalType;
  severity: GovernanceSignalSeverity;
  category: GovernanceSignalCategory;
  message: string;
  nodeId?: string;
  relationId?: string;
  dbtUniqueId?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  relatedNodeIds: string[];
  relatedRelationIds?: string[];
  metadata?: Omit<DbtGovernanceSignalMetadata, 'code'>;
  identityParts: readonly string[];
}

interface DbtSignalContext {
  profile: GovernanceProfile;
  diagnosticsByNodeId: Map<string, GovernanceDiagnostic[]>;
  createdAt: string;
  options: Required<DbtGovernanceSignalProviderOptions>;
}

const DEFAULT_PROVIDER_ID = 'dbt-governance-signals';
const DEFAULT_SIGNAL_CREATED_AT = '1970-01-01T00:00:00.000Z';
const DEFAULT_LAYER_ORDER = ['staging', 'intermediate', 'marts'] as const;
const DEFAULT_HIGH_FAN_IN_THRESHOLD = 3;
const DEFAULT_HIGH_FAN_OUT_THRESHOLD = 3;
const DEFAULT_HOTSPOT_COMBINED_THRESHOLD = 5;
const DEFAULT_CRITICALITY_LEVELS_REQUIRING_TESTS = [
  'high',
  'critical',
] as const;

export const dbtGovernanceSignalProvider = createDbtGovernanceSignalProvider();

export function createDbtGovernanceSignalProvider(
  options: DbtGovernanceSignalProviderOptions = {},
): DbtGovernanceSignalProvider {
  return {
    id: DEFAULT_PROVIDER_ID,
    provideSignals: (input) => buildDbtGovernanceSignals(input, options),
  };
}

export function buildDbtGovernanceSignals(
  input: DbtGovernanceSignalProviderInput,
  options: DbtGovernanceSignalProviderOptions = {},
): DbtGovernanceExtensionSignal[] {
  const dependencyRelations = getDbtDependencyRelations(input.workspace);
  const resolvedOptions = resolveSignalOptions(input.profile, options);
  const metadataResolutions = resolveMetadataResolutions(input);
  const diagnostics = resolveDiagnostics(input, metadataResolutions);
  const diagnosticsByNodeId = indexDiagnosticsByNodeId(diagnostics);
  const resolutionByNodeId = new Map(
    metadataResolutions.map(
      (resolution) => [resolution.governanceNodeId, resolution] as const,
    ),
  );
  const dependencyContexts = dependencyRelations.map((relation) => ({
    relation,
    source: resolutionByNodeId.get(relation.sourceNodeId),
    target: resolutionByNodeId.get(relation.targetNodeId),
  }));
  const inboundCounts = countInboundDependencies(dependencyRelations);
  const outboundCounts = countOutboundDependencies(dependencyRelations);
  const inboundDomains = collectInboundDomains(dependencyContexts);
  const signals: DbtGovernanceExtensionSignal[] = [];
  const signalContext: DbtSignalContext = {
    profile: input.profile,
    diagnosticsByNodeId,
    createdAt:
      normalizeCreatedAt(readCreatedAt(input.context.options)) ??
      DEFAULT_SIGNAL_CREATED_AT,
    options: resolvedOptions,
  };

  for (const resolution of metadataResolutions) {
    signals.push(
      ...buildResourceSignals(
        resolution,
        inboundCounts.get(resolution.governanceNodeId) ?? 0,
        outboundCounts.get(resolution.governanceNodeId) ?? 0,
        signalContext,
      ),
    );
  }

  for (const context of dependencyContexts) {
    signals.push(
      ...buildDependencySignals(context, inboundDomains, signalContext),
    );
  }

  return dedupeAndSortSignals(signals);
}

function buildResourceSignals(
  resolution: DbtGovernanceMetadataResolution,
  fanIn: number,
  fanOut: number,
  context: DbtSignalContext,
): DbtGovernanceExtensionSignal[] {
  const signals: DbtGovernanceExtensionSignal[] = [];
  const diagnosticRefs = getDiagnosticRefs(
    context.diagnosticsByNodeId,
    resolution.governanceNodeId,
  );

  if (resolution.layer.status === 'resolved') {
    const resolvedLayer = resolution.layer.value;

    if (!resolvedLayer) {
      throw new Error('Expected resolved dbt layer value.');
    }

    signals.push(
      createSignal({
        code: 'DBT_LAYER_RESOLVED',
        type: 'dbt-layer-resolved',
        severity: 'info',
        category: 'boundary',
        message: `Resolved dbt layer "${resolvedLayer}" for ${resolution.governanceNodeId}.`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: [
          'layer-resolved',
          resolution.governanceNodeId,
          resolvedLayer,
        ],
        metadata: {
          sourceLayer: resolvedLayer,
          resolutionStatus: resolution.layer.status,
          diagnosticCodes: diagnosticRefs.codes,
          relatedDiagnosticIds: diagnosticRefs.ids,
        },
        createdAt: context.createdAt,
      }),
    );
  }

  if (resolution.domain.status === 'resolved') {
    const resolvedDomain = resolution.domain.value;

    if (!resolvedDomain) {
      throw new Error('Expected resolved dbt domain value.');
    }

    signals.push(
      createSignal({
        code: 'DBT_DOMAIN_RESOLVED',
        type: 'dbt-domain-resolved',
        severity: 'info',
        category: 'boundary',
        message: `Resolved dbt domain "${resolvedDomain}" for ${resolution.governanceNodeId}.`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: [
          'domain-resolved',
          resolution.governanceNodeId,
          resolvedDomain,
        ],
        metadata: {
          sourceDomain: resolvedDomain,
          resolutionStatus: resolution.domain.status,
        },
        createdAt: context.createdAt,
      }),
    );
  }

  if (resolution.owner.status === 'resolved') {
    const resolvedOwner = resolution.owner.value;

    if (!resolvedOwner) {
      throw new Error('Expected resolved dbt owner value.');
    }

    signals.push(
      createSignal({
        code: 'DBT_OWNER_RESOLVED',
        type: 'dbt-owner-resolved',
        severity: 'info',
        category: 'ownership',
        message: `Resolved dbt owner "${resolvedOwner}" for ${resolution.governanceNodeId}.`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: [
          'owner-resolved',
          resolution.governanceNodeId,
          resolvedOwner,
        ],
        metadata: {
          sourceOwner: resolvedOwner,
          resolutionStatus: resolution.owner.status,
        },
        createdAt: context.createdAt,
      }),
    );
  } else if (resolution.owner.status === 'unresolved') {
    signals.push(
      createSignal({
        code: 'DBT_OWNER_MISSING',
        type: 'ownership-gap',
        severity: 'warning',
        category: 'ownership',
        message: `Owner metadata is missing for ${resolution.governanceNodeId}.`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: ['owner-missing', resolution.governanceNodeId],
        metadata: {
          resolutionStatus: resolution.owner.status,
          diagnosticCodes: diagnosticRefs.codes,
          relatedDiagnosticIds: diagnosticRefs.ids,
        },
        createdAt: context.createdAt,
      }),
    );
  }

  appendDocumentationSignals(signals, resolution, context.createdAt);
  appendTestingSignals(signals, resolution, context);
  appendContractSignals(signals, resolution, context.createdAt);
  appendDagShapeSignals(signals, resolution, fanIn, fanOut, context);

  return signals;
}

function appendDocumentationSignals(
  signals: DbtGovernanceExtensionSignal[],
  resolution: DbtGovernanceMetadataResolution,
  createdAt: string,
): void {
  if (!isDbtDocumentationTarget(resolution)) {
    return;
  }

  const documentationPresent = isResolvedTrue(resolution.documentationPresent);
  const documentationMissing = isMissingBooleanResolution(
    resolution.documentationPresent,
  );

  if (documentationPresent) {
    signals.push(
      createSignal({
        code: 'DBT_DESCRIPTION_PRESENT',
        type: 'dbt-description-present',
        severity: 'info',
        category: 'compliance',
        message: `Documentation is present for ${resolution.governanceNodeId}.`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: ['description-present', resolution.governanceNodeId],
        metadata: {
          documentationPresent: true,
          resolutionStatus: resolution.documentationPresent.status,
        },
        createdAt,
      }),
    );
  } else if (documentationMissing) {
    signals.push(
      createSignal({
        code: 'DBT_DESCRIPTION_MISSING',
        type: 'dbt-description-missing',
        severity: 'warning',
        category: 'compliance',
        message: `Documentation is missing for ${resolution.governanceNodeId}.`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: ['description-missing', resolution.governanceNodeId],
        metadata: {
          documentationPresent: false,
          resolutionStatus: resolution.documentationPresent.status,
        },
        createdAt,
      }),
    );
  }

  if (isResolvedTrue(resolution.publicInterface) && documentationMissing) {
    signals.push(
      createSignal({
        code: 'DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE',
        type: 'dbt-public-model-undocumented-candidate',
        severity: 'warning',
        category: 'compliance',
        message: `Public or governed dbt model ${resolution.governanceNodeId} is undocumented.`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: [
          'public-model-undocumented',
          resolution.governanceNodeId,
        ],
        metadata: {
          publicInterface: true,
          documentationPresent: false,
          resolutionStatus: resolution.documentationPresent.status,
        },
        createdAt,
      }),
    );
  }
}

function appendTestingSignals(
  signals: DbtGovernanceExtensionSignal[],
  resolution: DbtGovernanceMetadataResolution,
  context: DbtSignalContext,
): void {
  if (!isDbtTestCoverageTarget(resolution)) {
    return;
  }

  const testsPresent = isResolvedTrue(resolution.testsPresent);
  const testsMissing = isMissingBooleanResolution(resolution.testsPresent);
  const criticalityValue =
    resolution.criticality.status === 'resolved'
      ? resolution.criticality.value
      : undefined;

  if (testsPresent) {
    signals.push(
      createSignal({
        code: 'DBT_TESTS_PRESENT',
        type: 'dbt-tests-present',
        severity: 'info',
        category: 'compliance',
        message: `Tests are present for ${resolution.governanceNodeId}.`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: ['tests-present', resolution.governanceNodeId],
        metadata: {
          testsPresent: true,
          resolutionStatus: resolution.testsPresent.status,
        },
        createdAt: context.createdAt,
      }),
    );
  } else if (testsMissing) {
    signals.push(
      createSignal({
        code: 'DBT_TESTS_MISSING',
        type: 'dbt-tests-missing',
        severity: 'warning',
        category: 'compliance',
        message: `Tests are missing for ${resolution.governanceNodeId}.`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: ['tests-missing', resolution.governanceNodeId],
        metadata: {
          testsPresent: false,
          resolutionStatus: resolution.testsPresent.status,
        },
        createdAt: context.createdAt,
      }),
    );
  }

  if (
    criticalityValue &&
    context.options.criticalityLevelsRequiringTests.includes(
      criticalityValue.toLowerCase(),
    ) &&
    testsMissing
  ) {
    signals.push(
      createSignal({
        code: 'DBT_CRITICAL_MODEL_WITHOUT_TESTS_CANDIDATE',
        type: 'dbt-critical-model-without-tests-candidate',
        severity: 'warning',
        category: 'compliance',
        message: `Critical dbt model ${resolution.governanceNodeId} does not have tests.`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: [
          'critical-model-without-tests',
          resolution.governanceNodeId,
          criticalityValue,
        ],
        metadata: {
          criticality: criticalityValue,
          testsPresent: false,
          resolutionStatus: resolution.testsPresent.status,
        },
        createdAt: context.createdAt,
      }),
    );
  }
}

function appendContractSignals(
  signals: DbtGovernanceExtensionSignal[],
  resolution: DbtGovernanceMetadataResolution,
  createdAt: string,
): void {
  if (isResolvedTrue(resolution.contractPresent)) {
    signals.push(
      createSignal({
        code: 'DBT_CONTRACT_ENABLED',
        type: 'dbt-contract-enabled',
        severity: 'info',
        category: 'compliance',
        message: `Contract metadata is present for ${resolution.governanceNodeId}.`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: ['contract-enabled', resolution.governanceNodeId],
        metadata: {
          contractPresent: true,
          resolutionStatus: resolution.contractPresent.status,
        },
        createdAt,
      }),
    );
  }

  if (
    isResolvedTrue(resolution.publicInterface) &&
    isMissingBooleanResolution(resolution.contractPresent)
  ) {
    signals.push(
      createSignal({
        code: 'DBT_CONTRACT_MISSING_FOR_PUBLIC_MODEL_CANDIDATE',
        type: 'dbt-contract-missing-for-public-model-candidate',
        severity: 'warning',
        category: 'compliance',
        message: `Public or governed dbt model ${resolution.governanceNodeId} does not expose contract metadata.`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: ['contract-missing', resolution.governanceNodeId],
        metadata: {
          publicInterface: true,
          contractPresent: false,
          resolutionStatus: resolution.contractPresent.status,
        },
        createdAt,
      }),
    );
  }
}

function appendDagShapeSignals(
  signals: DbtGovernanceExtensionSignal[],
  resolution: DbtGovernanceMetadataResolution,
  fanIn: number,
  fanOut: number,
  context: DbtSignalContext,
): void {
  if (fanIn >= context.options.highFanInThreshold) {
    signals.push(
      createSignal({
        code: 'DBT_HIGH_FAN_IN',
        type: 'dbt-high-fan-in',
        severity: 'warning',
        category: 'structure',
        message: `dbt resource ${resolution.governanceNodeId} has high fan-in (${fanIn}).`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: ['high-fan-in', resolution.governanceNodeId, `${fanIn}`],
        metadata: {
          fanIn,
          threshold: context.options.highFanInThreshold,
        },
        createdAt: context.createdAt,
      }),
    );
  }

  if (fanOut >= context.options.highFanOutThreshold) {
    signals.push(
      createSignal({
        code: 'DBT_HIGH_FAN_OUT',
        type: 'dbt-high-fan-out',
        severity: 'warning',
        category: 'structure',
        message: `dbt resource ${resolution.governanceNodeId} has high fan-out (${fanOut}).`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: [
          'high-fan-out',
          resolution.governanceNodeId,
          `${fanOut}`,
        ],
        metadata: {
          fanOut,
          threshold: context.options.highFanOutThreshold,
        },
        createdAt: context.createdAt,
      }),
    );
  }

  const combinedFan = fanIn + fanOut;
  if (
    combinedFan >= context.options.hotspotCombinedThreshold &&
    (fanIn >= context.options.highFanInThreshold ||
      fanOut >= context.options.highFanOutThreshold)
  ) {
    signals.push(
      createSignal({
        code: 'DBT_ARCHITECTURAL_HOTSPOT_CANDIDATE',
        type: 'dbt-architectural-hotspot-candidate',
        severity: 'warning',
        category: 'structure',
        message: `dbt resource ${resolution.governanceNodeId} is an architectural hotspot candidate.`,
        nodeId: resolution.governanceNodeId,
        dbtUniqueId: resolution.dbtUniqueId,
        relatedNodeIds: [resolution.governanceNodeId],
        identityParts: [
          'architectural-hotspot',
          resolution.governanceNodeId,
          `${fanIn}`,
          `${fanOut}`,
        ],
        metadata: {
          fanIn,
          fanOut,
          combinedFan,
          threshold: context.options.hotspotCombinedThreshold,
        },
        createdAt: context.createdAt,
      }),
    );
  }
}

function buildDependencySignals(
  dependencyContext: {
    relation: GovernanceRelation;
    source?: DbtGovernanceMetadataResolution;
    target?: DbtGovernanceMetadataResolution;
  },
  inboundDomains: Map<string, Set<string>>,
  context: DbtSignalContext,
): DbtGovernanceExtensionSignal[] {
  const { relation, source, target } = dependencyContext;

  if (!source || !target) {
    return [];
  }

  const signals: DbtGovernanceExtensionSignal[] = [];
  const relatedNodeIds = normalizeIds([
    source.governanceNodeId,
    target.governanceNodeId,
  ]);
  const dependencyKey = toRelationKey(relation);
  const dependencyType = readDependencyKind(relation);

  if (
    source.layer.status === 'resolved' &&
    target.layer.status === 'resolved'
  ) {
    const sourceLayer = source.layer.value;
    const targetLayer = target.layer.value;

    if (!sourceLayer || !targetLayer) {
      throw new Error('Expected resolved dbt layer dependency values.');
    }

    const layerOrder = resolveLayerOrder(context.profile, context.options);
    const sourceIndex = layerOrder.indexOf(sourceLayer);
    const targetIndex = layerOrder.indexOf(targetLayer);

    signals.push(
      createSignal({
        code: 'DBT_LAYER_DEPENDENCY_DETECTED',
        type: 'structural-dependency',
        severity: 'info',
        category: 'dependency',
        message: `dbt layer dependency detected: ${source.governanceNodeId} (${sourceLayer}) -> ${target.governanceNodeId} (${targetLayer}).`,
        sourceNodeId: source.governanceNodeId,
        targetNodeId: target.governanceNodeId,
        relationId: relation.id,
        dbtUniqueId: source.dbtUniqueId,
        relatedNodeIds,
        relatedRelationIds: [relation.id],
        identityParts: ['layer-dependency', dependencyKey],
        metadata: {
          dependencyKey,
          sourceLayer,
          targetLayer,
          dependencyType,
        },
        createdAt: context.createdAt,
      }),
    );

    if (sourceIndex >= 0 && targetIndex >= 0 && sourceIndex < targetIndex) {
      signals.push(
        createSignal({
          code: 'DBT_LAYER_DIRECTION_CANDIDATE',
          type: 'dbt-layer-direction-candidate',
          severity: 'warning',
          category: 'boundary',
          message: `dbt dependency ${dependencyKey} points from an earlier layer to a later layer.`,
          sourceNodeId: source.governanceNodeId,
          targetNodeId: target.governanceNodeId,
          relationId: relation.id,
          dbtUniqueId: source.dbtUniqueId,
          relatedNodeIds,
          relatedRelationIds: [relation.id],
          identityParts: ['layer-direction', dependencyKey],
          metadata: {
            dependencyKey,
            sourceLayer,
            targetLayer,
            layerOrder,
            dependencyType,
          },
          createdAt: context.createdAt,
        }),
      );
    }

    if (
      sourceIndex >= 0 &&
      targetIndex >= 0 &&
      Math.abs(sourceIndex - targetIndex) > 1
    ) {
      signals.push(
        createSignal({
          code: 'DBT_LAYER_BYPASS_CANDIDATE',
          type: 'dbt-layer-bypass-candidate',
          severity: 'warning',
          category: 'boundary',
          message: `dbt dependency ${dependencyKey} skips an intermediate layer.`,
          sourceNodeId: source.governanceNodeId,
          targetNodeId: target.governanceNodeId,
          relationId: relation.id,
          dbtUniqueId: source.dbtUniqueId,
          relatedNodeIds,
          relatedRelationIds: [relation.id],
          identityParts: ['layer-bypass', dependencyKey],
          metadata: {
            dependencyKey,
            sourceLayer,
            targetLayer,
            layerOrder,
            dependencyType,
          },
          createdAt: context.createdAt,
        }),
      );
    }
  }

  if (
    source.domain.status === 'resolved' &&
    target.domain.status === 'resolved' &&
    source.domain.value !== target.domain.value
  ) {
    signals.push(
      createSignal({
        code: 'DBT_CROSS_DOMAIN_DEPENDENCY_DETECTED',
        type: 'cross-domain-dependency',
        severity: 'warning',
        category: 'boundary',
        message: `Cross-domain dbt dependency detected: ${source.governanceNodeId} (${source.domain.value}) -> ${target.governanceNodeId} (${target.domain.value}).`,
        sourceNodeId: source.governanceNodeId,
        targetNodeId: target.governanceNodeId,
        relationId: relation.id,
        dbtUniqueId: source.dbtUniqueId,
        relatedNodeIds,
        relatedRelationIds: [relation.id],
        identityParts: ['cross-domain-dependency', dependencyKey],
        metadata: {
          dependencyKey,
          sourceDomain: source.domain.value,
          targetDomain: target.domain.value,
          dependencyType,
        },
        createdAt: context.createdAt,
      }),
    );

    const inboundDomainSet = inboundDomains.get(target.governanceNodeId);
    if (inboundDomainSet && inboundDomainSet.size >= 2) {
      signals.push(
        createSignal({
          code: 'DBT_SHARED_MODEL_DEPENDENCY_CANDIDATE',
          type: 'dbt-shared-model-dependency-candidate',
          severity: 'warning',
          category: 'boundary',
          message: `dbt dependency target ${target.governanceNodeId} appears to be a shared model across domains.`,
          sourceNodeId: source.governanceNodeId,
          targetNodeId: target.governanceNodeId,
          relationId: relation.id,
          dbtUniqueId: target.dbtUniqueId,
          relatedNodeIds,
          relatedRelationIds: [relation.id],
          identityParts: ['shared-model-dependency', dependencyKey],
          metadata: {
            dependencyKey,
            sourceDomain: source.domain.value,
            targetDomain: target.domain.value,
            dependencyType,
          },
          createdAt: context.createdAt,
        }),
      );
    }
  }

  if (
    source.domain.status === 'resolved' &&
    target.domain.status === 'resolved' &&
    source.domain.value === target.domain.value &&
    source.owner.status === 'resolved' &&
    target.owner.status === 'resolved' &&
    source.owner.value !== target.owner.value
  ) {
    signals.push(
      createSignal({
        code: 'DBT_OWNER_INCONSISTENT_CANDIDATE',
        type: 'dbt-owner-inconsistent-candidate',
        severity: 'warning',
        category: 'ownership',
        message: `dbt dependency ${dependencyKey} crosses inconsistent owners within domain "${source.domain.value}".`,
        sourceNodeId: source.governanceNodeId,
        targetNodeId: target.governanceNodeId,
        relationId: relation.id,
        dbtUniqueId: source.dbtUniqueId,
        relatedNodeIds,
        relatedRelationIds: [relation.id],
        identityParts: ['owner-inconsistent', dependencyKey],
        metadata: {
          dependencyKey,
          sourceDomain: source.domain.value,
          sourceOwner: source.owner.value,
          targetOwner: target.owner.value,
          dependencyType,
        },
        createdAt: context.createdAt,
      }),
    );
  }

  return signals;
}

function createSignal(
  draft: SignalDraft & { createdAt: string },
): DbtGovernanceExtensionSignal {
  const id = createSignalId(draft.identityParts);

  return {
    id,
    type: draft.type,
    ...(draft.nodeId
      ? { nodeId: draft.nodeId }
      : draft.sourceNodeId
        ? { nodeId: draft.sourceNodeId }
        : {}),
    ...(draft.relationId ? { relationId: draft.relationId } : {}),
    relatedNodeIds: normalizeIds(
      draft.relatedNodeIds.length > 0
        ? draft.relatedNodeIds
        : [draft.nodeId ?? draft.sourceNodeId],
    ),
    ...(draft.relatedRelationIds && draft.relatedRelationIds.length > 0
      ? { relatedRelationIds: normalizeIds(draft.relatedRelationIds) }
      : {}),
    severity: draft.severity,
    category: draft.category,
    message: draft.message,
    source: 'extension',
    createdAt: draft.createdAt,
    ...(draft.metadata
      ? {
          metadata: {
            code: draft.code,
            ...(draft.nodeId ? { governanceNodeId: draft.nodeId } : {}),
            ...(draft.dbtUniqueId ? { dbtUniqueId: draft.dbtUniqueId } : {}),
            ...draft.metadata,
          },
        }
      : {
          metadata: {
            code: draft.code,
            ...(draft.nodeId ? { governanceNodeId: draft.nodeId } : {}),
            ...(draft.dbtUniqueId ? { dbtUniqueId: draft.dbtUniqueId } : {}),
          },
        }),
  };
}

function resolveMetadataResolutions(
  input: DbtGovernanceSignalProviderInput,
): readonly DbtGovernanceMetadataResolution[] {
  if (input.metadataResolutions && input.metadataResolutions.length > 0) {
    return input.metadataResolutions;
  }

  const inferredTestNodeIdsByTarget = buildDbtInferredTestNodeIdsByTarget(
    input.workspace,
  );

  return input.workspace.nodes
    .filter((node) => Boolean(getDbtMetadata(node)))
    .map((node) =>
      resolveDbtGovernanceMetadata(
        toResolverInput(node, inferredTestNodeIdsByTarget),
      ),
    );
}

function resolveDiagnostics(
  input: DbtGovernanceSignalProviderInput,
  metadataResolutions: readonly DbtGovernanceMetadataResolution[],
): readonly GovernanceDiagnostic[] {
  if (input.diagnostics && input.diagnostics.length > 0) {
    return input.diagnostics;
  }

  return buildDbtGovernanceDiagnostics({
    workspace: input.workspace,
    profile: input.profile,
    context: input.context,
    violations: input.violations,
    signals: input.signals,
    measurements: [],
    diagnostics: [],
    metadataResolutions,
  });
}

function resolveSignalOptions(
  profile: GovernanceProfile,
  options: DbtGovernanceSignalProviderOptions,
): Required<DbtGovernanceSignalProviderOptions> {
  return {
    layerOrder:
      options.layerOrder && options.layerOrder.length > 0
        ? [...options.layerOrder]
        : profile.layers.length > 0
          ? [...profile.layers]
          : [...DEFAULT_LAYER_ORDER],
    highFanInThreshold:
      options.highFanInThreshold ?? DEFAULT_HIGH_FAN_IN_THRESHOLD,
    highFanOutThreshold:
      options.highFanOutThreshold ?? DEFAULT_HIGH_FAN_OUT_THRESHOLD,
    hotspotCombinedThreshold:
      options.hotspotCombinedThreshold ?? DEFAULT_HOTSPOT_COMBINED_THRESHOLD,
    criticalityLevelsRequiringTests: [
      ...(options.criticalityLevelsRequiringTests ??
        DEFAULT_CRITICALITY_LEVELS_REQUIRING_TESTS),
    ].map((level) => level.toLowerCase()),
  };
}

function resolveLayerOrder(
  profile: GovernanceProfile,
  options: Required<DbtGovernanceSignalProviderOptions>,
): string[] {
  return options.layerOrder.length > 0
    ? [...options.layerOrder]
    : profile.layers.length > 0
      ? [...profile.layers]
      : [...DEFAULT_LAYER_ORDER];
}

function countInboundDependencies(
  dependencies: readonly GovernanceRelation[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const dependency of dependencies) {
    counts.set(
      dependency.targetNodeId,
      (counts.get(dependency.targetNodeId) ?? 0) + 1,
    );
  }

  return counts;
}

function countOutboundDependencies(
  dependencies: readonly GovernanceRelation[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const dependency of dependencies) {
    counts.set(
      dependency.sourceNodeId,
      (counts.get(dependency.sourceNodeId) ?? 0) + 1,
    );
  }

  return counts;
}

function collectInboundDomains(
  dependencyContexts: readonly {
    relation: GovernanceRelation;
    source?: DbtGovernanceMetadataResolution;
    target?: DbtGovernanceMetadataResolution;
  }[],
): Map<string, Set<string>> {
  const inboundDomains = new Map<string, Set<string>>();

  for (const { source, target } of dependencyContexts) {
    if (!source || !target || source.domain.status !== 'resolved') {
      continue;
    }

    const sourceDomain = source.domain.value;
    if (!sourceDomain) {
      throw new Error('Expected resolved source dbt domain value.');
    }

    const domains = inboundDomains.get(target.governanceNodeId) ?? new Set();
    domains.add(sourceDomain);
    inboundDomains.set(target.governanceNodeId, domains);
  }

  return inboundDomains;
}

function getDiagnosticRefs(
  diagnosticsByNodeId: Map<string, GovernanceDiagnostic[]>,
  governanceNodeId: string,
): { ids: string[]; codes: string[] } {
  const diagnostics = diagnosticsByNodeId.get(governanceNodeId) ?? [];

  return {
    ids: diagnostics.flatMap((diagnostic) =>
      diagnostic.id ? [diagnostic.id] : [],
    ),
    codes: diagnostics.map((diagnostic) => diagnostic.code),
  };
}

function indexDiagnosticsByNodeId(
  diagnostics: readonly GovernanceDiagnostic[],
): Map<string, GovernanceDiagnostic[]> {
  const diagnosticsByNodeId = new Map<string, GovernanceDiagnostic[]>();

  for (const diagnostic of diagnostics) {
    const nodeIds = extractDiagnosticNodeIds(diagnostic);
    for (const nodeId of nodeIds) {
      const existing = diagnosticsByNodeId.get(nodeId) ?? [];
      existing.push(diagnostic);
      diagnosticsByNodeId.set(nodeId, existing);
    }
  }

  return diagnosticsByNodeId;
}

function extractDiagnosticNodeIds(diagnostic: GovernanceDiagnostic): string[] {
  const ids = new Set<string>();
  const reference = diagnostic.reference;

  if (reference?.nodeId) {
    ids.add(reference.nodeId);
  }
  const details = asRecord(diagnostic.details);
  const governanceNodeId = asString(details?.governanceNodeId);
  if (governanceNodeId) {
    ids.add(governanceNodeId);
  }

  return [...ids];
}

function dedupeAndSortSignals(
  signals: readonly DbtGovernanceExtensionSignal[],
): DbtGovernanceExtensionSignal[] {
  const deduped = new Map<string, DbtGovernanceExtensionSignal>();

  for (const signal of signals) {
    if (!deduped.has(signal.id)) {
      deduped.set(signal.id, signal);
    }
  }

  return [...deduped.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function createSignalId(identityParts: readonly string[]): string {
  return `dbt-signal-${createHash('sha256')
    .update(identityParts.join('|'))
    .digest('hex')
    .slice(0, 16)}`;
}

function readCreatedAt(
  options: Readonly<Record<string, unknown>>,
): string | undefined {
  return (
    asString(options.createdAt) ??
    asString(options.extractedAt) ??
    asString(options.analysisTimestamp)
  );
}

function normalizeCreatedAt(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function readDependencyKind(relation: GovernanceRelation): string | undefined {
  const lineage = readPathValue(getDbtMetadata(relation), ['lineage']);

  if (!isRecord(lineage)) {
    return relation.kind;
  }

  return (
    asString(lineage.dependencyKind) ??
    asString(lineage.artifactDependencyKind) ??
    relation.kind
  );
}

function readPathValue(value: unknown, path: readonly string[]): unknown {
  let current = value;

  for (const segment of path) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function isResolvedTrue(resolution: DbtMetadataResolution<boolean>): boolean {
  return resolution.status === 'resolved' && resolution.value === true;
}

function isMissingBooleanResolution(
  resolution: DbtMetadataResolution<boolean>,
): boolean {
  return (
    resolution.status === 'unresolved' ||
    (resolution.status === 'resolved' && resolution.value === false)
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
