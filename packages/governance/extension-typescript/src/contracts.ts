import type {
  GovernanceCapability,
  GovernanceDiagnostic,
  GovernanceExtensionContractIssue,
  GovernanceExtensionDefinition,
  GovernanceExtensionExecutionInput,
  GovernanceExtensionHost,
  GovernanceExtensionModelExpansion,
  GovernanceExtensionModelExpansionCarrier,
  GovernanceExtensionRulePack,
  GovernanceMetricProviderInput,
  GovernanceSignal,
  GovernanceSignalProviderInput,
  Measurement,
  Recommendation,
} from '@anarchitects/governance-core';
import {
  getGovernanceExtensionModelExpansion,
  withGovernanceExtensionModelExpansion,
} from '@anarchitects/governance-core';

import {
  TYPESCRIPT_GOVERNANCE_EXPANSION_CONTRACT_VERSION,
  TYPESCRIPT_GOVERNANCE_EXTENSION_ID,
} from './constants.js';

export const TYPESCRIPT_GOVERNANCE_DIAGNOSTIC_PROVIDER_CAPABILITY_PREFIX =
  'capability:governance:extension:typescript:diagnostic-provider:';

export const TYPESCRIPT_GOVERNANCE_RECOMMENDATION_PROVIDER_CAPABILITY_PREFIX =
  'capability:governance:extension:typescript:recommendation-provider:';

export type TypeScriptGovernanceExtensionInput =
  GovernanceExtensionExecutionInput;

export interface TypeScriptGovernanceHostOptions {
  signals?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  diagnostics?: Record<string, unknown>;
  recommendations?: Record<string, unknown>;
}

export interface TypeScriptGovernanceWorkspaceExpansionData {
  kind: 'workspace';
  technology: 'typescript';
  packageManager?: string;
  projectNodeIds?: string[];
  tsconfigNodeIds?: string[];
}

export interface TypeScriptGovernanceNodeExpansionData {
  kind: 'node';
  technology: 'typescript';
  nodeKind:
    | 'workspace-project'
    | 'tsconfig'
    | 'package-manager-package'
    | 'unknown';
  packageName?: string;
  tsconfigPath?: string;
}

export interface TypeScriptGovernanceRelationExpansionData {
  kind: 'relation';
  technology: 'typescript';
  relationKind:
    | 'import'
    | 'path-alias'
    | 'tsconfig-extends'
    | 'package-dependency'
    | 'unknown';
  importSpecifiers?: string[];
}

export interface TypeScriptGovernanceRuntimeContextExpansionData {
  kind: 'runtime-context';
  technology: 'typescript';
  config?: TypeScriptGovernanceHostOptions;
  expectedFacts?: string[];
}

export type TypeScriptGovernanceModelExpansionData =
  | TypeScriptGovernanceWorkspaceExpansionData
  | TypeScriptGovernanceNodeExpansionData
  | TypeScriptGovernanceRelationExpansionData
  | TypeScriptGovernanceRuntimeContextExpansionData;

export type TypeScriptGovernanceModelExpansion<
  TData = TypeScriptGovernanceModelExpansionData,
> = GovernanceExtensionModelExpansion<TData>;

export interface TypeScriptGovernanceSignalProviderInput
  extends GovernanceSignalProviderInput {
  diagnostics?: readonly GovernanceDiagnostic[];
}

export interface TypeScriptGovernanceMetricProviderInput
  extends GovernanceMetricProviderInput {
  diagnostics?: readonly GovernanceDiagnostic[];
}

export interface TypeScriptGovernanceDiagnosticProviderInput
  extends TypeScriptGovernanceMetricProviderInput {
  diagnostics: GovernanceDiagnostic[];
}

export interface TypeScriptGovernanceRecommendationProviderInput
  extends TypeScriptGovernanceDiagnosticProviderInput {
  recommendations: Recommendation[];
}

