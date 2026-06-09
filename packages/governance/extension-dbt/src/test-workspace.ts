import type {
  GovernanceCompatibilityWorkspace,
  GovernanceDependency,
  GovernanceProject,
  GovernanceRelation,
} from '@anarchitects/governance-core';

export type LegacyWorkspaceDependency = GovernanceDependency & {
  metadata?: Record<string, unknown>;
};

export type LegacyWorkspaceInput = {
  id: string;
  name: string;
  root: string;
  projects: GovernanceProject[];
  dependencies: LegacyWorkspaceDependency[];
};

export function createCompatibilityWorkspace(
  workspace: LegacyWorkspaceInput,
): GovernanceCompatibilityWorkspace {
  return {
    ...workspace,
    nodes: workspace.projects.map((project) => ({
      id: project.id,
      name: project.name,
      kind: normalizeNodeKind(project.type),
      root: project.root,
      tags: [...project.tags],
      ...(project.domain || project.layer
        ? {
            classification: {
              ...(project.domain ? { domain: project.domain } : {}),
              ...(project.layer ? { layer: project.layer } : {}),
            },
          }
        : {}),
      ...(project.ownership ? { ownership: project.ownership } : {}),
      metadata: { ...project.metadata },
    })),
    relations: workspace.dependencies.map((dependency, index) =>
      dependencyToRelation(dependency, index),
    ),
  };
}

function dependencyToRelation(
  dependency: LegacyWorkspaceDependency,
  index: number,
): GovernanceRelation {
  return {
    id: `compat:${dependency.source}->${dependency.target}:dependency:${index}`,
    sourceNodeId: dependency.source,
    targetNodeId: dependency.target,
    kind: 'dependency',
    metadata: {
      dependencyType: dependency.type,
      ...(dependency.sourceFile ? { sourceFile: dependency.sourceFile } : {}),
      ...(dependency.metadata ? dependency.metadata : {}),
    },
  };
}

function normalizeNodeKind(
  type: GovernanceProject['type'],
): string {
  if (type === 'application') return 'application';
  if (type === 'library') return 'library';
  if (type === 'tool') return 'tool';
  return 'unknown';
}
