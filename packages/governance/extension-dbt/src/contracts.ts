import {
  getGovernanceExtensionModelExpansion,
  withGovernanceExtensionModelExpansion,
} from '@anarchitects/governance-core';
import type {
  GovernanceExtensionContractIssue,
  GovernanceCapability,
  GovernanceDiagnostic,
  GovernanceExtensionDefinition,
  GovernanceExtensionExecutionInput,
  GovernanceExtensionHost,
  GovernanceExtensionRulePack,
  GovernanceExtensionModelExpansion,
  GovernanceExtensionModelExpansionCarrier,
  GovernanceMetricProvider,
  GovernanceMetricProviderInput,
  GovernanceSignal,
  GovernanceSignalProvider,
  GovernanceSignalProviderInput,
  Measurement,
  Recommendation,
  Violation,
} from '@anarchitects/governance-core';

import {
  DBT_GOVERNANCE_EXPANSION_CONTRACT_VERSION,
  DBT_GOVERNANCE_EXTENSION_ID,
} from './constants.js';
import type { DbtGovernanceMetadataResolution } from './resolvers.js';

export const DBT_GOVERNANCE_DIAGNOSTIC_PROVIDER_CAPABILITY_PREFIX =
  'capability:governance:extension:dbt:diagnostic-provider:';

export const DBT_GOVERNANCE_RECOMMENDATION_PROVIDER_CAPABILITY_PREFIX =
  'capability:governance:extension:dbt:recommendation-provider:';

export type DbtGovernanceExtensionInput = GovernanceExtensionExecutionInput;

export interface DbtGovernanceWorkspaceExpansionData {
  kind: 'workspace';
  technology: 'dbt';
  projectName: string;
  projectVersion?: string | number;
  profile?: string;
  configVersion?: number;
  artifactPaths?: {
    projectDir?: string;
    dbtProjectPath?: string;
    manifestPath?: string;
    catalogPath?: string;
    runResultsPath?: string;
    sourcesPath?: string;
  };
  manifest?: {
    projectName: string;
    dbtSchemaVersion: string;
    dbtVersion?: string;
    adapterType?: string;
    generatedAt?: string;
    invocationId?: string;
  };
  projectNodeIds?: string[];
}

export interface DbtGovernanceNodeExpansionData {
  kind: 'node';
  technology: 'dbt';
  nodeKind: 'project' | 'resource' | 'unknown';
  resourceType:
    | 'project'
    | 'model'
    | 'seed'
    | 'snapshot'
    | 'source'
    | 'exposure'
    | 'test'
    | 'metric'
    | 'semantic_model'
    | 'saved_query'
    | 'unknown'
    | (string & {});
  project?: Record<string, unknown>;
  identity?: Record<string, unknown>;
  resource?: Record<string, unknown>;
  relation?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  documentation?: Record<string, unknown>;
}

export interface DbtGovernanceRelationExpansionData {
  kind: 'relation';
  technology: 'dbt';
  relationKind:
    | 'lineage'
    | 'exposes'
    | 'tests'
    | 'dependency'
    | 'uses-package'
    | 'unknown';
  source?: Record<string, unknown>;
  target?: Record<string, unknown>;
  lineage?: Record<string, unknown>;
}

export interface DbtGovernanceRuntimeContextExpansionData {
  kind: 'runtime-context';
  technology: 'dbt';
  config?: Record<string, unknown>;
  expectedFacts?: string[];
}

export type DbtGovernanceModelExpansionData =
  | DbtGovernanceWorkspaceExpansionData
  | DbtGovernanceNodeExpansionData
  | DbtGovernanceRelationExpansionData
  | DbtGovernanceRuntimeContextExpansionData;

export type DbtGovernanceModelExpansion<
  TData = DbtGovernanceModelExpansionData,
> = GovernanceExtensionModelExpansion<TData>;

export interface CreateDbtGovernanceModelExpansionOptions {
  contractVersion?: string;
  diagnostics?: readonly GovernanceExtensionContractIssue[];
  metadata?: Record<string, unknown>;
}

export interface DbtGovernanceRulePackInput
  extends DbtGovernanceExtensionInput {
  diagnostics?: readonly GovernanceDiagnostic[];
  signals?: readonly GovernanceSignal[];
  metadataResolutions?: readonly DbtGovernanceMetadataResolution[];
}

export interface DbtGovernanceSignalProviderInput
  extends GovernanceSignalProviderInput {
  diagnostics?: readonly GovernanceDiagnostic[];
  metadataResolutions?: readonly DbtGovernanceMetadataResolution[];
}

