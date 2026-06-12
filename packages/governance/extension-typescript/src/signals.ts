import { createHash } from 'node:crypto';

import type {
  GovernanceSignal,
  GovernanceSignalCategory,
  GovernanceSignalSeverity,
  GovernanceSignalType,
} from '@anarchitects/governance-core';

import type {
  TypeScriptGovernanceSignalProvider,
  TypeScriptGovernanceSignalProviderInput,
} from './contracts.js';
import {
  findNodeById,
  getDependencyRelations,
  getImportRelations,
  getPackageManagerMetadata,
  getPathMappingRelations,
  getTypeScriptMetadata,
  getTypeScriptProjectNodes,
  normalizeIds,
  readBooleanMetadata,
  readStringMetadata,
} from './graph.js';
import { buildTypeScriptGovernanceDiagnostics } from './diagnostics.js';

export const TYPESCRIPT_GOVERNANCE_SIGNAL_SOURCE =
  'governance.typescript_extension';

export const TYPESCRIPT_GOVERNANCE_SIGNAL_CODES = [
  'TYPESCRIPT_IMPORT_RELATION_DETECTED',
  'TYPESCRIPT_PATH_MAPPING_RESOLVED',
  'TYPESCRIPT_EXTERNAL_PACKAGE_DEPENDENCY_DETECTED',
  'TYPESCRIPT_HIGH_IMPORT_FAN_IN',
  'TYPESCRIPT_PATH_MAPPING_UNRESOLVED',
] as const;

export type TypeScriptGovernanceSignalCode =
  (typeof TYPESCRIPT_GOVERNANCE_SIGNAL_CODES)[number];

export interface TypeScriptGovernanceSignalMetadata
  extends Record<string, unknown> {
  code: TypeScriptGovernanceSignalCode;
  sourceFile?: string;
  specifier?: string;
  importKind?: string;
  alias?: string;
  dependencyType?: string;
  packageName?: string;
  threshold?: number;
  fanIn?: number;
  relatedDiagnosticIds?: string[];
  relatedDiagnosticCodes?: string[];
}

export interface TypeScriptGovernanceExtensionSignal extends GovernanceSignal {
  metadata?: TypeScriptGovernanceSignalMetadata;
}

export interface TypeScriptGovernanceSignalProviderOptions {
  highFanInThreshold?: number;
}

interface SignalDraft {
  code: TypeScriptGovernanceSignalCode;
  type: GovernanceSignalType;
  severity: GovernanceSignalSeverity;
  category: GovernanceSignalCategory;
  message: string;
  nodeId?: string;
  relationId?: string;
  relatedNodeIds: string[];
  relatedRelationIds?: string[];
  metadata?: Omit<TypeScriptGovernanceSignalMetadata, 'code'>;
  identityParts: readonly string[];
}

const DEFAULT_PROVIDER_ID = 'typescript-governance-signals';
const DEFAULT_SIGNAL_CREATED_AT = '1970-01-01T00:00:00.000Z';
const DEFAULT_HIGH_FAN_IN_THRESHOLD = 3;

export const typescriptGovernanceSignalProvider =
  createTypeScriptGovernanceSignalProvider();

export function createTypeScriptGovernanceSignalProvider(
  options: TypeScriptGovernanceSignalProviderOptions = {},
): TypeScriptGovernanceSignalProvider {
  return {
    id: DEFAULT_PROVIDER_ID,
    provideSignals: (input) => buildTypeScriptGovernanceSignals(input, options),
  };
}

