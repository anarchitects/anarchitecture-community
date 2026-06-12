import {
  DefaultGovernanceCapabilityRegistry,
  getGovernanceExtensionModelExpansion,
  registerLoadedGovernanceExtensionsWithDiagnostics,
  type GovernanceDiagnostic,
  type GovernanceExtensionHostContext,
  type GovernanceExtensionRulePack,
  type GovernanceMetricProvider,
  type GovernanceSignalProvider,
  type Measurement,
  type Recommendation,
  type Violation,
} from '@anarchitects/governance-core';

import {
  DBT_GOVERNANCE_EXPANSION_CONTRACT_VERSION,
  DBT_GOVERNANCE_EXTENSION_ID,
  attachDbtGovernanceModelExpansion,
  DBT_GOVERNANCE_DIAGNOSTIC_PROVIDER_CAPABILITY_PREFIX,
  DBT_GOVERNANCE_RECOMMENDATION_PROVIDER_CAPABILITY_PREFIX,
  createDbtGovernanceModelExpansion,
  createDbtGovernanceExtension,
  dbtArchitectureBasicRulePack,
  dbtGovernanceDiagnosticsProvider,
  dbtGovernanceMetricProvider,
  dbtGovernanceRecommendationProvider,
  dbtGovernanceSignalProvider,
  getDbtGovernanceModelExpansion,
  getDbtGovernanceDiagnosticProviders,
  getDbtGovernanceRecommendationProviders,
  validateDbtGovernanceModelExpansion,
} from './index.js';
import { createCompatibilityWorkspace } from './test-workspace.js';

