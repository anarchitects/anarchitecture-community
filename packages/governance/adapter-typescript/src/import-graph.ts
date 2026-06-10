import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { unresolvedImportDiagnostic } from './diagnostics.js';
import { parseImportReferences } from './parse-imports.js';
import { discoverTypeScriptSourceFiles } from './source-file-discovery.js';
import type {
  TsConfigResolutionModel,
  TypeScriptDiscoveredProject,
  TypeScriptImportEdge,
  TypeScriptImportGraph,
  TypeScriptSourceFileNode,
  TypeScriptWorkspaceDetectionDiagnostic,
} from './types.js';

const RESOLVABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'] as const;

export function buildTypeScriptImportGraph(options: {
  workspaceRoot: string;
  projects: readonly TypeScriptDiscoveredProject[];
  tsconfig?: TsConfigResolutionModel;
}): TypeScriptImportGraph {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const files = discoverTypeScriptSourceFiles(workspaceRoot, options.projects);
  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
  const imports: TypeScriptImportEdge[] = [];

  for (const file of files) {
    const absoluteFilePath = path.resolve(workspaceRoot, file.filePath);
    const sourceText = readFileSync(absoluteFilePath, 'utf8');
    const parsed = parseImportReferences(sourceText, file.filePath);

    diagnostics.push(...parsed.diagnostics);

    for (let index = 0; index < parsed.imports.length; index += 1) {
      const parsedImport = parsed.imports[index];
      const resolved = resolveImportSpecifier({
        workspaceRoot,
        sourceFile: file.filePath,
        specifier: parsedImport.specifier,
        tsconfig: options.tsconfig,
      });

      diagnostics.push(...resolved.diagnostics);
      imports.push({
        sourceFile: file.filePath,
        specifier: parsedImport.specifier,
        kind: parsedImport.kind,
        external: resolved.external,
        ...(resolved.resolvedFile
          ? { resolvedFile: resolved.resolvedFile }
          : {}),
      });
    }
  }

  return {
    workspaceRoot,
    files: sortSourceFiles(files),
    imports: sortImportEdges(imports),
    diagnostics,
  };
}

function resolveImportSpecifier({
  workspaceRoot,
  sourceFile,
  specifier,
  tsconfig,
}: {
  workspaceRoot: string;
  sourceFile: string;
  specifier: string;
  tsconfig?: TsConfigResolutionModel;
}): {
  resolvedFile?: string;
  external: boolean;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
} {
  if (isRelativeSpecifier(specifier) || specifier.startsWith('/')) {
    const resolvedFile = resolveRelativeSpecifier(
      workspaceRoot,
      sourceFile,
      specifier,
    );

    return resolvedFile
      ? { resolvedFile, external: false, diagnostics: [] }
      : {
          external: false,
          diagnostics: [
            unresolvedImportDiagnostic(
              importPointer(sourceFile, specifier),
              `Import specifier "${specifier}" from "${sourceFile}" could not be resolved.`,
            ),
          ],
        };
  }

  const resolvedAlias = resolveAliasSpecifier(
    workspaceRoot,
    specifier,
    tsconfig,
  );
  if (resolvedAlias.matched) {
    return resolvedAlias.resolvedFile
      ? {
          resolvedFile: resolvedAlias.resolvedFile,
          external: false,
          diagnostics: [],
        }
      : {
          external: false,
          diagnostics: [
            unresolvedImportDiagnostic(
              importPointer(sourceFile, specifier),
              `Import specifier "${specifier}" from "${sourceFile}" could not be resolved.`,
            ),
          ],
        };
  }

  const resolvedBaseUrl = resolveBaseUrlSpecifier(
    workspaceRoot,
    specifier,
    tsconfig,
  );
  if (resolvedBaseUrl) {
    return {
      resolvedFile: resolvedBaseUrl,
      external: false,
      diagnostics: [],
    };
  }

  return {
    external: true,
    diagnostics: [],
  };
}

function resolveRelativeSpecifier(
  workspaceRoot: string,
  sourceFile: string,
  specifier: string,
): string | undefined {
  const sourceDirectory = path.dirname(path.resolve(workspaceRoot, sourceFile));
  const targetBasePath = path.resolve(sourceDirectory, specifier);

  return resolveFilePath(workspaceRoot, targetBasePath);
}