export function buildTypeScriptGovernanceSignals(
  input: TypeScriptGovernanceSignalProviderInput,
  options: TypeScriptGovernanceSignalProviderOptions = {},
): TypeScriptGovernanceExtensionSignal[] {
  const diagnostics =
    input.diagnostics && input.diagnostics.length > 0
      ? input.diagnostics
      : buildTypeScriptGovernanceDiagnostics({
          ...input,
          diagnostics: [],
          measurements: [],
          violations: input.violations ?? [],
        });
  const highFanInThreshold =
    options.highFanInThreshold ?? DEFAULT_HIGH_FAN_IN_THRESHOLD;
  const drafts: SignalDraft[] = [];

  for (const relation of getImportRelations(input.workspace)) {
    drafts.push({
      code: 'TYPESCRIPT_IMPORT_RELATION_DETECTED',
      type: 'structural-dependency',
      severity: 'info',
      category: 'dependency',
      message: `TypeScript import relation detected: ${relation.sourceNodeId} -> ${relation.targetNodeId}.`,
      nodeId: relation.sourceNodeId,
      relationId: relation.id,
      relatedNodeIds: normalizeIds([
        relation.sourceNodeId,
        relation.targetNodeId,
      ]),
      relatedRelationIds: [relation.id],
      metadata: {
        sourceFile: readStringMetadata(getTypeScriptMetadata(relation), [
          'import',
          'sourceFile',
        ]),
        specifier: readStringMetadata(getTypeScriptMetadata(relation), [
          'import',
          'specifier',
        ]),
        importKind: readStringMetadata(getTypeScriptMetadata(relation), [
          'import',
          'importKind',
        ]),
      },
      identityParts: ['import', relation.id],
    });
  }

  for (const relation of getPathMappingRelations(input.workspace)) {
    drafts.push({
      code: 'TYPESCRIPT_PATH_MAPPING_RESOLVED',
      type: 'dependency',
      severity: 'info',
      category: 'structure',
      message: `TypeScript path mapping resolved: ${relation.sourceNodeId} -> ${relation.targetNodeId}.`,
      nodeId: relation.targetNodeId,
      relationId: relation.id,
      relatedNodeIds: normalizeIds([
        relation.sourceNodeId,
        relation.targetNodeId,
      ]),
      relatedRelationIds: [relation.id],
      metadata: {
        alias: readStringMetadata(getTypeScriptMetadata(relation), [
          'pathMapping',
          'alias',
        ]),
      },
      identityParts: ['path-mapping', relation.id],
    });
  }

  for (const relation of getDependencyRelations(input.workspace)) {
    const targetNode = findNodeById(input.workspace, relation.targetNodeId);
    if (
      !readBooleanMetadata(getPackageManagerMetadata(targetNode), ['external'])
    ) {
      continue;
    }

    drafts.push({
      code: 'TYPESCRIPT_EXTERNAL_PACKAGE_DEPENDENCY_DETECTED',
      type: 'dependency',
      severity: 'warning',
      category: 'dependency',
      message: `TypeScript workspace dependency targets external package "${relation.targetNodeId}".`,
      nodeId: relation.sourceNodeId,
      relationId: relation.id,
      relatedNodeIds: normalizeIds([
        relation.sourceNodeId,
        relation.targetNodeId,
      ]),
      relatedRelationIds: [relation.id],
      metadata: {
        dependencyType: readStringMetadata(
          getPackageManagerMetadata(relation),
          ['dependencyType'],
        ),
        packageName:
          readStringMetadata(getPackageManagerMetadata(relation), [
            'packageName',
          ]) ?? targetNode?.name,
      },
      identityParts: ['external-dependency', relation.id],
    });
  }

  const importRelationsByTarget = new Map<string, string[]>();
  for (const relation of getImportRelations(input.workspace)) {
    const relationIds =
      importRelationsByTarget.get(relation.targetNodeId) ?? [];
    relationIds.push(relation.id);
    importRelationsByTarget.set(relation.targetNodeId, relationIds);
  }

  for (const node of getTypeScriptProjectNodes(input.workspace)) {
    const relationIds = (importRelationsByTarget.get(node.id) ?? []).sort();
    if (relationIds.length < highFanInThreshold) {
      continue;
    }

    const sourceNodeIds = getImportRelations(input.workspace)
      .filter((relation) => relation.targetNodeId === node.id)
      .map((relation) => relation.sourceNodeId);

    drafts.push({
      code: 'TYPESCRIPT_HIGH_IMPORT_FAN_IN',
      type: 'dependency',
      severity: 'warning',
      category: 'structure',
      message: `TypeScript node "${node.id}" has high import fan-in (${relationIds.length}).`,
      nodeId: node.id,
      relatedNodeIds: normalizeIds([node.id, ...sourceNodeIds]),
      relatedRelationIds: relationIds,
      metadata: {
        threshold: highFanInThreshold,
        fanIn: relationIds.length,
      },
      identityParts: ['high-fan-in', node.id, String(relationIds.length)],
    });
  }

  for (const diagnostic of diagnostics) {
    if (diagnostic.code !== 'TYPESCRIPT_PATH_MAPPING_UNRESOLVED') {
      continue;
    }

    const nodeId = diagnostic.reference?.nodeId;
    if (!nodeId) {
      continue;
    }

    drafts.push({
      code: 'TYPESCRIPT_PATH_MAPPING_UNRESOLVED',
      type: 'missing-domain-context',
      severity: 'warning',
      category: 'structure',
      message: diagnostic.message,
      nodeId,
      relatedNodeIds: [nodeId],
      metadata: {
        alias:
          typeof diagnostic.details?.alias === 'string'
            ? diagnostic.details.alias
            : undefined,
        relatedDiagnosticIds: diagnostic.id ? [diagnostic.id] : [],
        relatedDiagnosticCodes: [diagnostic.code],
      },
      identityParts: [
        'unresolved-path-mapping',
        nodeId,
        String(diagnostic.details?.alias ?? ''),
      ],
    });
  }

  return dedupeAndSortSignals(
    drafts.map((draft) =>
      createSignal(draft, resolveCreatedAt(input.context.options)),
    ),
  );
}

