import {
  buildAiManagementInsightsHandoffPayload,
  buildAiDriftHandoffPayload,
  buildAiPrImpactHandoffPayload,
  buildAiRootCauseHandoffPayload,
  type AiAnalysisRequest,
  type AiAnalysisResult,
} from '../index.js';
import { buildGovernanceAssessment } from '../evaluation/assessment.js';
import { coreTestWorkspace } from '../../../tests/workspace.fixtures.js';

describe('core ai handoff payload builders', () => {
  it('builds a deterministic root-cause payload from plain core data', () => {
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
      violations: [],
      signals: [],
      measurements: [],
      health: {
        score: 100,
        status: 'good',
        grade: 'A',
        hotspots: [],
        metricHotspots: [],
        projectHotspots: [],
        explainability: {
          summary: 'Healthy.',
          statusReason: 'Score meets good threshold.',
          weakestMetrics: [],
          dominantIssues: [],
        },
      },
      recommendations: [],
    });

    const request: AiAnalysisRequest = {
      kind: 'root-cause',
      generatedAt: '2026-05-13T10:00:00.000Z',
      profile: assessment.profile,
      inputs: {
        dependencies: assessment.workspace.dependencies,
        topViolations: [],
      },
    };
    const analysis: AiAnalysisResult = {
      kind: 'root-cause',
      summary: 'No prioritized governance violations found.',
      findings: [],
      recommendations: [],
    };

    const payload = buildAiRootCauseHandoffPayload({
      request,
      analysis,
      metadata: {
        source: 'unit-test',
      },
    });

    expect(payload).toEqual({
      useCase: 'root-cause',
      request,
      analysis,
      metadata: {
        source: 'unit-test',
      },
    });
  });

  it('builds deterministic drift and pr-impact payloads', () => {
    const driftRequest: AiAnalysisRequest = {
      kind: 'drift',
      generatedAt: '2026-05-13T10:00:00.000Z',
      profile: 'frontend-layered',
      inputs: {
        metadata: {
          snapshotCount: 2,
        },
      },
    };
    const prImpactRequest: AiAnalysisRequest = {
      kind: 'pr-impact',
      generatedAt: '2026-05-13T10:00:00.000Z',
      profile: 'frontend-layered',
      inputs: {
        affectedProjects: ['platform-shell'],
        dependencies: coreTestWorkspace.dependencies,
        metadata: {
          baseRef: 'main',
          headRef: 'feature/branch',
        },
      },
    };
    const analysis: AiAnalysisResult = {
      kind: 'drift',
      summary: 'Stable trend.',
      findings: [],
      recommendations: [],
    };

    const driftPayload = buildAiDriftHandoffPayload({
      request: driftRequest,
      analysis,
    });
    const prPayload = buildAiPrImpactHandoffPayload({
      request: prImpactRequest,
      analysis: {
        ...analysis,
        kind: 'pr-impact',
      },
    });

    expect(driftPayload.useCase).toBe('drift');
    expect(prPayload.request.inputs.metadata).toMatchObject({
      baseRef: 'main',
      headRef: 'feature/branch',
    });
  });

  it('supports management-insights as a deterministic AI handoff use case', () => {
    const request: AiAnalysisRequest = {
      kind: 'management-insights',
      generatedAt: '2026-05-16T10:00:00.000Z',
      profile: 'frontend-layered',
      inputs: {
        metadata: {
          deliveryImpact: {
            indices: [{ id: 'cost-of-change', score: 61, risk: 'medium' }],
          },
        },
      },
    };
    const analysis: AiAnalysisResult = {
      kind: 'management-insights',
      summary: 'Prepared management-insights handoff.',
      findings: [],
      recommendations: [],
    };

    const payload = buildAiManagementInsightsHandoffPayload({
      request,
      analysis,
      metadata: {
        profile: 'frontend-layered',
      },
    });

    expect(payload).toEqual({
      useCase: 'management-insights',
      request,
      analysis,
      metadata: {
        profile: 'frontend-layered',
      },
    });
  });
});
