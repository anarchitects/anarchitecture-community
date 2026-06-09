import type {
  GovernanceDiagnostic,
  GovernanceSignal,
  Measurement,
  Violation,
} from '@anarchitects/governance-core';

import type {
  DbtGovernanceMetricProvider,
  DbtGovernanceMetricProviderInput,
} from './contracts.js';
import { buildDbtGovernanceDiagnostics } from './diagnostics.js';
import {
  DBT_BASIC_ARCHITECTURE_RULE_PACK_ID,
  evaluateDbtArchitectureViolations,
} from './rule-pack.js';
import { buildDbtGovernanceSignals } from './signals.js';
import {
  resolveDbtGovernanceMetadata,
  type DbtGovernanceMetadataResolution,
  type DbtGovernanceMetadataResolverInput,
} from './resolvers.js';
import { toCompatibilityWorkspace } from './workspace-compat.js';

export const DBT_GOVERNANCE_METRIC_IDS = [
  'dbt-model-count',
  'dbt-dependency-count',
  'dbt-cross-domain-dependency-count',
  'dbt-layer-violation-count',
  'dbt-ownership-completeness-ratio',
  'dbt-documentation-coverage-ratio',
  'dbt-test-coverage-ratio',
  'dbt-contract-adoption-ratio',
  'dbt-hotspot-count',
  'dbt-unresolved-layer-count',
  'dbt-unresolved-domain-count',
] as const;

export type DbtGovernanceMetricId = (typeof DBT_GOVERNANCE_METRIC_IDS)[number];

export interface DbtGovernanceMetricMetadata extends Record<string, unknown> {
  metricId: DbtGovernanceMetricId;
  rawKind: 'count' | 'ratio';
  count?: number;
  numerator?: number;
  denominator?: number;
  ratio?: number;
  zeroDenominator?: boolean;
  eligibleResourceIds?: string[];
  countedResourceIds?: string[];
  countedDependencyKeys?: string[];
  countedSignalIds?: string[];
  countedDiagnosticIds?: string[];
  countedViolationIds?: string[];
  countedDiagnosticCodes?: string[];
}

export interface DbtGovernanceMeasurement extends Measurement {
  id: DbtGovernanceMetricId;
  metadata?: DbtGovernanceMetricMetadata;
}

