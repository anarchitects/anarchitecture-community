import { readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  GovernanceWorkspaceAdapter,
  GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

import { buildTypeScriptImportGraph } from './import-graph.js';
import { mapTypeScriptImportsToGovernanceDependencies } from './map-imports-to-projects.js';
import { parsePackageManagerWorkspace } from './parse-package-manager-workspace.js';
import { parseTsConfigResolution } from './parse-tsconfig.js';
import { discoverTypeScriptProjects } from './project-discovery.js';
import type { TypeScriptProjectDiscoveryConfig } from './types.js';

export interface CreateTypeScriptWorkspaceAdapterOptions {
  discoveryConfig: TypeScriptProjectDiscoveryConfig;
  tsconfigPath?: string;
  adapterId?: string;
}

export function createTypeScriptWorkspaceAdapter(
  options: CreateTypeScriptWorkspaceAdapterOptions,
): GovernanceWorkspaceAdapter<string> {
  return {
    id: options.adapterId ?? 'governance-adapter:typescript',
    loadWorkspace(workspacePath: string): GovernanceWorkspaceAdapterResult {
      const workspaceRoot = path.resolve(workspacePath);
      const workspace = parsePackageManagerWorkspace(workspaceRoot);
      const discovered = discoverTypeScriptProjects(
        workspace,
        options.discoveryConfig,
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
