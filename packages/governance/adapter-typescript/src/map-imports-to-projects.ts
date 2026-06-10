import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { GovernanceRelationInput } from '@anarchitects/governance-core';

import {
  ambiguousProjectMatchDiagnostic,
  resolvedImportOutsideProjectDiagnostic,
  sourceFileOutsideProjectDiagnostic,
  unresolvedInternalImportDiagnostic,
} from './diagnostics.js';
import type {
  TypeScriptDiscoveredProject,
  TypeScriptImportEdge,
  TypeScriptImportGraph,
  TypeScriptProjectRelationMappingResult,
  TypeScriptWorkspaceDetectionDiagnostic,
} from './types.js';

type ProjectMatch =
  | { status: 'matched'; project: TypeScriptDiscoveredProject }
  | { status: 'outside' }
  | { status: 'ambiguous'; projects: TypeScriptDiscoveredProject[] };

const TYPESCRIPT_IMPORT_SOURCE = {
  id: 'typescript-import-graph',
  name: 'TypeScript import graph',
  type: 'analysis',
} as const;

export function mapTypeScriptImportsToGovernanceDependencies(options: {
  workspaceRoot: string;
  projects: readonly TypeScriptDiscoveredProject[];
  importGraph: TypeScriptImportGraph;
}): TypeScriptProjectRelationMappingResult {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
  const relations: GovernanceRelationInput[] = [];
  const relationKeys = new Set<string>();
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

    const relation = createImportRelation(
      sourceMatch.project.id,
      targetProject.id,
      edge,
    );
    const relationKey = [
      relation.sourceNodeId,
      relation.targetNodeId,
      relation.kind ?? 'unknown',
      edge.specifier,
    ].join('::');

    if (relationKeys.has(relationKey)) {
      continue;
    }

    relationKeys.add(relationKey);
    relations.push(relation);
  }

  return {
    relations: relations.sort((left, right) => {
      return (
        left.sourceNodeId.localeCompare(right.sourceNodeId) ||
        left.targetNodeId.localeCompare(right.targetNodeId) ||
        (left.kind ?? '').localeCompare(right.kind ?? '') ||
        relationSourceFile(left).localeCompare(relationSourceFile(right))
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
  projects: readonly TypeScriptDiscoveredProject[];
  packageNameToProject: Map<string, TypeScriptDiscoveredProject[]>;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}): TypeScriptDiscoveredProject | undefined {
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
  projects: readonly TypeScriptDiscoveredProject[],
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
  projects: readonly TypeScriptDiscoveredProject[],
): Map<string, TypeScriptDiscoveredProject[]> {
  const packageNameToProject = new Map<string, TypeScriptDiscoveredProject[]>();
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

function createImportRelation(
  sourceNodeId: string,
  targetNodeId: string,
  edge: TypeScriptImportEdge,
): GovernanceRelationInput {
  return {
    id: buildTypeScriptImportRelationId(sourceNodeId, targetNodeId, edge),
    sourceNodeId,
    targetNodeId,
    kind: 'import',
    source: TYPESCRIPT_IMPORT_SOURCE,
    authority: 'discovered',
    confidence: 1,
    metadata: {
      typescript: {
        import: {
          sourceFile: edge.sourceFile,
          specifier: edge.specifier,
          importKind: edge.kind,
          external: edge.external,
          ...(edge.resolvedFile ? { resolvedFile: edge.resolvedFile } : {}),
        },
      },
    },
  };
}

function buildTypeScriptImportRelationId(
  sourceNodeId: string,
  targetNodeId: string,
  edge: TypeScriptImportEdge,
): string {
  return `typescript:import:${sourceNodeId}->${targetNodeId}:${edge.kind}:${edge.specifier}`;
}

function relationSourceFile(relation: GovernanceRelationInput): string {
  const metadata = relation.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return '';
  }

  const typescript = (metadata as Record<string, unknown>).typescript;
  if (
    !typescript ||
    typeof typescript !== 'object' ||
    Array.isArray(typescript)
  ) {
    return '';
  }

  const importMetadata = (typescript as Record<string, unknown>).import;
  if (
    !importMetadata ||
    typeof importMetadata !== 'object' ||
    Array.isArray(importMetadata)
  ) {
    return '';
  }

  const sourceFile = (importMetadata as Record<string, unknown>).sourceFile;
  return typeof sourceFile === 'string' ? sourceFile : '';
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