interface ResolvedDbtMetricContext {
  metadataResolutions: readonly DbtGovernanceMetadataResolution[];
  diagnostics: readonly GovernanceDiagnostic[];
  signals: readonly GovernanceSignal[];
  violations: readonly Violation[];
  modelIds: Set<string>;
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

interface DbtDependencyLike {
  source: string;
  target: string;
  type?: string;
}

const DEFAULT_PROVIDER_ID = 'dbt-governance-metrics';
const HOTSPOT_SIGNAL_CODES = new Set([
  'DBT_HIGH_FAN_IN',
  'DBT_HIGH_FAN_OUT',
  'DBT_ARCHITECTURAL_HOTSPOT_CANDIDATE',
]);

export const dbtGovernanceMetricProvider = createDbtGovernanceMetricProvider();

export function createDbtGovernanceMetricProvider(): DbtGovernanceMetricProvider {
  return {
    id: DEFAULT_PROVIDER_ID,
    provideMetrics: (input) => buildDbtGovernanceMetrics(input),
  };
}

export function buildDbtGovernanceMetrics(
  input: DbtGovernanceMetricProviderInput,
): DbtGovernanceMeasurement[] {
  const compatibilityWorkspace = toCompatibilityWorkspace(input.workspace);
  const context = resolveDbtMetricContext(input);
  const modelDependencies = compatibilityWorkspace.dependencies.filter(
    (dependency) =>
      context.modelIds.has(dependency.source) &&
      context.modelIds.has(dependency.target),
  );
  const crossDomainSignals = context.signals.filter(
    (signal) =>
      signal.metadata?.code === 'DBT_CROSS_DOMAIN_DEPENDENCY_DETECTED',
  );
  const countedCrossDomainDependencyKeys = dedupeAndSortStrings(
    crossDomainSignals.flatMap((signal) => {
      const dependencyKey = asString(signal.metadata?.dependencyKey);
      return dependencyKey ? [dependencyKey] : [];
    }),
  );
  const crossDomainDependencyKeys =
    countedCrossDomainDependencyKeys.length > 0
      ? countedCrossDomainDependencyKeys
      : modelDependencies
          .filter((dependency) =>
            isCrossDomainDependency(context.metadataResolutions, dependency),
          )
          .map(toDependencyKey)
          .sort();
  const layerViolations = context.violations.filter(
    (violation) => violation.ruleId === 'dbt/no-disallowed-layer-dependency',
  );
  const hotspotSignals = context.signals.filter((signal) =>
    HOTSPOT_SIGNAL_CODES.has(asString(signal.metadata?.code) ?? ''),
  );
  const hotspotResourceIds = [
    ...new Set(
      hotspotSignals.flatMap((signal) =>
        signal.nodeId ? [signal.nodeId] : (signal.relatedNodeIds ?? []),
      ),
    ),
  ].sort();
  const unresolvedLayerDiagnostics = context.diagnostics.filter(
    (diagnostic) => diagnostic.code === 'DBT_LAYER_UNRESOLVED',
  );
  const unresolvedDomainDiagnostics = context.diagnostics.filter(
    (diagnostic) => diagnostic.code === 'DBT_DOMAIN_UNRESOLVED',
  );
  const unresolvedLayerIds = context.metadataResolutions
    .filter((resolution) => resolution.layer.status === 'unresolved')
    .map((resolution) => resolution.governanceNodeId)
    .sort();
  const unresolvedDomainIds = context.metadataResolutions
    .filter((resolution) => resolution.domain.status === 'unresolved')
    .map((resolution) => resolution.governanceNodeId)
    .sort();

  return [
    createCountMeasurement({
      id: 'dbt-model-count',
      name: 'dbt Model Count',
      family: 'architecture',
      count: context.modelIds.size,
      countedResourceIds: [...context.modelIds].sort(),
    }),
    createCountMeasurement({
      id: 'dbt-dependency-count',
      name: 'dbt Dependency Count',
      family: 'architecture',
      count: modelDependencies.length,
      countedDependencyKeys: modelDependencies.map(toDependencyKey).sort(),
    }),
    createCountMeasurement({
      id: 'dbt-cross-domain-dependency-count',
      name: 'dbt Cross-Domain Dependency Count',
      family: 'boundaries',
      count: crossDomainDependencyKeys.length,
      countedDependencyKeys: crossDomainDependencyKeys,
      countedSignalIds: crossDomainSignals.map((signal) => signal.id).sort(),
      signalIds: crossDomainSignals.map((signal) => signal.id).sort(),
    }),
    createCountMeasurement({
      id: 'dbt-layer-violation-count',
      name: 'dbt Layer Violation Count',
      family: 'boundaries',
      count: layerViolations.length,
      countedViolationIds: layerViolations
        .map((violation) => violation.id)
        .sort(),
      metadata: {
        rulePackId: DBT_BASIC_ARCHITECTURE_RULE_PACK_ID,
      },
    }),
    createRatioMeasurement({
      id: 'dbt-ownership-completeness-ratio',
      name: 'dbt Ownership Completeness Ratio',
      family: 'ownership',
      eligibleResourceIds: [...context.modelIds].sort(),
      countedResourceIds: context.metadataResolutions
        .filter(
          (resolution) =>
            context.modelIds.has(resolution.governanceNodeId) &&
            resolution.owner.status === 'resolved' &&
            Boolean(resolution.owner.value),
        )
        .map((resolution) => resolution.governanceNodeId)
        .sort(),
    }),
    createRatioMeasurement({
      id: 'dbt-documentation-coverage-ratio',
      name: 'dbt Documentation Coverage Ratio',
      family: 'documentation',
      eligibleResourceIds: [...context.modelIds].sort(),
      countedResourceIds: context.metadataResolutions
        .filter(
          (resolution) =>
            context.modelIds.has(resolution.governanceNodeId) &&
            resolution.documentationPresent.status === 'resolved' &&
            resolution.documentationPresent.value === true,
        )
        .map((resolution) => resolution.governanceNodeId)
        .sort(),
    }),
    createRatioMeasurement({
      id: 'dbt-test-coverage-ratio',
      name: 'dbt Test Coverage Ratio',
      family: 'documentation',
      eligibleResourceIds: [...context.modelIds].sort(),
      countedResourceIds: context.metadataResolutions
        .filter(
          (resolution) =>
            context.modelIds.has(resolution.governanceNodeId) &&
            resolution.testsPresent.status === 'resolved' &&
            resolution.testsPresent.value === true,
        )
        .map((resolution) => resolution.governanceNodeId)
        .sort(),
    }),
    createRatioMeasurement({
      id: 'dbt-contract-adoption-ratio',
      name: 'dbt Contract Adoption Ratio',
      family: 'documentation',
      eligibleResourceIds: [...context.modelIds].sort(),
      countedResourceIds: context.metadataResolutions
        .filter(
          (resolution) =>
            context.modelIds.has(resolution.governanceNodeId) &&
            resolution.contractPresent.status === 'resolved' &&
            resolution.contractPresent.value === true,
        )
        .map((resolution) => resolution.governanceNodeId)
        .sort(),
    }),
    createCountMeasurement({
      id: 'dbt-hotspot-count',
      name: 'dbt Hotspot Count',
      family: 'architecture',
      count: hotspotResourceIds.length,
      countedResourceIds: hotspotResourceIds,
      countedSignalIds: hotspotSignals.map((signal) => signal.id).sort(),
      signalIds: hotspotSignals.map((signal) => signal.id).sort(),
    }),
    createCountMeasurement({
      id: 'dbt-unresolved-layer-count',
      name: 'dbt Unresolved Layer Count',
      family: 'boundaries',
      count: unresolvedLayerIds.length,
      countedResourceIds: unresolvedLayerIds,
      countedDiagnosticIds: unresolvedLayerDiagnostics
        .map((diagnostic) => diagnostic.id)
        .filter((id): id is string => Boolean(id))
        .sort(),
      countedDiagnosticCodes: ['DBT_LAYER_UNRESOLVED'],
    }),
    createCountMeasurement({
      id: 'dbt-unresolved-domain-count',
      name: 'dbt Unresolved Domain Count',
      family: 'boundaries',
      count: unresolvedDomainIds.length,
      countedResourceIds: unresolvedDomainIds,
      countedDiagnosticIds: unresolvedDomainDiagnostics
        .map((diagnostic) => diagnostic.id)
        .filter((id): id is string => Boolean(id))
        .sort(),
      countedDiagnosticCodes: ['DBT_DOMAIN_UNRESOLVED'],
    }),
  ];
}

function resolveDbtMetricContext(
  input: DbtGovernanceMetricProviderInput,
): ResolvedDbtMetricContext {
  const compatibilityWorkspace = toCompatibilityWorkspace(input.workspace);
  const metadataResolutions =
    input.metadataResolutions && input.metadataResolutions.length > 0
      ? input.metadataResolutions
      : compatibilityWorkspace.projects
          .filter((project) => hasDbtMetadata(project.metadata))
          .map((project) =>
            resolveDbtGovernanceMetadata(toResolverInput(project)),
          );
  const modelIds = new Set(
    compatibilityWorkspace.projects
      .filter((project) => isDbtModelProject(project))
      .map((project) => project.id),
  );
  const diagnostics =
    input.diagnostics && input.diagnostics.length > 0
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

  return {
    metadataResolutions,
    diagnostics,
    signals,
    violations,
    modelIds,
  };
}

function createCountMeasurement(options: {
  id: DbtGovernanceMetricId;
  name: string;
  family: Measurement['family'];
  count: number;
  countedResourceIds?: string[];
  countedDependencyKeys?: string[];
  countedSignalIds?: string[];
  countedDiagnosticIds?: string[];
  countedViolationIds?: string[];
  countedDiagnosticCodes?: string[];
  signalIds?: string[];
  metadata?: Record<string, unknown>;
}): DbtGovernanceMeasurement {
  return {
    id: options.id,
    name: options.name,
    family: options.family,
    value: options.count,
    score: options.count,
    maxScore: options.count,
    unit: 'count',
    ...(options.signalIds && options.signalIds.length > 0
      ? { signalIds: options.signalIds }
      : {}),
    metadata: {
      metricId: options.id,
      rawKind: 'count',
      count: options.count,
      ...(options.countedResourceIds
        ? { countedResourceIds: options.countedResourceIds }
        : {}),
      ...(options.countedDependencyKeys
        ? { countedDependencyKeys: options.countedDependencyKeys }
        : {}),
      ...(options.countedSignalIds
        ? { countedSignalIds: options.countedSignalIds }
        : {}),
      ...(options.countedDiagnosticIds
        ? { countedDiagnosticIds: options.countedDiagnosticIds }
        : {}),
      ...(options.countedViolationIds
        ? { countedViolationIds: options.countedViolationIds }
        : {}),
      ...(options.countedDiagnosticCodes
        ? { countedDiagnosticCodes: options.countedDiagnosticCodes }
        : {}),
      ...(options.metadata ?? {}),
    },
  };
}

function createRatioMeasurement(options: {
  id: DbtGovernanceMetricId;
  name: string;
  family: Measurement['family'];
  eligibleResourceIds: string[];
  countedResourceIds: string[];
}): DbtGovernanceMeasurement {
  const denominator = options.eligibleResourceIds.length;
  const numerator = options.countedResourceIds.length;
  const ratio = denominator === 0 ? 0 : numerator / denominator;

  return {
    id: options.id,
    name: options.name,
    family: options.family,
    value: Number(ratio.toFixed(4)),
    score: Number(ratio.toFixed(4)),
    maxScore: 1,
    unit: 'ratio',
    metadata: {
      metricId: options.id,
      rawKind: 'ratio',
      numerator,
      denominator,
      ratio: Number(ratio.toFixed(4)),
      zeroDenominator: denominator === 0,
      eligibleResourceIds: options.eligibleResourceIds,
      countedResourceIds: options.countedResourceIds,
    },
  };
}

function isDbtModelProject(project: DbtProjectLike): boolean {
  const identity = asRecord(
    readPathValue(project.metadata, ['dbt', 'identity']),
  );
  const resourceType = asString(identity?.resourceType);
  const uniqueId = asString(identity?.uniqueId);

  if (resourceType) {
    return resourceType === 'model';
  }

  if (uniqueId) {
    return uniqueId.startsWith('model.');
  }

  return project.id.startsWith('model.');
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

function toDependencyKey(dependency: DbtDependencyLike): string {
  return `${dependency.source}->${dependency.target}`;
}

function isCrossDomainDependency(
  metadataResolutions: readonly DbtGovernanceMetadataResolution[],
  dependency: DbtDependencyLike,
): boolean {
  const resolutionById = new Map(
    metadataResolutions.map((resolution) => [
      resolution.governanceNodeId,
      resolution,
    ]),
  );
  const source = resolutionById.get(dependency.source);
  const target = resolutionById.get(dependency.target);

  return Boolean(
    source &&
      target &&
      source.domain.status === 'resolved' &&
      target.domain.status === 'resolved' &&
      source.domain.value &&
      target.domain.value &&
      source.domain.value !== target.domain.value,
  );
}

function dedupeAndSortStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
