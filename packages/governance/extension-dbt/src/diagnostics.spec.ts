import {
  DefaultGovernanceCapabilityRegistry,
  type GovernanceExtensionHostContext,
  type GovernanceProfile,
  type GovernanceWorkspace,
} from '@anarchitects/governance-core';

import {
  buildDbtGovernanceDiagnostics,
  dbtGovernanceDiagnosticsProvider,
  resolveDbtGovernanceMetadata,
  resolveDbtDomain,
  type DbtGovernanceDiagnosticProviderInput,
  type DbtGovernanceMetadataResolution,
  type DbtGovernanceMetadataResolverInput,
} from './index.js';
import { createCompatibilityWorkspace } from './test-workspace.js';

describe('dbt governance diagnostics', () => {
  type TestWorkspaceProject = {
    id: string;
    name: string;
    root: string;
    type: 'application' | 'library' | 'tool' | 'unknown';
    tags: string[];
    domain?: string;
    layer?: string;
    ownership?: {
      team?: string;
      contacts?: string[];
      source: 'project-metadata' | 'codeowners' | 'merged' | 'none';
    };
    metadata: Record<string, unknown>;
  };

  function createProfile(
    overrides: Partial<GovernanceProfile> = {},
  ): GovernanceProfile {
    return {
      name: 'dbt',
      layers: ['staging', 'intermediate', 'marts'],
      allowedDomainDependencies: {
        finance: ['finance'],
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

  function createWorkspace(
    projects: TestWorkspaceProject[] = [],
  ): GovernanceWorkspace {
    return createCompatibilityWorkspace({
      id: 'workspace',
      name: 'workspace',
      root: '/repo',
      projects,
      dependencies: [],
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

  function createProviderInput(
    overrides: Partial<DbtGovernanceDiagnosticProviderInput> = {},
  ): DbtGovernanceDiagnosticProviderInput {
    const workspace = overrides.workspace ?? createWorkspace();
    const context = overrides.context ?? createContext(workspace);

    return {
      workspace,
      profile: overrides.profile ?? createProfile(),
      context,
      diagnostics: overrides.diagnostics ?? [],
      signals: overrides.signals ?? [],
      measurements: overrides.measurements ?? [],
      violations: overrides.violations ?? [],
      ...(overrides.metadataResolutions
        ? { metadataResolutions: overrides.metadataResolutions }
        : {}),
    };
  }

  function createResolverInput(
    overrides: Partial<DbtGovernanceMetadataResolverInput> = {},
  ): DbtGovernanceMetadataResolverInput {
    return {
      id: 'model.analytics.orders',
      name: 'orders',
      tags: [],
      metadata: {
        dbt: {
          identity: {
            uniqueId: 'model.analytics.orders',
          },
          resource: {
            tags: [],
            meta: {},
          },
          relation: {
            originalFilePath: 'models/marts/orders.sql',
          },
          validation: {},
          documentation: {},
        },
      },
      ...overrides,
    };
  }

  function createResourceResolution(options: {
    id: string;
    resourceType: 'model' | 'source' | 'seed' | 'test' | 'project';
    layer: string;
    domain: string;
    owner?: unknown;
    originalFilePath: string;
  }): DbtGovernanceMetadataResolution {
    return resolveDbtGovernanceMetadata(
      createResolverInput({
        id: options.id,
        metadata: {
          dbt: {
            identity: {
              uniqueId: options.id,
              resourceType: options.resourceType,
            },
            resource: {
              tags: [],
              meta: {
                layer: options.layer,
                domain: options.domain,
              },
              ...(options.owner !== undefined ? { owner: options.owner } : {}),
              ...(options.resourceType !== 'test'
                ? {
                    materialization:
                      options.resourceType === 'seed' ? 'seed' : 'table',
                  }
                : {}),
            },
            relation: {
              originalFilePath: options.originalFilePath,
            },
            validation: {},
            documentation: {},
          },
        },
      }),
    );
  }

  it('reports unresolved layer/domain/owner metadata and skipped analysis as diagnostics', () => {
    const resolution = resolveDbtGovernanceMetadata(
      createResolverInput({
        metadata: {
          dbt: {
            identity: {
              uniqueId: 'model.analytics.orders',
            },
            resource: {
              tags: [],
              meta: {},
            },
            relation: {
              originalFilePath: 'models/orders.sql',
            },
            validation: {},
            documentation: {},
          },
        },
      }),
    );

    const diagnostics = buildDbtGovernanceDiagnostics(
      createProviderInput({
        metadataResolutions: [resolution],
      }),
    );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'DBT_LAYER_UNRESOLVED',
      'DBT_DOMAIN_UNRESOLVED',
      'DBT_OWNER_MISSING',
      'DBT_RULE_SKIPPED_MISSING_METADATA',
    ]);
    expect(diagnostics[0]).toMatchObject({
      reference: {
        nodeId: 'model.analytics.orders',
      },
      details: {
        dbtUniqueId: 'model.analytics.orders',
        field: 'layer',
      },
    });
    expect(diagnostics[3]).toMatchObject({
      details: {
        missingMetadata: ['layer', 'domain', 'owner'],
        skippedRuleIds: [
          'layer-boundary',
          'domain-boundary',
          'ownership-presence',
        ],
      },
    });
  });

  it('reports invalid owner, criticality, and public marker metadata', () => {
    const resolution = resolveDbtGovernanceMetadata(
      createResolverInput({
        domain: 'finance',
        metadata: {
          dbt: {
            identity: {
              uniqueId: 'model.analytics.orders',
            },
            resource: {
              tags: [],
              owner: 42,
              meta: {
                criticality: ['high'],
                public: 'maybe',
              },
            },
            relation: {
              originalFilePath: 'models/marts/orders.sql',
            },
            validation: {},
            documentation: {},
          },
        },
      }),
    );

    const diagnostics = buildDbtGovernanceDiagnostics(
      createProviderInput({
        metadataResolutions: [resolution],
      }),
    );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'DBT_OWNER_INVALID',
      'DBT_CRITICALITY_INVALID',
      'DBT_PUBLIC_MARKER_INVALID',
    ]);
    expect(diagnostics[0]).toMatchObject({
      details: {
        field: 'owner',
        invalidMetadataPaths: ['metadata.dbt.resource.owner'],
      },
    });
    expect(diagnostics[2]).toMatchObject({
      details: {
        field: 'publicInterface',
        invalidMetadataPaths: ['metadata.dbt.resource.meta.public'],
        rawValues: ['maybe'],
      },
    });
  });

  it('only emits owner-missing diagnostics for ownership targets and excludes seed ownership by default', () => {
    const resolutions = [
      createResourceResolution({
        id: 'model.analytics.orders',
        resourceType: 'model',
        layer: 'marts',
        domain: 'finance',
        originalFilePath: 'models/marts/orders.sql',
      }),
      createResourceResolution({
        id: 'source.analytics.raw.orders',
        resourceType: 'source',
        layer: 'staging',
        domain: 'finance',
        originalFilePath: 'models/staging/raw_orders.yml',
      }),
      createResourceResolution({
        id: 'test.analytics.not_null_orders_order_id',
        resourceType: 'test',
        layer: 'marts',
        domain: 'finance',
        originalFilePath: 'tests/not_null_orders_order_id.sql',
      }),
      createResourceResolution({
        id: 'dbt.project.analytics',
        resourceType: 'project',
        layer: 'marts',
        domain: 'finance',
        originalFilePath: 'dbt_project.yml',
      }),
      createResourceResolution({
        id: 'seed.analytics.calendar',
        resourceType: 'seed',
        layer: 'staging',
        domain: 'finance',
        originalFilePath: 'seeds/calendar.csv',
      }),
    ];

    const ownerMissingNodeIds = buildDbtGovernanceDiagnostics(
      createProviderInput({
        metadataResolutions: resolutions,
      }),
    )
      .filter((diagnostic) => diagnostic.code === 'DBT_OWNER_MISSING')
      .map((diagnostic) => diagnostic.reference?.nodeId);

    expect(ownerMissingNodeIds).toEqual([
      'model.analytics.orders',
      'source.analytics.raw.orders',
    ]);
  });

  it('only emits owner-invalid diagnostics for ownership targets', () => {
    const resolutions = [
      createResourceResolution({
        id: 'model.analytics.orders',
        resourceType: 'model',
        layer: 'marts',
        domain: 'finance',
        owner: 42,
        originalFilePath: 'models/marts/orders.sql',
      }),
      createResourceResolution({
        id: 'test.analytics.not_null_orders_order_id',
        resourceType: 'test',
        layer: 'marts',
        domain: 'finance',
        owner: 42,
        originalFilePath: 'tests/not_null_orders_order_id.sql',
      }),
      createResourceResolution({
        id: 'dbt.project.analytics',
        resourceType: 'project',
        layer: 'marts',
        domain: 'finance',
        owner: 42,
        originalFilePath: 'dbt_project.yml',
      }),
    ];

    const ownerInvalidNodeIds = buildDbtGovernanceDiagnostics(
      createProviderInput({
        metadataResolutions: resolutions,
      }),
    )
      .filter((diagnostic) => diagnostic.code === 'DBT_OWNER_INVALID')
      .map((diagnostic) => diagnostic.reference?.nodeId);

    expect(ownerInvalidNodeIds).toEqual(['model.analytics.orders']);
  });

  it('reports ambiguous interpretation and unsupported profile patterns', () => {
    const ambiguousInput = createResolverInput({
      domain: 'sales',
      layer: 'semantic',
      ownership: {
        team: 'analytics',
        source: 'project-metadata',
      },
      metadata: {
        dbt: {
          identity: {
            uniqueId: 'model.analytics.orders',
          },
          resource: {
            tags: [],
            meta: {
              domain: 'finance',
            },
          },
          relation: {
            originalFilePath: 'models/finance/marts/orders.sql',
          },
          validation: {},
          documentation: {},
        },
      },
    });
    const resolution = resolveDbtGovernanceMetadata(ambiguousInput);
    const ambiguousDomain = resolveDbtDomain(ambiguousInput, {
      domain: {
        fromPath: true,
      },
    });

    const metadataResolution: DbtGovernanceMetadataResolution = {
      ...resolution,
      domain: ambiguousDomain,
    };
    const diagnostics = buildDbtGovernanceDiagnostics(
      createProviderInput({
        profile: createProfile({
          layers: ['staging', 'intermediate'],
        }),
        metadataResolutions: [metadataResolution],
      }),
    );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'DBT_GOVERNANCE_PROFILE_INVALID',
      'DBT_GOVERNANCE_PROFILE_INVALID',
    ]);
    expect(diagnostics[0]).toMatchObject({
      details: {
        field: 'domain',
        values: expect.arrayContaining(['finance', 'sales']),
        profileName: 'dbt',
      },
    });
    expect(diagnostics[1]).toMatchObject({
      details: {
        field: 'layer',
        value: 'semantic',
        profileLayers: ['staging', 'intermediate'],
      },
    });
  });

  it('derives resolver output from normalized dbt workspace projects when none is provided', async () => {
    const workspace = createWorkspace([
      {
        id: 'model.analytics.orders',
        name: 'orders',
        root: 'models',
        type: 'library',
        tags: ['published'],
        metadata: {
          dbt: {
            identity: {
              uniqueId: 'model.analytics.orders',
            },
            resource: {
              tags: ['published'],
              meta: {},
            },
            relation: {
              originalFilePath: 'models/marts/orders.sql',
            },
            validation: {},
            documentation: {},
          },
        },
      },
    ]);

    const diagnostics =
      await dbtGovernanceDiagnosticsProvider.provideDiagnostics(
        createProviderInput({
          workspace,
          context: createContext(workspace),
        }),
      );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'DBT_DOMAIN_UNRESOLVED',
      'DBT_OWNER_MISSING',
      'DBT_RULE_SKIPPED_MISSING_METADATA',
    ]);
    expect(diagnostics[0]?.details).toMatchObject({
      governanceNodeId: 'model.analytics.orders',
      dbtUniqueId: 'model.analytics.orders',
    });
  });
});