export interface DbtGovernanceMetricProviderInput
  extends GovernanceMetricProviderInput {
  diagnostics?: readonly GovernanceDiagnostic[];
  metadataResolutions?: readonly DbtGovernanceMetadataResolution[];
}

export interface DbtGovernanceDiagnosticProviderInput
  extends DbtGovernanceMetricProviderInput {
  diagnostics: GovernanceDiagnostic[];
  metadataResolutions?: readonly DbtGovernanceMetadataResolution[];
}

export interface DbtGovernanceRecommendationProviderInput
  extends DbtGovernanceDiagnosticProviderInput {
  recommendations: Recommendation[];
}

export interface DbtGovernanceDiagnosticProvider {
  id?: string;
  provideDiagnostics(
    input: DbtGovernanceDiagnosticProviderInput,
  ): GovernanceDiagnostic[] | Promise<GovernanceDiagnostic[]>;
}

export interface DbtGovernanceSignalProvider {
  id?: string;
  provideSignals(
    input: DbtGovernanceSignalProviderInput,
  ): GovernanceSignal[] | Promise<GovernanceSignal[]>;
}

export interface DbtGovernanceMetricProvider {
  id?: string;
  provideMetrics(
    input: DbtGovernanceMetricProviderInput,
  ): Measurement[] | Promise<Measurement[]>;
}

export interface DbtGovernanceRecommendationProvider {
  id?: string;
  provideRecommendations(
    input: DbtGovernanceRecommendationProviderInput,
  ): Recommendation[] | Promise<Recommendation[]>;
}

export interface DbtGovernanceProviderCapabilityData<TProvider> {
  technology: 'dbt';
  category:
    | 'diagnostics'
    | 'signals'
    | 'rule-packs'
    | 'metrics'
    | 'recommendations';
  provider: TProvider;
}

export interface DbtGovernanceExtensionContributions {
  rulePacks?: readonly GovernanceExtensionRulePack[];
  signalProviders?: readonly DbtGovernanceSignalProvider[];
  metricProviders?: readonly DbtGovernanceMetricProvider[];
  diagnosticProviders?: readonly DbtGovernanceDiagnosticProvider[];
  recommendationProviders?: readonly DbtGovernanceRecommendationProvider[];
}

export interface DbtGovernanceExtensionOptions {
  contributions?: DbtGovernanceExtensionContributions;
  version?: GovernanceExtensionDefinition['version'];
}

export function registerDbtGovernanceExtensionContributions(
  host: GovernanceExtensionHost,
  contributions: DbtGovernanceExtensionContributions = {},
): void {
  for (const rulePack of contributions.rulePacks ?? []) {
    host.registerRulePack(rulePack);
  }

  for (const signalProvider of contributions.signalProviders ?? []) {
    host.registerSignalProvider(signalProvider);
  }

  for (const metricProvider of contributions.metricProviders ?? []) {
    host.registerMetricProvider(metricProvider);
  }

  registerCapabilityProviders(
    host,
    contributions.diagnosticProviders ?? [],
    DBT_GOVERNANCE_DIAGNOSTIC_PROVIDER_CAPABILITY_PREFIX,
    'diagnostics',
  );
  registerCapabilityProviders(
    host,
    contributions.recommendationProviders ?? [],
    DBT_GOVERNANCE_RECOMMENDATION_PROVIDER_CAPABILITY_PREFIX,
    'recommendations',
  );
}

function registerCapabilityProviders<TProvider extends { id?: string }>(
  host: GovernanceExtensionHost,
  providers: readonly TProvider[],
  capabilityPrefix: string,
  category: DbtGovernanceProviderCapabilityData<TProvider>['category'],
): void {
  if (providers.length === 0) {
    return;
  }

  const registerCapability = resolveCapabilityRegistrar(host);

  if (!registerCapability) {
    throw new Error(
      `Governance host does not expose a mutable capability registry for dbt ${category} providers.`,
    );
  }

  providers.forEach((provider, index) => {
    registerCapability({
      id: createProviderCapabilityId(capabilityPrefix, provider.id, index),
      source: 'extension',
      data: {
        technology: 'dbt',
        category,
        provider,
      } satisfies DbtGovernanceProviderCapabilityData<TProvider>,
    });
  });
}

function resolveCapabilityRegistrar(
  host: GovernanceExtensionHost,
): ((capability: GovernanceCapability) => void) | undefined {
  return (
    host.context.capabilities.register?.bind(host.context.capabilities) ??
    host.context.capabilities.add?.bind(host.context.capabilities)
  );
}

