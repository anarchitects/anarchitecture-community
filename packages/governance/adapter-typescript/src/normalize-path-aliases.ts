import path from 'node:path';

import {
  invalidPathAliasDiagnostic,
  invalidTsConfigDiagnostic,
} from './diagnostics.js';
import type {
  TsConfigResolutionModel,
  TypeScriptWorkspaceDetectionDiagnostic,
} from './types.js';

interface ResolvedTsConfigFile {
  filePath: string;
  jsonPath: string;
  value: Record<string, unknown>;
}

export function normalizePathAliasesFromConfigs(
  workspaceRoot: string,
  configs: readonly ResolvedTsConfigFile[],
  inheritedDiagnostics: readonly TypeScriptWorkspaceDetectionDiagnostic[],
): TsConfigResolutionModel {
  const diagnostics = [...inheritedDiagnostics];
  const pathAliases = new Map<string, string[]>();
  let baseUrl: string | undefined;

  for (const config of configs) {
    const compilerOptions = asRecord(config.value.compilerOptions);

    if (
      config.value.compilerOptions !== undefined &&
      compilerOptions === undefined
    ) {
      diagnostics.push(
        invalidTsConfigDiagnostic(
          `${config.jsonPath}/compilerOptions`,
          'compilerOptions must be an object when present.',
        ),
      );
      continue;
    }

    if (!compilerOptions) {
      continue;
    }

    if ('baseUrl' in compilerOptions) {
      if (
        typeof compilerOptions.baseUrl !== 'string' ||
        compilerOptions.baseUrl.trim().length === 0
      ) {
        diagnostics.push(
          invalidTsConfigDiagnostic(
            `${config.jsonPath}/compilerOptions/baseUrl`,
            'compilerOptions.baseUrl must be a non-empty string when present.',
          ),
        );
      } else {
        baseUrl = normalizePathRelativeToWorkspace(
          workspaceRoot,
          path.dirname(config.filePath),
          compilerOptions.baseUrl,
        );
      }
    }

    const paths = compilerOptions.paths;
    if (paths === undefined) {
      continue;
    }

    const aliasRecord = asRecord(paths);
    if (!aliasRecord) {
      diagnostics.push(
        invalidTsConfigDiagnostic(
          `${config.jsonPath}/compilerOptions/paths`,
          'compilerOptions.paths must be an object when present.',
        ),
      );
      continue;
    }

    const aliasBaseDirectory = baseUrl
      ? path.resolve(workspaceRoot, baseUrl)
      : path.dirname(config.filePath);

    for (const alias of Object.keys(aliasRecord).sort((left, right) =>
      left.localeCompare(right),
    )) {
      const pointer = `${
        config.jsonPath
      }/compilerOptions/paths/${escapeJsonPointer(alias)}`;
      const normalizedTargets = normalizeAliasTargets(
        workspaceRoot,
        aliasBaseDirectory,
        aliasRecord[alias],
        pointer,
        diagnostics,
      );

      if (normalizedTargets) {
        pathAliases.set(alias, normalizedTargets);
      }
    }
  }

  return {
    workspaceRoot,
    configFiles: configs.map((config) =>
      normalizePathToWorkspaceRoot(workspaceRoot, config.filePath),
    ),
    ...(baseUrl ? { baseUrl } : {}),
    pathAliases: Object.fromEntries(
      [...pathAliases.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
    diagnostics,
  };
}

function normalizeAliasTargets(
  workspaceRoot: string,
  baseDirectory: string,
  value: unknown,
  pointer: string,
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[],
): string[] | undefined {
  if (!Array.isArray(value)) {
    diagnostics.push(
      invalidPathAliasDiagnostic(
        pointer,
        'Path alias targets must be an array of non-empty strings.',
      ),
    );
    return undefined;
  }

  const targets: string[] = [];
  const seenTargets = new Set<string>();

  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      diagnostics.push(
        invalidPathAliasDiagnostic(
          `${pointer}/${index}`,
          'Path alias target must be a non-empty string.',
        ),
      );
      return;
    }

    const normalizedTarget = normalizePathRelativeToWorkspace(
      workspaceRoot,
      baseDirectory,
      entry,
    );

    if (seenTargets.has(normalizedTarget)) {
      return;
    }

    seenTargets.add(normalizedTarget);
    targets.push(normalizedTarget);
  });

  return targets;
}

function normalizePathRelativeToWorkspace(
  workspaceRoot: string,
  baseDirectory: string,
  value: string,
): string {
  const resolvedPath = path.resolve(baseDirectory, value.trim());

  return normalizePathToWorkspaceRoot(workspaceRoot, resolvedPath);
}

function normalizePathToWorkspaceRoot(
  workspaceRoot: string,
  absolutePath: string,
): string {
  const relativePath = path.relative(workspaceRoot, absolutePath);

  return relativePath ? relativePath.split(path.sep).join('/') : '.';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
