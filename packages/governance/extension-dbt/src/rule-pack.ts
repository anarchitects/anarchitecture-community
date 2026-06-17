import { createHash } from 'node:crypto';

import {
  type GovernanceDiagnostic,
  type GovernanceExtensionRulePack,
  type GovernanceProfile,
  type GovernanceRelation,
  type GovernanceSignal,
  type Violation,
} from '@anarchitects/governance-core';

import type { DbtGovernanceRulePackInput } from './contracts.js';
import {
  buildDbtInferredTestNodeIdsByTarget,
  getDbtDependencyRelations,
  getDbtNodes,
  toRelationKey,
  toRelationReference,
  toResolverInput,
} from './dbt-graph.js';
import { isDbtPublicModelDocumentationTarget } from './applicability.js';
import { buildDbtGovernanceDiagnostics } from './diagnostics.js';
import {
  buildDbtGovernanceSignals,
  type DbtGovernanceSignalCode,
} from './signals.js';
import {
  resolveDbtGovernanceMetadata,
  type DbtGovernanceMetadataResolution,
} from './resolvers.js';

export const DBT_BASIC_ARCHITECTURE_RULE_PACK_ID = 'dbt-architecture-basic';

export const DBT_BASIC_ARCHITECTURE_RULE_IDS = [
  'dbt/no-disallowed-layer-dependency',
  'dbt/no-mart-to-mart-dependency',
  'dbt/critical-models-require-owner',
  'dbt/public-models-require-description',
  'dbt/critical-models-require-tests',
  'dbt/public-models-require-contract',
  'dbt/cross-domain-dependencies-require-approval',
] as const;

export type DbtArchitectureRuleId =
  (typeof DBT_BASIC_ARCHITECTURE_RULE_IDS)[number];

export interface DbtLayerDependencyRuleOptions {
  allowedUpstreamByLayer?: Record<string, string[]>;
}

export interface DbtMartDependencyRuleOptions {
  martLayers?: string[];
}

export interface DbtCriticalModelRuleOptions {
  criticalityLevels?: string[];
  requireExplicitCriticality?: boolean;
}

export interface DbtCrossDomainApprovalRuleOptions {
  approvalMetadataPaths?: string[];
}

export interface DbtArchitectureRulePackOptions {
  noDisallowedLayerDependency?: DbtLayerDependencyRuleOptions;
  noMartToMartDependency?: DbtMartDependencyRuleOptions;
  criticalModelsRequireOwner?: DbtCriticalModelRuleOptions;
  criticalModelsRequireTests?: DbtCriticalModelRuleOptions;
  crossDomainDependenciesRequireApproval?: DbtCrossDomainApprovalRuleOptions;
}

export interface DbtArchitectureRulePack extends GovernanceExtensionRulePack {
  id: typeof DBT_BASIC_ARCHITECTURE_RULE_PACK_ID;
  name: string;
  ruleIds: readonly DbtArchitectureRuleId[];
}

interface ResolvedDbtArchitectureContext {
  profile: GovernanceProfile;
  metadataResolutions: readonly DbtGovernanceMetadataResolution[];
  diagnostics: readonly GovernanceDiagnostic[];
  signals: readonly GovernanceSignal[];
  options: Required<DbtArchitectureRulePackOptions>;
}

interface RuleConfig<TOptions> {
  enabled: boolean;
  severity: Violation['severity'];
  options: TOptions;
}

interface CreateViolationOptions {
  ruleId: DbtArchitectureRuleId;
  subjectId: string;
  severity: Violation['severity'];
  category: Violation['category'];
  message: string;
  details?: Record<string, unknown>;
  recommendation: string;
  reference?: Violation['reference'];
  identityParts: readonly string[];
}

const DEFAULT_CRITICALITY_LEVELS = ['high', 'critical'] as const;
const DEFAULT_MART_LAYERS = ['marts'] as const;
const DEFAULT_CROSS_DOMAIN_APPROVAL_PATHS = [
  'dbt.governance.crossDomainApproved',
  'dbt.lineage.crossDomainApproved',
  'dbt.lineage.approved',
] as const;

export const dbtArchitectureBasicRulePack =
  createDbtArchitectureBasicRulePack();

export function createDbtArchitectureBasicRulePack(
  options: DbtArchitectureRulePackOptions = {},
): DbtArchitectureRulePack {
  return {
    id: DBT_BASIC_ARCHITECTURE_RULE_PACK_ID,
    name: 'dbt Basic Architecture Rule Pack',
    ruleIds: DBT_BASIC_ARCHITECTURE_RULE_IDS,
    evaluate: (input) => evaluateDbtArchitectureViolations(input, options),
  };
}

