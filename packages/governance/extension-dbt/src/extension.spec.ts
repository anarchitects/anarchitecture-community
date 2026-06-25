import {
  buildGovernanceAssessmentArtifacts,
  DefaultGovernanceCapabilityRegistry,
  registerLoadedGovernanceExtensionsWithDiagnostics,
  type GovernanceExtensionHostContext,
  type GovernanceNode,
  type GovernanceProfile,
  type GovernanceWorkspace,
} from '@anarchitects/governance-core';

import {
  DBT_GOVERNANCE_EXTENSION_ID,
  attachDbtGovernanceModelExpansion,
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
    expect(result.registry.enrichers).toHaveLength(1);
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

  it('projects resolved dbt domains into canonical nodes before core graph signals run', async () => {
    const workspace = createWorkspaceWithCompanionDomains();
    const profile: GovernanceProfile = {
      name: 'dbt',
      layers: ['staging', 'intermediate', 'marts'],
      allowedDomainDependencies: {
        sales: [],
        customer: [],
      },
      ownership: {
        required: false,
      },
      health: {
        statusThresholds: {
          goodMinScore: 85,
          warningMinScore: 70,
        },
      },
      metrics: {},
    };
    const enrichedContext: GovernanceExtensionHostContext = {
      ...context,
      inventory: workspace,
      capabilities: new DefaultGovernanceCapabilityRegistry(),
    };
    const registration =
      await registerLoadedGovernanceExtensionsWithDiagnostics(enrichedContext, [
        {
          sourceSpecifier: '@anarchitects/governance-extension-dbt',
          moduleSpecifier: '@anarchitects/governance-extension-dbt',
          definition: dbtGovernanceExtension,
        },
      ]);

    const artifacts = await buildGovernanceAssessmentArtifacts({
      workspace,
      profile,
      extensionRegistry: registration.registry,
      extensionContext: enrichedContext,
    });

    expect(
      artifacts.workspace.nodes.find(
        (node) => node.id === 'model.demo.fct_orders',
      )?.classification,
    ).toMatchObject({
      domain: 'sales',
    });
    expect(
      artifacts.workspace.nodes.find(
        (node) => node.id === 'model.demo.dim_customers',
      )?.classification,
    ).toMatchObject({
      domain: 'customer',
    });
    expect(
      artifacts.signals.some(
        (signal) => signal.type === 'missing-domain-context',
      ),
    ).toBe(false);
  });
});

function createWorkspaceWithCompanionDomains(): GovernanceWorkspace {
  const ordersBaseNode: GovernanceNode = {
    id: 'model.demo.fct_orders',
    name: 'fct_orders',
    kind: 'resource',
    technology: 'dbt',
    sourceSystem: 'dbt',
    root: 'models/marts/fct_orders.sql',
    path: 'models/marts/fct_orders.sql',
    tags: [],
    metadata: {},
  };
  const ordersNode = attachDbtGovernanceModelExpansion(
    ordersBaseNode,
    {
      kind: 'node',
      technology: 'dbt',
      nodeKind: 'resource',
      resourceType: 'model',
      identity: {
        uniqueId: 'model.demo.fct_orders',
        resourceType: 'model',
      },
      resource: {
        tags: [],
        meta: {
          anarchitects: {
            governance: {
              domain: 'sales',
              publicInterface: true,
            },
          },
        },
      },
      relation: {
        originalFilePath: 'models/marts/fct_orders.sql',
      },
      documentation: {
        description: 'Fact table for order analytics.',
        hasDescription: true,
        hasDocs: true,
      },
    },
  );
  const customersBaseNode: GovernanceNode = {
    id: 'model.demo.dim_customers',
    name: 'dim_customers',
    kind: 'resource',
    technology: 'dbt',
    sourceSystem: 'dbt',
    root: 'models/marts/dim_customers.sql',
    path: 'models/marts/dim_customers.sql',
    tags: [],
    metadata: {},
  };
  const customersNode = attachDbtGovernanceModelExpansion(
    customersBaseNode,
    {
      kind: 'node',
      technology: 'dbt',
      nodeKind: 'resource',
      resourceType: 'model',
      identity: {
        uniqueId: 'model.demo.dim_customers',
        resourceType: 'model',
      },
      resource: {
        tags: [],
        meta: {
          anarchitects: {
            governance: {
              domain: 'customer',
            },
          },
        },
      },
      relation: {
        originalFilePath: 'models/marts/dim_customers.sql',
      },
      documentation: {
        description: 'Customer dimension.',
        hasDescription: true,
        hasDocs: true,
      },
    },
  );

  return {
    id: 'workspace',
    name: 'workspace',
    root: '/repo',
    nodes: [ordersNode, customersNode],
    relations: [
      {
        id: 'dbt:lineage:model.demo.fct_orders->model.demo.dim_customers',
        sourceNodeId: 'model.demo.fct_orders',
        targetNodeId: 'model.demo.dim_customers',
        kind: 'dependency',
        metadata: {},
      },
    ],
  };
}