function resolveAliasSpecifier(
  workspaceRoot: string,
  specifier: string,
  tsconfig?: TsConfigResolutionModel,
): {
  matched: boolean;
  resolvedFile?: string;
} {
  if (!tsconfig) {
    return { matched: false };
  }

  const aliasEntries = Object.entries(tsconfig.pathAliases).sort(
    ([left], [right]) => {
      const leftWildcard = left.includes('*');
      const rightWildcard = right.includes('*');

      if (leftWildcard !== rightWildcard) {
        return leftWildcard ? 1 : -1;
      }

      return right.length - left.length || left.localeCompare(right);
    },
  );

  for (const [alias, targets] of aliasEntries) {
    const capturedValue = matchAlias(alias, specifier);

    if (capturedValue === undefined) {
      continue;
    }

    for (const target of targets) {
      const targetPath = target.includes('*')
        ? target.replaceAll('*', capturedValue)
        : target;
      const resolvedFile = resolveFilePath(
        workspaceRoot,
        path.resolve(workspaceRoot, targetPath),
      );

      if (resolvedFile) {
        return {
          matched: true,
          resolvedFile,
        };
      }
    }

    return { matched: true };
  }

  return { matched: false };
}

function resolveBaseUrlSpecifier(
  workspaceRoot: string,
  specifier: string,
  tsconfig?: TsConfigResolutionModel,
): string | undefined {
  if (!tsconfig?.baseUrl) {
    return undefined;
  }

  return resolveFilePath(
    workspaceRoot,
    path.resolve(workspaceRoot, tsconfig.baseUrl, specifier),
  );
}

function matchAlias(alias: string, specifier: string): string | undefined {
  if (!alias.includes('*')) {
    return alias === specifier ? '' : undefined;
  }

  const [prefix, suffix] = alias.split('*');
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) {
    return undefined;
  }

  return specifier.slice(prefix.length, specifier.length - suffix.length);
}

function resolveFilePath(
  workspaceRoot: string,
  targetBasePath: string,
): string | undefined {
  const candidates = buildResolutionCandidates(targetBasePath);

  for (const candidate of candidates) {
    if (existsSync(candidate) && !candidate.endsWith('.d.ts')) {
      return normalizeRelativePath(workspaceRoot, candidate);
    }
  }

  return undefined;
}

function buildResolutionCandidates(targetBasePath: string): string[] {
  const candidates = [targetBasePath];

  if (path.extname(targetBasePath)) {
    return candidates;
  }

  for (const extension of RESOLVABLE_EXTENSIONS) {
    candidates.push(`${targetBasePath}${extension}`);
  }

  for (const extension of RESOLVABLE_EXTENSIONS) {
    candidates.push(path.join(targetBasePath, `index${extension}`));
  }

  return candidates;
}

function sortSourceFiles(
  files: readonly TypeScriptSourceFileNode[],
): TypeScriptSourceFileNode[] {
  return [...files].sort(
    (left, right) =>
      left.filePath.localeCompare(right.filePath) ||
      (left.projectName ?? '').localeCompare(right.projectName ?? ''),
  );
}

function sortImportEdges(
  imports: readonly TypeScriptImportEdge[],
): TypeScriptImportEdge[] {
  return [...imports].sort((left, right) => {
    return (
      left.sourceFile.localeCompare(right.sourceFile) ||
      left.specifier.localeCompare(right.specifier) ||
      left.kind.localeCompare(right.kind) ||
      (left.resolvedFile ?? '').localeCompare(right.resolvedFile ?? '') ||
      Number(left.external) - Number(right.external)
    );
  });
}

function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function normalizeRelativePath(
  workspaceRoot: string,
  absoluteFilePath: string,
): string {
  return path
    .relative(workspaceRoot, absoluteFilePath)
    .split(path.sep)
    .join('/');
}

function importPointer(sourceFile: string, specifier: string): string {
  return `/${escapeJsonPointer(sourceFile)}/imports/${escapeJsonPointer(
    specifier,
  )}`;
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
