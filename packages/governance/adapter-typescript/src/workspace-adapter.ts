import { readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  GovernanceWorkspaceAdapter,
  GovernanceWorkspaceAdapterProbeResult,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

import { detectTypeScriptWorkspace } from './detect-typescript-workspace.js';
import { buildTypeScriptImportGraph } from './import-graph.js';
import { mapTypeScriptImportsToGovernanceDependencies } from './map-imports-to-projects.js';
import { parsePackageManagerWorkspace } from './parse-package-manager-workspace.js';
import { parseTsConfigResolution } from './parse-tsconfig.js';
import { discoverTypeScriptProjects } from './project-discovery.js';
import type {
  TypeScriptPackageGovernanceMetadataConfig,
  TypeScriptProjectDiscoveryConfig,
} from './types.js';

export interface CreateTypeScriptWorkspaceAdapterOptions {
  discoveryConfig: TypeScriptProjectDiscoveryConfig;
  packageGovernanceMetadataConfig: TypeScriptPackageGovernanceMetadataConfig;
  tsconfigPath?: string;
  adapterId?: string;
}

export interface CreateGovernanceWorkspaceAdapterOptions {
  discoveryConfig?: TypeScriptProjectDiscoveryConfig;
  packageGovernanceMetadataConfig?: TypeScriptPackageGovernanceMetadataConfig;
  tsconfigPath?: string;
  adapterId?: string;
}

export const DEFAULT_TYPESCRIPT_PROJECT_DISCOVERY_CONFIG = {
  projects: [
    { pattern: 'packages/*' },
    { pattern: 'packages/*/*' },
    { pattern: 'apps/*' },
    { pattern: 'apps/*/*' },
    { pattern: 'libs/*' },
    { pattern: 'libs/*/*' },
    { pattern: 'services/*' },
    { pattern: 'services/*/*' },
    { pattern: 'tools/*' },
    { pattern: 'tools/*/*' },
  ],
} satisfies TypeScriptProjectDiscoveryConfig;

export const DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG = {
  sourceFile: 'package.json',
  path: ['governance'],
  fields: {
    domain: 'domain',
    layer: 'layer',
    scope: 'scope',
    owner: 'owner',
  },
} satisfies TypeScriptPackageGovernanceMetadataConfig;

export function createTypeScriptWorkspaceAdapter(
  options: CreateTypeScriptWorkspaceAdapterOptions,
): GovernanceWorkspaceAdapter<string> {
  return {
    id: options.adapterId ?? 'governance-adapter:typescript',
    probe(workspacePath: string): GovernanceWorkspaceAdapterProbeResult {
      const detection = detectTypeScriptWorkspace(workspacePath);

      return {
        supported: detection.supported,
        confidence: detection.supported
          ? detection.status === 'supported'
            ? 'high'
            : 'low'
          : 'none',
        reasons: buildProbeReasons(detection),
        diagnostics: detection.diagnostics,
        metadata: {
          status: detection.status,
          indicators: detection.indicators,
        },
      };
    },
    loadWorkspace(workspacePath: string): GovernanceWorkspaceAdapterResult {
      const workspaceRoot = path.resolve(workspacePath);
      const workspace = parsePackageManagerWorkspace(workspaceRoot);
      const discovered = discoverTypeScriptProjects(
        workspace,
        options.discoveryConfig,
        options.packageGovernanceMetadataConfig,
      );
      const tsconfig = parseTsConfigResolution(
        workspaceRoot,
        options.tsconfigPath,
      );
      const importGraph = buildTypeScriptImportGraph({
        workspaceRoot,
        projects: discovered.projects,
        tsconfig,
      });
      const mapping = mapTypeScriptImportsToGovernanceDependencies({
        workspaceRoot,
        projects: discovered.projects,
        importGraph,
      });

      return {
        workspaceId: inferWorkspaceId(workspaceRoot),
        workspaceName: inferWorkspaceName(workspaceRoot),
        workspaceRoot: '.',
        projects: discovered.projects,
        dependencies: mapping.dependencies,
        diagnostics: [
          ...workspace.diagnostics,
          ...discovered.diagnostics,
          ...tsconfig.diagnostics,
          ...importGraph.diagnostics,
          ...mapping.diagnostics,
        ],
      };
    },
  };
}

export function createGovernanceWorkspaceAdapter(
  options: CreateGovernanceWorkspaceAdapterOptions = {},
): GovernanceWorkspaceAdapter<string> {
  return createTypeScriptWorkspaceAdapter({
    discoveryConfig:
      options.discoveryConfig ?? DEFAULT_TYPESCRIPT_PROJECT_DISCOVERY_CONFIG,
    packageGovernanceMetadataConfig:
      options.packageGovernanceMetadataConfig ??
      DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
    ...(options.tsconfigPath ? { tsconfigPath: options.tsconfigPath } : {}),
    ...(options.adapterId ? { adapterId: options.adapterId } : {}),
  });
}

export const governanceWorkspaceAdapter = createGovernanceWorkspaceAdapter();

export default governanceWorkspaceAdapter;

function buildProbeReasons(
  detection: ReturnType<typeof detectTypeScriptWorkspace>,
): string[] {
  const reasons: string[] = [];

  if (detection.indicators.pnpmWorkspace) {
    reasons.push('pnpm-workspace.yaml is present');
  }

  if (detection.indicators.packageManagerWorkspaces) {
    reasons.push('package.json declares package-manager workspaces');
  }

  if (detection.indicators.tsconfig) {
    reasons.push('tsconfig.json is present');
  }

  if (detection.indicators.tsconfigBase) {
    reasons.push('tsconfig.base.json is present');
  }

  if (reasons.length === 0) {
    reasons.push('no TypeScript workspace indicators were found');
  }

  return reasons;
}

function inferWorkspaceId(workspaceRoot: string): string {
  return inferWorkspaceName(workspaceRoot);
}

function inferWorkspaceName(workspaceRoot: string): string {
  const packageJsonPath = path.join(workspaceRoot, 'package.json');

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      typeof (parsed as Record<string, unknown>).name === 'string'
    ) {
      const packageName = (
        (parsed as Record<string, unknown>).name as string
      ).trim();
      if (packageName.length > 0) {
        return packageName;
      }
    }
  } catch {
    // Fall back to the directory name when package.json is absent or invalid.
  }

  return path.basename(workspaceRoot);
}
