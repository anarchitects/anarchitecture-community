import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  DefaultGovernanceCapabilityRegistry,
  type GovernanceExtensionHostContext,
  type GovernanceProfile,
  type GovernanceWorkspace,
} from '@anarchitects/governance-core';

import {
  buildDbtGovernanceSignals,
  dbtGovernanceSignalProvider,
  type DbtGovernanceMetadataResolution,
  type DbtGovernanceSignalProviderInput,
} from './index.js';
import {
  createCompatibilityWorkspace,
  type LegacyWorkspaceOwnership,
} from './test-workspace.js';

describe('dbt governance signals', () => {
  type TestWorkspaceProject = {
    id: string;
    name: string;
    root: string;
    type: 'application' | 'library' | 'tool' | 'unknown';
    tags: string[];
    domain?: string;
    layer?: string;
    ownership?: LegacyWorkspaceOwnership;
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
      layers: ['staging', 'intermediate', 'marts'],
      allowedDomainDependencies: {
        finance: ['finance'],
        sales: ['sales'],
        marketing: ['marketing'],
      },
      ownership: {
        required: true,
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

  function createSignalInput(
    workspace: GovernanceWorkspace,
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
    resourceType?: 'model' | 'source' | 'seed' | 'test' | 'project';
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
            ...(options.resourceType
              ? { resourceType: options.resourceType }
              : {}),
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
            ...(options.resourceType !== 'test'
              ? { materialization: 'table' }
              : {}),
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

  function createResolution(
    overrides: Partial<DbtGovernanceMetadataResolution> = {},
  ): DbtGovernanceMetadataResolution {
    return {
      governanceNodeId:
        overrides.governanceNodeId ?? 'model.valid_project.orders',
      ...(overrides.dbtUniqueId
        ? { dbtUniqueId: overrides.dbtUniqueId }
        : { dbtUniqueId: 'model.valid_project.orders' }),
      ...(overrides.resourceType
        ? { resourceType: overrides.resourceType }
        : {}),
      layer: overrides.layer ?? {
        status: 'unresolved',
        governanceNodeId: 'model.valid_project.orders',
        dbtUniqueId: 'model.valid_project.orders',
        sourcePaths: [],
      },
      domain: overrides.domain ?? {
        status: 'unresolved',
        governanceNodeId: 'model.valid_project.orders',
        dbtUniqueId: 'model.valid_project.orders',
        sourcePaths: [],
      },
      owner: overrides.owner ?? {
        status: 'unresolved',
        governanceNodeId: 'model.valid_project.orders',
        dbtUniqueId: 'model.valid_project.orders',
        sourcePaths: [],
      },
      criticality: overrides.criticality ?? {
        status: 'unresolved',
        governanceNodeId: 'model.valid_project.orders',
        dbtUniqueId: 'model.valid_project.orders',
        sourcePaths: [],
      },
      publicInterface: overrides.publicInterface ?? {
        status: 'resolved',
        governanceNodeId: 'model.valid_project.orders',
        dbtUniqueId: 'model.valid_project.orders',
        sourcePaths: ['metadata.dbt.resource.meta.public'],
        value: true,
      },
      crossDomainApproved: overrides.crossDomainApproved ?? {
        status: 'unresolved',
        governanceNodeId: 'model.valid_project.orders',
        dbtUniqueId: 'model.valid_project.orders',
        sourcePaths: [],
      },
      materializationCategory: overrides.materializationCategory ?? {
        status: 'unresolved',
        governanceNodeId: 'model.valid_project.orders',
        dbtUniqueId: 'model.valid_project.orders',
        sourcePaths: [],
      },
      documentationPresent: overrides.documentationPresent ?? {
        status: 'resolved',
        governanceNodeId: 'model.valid_project.orders',
        dbtUniqueId: 'model.valid_project.orders',
        sourcePaths: ['metadata.dbt.documentation.hasDescription'],
        value: false,
      },
      testsPresent: overrides.testsPresent ?? {
        status: 'unresolved',
        governanceNodeId: 'model.valid_project.orders',
        dbtUniqueId: 'model.valid_project.orders',
        sourcePaths: [],
      },
      contractPresent: overrides.contractPresent ?? {
        status: 'unresolved',
        governanceNodeId: 'model.valid_project.orders',
        dbtUniqueId: 'model.valid_project.orders',
        sourcePaths: [],
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

  it('only emits ownership-gap signals for ownership targets and excludes seed ownership by default', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'model.analytics.orders',
        resourceType: 'model',
        layer: 'marts',
        domain: 'finance',
      }),
      createProject({
        id: 'source.analytics.raw.orders',
        resourceType: 'source',
        layer: 'staging',
        domain: 'finance',
      }),
      createProject({
        id: 'test.analytics.not_null_orders_order_id',
        resourceType: 'test',
        layer: 'marts',
        domain: 'finance',
      }),
      createProject({
        id: 'dbt.project.analytics',
        resourceType: 'project',
        layer: 'marts',
        domain: 'finance',
      }),
      createProject({
        id: 'seed.analytics.calendar',
        resourceType: 'seed',
        layer: 'staging',
        domain: 'finance',
      }),
    ]);

    const ownershipGapNodeIds = buildDbtGovernanceSignals(
      createSignalInput(workspace),
    )
      .filter((signal) => signal.type === 'ownership-gap')
      .map((signal) => signal.nodeId)
      .sort();

    expect(ownershipGapNodeIds).toEqual(
      ['source.analytics.raw.orders', 'model.analytics.orders'].sort(),
    );
  });

  it('does not emit contract signals for dbt project, test, or source nodes', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'model.analytics.public_orders',
        resourceType: 'model',
        layer: 'marts',
        domain: 'finance',
        publicInterface: true,
        contract: false,
      }),
      createProject({
        id: 'source.analytics.raw.orders',
        resourceType: 'source',
        layer: 'staging',
        domain: 'finance',
        publicInterface: true,
        contract: false,
      }),
      createProject({
        id: 'test.analytics.not_null_public_orders_order_id',
        resourceType: 'test',
        layer: 'marts',
        domain: 'finance',
        publicInterface: true,
        contract: false,
      }),
      createProject({
        id: 'dbt.project.analytics',
        resourceType: 'project',
        layer: 'marts',
        domain: 'finance',
        publicInterface: true,
        contract: false,
      }),
    ]);

    const contractSignalNodeIds = buildDbtGovernanceSignals(
      createSignalInput(workspace),
    )
      .filter(
        (signal) =>
          String(signal.metadata?.code ?? '') ===
          'DBT_CONTRACT_MISSING_FOR_PUBLIC_MODEL_CANDIDATE',
      )
      .map((signal) => signal.nodeId);

    expect(contractSignalNodeIds).toEqual(['model.analytics.public_orders']);
  });

  it('does not emit documentation signals for dbt test nodes', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'test.analytics.not_null_public_orders_order_id',
        resourceType: 'test',
        layer: 'marts',
        domain: 'finance',
        publicInterface: true,
        description: false,
      }),
    ]);

    const codes = buildDbtGovernanceSignals(createSignalInput(workspace)).map(
      (signal) => String(signal.metadata?.code ?? ''),
    );

    expect(codes).not.toContain('DBT_DESCRIPTION_MISSING');
    expect(codes).not.toContain('DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE');
  });

  it('treats generic dbt test nodes linked to a model as test coverage', () => {
    const modelId = 'model.analytics.orders';
    const workspace = createWorkspace(
      [
        createProject({
          id: modelId,
          layer: 'marts',
          domain: 'finance',
          tests: false,
        }),
        createProject({
          id: 'test.analytics.not_null_orders_order_id',
          resourceType: 'test',
          layer: 'marts',
          domain: 'finance',
        }),
      ],
      [
        {
          source: 'test.analytics.not_null_orders_order_id',
          target: modelId,
          type: 'static',
          metadata: {
            dbt: {
              lineage: {
                relationKind: 'tests',
              },
            },
          },
        },
      ],
    );

    const modelSignalCodes = buildDbtGovernanceSignals(
      createSignalInput(workspace),
    )
      .filter((signal) => signal.nodeId === modelId)
      .map((signal) => String(signal.metadata?.code ?? ''));

    expect(modelSignalCodes).toContain('DBT_TESTS_PRESENT');
    expect(modelSignalCodes).not.toContain('DBT_TESTS_MISSING');
  });

  it('treats workspace dbt test evidence linked to a model as test coverage', () => {
    const modelId = 'model.analytics.orders';
    const workspace: GovernanceWorkspace = {
      ...createWorkspace([
        createProject({
          id: modelId,
          layer: 'marts',
          domain: 'finance',
          tests: false,
        }),
      ]),
      extensions: {
        'governance-extension:dbt': {
          extensionId: 'governance-extension:dbt',
          contractVersion: '1',
          data: {
            kind: 'workspace',
            technology: 'dbt',
            projectName: 'analytics',
            testEvidence: [
              {
                uniqueId: 'test.analytics.not_null_orders_order_id',
                name: 'not_null_orders_order_id',
                packageName: 'analytics',
                resourceType: 'test',
                testType: 'not_null',
                dependsOnNodeIds: [modelId],
                targetNodeIds: [modelId],
              },
            ],
          },
        },
      },
    };

    const modelSignalCodes = buildDbtGovernanceSignals(
      createSignalInput(workspace),
    )
      .filter((signal) => signal.nodeId === modelId)
      .map((signal) => String(signal.metadata?.code ?? ''));

    expect(modelSignalCodes).toContain('DBT_TESTS_PRESENT');
    expect(modelSignalCodes).not.toContain('DBT_TESTS_MISSING');
  });

  it('treats dbt source tests linked to a source as test coverage', () => {
    const sourceId = 'source.analytics.raw.orders';
    const workspace = createWorkspace(
      [
        createProject({
          id: sourceId,
          resourceType: 'source',
          layer: 'staging',
          domain: 'finance',
          tests: false,
        }),
        createProject({
          id: 'test.analytics.source_freshness_raw_orders',
          resourceType: 'test',
          layer: 'staging',
          domain: 'finance',
        }),
      ],
      [
        {
          source: 'test.analytics.source_freshness_raw_orders',
          target: sourceId,
          type: 'static',
          metadata: {
            dbt: {
              lineage: {
                relationKind: 'tests',
              },
            },
          },
        },
      ],
    );

    const sourceSignalCodes = buildDbtGovernanceSignals(
      createSignalInput(workspace),
    )
      .filter((signal) => signal.nodeId === sourceId)
      .map((signal) => String(signal.metadata?.code ?? ''));

    expect(sourceSignalCodes).toContain('DBT_TESTS_PRESENT');
    expect(sourceSignalCodes).not.toContain('DBT_TESTS_MISSING');
  });

  it('treats relationships dbt test nodes linked to a model as test coverage', () => {
    const modelId = 'model.analytics.orders';
    const workspace = createWorkspace(
      [
        createProject({
          id: modelId,
          layer: 'marts',
          domain: 'finance',
          tests: false,
        }),
        createProject({
          id: 'source.analytics.raw.customers',
          resourceType: 'source',
          layer: 'staging',
          domain: 'finance',
        }),
        createProject({
          id: 'test.analytics.relationships_orders_customer_id',
          resourceType: 'test',
          layer: 'marts',
          domain: 'finance',
        }),
      ],
      [
        {
          source: 'test.analytics.relationships_orders_customer_id',
          target: modelId,
          type: 'static',
          metadata: {
            dbt: {
              lineage: {
                relationKind: 'tests',
              },
            },
          },
        },
        {
          source: 'test.analytics.relationships_orders_customer_id',
          target: 'source.analytics.raw.customers',
          type: 'static',
          metadata: {
            dbt: {
              lineage: {
                relationKind: 'tests',
              },
            },
          },
        },
      ],
    );

    const modelSignalCodes = buildDbtGovernanceSignals(
      createSignalInput(workspace),
    )
      .filter((signal) => signal.nodeId === modelId)
      .map((signal) => String(signal.metadata?.code ?? ''));

    expect(modelSignalCodes).toContain('DBT_TESTS_PRESENT');
    expect(modelSignalCodes).not.toContain('DBT_TESTS_MISSING');
  });

  it('does not emit test coverage signals for dbt project, test, or seed nodes', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'dbt.project.analytics',
        resourceType: 'project',
        layer: 'marts',
        domain: 'finance',
        tests: false,
      }),
      createProject({
        id: 'test.analytics.not_null_orders_order_id',
        resourceType: 'test',
        layer: 'marts',
        domain: 'finance',
        tests: false,
      }),
      createProject({
        id: 'seed.analytics.calendar',
        resourceType: 'seed',
        layer: 'staging',
        domain: 'finance',
        tests: false,
      }),
    ]);

    const testingSignals = buildDbtGovernanceSignals(
      createSignalInput(workspace),
    )
      .filter((signal) =>
        ['DBT_TESTS_PRESENT', 'DBT_TESTS_MISSING'].includes(
          String(signal.metadata?.code ?? ''),
        ),
      )
      .map((signal) => signal.nodeId);

    expect(testingSignals).not.toContain('dbt.project.analytics');
    expect(testingSignals).not.toContain(
      'test.analytics.not_null_orders_order_id',
    );
    expect(testingSignals).not.toContain('seed.analytics.calendar');
  });

  it('uses explicit test resource types over model-like ids for documentation signals', () => {
    const codes = buildDbtGovernanceSignals(
      createSignalInput(createWorkspace([]), {
        metadataResolutions: [
          createResolution({
            governanceNodeId: 'model.valid_project.orders_but_test',
            dbtUniqueId: 'model.valid_project.orders_but_test',
            resourceType: 'test',
          }),
        ],
      }),
    ).map((signal) => String(signal.metadata?.code ?? ''));

    expect(codes).not.toContain('DBT_DESCRIPTION_PRESENT');
    expect(codes).not.toContain('DBT_DESCRIPTION_MISSING');
    expect(codes).not.toContain('DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE');
  });

  it('uses explicit model resource types over legacy test-id prefixes for documentation signals', () => {
    const codes = buildDbtGovernanceSignals(
      createSignalInput(createWorkspace([]), {
        metadataResolutions: [
          createResolution({
            governanceNodeId: 'test.valid_project.orders_but_model',
            dbtUniqueId: 'test.valid_project.orders_but_model',
            resourceType: 'model',
          }),
        ],
      }),
    ).map((signal) => String(signal.metadata?.code ?? ''));

    expect(codes).toContain('DBT_DESCRIPTION_MISSING');
    expect(codes).toContain('DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE');
  });

  it('falls back to legacy test id prefixes when explicit resource type is absent for documentation signals', () => {
    const codes = buildDbtGovernanceSignals(
      createSignalInput(createWorkspace([]), {
        metadataResolutions: [
          createResolution({
            governanceNodeId: 'test.valid_project.legacy_orders_test',
            dbtUniqueId: 'test.valid_project.legacy_orders_test',
          }),
        ],
      }),
    ).map((signal) => String(signal.metadata?.code ?? ''));

    expect(codes).not.toContain('DBT_DESCRIPTION_PRESENT');
    expect(codes).not.toContain('DBT_DESCRIPTION_MISSING');
    expect(codes).not.toContain('DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE');
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
      relatedNodeIds: expect.arrayContaining(['model.analytics.orders_marts']),
      metadata: {
        dependencyKey: expect.stringContaining(
          '->model.analytics.orders_marts',
        ),
      },
    });
  });

  it('does not keep a local dbt test-prefix helper in signals.ts', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./signals.ts', import.meta.url)),
      'utf8',
    );

    expect(source).not.toContain('function isDbtTestResolution(');
    expect(source).not.toContain("startsWith('test.')");
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
