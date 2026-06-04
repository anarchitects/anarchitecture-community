import {
  DefaultGovernanceCapabilityRegistry,
  registerLoadedGovernanceExtensionsWithDiagnostics,
  type GovernanceExtensionHostContext,
} from '@anarchitects/governance-core';

import {
  DBT_GOVERNANCE_EXTENSION_ID,
  createDbtGovernanceExtension,
  dbtGovernanceExtension,
  dbtGovernanceExtensionMetadata,
  governanceDbtExtension,
} from './index.js';

describe('dbt Governance extension', () => {
  const context: GovernanceExtensionHostContext = {
    workspaceRoot: '/repo',
    profileName: 'dbt',
    options: {},
    inventory: {
      id: 'workspace',
      name: 'workspace',
      root: '/repo',
      projects: [],
      dependencies: [],
    },
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

  it('registers as an empty core-compatible extension by default', async () => {
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
    expect(result.registry.rulePacks).toEqual([]);
    expect(result.registry.signalProviders).toEqual([]);
    expect(result.registry.metricProviders).toEqual([]);
  });

  it('creates independent extension definitions for future hosts', () => {
    const created = createDbtGovernanceExtension();

    expect(created).toEqual(dbtGovernanceExtension);
    expect(created).not.toBe(dbtGovernanceExtension);
    expect(created.register).toBe(dbtGovernanceExtension.register);
  });
});
