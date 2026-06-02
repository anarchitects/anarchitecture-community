import {
  DefaultGovernanceCapabilityRegistry,
  registerLoadedGovernanceExtensionsWithDiagnostics,
  type GovernanceExtensionHostContext,
} from '@anarchitects/governance-core';

import {
  TYPESCRIPT_GOVERNANCE_EXTENSION_ID,
  createTypeScriptGovernanceExtension,
  governanceTypeScriptExtension,
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
      projects: [],
      dependencies: [],
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
        'Future TypeScript-specific rules',
        'Future TypeScript-specific metrics',
        'Future TypeScript-specific recommendations',
        'Future TypeScript-specific enrichers',
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

  it('registers with the Governance Core extension runtime as a no-op package boundary', async () => {
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
    expect(result.registry.signalProviders).toEqual([]);
    expect(result.registry.metricProviders).toEqual([]);
  });

  it('creates independent extension definitions for future hosts', () => {
    const created = createTypeScriptGovernanceExtension();

    expect(created).toEqual(governanceTypeScriptExtension);
    expect(created).not.toBe(governanceTypeScriptExtension);
    expect(created.register).toBe(governanceTypeScriptExtension.register);
  });
});
