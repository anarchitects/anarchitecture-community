import type {
  GovernanceCapability,
  GovernanceDiagnostic,
  GovernanceExtensionDefinition,
  GovernanceExtensionExecutionInput,
  GovernanceExtensionHost,
  GovernanceExtensionRulePack,
  GovernanceMetricProvider,
  GovernanceMetricProviderInput,
  GovernanceSignalProvider,
  GovernanceSignalProviderInput,
  Measurement,
  Recommendation,
  Violation,
} from '@anarchitects/governance-core';

import type { DbtGovernanceMetadataResolution } from './resolvers.js';

export const DBT_GOVERNANCE_DIAGNOSTIC_PROVIDER_CAPABILITY_PREFIX =
  'capability:governance:extension:dbt:diagnostic-provider:';

export const DBT_GOVERNANCE_RECOMMENDATION_PROVIDER_CAPABILITY_PREFIX =
  'capability:governance:extension:dbt:recommendation-provider:';

export type DbtGovernanceExtensionInput = GovernanceExtensionExecutionInput;

export type DbtGovernanceRulePackInput = DbtGovernanceExtensionInput;

export type DbtGovernanceSignalProviderInput = GovernanceSignalProviderInput;

export type DbtGovernanceMetricProviderInput = GovernanceMetricProviderInput;

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
  signalProviders?: readonly GovernanceSignalProvider[];
  metricProviders?: readonly GovernanceMetricProvider[];
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

export type {
  GovernanceDiagnostic,
  GovernanceExtensionDefinition,
  GovernanceExtensionRulePack,
  GovernanceMetricProvider,
  GovernanceSignalProvider,
  Measurement,
  Recommendation,
  Violation,
};
