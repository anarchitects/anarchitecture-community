import {
  buildGovernanceWorkspace,
  type GovernanceDependency,
  type GovernanceProject,
  type GovernanceWorkspace,
  type GovernanceWorkspaceAdapter,
  type GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

import { loadGenericWorkspaceAdapterResult } from './internal/manual-workspace/load-workspace.js';

export type AgovDependencyType = GovernanceDependency['type'];

export interface AgovDependenciesFilters {
  source?: string;
  target?: string;
  project?: string;
  type?: AgovDependencyType;
}

export interface AgovDependenciesWorkspace {
  id: string;
  name: string;
  root: string;
}

export interface AgovDependencyEntry {
  source: string;
  target: string;
  type: AgovDependencyType;
  sourceFile?: string;
}

export interface AgovDependenciesProject {
  id: string;
  name: string;
  root: string;
  type: GovernanceProject['type'];
}

export interface AgovDependenciesSummary {
  totalDependencies: number;
  byType: Array<{ type: AgovDependencyType; count: number }>;
  projectCount: number;
  sourceProjectCount: number;
  targetProjectCount: number;
  topOutgoing: Array<{
    projectId: string;
    projectName: string;
    count: number;
  }>;
  topIncoming: Array<{
    projectId: string;
    projectName: string;
    count: number;
  }>;
}

export interface AgovDependenciesResult {
  command: 'dependencies';
  workspace: AgovDependenciesWorkspace;
  dependencies: AgovDependencyEntry[];
  projects: AgovDependenciesProject[];
  summary: AgovDependenciesSummary;
}

export interface AgovDependenciesWithWorkspacePathOptions {
  workspacePath: string;
  workspaceAdapter?: undefined;
  workspaceAdapterInput?: undefined;
  filters?: AgovDependenciesFilters;
}

export interface AgovDependenciesWithAdapterOptions<TInput = unknown> {
  workspaceAdapter: GovernanceWorkspaceAdapter<TInput>;
  workspaceAdapterInput: TInput;
  workspacePath?: undefined;
  filters?: AgovDependenciesFilters;
}

export type AgovDependenciesOptions<TInput = unknown> =
  | AgovDependenciesWithWorkspacePathOptions
  | AgovDependenciesWithAdapterOptions<TInput>;

export async function runAgovDependencies<TInput = unknown>(
  options: AgovDependenciesOptions<TInput>,
): Promise<AgovDependenciesResult> {
  const workspaceAdapterResult = resolveWorkspaceAdapterResult(options);
  const workspace = buildGovernanceWorkspace(workspaceAdapterResult);
  const filteredDependencies = applyDependencyFilters(
    workspace,
    options.filters,
  ).map(normalizeDependency);
  const scopedProjects = collectReferencedProjects(
    workspace.projects,
    filteredDependencies,
  ).map(normalizeProject);

  return {
    command: 'dependencies',
    workspace: {
      id: workspace.id,
      name: workspace.name,
      root: workspace.root,
    },
    dependencies: filteredDependencies,
    projects: scopedProjects,
    summary: buildSummary(filteredDependencies, scopedProjects),
  };
}

function resolveWorkspaceAdapterResult<TInput>(
  options: AgovDependenciesOptions<TInput>,
): GovernanceWorkspaceAdapterResult {
  if ('workspaceAdapter' in options && options.workspaceAdapter) {
    return options.workspaceAdapter.loadWorkspace(
      options.workspaceAdapterInput,
    );
  }

  return loadGenericWorkspaceAdapterResult(options.workspacePath);
}

function applyDependencyFilters(
  workspace: GovernanceWorkspace,
  filters: AgovDependenciesFilters | undefined,
): GovernanceDependency[] {
  if (!filters) {
    return sortDependencies(workspace.dependencies);
  }

  const projectsById = new Map(
    workspace.projects.map((project) => [project.id, project]),
  );

  return sortDependencies(
    workspace.dependencies.filter((dependency) => {
      if (
        filters.source &&
        !matchesProjectFilter(projectsById, dependency.source, filters.source)
      ) {
        return false;
      }

      if (
        filters.target &&
        !matchesProjectFilter(projectsById, dependency.target, filters.target)
      ) {
        return false;
      }

      if (
        filters.project &&
        !matchesProjectFilter(
          projectsById,
          dependency.source,
          filters.project,
        ) &&
        !matchesProjectFilter(projectsById, dependency.target, filters.project)
      ) {
        return false;
      }

      if (filters.type && dependency.type !== filters.type) {
        return false;
      }

      return true;
    }),
  );
}

function matchesProjectFilter(
  projectsById: Map<string, GovernanceProject>,
  projectId: string,
  expected: string,
): boolean {
  if (projectId === expected) {
    return true;
  }

  const project = projectsById.get(projectId);
  return project?.name === expected;
}

function sortDependencies(
  dependencies: GovernanceDependency[],
): GovernanceDependency[] {
  return [...dependencies].sort((left, right) => {
    const bySource = left.source.localeCompare(right.source);
    if (bySource !== 0) {
      return bySource;
    }

    const byTarget = left.target.localeCompare(right.target);
    if (byTarget !== 0) {
      return byTarget;
    }

    const byType = left.type.localeCompare(right.type);
    if (byType !== 0) {
      return byType;
    }

    return (left.sourceFile ?? '').localeCompare(right.sourceFile ?? '');
  });
}

function normalizeDependency(
  dependency: GovernanceDependency,
): AgovDependencyEntry {
  return {
    source: dependency.source,
    target: dependency.target,
    type: dependency.type,
    ...(dependency.sourceFile ? { sourceFile: dependency.sourceFile } : {}),
  };
}

function collectReferencedProjects(
  projects: GovernanceProject[],
  dependencies: AgovDependencyEntry[],
): GovernanceProject[] {
  const referencedProjectIds = new Set<string>();

  for (const dependency of dependencies) {
    referencedProjectIds.add(dependency.source);
    referencedProjectIds.add(dependency.target);
  }

  return [...projects]
    .filter((project) => referencedProjectIds.has(project.id))
    .sort((left, right) => {
      const byName = left.name.localeCompare(right.name);
      if (byName !== 0) {
        return byName;
      }

      return left.id.localeCompare(right.id);
    });
}

function normalizeProject(project: GovernanceProject): AgovDependenciesProject {
  return {
    id: project.id,
    name: project.name,
    root: project.root,
    type: project.type,
  };
}

function buildSummary(
  dependencies: AgovDependencyEntry[],
  projects: AgovDependenciesProject[],
): AgovDependenciesSummary {
  const byTypeMap = countBy(dependencies, (dependency) => dependency.type);
  const sourceCounts = countBy(dependencies, (dependency) => dependency.source);
  const targetCounts = countBy(dependencies, (dependency) => dependency.target);
  const projectsById = new Map(
    projects.map((project) => [project.id, project]),
  );

  return {
    totalDependencies: dependencies.length,
    byType: [...byTypeMap.entries()]
      .map(([type, count]) => ({ type: type as AgovDependencyType, count }))
      .sort((left, right) => left.type.localeCompare(right.type)),
    projectCount: projects.length,
    sourceProjectCount: sourceCounts.size,
    targetProjectCount: targetCounts.size,
    topOutgoing: toTopProjectCounts(sourceCounts, projectsById),
    topIncoming: toTopProjectCounts(targetCounts, projectsById),
  };
}

function countBy<T>(
  values: T[],
  projector: (value: T) => string,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = projector(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function toTopProjectCounts(
  countsByProject: Map<string, number>,
  projectsById: Map<string, AgovDependenciesProject>,
): Array<{ projectId: string; projectName: string; count: number }> {
  return [...countsByProject.entries()]
    .map(([projectId, count]) => ({
      projectId,
      projectName: projectsById.get(projectId)?.name ?? projectId,
      count,
    }))
    .sort((left, right) => {
      const byCount = right.count - left.count;
      if (byCount !== 0) {
        return byCount;
      }

      return left.projectId.localeCompare(right.projectId);
    });
}
