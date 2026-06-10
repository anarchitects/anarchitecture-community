import {
  DefaultGovernanceCapabilityRegistry,
  registerLoadedGovernanceExtensionsWithDiagnostics,
  type GovernanceExtensionHostContext,
} from '@anarchitects/governance-core';

import {
  TYPESCRIPT_GOVERNANCE_EXTENSION_ID,
  createTypeScriptGovernanceExtension,
  getTypeScriptGovernanceDiagnosticProviders,
  getTypeScriptGovernanceRecommendationProviders,
  governanceTypeScriptExtension,
  typescriptGovernanceDiagnosticsProvider,
  typescriptGovernanceMetricProvider,
  typescriptGovernanceRecommendationProvider,
  typescriptGovernanceSignalProvider,
  typescriptGovernanceExtensionMetadata,
} from './index.js';

describe('TypeScript Governance extension', () => {
  const context: GovernanceExtensionHostContext = {
    workspaceRoot: '/repo',
    profileName: 'typescript',
    options: {},
    inventory: {
      id: 'workspace',
      name: 'workspace',
      root: '/repo',
      nodes: [],
      relations: [],
    },
    capabilities: new DefaultGovernanceCapabilityRegistry(),
  };

  it('loads through the package public entrypoint', async () => {
    const loaded = await import('./index.js');

    expect(loaded.governanceTypeScriptExtension).toBe(
      governanceTypeScriptExtension,
    );
    expect(loaded.default).toBe(governanceTypeScriptExtension);
  });

  it('exposes stable extension identity and metadata', () => {
    expect(governanceTypeScriptExtension).toMatchObject({
      id: TYPESCRIPT_GOVERNANCE_EXTENSION_ID,
      name: 'TypeScript Governance Extension',
    });
    expect(governanceTypeScriptExtension.version).toBeUndefined();
    expect(typescriptGovernanceExtensionMetadata).toMatchObject({
      id: TYPESCRIPT_GOVERNANCE_EXTENSION_ID,
      technology: 'typescript',
      responsibilities: expect.arrayContaining([
        'TypeScript-specific governance interpretation',
        'Interpreting canonical TypeScript and package-manager graph data',
      ]),
      nonResponsibilities: expect.arrayContaining([
        'TypeScript workspace extraction',
        'dependency graph discovery',
        'CLI orchestration',
        'reporting',
        'canonical Governance Core semantics',
      ]),
    });
  });

  it('registers built-in canonical TypeScript signal, metric, diagnostic, and recommendation providers', async () => {
    const result = await registerLoadedGovernanceExtensionsWithDiagnostics(
      context,
      [
        {
          sourceSpecifier: '@anarchitects/governance-extension-typescript',
          moduleSpecifier: '@anarchitects/governance-extension-typescript',
          definition: governanceTypeScriptExtension,
        },
      ],
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.registry.enrichers).toEqual([]);
    expect(result.registry.rulePacks).toEqual([]);
    expect(result.registry.signalProviders).toHaveLength(1);
    expect(result.registry.signalProviders[0]?.contribution).toBe(
      typescriptGovernanceSignalProvider,
    );
    expect(result.registry.metricProviders).toHaveLength(1);
    expect(result.registry.metricProviders[0]?.contribution).toBe(
      typescriptGovernanceMetricProvider,
    );
    expect(
      getTypeScriptGovernanceDiagnosticProviders({
        context,
        registerRulePack: () => undefined,
        registerSignalProvider: () => undefined,
        registerMetricProvider: () => undefined,
        registerEnricher: () => undefined,
      }),
    ).toEqual([typescriptGovernanceDiagnosticsProvider]);
    expect(
      getTypeScriptGovernanceRecommendationProviders({
        context,
        registerRulePack: () => undefined,
        registerSignalProvider: () => undefined,
        registerMetricProvider: () => undefined,
        registerEnricher: () => undefined,
      }),
    ).toEqual([typescriptGovernanceRecommendationProvider]);
  });

  it('creates independent extension definitions for future hosts', () => {
    const created = createTypeScriptGovernanceExtension();

    expect(created).toEqual(governanceTypeScriptExtension);
    expect(created).not.toBe(governanceTypeScriptExtension);
    expect(created.register).toBe(governanceTypeScriptExtension.register);
  });
});
