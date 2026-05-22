import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  invalidPackageJsonDiagnostic,
  noWorkspaceIndicatorsDiagnostic,
  partialWorkspaceDetectionDiagnostic,
} from './diagnostics.js';
import type {
  TypeScriptWorkspaceDetectionResult,
  TypeScriptWorkspaceDetectionStatus,
} from './types.js';

export function detectTypeScriptWorkspace(
  workspacePath: string,
): TypeScriptWorkspaceDetectionResult {
  const workspaceRoot = path.resolve(workspacePath);
  const packageJsonPath = path.join(workspaceRoot, 'package.json');
  const pnpmWorkspacePath = path.join(workspaceRoot, 'pnpm-workspace.yaml');
  const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
  const tsconfigBasePath = path.join(workspaceRoot, 'tsconfig.base.json');

  const indicators = {
    packageJson: existsSync(packageJsonPath),
    pnpmWorkspace: existsSync(pnpmWorkspacePath),
    packageManagerWorkspaces: false,
    tsconfig: existsSync(tsconfigPath),
    tsconfigBase: existsSync(tsconfigBasePath),
  };
  const diagnostics = [];
  let hasValidPackageJson = false;

  if (indicators.packageJson) {
    const packageJson = readPackageJson(packageJsonPath);

    if (packageJson) {
      hasValidPackageJson = true;
      indicators.packageManagerWorkspaces = hasPackageManagerWorkspaces(
        packageJson.workspaces,
      );
    } else {
      diagnostics.push(invalidPackageJsonDiagnostic(packageJsonPath));
    }
  }

  const status = resolveDetectionStatus({
    hasExplicitWorkspaceIndicator:
      indicators.pnpmWorkspace || indicators.packageManagerWorkspaces,
    hasPartialWorkspaceIndicator:
      hasValidPackageJson || indicators.tsconfig || indicators.tsconfigBase,
  });

  if (status === 'partial') {
    diagnostics.push(partialWorkspaceDetectionDiagnostic(indicators));
  }

  if (status === 'unsupported') {
    diagnostics.push(noWorkspaceIndicatorsDiagnostic());
  }

  return {
    status,
    supported: status !== 'unsupported',
    workspaceRoot,
    indicators,
    diagnostics,
  };
}

function readPackageJson(
  filePath: string,
): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    return asRecord(parsed);
  } catch {
    return undefined;
  }
}

function hasPackageManagerWorkspaces(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every(isNonEmptyString);
  }

  const record = asRecord(value);
  if (!record) {
    return false;
  }

  return (
    Array.isArray(record.packages) &&
    record.packages.length > 0 &&
    record.packages.every(isNonEmptyString)
  );
}

function resolveDetectionStatus({
  hasExplicitWorkspaceIndicator,
  hasPartialWorkspaceIndicator,
}: {
  hasExplicitWorkspaceIndicator: boolean;
  hasPartialWorkspaceIndicator: boolean;
}): TypeScriptWorkspaceDetectionStatus {
  if (hasExplicitWorkspaceIndicator) {
    return 'supported';
  }

  if (hasPartialWorkspaceIndicator) {
    return 'partial';
  }

  return 'unsupported';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
