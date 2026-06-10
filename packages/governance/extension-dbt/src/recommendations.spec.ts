import {
  DefaultGovernanceCapabilityRegistry,
  type GovernanceDiagnostic,
  type GovernanceExtensionHostContext,
  type GovernanceProfile,
  type GovernanceSignal,
  type Measurement,
  type GovernanceWorkspace,
  type Violation,
} from '@anarchitects/governance-core';

import {
  buildDbtGovernanceRecommendations,
  dbtGovernanceRecommendationProvider,
  resolveDbtGovernanceMetadata,
  type DbtGovernanceRecommendationProviderInput,
} from './index.js';
import {
  createCompatibilityWorkspace,
  type LegacyWorkspaceOwnership,
} from './test-workspace.js';

describe('dbt governance recommendations', () => {
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

  function createRecommendationInput(
    workspace: GovernanceWorkspace,
    overrides: Partial<DbtGovernanceRecommendationProviderInput> = {},
  ): DbtGovernanceRecommendationProviderInput {
    return {
      workspace,
      profile: overrides.profile ?? createProfile(),
      context: overrides.context ?? createContext(workspace),
      diagnostics: overrides.diagnostics ?? [],
      signals: overrides.signals ?? [],
      violations: overrides.violations ?? [],
      measurements: overrides.measurements ?? [],
      recommendations: overrides.recommendations ?? [],
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
    publicInterface?: boolean;
    description?: boolean;
    tests?: boolean;
    contract?: boolean;
    criticality?: string;
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
            resourceType: 'model',
          },
          resource: {
            tags: options.publicInterface ? ['public'] : [],
            meta: {
              ...(options.layer ? { layer: options.layer } : {}),
              ...(options.domain ? { domain: options.domain } : {}),
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

  function createResolution(project: TestWorkspaceProject) {
    return resolveDbtGovernanceMetadata({
      id: project.id,
      name: project.name,
      root: project.root,
      tags: project.tags,
      domain: project.domain,
      layer: project.layer,
      ownership: project.ownership,
      metadata: project.metadata,
    });
  }

  function createDiagnostic(options: {
    id: string;
    code: string;
    nodeId: string;
    severity?: 'warning' | 'error' | 'info';
  }): GovernanceDiagnostic {
    return {
      id: options.id,
      code: options.code,
      message: options.code,
      severity: options.severity ?? 'warning',
      kind: 'warning',
      category: 'configuration',
      source: 'governance.dbt_extension',
      reference: {
        nodeId: options.nodeId,
      },
    };
  }

  function createSignal(options: {
    id: string;
    code: string;
    nodeId?: string;
    sourceNodeId?: string;
    targetNodeId?: string;
    relatedNodeIds?: string[];
    relationId?: string;
    dependencyKey?: string;
    dbtUniqueId?: string;
  }): GovernanceSignal {
    const sourceNodeId = options.nodeId ?? options.sourceNodeId;
    const targetNodeId = options.targetNodeId;

    return {
      id: options.id,
      type: options.code,
      ...(sourceNodeId ? { nodeId: sourceNodeId } : {}),
      ...(options.relationId ? { relationId: options.relationId } : {}),
      relatedNodeIds:
        options.relatedNodeIds ??
        [sourceNodeId, targetNodeId].filter((value): value is string =>
          Boolean(value),
        ),
      severity: 'warning',
      category: 'boundary',
      message: options.code,
      metadata: {
        code: options.code,
        ...(options.dbtUniqueId ? { dbtUniqueId: options.dbtUniqueId } : {}),
        ...(options.dependencyKey
          ? { dependencyKey: options.dependencyKey }
          : {}),
      },
      source: 'extension',
      createdAt: '1970-01-01T00:00:00.000Z',
    };
  }

  function createViolation(options: {
    id: string;
    ruleId: string;
    nodeId: string;
    targetNodeId?: string;
    relationId?: string;
  }): Violation {
    return {
      id: options.id,
      ruleId: options.ruleId,
      subjectId: options.relationId ?? options.nodeId,
      severity: 'error',
      category: 'boundary',
      message: options.ruleId,
      reference: {
        nodeId: options.nodeId,
        ...(options.relationId ? { relationId: options.relationId } : {}),
        ...(options.targetNodeId
          ? { relatedNodeIds: [options.nodeId, options.targetNodeId] }
          : {}),
      },
    };
  }

  function createMeasurement(options: {
    id: string;
    countedNodeIds?: string[];
  }): Measurement {
    return {
      id: options.id,
      name: options.id,
      family: 'architecture',
      value: options.countedNodeIds?.length ?? 0,
      score: options.countedNodeIds?.length ?? 0,
      maxScore: options.countedNodeIds?.length ?? 0,
      unit: 'count',
      metadata: {
        countedNodeIds: options.countedNodeIds ?? [],
      },
    };
  }

  function findRecommendation(
    recommendations: ReturnType<typeof buildDbtGovernanceRecommendations>,
    code: string,
  ) {
    return recommendations.find(
      (recommendation) => recommendation.metadata?.code === code,
    );
  }

  it('emits ADD_OWNER and deduplicates evidence from diagnostics, signals, and rule violations', async () => {
    const project = createProject({
      id: 'model.analytics.orders',
      layer: 'marts',
      domain: 'finance',
      criticality: 'high',
    });
    const workspace = createWorkspace([project]);

    const recommendations =
      await dbtGovernanceRecommendationProvider.provideRecommendations(
        createRecommendationInput(workspace, {
          metadataResolutions: [createResolution(project)],
          diagnostics: [
            createDiagnostic({
              id: 'diag-owner',
              code: 'DBT_OWNER_MISSING',
              nodeId: project.id,
            }),
          ],
          signals: [
            createSignal({
              id: 'signal-owner',
              code: 'DBT_OWNER_MISSING',
              nodeId: project.id,
              dbtUniqueId: project.id,
            }),
          ],
          violations: [
            createViolation({
              id: 'violation-owner',
              ruleId: 'dbt/critical-models-require-owner',
              nodeId: project.id,
            }),
          ],
        }),
      );

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      title: 'Add dbt owner metadata',
      priority: 'high',
      reference: {
        nodeId: project.id,
      },
      metadata: {
        code: 'ADD_OWNER',
        triggerDiagnosticIds: ['diag-owner'],
        triggerSignalIds: ['signal-owner'],
        triggerViolationIds: ['violation-owner'],
      },
    });
  });

  it('emits ADD_DESCRIPTION from missing-description findings', () => {
    const project = createProject({
      id: 'model.analytics.public_orders',
      layer: 'marts',
      domain: 'finance',
      publicInterface: true,
    });
    const workspace = createWorkspace([project]);

    const recommendations = buildDbtGovernanceRecommendations(
      createRecommendationInput(workspace, {
        metadataResolutions: [createResolution(project)],
        signals: [
          createSignal({
            id: 'signal-description',
            code: 'DBT_PUBLIC_MODEL_UNDOCUMENTED_CANDIDATE',
            nodeId: project.id,
            dbtUniqueId: project.id,
          }),
        ],
      }),
    );

    expect(
      findRecommendation(recommendations, 'ADD_DESCRIPTION'),
    ).toMatchObject({
      title: 'Add dbt model description',
      priority: 'high',
      metadata: expect.objectContaining({
        code: 'ADD_DESCRIPTION',
      }),
    });
  });

  it('emits ADD_TESTS from missing-tests findings', () => {
    const project = createProject({
      id: 'model.analytics.critical_orders',
      layer: 'marts',
      domain: 'finance',
      criticality: 'high',
    });
    const workspace = createWorkspace([project]);

    const recommendations = buildDbtGovernanceRecommendations(
      createRecommendationInput(workspace, {
        metadataResolutions: [createResolution(project)],
        violations: [
          createViolation({
            id: 'violation-tests',
            ruleId: 'dbt/critical-models-require-tests',
            nodeId: project.id,
          }),
        ],
      }),
    );

    expect(findRecommendation(recommendations, 'ADD_TESTS')).toMatchObject({
      title: 'Add dbt tests',
      priority: 'high',
      metadata: expect.objectContaining({
        code: 'ADD_TESTS',
      }),
    });
  });

  it('emits ENABLE_CONTRACT for governed models without contracts', () => {
    const project = createProject({
      id: 'model.analytics.governed_orders',
      layer: 'marts',
      domain: 'finance',
      publicInterface: true,
    });
    const workspace = createWorkspace([project]);

    const recommendations = buildDbtGovernanceRecommendations(
      createRecommendationInput(workspace, {
        metadataResolutions: [createResolution(project)],
        signals: [
          createSignal({
            id: 'signal-contract',
            code: 'DBT_CONTRACT_MISSING_FOR_PUBLIC_MODEL_CANDIDATE',
            nodeId: project.id,
            dbtUniqueId: project.id,
          }),
        ],
      }),
    );

    expect(
      findRecommendation(recommendations, 'ENABLE_CONTRACT'),
    ).toMatchObject({
      title: 'Enable dbt contract',
      metadata: expect.objectContaining({
        code: 'ENABLE_CONTRACT',
      }),
    });
  });

  it('emits REVIEW_CROSS_DOMAIN_DEPENDENCY for cross-domain dependencies', () => {
    const source = createProject({
      id: 'model.analytics.orders_mart',
      layer: 'marts',
      domain: 'sales',
    });
    const target = createProject({
      id: 'model.analytics.orders_intermediate',
      layer: 'intermediate',
      domain: 'finance',
    });
    const workspace = createWorkspace([source, target]);
    const relationId = `dbt:lineage:${source.id}->${target.id}`;

    const recommendations = buildDbtGovernanceRecommendations(
      createRecommendationInput(workspace, {
        metadataResolutions: [
          createResolution(source),
          createResolution(target),
        ],
        violations: [
          createViolation({
            id: 'violation-cross-domain',
            ruleId: 'dbt/cross-domain-dependencies-require-approval',
            nodeId: source.id,
            targetNodeId: target.id,
            relationId,
          }),
        ],
      }),
    );

    expect(
      findRecommendation(recommendations, 'REVIEW_CROSS_DOMAIN_DEPENDENCY'),
    ).toMatchObject({
      title: 'Review cross-domain dbt dependency',
      priority: 'high',
      reference: expect.objectContaining({
        relationId,
        nodeId: source.id,
        relatedNodeIds: expect.arrayContaining([source.id, target.id]),
      }),
      metadata: expect.objectContaining({
        code: 'REVIEW_CROSS_DOMAIN_DEPENDENCY',
      }),
    });
  });

  it('emits REDUCE_HIGH_FAN_IN from hotspot signals and metric linkage', () => {
    const project = createProject({
      id: 'model.analytics.customer_hub',
      layer: 'intermediate',
      domain: 'finance',
    });
    const workspace = createWorkspace([project]);

    const recommendations = buildDbtGovernanceRecommendations(
      createRecommendationInput(workspace, {
        metadataResolutions: [createResolution(project)],
        signals: [
          createSignal({
            id: 'signal-fan-in',
            code: 'DBT_HIGH_FAN_IN',
            nodeId: project.id,
            dbtUniqueId: project.id,
          }),
        ],
        measurements: [
          createMeasurement({
            id: 'dbt-hotspot-count',
            countedNodeIds: [project.id],
          }),
        ],
      }),
    );

    expect(
      findRecommendation(recommendations, 'REDUCE_HIGH_FAN_IN'),
    ).toMatchObject({
      title: 'Reduce dbt fan-in',
      signalIds: ['signal-fan-in'],
      metadata: expect.objectContaining({
        code: 'REDUCE_HIGH_FAN_IN',
        triggerSignalIds: ['signal-fan-in'],
      }),
    });
  });

  it('emits FIX_LAYER_DEPENDENCY for disallowed layer dependencies', () => {
    const source = createProject({
      id: 'model.analytics.orders_staging',
      layer: 'staging',
      domain: 'finance',
    });
    const target = createProject({
      id: 'model.analytics.orders_intermediate',
      layer: 'intermediate',
      domain: 'finance',
    });
    const workspace = createWorkspace([source, target]);
    const relationId = `dbt:lineage:${source.id}->${target.id}`;

    const recommendations = buildDbtGovernanceRecommendations(
      createRecommendationInput(workspace, {
        metadataResolutions: [
          createResolution(source),
          createResolution(target),
        ],
        signals: [
          createSignal({
            id: 'signal-layer',
            code: 'DBT_LAYER_BYPASS_CANDIDATE',
            sourceNodeId: source.id,
            targetNodeId: target.id,
            relatedNodeIds: [source.id, target.id],
            relationId,
            dependencyKey: `${source.id}->${target.id}`,
            dbtUniqueId: source.id,
          }),
        ],
        violations: [
          createViolation({
            id: 'violation-layer',
            ruleId: 'dbt/no-disallowed-layer-dependency',
            nodeId: source.id,
            targetNodeId: target.id,
            relationId,
          }),
        ],
      }),
    );

    expect(
      findRecommendation(recommendations, 'FIX_LAYER_DEPENDENCY'),
    ).toMatchObject({
      title: 'Fix dbt layer dependency',
      priority: 'high',
      reference: expect.objectContaining({
        relationId,
      }),
      metadata: expect.objectContaining({
        code: 'FIX_LAYER_DEPENDENCY',
        triggerSignalIds: ['signal-layer'],
        triggerViolationIds: ['violation-layer'],
      }),
    });
  });

  it('returns no recommendations for empty normalized input', () => {
    const workspace = createWorkspace([]);

    const recommendations = buildDbtGovernanceRecommendations(
      createRecommendationInput(workspace),
    );

    expect(recommendations).toEqual([]);
  });
});
