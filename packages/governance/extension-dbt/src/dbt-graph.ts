import type {
  GovernanceExtensionModelExpansionCarrier,
  GovernanceNode,
  GovernanceRelation,
  GovernanceRuntimeReference,
  GovernanceWorkspace,
} from '@anarchitects/governance-core';

import type {
  DbtGovernanceModelExpansionData,
  DbtGovernanceNodeExpansionData,
  DbtGovernanceRelationExpansionData,
} from './contracts.js';
import { getDbtGovernanceModelExpansion } from './contracts.js';
import type { DbtGovernanceMetadataResolverInput } from './resolvers.js';

const DBT_RELATION_KINDS = new Set([
  'dependency',
  'traceability',
  'exposes',
  'lineage',
  'tests',
  'uses-package',
]);

const DBT_DEPENDENCY_RELATION_KINDS = new Set(['dependency', 'lineage']);

export function getDbtNodes(workspace: GovernanceWorkspace): GovernanceNode[] {
  return workspace.nodes.filter((node) => isDbtNode(node));
}

export function getDbtRelations(
  workspace: GovernanceWorkspace,
): GovernanceRelation[] {
  const nodeById = indexNodesById(workspace.nodes);

  return workspace.relations.filter((relation) =>
    isDbtRelation(relation, nodeById),
  );
}

export function getDbtDependencyRelations(
  workspace: GovernanceWorkspace,
): GovernanceRelation[] {
  return getDbtRelations(workspace).filter((relation) =>
    isDbtDependencyRelation(relation),
  );
}

export function isDbtNode(node: GovernanceNode): boolean {
  const expansion = getDbtNodeExpansionData(node);

  return (
    expansion?.technology === 'dbt' ||
    node.technology === 'dbt' ||
    node.sourceSystem === 'dbt' ||
    node.kind.startsWith('dbt-') ||
    hasDbtMetadata(node.metadata)
  );
}

export function isDbtRelation(
  relation: GovernanceRelation,
  nodeById: ReadonlyMap<string, GovernanceNode>,
): boolean {
  const expansion = getDbtRelationExpansionData(relation);
  if (expansion?.technology === 'dbt') {
    return true;
  }

  if (hasDbtMetadata(relation.metadata)) {
    return true;
  }

  if (!DBT_RELATION_KINDS.has(relation.kind)) {
    return false;
  }

  const sourceNode = nodeById.get(relation.sourceNodeId);
  const targetNode = nodeById.get(relation.targetNodeId);

  return Boolean(
    sourceNode && targetNode && isDbtNode(sourceNode) && isDbtNode(targetNode),
  );
}

export function isDbtDependencyRelation(relation: GovernanceRelation): boolean {
  const expansion = getDbtRelationExpansionData(relation);
  if (expansion) {
    return DBT_DEPENDENCY_RELATION_KINDS.has(expansion.relationKind);
  }

  return DBT_DEPENDENCY_RELATION_KINDS.has(relation.kind);
}

export function findNodeById(
  workspace: GovernanceWorkspace,
  nodeId: string,
): GovernanceNode | undefined {
  return workspace.nodes.find((node) => node.id === nodeId);
}

export function hasDbtMetadata(
  metadata: unknown,
): metadata is Record<string, unknown> {
  return isRecord(metadata) && isRecord(metadata.dbt);
}

export function getDbtMetadata(
  subject:
    | {
        metadata?: Record<string, unknown>;
        extensions?: Record<string, unknown>;
      }
    | undefined,
): Record<string, unknown> | undefined {
  const expansion = getDbtExpansionData(
    subject as GovernanceExtensionModelExpansionCarrier | undefined,
  );

  if (expansion?.kind === 'workspace') {
    return buildWorkspaceDbtMetadata(expansion);
  }

  if (expansion?.kind === 'node') {
    return buildNodeDbtMetadata(expansion);
  }

  if (expansion?.kind === 'relation') {
    return buildRelationDbtMetadata(expansion);
  }

  return asRecord(subject?.metadata?.dbt);
}

