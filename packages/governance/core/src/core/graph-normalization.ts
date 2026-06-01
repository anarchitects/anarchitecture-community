import type {
  GovernanceDependencyInput,
  GovernanceNodeInput,
  GovernanceProjectInput,
  GovernanceRelationInput,
  GovernanceWorkspaceAdapterResult,
} from './adapter.js';
import {
  governanceDependenciesToRelations,
  governanceProjectsToNodes,
} from './compatibility.js';

export interface GovernanceNormalizedGraph {
  nodes: GovernanceNormalizedNode[];
  relations: GovernanceNormalizedRelation[];
}

export interface GovernanceNormalizedNode {
  id: string;
  name?: string;
  kind: string;
  technology?: string;
  sourceSystem?: string;
  root?: string;
  path?: string;
  tags: string[];
  classification?: GovernanceNodeInput['classification'];
  ownership?: GovernanceNodeInput['ownership'];
  perspective?: GovernanceNodeInput['perspective'];
  source?: GovernanceNodeInput['source'];
  evidence?: GovernanceNodeInput['evidence'];
  authority?: GovernanceNodeInput['authority'];
  confidence?: GovernanceNodeInput['confidence'];
  metadata: Record<string, unknown>;
}

export interface GovernanceNormalizedRelation {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind: string;
  perspective?: GovernanceRelationInput['perspective'];
  source?: GovernanceRelationInput['source'];
  evidence?: GovernanceRelationInput['evidence'];
  authority?: GovernanceRelationInput['authority'];
  confidence?: GovernanceRelationInput['confidence'];
  metadata: Record<string, unknown>;
}

/**
 * Internal graph normalization for the Phase 1 canonical graph transition.
 * It accepts legacy project/dependency fields and additive node/relation fields
 * without changing existing workspace normalization behavior.
 */
export function normalizeGovernanceGraph(
  adapterResult: GovernanceWorkspaceAdapterResult,
): GovernanceNormalizedGraph {
  const nodesById = new Map<string, GovernanceNormalizedNode>();
  const relationsById = new Map<string, GovernanceNormalizedRelation>();

  for (const node of governanceProjectsToNodes(
    resolveProjectInputs(adapterResult),
  )) {
    nodesById.set(node.id, normalizeNode(node));
  }

  for (const node of adapterResult.nodes ?? []) {
    nodesById.set(node.id, normalizeNode(node));
  }

  for (const dependencyRelation of governanceDependenciesToRelations(
    resolveDependencyInputs(adapterResult),
  )) {
    const relation = normalizeRelation(dependencyRelation, 0);
    relationsById.set(relation.id, relation);
  }

  (adapterResult.relations ?? []).forEach((relation, index) => {
    const normalized = normalizeRelation(relation, index);
    relationsById.set(normalized.id, normalized);
  });

  return {
    nodes: [...nodesById.values()],
    relations: [...relationsById.values()],
  };
}

function resolveProjectInputs(
  adapterResult: GovernanceWorkspaceAdapterResult,
): GovernanceProjectInput[] {
  if (adapterResult.projects) {
    return adapterResult.projects;
  }

  if (adapterResult.workspace) {
    return adapterResult.workspace.projects.map((project) => ({
      id: project.id,
      name: project.name,
      root: project.root,
      type: project.type,
      domain: project.domain,
      layer: project.layer,
      tags: project.tags,
      ownership: project.ownership,
      metadata: project.metadata,
    }));
  }

  return [];
}

function resolveDependencyInputs(
  adapterResult: GovernanceWorkspaceAdapterResult,
): GovernanceDependencyInput[] {
  if (adapterResult.dependencies) {
    return adapterResult.dependencies;
  }

  if (adapterResult.workspace) {
    return adapterResult.workspace.dependencies.map((dependency) => ({
      sourceProjectId: dependency.source,
      targetProjectId: dependency.target,
      type: dependency.type,
      sourceFile: dependency.sourceFile,
    }));
  }

  return [];
}

function normalizeNode(node: GovernanceNodeInput): GovernanceNormalizedNode {
  const normalized: GovernanceNormalizedNode = {
    id: node.id,
    kind: node.kind ?? 'unknown',
    tags: node.tags ?? [],
    metadata: node.metadata ?? {},
  };

  if (node.name !== undefined) normalized.name = node.name;
  if (node.technology !== undefined) normalized.technology = node.technology;
  if (node.sourceSystem !== undefined)
    normalized.sourceSystem = node.sourceSystem;
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

function normalizeRelation(
  relation: GovernanceRelationInput,
  index: number,
): GovernanceNormalizedRelation {
  const kind = relation.kind ?? 'unknown';

  const normalized: GovernanceNormalizedRelation = {
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
  if (relation.authority !== undefined)
    normalized.authority = relation.authority;
  if (relation.confidence !== undefined) {
    normalized.confidence = relation.confidence;
  }

  return normalized;
}
