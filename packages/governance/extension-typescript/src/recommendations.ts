import { createHash } from 'node:crypto';

import type {
  GovernanceDiagnostic,
  GovernanceSignal,
  Measurement,
  Recommendation,
} from '@anarchitects/governance-core';

import type {
  TypeScriptGovernanceRecommendationProvider,
  TypeScriptGovernanceRecommendationProviderInput,
} from './contracts.js';
import {
  getDependencyRelations,
  getPackageManagerMetadata,
  readStringMetadata,
  toNodeReference,
  toRelationReference,
} from './graph.js';
import { buildTypeScriptGovernanceDiagnostics } from './diagnostics.js';
import { buildTypeScriptGovernanceMetrics } from './metrics.js';
import { buildTypeScriptGovernanceSignals } from './signals.js';

export const TYPESCRIPT_GOVERNANCE_RECOMMENDATION_CODES = [
  'ADD_PACKAGE_METADATA',
  'FIX_PATH_MAPPING',
  'REVIEW_EXTERNAL_PACKAGE_DEPENDENCY',
  'REDUCE_IMPORT_FAN_IN',
] as const;

export type TypeScriptGovernanceRecommendationCode =
  (typeof TYPESCRIPT_GOVERNANCE_RECOMMENDATION_CODES)[number];

export interface TypeScriptGovernanceRecommendationMetadata
  extends Record<string, unknown> {
  code: TypeScriptGovernanceRecommendationCode;
  triggerDiagnosticCodes?: string[];
  triggerDiagnosticIds?: string[];
  triggerSignalCodes?: string[];
  triggerSignalIds?: string[];
  triggerMeasurementIds?: string[];
}

export interface TypeScriptGovernanceExtensionRecommendation
  extends Recommendation {
  metadata?: TypeScriptGovernanceRecommendationMetadata;
}

interface RecommendationDraft {
  code: TypeScriptGovernanceRecommendationCode;
  title: string;
  priority: Recommendation['priority'];
  reason: string;
  description: string;
  category: string;
  reference?: Recommendation['reference'];
  signalIds: string[];
  measurementIds: string[];
  metadata: TypeScriptGovernanceRecommendationMetadata;
}

const DEFAULT_PROVIDER_ID = 'typescript-governance-recommendations';

export const typescriptGovernanceRecommendationProvider =
  createTypeScriptGovernanceRecommendationProvider();

export function createTypeScriptGovernanceRecommendationProvider(): TypeScriptGovernanceRecommendationProvider {
  return {
    id: DEFAULT_PROVIDER_ID,
    provideRecommendations: (input) =>
      buildTypeScriptGovernanceRecommendations(input),
  };
}

export function buildTypeScriptGovernanceRecommendations(
  input: TypeScriptGovernanceRecommendationProviderInput,
): TypeScriptGovernanceExtensionRecommendation[] {
  const diagnostics = resolveDiagnostics(input);
  const signals = resolveSignals(input, diagnostics);
  const measurements = resolveMeasurements(input, diagnostics, signals);
  const drafts: RecommendationDraft[] = [];

  for (const diagnostic of diagnostics) {
    if (
      diagnostic.code === 'TYPESCRIPT_PROJECT_PACKAGE_METADATA_MISSING' &&
      diagnostic.reference?.nodeId
    ) {
      drafts.push({
        code: 'ADD_PACKAGE_METADATA',
        title: 'Add package metadata to TypeScript node',
        priority: 'medium',
        reason:
          'The TypeScript workspace project is missing TypeScript package facts.',
        description:
          'Populate the TypeScript extension expansion packageJson on the affected node so extension analysis can rely on package facts.',
        category: 'configuration',
        reference: toNodeReference(diagnostic.reference.nodeId),
        signalIds: [],
        measurementIds: [],
        metadata: {
          code: 'ADD_PACKAGE_METADATA',
          triggerDiagnosticCodes: [diagnostic.code],
          triggerDiagnosticIds: diagnostic.id ? [diagnostic.id] : [],
        },
      });
    }

    if (
      diagnostic.code === 'TYPESCRIPT_PATH_MAPPING_UNRESOLVED' &&
      diagnostic.reference?.nodeId
    ) {
      drafts.push({
        code: 'FIX_PATH_MAPPING',
        title: 'Fix unresolved TypeScript path mapping',
        priority: 'high',
        reason:
          'A declared TypeScript path alias did not resolve to any canonical relation.',
        description:
          'Align tsconfig path aliases with workspace project roots or adapter discovery so the alias produces a path-mapping relation.',
        category: 'structure',
        reference: toNodeReference(diagnostic.reference.nodeId),
        signalIds: [],
        measurementIds: [],
        metadata: {
          code: 'FIX_PATH_MAPPING',
          triggerDiagnosticCodes: [diagnostic.code],
          triggerDiagnosticIds: diagnostic.id ? [diagnostic.id] : [],
        },
      });
    }
  }

  const dependencyById = new Map(
    getDependencyRelations(input.workspace).map((relation) => [
      relation.id,
      relation,
    ]),
  );

  for (const signal of signals) {
    if (
      signal.metadata?.code ===
        'TYPESCRIPT_EXTERNAL_PACKAGE_DEPENDENCY_DETECTED' &&
      signal.relationId
    ) {
      const relation = dependencyById.get(signal.relationId);
      if (!relation) {
        continue;
      }

      drafts.push({
        code: 'REVIEW_EXTERNAL_PACKAGE_DEPENDENCY',
        title: 'Review external package dependency',
        priority: 'medium',
        reason:
          'A TypeScript workspace dependency points to an external package rather than another governed node.',
        description: `Review dependency usage for "${
          readStringMetadata(getPackageManagerMetadata(relation), [
            'packageName',
          ]) ?? relation.targetNodeId
        }" and decide whether it should remain external or become governed workspace scope.`,
        category: 'dependency',
        reference: toRelationReference(relation),
        signalIds: [signal.id],
        measurementIds: [],
        metadata: {
          code: 'REVIEW_EXTERNAL_PACKAGE_DEPENDENCY',
          triggerSignalCodes: [String(signal.metadata?.code)],
          triggerSignalIds: [signal.id],
        },
      });
    }

    if (
      signal.metadata?.code === 'TYPESCRIPT_HIGH_IMPORT_FAN_IN' &&
      signal.nodeId
    ) {
      drafts.push({
        code: 'REDUCE_IMPORT_FAN_IN',
        title: 'Reduce import fan-in',
        priority: 'medium',
        reason:
          'The affected TypeScript node attracts a high number of incoming imports.',
        description:
          'Split responsibilities, reduce barrel concentration, or restructure imports so the node is not a central hotspot.',
        category: 'structure',
        reference: toNodeReference(signal.nodeId),
        signalIds: [signal.id],
        measurementIds: [],
        metadata: {
          code: 'REDUCE_IMPORT_FAN_IN',
          triggerSignalCodes: [String(signal.metadata?.code)],
          triggerSignalIds: [signal.id],
        },
      });
    }
  }

  const hotspotMeasurement = measurements.find(
    (measurement) => measurement.id === 'typescript-import-hotspot-count',
  );
  if (hotspotMeasurement && hotspotMeasurement.value > 0) {
    for (const draft of drafts) {
      if (draft.code !== 'REDUCE_IMPORT_FAN_IN') {
        continue;
      }
      draft.measurementIds = [hotspotMeasurement.id];
      draft.metadata.triggerMeasurementIds = [hotspotMeasurement.id];
    }
  }

  return dedupeAndSortRecommendations(drafts, input.recommendations);
}

