import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { parseDocument } from 'yaml';

import {
  invalidPackageJsonDiagnostic,
  invalidWorkspaceConfigDiagnostic,
  noWorkspacePackagesFoundDiagnostic,
  unsupportedWorkspaceFormatDiagnostic,
} from './diagnostics.js';
import { normalizeWorkspacePatterns } from './normalize-workspace-patterns.js';
import { resolveWorkspacePackages } from './resolve-workspace-packages.js';
import type {
  TypeScriptWorkspaceDetectionDiagnostic,
  TypeScriptWorkspacePackageManager,
  WorkspacePackageResolution,
} from './types.js';

export function parsePackageManagerWorkspace(
  workspacePath: string,
): WorkspacePackageResolution {
  const workspaceRoot = path.resolve(workspacePath);
  const pnpmWorkspacePath = path.join(workspaceRoot, 'pnpm-workspace.yaml');
  const packageJsonPath = path.join(workspaceRoot, 'package.json');

  if (existsSync(pnpmWorkspacePath)) {
    return parsePnpmWorkspace(workspaceRoot, pnpmWorkspacePath);
  }

  if (existsSync(packageJsonPath)) {
    return parsePackageJsonWorkspace(workspaceRoot, packageJsonPath);
  }

  return {
    workspaceRoot,
    patterns: [],
    packageRoots: [],
    diagnostics: [
      unsupportedWorkspaceFormatDiagnostic(
        '/',
        'Repository does not contain a supported package-manager workspace configuration.',
      ),
    ],
  };
}

function parsePnpmWorkspace(
  workspaceRoot: string,
  workspaceFilePath: string,
): WorkspacePackageResolution {
  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
  const parsed = readPnpmWorkspaceFile(workspaceFilePath, diagnostics);

  if (!parsed) {
    return {
      packageManager: 'pnpm',
      workspaceRoot,
      patterns: [],
      packageRoots: [],
      diagnostics,
    };
  }

  const patterns = parsePnpmWorkspacePatterns(parsed, diagnostics);

  return finalizeWorkspacePackageResolution({
    packageManager: 'pnpm',
    workspaceRoot,
    patterns,
    diagnostics,
  });
}

function parsePackageJsonWorkspace(
  workspaceRoot: string,
  packageJsonPath: string,
): WorkspacePackageResolution {
  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
  const parsedPackageJson = readPackageJsonFile(packageJsonPath, diagnostics);

  if (!parsedPackageJson) {
    return {
      workspaceRoot,
      patterns: [],
      packageRoots: [],
      diagnostics,
    };
  }

  const packageManager = inferSharedWorkspacePackageManager(
    workspaceRoot,
    parsedPackageJson,
  );
  const patterns = parseSharedWorkspacePatterns(parsedPackageJson, diagnostics);

  return finalizeWorkspacePackageResolution({
    packageManager,
    workspaceRoot,
    patterns,
    diagnostics,
  });
}

function finalizeWorkspacePackageResolution({
  packageManager,
  workspaceRoot,
  patterns,
  diagnostics,
}: {
  packageManager: TypeScriptWorkspacePackageManager;
  workspaceRoot: string;
  patterns: string[];
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}): WorkspacePackageResolution {
  const packageRoots =
    patterns.length > 0
      ? resolveWorkspacePackages(workspaceRoot, patterns)
      : [];

  if (patterns.length > 0 && packageRoots.length === 0) {
    diagnostics.push(noWorkspacePackagesFoundDiagnostic(patterns));
  }

  return {
    packageManager,
    workspaceRoot,
    patterns,
    packageRoots,
    diagnostics,
  };
}

function readPnpmWorkspaceFile(
  filePath: string,
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[],
): Record<string, unknown> | undefined {
  try {
    const document = parseDocument(readFileSync(filePath, 'utf8'), {
      merge: false,
      strict: true,
      uniqueKeys: false,
    });

    if (document.errors.length > 0) {
      diagnostics.push(
        invalidWorkspaceConfigDiagnostic(
          '/pnpm-workspace.yaml',
          `Failed to parse pnpm workspace file "${filePath}".`,
        ),
      );
      return undefined;
    }

    return asRecord(document.toJS());
  } catch {
    diagnostics.push(
      invalidWorkspaceConfigDiagnostic(
        '/pnpm-workspace.yaml',
        `Failed to parse pnpm workspace file "${filePath}".`,
      ),
    );
    return undefined;
  }
}

function readPackageJsonFile(
  filePath: string,
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[],
): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    const record = asRecord(parsed);

    if (!record) {
      diagnostics.push(invalidPackageJsonDiagnostic(filePath));
      return undefined;
    }

    return record;
  } catch {
    diagnostics.push(invalidPackageJsonDiagnostic(filePath));
    return undefined;
  }
}

function parsePnpmWorkspacePatterns(
  workspaceConfig: Record<string, unknown>,
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[],
): string[] {
  if (!('packages' in workspaceConfig)) {
    diagnostics.push(
      unsupportedWorkspaceFormatDiagnostic(
        '/packages',
        'pnpm-workspace.yaml must define a "packages" array.',
      ),
    );
    return [];
  }

  if (!Array.isArray(workspaceConfig.packages)) {
    diagnostics.push(
      invalidWorkspaceConfigDiagnostic(
        '/packages',
        'pnpm workspace "packages" must be an array of patterns.',
      ),
    );
    return [];
  }

  const normalized = normalizeWorkspacePatterns(
    workspaceConfig.packages,
    '/packages',
  );

  diagnostics.push(...normalized.diagnostics);

  return normalized.patterns;
}

function parseSharedWorkspacePatterns(
  packageJson: Record<string, unknown>,
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[],
): string[] {
  const workspaces = packageJson.workspaces;

  if (Array.isArray(workspaces)) {
    const normalized = normalizeWorkspacePatterns(workspaces, '/workspaces');

    diagnostics.push(...normalized.diagnostics);

    return normalized.patterns;
  }

  const workspacesRecord = asRecord(workspaces);
  if (!workspacesRecord) {
    diagnostics.push(
      unsupportedWorkspaceFormatDiagnostic(
        '/workspaces',
        'package.json must define "workspaces" as an array or as an object with a "packages" array.',
      ),
    );
    return [];
  }

  if (!Array.isArray(workspacesRecord.packages)) {
    diagnostics.push(
      unsupportedWorkspaceFormatDiagnostic(
        '/workspaces',
        'package.json object-style workspaces must define a "packages" array.',
      ),
    );
    return [];
  }

  const normalized = normalizeWorkspacePatterns(
    workspacesRecord.packages,
    '/workspaces/packages',
  );

  diagnostics.push(...normalized.diagnostics);

  return normalized.patterns;
}

function inferSharedWorkspacePackageManager(
  workspaceRoot: string,
  packageJson: Record<string, unknown>,
): 'npm' | 'yarn' {
  if (
    typeof packageJson.packageManager === 'string' &&
    packageJson.packageManager.trim().toLowerCase().startsWith('yarn@')
  ) {
    return 'yarn';
  }

  if (existsSync(path.join(workspaceRoot, 'yarn.lock'))) {
    return 'yarn';
  }

  return 'npm';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
