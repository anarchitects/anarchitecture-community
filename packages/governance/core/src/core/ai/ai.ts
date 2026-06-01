import type { AiAnalysisRequest, AiAnalysisResult } from '../model/models.js';

export type AiHandoffUseCase = Extract<
  AiAnalysisRequest['kind'],
  'root-cause' | 'drift' | 'pr-impact' | 'scorecard' | 'management-insights'
>;

export interface GovernanceAiHandoffPayload<
  TRequest = Record<string, unknown>,
  TAnalysis = AiAnalysisResult,
> {
  useCase: AiHandoffUseCase;
  request: TRequest;
  analysis: TAnalysis;
  payloadScope?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function buildAiHandoffPayload<TRequest, TAnalysis = AiAnalysisResult>(
  useCase: AiHandoffUseCase,
  params: {
    request: TRequest;
    analysis: TAnalysis;
    payloadScope?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
): GovernanceAiHandoffPayload<TRequest, TAnalysis> {
  return {
    useCase,
    request: params.request,
    analysis: params.analysis,
    ...(params.payloadScope ? { payloadScope: params.payloadScope } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };
}

export function buildAiRootCauseHandoffPayload<TRequest>(
  params: Parameters<typeof buildAiHandoffPayload<TRequest>>[1],
): GovernanceAiHandoffPayload<TRequest> {
  return buildAiHandoffPayload('root-cause', params);
}

export function buildAiPrImpactHandoffPayload<TRequest>(
  params: Parameters<typeof buildAiHandoffPayload<TRequest>>[1],
): GovernanceAiHandoffPayload<TRequest> {
  return buildAiHandoffPayload('pr-impact', params);
}

export function buildAiDriftHandoffPayload<TRequest>(
  params: Parameters<typeof buildAiHandoffPayload<TRequest>>[1],
): GovernanceAiHandoffPayload<TRequest> {
  return buildAiHandoffPayload('drift', params);
}

export function buildAiScorecardHandoffPayload<TRequest>(
  params: Parameters<typeof buildAiHandoffPayload<TRequest>>[1],
): GovernanceAiHandoffPayload<TRequest> {
  return buildAiHandoffPayload('scorecard', params);
}

export function buildAiManagementInsightsHandoffPayload<TRequest>(
  params: Parameters<typeof buildAiHandoffPayload<TRequest>>[1],
): GovernanceAiHandoffPayload<TRequest> {
  return buildAiHandoffPayload('management-insights', params);
}
