import type {
  GovernanceDependencyInput,
  GovernanceProjectInput,
} from '../adapter/adapter.js';
import type {
  GovernanceCompatibilityWorkspace,
  GovernanceDependency,
  GovernanceNode,
  GovernanceProject,
  GovernanceRelation,
  GovernanceWorkspace,
  Ownership,
} from '../model/models.js';
import { buildGovernanceNormalizedGraph } from '../graph/internal-normalization.js';

export function toGovernanceCompatibilityWorkspace(
  workspace: GovernanceWorkspace,
): GovernanceCompatibilityWorkspace {
  const compatibilityWorkspace =
    workspace as Partial<GovernanceCompatibilityWorkspace>;
  const graph =
    compatibilityWorkspace.nodes && compatibilityWorkspace.relations
      ? {
          nodes: compatibilityWorkspace.nodes,
          relations: compatibilityWorkspace.relations,
        }
      : buildGovernanceNormalizedGraph({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          workspaceRoot: workspace.root,
          projects: workspace.projects.map(toProjectInput),
          dependencies: workspace.dependencies.map(toDependencyInput),
        });

  return {
    ...workspace,
    nodes: graph.nodes,
    relations: graph.relations,
    projects:
      compatibilityWorkspace.projects ?? governanceNodesToProjects(graph.nodes),
    dependencies:
      compatibilityWorkspace.dependencies ??
      governanceRelationsToDependencies(graph.relations),
  };
}

export function governanceNodesToProjects(
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

export function governanceRelationsToDependencies(
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

function toProjectInput(project: GovernanceProject): GovernanceProjectInput {
  return {
    id: project.id,
    name: project.name,
    root: project.root,
    type: project.type,
    domain: project.domain,
    layer: project.layer,
    tags: project.tags,
    ownership: project.ownership,
    metadata: project.metadata,
  };
}

function toDependencyInput(
  dependency: GovernanceDependency,
): GovernanceDependencyInput {
  return {
    sourceProjectId: dependency.source,
    targetProjectId: dependency.target,
    type: dependency.type,
    sourceFile: dependency.sourceFile,
  };
}