function resolveDiagnostics(
  input: TypeScriptGovernanceRecommendationProviderInput,
): readonly GovernanceDiagnostic[] {
  if (input.diagnostics.length > 0) {
    return input.diagnostics;
  }

  return buildTypeScriptGovernanceDiagnostics({
    ...input,
    diagnostics: [],
  });
}

function resolveSignals(
  input: TypeScriptGovernanceRecommendationProviderInput,
  diagnostics: readonly GovernanceDiagnostic[],
): readonly GovernanceSignal[] {
  if (input.signals.length > 0) {
    return input.signals;
  }

  return buildTypeScriptGovernanceSignals({
    ...input,
    diagnostics,
  });
}

function resolveMeasurements(
  input: TypeScriptGovernanceRecommendationProviderInput,
  diagnostics: readonly GovernanceDiagnostic[],
  signals: readonly GovernanceSignal[],
): readonly Measurement[] {
  if (input.measurements.length > 0) {
    return input.measurements;
  }

  return buildTypeScriptGovernanceMetrics({
    ...input,
    diagnostics,
    signals: [...signals],
  });
}

function dedupeAndSortRecommendations(
  drafts: readonly RecommendationDraft[],
  existing: readonly Recommendation[],
): TypeScriptGovernanceExtensionRecommendation[] {
  const existingIds = new Set(
    existing.map((recommendation) => recommendation.id),
  );
  const byId = new Map<string, TypeScriptGovernanceExtensionRecommendation>();

  for (const draft of drafts) {
    const identity = [
      draft.code,
      draft.reference?.nodeId ?? '',
      draft.reference?.relationId ?? '',
    ].join('::');
    const id = `recommendation:${createHash('sha1')
      .update(identity)
      .digest('hex')
      .slice(0, 12)}`;

    if (existingIds.has(id) || byId.has(id)) {
      continue;
    }

    byId.set(id, {
      id,
      title: draft.title,
      priority: draft.priority,
      reason: draft.reason,
      description: draft.description,
      category: draft.category,
      ...(draft.reference ? { reference: draft.reference } : {}),
      ...(draft.signalIds.length > 0 ? { signalIds: draft.signalIds } : {}),
      ...(draft.measurementIds.length > 0
        ? { measurementIds: draft.measurementIds }
        : {}),
      metadata: draft.metadata,
    });
  }

  return [...byId.values()].sort((left, right) => {
    return (
      left.priority.localeCompare(right.priority) ||
      left.title.localeCompare(right.title) ||
      (left.reference?.nodeId ?? '').localeCompare(
        right.reference?.nodeId ?? '',
      ) ||
      (left.reference?.relationId ?? '').localeCompare(
        right.reference?.relationId ?? '',
      ) ||
      left.id.localeCompare(right.id)
    );
  });
}