describe('dbt Governance extension contracts', () => {
  function createContext(): GovernanceExtensionHostContext {
    return {
      workspaceRoot: '/repo',
      profileName: 'dbt',
      options: {},
      inventory: createCompatibilityWorkspace({
        id: 'workspace',
        name: 'workspace',
        root: '/repo',
        projects: [],
        dependencies: [],
      }),
      capabilities: new DefaultGovernanceCapabilityRegistry(),
    };
  }

  it('registers dbt rule, signal, and metric providers through core extension contracts', async () => {
    const rulePack: GovernanceExtensionRulePack = {
      evaluate: (): Violation[] => [],
    };
    const signalProvider: GovernanceSignalProvider = {
      provideSignals: async () => [],
    };
    const metricProvider: GovernanceMetricProvider = {
      provideMetrics: async (): Promise<Measurement[]> => [],
    };

    const extension = createDbtGovernanceExtension({
      contributions: {
        rulePacks: [rulePack],
        signalProviders: [signalProvider],
        metricProviders: [metricProvider],
      },
    });
    const context = createContext();

    const result = await registerLoadedGovernanceExtensionsWithDiagnostics(
      context,
      [
        {
          sourceSpecifier: '@anarchitects/governance-extension-dbt',
          moduleSpecifier: '@anarchitects/governance-extension-dbt',
          definition: extension,
        },
      ],
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.registry.rulePacks).toHaveLength(2);
    expect(result.registry.signalProviders).toHaveLength(2);
    expect(result.registry.metricProviders).toHaveLength(2);
    expect(result.registry.rulePacks[0]?.contribution).toBe(
      dbtArchitectureBasicRulePack,
    );
    expect(result.registry.rulePacks[1]?.contribution).toBe(rulePack);
    expect(result.registry.signalProviders[0]?.contribution).toBe(
      dbtGovernanceSignalProvider,
    );
    expect(result.registry.signalProviders[1]?.contribution).toBe(
      signalProvider,
    );
    expect(result.registry.metricProviders[0]?.contribution).toBe(
      dbtGovernanceMetricProvider,
    );
    expect(result.registry.metricProviders[1]?.contribution).toBe(
      metricProvider,
    );
  });

  it('registers dbt diagnostic and recommendation providers as core capabilities for runtime discovery', async () => {
    const diagnosticProvider = {
      id: 'catalog',
      provideDiagnostics: async (): Promise<GovernanceDiagnostic[]> => [],
    };
    const recommendationProvider = {
      id: 'catalog',
      provideRecommendations: async (): Promise<Recommendation[]> => [],
    };

    const extension = createDbtGovernanceExtension({
      contributions: {
        diagnosticProviders: [diagnosticProvider],
        recommendationProviders: [recommendationProvider],
      },
    });
    const context = createContext();

    await registerLoadedGovernanceExtensionsWithDiagnostics(context, [
      {
        sourceSpecifier: '@anarchitects/governance-extension-dbt',
        moduleSpecifier: '@anarchitects/governance-extension-dbt',
        definition: extension,
      },
    ]);

    const capabilities = context.capabilities.list();

    expect(
      capabilities.some((capability) =>
        capability.id.startsWith(
          DBT_GOVERNANCE_DIAGNOSTIC_PROVIDER_CAPABILITY_PREFIX,
        ),
      ),
    ).toBe(true);
    expect(
      capabilities.some((capability) =>
        capability.id.startsWith(
          DBT_GOVERNANCE_RECOMMENDATION_PROVIDER_CAPABILITY_PREFIX,
        ),
      ),
    ).toBe(true);
  });

  it('exposes dbt diagnostic and recommendation providers for future runtime composition', async () => {
    const diagnosticProvider = {
      id: 'catalog',
      provideDiagnostics: async (): Promise<GovernanceDiagnostic[]> => [],
    };
    const recommendationProvider = {
      id: 'catalog',
      provideRecommendations: async (): Promise<Recommendation[]> => [],
    };
    const capabilityContext = createContext();

    const extension = createDbtGovernanceExtension({
      contributions: {
        diagnosticProviders: [diagnosticProvider],
        recommendationProviders: [recommendationProvider],
      },
    });
    let receivedHostContext: GovernanceExtensionHostContext | undefined;

    await registerLoadedGovernanceExtensionsWithDiagnostics(capabilityContext, [
      {
        sourceSpecifier: '@anarchitects/governance-extension-dbt',
        moduleSpecifier: '@anarchitects/governance-extension-dbt',
        definition: {
          ...extension,
          register: (host) => {
            receivedHostContext = host.context;
            return extension.register(host);
          },
        },
      },
    ]);

    expect(receivedHostContext).toBeDefined();
    if (!receivedHostContext) {
      throw new Error('Expected extension host context to be captured.');
    }

    const discoveryHost = {
      context: receivedHostContext,
      registerRulePack: () => undefined,
      registerSignalProvider: () => undefined,
      registerMetricProvider: () => undefined,
      registerEnricher: () => undefined,
    };

    expect(getDbtGovernanceDiagnosticProviders(discoveryHost)).toEqual([
      dbtGovernanceDiagnosticsProvider,
      diagnosticProvider,
    ]);
    expect(getDbtGovernanceRecommendationProviders(discoveryHost)).toEqual([
      dbtGovernanceRecommendationProvider,
      recommendationProvider,
    ]);
  });

  it('attaches versioned dbt expansion data to canonical carriers', () => {
    const workspace = attachDbtGovernanceModelExpansion(
      createCompatibilityWorkspace({
        id: 'workspace',
        name: 'workspace',
        root: '/repo',
        projects: [],
        dependencies: [],
      }),
      {
        kind: 'workspace',
        technology: 'dbt',
        projectName: 'analytics',
        projectNodeIds: ['model.analytics.orders'],
      },
    );

    expect(getDbtGovernanceModelExpansion(workspace)).toEqual({
      extensionId: DBT_GOVERNANCE_EXTENSION_ID,
      contractVersion: DBT_GOVERNANCE_EXPANSION_CONTRACT_VERSION,
      data: {
        kind: 'workspace',
        technology: 'dbt',
        projectName: 'analytics',
        projectNodeIds: ['model.analytics.orders'],
      },
    });
    expect(
      getGovernanceExtensionModelExpansion(
        workspace,
        DBT_GOVERNANCE_EXTENSION_ID,
      ),
    ).toEqual(getDbtGovernanceModelExpansion(workspace));
  });

  it('validates dbt-owned expansion envelopes and leaves deep semantics to the extension', () => {
    const validExpansion = createDbtGovernanceModelExpansion({
      kind: 'runtime-context',
      technology: 'dbt',
      config: {
        adapter: {
          artifactDir: 'target',
        },
      },
      expectedFacts: ['manifest', 'catalog'],
    });

    expect(validateDbtGovernanceModelExpansion(validExpansion)).toEqual([]);
    expect(
      validateDbtGovernanceModelExpansion({
        extensionId: DBT_GOVERNANCE_EXTENSION_ID,
        contractVersion: '999',
        data: {
          kind: 'node',
          technology: 'dbt',
          nodeKind: 'unsupported',
          resourceType: 'model',
        },
      }),
    ).toEqual([
      {
        code: 'dbt.expansion.unsupported_contract_version',
        severity: 'error',
        message:
          'dbt governance model expansion contractVersion is not supported.',
        path: '/contractVersion',
      },
      {
        code: 'dbt.expansion.invalid_enum_value',
        severity: 'error',
        message: 'Expected one of project, resource, unknown.',
        path: '/data/nodeKind',
      },
    ]);
  });
});
