import type {
  GovernanceCompatibilityWorkspace,
  GovernanceDependency,
  GovernanceNode,
  GovernanceProject,
  GovernanceRelation,
  GovernanceWorkspace,
  Ownership,
} from '@anarchitects/governance-core';

export function toCompatibilityWorkspace(
  workspace: GovernanceWorkspace,
): GovernanceCompatibilityWorkspace {
  const compatibilityWorkspace =
    workspace as Partial<GovernanceCompatibilityWorkspace>;

  return {
    ...workspace,
    projects:
      compatibilityWorkspace.projects ??
      governanceNodesToProjects(workspace.nodes),
    dependencies:
      compatibilityWorkspace.dependencies ??
      governanceRelationsToDependencies(workspace.relations),
  };
}

function governanceNodesToProjects(
  nodes: readonly GovernanceNode[],
): GovernanceProject[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name ?? node.id,
    root: node.root ?? node.path ?? '',
    type: normalizeProjectType(node.kind),
    tags: node.tags,
    domain: readClassificationValue(node, 'domain', 'scope'),
    layer: readClassificationValue(node, 'layer'),
    ownership: resolveOwnership(node),
    metadata: node.metadata,
  }));
}

function governanceRelationsToDependencies(
  relations: readonly GovernanceRelation[],
): GovernanceDependency[] {
  return relations
    .filter((relation) => relation.kind === 'dependency')
    .map((relation) => ({
      source: relation.sourceNodeId,
      target: relation.targetNodeId,
      type: normalizeDependencyType(
        readStringMetadata(relation, 'dependencyType'),
      ),
      sourceFile: readStringMetadata(relation, 'sourceFile'),
    }));
}

function readClassificationValue(
  node: GovernanceNode,
  ...keys: string[]
): string | undefined {
  if (!node.classification) {
    return undefined;
  }

  for (const key of keys) {
    const value = node.classification[key as keyof typeof node.classification];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function resolveOwnership(node: GovernanceNode): Ownership | undefined {
  if (!node.ownership) {
    return undefined;
  }

  const source = normalizeOwnershipSource(node.ownership.source);

  return {
    ...(node.ownership.team !== undefined ? { team: node.ownership.team } : {}),
    ...(node.ownership.contacts !== undefined
      ? { contacts: node.ownership.contacts }
      : {}),
    source,
  };
}

function normalizeOwnershipSource(
  source: string | undefined,
): Ownership['source'] {
  if (
    source === 'project-metadata' ||
    source === 'codeowners' ||
    source === 'merged' ||
    source === 'none'
  ) {
    return source;
  }

  return source ? 'project-metadata' : 'none';
}

function normalizeProjectType(kind: string): GovernanceProject['type'] {
  if (kind === 'application' || kind === 'app') return 'application';
  if (kind === 'library' || kind === 'lib') return 'library';
  if (kind === 'tool') return 'tool';
  return 'unknown';
}

function normalizeDependencyType(
  type: string | undefined,
): GovernanceDependency['type'] {
  if (type === 'static' || type === 'dynamic' || type === 'implicit') {
    return type;
  }

  return 'unknown';
}

function readStringMetadata(
  relation: GovernanceRelation,
  key: string,
): string | undefined {
  const value = relation.metadata[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
