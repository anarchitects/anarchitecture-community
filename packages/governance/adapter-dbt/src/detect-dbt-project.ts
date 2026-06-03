import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

import type {
  DbtArtifactPaths,
  DbtGovernanceAdapterInput,
  DbtProjectContext,
  DbtProjectDetectionResult,
  ResolvedDbtArtifactPaths,
} from './contracts.js';
import {
  inconsistentProjectInputsDiagnostic,
  invalidDbtProjectPathDiagnostic,
  missingDbtProjectPathDiagnostic,
  missingProjectDirectoryDiagnostic,
} from './diagnostics.js';

const DBT_PROJECT_FILE_NAME = 'dbt_project.yml';
const TARGET_DIRECTORY_NAME = 'target';
const MANIFEST_FILE_NAME = 'manifest.json';

export function detectDbtProject(
  input: DbtGovernanceAdapterInput,
): DbtProjectDetectionResult {
  const diagnostics: DbtProjectDetectionResult['diagnostics'] = [];
  const context = resolveDbtProjectContext(input, diagnostics);

  return {
    supported: context !== undefined,
    ...(context ? { context } : {}),
    diagnostics,
  };
}

export function resolveDbtProjectContext(
  input: DbtGovernanceAdapterInput,
  diagnostics: DbtProjectDetectionResult['diagnostics'] = [],
): DbtProjectContext | undefined {
  const resolvedProjectDir = resolveProjectDir(input.paths, diagnostics);
  const resolvedDbtProjectPath = resolveDbtProjectPath(
    input.paths,
    resolvedProjectDir,
    diagnostics,
  );

  if (!resolvedProjectDir || !resolvedDbtProjectPath) {
    return undefined;
  }

  const artifactPaths = resolveArtifactPaths(input.paths, {
    projectDir: resolvedProjectDir,
    dbtProjectPath: resolvedDbtProjectPath,
  });

  return {
    projectDir: resolvedProjectDir,
    dbtProjectPath: resolvedDbtProjectPath,
    artifactPaths,
    diagnostics,
  };
}

function resolveProjectDir(
  paths: DbtArtifactPaths,
  diagnostics: DbtProjectDetectionResult['diagnostics'],
): string | undefined {
  if (isExistingDirectory(paths.projectDir)) {
    return path.normalize(paths.projectDir);
  }

  if (paths.projectDir) {
    diagnostics.push(missingProjectDirectoryDiagnostic(paths.projectDir));
    return undefined;
  }

  if (isExistingFile(paths.dbtProjectPath)) {
    return path.dirname(path.normalize(paths.dbtProjectPath));
  }

  if (!paths.dbtProjectPath) {
    diagnostics.push(missingProjectDirectoryDiagnostic());
  }

  return undefined;
}

function resolveDbtProjectPath(
  paths: DbtArtifactPaths,
  projectDir: string | undefined,
  diagnostics: DbtProjectDetectionResult['diagnostics'],
): string | undefined {
  if (paths.dbtProjectPath) {
    if (!path.isAbsolute(paths.dbtProjectPath)) {
      diagnostics.push(invalidDbtProjectPathDiagnostic(paths.dbtProjectPath));
      return undefined;
    }

    if (!isDbtProjectFilePath(paths.dbtProjectPath)) {
      diagnostics.push(invalidDbtProjectPathDiagnostic(paths.dbtProjectPath));
      return undefined;
    }

    if (!isExistingFile(paths.dbtProjectPath)) {
      diagnostics.push(
        missingDbtProjectPathDiagnostic(
          projectDir ?? path.dirname(paths.dbtProjectPath),
          'paths.dbtProjectPath',
        ),
      );
      return undefined;
    }

    const normalizedDbtProjectPath = path.normalize(paths.dbtProjectPath);

    if (
      projectDir &&
      path.normalize(path.dirname(normalizedDbtProjectPath)) !==
        path.normalize(projectDir)
    ) {
      diagnostics.push(
        inconsistentProjectInputsDiagnostic(
          projectDir,
          normalizedDbtProjectPath,
        ),
      );
      return undefined;
    }

    return normalizedDbtProjectPath;
  }

  if (!projectDir) {
    return undefined;
  }

  const inferredDbtProjectPath = path.join(projectDir, DBT_PROJECT_FILE_NAME);

  if (!isExistingFile(inferredDbtProjectPath)) {
    diagnostics.push(
      missingDbtProjectPathDiagnostic(projectDir, 'paths.projectDir'),
    );
    return undefined;
  }

  return inferredDbtProjectPath;
}

function resolveArtifactPaths(
  paths: DbtArtifactPaths,
  resolved: {
    projectDir: string;
    dbtProjectPath: string;
  },
): ResolvedDbtArtifactPaths {
  const targetDirectory = path.join(resolved.projectDir, TARGET_DIRECTORY_NAME);

  return {
    projectDir: resolved.projectDir,
    dbtProjectPath: resolved.dbtProjectPath,
    manifestPath:
      paths.manifestPath ?? path.join(targetDirectory, MANIFEST_FILE_NAME),
    ...(paths.catalogPath ? { catalogPath: paths.catalogPath } : {}),
    ...(paths.runResultsPath ? { runResultsPath: paths.runResultsPath } : {}),
    ...(paths.sourcesPath ? { sourcesPath: paths.sourcesPath } : {}),
  };
}

function isDbtProjectFilePath(filePath: string): boolean {
  return path.basename(path.normalize(filePath)) === DBT_PROJECT_FILE_NAME;
}

function isExistingDirectory(
  directoryPath: string | undefined,
): directoryPath is string {
  return existsAndMatches(directoryPath, 'directory');
}

function isExistingFile(filePath: string | undefined): filePath is string {
  return existsAndMatches(filePath, 'file');
}

function existsAndMatches(
  inputPath: string | undefined,
  expectedType: 'directory' | 'file',
): boolean {
  if (!inputPath || !path.isAbsolute(inputPath) || !existsSync(inputPath)) {
    return false;
  }

  const stats = statSync(inputPath);

  return expectedType === 'directory' ? stats.isDirectory() : stats.isFile();
}