export function evaluateDbtArchitectureViolations(
  input: DbtGovernanceRulePackInput,
  options: DbtArchitectureRulePackOptions = {},
): Violation[] {
  const dependencyRelations = getDbtDependencyRelations(input.workspace);
  const context = resolveDbtArchitectureContext(input, options);
  const resolutionById = new Map(
    context.metadataResolutions.map((resolution) => [
      resolution.governanceNodeId,
      resolution,
    ]),
  );
  const violations: Violation[] = [];

  for (const relation of dependencyRelations) {
    const source = resolutionById.get(relation.sourceNodeId);
    const target = resolutionById.get(relation.targetNodeId);

    violations.push(
      ...evaluateNoDisallowedLayerDependency(context, relation, source, target),
      ...evaluateNoMartToMartDependency(context, relation, source, target),
      ...evaluateCrossDomainDependenciesRequireApproval(
        context,
        relation,
        source,
        target,
      ),
    );
  }

  for (const resolution of context.metadataResolutions) {
    violations.push(
      ...evaluateCriticalModelsRequireOwner(context, resolution),
      ...evaluatePublicModelsRequireDescription(context, resolution),
      ...evaluateCriticalModelsRequireTests(context, resolution),
      ...evaluatePublicModelsRequireContract(context, resolution),
    );
  }

  return violations.sort((left, right) =>
    `${left.ruleId}:${left.id}`.localeCompare(`${right.ruleId}:${right.id}`),
  );
}

function resolveDbtArchitectureContext(
  input: DbtGovernanceRulePackInput,
  options: DbtArchitectureRulePackOptions,
): ResolvedDbtArchitectureContext {
  const inferredTestNodeIdsByTarget = buildDbtInferredTestNodeIdsByTarget(
    input.workspace,
  );
  const metadataResolutions =
    input.metadataResolutions && input.metadataResolutions.length > 0
      ? input.metadataResolutions
      : getDbtNodes(input.workspace).map((node) =>
          resolveDbtGovernanceMetadata(
            toResolverInput(node, inferredTestNodeIdsByTarget),
          ),
        );

  const diagnostics =
    input.diagnostics && input.diagnostics.length > 0
      ? input.diagnostics
      : buildDbtGovernanceDiagnostics({
          workspace: input.workspace,
          profile: input.profile,
          context: input.context,
          violations: [],
          signals: [],
          measurements: [],
          diagnostics: [],
          metadataResolutions,
        });

  const signals =
    input.signals && input.signals.length > 0
      ? input.signals
      : buildDbtGovernanceSignals({
          workspace: input.workspace,
          profile: input.profile,
          context: input.context,
          violations: [],
          signals: [],
          diagnostics,
          metadataResolutions,
        });

  return {
    profile: input.profile,
    metadataResolutions,
    diagnostics,
    signals,
    options: {
      noDisallowedLayerDependency: {
        ...(options.noDisallowedLayerDependency ?? {}),
      },
      noMartToMartDependency: {
        martLayers: [
          ...(options.noMartToMartDependency?.martLayers ??
            DEFAULT_MART_LAYERS),
        ],
      },
      criticalModelsRequireOwner: {
        criticalityLevels: [
          ...(options.criticalModelsRequireOwner?.criticalityLevels ??
            DEFAULT_CRITICALITY_LEVELS),
        ],
        requireExplicitCriticality:
          options.criticalModelsRequireOwner?.requireExplicitCriticality ??
          false,
      },
      criticalModelsRequireTests: {
        criticalityLevels: [
          ...(options.criticalModelsRequireTests?.criticalityLevels ??
            DEFAULT_CRITICALITY_LEVELS),
        ],
        requireExplicitCriticality:
          options.criticalModelsRequireTests?.requireExplicitCriticality ??
          false,
      },
      crossDomainDependenciesRequireApproval: {
        approvalMetadataPaths: [
          ...(options.crossDomainDependenciesRequireApproval
            ?.approvalMetadataPaths ?? DEFAULT_CROSS_DOMAIN_APPROVAL_PATHS),
        ],
      },
    },
  };
}

