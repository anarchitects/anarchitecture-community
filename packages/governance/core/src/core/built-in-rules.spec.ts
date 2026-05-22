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
  type GovernanceProfile,
  type GovernanceRuleResult,
  type GovernanceWorkspace,
} from './index.js';

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

  const baseWorkspace: GovernanceWorkspace = {
    id: 'workspace',
    name: 'workspace',
    root: '.',
    projects: [
      {
        id: 'booking-feature',
        name: 'booking-feature',
        root: 'libs/booking/feature',
        type: 'library',
        tags: ['domain:booking', 'layer:feature'],
        domain: 'booking',
        layer: 'feature',
        ownership: {
          team: 'booking-team',
          source: 'project-metadata',
        },
        metadata: {},
      },
      {
        id: 'payments-ui',
        name: 'payments-ui',
        root: 'libs/payments/ui',
        type: 'library',
        tags: ['domain:payments', 'layer:ui'],
        domain: 'payments',
        layer: 'ui',
        ownership: {
          team: 'payments-team',
          source: 'project-metadata',
        },
        metadata: {},
      },
      {
        id: 'shared-data',
        name: 'shared-data',
        root: 'libs/shared/data',
        type: 'library',
        tags: ['domain:shared', 'layer:data-access'],
        domain: 'shared',
        layer: 'data-access',
        ownership: {
          source: 'none',
        },
        metadata: {},
      },
    ],
    dependencies: [
      {
        source: 'booking-feature',
        target: 'payments-ui',
        type: 'static',
      },
    ],
  };

  it('reports a domain violation for disallowed domain dependencies', () => {
    const result = evaluateSync(domainBoundaryRule, {
      workspace: baseWorkspace,
      profile: baseProfile,
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'domain-boundary',
        project: 'booking-feature',
        severity: 'error',
        category: 'boundary',
        details: {
          targetProject: 'payments-ui',
          sourceDomain: 'booking',
          targetDomain: 'payments',
          dependencyType: 'static',
        },
      }),
    ]);
  });

  it('reports a layer violation for disallowed layer dependencies', () => {
    const result = evaluateSync(layerBoundaryRule, {
      workspace: {
        ...baseWorkspace,
        dependencies: [
          {
            source: 'shared-data',
            target: 'booking-feature',
            type: 'static',
          },
        ],
      },
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
        project: 'shared-data',
        severity: 'warning',
        category: 'boundary',
      }),
    ]);
  });

  it('reports missing ownership when required', () => {
    const result = evaluateSync(ownershipPresenceRule, {
      workspace: baseWorkspace,
      profile: baseProfile,
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        ruleId: 'ownership-presence',
        project: 'shared-data',
        category: 'ownership',
      }),
    ]);
  });

  it('supports opt-in project naming and tag conventions', async () => {
    const result = await evaluateRulePack(coreBuiltInRulePack, {
      workspace: {
        ...baseWorkspace,
        projects: [
          {
            ...baseWorkspace.projects[0],
            name: 'BookingFeature',
            tags: ['scope-booking', 'bad:Value'],
            domain: undefined,
            layer: undefined,
          },
          ...baseWorkspace.projects.slice(1),
        ],
      },
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
        }),
        expect.objectContaining({
          ruleId: tagConventionRule.id,
        }),
        expect.objectContaining({
          ruleId: missingDomainRule.id,
        }),
        expect.objectContaining({
          ruleId: missingLayerRule.id,
        }),
      ]),
    );
  });

  it('does not report domain or layer violations when the migrated rules are disabled', async () => {
    const result = await evaluateRulePack(coreBuiltInRulePack, {
      workspace: {
        ...baseWorkspace,
        dependencies: [
          {
            source: 'shared-data',
            target: 'booking-feature',
            type: 'static',
          },
        ],
      },
      profile: {
        ...baseProfile,
        allowedDomainDependencies: {
          shared: ['booking'],
        },
        rules: {
          'domain-boundary': {
            enabled: false,
          },
          'layer-boundary': {
            enabled: false,
          },
        },
      },
    });

    expect(
      result.violations.filter(
        (violation) =>
          violation.ruleId === 'domain-boundary' ||
          violation.ruleId === 'layer-boundary',
      ),
    ).toEqual([]);
  });
});

function evaluateSync(
  rule: typeof domainBoundaryRule,
  input: Parameters<typeof rule.evaluate>[0],
) {
  return rule.evaluate(input) as GovernanceRuleResult;
}
