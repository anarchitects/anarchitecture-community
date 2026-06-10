import type { Measurement } from '@anarchitects/governance-core';

import type {
  TypeScriptGovernanceMetricProvider,
  TypeScriptGovernanceMetricProviderInput,
} from './contracts.js';
import {
  findNodeById,
  getDependencyRelations,
  getImportRelations,
  getPathMappingRelations,
  getTsconfigNodes,
  getTypeScriptProjectNodes,
  getWorkspacePackageManager,
  readBooleanMetadata,
} from './graph.js';
import { buildTypeScriptGovernanceDiagnostics } from './diagnostics.js';
import { buildTypeScriptGovernanceSignals } from './signals.js';

export const TYPESCRIPT_GOVERNANCE_METRIC_IDS = [
  'typescript-workspace-project-count',
  'typescript-tsconfig-count',
  'typescript-import-relation-count',
  'typescript-path-mapping-count',
  'typescript-external-package-dependency-count',
  'typescript-import-hotspot-count',
  'typescript-unresolved-path-mapping-count',
] as const;

export type TypeScriptGovernanceMetricId =
  (typeof TYPESCRIPT_GOVERNANCE_METRIC_IDS)[number];

export interface TypeScriptGovernanceMetricMetadata
  extends Record<string, unknown> {
  metricId: TypeScriptGovernanceMetricId;
  rawKind: 'count';
  count: number;
  countedNodeIds?: string[];
  countedRelationIds?: string[];
  countedSignalIds?: string[];
  countedDiagnosticIds?: string[];
}

export interface TypeScriptGovernanceMeasurement extends Measurement {
  id: TypeScriptGovernanceMetricId;
  metadata?: TypeScriptGovernanceMetricMetadata;
}

const DEFAULT_PROVIDER_ID = 'typescript-governance-metrics';

export const typescriptGovernanceMetricProvider =
  createTypeScriptGovernanceMetricProvider();

export function createTypeScriptGovernanceMetricProvider(): TypeScriptGovernanceMetricProvider {
  return {
    id: DEFAULT_PROVIDER_ID,
    provideMetrics: (input) => buildTypeScriptGovernanceMetrics(input),
  };
}

