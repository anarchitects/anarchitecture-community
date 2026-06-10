import type { GovernanceException } from '../diagnostics/exceptions.js';
import {
  normalizeGovernanceProfile,
  type GovernanceProfile,
  type GovernanceNodeOverride,
} from '../index.js';

describe('normalizeGovernanceProfile', () => {
  const baseProfile: GovernanceProfile = {
    name: 'test-profile',
    description: 'Profile normalization test fixture',
    boundaryPolicySource: 'profile',
    layers: ['app', 'feature', 'ui', 'data-access', 'util'],
    allowedDomainDependencies: {
      '*': ['shared'],
      booking: ['payments'],
    },
    ownership: {
      required: true,
      metadataField: 'ownership',
    },
    health: {
      statusThresholds: {
        goodMinScore: 90,
        warningMinScore: 75,
      },
    },
    metrics: {
      'architectural-entropy': 0.4,
      'dependency-complexity': 0.3,
      'domain-integrity': 0.5,
      'ownership-coverage': 0.2,
      'documentation-completeness': 0.1,
      'layer-integrity': 0.6,
    },
  };

  it('maps compatibility rules and preserves scoring data', () => {
    const normalized = normalizeGovernanceProfile(baseProfile);

    expect(normalized.rules['domain-boundary']).toEqual({
      enabled: true,
      severity: 'error',
      options: {
        allowedDependencies: baseProfile.allowedDomainDependencies,
      },
    });
    expect(normalized.rules['layer-boundary']).toEqual({
      enabled: true,
      severity: 'warning',
      options: {
        allowedDependencies: {
          app: ['app', 'feature', 'ui', 'data-access', 'util'],
          feature: ['feature', 'ui', 'data-access', 'util'],
          ui: ['ui', 'data-access', 'util'],
          'data-access': ['data-access', 'util'],
          util: ['util'],
        },
        layers: ['app', 'feature', 'ui', 'data-access', 'util'],
        usesExplicitDependencies: false,
      },
    });
    expect(normalized.scoring).toEqual({
      statusThresholds: {
        goodMinScore: 90,
        warningMinScore: 75,
      },
      metricWeights: baseProfile.metrics,
    });
  });

  it('preserves explicit generic rule configuration', () => {
    const normalized = normalizeGovernanceProfile({
      ...baseProfile,
      rules: {
        'project-name-convention': {
          enabled: true,
          severity: 'info',
          options: {
            pattern: '^[a-z-]+$',
          },
        },
        'missing-domain': {
          enabled: true,
          options: {
            required: true,
          },
        },
      },
    });

    expect(normalized.rules['project-name-convention']).toEqual({
      enabled: true,
      severity: 'info',
      options: {
        pattern: '^[a-z-]+$',
      },
    });
    expect(normalized.rules['missing-domain']).toEqual({
      enabled: true,
      options: {
        required: true,
      },
    });
  });

  it('preserves exceptions and project overrides from compatibility inputs', () => {
    const exceptions: GovernanceException[] = [
      {
        id: 'policy-exception',
        source: 'policy',
        scope: {
          source: 'policy',
          ruleId: 'domain-boundary',
          nodeId: 'booking-feature',
          relatedNodeIds: ['booking-feature', 'payments-ui'],
        },
        reason: 'Known transition.',
        owner: '@org/architecture',
        review: {
          reviewBy: '2026-07-01',
        },
      },
    ];
    const projectOverrides: Record<string, GovernanceNodeOverride> = {
      'booking-feature': {
        domain: 'booking',
        documentation: true,
      },
    };

    const normalized = normalizeGovernanceProfile(baseProfile, {
      exceptions,
      projectOverrides,
    });

    expect(normalized.exceptions).toEqual(exceptions);
    expect(normalized.projectOverrides).toEqual(projectOverrides);
  });
});
