import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  GovernanceDependencyInput,
  GovernanceProjectInput,
} from '@anarchitects/governance-core';

import {
  ambiguousProjectMatchDiagnostic,
  resolvedImportOutsideProjectDiagnostic,
  sourceFileOutsideProjectDiagnostic,
  unresolvedInternalImportDiagnostic,
} from './diagnostics.js';
import type {
  TypeScriptImportEdge,
  TypeScriptImportGraph,
  TypeScriptProjectDependencyMappingResult,
  TypeScriptWorkspaceDetectionDiagnostic,
} from './types.js';

type ProjectMatch =
  | { status: 'matched'; project: GovernanceProjectInput }
  | { status: 'outside' }
  | { status: 'ambiguous'; projects: GovernanceProjectInput[] };

export function mapTypeScriptImportsToGovernanceDependencies(options: {
  workspaceRoot: string;
  projects: readonly GovernanceProjectInput[];
  importGraph: TypeScriptImportGraph;
}): TypeScriptProjectDependencyMappingResult {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
  const dependencies: GovernanceDependencyInput[] = [];
  const dependencyKeys = new Set<string>();
  const sourceMatches = new Map<string, ProjectMatch>();
  const packageNameToProject = readWorkspacePackageProjectMap(
    workspaceRoot,
    options.projects,
  );

  for (const file of options.importGraph.files) {
    const match = resolveProjectForFile(file.filePath, options.projects);
    sourceMatches.set(file.filePath, match);

    if (match.status === 'outside') {
      diagnostics.push(
        sourceFileOutsideProjectDiagnostic(
          filePointer(file.filePath),
          file.filePath,
        ),
      );
    } else if (match.status === 'ambiguous') {
      diagnostics.push(
        ambiguousProjectMatchDiagnostic(
          filePointer(file.filePath),
          file.filePath,
          match.projects.map((project) => project.id),
        ),
      );
    }
  }

  for (const edge of options.importGraph.imports) {
    const sourceMatch =
      sourceMatches.get(edge.sourceFile) ??
      resolveProjectForFile(edge.sourceFile, options.projects);

    if (sourceMatch.status !== 'matched') {
      continue;
    }

    const targetProject = resolveTargetProject({
      workspaceRoot,
      edge,
      projects: options.projects,
      packageNameToProject,
      diagnostics,
    });

    if (!targetProject || targetProject.id === sourceMatch.project.id) {
      continue;
    }

    const dependency = createDependency(
      sourceMatch.project.id,
      targetProject.id,
      edge,
    );
    const dependencyKey = [
      dependency.sourceProjectId,
      dependency.targetProjectId,
      dependency.type ?? 'unknown',
    ].join('::');

    if (dependencyKeys.has(dependencyKey)) {
      continue;
    }

    dependencyKeys.add(dependencyKey);
    dependencies.push(dependency);
  }

  return {
    dependencies: dependencies.sort((left, right) => {
      return (
        left.sourceProjectId.localeCompare(right.sourceProjectId) ||
        left.targetProjectId.localeCompare(right.targetProjectId) ||
        (left.type ?? '').localeCompare(right.type ?? '') ||
        (left.sourceFile ?? '').localeCompare(right.sourceFile ?? '')
      );
    }),
    diagnostics,
  };
}

function resolveTargetProject({
  workspaceRoot,
  edge,
  projects,
  packageNameToProject,
  diagnostics,
}: {
  workspaceRoot: string;
  edge: TypeScriptImportEdge;
  projects: readonly GovernanceProjectInput[];
  packageNameToProject: Map<string, GovernanceProjectInput[]>;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}): GovernanceProjectInput | undefined {
  if (edge.resolvedFile) {
    const match = resolveProjectForFile(edge.resolvedFile, projects);

    if (match.status === 'matched') {
      return match.project;
    }

    if (match.status === 'outside') {
      diagnostics.push(
        resolvedImportOutsideProjectDiagnostic(
          importPointer(edge.sourceFile, edge.specifier),
          edge.resolvedFile,
        ),
      );
      return undefined;
    }

    diagnostics.push(
      ambiguousProjectMatchDiagnostic(
        importPointer(edge.sourceFile, edge.specifier),
        edge.resolvedFile,
        match.projects.map((project) => project.id),
      ),
    );
    return undefined;
  }

  if (!edge.external) {
    diagnostics.push(
      unresolvedInternalImportDiagnostic(
        importPointer(edge.sourceFile, edge.specifier),
        edge.sourceFile,
        edge.specifier,
      ),
    );
    return undefined;
  }

  const packageReference = extractPackageReference(edge.specifier);
  if (!packageReference) {
    return undefined;
  }

  const matchingProjects = packageNameToProject.get(packageReference) ?? [];

  if (matchingProjects.length === 0) {
    return undefined;
  }

  if (matchingProjects.length > 1) {
    diagnostics.push(
      ambiguousProjectMatchDiagnostic(
        importPointer(edge.sourceFile, edge.specifier),
        edge.specifier,
        matchingProjects.map((project) => project.id),
      ),
    );
    return undefined;
  }

  const [project] = matchingProjects;

  if (!project.root || !existsSync(path.resolve(workspaceRoot, project.root))) {
    diagnostics.push(
      resolvedImportOutsideProjectDiagnostic(
        importPointer(edge.sourceFile, edge.specifier),
        edge.specifier,
      ),
    );
    return undefined;
  }

  return project;
}

