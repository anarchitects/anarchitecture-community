import {
  createTypeScriptGovernanceModelExpansion,
  type TypeScriptGovernanceNodeExpansionData,
  type TypeScriptGovernanceRelationExpansionData,
  type TypeScriptGovernanceWorkspaceExpansionData,
} from '@anarchitects/governance-extension-typescript';

import type {
  TsConfigResolutionModel,
  TypeScriptDiscoveredProject,
  WorkspacePackageResolution,
} from './types.js';

export function buildTypeScriptWorkspaceExpansion(
  workspaceName: string,
  packageJsonPath: string,
  packageJson: Record<string, unknown> | undefined,
  workspace: WorkspacePackageResolution,
  tsconfig: TsConfigResolutionModel,
  projects: readonly TypeScriptDiscoveredProject[],
) {
  return createTypeScriptGovernanceModelExpansion({
    kind: 'workspace',
    technology: 'typescript',
    packageManager: workspace.packageManager ?? 'unknown',
    workspacePatterns: [...workspace.patterns],
    workspacePackageName: workspaceName,
    packageJsonPath,
    ...(packageJson ? { packageJson } : {}),
    projectNodeIds: [...projects].map((project) => project.id).sort(),
    tsconfigNodeIds: [...tsconfig.configFiles]
      .sort((left, right) => left.localeCompare(right))
      .map((configFile) => `tsconfig:${configFile}`),
  } satisfies TypeScriptGovernanceWorkspaceExpansionData);
}

export function buildTypeScriptWorkspacePackageNodeExpansion(
  packageManager: WorkspacePackageResolution['packageManager'],
  packageJsonPath: string,
  packageJson: Record<string, unknown> | undefined,
  options: {
    packageName: string;
    workspace: boolean;
    external?: boolean;
  },
) {
  return createTypeScriptGovernanceModelExpansion({
    kind: 'node',
    technology: 'typescript',
    nodeKind: 'package-manager-package',
    packageManager: packageManager ?? 'unknown',
    packageName: options.packageName,
    packageJsonPath,
    ...(packageJson ? { packageJson } : {}),
    packageManagerPackage: {
      workspace: options.workspace,
      external: options.external ?? false,
      packageName: options.packageName,
    },
  } satisfies TypeScriptGovernanceNodeExpansionData);
}

export function buildTypeScriptProjectNodeExpansion(
  project: TypeScriptDiscoveredProject,
  packageManager: WorkspacePackageResolution['packageManager'],
  packageJsonPath: string | undefined,
  packageJson: Record<string, unknown> | undefined,
) {
  return createTypeScriptGovernanceModelExpansion({
    kind: 'node',
    technology: 'typescript',
    nodeKind: 'workspace-project',
    packageManager: packageManager ?? 'unknown',
    ...(project.name ? { packageName: project.name } : {}),
    ...(packageJsonPath ? { packageJsonPath } : {}),
    ...(packageJson ? { packageJson } : {}),
    workspaceProject: {
      id: project.id,
      ...(project.type ? { type: project.type } : {}),
      ...(project.root ? { projectRoot: project.root } : {}),
    },
  } satisfies TypeScriptGovernanceNodeExpansionData);
}

export function buildTypeScriptTsconfigNodeExpansion(
  configFile: string,
  tsconfig: TsConfigResolutionModel,
) {
  return createTypeScriptGovernanceModelExpansion({
    kind: 'node',
    technology: 'typescript',
    nodeKind: 'tsconfig',
    tsconfig: {
      configFile,
      ...(configFile === tsconfig.configFiles.at(-1)
        ? {
            ...(tsconfig.baseUrl ? { baseUrl: tsconfig.baseUrl } : {}),
            pathAliases: tsconfig.pathAliases,
          }
        : {}),
    },
  } satisfies TypeScriptGovernanceNodeExpansionData);
}

export function buildTypeScriptWorkspaceMemberRelationExpansion(
  projectRoot: string,
) {
  return createTypeScriptGovernanceModelExpansion({
    kind: 'relation',
    technology: 'typescript',
    relationKind: 'workspace-member',
    workspaceMember: {
      projectRoot,
    },
  } satisfies TypeScriptGovernanceRelationExpansionData);
}

export function buildTypeScriptPackageDependencyRelationExpansion(options: {
  packageManager: WorkspacePackageResolution['packageManager'];
  dependencyType: string;
  packageName: string;
  specifier: string;
}) {
  return createTypeScriptGovernanceModelExpansion({
    kind: 'relation',
    technology: 'typescript',
    relationKind: 'package-dependency',
    packageDependency: {
      packageManager: options.packageManager ?? 'unknown',
      dependencyType: options.dependencyType,
      packageName: options.packageName,
      specifier: options.specifier,
    },
  } satisfies TypeScriptGovernanceRelationExpansionData);
}

export function buildTypeScriptPathMappingRelationExpansion(options: {
  alias: string;
  target: string;
  tsconfig: string;
}) {
  return createTypeScriptGovernanceModelExpansion({
    kind: 'relation',
    technology: 'typescript',
    relationKind: 'path-alias',
    pathMapping: {
      alias: options.alias,
      target: options.target,
      tsconfig: options.tsconfig,
    },
  } satisfies TypeScriptGovernanceRelationExpansionData);
}

export function buildTypeScriptImportRelationExpansion(options: {
  sourceFile: string;
  specifier: string;
  importKind: string;
  external: boolean;
  resolvedFile?: string;
}) {
  return createTypeScriptGovernanceModelExpansion({
    kind: 'relation',
    technology: 'typescript',
    relationKind: 'import',
    importSpecifiers: [options.specifier],
    import: {
      sourceFile: options.sourceFile,
      specifier: options.specifier,
      importKind: options.importKind,
      external: options.external,
      ...(options.resolvedFile ? { resolvedFile: options.resolvedFile } : {}),
    },
  } satisfies TypeScriptGovernanceRelationExpansionData);
}