function evaluateNoDisallowedLayerDependency(
  context: ResolvedDbtArchitectureContext,
  relation: GovernanceRelation,
  source: DbtGovernanceMetadataResolution | undefined,
  target: DbtGovernanceMetadataResolution | undefined,
): Violation[] {
  const config = resolveRuleConfig(
    context.profile,
    'dbt/no-disallowed-layer-dependency',
    'error',
    {
      allowedUpstreamByLayer:
        context.options.noDisallowedLayerDependency.allowedUpstreamByLayer ??
        createDefaultAllowedUpstreamByLayer(context.profile.layers),
    } satisfies DbtLayerDependencyRuleOptions,
  );

  if (
    !config.enabled ||
    !source ||
    !target ||
    source.layer.status !== 'resolved' ||
    target.layer.status !== 'resolved'
  ) {
    return [];
  }

  const sourceLayer = source.layer.value;
  const targetLayer = target.layer.value;

  if (!sourceLayer || !targetLayer) {
    throw new Error('Expected resolved dbt layer values.');
  }

  const allowedTargets = config.options.allowedUpstreamByLayer?.[sourceLayer];
  if (!allowedTargets || allowedTargets.includes(targetLayer)) {
    return [];
  }

  return [
    createViolation({
      ruleId: 'dbt/no-disallowed-layer-dependency',
      subjectId: relation.id,
      severity: config.severity,
      category: 'boundary',
      message: `dbt layer dependency violation: ${source.governanceNodeId} (${sourceLayer}) depends on ${target.governanceNodeId} (${targetLayer}).`,
      details: {
        sourceLayer,
        targetLayer,
        dependencyType: relation.kind,
        allowedUpstreamLayers: allowedTargets,
        supportingSignalIds: getDependencySignalIds(context.signals, relation, [
          'DBT_LAYER_DEPENDENCY_DETECTED',
          'DBT_LAYER_DIRECTION_CANDIDATE',
        ]),
      },
      recommendation:
        'Refactor the dependency so the source layer only depends on configured upstream layers, or update the dbt rule configuration when intentional.',
      reference: toRelationReference(relation),
      identityParts: ['no-disallowed-layer-dependency', relation.id],
    }),
  ];
}

function evaluateNoMartToMartDependency(
  context: ResolvedDbtArchitectureContext,
  relation: GovernanceRelation,
  source: DbtGovernanceMetadataResolution | undefined,
  target: DbtGovernanceMetadataResolution | undefined,
): Violation[] {
  const config = resolveRuleConfig(
    context.profile,
    'dbt/no-mart-to-mart-dependency',
    'warning',
    {
      martLayers: context.options.noMartToMartDependency.martLayers,
    } satisfies DbtMartDependencyRuleOptions,
  );

  if (
    !config.enabled ||
    !source ||
    !target ||
    source.layer.status !== 'resolved' ||
    target.layer.status !== 'resolved'
  ) {
    return [];
  }

  const sourceLayer = source.layer.value;
  const targetLayer = target.layer.value;

  if (!sourceLayer || !targetLayer) {
    throw new Error('Expected resolved dbt mart layer values.');
  }

  const martLayers = new Set(config.options.martLayers ?? []);
  if (!martLayers.has(sourceLayer) || !martLayers.has(targetLayer)) {
    return [];
  }

  return [
    createViolation({
      ruleId: 'dbt/no-mart-to-mart-dependency',
      subjectId: relation.id,
      severity: config.severity,
      category: 'boundary',
      message: `dbt mart-to-mart dependency detected: ${source.governanceNodeId} depends on ${target.governanceNodeId}.`,
      details: {
        sourceLayer,
        targetLayer,
        martLayers: [...martLayers],
        dependencyType: relation.kind,
        supportingSignalIds: getDependencySignalIds(context.signals, relation, [
          'DBT_LAYER_DEPENDENCY_DETECTED',
        ]),
      },
      recommendation:
        'Refactor shared marts behind an intermediate or staging layer, or reconfigure mart layers when the architecture intentionally treats them differently.',
      reference: toRelationReference(relation),
      identityParts: ['no-mart-to-mart-dependency', relation.id],
    }),
  ];
}

