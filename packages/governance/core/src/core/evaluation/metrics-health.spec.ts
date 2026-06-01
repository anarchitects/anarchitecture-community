import {
  buildGovernanceRecommendations,
  calculateGovernanceHealth,
  calculateGovernanceMetrics,
  type GovernanceSignal,
  type Violation,
} from '../index.js';
import { coreTestWorkspace } from '../../../tests/workspace.fixtures.js';

describe('metrics and health', () => {
  it('calculates governance metrics, health, and recommendations from normalized input', () => {
    const signals: GovernanceSignal[] = [
      {
        id: 'signal-domain',
        type: 'domain-boundary-violation',
        sourceProjectId: 'platform-shell',
        targetProjectId: 'booking-ui',
        relatedProjectIds: ['platform-shell', 'booking-ui'],
        severity: 'error',
        category: 'boundary',
        message: 'Cross-domain dependency.',
        source: 'policy',
        createdAt: '2026-05-23T10:00:00.000Z',
      },
      {
        id: 'signal-ownership',
        type: 'ownership-gap',
        sourceProjectId: 'platform-shell',
        relatedProjectIds: ['platform-shell'],
        severity: 'warning',
        category: 'ownership',
        message: 'Ownership missing.',
        source: 'policy',
        createdAt: '2026-05-23T10:00:00.000Z',
      },
    ];
    const metrics = calculateGovernanceMetrics({
      workspace: coreTestWorkspace,
      signals,
    });
    const health = calculateGovernanceHealth(metrics, {
      'ownership-coverage': 2,
    });
    const recommendations = buildGovernanceRecommendations(
      [
        {
          id: 'violation-domain',
          ruleId: 'domain-boundary',
          project: 'platform-shell',
          severity: 'error',
          category: 'boundary',
          message: 'Cross-domain dependency.',
        } satisfies Violation,
      ],
      metrics,
    );

    expect(metrics.map((measurement) => measurement.id)).toEqual([
      'architectural-entropy',
      'dependency-complexity',
      'domain-integrity',
      'ownership-coverage',
      'documentation-completeness',
      'layer-integrity',
    ]);
    expect(health.grade).toMatch(/[A-F]/);
    expect(recommendations[0]?.id).toBe('reduce-cross-domain-dependencies');
  });
});
