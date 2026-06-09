import {
  DefaultGovernanceCapabilityRegistry,
  type GovernanceProfile,
  type GovernanceExtensionHostContext,
} from '../index.js';
import {
  GovernanceExtensionRegistrationError,
  type GovernanceLoadedExtension,
  collectGovernanceMeasurements,
  collectGovernanceSignals,
  registerLoadedGovernanceExtensions,
  registerLoadedGovernanceExtensionsWithDiagnostics,
} from './runtime.js';

describe('governance extension runtime', () => {
  const baseContext: GovernanceExtensionHostContext = {
    workspaceRoot: '/repo',
    profileName: 'frontend-layered',
    options: {
      output: 'cli',
      reportType: 'health',
    },
    inventory: {
      id: 'workspace',
      name: 'workspace',
      root: '/repo',
      nodes: [],
      relations: [],
    },
    capabilities: new DefaultGovernanceCapabilityRegistry([
      {
        id: 'capability:nx',
      },
    ]),
  };

  const baseProfile: GovernanceProfile = {
    name: 'frontend-layered',
    boundaryPolicySource: 'profile',
    layers: [],
    allowedDomainDependencies: {},
    ownership: {
      required: false,
      metadataField: 'ownership',
    },
    health: {
      statusThresholds: {
        goodMinScore: 85,
        warningMinScore: 70,
      },
    },
    metrics: {},
  };

  function createLoadedExtension(
    id: string,
    register: GovernanceLoadedExtension['definition']['register'] = () =>
      undefined,
    overrides: Partial<GovernanceLoadedExtension> = {},
  ): GovernanceLoadedExtension {
    return {
      sourceSpecifier: `@anarchitects/${id}`,
      moduleSpecifier: `@anarchitects/${id}`,
      legacy: false,
      definition: {
        id,
        register,
      },
      ...overrides,
    };
  }

  it('registers normalized loaded extensions in input order without module loading', async () => {
    const registrationOrder: string[] = [];

    const registry = await registerLoadedGovernanceExtensions(baseContext, [
      createLoadedExtension('plugin-a', (host) => {
        registrationOrder.push('plugin-a');
        host.registerSignalProvider({
          provideSignals: async () => [],
        });
      }),
      createLoadedExtension('plugin-b', (host) => {
        registrationOrder.push('plugin-b');
        host.registerMetricProvider({
          provideMetrics: async () => [],
        });
      }),
    ]);

    expect(registrationOrder).toEqual(['plugin-a', 'plugin-b']);
    expect(registry.signalProviders.map((entry) => entry.pluginId)).toEqual([
      'plugin-a',
    ]);
    expect(registry.metricProviders.map((entry) => entry.pluginId)).toEqual([
      'plugin-b',
    ]);
  });

  it('passes immutable runtime context to loaded extensions', async () => {
    let receivedContext: GovernanceExtensionHostContext | undefined;

    await registerLoadedGovernanceExtensions(baseContext, [
      createLoadedExtension('plugin-a', (host) => {
        receivedContext = host.context;
      }),
    ]);

    expect(receivedContext).toEqual(baseContext);
    expect(Object.isFrozen(receivedContext)).toBe(true);
    expect(Object.isFrozen(receivedContext?.options)).toBe(true);
  });

  it('lets extensions declare capability requirements and query host capabilities', async () => {
    const context: GovernanceExtensionHostContext = {
      ...baseContext,
      capabilities: new DefaultGovernanceCapabilityRegistry([
        {
          id: 'capability:data:lineage',
          version: '1',
          source: 'adapter',
        },
      ]),
    };
    let hasRequiredCapability = false;

    await registerLoadedGovernanceExtensions(context, [
      createLoadedExtension('plugin-a', undefined, {
        definition: {
          id: 'plugin-a',
          name: 'Plugin A',
          version: '1',
          requiredCapabilities: [
            {
              id: 'capability:data:lineage',
              version: '1',
            },
          ],
          optionalCapabilities: [
            {
              id: 'capability:data:catalog',
            },
          ],
          register: (host) => {
            hasRequiredCapability = host.context.capabilities.has(
              'capability:data:lineage',
            );
          },
        },
      }),
    ]);

    expect(hasRequiredCapability).toBe(true);
  });

  it('preserves precomputed loader diagnostics during runtime registration', async () => {
    const result = await registerLoadedGovernanceExtensionsWithDiagnostics(
      baseContext,
      [createLoadedExtension('plugin-a')],
      {
        diagnostics: [
          {
            code: 'governance.extension.loaded',
            severity: 'notice',
            message:
              'Loaded governance extension from "@anarchitects/plugin-a".',
            packageName: '@anarchitects/plugin-a',
            moduleSpecifier: '@anarchitects/plugin-a',
            extensionId: 'plugin-a',
            legacy: false,
          },
        ],
      },
    );

    expect(result.diagnostics).toEqual([
      {
        code: 'governance.extension.loaded',
        severity: 'notice',
        message: 'Loaded governance extension from "@anarchitects/plugin-a".',
        packageName: '@anarchitects/plugin-a',
        moduleSpecifier: '@anarchitects/plugin-a',
        extensionId: 'plugin-a',
        legacy: false,
      },
    ]);
  });

  it('emits deterministic duplicate-id diagnostics for normalized loaded extensions', async () => {
    await expect(
      registerLoadedGovernanceExtensionsWithDiagnostics(baseContext, [
        createLoadedExtension('shared-extension', () => undefined, {
          sourceSpecifier: '@anarchitects/plugin-a',
          moduleSpecifier: '@anarchitects/plugin-a',
        }),
        createLoadedExtension('shared-extension', () => undefined, {
          sourceSpecifier: '@anarchitects/plugin-b',
          moduleSpecifier: '@anarchitects/plugin-b',
        }),
      ]),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GovernanceExtensionRegistrationError>>({
        diagnostics: [
          {
            code: 'governance.extension.duplicate_id',
            severity: 'error',
            message:
              'Duplicate governance extension id "shared-extension" was found in "@anarchitects/plugin-a" and "@anarchitects/plugin-b".',
            packageName: '@anarchitects/plugin-b',
            moduleSpecifier: '@anarchitects/plugin-b',
            extensionId: 'shared-extension',
            legacy: false,
          },
        ],
      }),
    );
  });

  it('applies runtime-added sourcePluginId metadata to signals and measurements', async () => {
    const registry = await registerLoadedGovernanceExtensions(baseContext, [
      createLoadedExtension('plugin-a', (host) => {
        host.registerSignalProvider({
          provideSignals: async () => [
            {
              id: 'signal-a',
              type: 'ownership-gap',
              source: 'policy',
              severity: 'warning',
              category: 'ownership',
              message: 'Ownership gap',
              relatedProjectIds: ['project-a'],
              createdAt: '2026-05-21T00:00:00.000Z',
            },
          ],
        });
        host.registerMetricProvider({
          provideMetrics: async () => [
            {
              id: 'metric-a',
              name: 'Metric A',
              family: 'ownership',
              value: 0.5,
              score: 50,
              maxScore: 100,
              unit: 'ratio',
            },
          ],
        });
      }),
    ]);

    const signals = await collectGovernanceSignals(registry, {
      workspace: baseContext.inventory,
      profile: baseProfile,
      context: baseContext,
      violations: [],
      signals: [],
    });
    const measurements = await collectGovernanceMeasurements(registry, {
      workspace: baseContext.inventory,
      profile: baseProfile,
      context: baseContext,
      signals,
      measurements: [],
      violations: [],
    });

    expect(signals).toEqual([
      expect.objectContaining({
        source: 'extension',
        sourcePluginId: 'plugin-a',
      }),
    ]);
    expect(measurements).toEqual([
      expect.objectContaining({
        sourcePluginId: 'plugin-a',
      }),
    ]);
  });
});
