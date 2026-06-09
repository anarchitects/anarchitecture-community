import {
  DefaultGovernanceCapabilityRegistry,
  registerLoadedGovernanceExtensionsWithDiagnostics,
  type GovernanceExtensionHostContext,
} from '@anarchitects/governance-core';

import {
  DBT_GOVERNANCE_EXTENSION_ID,
  createDbtGovernanceExtension,
  dbtArchitectureBasicRulePack,
  dbtGovernanceExtension,
  getDbtGovernanceDiagnosticProviders,
  getDbtGovernanceRecommendationProviders,
  dbtGovernanceMetricProvider,
  dbtGovernanceRecommendationProvider,
  dbtGovernanceSignalProvider,
  dbtGovernanceExtensionMetadata,
  governanceDbtExtension,
} from './index.js';
import { createCompatibilityWorkspace } from './test-workspace.js';

describe('dbt Governance extension', () => {
  const context: GovernanceExtensionHostContext = {
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

  it('loads through the package public entrypoint', async () => {
    const loaded = await import('./index.js');

    expect(loaded.dbtGovernanceExtension).toBe(dbtGovernanceExtension);
    expect(loaded.governanceDbtExtension).toBe(governanceDbtExtension);
    expect(loaded.default).toBe(dbtGovernanceExtension);
  });

  it('exposes stable extension identity and metadata', () => {
    expect(dbtGovernanceExtension).toMatchObject({
      id: DBT_GOVERNANCE_EXTENSION_ID,
      name: 'dbt Governance Extension',
    });
    expect(dbtGovernanceExtension.version).toBeUndefined();
    expect(dbtGovernanceExtensionMetadata).toMatchObject({
      id: DBT_GOVERNANCE_EXTENSION_ID,
      technology: 'dbt',
      responsibilities: expect.arrayContaining([
        'dbt-specific governance interpretation',
        'Interpreting normalized dbt governance data',
      ]),
      nonResponsibilities: expect.arrayContaining([
        'Loading raw dbt artifacts',
        'Normalizing dbt resources',
        'Running dbt commands',
        'Composing runtime packages',
        'Implementing Python host behavior',
      ]),
    });
  });

  it('registers the built-in dbt rule pack, diagnostics, signal, metric, and recommendation providers by default', async () => {
    const result = await registerLoadedGovernanceExtensionsWithDiagnostics(
      context,
      [
        {
          sourceSpecifier: '@anarchitects/governance-extension-dbt',
          moduleSpecifier: '@anarchitects/governance-extension-dbt',
          definition: dbtGovernanceExtension,
        },
      ],
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.registry.rulePacks).toHaveLength(1);
    expect(result.registry.rulePacks[0]?.contribution).toBe(
      dbtArchitectureBasicRulePack,
    );
    expect(result.registry.signalProviders).toHaveLength(1);
    expect(result.registry.signalProviders[0]?.contribution).toBe(
      dbtGovernanceSignalProvider,
    );
    expect(result.registry.metricProviders).toHaveLength(1);
    expect(result.registry.metricProviders[0]?.contribution).toBe(
      dbtGovernanceMetricProvider,
    );
    expect(
      getDbtGovernanceDiagnosticProviders({
        context,
        registerRulePack: () => undefined,
        registerSignalProvider: () => undefined,
        registerMetricProvider: () => undefined,
        registerEnricher: () => undefined,
      }),
    ).toHaveLength(1);
    expect(
      getDbtGovernanceRecommendationProviders({
        context,
        registerRulePack: () => undefined,
        registerSignalProvider: () => undefined,
        registerMetricProvider: () => undefined,
        registerEnricher: () => undefined,
      }),
    ).toEqual([dbtGovernanceRecommendationProvider]);
  });

  it('creates independent extension definitions for future hosts', () => {
    const created = createDbtGovernanceExtension();

    expect(created).toEqual(dbtGovernanceExtension);
    expect(created).not.toBe(dbtGovernanceExtension);
    expect(created.register).toBe(dbtGovernanceExtension.register);
  });
});
