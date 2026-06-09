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
} from '../index.js';
import type {
  GovernanceCompatibilityWorkspace,
  GovernanceDependency,
  GovernanceProject,
} from '../model/models.js';
import { normalizeGovernanceGraph } from '../graph/graph-normalization.js';

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

  const baseWorkspaceProjects: GovernanceProject[] = [
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
  ];
  const baseWorkspaceDependencies: GovernanceDependency[] = [
    {
      source: 'booking-feature',
      target: 'payments-ui',
      type: 'static',
    },
  ];
  const baseWorkspaceGraph = normalizeGovernanceGraph({
    projects: baseWorkspaceProjects.map((project) => ({
      id: project.id,
      name: project.name,
      root: project.root,
      type: project.type,
      domain: project.domain,
      layer: project.layer,
      tags: project.tags,
      ownership: project.ownership,
      metadata: project.metadata,
    })),
    dependencies: baseWorkspaceDependencies.map((dependency) => ({
      sourceProjectId: dependency.source,
      targetProjectId: dependency.target,
      type: dependency.type,
    })),
  });
  const baseWorkspace: GovernanceCompatibilityWorkspace = {
    id: 'workspace',
    name: 'workspace',
    root: '.',
    nodes: baseWorkspaceGraph.nodes,
    relations: baseWorkspaceGraph.relations,
    projects: baseWorkspaceProjects,
    dependencies: baseWorkspaceDependencies,
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
    const workspace: GovernanceCompatibilityWorkspace = {
      ...baseWorkspace,
      dependencies: [
        {
          source: 'shared-data',
          target: 'booking-feature',
          type: 'static',
        },
      ],
    };

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
    const workspace: GovernanceCompatibilityWorkspace = {
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
    };

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
    const workspace: GovernanceCompatibilityWorkspace = {
      ...baseWorkspace,
      dependencies: [
        {
          source: 'shared-data',
          target: 'booking-feature',
          type: 'static',
        },
      ],
    };

    const result = await evaluateRulePack(coreBuiltInRulePack, {
      workspace,
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