function createSignal(
  draft: SignalDraft,
  createdAt: string,
): TypeScriptGovernanceExtensionSignal {
  const identity = draft.identityParts.join('::');

  return {
    id: `signal:${createHash('sha1').update(identity).digest('hex').slice(0, 12)}`,
    type: draft.type,
    ...(draft.nodeId ? { nodeId: draft.nodeId } : {}),
    ...(draft.relationId ? { relationId: draft.relationId } : {}),
    ...(draft.relatedNodeIds.length > 0
      ? { relatedNodeIds: draft.relatedNodeIds }
      : {}),
    ...(draft.relatedRelationIds && draft.relatedRelationIds.length > 0
      ? { relatedRelationIds: draft.relatedRelationIds }
      : {}),
    severity: draft.severity,
    category: draft.category,
    message: draft.message,
    metadata: {
      code: draft.code,
      ...(draft.metadata ?? {}),
    },
    source: 'extension',
    sourcePluginId: 'governance-extension:typescript',
    createdAt,
  };
}

function dedupeAndSortSignals(
  signals: readonly TypeScriptGovernanceExtensionSignal[],
): TypeScriptGovernanceExtensionSignal[] {
  const byId = new Map<string, TypeScriptGovernanceExtensionSignal>();

  for (const signal of signals) {
    if (!byId.has(signal.id)) {
      byId.set(signal.id, signal);
    }
  }

  return [...byId.values()].sort((left, right) => {
    return (
      left.severity.localeCompare(right.severity) ||
      left.type.localeCompare(right.type) ||
      (left.nodeId ?? '').localeCompare(right.nodeId ?? '') ||
      (left.relationId ?? '').localeCompare(right.relationId ?? '') ||
      left.message.localeCompare(right.message) ||
      left.id.localeCompare(right.id)
    );
  });
}

function resolveCreatedAt(
  options: Readonly<Record<string, unknown>> | undefined,
): string {
  const candidate = options?.['createdAt'];
  return typeof candidate === 'string' && candidate.length > 0
    ? candidate
    : DEFAULT_SIGNAL_CREATED_AT;
}