function createProviderCapabilityId(
  prefix: string,
  providerId: string | undefined,
  index: number,
): string {
  return `${prefix}${providerId ?? index + 1}`;
}

export function collectDbtGovernanceDiagnostics(
  providers: readonly DbtGovernanceDiagnosticProvider[],
  input: DbtGovernanceDiagnosticProviderInput,
): Promise<GovernanceDiagnostic[]> {
  return Promise.all(
    providers.map((provider) => provider.provideDiagnostics(input)),
  ).then((results) => results.flat());
}

export function collectDbtGovernanceSignals(
  providers: readonly DbtGovernanceSignalProvider[],
  input: DbtGovernanceSignalProviderInput,
): Promise<GovernanceSignal[]> {
  return Promise.all(
    providers.map((provider) => provider.provideSignals(input)),
  ).then((results) => results.flat());
}

export function collectDbtGovernanceMeasurements(
  providers: readonly DbtGovernanceMetricProvider[],
  input: DbtGovernanceMetricProviderInput,
): Promise<Measurement[]> {
  return Promise.all(
    providers.map((provider) => provider.provideMetrics(input)),
  ).then((results) => results.flat());
}

export function collectDbtGovernanceRecommendations(
  providers: readonly DbtGovernanceRecommendationProvider[],
  input: DbtGovernanceRecommendationProviderInput,
): Promise<Recommendation[]> {
  return Promise.all(
    providers.map((provider) => provider.provideRecommendations(input)),
  ).then((results) => results.flat());
}

export function isDbtGovernanceDiagnosticProviderCapability(
  capability: GovernanceCapability,
): capability is GovernanceCapability<
  DbtGovernanceProviderCapabilityData<DbtGovernanceDiagnosticProvider>
> {
  return capability.id.startsWith(
    DBT_GOVERNANCE_DIAGNOSTIC_PROVIDER_CAPABILITY_PREFIX,
  );
}

export function isDbtGovernanceRecommendationProviderCapability(
  capability: GovernanceCapability,
): capability is GovernanceCapability<
  DbtGovernanceProviderCapabilityData<DbtGovernanceRecommendationProvider>
> {
  return capability.id.startsWith(
    DBT_GOVERNANCE_RECOMMENDATION_PROVIDER_CAPABILITY_PREFIX,
  );
}

export function getDbtGovernanceDiagnosticProviders(
  host: GovernanceExtensionHost,
): DbtGovernanceDiagnosticProvider[] {
  return host.context.capabilities
    .list()
    .filter(isDbtGovernanceDiagnosticProviderCapability)
    .flatMap((capability) =>
      capability.data ? [capability.data.provider] : [],
    );
}

export function getDbtGovernanceRecommendationProviders(
  host: GovernanceExtensionHost,
): DbtGovernanceRecommendationProvider[] {
  return host.context.capabilities
    .list()
    .filter(isDbtGovernanceRecommendationProviderCapability)
    .flatMap((capability) =>
      capability.data ? [capability.data.provider] : [],
    );
}

export function createDbtGovernanceModelExpansion<
  TData extends DbtGovernanceModelExpansionData,
>(
  data: TData,
  options: CreateDbtGovernanceModelExpansionOptions = {},
): DbtGovernanceModelExpansion<TData> {
  return {
    extensionId: DBT_GOVERNANCE_EXTENSION_ID,
    contractVersion:
      options.contractVersion ?? DBT_GOVERNANCE_EXPANSION_CONTRACT_VERSION,
    data,
    ...(options.diagnostics ? { diagnostics: options.diagnostics } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {}),
  };
}

export function attachDbtGovernanceModelExpansion<
  TCarrier extends GovernanceExtensionModelExpansionCarrier,
  TData extends DbtGovernanceModelExpansionData,
>(
  carrier: TCarrier,
  data: TData,
  options: CreateDbtGovernanceModelExpansionOptions = {},
): TCarrier {
  return withGovernanceExtensionModelExpansion(
    carrier,
    createDbtGovernanceModelExpansion(data, options),
  );
}

export function getDbtGovernanceModelExpansion<
  TData = DbtGovernanceModelExpansionData,
>(
  carrier: GovernanceExtensionModelExpansionCarrier | undefined,
): DbtGovernanceModelExpansion<TData> | undefined {
  return getGovernanceExtensionModelExpansion<TData>(
    carrier,
    DBT_GOVERNANCE_EXTENSION_ID,
  );
}

