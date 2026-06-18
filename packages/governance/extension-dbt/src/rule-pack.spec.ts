import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  DefaultGovernanceCapabilityRegistry,
  type GovernanceExtensionHostContext,
  type GovernanceProfile,
  type GovernanceWorkspace,
} from '@anarchitects/governance-core';

import {
  buildDbtGovernanceDiagnostics,
  dbtArchitectureBasicRulePack,
  evaluateDbtArchitectureViolations,
  getDbtResolutionResourceType,
  isDbtContractTarget,
  isDbtDagShapeTarget,
  isDbtDocumentationTarget,
  isDbtOwnershipTarget,
  isDbtPublicModelDocumentationTarget,
  isDbtTestCoverageTarget,
  isDbtWorkspaceContextResource,
  type DbtGovernanceMetadataResolution,
  type DbtGovernanceRulePackInput,
} from './index.js';
import {
  createCompatibilityWorkspace,
  type LegacyWorkspaceOwnership,
} from './test-workspace.js';

describe('dbt architecture basic rule pack', () => {
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

  function createInput(
    workspace: GovernanceWorkspace,
    overrides: Partial<DbtGovernanceRulePackInput> = {},
  ): DbtGovernanceRulePackInput {
    return {
      workspace,
      profile: overrides.profile ?? createProfile(),
      context: overrides.context ?? createContext(workspace),
      ...(overrides.diagnostics ? { diagnostics: overrides.diagnostics } : {}),
      ...(overrides.signals ? { signals: overrides.signals } : {}),
      ...(overrides.metadataResolutions
        ? { metadataResolutions: overrides.metadataResolutions }
        : {}),
    };
  }

  function createProject(options: {
    id: string;
    resourceType?: 'model' | 'source' | 'seed' | 'test' | 'project';
    layer?: string;
    domain?: string;
    owner?: string;
    criticality?: string;
    publicInterface?: boolean;
    description?: boolean;
    tests?: boolean;
    contract?: boolean;
  }): TestWorkspaceProject {
    return {
      id: options.id,
      name: options.id,
      root: `models/${options.id.replaceAll('.', '/')}`,
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
            resourceType:
              options.resourceType ?? inferResourceTypeFromId(options.id),
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
            ...((options.resourceType ??
              inferResourceTypeFromId(options.id)) !== 'test'
              ? {
                  materialization: 'table',
                }
              : {}),
          },
          relation: {
            originalFilePath: `models/${options.layer ?? 'unknown'}/${options.id.split('.').at(-1)}.sql`,
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

  function inferResourceTypeFromId(
    id: string,
  ): 'model' | 'source' | 'seed' | 'test' | 'project' {
    if (id.startsWith('source.')) {
      return 'source';
    }

    if (id.startsWith('seed.')) {
      return 'seed';
    }

    if (id.startsWith('test.')) {
      return 'test';
    }

    if (id.startsWith('dbt.project.')) {
      return 'project';
    }

    return 'model';
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

  it('allows configured layer dependencies', async () => {
    const workspace = createWorkspace(
      [
        createProject({
          id: 'model.analytics.orders_intermediate',
          layer: 'intermediate',
          domain: 'finance',
          owner: 'finance-platform',
          description: true,
          tests: true,
        }),
        createProject({
          id: 'model.analytics.orders_staging',
          layer: 'staging',
          domain: 'finance',
          owner: 'finance-platform',
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
      ],
    );
    const profile = createProfile({
      rules: {
        'dbt/no-disallowed-layer-dependency': {
          options: {
            allowedUpstreamByLayer: {
              intermediate: ['staging'],
            },
          },
        },
      },
    });

    const violations = await dbtArchitectureBasicRulePack.evaluate(
      createInput(workspace, { profile }),
    );

    expect(violations).toEqual([]);
  });

  it('flags disallowed layer dependencies', () => {
    const workspace = createWorkspace(
      [
        createProject({
          id: 'model.analytics.orders_staging',
          layer: 'staging',
          domain: 'finance',
          owner: 'finance-platform',
          description: true,
          tests: true,
        }),
        createProject({
          id: 'model.analytics.orders_intermediate',
          layer: 'intermediate',
          domain: 'finance',
          owner: 'finance-platform',
          description: true,
          tests: true,
        }),
      ],
      [
        {
          source: 'model.analytics.orders_staging',
          target: 'model.analytics.orders_intermediate',
          type: 'static',
        },
      ],
    );

    const violations = evaluateDbtArchitectureViolations(
      createInput(workspace),
    );

    expect(violations).toEqual([
      expect.objectContaining({
        ruleId: 'dbt/no-disallowed-layer-dependency',
        severity: 'error',
        category: 'boundary',
      }),
    ]);
  });

  it('flags mart-to-mart dependencies', () => {
    const workspace = createWorkspace(
      [
        createProject({
          id: 'model.analytics.orders_mart',
          layer: 'marts',
          domain: 'finance',
          owner: 'finance-platform',
        }),
        createProject({
          id: 'model.analytics.customers_mart',
          layer: 'marts',
          domain: 'finance',
          owner: 'finance-platform',
        }),
      ],
      [
        {
          source: 'model.analytics.orders_mart',
          target: 'model.analytics.customers_mart',
          type: 'static',
        },
      ],
    );

    expect(evaluateDbtArchitectureViolations(createInput(workspace))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'dbt/no-mart-to-mart-dependency',
        }),
      ]),
    );
  });

  it('flags critical models without valid owners', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'model.analytics.critical_orders',
        layer: 'marts',
        domain: 'finance',
        criticality: 'high',
        tests: true,
      }),
    ]);

    expect(evaluateDbtArchitectureViolations(createInput(workspace))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'dbt/critical-models-require-owner',
          category: 'ownership',
        }),
      ]),
    );
  });

  it('does not flag critical dbt test, project, or seed nodes for missing owners', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'test.analytics.not_null_critical_orders_order_id',
        resourceType: 'test',
        layer: 'marts',
        domain: 'finance',
        criticality: 'high',
      }),
      createProject({
        id: 'dbt.project.analytics',
        resourceType: 'project',
        layer: 'marts',
        domain: 'finance',
        criticality: 'high',
      }),
      createProject({
        id: 'seed.analytics.calendar',
        resourceType: 'seed',
        layer: 'staging',
        domain: 'finance',
        criticality: 'high',
      }),
    ]);

    expect(
      evaluateDbtArchitectureViolations(createInput(workspace)).some(
        (violation) => violation.ruleId === 'dbt/critical-models-require-owner',
      ),
    ).toBe(false);
  });

  it('flags public models without descriptions', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'model.analytics.public_orders',
        layer: 'marts',
        domain: 'finance',
        owner: 'finance-platform',
        publicInterface: true,
        description: false,
      }),
    ]);

    expect(evaluateDbtArchitectureViolations(createInput(workspace))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'dbt/public-models-require-description',
          category: 'documentation',
        }),
      ]),
    );
  });

  it('centralizes dbt documentation applicability with explicit type precedence and legacy id fallback', () => {
    const explicitTestResolution = createResolution({
      governanceNodeId: 'model.valid_project.orders_but_test',
      dbtUniqueId: 'model.valid_project.orders_but_test',
      resourceType: 'test',
    });
    const explicitModelResolution = createResolution({
      governanceNodeId: 'test.valid_project.orders_but_model',
      dbtUniqueId: 'test.valid_project.orders_but_model',
      resourceType: 'model',
    });
    const legacyTestResolution = createResolution({
      governanceNodeId: 'test.valid_project.legacy_test',
      dbtUniqueId: 'test.valid_project.legacy_test',
    });

    expect(getDbtResolutionResourceType(explicitTestResolution)).toBe('test');
    expect(isDbtDocumentationTarget(explicitTestResolution)).toBe(false);
    expect(isDbtPublicModelDocumentationTarget(explicitTestResolution)).toBe(
      false,
    );
    expect(getDbtResolutionResourceType(explicitModelResolution)).toBe('model');
    expect(isDbtPublicModelDocumentationTarget(explicitModelResolution)).toBe(
      true,
    );
    expect(getDbtResolutionResourceType(legacyTestResolution)).toBe('test');
    expect(isDbtDocumentationTarget(legacyTestResolution)).toBe(false);
  });

  it('centralizes dbt ownership, workspace-context, contract, and dag-shape applicability', () => {
    const modelResolution = createResolution({
      governanceNodeId: 'model.valid_project.orders',
      dbtUniqueId: 'model.valid_project.orders',
      resourceType: 'model',
    });
    const sourceResolution = createResolution({
      governanceNodeId: 'source.valid_project.raw.orders',
      dbtUniqueId: 'source.valid_project.raw.orders',
      resourceType: 'source',
    });
    const projectResolution = createResolution({
      governanceNodeId: 'dbt.project.valid_project',
      dbtUniqueId: 'dbt.project.valid_project',
      resourceType: 'project',
    });
    const testResolution = createResolution({
      governanceNodeId: 'test.valid_project.orders',
      dbtUniqueId: 'test.valid_project.orders',
      resourceType: 'test',
    });
    const seedResolution = createResolution({
      governanceNodeId: 'seed.valid_project.calendar',
      dbtUniqueId: 'seed.valid_project.calendar',
      resourceType: 'seed',
    });

    expect(isDbtOwnershipTarget(modelResolution)).toBe(true);
    expect(isDbtOwnershipTarget(sourceResolution)).toBe(true);
    expect(isDbtOwnershipTarget(projectResolution)).toBe(false);
    expect(isDbtOwnershipTarget(testResolution)).toBe(false);
    expect(isDbtOwnershipTarget(seedResolution)).toBe(false);

    expect(isDbtWorkspaceContextResource(projectResolution)).toBe(true);
    expect(isDbtWorkspaceContextResource(modelResolution)).toBe(false);

    expect(isDbtContractTarget(modelResolution)).toBe(true);
    expect(isDbtContractTarget(sourceResolution)).toBe(false);
    expect(isDbtContractTarget(projectResolution)).toBe(false);
    expect(isDbtContractTarget(testResolution)).toBe(false);

    expect(isDbtDagShapeTarget(modelResolution)).toBe(true);
    expect(isDbtDagShapeTarget(sourceResolution)).toBe(true);
    expect(isDbtDagShapeTarget(seedResolution)).toBe(true);
    expect(isDbtDagShapeTarget(projectResolution)).toBe(false);
    expect(isDbtDagShapeTarget(testResolution)).toBe(false);
  });

  it('centralizes dbt test coverage applicability for eligible and ineligible resource types', () => {
    expect(
      isDbtTestCoverageTarget(
        createResolution({
          governanceNodeId: 'model.valid_project.orders',
          dbtUniqueId: 'model.valid_project.orders',
          resourceType: 'model',
        }),
      ),
    ).toBe(true);
    expect(
      isDbtTestCoverageTarget(
        createResolution({
          governanceNodeId: 'source.valid_project.raw.orders',
          dbtUniqueId: 'source.valid_project.raw.orders',
          resourceType: 'source',
        }),
      ),
    ).toBe(true);
    expect(
      isDbtTestCoverageTarget(
        createResolution({
          governanceNodeId: 'dbt.project.valid_project',
          dbtUniqueId: 'dbt.project.valid_project',
          resourceType: 'project',
        }),
      ),
    ).toBe(false);
    expect(
      isDbtTestCoverageTarget(
        createResolution({
          governanceNodeId: 'test.valid_project.orders',
          dbtUniqueId: 'test.valid_project.orders',
          resourceType: 'test',
        }),
      ),
    ).toBe(false);
    expect(
      isDbtTestCoverageTarget(
        createResolution({
          governanceNodeId: 'seed.valid_project.calendar',
          dbtUniqueId: 'seed.valid_project.calendar',
          resourceType: 'seed',
        }),
      ),
    ).toBe(false);
  });

  it('does not flag documented public models', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'model.analytics.documented_public_orders',
        layer: 'marts',
        domain: 'finance',
        owner: 'finance-platform',
        publicInterface: true,
        description: true,
      }),
    ]);

    expect(
      evaluateDbtArchitectureViolations(createInput(workspace)).some(
        (violation) =>
          violation.ruleId === 'dbt/public-models-require-description',
      ),
    ).toBe(false);
  });

  it('uses explicit test resource types over model-like ids for documentation rules', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'model.analytics.public_orders_but_test',
        resourceType: 'test',
        publicInterface: true,
        description: false,
      }),
    ]);

    expect(
      evaluateDbtArchitectureViolations(createInput(workspace)).some(
        (violation) =>
          violation.ruleId === 'dbt/public-models-require-description',
      ),
    ).toBe(false);
  });

  it('uses explicit model resource types over legacy test-id prefixes for documentation rules', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'test.analytics.public_orders_but_model',
        resourceType: 'model',
        layer: 'marts',
        domain: 'finance',
        owner: 'finance-platform',
        publicInterface: true,
        description: false,
      }),
    ]);

    expect(evaluateDbtArchitectureViolations(createInput(workspace))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'dbt/public-models-require-description',
          subjectId: 'test.analytics.public_orders_but_model',
        }),
      ]),
    );
  });

  it('does not flag dbt test nodes for missing descriptions', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'test.analytics.not_null_public_orders_order_id',
        resourceType: 'test',
        publicInterface: true,
        description: false,
      }),
    ]);

    expect(
      evaluateDbtArchitectureViolations(createInput(workspace)).some(
        (violation) =>
          violation.ruleId === 'dbt/public-models-require-description' &&
          violation.subjectId ===
            'test.analytics.not_null_public_orders_order_id',
      ),
    ).toBe(false);
  });

  it('falls back to legacy test id prefixes when explicit resource type is absent', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'test.analytics.legacy_public_orders',
        layer: 'marts',
        domain: 'finance',
        owner: 'finance-platform',
        publicInterface: true,
        description: false,
      }),
    ]);

    expect(
      evaluateDbtArchitectureViolations(createInput(workspace)).some(
        (violation) =>
          violation.ruleId === 'dbt/public-models-require-description',
      ),
    ).toBe(false);
  });

  it('flags critical models without tests', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'model.analytics.critical_without_tests',
        layer: 'marts',
        domain: 'finance',
        owner: 'finance-platform',
        criticality: 'critical',
        tests: false,
      }),
    ]);

    expect(evaluateDbtArchitectureViolations(createInput(workspace))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'dbt/critical-models-require-tests',
        }),
      ]),
    );
  });

  it('keeps direct dbt validation metadata authoritative for critical model tests', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'model.analytics.critical_with_direct_tests',
        layer: 'marts',
        domain: 'finance',
        owner: 'finance-platform',
        criticality: 'critical',
        tests: true,
      }),
    ]);

    expect(
      evaluateDbtArchitectureViolations(createInput(workspace)).some(
        (violation) => violation.ruleId === 'dbt/critical-models-require-tests',
      ),
    ).toBe(false);
  });

  it('treats critical models with dependent generic dbt test nodes as tested', () => {
    const workspace = createWorkspace(
      [
        createProject({
          id: 'model.analytics.critical_with_generic_test',
          layer: 'marts',
          domain: 'finance',
          owner: 'finance-platform',
          criticality: 'critical',
          tests: false,
        }),
        createProject({
          id: 'test.analytics.not_null_critical_with_generic_test',
          resourceType: 'test',
        }),
      ],
      [
        {
          source: 'test.analytics.not_null_critical_with_generic_test',
          target: 'model.analytics.critical_with_generic_test',
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

    expect(
      evaluateDbtArchitectureViolations(createInput(workspace)).some(
        (violation) => violation.ruleId === 'dbt/critical-models-require-tests',
      ),
    ).toBe(false);
  });

  it('treats critical models with dependent relationship dbt test nodes as tested', () => {
    const workspace = createWorkspace(
      [
        createProject({
          id: 'model.analytics.critical_with_relationship_test',
          layer: 'marts',
          domain: 'finance',
          owner: 'finance-platform',
          criticality: 'critical',
          tests: false,
        }),
        createProject({
          id: 'source.analytics.raw.orders',
          resourceType: 'source',
          layer: 'staging',
          domain: 'finance',
        }),
        createProject({
          id: 'test.analytics.relationships_critical_with_relationship_test',
          resourceType: 'test',
        }),
      ],
      [
        {
          source:
            'test.analytics.relationships_critical_with_relationship_test',
          target: 'model.analytics.critical_with_relationship_test',
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
          source:
            'test.analytics.relationships_critical_with_relationship_test',
          target: 'source.analytics.raw.orders',
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

    expect(
      evaluateDbtArchitectureViolations(createInput(workspace)).some(
        (violation) => violation.ruleId === 'dbt/critical-models-require-tests',
      ),
    ).toBe(false);
  });

  it('does not treat dbt test nodes as tested assets that require their own tests', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'test.analytics.not_null_orders_order_id',
        resourceType: 'test',
        tests: false,
      }),
    ]);

    expect(
      evaluateDbtArchitectureViolations(createInput(workspace)).some(
        (violation) =>
          violation.subjectId === 'test.analytics.not_null_orders_order_id',
      ),
    ).toBe(false);
  });

  it('does not flag critical dbt project or seed nodes for missing tests', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'dbt.project.analytics',
        resourceType: 'project',
        layer: 'marts',
        domain: 'finance',
        criticality: 'critical',
        tests: false,
      }),
      createProject({
        id: 'seed.analytics.calendar',
        resourceType: 'seed',
        layer: 'staging',
        domain: 'finance',
        criticality: 'critical',
        tests: false,
      }),
    ]);

    expect(
      evaluateDbtArchitectureViolations(createInput(workspace)).some(
        (violation) => violation.ruleId === 'dbt/critical-models-require-tests',
      ),
    ).toBe(false);
  });

  it('does not keep a local dbt test-prefix helper in rule-pack.ts', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./rule-pack.ts', import.meta.url)),
      'utf8',
    );

    expect(source).not.toContain('function isDbtTestResolution(');
    expect(source).not.toContain("startsWith('test.')");
  });

  it('flags public models without contracts', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'model.analytics.public_without_contract',
        layer: 'marts',
        domain: 'finance',
        owner: 'finance-platform',
        publicInterface: true,
        description: true,
        contract: false,
      }),
    ]);

    expect(evaluateDbtArchitectureViolations(createInput(workspace))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'dbt/public-models-require-contract',
        }),
      ]),
    );
  });

  it('does not flag public dbt source, project, or test nodes without contracts', () => {
    const workspace = createWorkspace([
      createProject({
        id: 'source.analytics.raw.orders',
        resourceType: 'source',
        layer: 'staging',
        domain: 'finance',
        owner: 'finance-platform',
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
      createProject({
        id: 'test.analytics.not_null_public_orders_order_id',
        resourceType: 'test',
        layer: 'marts',
        domain: 'finance',
        publicInterface: true,
        contract: false,
      }),
    ]);

    expect(
      evaluateDbtArchitectureViolations(createInput(workspace)).some(
        (violation) =>
          violation.ruleId === 'dbt/public-models-require-contract',
      ),
    ).toBe(false);
  });

  it('flags cross-domain dependencies without approval metadata', () => {
    const workspace = createWorkspace(
      [
        createProject({
          id: 'model.analytics.finance_orders',
          layer: 'marts',
          domain: 'finance',
          owner: 'finance-platform',
        }),
        createProject({
          id: 'model.analytics.sales_orders',
          layer: 'intermediate',
          domain: 'sales',
          owner: 'sales-platform',
        }),
      ],
      [
        {
          source: 'model.analytics.finance_orders',
          target: 'model.analytics.sales_orders',
          type: 'static',
          metadata: {
            dbt: {
              lineage: {
                dependencyKind: 'ref',
              },
            },
          },
        },
      ],
    );

    expect(evaluateDbtArchitectureViolations(createInput(workspace))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'dbt/cross-domain-dependencies-require-approval',
        }),
      ]),
    );
  });

  it('skips metadata-dependent rules when layer metadata is unresolved and diagnostics explain why', () => {
    const workspace = createWorkspace(
      [
        createProject({
          id: 'model.analytics.unknown_layer_source',
          domain: 'finance',
          owner: 'finance-platform',
        }),
        createProject({
          id: 'model.analytics.unknown_layer_target',
          domain: 'finance',
          owner: 'finance-platform',
          layer: 'staging',
        }),
      ],
      [
        {
          source: 'model.analytics.unknown_layer_source',
          target: 'model.analytics.unknown_layer_target',
          type: 'static',
        },
      ],
    );
    const input = createInput(workspace);

    const violations = evaluateDbtArchitectureViolations(input);
    const diagnostics = buildDbtGovernanceDiagnostics({
      workspace: input.workspace,
      profile: input.profile,
      context: input.context,
      violations: [],
      signals: [],
      measurements: [],
      diagnostics: [],
    });

    expect(
      violations.some(
        (violation) =>
          violation.ruleId === 'dbt/no-disallowed-layer-dependency',
      ),
    ).toBe(false);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DBT_RULE_SKIPPED_MISSING_METADATA',
        }),
      ]),
    );
  });
});