export interface TypeScriptGovernanceDiagnosticProvider {
  id?: string;
  provideDiagnostics(
    input: TypeScriptGovernanceDiagnosticProviderInput,
  ): GovernanceDiagnostic[] | Promise<GovernanceDiagnostic[]>;
}

export interface TypeScriptGovernanceSignalProvider {
  id?: string;
  provideSignals(
    input: TypeScriptGovernanceSignalProviderInput,
  ): GovernanceSignal[] | Promise<GovernanceSignal[]>;
}

export interface TypeScriptGovernanceMetricProvider {
  id?: string;
  provideMetrics(
    input: TypeScriptGovernanceMetricProviderInput,
  ): Measurement[] | Promise<Measurement[]>;
}

export interface TypeScriptGovernanceRecommendationProvider {
  id?: string;
  provideRecommendations(
    input: TypeScriptGovernanceRecommendationProviderInput,
  ): Recommendation[] | Promise<Recommendation[]>;
}

export interface TypeScriptGovernanceProviderCapabilityData<TProvider> {
  technology: 'typescript';
  category:
    | 'diagnostics'
    | 'signals'
    | 'rule-packs'
    | 'metrics'
    | 'recommendations';
  provider: TProvider;
}

export interface TypeScriptGovernanceExtensionContributions {
  rulePacks?: readonly GovernanceExtensionRulePack[];
  signalProviders?: readonly TypeScriptGovernanceSignalProvider[];
  metricProviders?: readonly TypeScriptGovernanceMetricProvider[];
  diagnosticProviders?: readonly TypeScriptGovernanceDiagnosticProvider[];
  recommendationProviders?: readonly TypeScriptGovernanceRecommendationProvider[];
}

export interface TypeScriptGovernanceExtensionOptions {
  contributions?: TypeScriptGovernanceExtensionContributions;
  version?: GovernanceExtensionDefinition['version'];
}

export interface CreateTypeScriptGovernanceModelExpansionOptions {
  contractVersion?: string;
  diagnostics?: readonly GovernanceExtensionContractIssue[];
  metadata?: Record<string, unknown>;
}

export function registerTypeScriptGovernanceExtensionContributions(
  host: GovernanceExtensionHost,
  contributions: TypeScriptGovernanceExtensionContributions = {},
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
    TYPESCRIPT_GOVERNANCE_DIAGNOSTIC_PROVIDER_CAPABILITY_PREFIX,
    'diagnostics',
  );
  registerCapabilityProviders(
    host,
    contributions.recommendationProviders ?? [],
    TYPESCRIPT_GOVERNANCE_RECOMMENDATION_PROVIDER_CAPABILITY_PREFIX,
    'recommendations',
  );
}

export function createTypeScriptGovernanceModelExpansion<
  TData extends TypeScriptGovernanceModelExpansionData,
>(
  data: TData,
  options: CreateTypeScriptGovernanceModelExpansionOptions = {},
): TypeScriptGovernanceModelExpansion<TData> {
  return {
    extensionId: TYPESCRIPT_GOVERNANCE_EXTENSION_ID,
    contractVersion:
      options.contractVersion ??
      TYPESCRIPT_GOVERNANCE_EXPANSION_CONTRACT_VERSION,
    data,
    ...(options.diagnostics ? { diagnostics: options.diagnostics } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {}),
  };
}

export function attachTypeScriptGovernanceModelExpansion<
  TCarrier extends GovernanceExtensionModelExpansionCarrier,
  TData extends TypeScriptGovernanceModelExpansionData,
>(
  carrier: TCarrier,
  data: TData,
  options: CreateTypeScriptGovernanceModelExpansionOptions = {},
): TCarrier {
  return withGovernanceExtensionModelExpansion(
    carrier,
    createTypeScriptGovernanceModelExpansion(data, options),
  );
}

export function getTypeScriptGovernanceModelExpansion<
  TData = TypeScriptGovernanceModelExpansionData,
>(
  carrier: GovernanceExtensionModelExpansionCarrier | undefined,
): TypeScriptGovernanceModelExpansion<TData> | undefined {
  return getGovernanceExtensionModelExpansion<TData>(
    carrier,
    TYPESCRIPT_GOVERNANCE_EXTENSION_ID,
  );
}

