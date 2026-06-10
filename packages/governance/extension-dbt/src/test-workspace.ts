import type {
  GovernanceNode,
  GovernanceRelation,
  GovernanceWorkspace,
} from '@anarchitects/governance-core';

export type LegacyWorkspaceOwnership = NonNullable<GovernanceNode['ownership']>;

export type LegacyWorkspaceDependency = {
  source: string;
  target: string;
  type: 'static' | 'dynamic' | 'implicit' | 'unknown';
  sourceFile?: string;
  metadata?: Record<string, unknown>;
};

export type LegacyWorkspaceProject = {
  id: string;
  name: string;
  root: string;
  type: 'application' | 'library' | 'tool' | 'unknown';
  tags: string[];
  domain?: string;
  layer?: string;
  ownership?: LegacyWorkspaceOwnership;
  metadata: Record<string, unknown>;
};

export type LegacyWorkspaceInput = {
  id: string;
  name: string;
  root: string;
  projects: LegacyWorkspaceProject[];
  dependencies: LegacyWorkspaceDependency[];
};

export function createCompatibilityWorkspace(
  legacyWorkspace: LegacyWorkspaceInput,
): GovernanceWorkspace {
  return {
    id: legacyWorkspace.id,
    name: legacyWorkspace.name,
    root: legacyWorkspace.root,
    nodes: legacyWorkspace.projects.map((project) => projectToNode(project)),
    relations: legacyWorkspace.dependencies.map((dependency, index) =>
      dependencyToRelation(dependency, index),
    ),
  };
}

function projectToNode(project: LegacyWorkspaceProject): GovernanceNode {
  return {
    id: project.id,
    name: project.name,
    kind: normalizeNodeKind(project),
    technology: 'dbt',
    sourceSystem: 'dbt',
    root: project.root,
    path: project.root,
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
  };
}

function dependencyToRelation(
  dependency: LegacyWorkspaceDependency,
  index: number,
): GovernanceRelation {
  const relationKind = normalizeRelationKind(dependency);

  return {
    id: buildRelationId(dependency, relationKind, index),
    sourceNodeId: dependency.source,
    targetNodeId: dependency.target,
    kind: relationKind,
    metadata: {
      dependencyType: dependency.type,
      ...(dependency.sourceFile ? { sourceFile: dependency.sourceFile } : {}),
      ...(dependency.metadata ? dependency.metadata : {}),
    },
  };
}

function normalizeNodeKind(project: LegacyWorkspaceProject): string {
  const resourceType = readStringMetadata(project.metadata, [
    'dbt',
    'identity',
    'resourceType',
  ]);
  if (resourceType) {
    return `dbt-${resourceType.replaceAll('_', '-')}`;
  }

  if (project.id.startsWith('model.')) return 'dbt-model';
  if (project.id.startsWith('source.')) return 'dbt-source';
  if (project.id.startsWith('seed.')) return 'dbt-seed';
  if (project.id.startsWith('snapshot.')) return 'dbt-snapshot';
  if (project.id.startsWith('exposure.')) return 'dbt-exposure';
  if (project.type === 'application') return 'dbt-project';
  if (project.type === 'tool') return 'dbt-source';
  return 'dbt-model';
}

function normalizeRelationKind(dependency: LegacyWorkspaceDependency): string {
  return (
    readStringMetadata(dependency.metadata ?? {}, [
      'dbt',
      'lineage',
      'relationKind',
    ]) ?? 'lineage'
  );
}

function buildRelationId(
  dependency: LegacyWorkspaceDependency,
  relationKind: string,
  index: number,
): string {
  if (relationKind === 'lineage' || relationKind === 'dependency') {
    return `dbt:${relationKind}:${dependency.source}->${dependency.target}`;
  }

  return `dbt:${relationKind}:${dependency.source}->${dependency.target}:${index}`;
}

function readStringMetadata(
  metadata: Record<string, unknown>,
  path: readonly string[],
): string | undefined {
  let current: unknown = metadata;

  for (const segment of path) {
    if (
      typeof current !== 'object' ||
      current === null ||
      !(segment in current)
    ) {
      return undefined;
    }
    current = current[segment as keyof typeof current];
  }

  return typeof current === 'string' && current.length > 0
    ? current
    : undefined;
}
