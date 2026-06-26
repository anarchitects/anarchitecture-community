import {
  coreBuiltInRulePack,
  documentationGapRule,
  domainBoundaryRule,
  evaluateRulePack,
  layerBoundaryRule,
  missingDomainRule,
  missingLayerRule,
  ownershipPresenceRule,
  projectNameConventionRule,
  tagConventionRule,
  type GovernanceNode,
  type GovernanceProfile,
  type GovernanceRelation,
  type GovernanceRuleResult,
  type GovernanceWorkspace,
} from '../index.js';

describe('Core built-in policy rules', () => {
  const baseProfile: GovernanceProfile = {
    name: 'test-profile',
    layers: ['app', 'feature', 'ui', 'data-access', 'util'],
    allowedDomainDependencies: {
      '*': [],
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
    metrics: {} as GovernanceProfile['metrics'],
  };

  const baseNodes: GovernanceNode[] = [
    {
      id: 'booking-feature',
      name: 'booking-feature',
      kind: 'library',
      root: 'libs/booking/feature',
      classification: {
        domain: 'booking',
        layer: 'feature',
      },
      tags: ['domain:booking', 'layer:feature'],
      ownership: {
        team: 'booking-team',
        source: 'project-metadata',
      },
      metadata: {
        documentation: true,
      },
    },
    {
      id: 'payments-ui',
      name: 'payments-ui',
      kind: 'library',
      root: 'libs/payments/ui',
      classification: {
        domain: 'payments',
        layer: 'ui',
      },
      tags: ['domain:payments', 'layer:ui'],
      ownership: {
        team: 'payments-team',
        source: 'project-metadata',
      },
      metadata: {
        documentation: true,
      },
    },
    {
      id: 'shared-data',
      name: 'shared-data',
      kind: 'library',
      root: 'libs/shared/data',
      classification: {
        domain: 'shared',
        layer: 'data-access',
      },
      tags: ['scope:shared'],
      ownership: {
        source: 'none',
      },
      metadata: {
        documentation: true,
      },
    },
  ];

  const baseRelations: GovernanceRelation[] = [
    {
      id: 'relation:booking-feature->payments-ui',
      sourceNodeId: 'booking-feature',
      targetNodeId: 'payments-ui',
      kind: 'dependency',
      metadata: {
        dependencyType: 'static',
      },
    },
  ];

  const baseWorkspace = createWorkspace(baseNodes, baseRelations);

  it('reports a domain violation for disallowed domain dependencies over canonical relations', () => {
    const result = evaluateSync(domainBoundaryRule, {
      workspace: baseWorkspace,
      profile: baseProfile,
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'domain-boundary',
        subjectId: 'booking-feature',
        severity: 'error',
        category: 'boundary',
        reference: {
          relationId: 'relation:booking-feature->payments-ui',
          relatedNodeIds: ['booking-feature', 'payments-ui'],
        },
        details: {
          sourceSubject: 'booking-feature',
          targetSubject: 'payments-ui',
          sourceDomain: 'booking',
          targetDomain: 'payments',
          dependencyType: 'static',
        },
      }),
    ]);
  });

  it('does not report a domain violation for allowed domain dependencies', () => {
    const workspace = createWorkspace(baseNodes, [
      {
        id: 'relation:booking-feature->shared-data',
        sourceNodeId: 'booking-feature',
        targetNodeId: 'shared-data',
        kind: 'dependency',
        metadata: {
          dependencyType: 'static',
        },
      },
    ]);

    const result = evaluateSync(domainBoundaryRule, {
      workspace,
      profile: {
        ...baseProfile,
        allowedDomainDependencies: {
          booking: ['shared'],
          shared: [],
        },
      },
    });

    expect(result.violations).toEqual([]);
  });

  it('reports a layer violation for disallowed layer dependencies over canonical relations', () => {
    const workspace = createWorkspace(baseNodes, [
      {
        id: 'relation:shared-data->booking-feature',
        sourceNodeId: 'shared-data',
        targetNodeId: 'booking-feature',
        kind: 'dependency',
        metadata: {
          dependencyType: 'static',
        },
      },
    ]);

    const result = evaluateSync(layerBoundaryRule, {
      workspace,
      profile: {
        ...baseProfile,
        allowedDomainDependencies: {
          shared: ['booking'],
        },
      },
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'layer-boundary',
        subjectId: 'shared-data',
        severity: 'warning',
        category: 'boundary',
        reference: {
          relationId: 'relation:shared-data->booking-feature',
          relatedNodeIds: ['shared-data', 'booking-feature'],
        },
        details: expect.objectContaining({
          sourceLayer: 'data-access',
          targetLayer: 'feature',
          dependencyType: 'static',
        }),
      }),
    ]);
  });

  it('reports missing ownership on canonical nodes', () => {
    const result = evaluateSync(ownershipPresenceRule, {
      workspace: baseWorkspace,
      profile: baseProfile,
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'ownership-presence',
        subjectId: 'shared-data',
        category: 'ownership',
        message:
          'Node shared-data has no canonical ownership metadata or configuration.',
        recommendation:
          'Add canonical ownership metadata or configuration for the node.',
        reference: {
          nodeId: 'shared-data',
        },
      }),
    ]);
  });

  it('mentions CODEOWNERS only when an ownership capability advertises it', () => {
    const result = evaluateSync(ownershipPresenceRule, {
      workspace: createWorkspace(baseNodes, baseRelations, [
        {
          id: 'capability:ownership',
          data: {
            source: 'codeowners',
          },
        },
      ]),
      profile: baseProfile,
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'ownership-presence',
        subjectId: 'shared-data',
        category: 'ownership',
        message:
          'Node shared-data has no canonical ownership data from the active ownership sources (CODEOWNERS).',
        recommendation:
          'Add canonical ownership metadata or configuration, or ensure an active ownership source covers the node (CODEOWNERS).',
      }),
    ]);
  });

  it('reports documentation gaps on undocumented canonical nodes', () => {
    const workspace = createWorkspace(
      [
        {
          ...baseNodes[0],
          metadata: {},
        },
      ],
      [],
    );

    const result = evaluateSync(documentationGapRule, {
      workspace,
      profile: baseProfile,
    });
    expect(result.violations).toHaveLength(1);
    const violation = (result.violations ?? [])[0]!;

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'documentation-gap',
        subjectId: 'booking-feature',
        severity: 'warning',
        category: 'documentation',
        reference: {
          nodeId: 'booking-feature',
        },
      }),
    ]);
    expect(violation).not.toHaveProperty('projectId');
    expect(violation).not.toHaveProperty('affectedProjects');
  });

  it('does not report documentation gaps for documented canonical nodes', () => {
    const result = evaluateSync(documentationGapRule, {
      workspace: createWorkspace([baseNodes[0]], []),
      profile: baseProfile,
    });

    expect(result.violations).toEqual([]);
  });

  it('supports disabling and severity override for documentation-gap', async () => {
    const workspace = createWorkspace(
      [
        {
          ...baseNodes[0],
          metadata: {},
        },
      ],
      [],
    );

    const disabled = await evaluateRulePack(coreBuiltInRulePack, {
      workspace,
      profile: {
        ...baseProfile,
        rules: {
          'documentation-gap': {
            enabled: false,
          },
        },
      },
    });
    const overridden = await evaluateRulePack(coreBuiltInRulePack, {
      workspace,
      profile: {
        ...baseProfile,
        rules: {
          'documentation-gap': {
            enabled: true,
            severity: 'error',
          },
        },
      },
    });

    expect(
      disabled.violations.some(
        (violation) => violation.ruleId === 'documentation-gap',
      ),
    ).toBe(false);
    expect(
      overridden.violations.find(
        (violation) => violation.ruleId === 'documentation-gap',
      ),
    ).toMatchObject({
      severity: 'error',
    });
  });

  it('evaluates name, tag, missing-domain, and missing-layer rules from canonical node data', async () => {
    const workspace = createWorkspace(
      [
        {
          ...baseNodes[0],
          name: 'BookingFeature',
          tags: ['scope:booking'],
          classification: {
            tags: ['domain:booking', 'bad:Value'],
          },
        },
        {
          ...baseNodes[1],
          classification: {},
        },
        baseNodes[2],
      ],
      baseRelations,
    );

    const result = await evaluateRulePack(coreBuiltInRulePack, {
      workspace,
      profile: {
        ...baseProfile,
        rules: {
          'project-name-convention': {
            enabled: true,
            options: {
              pattern: '^[a-z-]+$',
            },
          },
          'tag-convention': {
            enabled: true,
            options: {
              requiredPrefixes: ['domain'],
              allowedPrefixes: ['domain', 'layer', 'scope'],
              valuePattern: '^[a-z-]+$',
            },
          },
          'missing-domain': {
            enabled: true,
            options: {
              required: true,
            },
          },
          'missing-layer': {
            enabled: true,
            options: {
              required: true,
            },
          },
        },
      },
    });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: projectNameConventionRule.id,
          reference: { nodeId: 'booking-feature' },
        }),
        expect.objectContaining({
          ruleId: tagConventionRule.id,
          reference: { nodeId: 'booking-feature' },
        }),
        expect.objectContaining({
          ruleId: missingDomainRule.id,
          reference: { nodeId: 'payments-ui' },
        }),
        expect.objectContaining({
          ruleId: missingLayerRule.id,
          reference: { nodeId: 'payments-ui' },
        }),
      ]),
    );
  });

  it('scopes node-level governance rules to project-like nodes', async () => {
    const workspace = createWorkspace(
      [
        {
          id: 'booking-feature',
          name: 'BookingFeature',
          kind: 'library',
          root: 'libs/booking/feature',
          classification: {},
          tags: [],
          ownership: {
            source: 'none',
          },
          metadata: {},
        },
        {
          id: 'workspace-root',
          name: 'WorkspaceRoot',
          kind: 'package-manager-package',
          root: '.',
          path: 'package.json',
          tags: [],
          metadata: {},
        },
        {
          id: 'tsconfig:tsconfig.base.json',
          name: 'TsconfigBase',
          kind: 'typescript-tsconfig',
          root: '.',
          path: 'tsconfig.base.json',
          tags: [],
          metadata: {},
        },
      ],
      [],
    );

    const result = await evaluateRulePack(coreBuiltInRulePack, {
      workspace,
      profile: {
        ...baseProfile,
        rules: {
          'project-name-convention': {
            enabled: true,
            options: {
              pattern: '^[a-z-]+$',
            },
          },
          'tag-convention': {
            enabled: true,
            options: {
              requiredPrefixes: ['domain'],
            },
          },
          'missing-domain': {
            enabled: true,
            options: {
              required: true,
            },
          },
          'missing-layer': {
            enabled: true,
            options: {
              required: true,
            },
          },
        },
      },
    });

    const projectNodeViolations = result.violations
      .filter((violation) => violation.reference?.nodeId === 'booking-feature')
      .map((violation) => violation.ruleId)
      .sort();
    const infrastructureNodeIds = new Set([
      'workspace-root',
      'tsconfig:tsconfig.base.json',
    ]);

    expect(projectNodeViolations).toEqual([
      'documentation-gap',
      'missing-domain',
      'missing-layer',
      'ownership-presence',
      'project-name-convention',
      'tag-convention',
    ]);
    expect(
      result.violations.filter((violation) =>
        infrastructureNodeIds.has(violation.reference?.nodeId ?? ''),
      ),
    ).toEqual([]);
  });

  it('skips evidence and context nodes for generic governed-asset rules, including dbt-shaped nodes', async () => {
    const workspace = createWorkspace(
      [
        {
          id: 'model.valid_project.orders',
          name: 'orders',
          kind: 'resource',
          technology: 'dbt',
          sourceSystem: 'dbt',
          tags: [],
          classification: {},
          metadata: {
            governance: {
              kind: 'asset',
            },
          },
        },
        {
          id: 'test.valid_project.not_null_orders_order_id',
          name: 'not_null_orders_order_id',
          kind: 'resource',
          technology: 'dbt',
          sourceSystem: 'dbt',
          tags: [],
          classification: {},
          metadata: {
            governance: {
              kind: 'evidence',
            },
          },
        },
        {
          id: 'dbt.project.valid_project',
          name: 'valid_project',
          kind: 'project',
          technology: 'dbt',
          sourceSystem: 'dbt',
          tags: [],
          classification: {},
          metadata: {
            governance: {
              kind: 'context',
            },
          },
        },
      ],
      [],
    );

    const result = await evaluateRulePack(coreBuiltInRulePack, {
      workspace,
      profile: {
        ...baseProfile,
        rules: {
          'missing-domain': {
            enabled: true,
            options: {
              required: true,
            },
          },
          'missing-layer': {
            enabled: true,
            options: {
              required: true,
            },
          },
        },
      },
    });

    const ruleIdsByNodeId = new Map<string, string[]>();
    for (const violation of result.violations) {
      const nodeId = violation.reference?.nodeId;
      if (!nodeId) {
        continue;
      }

      ruleIdsByNodeId.set(nodeId, [
        ...(ruleIdsByNodeId.get(nodeId) ?? []),
        violation.ruleId,
      ]);
    }

    expect(
      (ruleIdsByNodeId.get('model.valid_project.orders') ?? []).sort(),
    ).toEqual([
      'documentation-gap',
      'missing-domain',
      'missing-layer',
      'ownership-presence',
    ]);
    expect(
      ruleIdsByNodeId.get('test.valid_project.not_null_orders_order_id') ?? [],
    ).toEqual([]);
    expect(ruleIdsByNodeId.get('dbt.project.valid_project') ?? []).toEqual([]);
  });

  it('does not require legacy compatibility workspace views', async () => {
    const workspace = createWorkspace(baseNodes, baseRelations);

    const result = await evaluateRulePack(coreBuiltInRulePack, {
      workspace,
      profile: {
        ...baseProfile,
        rules: {
          'missing-domain': {
            enabled: true,
            options: {
              required: true,
            },
          },
        },
      },
    });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'domain-boundary',
          reference: {
            relationId: 'relation:booking-feature->payments-ui',
            relatedNodeIds: ['booking-feature', 'payments-ui'],
          },
        }),
      ]),
    );
  });

  it('evaluates canonical dependency relations deterministically for equivalent input order', async () => {
    const left = createWorkspace([...baseNodes], [...baseRelations]);
    const right = createWorkspace(
      [...baseNodes].reverse(),
      [...baseRelations].reverse(),
    );

    const leftResult = await evaluateRulePack(coreBuiltInRulePack, {
      workspace: left,
      profile: baseProfile,
    });
    const rightResult = await evaluateRulePack(coreBuiltInRulePack, {
      workspace: right,
      profile: baseProfile,
    });

    expect(leftResult.violations).toEqual(rightResult.violations);
  });

  it('does not report dependency-boundary violations for non-dependency relations', () => {
    const workspace = createWorkspace(baseNodes, [
      {
        id: 'relation:booking-feature->payments-ui:traceability',
        sourceNodeId: 'booking-feature',
        targetNodeId: 'payments-ui',
        kind: 'traceability',
        metadata: {},
      },
    ]);

    const domainResult = evaluateSync(domainBoundaryRule, {
      workspace,
      profile: baseProfile,
    });
    const layerResult = evaluateSync(layerBoundaryRule, {
      workspace,
      profile: baseProfile,
    });

    expect(domainResult.violations).toEqual([]);
    expect(layerResult.violations).toEqual([]);
  });
});

function createWorkspace(
  nodes: GovernanceNode[],
  relations: GovernanceRelation[],
  capabilities: GovernanceWorkspace['capabilities'] = [],
): GovernanceWorkspace {
  return {
    id: 'workspace',
    name: 'workspace',
    root: '.',
    nodes,
    relations,
    capabilities,
  };
}

function evaluateSync(
  rule: typeof domainBoundaryRule,
  input: Parameters<typeof rule.evaluate>[0],
) {
  return rule.evaluate(input) as GovernanceRuleResult;
}