function resolveProjectForFile(
  filePath: string,
  projects: readonly GovernanceProjectInput[],
): ProjectMatch {
  const normalizedFilePath = normalizePath(filePath);
  const matches = projects
    .filter((project) => {
      const root = normalizePath(project.root ?? '');

      return root.length > 0 && isPathWithinRoot(normalizedFilePath, root);
    })
    .sort((left, right) => {
      const leftRoot = normalizePath(left.root ?? '');
      const rightRoot = normalizePath(right.root ?? '');

      return (
        rightRoot.length - leftRoot.length ||
        leftRoot.localeCompare(rightRoot) ||
        left.id.localeCompare(right.id)
      );
    });

  if (matches.length === 0) {
    return { status: 'outside' };
  }

  if (matches.length > 1) {
    return { status: 'ambiguous', projects: matches };
  }

  return { status: 'matched', project: matches[0] };
}

function readWorkspacePackageProjectMap(
  workspaceRoot: string,
  projects: readonly GovernanceProjectInput[],
): Map<string, GovernanceProjectInput[]> {
  const packageNameToProject = new Map<string, GovernanceProjectInput[]>();
  const sortedProjects = [...projects].sort((left, right) => {
    const leftRoot = normalizePath(left.root ?? '');
    const rightRoot = normalizePath(right.root ?? '');

    return leftRoot.localeCompare(rightRoot) || left.id.localeCompare(right.id);
  });

  for (const project of sortedProjects) {
    const projectRoot = project.root
      ? path.resolve(workspaceRoot, project.root)
      : undefined;

    if (!projectRoot) {
      continue;
    }

    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const packageName = readPackageName(packageJsonPath);
    if (!packageName) {
      continue;
    }

    const matches = packageNameToProject.get(packageName) ?? [];
    matches.push(project);
    packageNameToProject.set(packageName, matches);
  }

  return packageNameToProject;
}

function readPackageName(packageJsonPath: string): string | undefined {
  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as unknown;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed) ||
      typeof (parsed as Record<string, unknown>).name !== 'string'
    ) {
      return undefined;
    }

    const packageName = (
      (parsed as Record<string, unknown>).name as string
    ).trim();

    return packageName.length > 0 ? packageName : undefined;
  } catch {
    return undefined;
  }
}

function extractPackageReference(specifier: string): string | undefined {
  const segments = specifier.split('/');

  if (specifier.startsWith('@')) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : undefined;
  }

  return segments[0] || undefined;
}

function createDependency(
  sourceProjectId: string,
  targetProjectId: string,
  edge: TypeScriptImportEdge,
): GovernanceDependencyInput {
  return {
    sourceProjectId,
    targetProjectId,
    type: edge.kind === 'dynamic-import' ? 'dynamic' : 'static',
    sourceFile: edge.sourceFile,
  };
}

function isPathWithinRoot(filePath: string, root: string): boolean {
  return filePath === root || filePath.startsWith(`${root}/`);
}

function normalizePath(value: string): string {
  return value
    .replaceAll('\\', '/')
    .replace(/^\.\/+/u, '')
    .replace(/\/{2,}/gu, '/');
}

function filePointer(filePath: string): string {
  return `/${escapeJsonPointer(filePath)}`;
}

function importPointer(sourceFile: string, specifier: string): string {
  return `/${escapeJsonPointer(sourceFile)}/imports/${escapeJsonPointer(
    specifier,
  )}`;
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
