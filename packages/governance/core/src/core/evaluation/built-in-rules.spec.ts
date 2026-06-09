import {
  coreBuiltInRulePack,
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
    boundaryPolicySource: 'profile',
    layers: ['app', 'feature', 'ui', 'data-access', 'util'],
    allowedDomainDependencies: {
      '*': [],
    },
    ownership: {
      required: true,
      metadataField: 'ownership',
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
      metadata: {},
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
      metadata: {},
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
      metadata: {},
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
        reference: {
          nodeId: 'shared-data',
        },
      }),
    ]);
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

  it('does not require workspace.projects or workspace.dependencies', async () => {
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
): GovernanceWorkspace {
  return {
    id: 'workspace',
    name: 'workspace',
    root: '.',
    nodes,
    relations,
  };
}

function evaluateSync(
  rule: typeof domainBoundaryRule,
  input: Parameters<typeof rule.evaluate>[0],
) {
  return rule.evaluate(input) as GovernanceRuleResult;
}