export function validateDbtGovernanceModelExpansion(
  expansion: GovernanceExtensionModelExpansion<unknown> | undefined,
): GovernanceExtensionContractIssue[] {
  if (!expansion) {
    return [
      {
        code: 'dbt.expansion.missing',
        severity: 'error',
        message: 'dbt governance model expansion is missing.',
      },
    ];
  }

  const issues: GovernanceExtensionContractIssue[] = [];

  if (expansion.extensionId !== DBT_GOVERNANCE_EXTENSION_ID) {
    issues.push({
      code: 'dbt.expansion.invalid_extension_id',
      severity: 'error',
      message: 'dbt governance model expansion must use the dbt extension id.',
      path: '/extensionId',
    });
  }

  if (expansion.contractVersion !== DBT_GOVERNANCE_EXPANSION_CONTRACT_VERSION) {
    issues.push({
      code: 'dbt.expansion.unsupported_contract_version',
      severity: 'error',
      message:
        'dbt governance model expansion contractVersion is not supported.',
      path: '/contractVersion',
    });
  }

  if (!isRecord(expansion.data)) {
    issues.push({
      code: 'dbt.expansion.invalid_data',
      severity: 'error',
      message: 'dbt governance model expansion data must be an object.',
      path: '/data',
    });
    return issues;
  }

  const data = expansion.data as Record<string, unknown>;
  validateEnum(
    data.kind,
    ['workspace', 'node', 'relation', 'runtime-context'],
    '/data/kind',
    issues,
  );

  if (data.technology !== 'dbt') {
    issues.push({
      code: 'dbt.expansion.invalid_technology',
      severity: 'error',
      message: 'dbt governance model expansion technology must be "dbt".',
      path: '/data/technology',
    });
  }

  switch (data.kind) {
    case 'workspace':
      validateOptionalRecord(data.artifactPaths, '/data/artifactPaths', issues);
      validateOptionalRecord(data.manifest, '/data/manifest', issues);
      validateOptionalStringArray(
        data.projectNodeIds,
        '/data/projectNodeIds',
        issues,
      );
      break;
    case 'node':
      validateEnum(
        data.nodeKind,
        ['project', 'resource', 'unknown'],
        '/data/nodeKind',
        issues,
      );
      validateOptionalRecord(data.project, '/data/project', issues);
      validateOptionalRecord(data.identity, '/data/identity', issues);
      validateOptionalRecord(data.resource, '/data/resource', issues);
      validateOptionalRecord(data.relation, '/data/relation', issues);
      validateOptionalRecord(data.validation, '/data/validation', issues);
      validateOptionalRecord(data.documentation, '/data/documentation', issues);
      break;
    case 'relation':
      validateEnum(
        data.relationKind,
        [
          'lineage',
          'exposes',
          'tests',
          'dependency',
          'uses-package',
          'unknown',
        ],
        '/data/relationKind',
        issues,
      );
      validateOptionalRecord(data.source, '/data/source', issues);
      validateOptionalRecord(data.target, '/data/target', issues);
      validateOptionalRecord(data.lineage, '/data/lineage', issues);
      break;
    case 'runtime-context':
      validateOptionalRecord(data.config, '/data/config', issues);
      validateOptionalStringArray(
        data.expectedFacts,
        '/data/expectedFacts',
        issues,
      );
      break;
  }

  return issues;
}

function validateEnum(
  value: unknown,
  allowed: readonly string[],
  path: string,
  issues: GovernanceExtensionContractIssue[],
): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    issues.push({
      code: 'dbt.expansion.invalid_enum_value',
      severity: 'error',
      message: `Expected one of ${allowed.join(', ')}.`,
      path,
    });
  }
}

function validateOptionalRecord(
  value: unknown,
  path: string,
  issues: GovernanceExtensionContractIssue[],
): void {
  if (value !== undefined && !isRecord(value)) {
    issues.push({
      code: 'dbt.expansion.invalid_record',
      severity: 'error',
      message: 'Expected an object when present.',
      path,
    });
  }
}

function validateOptionalStringArray(
  value: unknown,
  path: string,
  issues: GovernanceExtensionContractIssue[],
): void {
  if (
    value !== undefined &&
    (!Array.isArray(value) ||
      value.some((entry) => typeof entry !== 'string' || entry.length === 0))
  ) {
    issues.push({
      code: 'dbt.expansion.invalid_string_array',
      severity: 'error',
      message: 'Expected a non-empty string array when present.',
      path,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type {
  GovernanceDiagnostic,
  GovernanceExtensionDefinition,
  GovernanceExtensionRulePack,
  GovernanceMetricProvider,
  GovernanceMetricProviderInput,
  GovernanceSignal,
  GovernanceSignalProvider,
  Measurement,
  Recommendation,
  Violation,
};
