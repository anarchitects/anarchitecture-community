import {
  DefaultGovernanceCapabilityRegistry,
  type GovernanceExtensionHostContext,
  type GovernanceProfile,
  type GovernanceWorkspace,
  type Ownership,
} from '@anarchitects/governance-core';

import {
  buildDbtGovernanceMetrics,
  dbtGovernanceMetricProvider,
  type DbtGovernanceMetricProviderInput,
} from './index.js';
import { createCompatibilityWorkspace } from './test-workspace.js';

describe('dbt governance metrics', () => {
  type TestWorkspaceProject = {
    id: string;
    name: string;
    root: string;
    type: 'application' | 'library' | 'tool' | 'unknown';
    tags: string[];
    domain?: string;
    layer?: string;
    ownership?: Ownership;
    metadata: Record<string, unknown>;
  };

  type TestWorkspaceDependency = {
    source: string;
    target: string;
    type: 'static' | 'dynamic' | 'implicit' | 'unknown';
    sourceFile?: string;
  };

  function createProfile(
    overrides: Partial<GovernanceProfile> = {},
  ): GovernanceProfile {
    return {
      name: 'dbt',
      boundaryPolicySource: 'profile',
      layers: ['staging', 'intermediate', 'marts'],
      allowedDomainDependencies: {
        finance: ['finance'],
        sales: ['sales'],
      },
      ownership: {
        required: true,
        metadataField: 'ownership.team',
      },
      health: {
        statusThresholds: {
          goodMinScore: 85,
          warningMinScore: 70,
        },
      },
      metrics: {},
      ...overrides,
    };
  }

  function createWorkspace(
    projects: TestWorkspaceProject[],
    dependencies: TestWorkspaceDependency[] = [],
  ): GovernanceWorkspace {
    return createCompatibilityWorkspace({
      id: 'workspace',
      name: 'workspace',
      root: '/repo',
      projects,
      dependencies,
    });
  }

  function createContext(
    workspace: GovernanceWorkspace,
  ): GovernanceExtensionHostContext {
    return {
      workspaceRoot: workspace.root,
      profileName: 'dbt',
      options: {},
      inventory: workspace,
      capabilities: new DefaultGovernanceCapabilityRegistry(),
    };
  }

  function createMetricInput(
    workspace: GovernanceWorkspace,
    overrides: Partial<DbtGovernanceMetricProviderInput> = {},
  ): DbtGovernanceMetricProviderInput {
    return {
      workspace,
      profile: overrides.profile ?? createProfile(),
      context: overrides.context ?? createContext(workspace),
      violations: overrides.violations ?? [],
      signals: overrides.signals ?? [],
      diagnostics: overrides.diagnostics ?? [],
      measurements: overrides.measurements ?? [],
      ...(overrides.metadataResolutions
        ? { metadataResolutions: overrides.metadataResolutions }
        : {}),
    };
  }

  function createProject(options: {
    id: string;
    layer?: string;
    domain?: string;
    owner?: string;
    description?: boolean;
    tests?: boolean;
    contract?: boolean;
    criticality?: string;
    publicInterface?: boolean;
    resourceType?: string;
  }): TestWorkspaceProject {
    const leafName = options.id.split('.').at(-1) ?? options.id;

    return {
      id: options.id,
      name: leafName,
      root: `models/${leafName}`,
      type: 'library',
      tags: options.publicInterface ? ['public'] : [],
      ...(options.domain ? { domain: options.domain } : {}),
      ...(options.layer ? { layer: options.layer } : {}),
      ...(options.owner
        ? {
            ownership: {
              team: options.owner,
              source: 'project-metadata',
            },
          }
        : {}),
      metadata: {
        dbt: {
          identity: {
            uniqueId: options.id,
            ...(options.resourceType
              ? { resourceType: options.resourceType }
              : {}),
          },
          resource: {
            tags: options.publicInterface ? ['public'] : [],
            meta: {
              ...(options.layer ? { layer: options.layer } : {}),
              ...(options.domain ? { domain: options.domain } : {}),
              ...(options.criticality
                ? { criticality: options.criticality }
                : {}),
              ...(options.publicInterface !== undefined
                ? { public: options.publicInterface }
                : {}),
            },
            ...(options.owner
              ? {
                  owner: {
                    name: options.owner,
                  },
                }
              : {}),
            materialization: 'table',
          },
          relation: {
            originalFilePath: `models/${options.layer ?? 'unknown'}/${leafName}.sql`,
          },
          validation: {
            tests: options.tests ? ['unique:id'] : [],
            contract: options.contract ? { enforced: true } : false,
          },
          documentation: {
            description: options.description ? 'Documented model' : '',
            hasDescription: options.description ?? false,
            hasDocs: options.description ?? false,
          },
        },
      },
    };
  }

  it('emits deterministic raw dbt governance counts and ratios', async () => {
    const workspace = createWorkspace(
      [
        createProject({
          id: 'model.analytics.orders_staging',
          layer: 'staging',
          domain: 'finance',
          owner: 'finance-platform',
          description: true,
          tests: true,
          contract: false,
        }),
        createProject({
          id: 'model.analytics.orders_intermediate',
          layer: 'intermediate',
          domain: 'finance',
          description: false,
          tests: false,
          contract: false,
        }),
        createProject({
          id: 'model.analytics.orders_mart',
          layer: 'marts',
          domain: 'sales',
          owner: 'sales-platform',
          description: true,
          tests: false,
          contract: true,
          criticality: 'high',
          publicInterface: true,
        }),
        createProject({
          id: 'source.analytics.raw_orders',
          domain: 'finance',
          resourceType: 'source',
        }),
      ],
      [
        {
          source: 'model.analytics.orders_staging',
          target: 'model.analytics.orders_intermediate',
          type: 'static',
        },
        {
          source: 'model.analytics.orders_mart',
          target: 'model.analytics.orders_intermediate',
          type: 'static',
        },
        {
          source: 'source.analytics.raw_orders',
          target: 'model.analytics.orders_staging',
          type: 'static',
        },
      ],
    );

    const measurements = await dbtGovernanceMetricProvider.provideMetrics(
      createMetricInput(workspace),
    );
    const byId = new Map(
      measurements.map((measurement) => [measurement.id, measurement]),
    );

    expect(byId.get('dbt-model-count')).toMatchObject({
      value: 3,
      unit: 'count',
      metadata: {
        count: 3,
        countedNodeIds: [
          'model.analytics.orders_intermediate',
          'model.analytics.orders_mart',
          'model.analytics.orders_staging',
        ],
      },
    });
    expect(byId.get('dbt-dependency-count')).toMatchObject({
      value: 2,
      metadata: {
        count: 2,
        countedRelationIds: [
          'dbt:lineage:model.analytics.orders_mart->model.analytics.orders_intermediate',
          'dbt:lineage:model.analytics.orders_staging->model.analytics.orders_intermediate',
        ],
      },
    });
    expect(byId.get('dbt-cross-domain-dependency-count')).toMatchObject({
      value: 1,
      metadata: {
        count: 1,
        countedRelationIds: [
          'dbt:lineage:model.analytics.orders_mart->model.analytics.orders_intermediate',
        ],
      },
    });
    expect(byId.get('dbt-layer-violation-count')).toMatchObject({
      value: 1,
      metadata: {
        count: 1,
      },
    });
    expect(byId.get('dbt-ownership-completeness-ratio')).toMatchObject({
      value: 0.6667,
      unit: 'ratio',
      metadata: {
        numerator: 2,
        denominator: 3,
        ratio: 0.6667,
        zeroDenominator: false,
      },
    });
    expect(byId.get('dbt-documentation-coverage-ratio')).toMatchObject({
      value: 0.6667,
      metadata: {
        numerator: 2,
        denominator: 3,
      },
    });
    expect(byId.get('dbt-test-coverage-ratio')).toMatchObject({
      value: 0.3333,
      metadata: {
        numerator: 1,
        denominator: 3,
      },
    });
    expect(byId.get('dbt-contract-adoption-ratio')).toMatchObject({
      value: 0.3333,
      metadata: {
        numerator: 1,
        denominator: 3,
      },
    });
    expect(byId.get('dbt-hotspot-count')).toMatchObject({
      value: 0,
      metadata: {
        count: 0,
      },
    });
    expect(byId.get('dbt-unresolved-layer-count')).toMatchObject({
      value: 1,
      metadata: {
        count: 1,
        countedNodeIds: ['source.analytics.raw_orders'],
        countedDiagnosticCodes: ['DBT_LAYER_UNRESOLVED'],
      },
    });
    expect(byId.get('dbt-unresolved-domain-count')).toMatchObject({
      value: 0,
      metadata: {
        count: 0,
        countedDiagnosticCodes: ['DBT_DOMAIN_UNRESOLVED'],
      },
    });
  });

  it('falls back to resolver, signal, diagnostic, and rule outputs when not supplied', () => {
    const workspace = createWorkspace(
      [
        createProject({
          id: 'model.analytics.orders',
          layer: 'marts',
          domain: 'finance',
          owner: 'finance-platform',
          description: true,
          tests: false,
          contract: true,
          criticality: 'high',
          publicInterface: true,
        }),
        createProject({
          id: 'model.analytics.stg_customers',
          layer: 'staging',
          description: false,
          tests: true,
          contract: false,
        }),
      ],
      [
        {
          source: 'model.analytics.orders',
          target: 'model.analytics.stg_customers',
          type: 'static',
        },
      ],
    );

    const measurements = buildDbtGovernanceMetrics(
      createMetricInput(workspace),
    );
    const byId = new Map(
      measurements.map((measurement) => [measurement.id, measurement]),
    );

    expect(byId.get('dbt-layer-violation-count')).toMatchObject({
      value: 1,
      metadata: {
        countedViolationIds: expect.arrayContaining([expect.any(String)]),
      },
    });
    expect(byId.get('dbt-unresolved-domain-count')).toMatchObject({
      value: 1,
      metadata: {
        countedNodeIds: ['model.analytics.stg_customers'],
        countedDiagnosticCodes: ['DBT_DOMAIN_UNRESOLVED'],
        countedDiagnosticIds: expect.arrayContaining([expect.any(String)]),
      },
    });
  });

  it('uses explicit zero-denominator handling for ratio metrics when no dbt models are eligible', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'seed.analytics.calendar',
        resourceType: 'seed',
      }),
    ]);

    const measurements = buildDbtGovernanceMetrics(
      createMetricInput(workspace),
    );
    const ratioIds = [
      'dbt-ownership-completeness-ratio',
      'dbt-documentation-coverage-ratio',
      'dbt-test-coverage-ratio',
      'dbt-contract-adoption-ratio',
    ] as const;

    for (const metricId of ratioIds) {
      expect(
        measurements.find((measurement) => measurement.id === metricId),
      ).toMatchObject({
        value: 0,
        score: 0,
        maxScore: 1,
        unit: 'ratio',
        metadata: {
          numerator: 0,
          denominator: 0,
          ratio: 0,
          zeroDenominator: true,
        },
      });
    }
  });
});