export function toResolverInput(
  node: GovernanceNode,
): DbtGovernanceMetadataResolverInput {
  return {
    id: node.id,
    name: node.name,
    root: node.root,
    path: node.path,
    tags: node.tags,
    domain: readClassificationValue(node, 'domain', 'scope'),
    layer: readClassificationValue(node, 'layer'),
    ownership: node.ownership,
    metadata: getDbtMetadata(node)
      ? { dbt: getDbtMetadata(node) }
      : node.metadata,
  };
}

export function toNodeReference(nodeId: string): GovernanceRuntimeReference {
  return { nodeId };
}

export function toRelationReference(
  relation: GovernanceRelation,
): GovernanceRuntimeReference {
  return {
    nodeId: relation.sourceNodeId,
    relationId: relation.id,
    relatedNodeIds: normalizeIds([
      relation.sourceNodeId,
      relation.targetNodeId,
    ]),
    relatedRelationIds: [relation.id],
  };
}

export function toRelationKey(relation: GovernanceRelation): string {
  return `${relation.sourceNodeId}->${relation.targetNodeId}`;
}

export function readClassificationValue(
  node: GovernanceNode,
  ...keys: string[]
): string | undefined {
  const classification = node.classification;
  if (!classification) {
    return undefined;
  }

  for (const key of keys) {
    const value = classification[key as keyof typeof classification];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

export function normalizeIds(ids: readonly (string | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))].sort();
}

function indexNodesById(
  nodes: readonly GovernanceNode[],
): ReadonlyMap<string, GovernanceNode> {
  return new Map(nodes.map((node) => [node.id, node] as const));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getDbtExpansionData(
  subject: GovernanceExtensionModelExpansionCarrier | undefined,
): DbtGovernanceModelExpansionData | undefined {
  return getDbtGovernanceModelExpansion(subject)?.data;
}

function getDbtNodeExpansionData(
  subject: GovernanceExtensionModelExpansionCarrier | undefined,
): DbtGovernanceNodeExpansionData | undefined {
  const expansion = getDbtExpansionData(subject);
  return expansion?.kind === 'node' ? expansion : undefined;
}

function getDbtRelationExpansionData(
  subject: GovernanceExtensionModelExpansionCarrier | undefined,
): DbtGovernanceRelationExpansionData | undefined {
  const expansion = getDbtExpansionData(subject);
  return expansion?.kind === 'relation' ? expansion : undefined;
}

function buildWorkspaceDbtMetadata(
  expansion: Extract<DbtGovernanceModelExpansionData, { kind: 'workspace' }>,
): Record<string, unknown> {
  return {
    ...(expansion.projectName
      ? {
          project: {
            name: expansion.projectName,
            ...(expansion.projectVersion !== undefined
              ? { version: expansion.projectVersion }
              : {}),
            ...(expansion.profile ? { profile: expansion.profile } : {}),
            ...(expansion.configVersion !== undefined
              ? { configVersion: expansion.configVersion }
              : {}),
          },
        }
      : {}),
    ...(expansion.manifest ? { manifest: expansion.manifest } : {}),
    ...(expansion.artifactPaths ? { paths: expansion.artifactPaths } : {}),
  };
}

function buildNodeDbtMetadata(
  expansion: DbtGovernanceNodeExpansionData,
): Record<string, unknown> | undefined {
  return {
    ...(expansion.identity ? { identity: expansion.identity } : {}),
    ...(expansion.project ? { project: expansion.project } : {}),
    ...(expansion.resource ? { resource: expansion.resource } : {}),
    ...(expansion.relation ? { relation: expansion.relation } : {}),
    ...(expansion.validation ? { validation: expansion.validation } : {}),
    ...(expansion.documentation
      ? { documentation: expansion.documentation }
      : {}),
  };
}

function buildRelationDbtMetadata(
  expansion: DbtGovernanceRelationExpansionData,
): Record<string, unknown> | undefined {
  return {
    ...(expansion.source ? { source: expansion.source } : {}),
    ...(expansion.target ? { target: expansion.target } : {}),
    ...(expansion.lineage
      ? {
          lineage: {
            relationKind: expansion.relationKind,
            ...expansion.lineage,
          },
        }
      : { lineage: { relationKind: expansion.relationKind } }),
  };
}
