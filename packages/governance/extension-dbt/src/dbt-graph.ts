import type {
  GovernanceNode,
  GovernanceRelation,
  GovernanceRuntimeReference,
  GovernanceWorkspace,
} from '@anarchitects/governance-core';

import type { DbtGovernanceMetadataResolverInput } from './resolvers.js';

const DBT_RELATION_KINDS = new Set([
  'dependency',
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
  return (
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
  subject: { metadata?: Record<string, unknown> } | undefined,
): Record<string, unknown> | undefined {
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
    metadata: node.metadata,
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
