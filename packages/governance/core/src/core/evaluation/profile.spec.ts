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
    layers: ['app', 'feature', 'ui', 'data-access', 'util'],
    allowedDomainDependencies: {
      '*': ['shared'],
      booking: ['payments'],
    },
    ownership: {
      required: true,
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
    expect(normalized.rules['documentation-gap']).toEqual({
      enabled: true,
      severity: 'warning',
      options: {
        metadataKeys: ['documentation'],
        requireAny: true,
      },
    });
    expect(normalized.scoring).toEqual({
      statusThresholds: {
        goodMinScore: 90,
        warningMinScore: 75,
      },
      metricWeights: baseProfile.metrics,
    });
    expect(normalized).not.toHaveProperty('profileSource');
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

  it('preserves exceptions and node overrides', () => {
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
    const nodeOverrides: Record<string, GovernanceNodeOverride> = {
      'booking-feature': {
        domain: 'booking',
        documentation: true,
      },
    };

    const normalized = normalizeGovernanceProfile(baseProfile, {
      exceptions,
      nodeOverrides,
    });

    expect(normalized.exceptions).toEqual(exceptions);
    expect(normalized.nodeOverrides).toEqual(nodeOverrides);
  });
});
