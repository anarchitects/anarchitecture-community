import type {
  GovernanceNodeInput,
  GovernanceRelationInput,
  GovernanceWorkspaceAdapterResult,
} from '../adapter/adapter.js';
import type { GovernanceNode, GovernanceRelation } from '../model/models.js';

interface CanonicalGovernanceGraph {
  nodes: GovernanceNode[];
  relations: GovernanceRelation[];
}

export function buildGovernanceNormalizedGraph(
  adapterResult: GovernanceWorkspaceAdapterResult,
): CanonicalGovernanceGraph {
  const nodesById = new Map<string, GovernanceNode>();
  const relationsById = new Map<string, GovernanceRelation>();
  const nodes = adapterResult.nodes ?? adapterResult.workspace?.nodes ?? [];
  const relations =
    adapterResult.relations ?? adapterResult.workspace?.relations ?? [];

  for (const node of nodes) {
    nodesById.set(node.id, normalizeGovernanceNode(node));
  }

  relations.forEach((relation, index) => {
    const normalized = normalizeGovernanceRelation(relation, index);
    relationsById.set(normalized.id, normalized);
  });

  return {
    nodes: [...nodesById.values()],
    relations: [...relationsById.values()],
  };
}

export function normalizeGovernanceNode(
  node: GovernanceNodeInput | GovernanceNode,
): GovernanceNode {
  const normalized: GovernanceNode = {
    id: node.id,
    kind: node.kind ?? 'unknown',
    tags: node.tags ?? [],
    metadata: node.metadata ?? {},
  };

  if (node.name !== undefined) normalized.name = node.name;
  if (node.technology !== undefined) normalized.technology = node.technology;
  if (node.sourceSystem !== undefined) {
    normalized.sourceSystem = node.sourceSystem;
  }
  if (node.root !== undefined) normalized.root = node.root;
  if (node.path !== undefined) normalized.path = node.path;
  if (node.classification !== undefined) {
    normalized.classification = node.classification;
  }
  if (node.ownership !== undefined) normalized.ownership = node.ownership;
  if (node.perspective !== undefined) normalized.perspective = node.perspective;
  if (node.source !== undefined) normalized.source = node.source;
  if (node.evidence !== undefined) normalized.evidence = node.evidence;
  if (node.authority !== undefined) normalized.authority = node.authority;
  if (node.confidence !== undefined) normalized.confidence = node.confidence;

  return normalized;
}

export function normalizeGovernanceRelation(
  relation: GovernanceRelationInput | GovernanceRelation,
  index: number,
): GovernanceRelation {
  const kind = relation.kind ?? 'unknown';

  const normalized: GovernanceRelation = {
    id:
      relation.id ??
      `canonical:${relation.sourceNodeId}->${relation.targetNodeId}:${kind}:${index}`,
    sourceNodeId: relation.sourceNodeId,
    targetNodeId: relation.targetNodeId,
    kind,
    metadata: relation.metadata ?? {},
  };

  if (relation.perspective !== undefined) {
    normalized.perspective = relation.perspective;
  }
  if (relation.source !== undefined) normalized.source = relation.source;
  if (relation.evidence !== undefined) normalized.evidence = relation.evidence;
  if (relation.authority !== undefined) {
    normalized.authority = relation.authority;
  }
  if (relation.confidence !== undefined) {
    normalized.confidence = relation.confidence;
  }

  return normalized;
}
