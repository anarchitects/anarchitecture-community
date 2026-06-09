import {
  buildDeliveryImpactAssessment,
  buildManagementInsightsAiRequest,
  buildMetricSnapshot,
  buildPrImpactRequest,
  buildRootCauseRequest,
  summarizeManagementInsights,
  summarizePrImpact,
  summarizeRootCause,
} from '../index.js';
import { buildGovernanceAssessment } from '../evaluation/assessment.js';
import { coreTestWorkspace } from '../../../tests/workspace.fixtures.js';

describe('delivery impact and ai analysis', () => {
  it('builds delivery-impact assessment and management-insights handoff', () => {
    const assessment = buildGovernanceAssessment({
      workspace: coreTestWorkspace,
      profile: 'frontend-layered',
      warnings: [],
      exceptions: {
        summary: {
          declaredCount: 0,
          matchedCount: 0,
          suppressedPolicyViolationCount: 0,
          suppressedConformanceFindingCount: 0,
          unusedExceptionCount: 0,
          activeExceptionCount: 0,
          staleExceptionCount: 0,
          expiredExceptionCount: 0,
          reactivatedPolicyViolationCount: 0,
          reactivatedConformanceFindingCount: 0,
        },
        used: [],
        unused: [],
        suppressedFindings: [],
        reactivatedFindings: [],
      },
      violations: [
        {
          id: 'domain-violation',
          ruleId: 'domain-boundary',
          subjectId: 'platform-shell',
          severity: 'error',
          category: 'boundary',
          message: 'Cross-domain dependency.',
          reference: {
            nodeId: 'platform-shell',
            relatedNodeIds: ['booking-ui', 'platform-shell'],
          },
        },
      ],
      signals: [
        {
          id: 'signal-domain',
          type: 'cross-domain-dependency',
          nodeId: 'platform-shell',
          relatedNodeIds: ['platform-shell', 'booking-ui'],
          severity: 'warning',
          category: 'boundary',
          message: 'Cross-domain dependency.',
          source: 'graph',
          createdAt: '2026-05-23T10:00:00.000Z',
        },
      ],
      measurements: [
        {
          id: 'domain-integrity',
          name: 'Domain Integrity',
          family: 'boundaries',
          value: 0.5,
          score: 50,
          maxScore: 100,
          unit: 'ratio',
        },
      ],
      health: {
        score: 50,
        status: 'warning',
        grade: 'D',
        hotspots: ['Domain Integrity'],
        metricHotspots: [
          {
            id: 'domain-integrity',
            name: 'Domain Integrity',
            score: 50,
          },
        ],
        subjectHotspots: [],
        explainability: {
          summary: 'Boundary pressure.',
          statusReason: 'Score is below threshold.',
          weakestMetrics: [
            {
              id: 'domain-integrity',
              name: 'Domain Integrity',
              score: 50,
            },
          ],
          dominantIssues: [],
        },
      },
      recommendations: [],
    });

    const deliveryImpact = buildDeliveryImpactAssessment({
      assessment,
    });
    const request = buildManagementInsightsAiRequest({
      deliveryImpact,
      assessment,
    });
    const analysis = summarizeManagementInsights(request);

    expect(deliveryImpact.indices.length).toBe(2);
    expect(request.kind).toBe('management-insights');
    expect(analysis.kind).toBe('management-insights');
  });

  it('builds and summarizes root-cause and pr-impact requests', () => {
    const snapshot = buildMetricSnapshot(
      buildGovernanceAssessment({
        workspace: coreTestWorkspace,
        profile: 'frontend-layered',
        warnings: [],
        exceptions: {
          summary: {
            declaredCount: 0,
            matchedCount: 0,
            suppressedPolicyViolationCount: 0,
            suppressedConformanceFindingCount: 0,
            unusedExceptionCount: 0,
            activeExceptionCount: 0,
            staleExceptionCount: 0,
            expiredExceptionCount: 0,
            reactivatedPolicyViolationCount: 0,
            reactivatedConformanceFindingCount: 0,
          },
          used: [],
          unused: [],
          suppressedFindings: [],
          reactivatedFindings: [],
        },
        violations: [],
        signals: [],
        measurements: [],
        health: {
          score: 100,
          status: 'good',
          grade: 'A',
          hotspots: [],
          metricHotspots: [],
          subjectHotspots: [],
          explainability: {
            summary: 'Healthy.',
            statusReason: 'Healthy.',
            weakestMetrics: [],
            dominantIssues: [],
          },
        },
        recommendations: [],
      }),
      {
        timestamp: '2026-05-23T10:00:00.000Z',
        repo: 'demo',
        branch: 'main',
        commitSha: 'abc123',
        pluginVersion: '0.0.1',
        metricSchemaVersion: '1',
      },
    );
    const rootCause = buildRootCauseRequest({
      profile: 'frontend-layered',
      snapshot,
      relations: coreTestWorkspace.relations,
      topViolations: [
        {
          type: 'domain-boundary',
          source: 'platform-shell',
          target: 'booking-ui',
          severity: 'error',
          message: 'Cross-domain dependency.',
        },
      ],
    });
    const prImpact = buildPrImpactRequest({
      profile: 'frontend-layered',
      affectedNodeIds: ['platform-shell', 'booking-ui'],
      relations: coreTestWorkspace.relations,
      metadata: {
        changedFilesCount: 6,
        affectedDomainCount: 2,
        crossDomainRelationEdges: 1,
      },
    });

    expect(summarizeRootCause(rootCause).kind).toBe('root-cause');
    expect(summarizePrImpact(prImpact).kind).toBe('pr-impact');
  });
});