export function validateTypeScriptGovernanceModelExpansion(
  expansion: GovernanceExtensionModelExpansion<unknown> | undefined,
): GovernanceExtensionContractIssue[] {
  if (!expansion) {
    return [
      {
        code: 'typescript.expansion.missing',
        severity: 'error',
        message: 'TypeScript governance model expansion is missing.',
      },
    ];
  }

  const issues: GovernanceExtensionContractIssue[] = [];

  if (expansion.extensionId !== TYPESCRIPT_GOVERNANCE_EXTENSION_ID) {
    issues.push({
      code: 'typescript.expansion.invalid_extension_id',
      severity: 'error',
      message:
        'TypeScript governance model expansion must use the TypeScript extension id.',
      path: '/extensionId',
    });
  }

  if (
    expansion.contractVersion !==
    TYPESCRIPT_GOVERNANCE_EXPANSION_CONTRACT_VERSION
  ) {
    issues.push({
      code: 'typescript.expansion.unsupported_contract_version',
      severity: 'error',
      message:
        'TypeScript governance model expansion contractVersion is not supported.',
      path: '/contractVersion',
    });
  }

  const data = expansion.data;
  if (!isRecord(data)) {
    issues.push({
      code: 'typescript.expansion.invalid_data',
      severity: 'error',
      message: 'TypeScript governance model expansion data must be an object.',
      path: '/data',
    });
    return issues;
  }

  if (data.technology !== 'typescript') {
    issues.push({
      code: 'typescript.expansion.invalid_technology',
      severity: 'error',
      message:
        'TypeScript governance model expansion data.technology must be "typescript".',
      path: '/data/technology',
    });
  }

  switch (data.kind) {
    case 'workspace':
      validateOptionalStringArray(
        data.projectNodeIds,
        '/data/projectNodeIds',
        issues,
      );
      validateOptionalStringArray(
        data.tsconfigNodeIds,
        '/data/tsconfigNodeIds',
        issues,
      );
      break;
    case 'node':
      validateEnum(
        data.nodeKind,
        ['workspace-project', 'tsconfig', 'package-manager-package', 'unknown'],
        '/data/nodeKind',
        issues,
      );
      break;
    case 'relation':
      validateEnum(
        data.relationKind,
        [
          'import',
          'path-alias',
          'tsconfig-extends',
          'package-dependency',
          'unknown',
        ],
        '/data/relationKind',
        issues,
      );
      validateOptionalStringArray(
        data.importSpecifiers,
        '/data/importSpecifiers',
        issues,
      );
      break;
    case 'runtime-context':
      if (data.config !== undefined && !isRecord(data.config)) {
        issues.push({
          code: 'typescript.expansion.invalid_runtime_config',
          severity: 'error',
          message:
            'TypeScript runtime-context expansion config must be an object when present.',
          path: '/data/config',
        });
      }
      validateOptionalStringArray(
        data.expectedFacts,
        '/data/expectedFacts',
        issues,
      );
      break;
    default:
      issues.push({
        code: 'typescript.expansion.invalid_kind',
        severity: 'error',
        message:
          'TypeScript governance model expansion data.kind must be a supported TypeScript expansion kind.',
        path: '/data/kind',
      });
  }

  return issues;
}

