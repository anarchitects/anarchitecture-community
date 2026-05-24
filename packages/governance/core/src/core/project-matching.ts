import type { GovernanceProject } from './models.js';

export interface ResolveAffectedGovernanceProjectsOptions {
  projects: readonly GovernanceProject[];
  changedFiles: readonly string[];
}

export function resolveAffectedGovernanceProjects(
  options: ResolveAffectedGovernanceProjectsOptions,
): GovernanceProject[] {
  const normalizedChangedFiles = options.changedFiles
    .map(normalizePortablePath)
    .filter((changedFile) => changedFile.length > 0);

  if (normalizedChangedFiles.length === 0) {
    return [];
  }

  return options.projects
    .filter((project) =>
      matchesChangedFiles(
        normalizePortablePath(project.root),
        normalizedChangedFiles,
      ),
    )
    .sort(compareProjectsByName);
}

function matchesChangedFiles(
  normalizedProjectRoot: string,
  normalizedChangedFiles: readonly string[],
): boolean {
  if (normalizedProjectRoot.length === 0) {
    return normalizedChangedFiles.length > 0;
  }

  return normalizedChangedFiles.some(
    (changedFile) =>
      changedFile === normalizedProjectRoot ||
      changedFile.startsWith(`${normalizedProjectRoot}/`),
  );
}

function normalizePortablePath(value: string): string {
  let normalized = value.trim().replaceAll('\\', '/');

  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  normalized = normalized.replace(/\/+/g, '/').replace(/\/+$/g, '');

  return normalized === '.' ? '' : normalized;
}

function compareProjectsByName(
  left: GovernanceProject,
  right: GovernanceProject,
): number {
  return (
    left.name.localeCompare(right.name) ||
    left.root.localeCompare(right.root) ||
    left.id.localeCompare(right.id)
  );
}
