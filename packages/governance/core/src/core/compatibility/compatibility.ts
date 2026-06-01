import type {
  GovernanceDependencyInput,
  GovernanceNodeInput,
  GovernanceProjectInput,
  GovernanceRelationInput,
} from '../adapter/adapter.js';

export interface GovernanceDependencyToRelationOptions {
  index?: number;
}

/**
 * Transitional compatibility mapping from the legacy project input contract to
 * the canonical node input contract. This keeps legacy adapters valid while
 * Phase 2 migrates adapters and hosts to native node output.
 */
export function governanceProjectToNode(
  project: GovernanceProjectInput,
): GovernanceNodeInput {
  const node: GovernanceNodeInput = {
    id: project.id,
    kind: project.type ?? 'project',
    tags: project.tags ?? [],
    metadata: project.metadata ?? {},
  };

  if (project.name !== undefined) node.name = project.name;
  if (project.root !== undefined) node.root = project.root;

  const classification = governanceProjectClassification(project);
  if (classification !== undefined) {
    node.classification = classification;
  }

  if (project.ownership !== undefined) {
    node.ownership = project.ownership;
  }

  return node;
}

export function governanceProjectsToNodes(
  projects: readonly GovernanceProjectInput[] = [],
): GovernanceNodeInput[] {
  return projects.map((project) => governanceProjectToNode(project));
}

/**
 * Transitional compatibility mapping from the legacy dependency input contract
 * to the canonical relation input contract.
 */
export function governanceDependencyToRelation(
  dependency: GovernanceDependencyInput,
  options: GovernanceDependencyToRelationOptions = {},
): GovernanceRelationInput {
  const metadata = {
    ...(dependency.metadata ?? {}),
    ...(dependency.type !== undefined
      ? { dependencyType: dependency.type }
      : {}),
    ...(dependency.sourceFile !== undefined
      ? { sourceFile: dependency.sourceFile }
      : {}),
  };
  const relation: GovernanceRelationInput = {
    sourceNodeId: dependency.sourceProjectId,
    targetNodeId: dependency.targetProjectId,
    kind: 'dependency',
    metadata,
  };

  if (options.index !== undefined) {
    relation.id = governanceDependencyRelationId(dependency, options.index);
  }

  return relation;
}

export function governanceDependenciesToRelations(
  dependencies: readonly GovernanceDependencyInput[] = [],
): GovernanceRelationInput[] {
  return dependencies.map((dependency, index) =>
    governanceDependencyToRelation(dependency, { index }),
  );
}

export const projectToNode = governanceProjectToNode;
export const projectsToNodes = governanceProjectsToNodes;
export const dependencyToRelation = governanceDependencyToRelation;
export const dependenciesToRelations = governanceDependenciesToRelations;

function governanceProjectClassification(
  project: GovernanceProjectInput,
): GovernanceNodeInput['classification'] | undefined {
  if (
    project.domain === undefined &&
    project.layer === undefined &&
    project.scope === undefined
  ) {
    return undefined;
  }

  return {
    ...(project.domain !== undefined ? { domain: project.domain } : {}),
    ...(project.layer !== undefined ? { layer: project.layer } : {}),
    ...(project.scope !== undefined ? { scope: project.scope } : {}),
  };
}

function governanceDependencyRelationId(
  dependency: GovernanceDependencyInput,
  index: number,
): string {
  return `legacy:${dependency.sourceProjectId}->${dependency.targetProjectId}:${
    dependency.type ?? 'dependency'
  }:${index}`;
}