function evaluateCriticalModelsRequireOwner(
  context: ResolvedDbtArchitectureContext,
  resolution: DbtGovernanceMetadataResolution,
): Violation[] {
  const config = resolveRuleConfig(
    context.profile,
    'dbt/critical-models-require-owner',
    'warning',
    {
      criticalityLevels:
        context.options.criticalModelsRequireOwner.criticalityLevels,
      requireExplicitCriticality:
        context.options.criticalModelsRequireOwner.requireExplicitCriticality,
    } satisfies DbtCriticalModelRuleOptions,
  );

  if (!config.enabled) {
    return [];
  }

  if (
    resolution.criticality.status !== 'resolved' ||
    !resolution.criticality.value
  ) {
    return config.options.requireExplicitCriticality ? [] : [];
  }

  const criticality = resolution.criticality.value.toLowerCase();
  const criticalityLevels = new Set(
    (config.options.criticalityLevels ?? []).map((level) =>
      level.toLowerCase(),
    ),
  );

  if (criticalityLevels.size === 0 || !criticalityLevels.has(criticality)) {
    return [];
  }

  if (resolution.owner.status === 'resolved' && resolution.owner.value) {
    return [];
  }

  return [
    createViolation({
      ruleId: 'dbt/critical-models-require-owner',
      subjectId: resolution.governanceNodeId,
      severity: config.severity,
      category: 'ownership',
      message: `Critical dbt model ${resolution.governanceNodeId} has no valid owner metadata.`,
      details: {
        criticality,
        ownerResolution: resolution.owner.status,
        supportingSignalIds: getNodeSignalIds(context.signals, resolution, [
          'DBT_OWNER_MISSING',
        ]),
        supportingDiagnosticCodes: getNodeDiagnosticCodes(
          context.diagnostics,
          resolution.governanceNodeId,
        ),
      },
      recommendation:
        'Add valid owner metadata for critical dbt models before relying on them as governed resources.',
      reference: {
        nodeId: resolution.governanceNodeId,
      },
      identityParts: [
        'critical-models-require-owner',
        resolution.governanceNodeId,
      ],
    }),
  ];
}

function evaluatePublicModelsRequireDescription(
  context: ResolvedDbtArchitectureContext,
  resolution: DbtGovernanceMetadataResolution,
): Violation[] {
  const config = resolveRuleConfig(
    context.profile,
    'dbt/public-models-require-description',
    'warning',
    {},
  );

  if (
    !config.enabled ||
    !isDbtPublicModelDocumentationTarget(resolution) ||
    resolution.publicInterface.status !== 'resolved' ||
    resolution.publicInterface.value !== true ||
    (resolution.documentationPresent.status === 'resolved' &&
      resolution.documentationPresent.value === true)
  ) {
    return [];
  }

  return [
    createViolation({
      ruleId: 'dbt/public-models-require-description',
      subjectId: resolution.governanceNodeId,
      severity: config.severity,
      category: 'documentation',
      message: `Public or governed dbt model ${resolution.governanceNodeId} does not have a description.`,
      details: {
        publicInterface: true,
        documentationResolution: resolution.documentationPresent.status,
        supportingSignalIds: getNodeSignalIds(context.signals, resolution, [
          'DBT_DESCRIPTION_MISSING',
          'DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE',
        ]),
      },
      recommendation:
        'Add a description so public or governed dbt models remain interpretable to downstream consumers.',
      reference: {
        nodeId: resolution.governanceNodeId,
      },
      identityParts: [
        'public-models-require-description',
        resolution.governanceNodeId,
      ],
    }),
  ];
}

function evaluateCriticalModelsRequireTests(
  context: ResolvedDbtArchitectureContext,
  resolution: DbtGovernanceMetadataResolution,
): Violation[] {
  const config = resolveRuleConfig(
    context.profile,
    'dbt/critical-models-require-tests',
    'warning',
    {
      criticalityLevels:
        context.options.criticalModelsRequireTests.criticalityLevels,
      requireExplicitCriticality:
        context.options.criticalModelsRequireTests.requireExplicitCriticality,
    } satisfies DbtCriticalModelRuleOptions,
  );

  if (!config.enabled) {
    return [];
  }

  if (
    resolution.criticality.status !== 'resolved' ||
    !resolution.criticality.value
  ) {
    return config.options.requireExplicitCriticality ? [] : [];
  }

  const criticality = resolution.criticality.value.toLowerCase();
  const criticalityLevels = new Set(
    (config.options.criticalityLevels ?? []).map((level) =>
      level.toLowerCase(),
    ),
  );

  if (criticalityLevels.size === 0 || !criticalityLevels.has(criticality)) {
    return [];
  }

  if (
    resolution.testsPresent.status === 'resolved' &&
    resolution.testsPresent.value === true
  ) {
    return [];
  }

  return [
    createViolation({
      ruleId: 'dbt/critical-models-require-tests',
      subjectId: resolution.governanceNodeId,
      severity: config.severity,
      category: 'metadata',
      message: `Critical dbt model ${resolution.governanceNodeId} does not have tests.`,
      details: {
        criticality,
        testsResolution: resolution.testsPresent.status,
        supportingSignalIds: getNodeSignalIds(context.signals, resolution, [
          'DBT_TESTS_MISSING',
          'DBT_CRITICAL_MODEL_WITHOUT_TESTS_CANDIDATE',
        ]),
      },
      recommendation:
        'Add dbt tests to critical models so governance can treat them as dependable assets.',
      reference: {
        nodeId: resolution.governanceNodeId,
      },
      identityParts: [
        'critical-models-require-tests',
        resolution.governanceNodeId,
      ],
    }),
  ];
}

