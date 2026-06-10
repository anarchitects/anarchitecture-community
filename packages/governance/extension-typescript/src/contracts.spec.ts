import {
  DefaultGovernanceCapabilityRegistry,
  registerLoadedGovernanceExtensionsWithDiagnostics,
  type GovernanceDiagnostic,
  type GovernanceExtensionHostContext,
  type GovernanceMetricProvider,
  type GovernanceSignalProvider,
  type Measurement,
  type Recommendation,
} from '@anarchitects/governance-core';

import {
  TYPESCRIPT_GOVERNANCE_DIAGNOSTIC_PROVIDER_CAPABILITY_PREFIX,
  TYPESCRIPT_GOVERNANCE_RECOMMENDATION_PROVIDER_CAPABILITY_PREFIX,
  createTypeScriptGovernanceExtension,
  getTypeScriptGovernanceDiagnosticProviders,
  getTypeScriptGovernanceRecommendationProviders,
  typescriptGovernanceDiagnosticsProvider,
  typescriptGovernanceMetricProvider,
  typescriptGovernanceRecommendationProvider,
  typescriptGovernanceSignalProvider,
} from './index.js';
import { createTypeScriptWorkspace } from './test-workspace.js';

describe('TypeScript governance extension contracts', () => {
  function createContext(): GovernanceExtensionHostContext {
    return {
      workspaceRoot: '/repo',
      profileName: 'typescript',
      options: {},
      inventory: createTypeScriptWorkspace(),
      capabilities: new DefaultGovernanceCapabilityRegistry(),
    };
  }

  it('registers canonical TypeScript signal and metric providers through Core extension contracts', async () => {
    const signalProvider: GovernanceSignalProvider = {
      provideSignals: async () => [],
    };
    const metricProvider: GovernanceMetricProvider = {
      provideMetrics: async (): Promise<Measurement[]> => [],
    };
    const context = createContext();

    const result = await registerLoadedGovernanceExtensionsWithDiagnostics(
      context,
      [
        {
          sourceSpecifier: '@anarchitects/governance-extension-typescript',
          moduleSpecifier: '@anarchitects/governance-extension-typescript',
          definition: createTypeScriptGovernanceExtension({
            contributions: {
              signalProviders: [signalProvider],
              metricProviders: [metricProvider],
            },
          }),
        },
      ],
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.registry.signalProviders).toHaveLength(2);
    expect(result.registry.signalProviders[0]?.contribution).toBe(
      typescriptGovernanceSignalProvider,
    );
    expect(result.registry.signalProviders[1]?.contribution).toBe(
      signalProvider,
    );
    expect(result.registry.metricProviders).toHaveLength(2);
    expect(result.registry.metricProviders[0]?.contribution).toBe(
      typescriptGovernanceMetricProvider,
    );
    expect(result.registry.metricProviders[1]?.contribution).toBe(
      metricProvider,
    );
  });

  it('registers diagnostic and recommendation providers as discoverable capabilities', async () => {
    const diagnosticProvider = {
      id: 'custom',
      provideDiagnostics: async (): Promise<GovernanceDiagnostic[]> => [],
    };
    const recommendationProvider = {
      id: 'custom',
      provideRecommendations: async (): Promise<Recommendation[]> => [],
    };
    const context = createContext();

    await registerLoadedGovernanceExtensionsWithDiagnostics(context, [
      {
        sourceSpecifier: '@anarchitects/governance-extension-typescript',
        moduleSpecifier: '@anarchitects/governance-extension-typescript',
        definition: createTypeScriptGovernanceExtension({
          contributions: {
            diagnosticProviders: [diagnosticProvider],
            recommendationProviders: [recommendationProvider],
          },
        }),
      },
    ]);

    const capabilities = context.capabilities.list();

    expect(
      capabilities.some((capability) =>
        capability.id.startsWith(
          TYPESCRIPT_GOVERNANCE_DIAGNOSTIC_PROVIDER_CAPABILITY_PREFIX,
        ),
      ),
    ).toBe(true);
    expect(
      capabilities.some((capability) =>
        capability.id.startsWith(
          TYPESCRIPT_GOVERNANCE_RECOMMENDATION_PROVIDER_CAPABILITY_PREFIX,
        ),
      ),
    ).toBe(true);

    const discoveryHost = {
      context,
      registerRulePack: () => undefined,
      registerSignalProvider: () => undefined,
      registerMetricProvider: () => undefined,
      registerEnricher: () => undefined,
    };

    expect(getTypeScriptGovernanceDiagnosticProviders(discoveryHost)).toEqual([
      typescriptGovernanceDiagnosticsProvider,
      diagnosticProvider,
    ]);
    expect(
      getTypeScriptGovernanceRecommendationProviders(discoveryHost),
    ).toEqual([
      typescriptGovernanceRecommendationProvider,
      recommendationProvider,
    ]);
  });
});
