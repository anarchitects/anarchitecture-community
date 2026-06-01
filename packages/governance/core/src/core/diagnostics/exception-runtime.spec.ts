import {
  applyGovernanceExceptions,
  buildGovernanceExceptionReport,
  evaluateGovernanceExceptionLifecycle,
  type GovernanceException,
  type Violation,
} from '../index.js';

describe('exception runtime', () => {
  it('evaluates lifecycle, applies exceptions, and builds a deterministic report', () => {
    const exception: GovernanceException = {
      id: 'exception-domain',
      source: 'policy',
      scope: {
        source: 'policy',
        ruleId: 'domain-boundary',
        projectId: 'platform-shell',
        targetProjectId: 'booking-ui',
      },
      reason: 'Temporary integration seam.',
      owner: 'platform-team',
      review: {
        reviewBy: '2026-06-01',
      },
    };
    const staleException: GovernanceException = {
      id: 'exception-ownership',
      source: 'policy',
      scope: {
        source: 'policy',
        ruleId: 'ownership-presence',
        projectId: 'platform-shell',
      },
      reason: 'Migration in progress.',
      owner: 'platform-team',
      review: {
        reviewBy: '2026-05-01',
      },
    };
    const violations: Violation[] = [
      {
        id: 'domain-violation',
        ruleId: 'domain-boundary',
        project: 'platform-shell',
        severity: 'error',
        category: 'boundary',
        message: 'Cross-domain dependency.',
        details: {
          targetProject: 'booking-ui',
        },
      },
      {
        id: 'ownership-violation',
        ruleId: 'ownership-presence',
        project: 'platform-shell',
        severity: 'warning',
        category: 'ownership',
        message: 'Ownership missing.',
      },
    ];

    expect(
      evaluateGovernanceExceptionLifecycle(
        staleException,
        new Date('2026-05-23'),
      ),
    ).toMatchObject({
      status: 'stale',
    });

    const application = applyGovernanceExceptions({
      exceptions: [exception, staleException],
      policyViolations: violations,
      conformanceFindings: [],
      asOf: new Date('2026-05-23'),
    });
    const report = buildGovernanceExceptionReport(application);

    expect(application.activePolicyViolations).toHaveLength(1);
    expect(application.suppressedPolicyViolations).toHaveLength(1);
    expect(application.reactivatedPolicyViolations).toHaveLength(1);
    expect(report.summary.staleExceptionCount).toBe(1);
  });
});