export function buildTypeScriptGovernanceMetrics(
  input: TypeScriptGovernanceMetricProviderInput,
): TypeScriptGovernanceMeasurement[] {
  const projectNodes = getTypeScriptProjectNodes(input.workspace);
  const tsconfigNodes = getTsconfigNodes(input.workspace);
  const importRelations = getImportRelations(input.workspace);
  const pathMappingRelations = getPathMappingRelations(input.workspace);
  const externalDependencyRelations = getDependencyRelations(input.workspace)
    .filter((relation) =>
      readBooleanMetadata(
        findNodeById(input.workspace, relation.targetNodeId)?.metadata,
        ['packageManager', 'external'],
      ),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const diagnostics =
    input.diagnostics && input.diagnostics.length > 0
      ? input.diagnostics
      : buildTypeScriptGovernanceDiagnostics({
          ...input,
          diagnostics: [],
          measurements: input.measurements ?? [],
          violations: input.violations ?? [],
        });
  const signals =
    input.signals && input.signals.length > 0
      ? input.signals
      : buildTypeScriptGovernanceSignals({
          ...input,
          diagnostics,
        });
  const hotspotSignals = signals
    .filter(
      (signal) => signal.metadata?.code === 'TYPESCRIPT_HIGH_IMPORT_FAN_IN',
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const unresolvedPathMappingDiagnostics = diagnostics
    .filter(
      (diagnostic) => diagnostic.code === 'TYPESCRIPT_PATH_MAPPING_UNRESOLVED',
    )
    .sort((left, right) =>
      (left.reference?.nodeId ?? '').localeCompare(
        right.reference?.nodeId ?? '',
      ),
    );
  const packageManager = getWorkspacePackageManager(
    input.workspace.capabilities ?? [],
  );

  return [
    createCountMeasurement({
      id: 'typescript-workspace-project-count',
      name: 'TypeScript Workspace Project Count',
      family: 'architecture',
      count: projectNodes.length,
      countedNodeIds: projectNodes.map((node) => node.id).sort(),
      dimensions: packageManager ? { packageManager } : undefined,
    }),
    createCountMeasurement({
      id: 'typescript-tsconfig-count',
      name: 'TypeScript Tsconfig Count',
      family: 'architecture',
      count: tsconfigNodes.length,
      countedNodeIds: tsconfigNodes.map((node) => node.id).sort(),
      dimensions: packageManager ? { packageManager } : undefined,
    }),
    createCountMeasurement({
      id: 'typescript-import-relation-count',
      name: 'TypeScript Import Relation Count',
      family: 'architecture',
      count: importRelations.length,
      countedRelationIds: importRelations.map((relation) => relation.id).sort(),
      dimensions: packageManager
        ? { packageManager, relationKind: 'import' }
        : { relationKind: 'import' },
    }),
    createCountMeasurement({
      id: 'typescript-path-mapping-count',
      name: 'TypeScript Path Mapping Count',
      family: 'architecture',
      count: pathMappingRelations.length,
      countedRelationIds: pathMappingRelations
        .map((relation) => relation.id)
        .sort(),
      dimensions: {
        ...(packageManager ? { packageManager } : {}),
        relationKind: 'path-mapping',
      },
    }),
    createCountMeasurement({
      id: 'typescript-external-package-dependency-count',
      name: 'TypeScript External Package Dependency Count',
      family: 'boundaries',
      count: externalDependencyRelations.length,
      countedRelationIds: externalDependencyRelations
        .map((relation) => relation.id)
        .sort(),
      dimensions: {
        ...(packageManager ? { packageManager } : {}),
        relationKind: 'dependency',
      },
    }),
    createCountMeasurement({
      id: 'typescript-import-hotspot-count',
      name: 'TypeScript Import Hotspot Count',
      family: 'boundaries',
      count: hotspotSignals.length,
      countedNodeIds: hotspotSignals
        .flatMap((signal) => (signal.nodeId ? [signal.nodeId] : []))
        .sort(),
      countedSignalIds: hotspotSignals.map((signal) => signal.id).sort(),
      signalIds: hotspotSignals.map((signal) => signal.id).sort(),
      dimensions: packageManager ? { packageManager } : undefined,
    }),
    createCountMeasurement({
      id: 'typescript-unresolved-path-mapping-count',
      name: 'TypeScript Unresolved Path Mapping Count',
      family: 'boundaries',
      count: unresolvedPathMappingDiagnostics.length,
      countedNodeIds: unresolvedPathMappingDiagnostics
        .flatMap((diagnostic) =>
          diagnostic.reference?.nodeId ? [diagnostic.reference.nodeId] : [],
        )
        .sort(),
      countedDiagnosticIds: unresolvedPathMappingDiagnostics
        .flatMap((diagnostic) => (diagnostic.id ? [diagnostic.id] : []))
        .sort(),
      dimensions: packageManager ? { packageManager } : undefined,
    }),
  ];
}

function createCountMeasurement(options: {
  id: TypeScriptGovernanceMetricId;
  name: string;
  family: Measurement['family'];
  count: number;
  countedNodeIds?: string[];
  countedRelationIds?: string[];
  countedSignalIds?: string[];
  countedDiagnosticIds?: string[];
  signalIds?: string[];
  dimensions?: Measurement['dimensions'];
}): TypeScriptGovernanceMeasurement {
  return {
    id: options.id,
    name: options.name,
    family: options.family,
    value: options.count,
    score: options.count,
    maxScore: options.count,
    unit: 'count',
    ...(options.signalIds ? { signalIds: options.signalIds } : {}),
    ...(options.dimensions ? { dimensions: options.dimensions } : {}),
    metadata: {
      metricId: options.id,
      rawKind: 'count',
      count: options.count,
      ...(options.countedNodeIds
        ? { countedNodeIds: options.countedNodeIds }
        : {}),
      ...(options.countedRelationIds
        ? { countedRelationIds: options.countedRelationIds }
        : {}),
      ...(options.countedSignalIds
        ? { countedSignalIds: options.countedSignalIds }
        : {}),
      ...(options.countedDiagnosticIds
        ? { countedDiagnosticIds: options.countedDiagnosticIds }
        : {}),
    },
  };
}
