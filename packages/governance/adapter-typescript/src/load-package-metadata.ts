import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  invalidPackageMetadataJsonDiagnostic,
  unsupportedPackageMetadataFormatDiagnostic,
} from './diagnostics.js';
import type { TypeScriptWorkspaceDetectionDiagnostic } from './types.js';

export interface TypeScriptPackageMetadataLoadResult {
  packageJsonPath: string;
  packageJson?: Record<string, unknown>;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

export function loadPackageMetadata(
  packageRoot: string,
): TypeScriptPackageMetadataLoadResult {
  const packageJsonPath = path.join(path.resolve(packageRoot), 'package.json');

  if (!existsSync(packageJsonPath)) {
    return {
      packageJsonPath,
      diagnostics: [],
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as unknown;
    const packageJson = asRecord(parsed);

    if (!packageJson) {
      return {
        packageJsonPath,
        diagnostics: [
          unsupportedPackageMetadataFormatDiagnostic(packageJsonPath),
        ],
      };
    }

    return {
      packageJsonPath,
      packageJson,
      diagnostics: [],
    };
  } catch {
    return {
      packageJsonPath,
      diagnostics: [invalidPackageMetadataJsonDiagnostic(packageJsonPath)],
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
