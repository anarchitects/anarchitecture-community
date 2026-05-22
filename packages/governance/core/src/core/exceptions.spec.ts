import {
  buildGovernanceExceptionScopeKey,
  isConformanceExceptionScope,
  isPolicyExceptionScope,
  normalizeGovernanceException,
} from './exceptions.js';

describe('governance exception contract', () => {
  it('normalizes a policy exception with target scope', () => {
    const exception = normalizeGovernanceException({
      id: '  billing-domain-waiver  ',
      source: 'policy',
      scope: {
        source: 'policy',
        ruleId: ' domain-boundary ',
        projectId: ' billing-feature ',
        targetProjectId: ' shared-util ',
      },
      reason: '  Transitional boundary while extracting an API. ',
      owner: ' @org/architecture ',
      review: {
        createdAt: ' 2026-04-17 ',
        reviewBy: ' 2026-06-01 ',
      },
    });

    expect(exception).toEqual({
      id: 'billing-domain-waiver',
      source: 'policy',
      scope: {
        source: 'policy',
        ruleId: 'domain-boundary',
        projectId: 'billing-feature',
        targetProjectId: 'shared-util',
      },
      reason: 'Transitional boundary while extracting an API.',
      owner: '@org/architecture',
      review: {
        createdAt: '2026-04-17',
        reviewBy: '2026-06-01',
      },
    });
  });

  it('normalizes conformance related projects deterministically', () => {
    const exception = normalizeGovernanceException({
      id: 'conformance-waiver',
      source: 'conformance',
      scope: {
        source: 'conformance',
        ruleId: 'enforce-module-boundaries',
        relatedProjectIds: [
          'payments-lib',
          'checkout-app',
          'payments-lib',
          '  ',
        ],
      },
      reason: 'Known migration overlap.',
      owner: '@org/architecture',
      review: {
        reviewBy: '2026-05-15',
      },
    });

    expect(exception.scope).toEqual({
      source: 'conformance',
      ruleId: 'enforce-module-boundaries',
      relatedProjectIds: ['checkout-app', 'payments-lib'],
    });
  });

  it('builds stable scope keys across equivalent related project orderings', () => {
    const first = buildGovernanceExceptionScopeKey({
      source: 'conformance',
      ruleId: 'enforce-module-boundaries',
      relatedProjectIds: ['b', 'a', 'b'],
    });
    const second = buildGovernanceExceptionScopeKey({
      source: 'conformance',
      ruleId: 'enforce-module-boundaries',
      relatedProjectIds: ['a', 'b'],
    });

    expect(first).toBe(second);
    expect(first).toBe('conformance|enforce-module-boundaries|||a,b');
  });

  it('exposes policy and conformance scope type guards', () => {
    const policy = normalizeGovernanceException({
      id: 'policy-scope',
      source: 'policy',
      scope: {
        source: 'policy',
        ruleId: 'layer-boundary',
        projectId: 'feature-lib',
        targetProjectId: 'util-lib',
      },
      reason: 'Temporary layering gap.',
      owner: '@org/architecture',
      review: {
        reviewBy: '2026-05-01',
      },
    }).scope;
    const conformance = normalizeGovernanceException({
      id: 'conformance-scope',
      source: 'conformance',
      scope: {
        source: 'conformance',
        ruleId: 'conformance-rule',
      },
      reason: 'Tooling false positive.',
      owner: '@org/architecture',
      review: {
        expiresAt: '2026-06-01',
      },
    }).scope;

    expect(isPolicyExceptionScope(policy)).toBe(true);
    expect(isConformanceExceptionScope(policy)).toBe(false);
    expect(isPolicyExceptionScope(conformance)).toBe(false);
    expect(isConformanceExceptionScope(conformance)).toBe(true);
  });
});