function registerCapabilityProviders<TProvider extends { id?: string }>(
  host: GovernanceExtensionHost,
  providers: readonly TProvider[],
  capabilityPrefix: string,
  category: TypeScriptGovernanceProviderCapabilityData<TProvider>['category'],
): void {
  if (providers.length === 0) {
    return;
  }

  const registerCapability = resolveCapabilityRegistrar(host);

  if (!registerCapability) {
    throw new Error(
      `Governance host does not expose a mutable capability registry for TypeScript ${category} providers.`,
    );
  }

  providers.forEach((provider, index) => {
    registerCapability({
      id: `${capabilityPrefix}${provider.id ?? index + 1}`,
      source: 'extension',
      data: {
        technology: 'typescript',
        category,
        provider,
      } satisfies TypeScriptGovernanceProviderCapabilityData<TProvider>,
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

function validateEnum(
  value: unknown,
  allowedValues: readonly string[],
  path: string,
  issues: GovernanceExtensionContractIssue[],
): void {
  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    issues.push({
      code: 'typescript.expansion.invalid_enum_value',
      severity: 'error',
      message: `Expected one of ${allowedValues.join(', ')}.`,
      path,
    });
  }
}

function validateOptionalStringArray(
  value: unknown,
  path: string,
  issues: GovernanceExtensionContractIssue[],
): void {
  if (value === undefined) {
    return;
  }

  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string')
  ) {
    issues.push({
      code: 'typescript.expansion.invalid_string_array',
      severity: 'error',
      message: 'Expected an array of strings.',
      path,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function collectTypeScriptGovernanceDiagnostics(
  providers: readonly TypeScriptGovernanceDiagnosticProvider[],
  input: TypeScriptGovernanceDiagnosticProviderInput,
): Promise<GovernanceDiagnostic[]> {
  return Promise.all(
    providers.map((provider) => provider.provideDiagnostics(input)),
  ).then((results) => results.flat());
}

export function collectTypeScriptGovernanceSignals(
  providers: readonly TypeScriptGovernanceSignalProvider[],
  input: TypeScriptGovernanceSignalProviderInput,
): Promise<GovernanceSignal[]> {
  return Promise.all(
    providers.map((provider) => provider.provideSignals(input)),
  ).then((results) => results.flat());
}

export function collectTypeScriptGovernanceMeasurements(
  providers: readonly TypeScriptGovernanceMetricProvider[],
  input: TypeScriptGovernanceMetricProviderInput,
): Promise<Measurement[]> {
  return Promise.all(
    providers.map((provider) => provider.provideMetrics(input)),
  ).then((results) => results.flat());
}

export function collectTypeScriptGovernanceRecommendations(
  providers: readonly TypeScriptGovernanceRecommendationProvider[],
  input: TypeScriptGovernanceRecommendationProviderInput,
): Promise<Recommendation[]> {
  return Promise.all(
    providers.map((provider) => provider.provideRecommendations(input)),
  ).then((results) => results.flat());
}

export function isTypeScriptGovernanceDiagnosticProviderCapability(
  capability: GovernanceCapability,
): capability is GovernanceCapability<
  TypeScriptGovernanceProviderCapabilityData<TypeScriptGovernanceDiagnosticProvider>
> {
  return capability.id.startsWith(
    TYPESCRIPT_GOVERNANCE_DIAGNOSTIC_PROVIDER_CAPABILITY_PREFIX,
  );
}

export function isTypeScriptGovernanceRecommendationProviderCapability(
  capability: GovernanceCapability,
): capability is GovernanceCapability<
  TypeScriptGovernanceProviderCapabilityData<TypeScriptGovernanceRecommendationProvider>
> {
  return capability.id.startsWith(
    TYPESCRIPT_GOVERNANCE_RECOMMENDATION_PROVIDER_CAPABILITY_PREFIX,
  );
}

export function getTypeScriptGovernanceDiagnosticProviders(
  host: GovernanceExtensionHost,
): TypeScriptGovernanceDiagnosticProvider[] {
  return host.context.capabilities
    .list()
    .filter(isTypeScriptGovernanceDiagnosticProviderCapability)
    .flatMap((capability) =>
      capability.data ? [capability.data.provider] : [],
    );
}

export function getTypeScriptGovernanceRecommendationProviders(
  host: GovernanceExtensionHost,
): TypeScriptGovernanceRecommendationProvider[] {
  return host.context.capabilities
    .list()
    .filter(isTypeScriptGovernanceRecommendationProviderCapability)
    .flatMap((capability) =>
      capability.data ? [capability.data.provider] : [],
    );
}