function evaluatePublicModelsRequireContract(
  context: ResolvedDbtArchitectureContext,
  resolution: DbtGovernanceMetadataResolution,
): Violation[] {
  const config = resolveRuleConfig(
    context.profile,
    'dbt/public-models-require-contract',
    'warning',
    {},
  );

  if (
    !config.enabled ||
    resolution.publicInterface.status !== 'resolved' ||
    resolution.publicInterface.value !== true ||
    (resolution.contractPresent.status === 'resolved' &&
      resolution.contractPresent.value === true)
  ) {
    return [];
  }

  return [
    createViolation({
      ruleId: 'dbt/public-models-require-contract',
      subjectId: resolution.governanceNodeId,
      severity: config.severity,
      category: 'metadata',
      message: `Public or governed dbt model ${resolution.governanceNodeId} does not expose contract metadata.`,
      details: {
        publicInterface: true,
        contractResolution: resolution.contractPresent.status,
        supportingSignalIds: getNodeSignalIds(context.signals, resolution, [
          'DBT_CONTRACT_MISSING_FOR_PUBLIC_MODEL_CANDIDATE',
        ]),
      },
      recommendation:
        'Enable or preserve contract metadata for public or governed dbt models so downstream usage remains explicit.',
      reference: {
        nodeId: resolution.governanceNodeId,
      },
      identityParts: [
        'public-models-require-contract',
        resolution.governanceNodeId,
      ],
    }),
  ];
}

function evaluateCrossDomainDependenciesRequireApproval(
  context: ResolvedDbtArchitectureContext,
  relation: GovernanceRelation,
  source: DbtGovernanceMetadataResolution | undefined,
  target: DbtGovernanceMetadataResolution | undefined,
): Violation[] {
  const config = resolveRuleConfig(
    context.profile,
    'dbt/cross-domain-dependencies-require-approval',
    'warning',
    {
      approvalMetadataPaths:
        context.options.crossDomainDependenciesRequireApproval
          .approvalMetadataPaths,
    } satisfies DbtCrossDomainApprovalRuleOptions,
  );

  if (
    !config.enabled ||
    !source ||
    !target ||
    source.domain.status !== 'resolved' ||
    target.domain.status !== 'resolved'
  ) {
    return [];
  }

  const sourceDomain = source.domain.value;
  const targetDomain = target.domain.value;
  if (!sourceDomain || !targetDomain || sourceDomain === targetDomain) {
    return [];
  }

  const approvalPaths = config.options.approvalMetadataPaths ?? [];
  if (approvalPaths.length === 0) {
    return [];
  }

  const matchedApprovalPath = approvalPaths.find((path) =>
    readBooleanishPath(relation.metadata, path),
  );
  if (matchedApprovalPath) {
    return [];
  }

  return [
    createViolation({
      ruleId: 'dbt/cross-domain-dependencies-require-approval',
      subjectId: relation.id,
      severity: config.severity,
      category: 'boundary',
      message: `Cross-domain dbt dependency ${source.governanceNodeId} (${sourceDomain}) -> ${target.governanceNodeId} (${targetDomain}) has no approval metadata.`,
      details: {
        sourceDomain,
        targetDomain,
        checkedApprovalMetadataPaths: approvalPaths,
        supportingSignalIds: getDependencySignalIds(context.signals, relation, [
          'DBT_CROSS_DOMAIN_DEPENDENCY_DETECTED',
        ]),
      },
      recommendation:
        'Add explicit approval metadata for intentional cross-domain dbt dependencies or refactor the dependency to remain within the domain boundary.',
      reference: toRelationReference(relation),
      identityParts: [
        'cross-domain-dependencies-require-approval',
        relation.id,
      ],
    }),
  ];
}

