import {
  DefaultGovernanceCapabilityRegistry,
  type GovernanceCompatibilityWorkspace,
  type GovernanceExtensionHostContext,
  type GovernanceProfile,
  type Ownership,
} from '@anarchitects/governance-core';

import {
  buildDbtGovernanceSignals,
  dbtGovernanceSignalProvider,
  type DbtGovernanceSignalProviderInput,
} from './index.js';
import { createCompatibilityWorkspace } from './test-workspace.js';

describe('dbt governance signals', () => {
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
    metadata?: Record<string, unknown>;
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
        marketing: ['marketing'],
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

  function createContext(
    workspace: GovernanceCompatibilityWorkspace,
  ): GovernanceExtensionHostContext {
    return {
      workspaceRoot: workspace.root,
      profileName: 'dbt',
      options: {},
      inventory: workspace,
      capabilities: new DefaultGovernanceCapabilityRegistry(),
    };
  }

  function createWorkspace(
    projects: TestWorkspaceProject[],
    dependencies: TestWorkspaceDependency[] = [],
  ): GovernanceCompatibilityWorkspace {
    return createCompatibilityWorkspace({
      id: 'workspace',
      name: 'workspace',
      root: '/repo',
      projects,
      dependencies,
    });
  }

  function createSignalInput(
    workspace: GovernanceCompatibilityWorkspace,
    overrides: Partial<DbtGovernanceSignalProviderInput> = {},
  ): DbtGovernanceSignalProviderInput {
    return {
      workspace,
      profile: overrides.profile ?? createProfile(),
      context: overrides.context ?? createContext(workspace),
      violations: overrides.violations ?? [],
      signals: overrides.signals ?? [],
      ...(overrides.diagnostics ? { diagnostics: overrides.diagnostics } : {}),
      ...(overrides.metadataResolutions
        ? { metadataResolutions: overrides.metadataResolutions }
        : {}),
    };
  }

  function createProject(options: {
    id: string;
    layer: string;
    domain: string;
    owner?: string;
    publicInterface?: boolean;
    criticality?: string;
    description?: boolean;
    tests?: boolean;
    contract?: boolean;
  }): TestWorkspaceProject {
    return {
      id: options.id,
      name: options.id.split('.').at(-1) ?? options.id,
      root: `models/${options.id.replaceAll('.', '/')}`,
      type: 'library',
      tags: options.publicInterface ? ['public'] : [],
      domain: options.domain,
      layer: options.layer,
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
          },
          resource: {
            tags: options.publicInterface ? ['public'] : [],
            meta: {
              layer: options.layer,
              domain: options.domain,
              ...(options.publicInterface !== undefined
                ? { public: options.publicInterface }
                : {}),
              ...(options.criticality
                ? { criticality: options.criticality }
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
            originalFilePath: `models/${options.layer}/${options.id.split('.').at(-1)}.sql`,
          },
          validation: {
            ...(options.tests !== undefined
              ? {
                  tests: options.tests ? ['unique:id'] : [],
                }
              : {}),
            ...(options.contract !== undefined
              ? {
                  contract: options.contract ? { enforced: true } : false,
                }
              : {}),
          },
          documentation: {
            ...(options.description !== undefined
              ? {
                  description: options.description ? 'Documented model' : '',
                  hasDescription: options.description,
                  hasDocs: options.description,
                }
              : {}),
          },
        },
      },
    };
  }

  it('emits resource-level dbt signals from normalized metadata and derived diagnostics', async () => {
    const workspace = createWorkspace([
      createProject({
        id: 'model.analytics.orders_complete',
        layer: 'staging',
        domain: 'finance',
        owner: 'finance-platform',
        publicInterface: true,
        description: true,
        tests: true,
        contract: true,
      }),
      createProject({
        id: 'model.analytics.orders_public',
        layer: 'marts',
        domain: 'finance',
        publicInterface: true,
        criticality: 'high',
        description: false,
        tests: false,
        contract: false,
      }),
    ]);

    const signals = await dbtGovernanceSignalProvider.provideSignals(
      createSignalInput(workspace),
    );
    const codes = signals.map((signal) => String(signal.metadata?.code ?? ''));

    expect(codes).toEqual(
      expect.arrayContaining([
        'DBT_LAYER_RESOLVED',
        'DBT_DOMAIN_RESOLVED',
        'DBT_OWNER_RESOLVED',
        'DBT_OWNER_MISSING',
        'DBT_DESCRIPTION_PRESENT',
        'DBT_DESCRIPTION_MISSING',
        'DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE',
        'DBT_TESTS_PRESENT',
        'DBT_TESTS_MISSING',
        'DBT_CRITICAL_MODEL_WITHOUT_TESTS_CANDIDATE',
        'DBT_CONTRACT_ENABLED',
        'DBT_CONTRACT_MISSING_FOR_PUBLIC_MODEL_CANDIDATE',
      ]),
    );

    const ownerMissingSignal = signals.find(
      (signal) => signal.metadata?.code === 'DBT_OWNER_MISSING',
    );
    expect(ownerMissingSignal).toMatchObject({
      source: 'extension',
      category: 'ownership',
      metadata: {
        code: 'DBT_OWNER_MISSING',
        diagnosticCodes: expect.arrayContaining(['DBT_OWNER_MISSING']),
      },
    });
  });

  it('emits dependency-level dbt layering, domain, and ownership signals', () => {
    const workspace = createWorkspace(
      [
        createProject({
          id: 'model.analytics.orders_staging',
          layer: 'staging',
          domain: 'finance',
          owner: 'analytics-platform',
          description: true,
          tests: true,
        }),
        createProject({
          id: 'model.analytics.orders_intermediate',
          layer: 'intermediate',
          domain: 'finance',
          owner: 'analytics-platform',
          description: true,
          tests: true,
        }),
        createProject({
          id: 'model.analytics.orders_marts',
          layer: 'marts',
          domain: 'finance',
          owner: 'finance-governance',
          description: true,
          tests: true,
        }),
        createProject({
          id: 'model.analytics.sales_consumer',
          layer: 'marts',
          domain: 'sales',
          owner: 'sales-platform',
          description: true,
          tests: true,
        }),
        createProject({
          id: 'model.analytics.marketing_consumer',
          layer: 'marts',
          domain: 'marketing',
          owner: 'marketing-platform',
          description: true,
          tests: true,
        }),
      ],
      [
        {
          source: 'model.analytics.orders_intermediate',
          target: 'model.analytics.orders_staging',
          type: 'static',
        },
        {
          source: 'model.analytics.orders_staging',
          target: 'model.analytics.orders_marts',
          type: 'static',
        },
        {
          source: 'model.analytics.sales_consumer',
          target: 'model.analytics.orders_marts',
          type: 'static',
        },
        {
          source: 'model.analytics.marketing_consumer',
          target: 'model.analytics.orders_marts',
          type: 'static',
        },
        {
          source: 'model.analytics.orders_intermediate',
          target: 'model.analytics.orders_marts',
          type: 'static',
        },
      ],
    );

    const signals = buildDbtGovernanceSignals(createSignalInput(workspace));
    const codes = signals.map((signal) => String(signal.metadata?.code ?? ''));

    expect(codes).toEqual(
      expect.arrayContaining([
        'DBT_LAYER_DEPENDENCY_DETECTED',
        'DBT_LAYER_DIRECTION_CANDIDATE',
        'DBT_LAYER_BYPASS_CANDIDATE',
        'DBT_CROSS_DOMAIN_DEPENDENCY_DETECTED',
        'DBT_SHARED_MODEL_DEPENDENCY_CANDIDATE',
        'DBT_OWNER_INCONSISTENT_CANDIDATE',
      ]),
    );

    const crossDomainSignal = signals.find(
      (signal) =>
        signal.metadata?.code === 'DBT_CROSS_DOMAIN_DEPENDENCY_DETECTED',
    );
    expect(crossDomainSignal).toMatchObject({
      nodeId: expect.any(String),
      relatedNodeIds: expect.arrayContaining([
        'model.analytics.orders_marts',
      ]),
      metadata: {
        dependencyKey: expect.stringContaining(
          '->model.analytics.orders_marts',
        ),
      },
    });
  });

  it('emits DAG shape signals using stable default thresholds', () => {
    const workspace = createWorkspace(
      [
        createProject({
          id: 'model.analytics.hotspot_hub',
          layer: 'intermediate',
          domain: 'finance',
          owner: 'analytics-platform',
          description: true,
          tests: true,
        }),
        createProject({
          id: 'model.analytics.inbound_a',
          layer: 'staging',
          domain: 'finance',
          owner: 'analytics-platform',
          description: true,
          tests: true,
        }),
        createProject({
          id: 'model.analytics.inbound_b',
          layer: 'staging',
          domain: 'finance',
          owner: 'analytics-platform',
          description: true,
          tests: true,
        }),
        createProject({
          id: 'model.analytics.inbound_c',
          layer: 'staging',
          domain: 'finance',
          owner: 'analytics-platform',
          description: true,
          tests: true,
        }),
        createProject({
          id: 'model.analytics.outbound_a',
          layer: 'marts',
          domain: 'finance',
          owner: 'analytics-platform',
          description: true,
          tests: true,
        }),
        createProject({
          id: 'model.analytics.outbound_b',
          layer: 'marts',
          domain: 'finance',
          owner: 'analytics-platform',
          description: true,
          tests: true,
        }),
        createProject({
          id: 'model.analytics.outbound_c',
          layer: 'marts',
          domain: 'finance',
          owner: 'analytics-platform',
          description: true,
          tests: true,
        }),
      ],
      [
        {
          source: 'model.analytics.inbound_a',
          target: 'model.analytics.hotspot_hub',
          type: 'static',
        },
        {
          source: 'model.analytics.inbound_b',
          target: 'model.analytics.hotspot_hub',
          type: 'static',
        },
        {
          source: 'model.analytics.inbound_c',
          target: 'model.analytics.hotspot_hub',
          type: 'static',
        },
        {
          source: 'model.analytics.hotspot_hub',
          target: 'model.analytics.outbound_a',
          type: 'static',
        },
        {
          source: 'model.analytics.hotspot_hub',
          target: 'model.analytics.outbound_b',
          type: 'static',
        },
        {
          source: 'model.analytics.hotspot_hub',
          target: 'model.analytics.outbound_c',
          type: 'static',
        },
      ],
    );

    const signals = buildDbtGovernanceSignals(createSignalInput(workspace));
    const hotspotSignals = signals.filter(
      (signal) => signal.nodeId === 'model.analytics.hotspot_hub',
    );
    const codes = hotspotSignals.map((signal) =>
      String(signal.metadata?.code ?? ''),
    );

    expect(codes).toEqual(
      expect.arrayContaining([
        'DBT_HIGH_FAN_IN',
        'DBT_HIGH_FAN_OUT',
        'DBT_ARCHITECTURAL_HOTSPOT_CANDIDATE',
      ]),
    );
    expect(
      hotspotSignals.find(
        (signal) =>
          signal.metadata?.code === 'DBT_ARCHITECTURAL_HOTSPOT_CANDIDATE',
      ),
    ).toMatchObject({
      metadata: {
        combinedFan: 6,
        threshold: 5,
      },
    });
  });
});
