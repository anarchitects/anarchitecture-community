import type {
  GovernanceCapability,
  GovernanceDiagnostic,
  GovernanceExtensionDefinition,
  GovernanceExtensionExecutionInput,
  GovernanceExtensionHost,
  GovernanceExtensionRulePack,
  GovernanceMetricProviderInput,
  GovernanceSignal,
  GovernanceSignalProviderInput,
  Measurement,
  Recommendation,
} from '@anarchitects/governance-core';

export const TYPESCRIPT_GOVERNANCE_DIAGNOSTIC_PROVIDER_CAPABILITY_PREFIX =
  'capability:governance:extension:typescript:diagnostic-provider:';

export const TYPESCRIPT_GOVERNANCE_RECOMMENDATION_PROVIDER_CAPABILITY_PREFIX =
  'capability:governance:extension:typescript:recommendation-provider:';

export type TypeScriptGovernanceExtensionInput =
  GovernanceExtensionExecutionInput;

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