function resolveRuleConfig<TOptions extends Record<string, unknown>>(
  profile: GovernanceProfile,
  ruleId: DbtArchitectureRuleId,
  defaultSeverity: Violation['severity'],
  defaultOptions: TOptions,
): RuleConfig<TOptions> {
  const rawConfig = asRecord(profile.rules?.[ruleId]);
  const rawOptions = asRecord(rawConfig?.options);

  return {
    enabled: rawConfig?.enabled !== false,
    severity:
      rawConfig?.severity === 'error' ||
      rawConfig?.severity === 'warning' ||
      rawConfig?.severity === 'info'
        ? rawConfig.severity
        : defaultSeverity,
    options: {
      ...defaultOptions,
      ...(rawOptions ? (rawOptions as Partial<TOptions>) : {}),
    },
  };
}

function createViolation({
  ruleId,
  subjectId,
  severity,
  category,
  message,
  details,
  recommendation,
  reference,
  identityParts,
}: CreateViolationOptions): Violation {
  return {
    id: createViolationId(identityParts),
    ruleId,
    subjectId,
    severity,
    category,
    message,
    ...(details ? { details } : {}),
    recommendation,
    ...(reference ? { reference } : {}),
  };
}

function createViolationId(identityParts: readonly string[]): string {
  return `dbt-violation-${createHash('sha256')
    .update(identityParts.join('|'))
    .digest('hex')
    .slice(0, 16)}`;
}

function createDefaultAllowedUpstreamByLayer(
  layers: readonly string[],
): Record<string, string[]> {
  const normalizedLayers =
    layers.length > 0 ? [...layers] : ['staging', 'intermediate', 'marts'];
  const byLayer: Record<string, string[]> = {};

  normalizedLayers.forEach((layer, index) => {
    if (layer === 'staging') {
      byLayer[layer] = ['staging'];
      return;
    }

    if (layer === 'intermediate') {
      byLayer[layer] = ['staging', 'intermediate'].filter((candidate) =>
        normalizedLayers.includes(candidate),
      );
      return;
    }

    if (layer === 'marts') {
      byLayer[layer] = ['intermediate', 'marts'].filter((candidate) =>
        normalizedLayers.includes(candidate),
      );
      return;
    }

    byLayer[layer] = normalizedLayers.slice(0, index + 1);
  });

  return byLayer;
}

function getNodeSignalIds(
  signals: readonly GovernanceSignal[],
  resolution: DbtGovernanceMetadataResolution,
  codes: readonly DbtGovernanceSignalCode[],
): string[] {
  const codeSet = new Set(codes);

  return signals
    .filter((signal) => {
      const code = asSignalCode(signal.metadata?.code);
      return (
        signal.nodeId === resolution.governanceNodeId &&
        code !== undefined &&
        codeSet.has(code)
      );
    })
    .map((signal) => signal.id);
}

function getDependencySignalIds(
  signals: readonly GovernanceSignal[],
  relation: GovernanceRelation,
  codes: readonly DbtGovernanceSignalCode[],
): string[] {
  const dependencyKey = toRelationKey(relation);
  const codeSet = new Set(codes);

  return signals
    .filter((signal) => {
      const code = asSignalCode(signal.metadata?.code);
      return (
        (signal.relationId === relation.id ||
          asString(signal.metadata?.dependencyKey) === dependencyKey) &&
        code !== undefined &&
        codeSet.has(code)
      );
    })
    .map((signal) => signal.id);
}

function getNodeDiagnosticCodes(
  diagnostics: readonly GovernanceDiagnostic[],
  governanceNodeId: string,
): string[] {
  return diagnostics
    .filter((diagnostic) => {
      if (diagnostic.reference?.nodeId === governanceNodeId) {
        return true;
      }

      const details = asRecord(diagnostic.details);
      return asString(details?.governanceNodeId) === governanceNodeId;
    })
    .map((diagnostic) => diagnostic.code);
}

function readBooleanishPath(
  metadata: Record<string, unknown> | undefined,
  path: string,
): boolean {
  const value = readPathValue(metadata, path.split('.'));

  return (
    value === true ||
    value === 'true' ||
    value === 'approved' ||
    value === 'yes'
  );
}

function readPathValue(value: unknown, path: readonly string[]): unknown {
  let current = value;

  for (const segment of path) {
    const currentRecord = asRecord(current);
    if (!currentRecord || !(segment in currentRecord)) {
      return undefined;
    }
    current = currentRecord[segment];
  }

  return current;
}

function asSignalCode(value: unknown): DbtGovernanceSignalCode | undefined {
  return typeof value === 'string'
    ? (value as DbtGovernanceSignalCode)
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
