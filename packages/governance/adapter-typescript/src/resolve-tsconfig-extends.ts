import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  circularTsConfigExtendsDiagnostic,
  invalidTsConfigDiagnostic,
  invalidTsConfigExtendsDiagnostic,
} from './diagnostics.js';
import type { TypeScriptWorkspaceDetectionDiagnostic } from './types.js';

interface ParsedTsConfig {
  filePath: string;
  jsonPath: string;
  value: Record<string, unknown>;
}

export interface ResolvedTsConfigExtendsChain {
  configs: ParsedTsConfig[];
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

export function resolveTsConfigExtendsChain(
  workspaceRoot: string,
  entryConfigPath: string,
): ResolvedTsConfigExtendsChain {
  return resolveConfigFile(
    path.resolve(entryConfigPath),
    workspaceRoot,
    [],
    new Set<string>(),
  );
}

function resolveConfigFile(
  filePath: string,
  workspaceRoot: string,
  stack: string[],
  seen: Set<string>,
): ResolvedTsConfigExtendsChain {
  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
  const normalizedFilePath = path.resolve(filePath);
  const relativeFilePath = toWorkspaceRelativePath(workspaceRoot, filePath);
  const jsonPath = `/${escapeJsonPointer(relativeFilePath)}`;

  if (seen.has(normalizedFilePath)) {
    return {
      configs: [],
      diagnostics: [
        circularTsConfigExtendsDiagnostic(`${jsonPath}/extends`, [
          ...stack.map((entry) =>
            toWorkspaceRelativePath(workspaceRoot, entry),
          ),
          relativeFilePath,
        ]),
      ],
    };
  }

  const parsed = readTsConfigFile(normalizedFilePath, workspaceRoot);
  if (!parsed.value) {
    return {
      configs: [],
      diagnostics: parsed.diagnostics,
    };
  }

  const nextSeen = new Set(seen);
  nextSeen.add(normalizedFilePath);
  const nextStack = [...stack, normalizedFilePath];
  const extendsValue = parsed.value.extends;

  if (extendsValue === undefined) {
    return {
      configs: [
        {
          filePath: normalizedFilePath,
          jsonPath,
          value: parsed.value,
        },
      ],
      diagnostics,
    };
  }

  if (typeof extendsValue !== 'string' || extendsValue.trim().length === 0) {
    diagnostics.push(
      invalidTsConfigExtendsDiagnostic(
        `${jsonPath}/extends`,
        '"extends" must be a non-empty relative or absolute path string.',
      ),
    );

    return {
      configs: [
        {
          filePath: normalizedFilePath,
          jsonPath,
          value: parsed.value,
        },
      ],
      diagnostics,
    };
  }

  const extendedConfigPath = resolveExtendedConfigPath(
    normalizedFilePath,
    extendsValue,
  );

  if (!extendedConfigPath) {
    diagnostics.push(
      invalidTsConfigExtendsDiagnostic(
        `${jsonPath}/extends`,
        `Unsupported tsconfig extends path "${extendsValue}". Only relative or absolute paths are supported in this MVP.`,
      ),
    );

    return {
      configs: [
        {
          filePath: normalizedFilePath,
          jsonPath,
          value: parsed.value,
        },
      ],
      diagnostics,
    };
  }

  if (!existsSync(extendedConfigPath)) {
    diagnostics.push(
      invalidTsConfigExtendsDiagnostic(
        `${jsonPath}/extends`,
        `Extended tsconfig "${extendsValue}" could not be resolved.`,
      ),
    );

    return {
      configs: [
        {
          filePath: normalizedFilePath,
          jsonPath,
          value: parsed.value,
        },
      ],
      diagnostics,
    };
  }

  const parent = resolveConfigFile(
    extendedConfigPath,
    workspaceRoot,
    nextStack,
    nextSeen,
  );

  return {
    configs: [
      ...parent.configs,
      {
        filePath: normalizedFilePath,
        jsonPath,
        value: parsed.value,
      },
    ],
    diagnostics: [...parent.diagnostics, ...diagnostics],
  };
}

function readTsConfigFile(
  filePath: string,
  workspaceRoot: string,
): {
  value?: Record<string, unknown>;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
} {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {
        diagnostics: [
          invalidTsConfigDiagnostic(
            `/${escapeJsonPointer(
              toWorkspaceRelativePath(workspaceRoot, filePath),
            )}`,
            `Failed to parse tsconfig file "${filePath}".`,
          ),
        ],
      };
    }

    return {
      value: parsed as Record<string, unknown>,
      diagnostics: [],
    };
  } catch {
    return {
      diagnostics: [
        invalidTsConfigDiagnostic(
          `/${escapeJsonPointer(
            toWorkspaceRelativePath(workspaceRoot, filePath),
          )}`,
          `Failed to parse tsconfig file "${filePath}".`,
        ),
      ],
    };
  }
}

function resolveExtendedConfigPath(
  filePath: string,
  extendsValue: string,
): string | undefined {
  if (!extendsValue.startsWith('.') && !path.isAbsolute(extendsValue)) {
    return undefined;
  }

  const basePath = path.isAbsolute(extendsValue)
    ? extendsValue
    : path.resolve(path.dirname(filePath), extendsValue);

  if (path.extname(basePath)) {
    return basePath;
  }

  return `${basePath}.json`;
}

function toWorkspaceRelativePath(
  workspaceRoot: string,
  filePath: string,
): string {
  const relativePath = path.relative(workspaceRoot, filePath);

  return relativePath ? relativePath.split(path.sep).join('/') : '.';
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
