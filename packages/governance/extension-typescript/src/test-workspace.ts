import {
  DefaultGovernanceCapabilityRegistry,
  type GovernanceCapability,
  type GovernanceExtensionHostContext,
  type GovernanceNode,
  type GovernanceProfile,
  type GovernanceRelation,
  type GovernanceWorkspace,
} from '@anarchitects/governance-core';

import { attachTypeScriptGovernanceModelExpansion } from './contracts.js';

export function createTypeScriptProfile(
  overrides: Partial<GovernanceProfile> = {},
): GovernanceProfile {
  return {
    name: 'typescript',
    layers: [],
    allowedDomainDependencies: {},
    ownership: {
      required: false,
    },
    health: {
      statusThresholds: {
        goodMinScore: 85,
        warningMinScore: 70,
      },
    },
    metrics: {},
    ...overrides,
  };
}

export function createTypeScriptWorkspace(
  options: {
    nodes?: GovernanceNode[];
    relations?: GovernanceRelation[];
    capabilities?: GovernanceCapability[];
  } = {},
): GovernanceWorkspace {
  return {
    id: 'workspace',
    name: 'workspace',
    root: '/repo',
    nodes: options.nodes ?? [],
    relations: options.relations ?? [],
    ...(options.capabilities ? { capabilities: options.capabilities } : {}),
  };
}

export function createTypeScriptContext(
  workspace: GovernanceWorkspace,
): GovernanceExtensionHostContext {
  return {
    workspaceRoot: workspace.root,
    profileName: 'typescript',
    options: {},
    inventory: workspace,
    capabilities: new DefaultGovernanceCapabilityRegistry(
      workspace.capabilities ?? [],
    ),
  };
}

export function createTypeScriptProjectNode(options: {
  id: string;
  name?: string;
  root?: string;
  sourceSystem?: 'pnpm' | 'npm' | 'yarn' | 'typescript';
  tags?: string[];
  packageJson?: Record<string, unknown>;
  domain?: string;
  layer?: string;
  scope?: string;
  owner?: string;
}): GovernanceNode {
  const node: GovernanceNode = {
    id: options.id,
    name: options.name ?? options.id,
    kind: 'project',
    technology: 'typescript',
    sourceSystem: options.sourceSystem ?? 'pnpm',
    root: options.root ?? `packages/${options.id}`,
    path: options.root ?? `packages/${options.id}`,
    tags: options.tags ?? [],
    ...(options.domain || options.layer || options.scope
      ? {
          classification: {
            ...(options.domain ? { domain: options.domain } : {}),
            ...(options.layer ? { layer: options.layer } : {}),
            ...(options.scope ? { scope: options.scope } : {}),
          },
        }
      : {}),
    ...(options.owner
      ? {
          ownership: {
            team: options.owner,
            source: 'package.json',
          },
        }
      : {}),
    metadata: {},
  };

  return attachTypeScriptGovernanceModelExpansion(node, {
    kind: 'node',
    technology: 'typescript',
    nodeKind: 'workspace-project',
    packageManager: options.sourceSystem ?? 'pnpm',
    ...(options.packageJson ? { packageJson: options.packageJson } : {}),
    packageManagerPackage: {
      workspace: true,
      external: false,
      ...(options.packageJson &&
      typeof options.packageJson.name === 'string' &&
      options.packageJson.name.length > 0
        ? { packageName: options.packageJson.name }
        : {}),
    },
    workspaceProject: {
      id: options.id,
      projectRoot: options.root ?? `packages/${options.id}`,
    },
  });
}

export function createTsconfigNode(
  options: {
    path?: string;
    aliases?: Record<string, string[]>;
  } = {},
): GovernanceNode {
  const configPath = options.path ?? 'tsconfig.base.json';
  const node: GovernanceNode = {
    id: `tsconfig:${configPath}`,
    name: configPath.split('/').at(-1) ?? configPath,
    kind: 'resource',
    technology: 'typescript',
    sourceSystem: 'typescript',
    root: '.',
    path: configPath,
    tags: [],
    metadata: {},
  };

  return attachTypeScriptGovernanceModelExpansion(node, {
    kind: 'node',
    technology: 'typescript',
    nodeKind: 'tsconfig',
    tsconfig: {
      configFile: configPath,
      pathAliases: options.aliases ?? {},
    },
  });
}

export function createExternalPackageNode(options: {
  name: string;
  packageManager?: 'pnpm' | 'npm' | 'yarn';
}): GovernanceNode {
  const node: GovernanceNode = {
    id: `package:${options.name}`,
    name: options.name,
    kind: 'resource',
    sourceSystem: options.packageManager ?? 'pnpm',
    tags: [],
    metadata: {},
  };

  return attachTypeScriptGovernanceModelExpansion(node, {
    kind: 'node',
    technology: 'typescript',
    nodeKind: 'package-manager-package',
    packageManager: options.packageManager ?? 'pnpm',
    packageName: options.name,
    packageManagerPackage: {
      external: true,
      workspace: false,
      packageName: options.name,
    },
  });
}

export function createImportRelation(options: {
  sourceNodeId: string;
  targetNodeId: string;
  sourceFile?: string;
  specifier?: string;
  importKind?: 'static-import' | 're-export' | 'dynamic-import';
  external?: boolean;
}): GovernanceRelation {
  const relation: GovernanceRelation = {
    id: `typescript:import:${options.sourceNodeId}->${options.targetNodeId}:${options.specifier ?? 'unknown'}`,
    sourceNodeId: options.sourceNodeId,
    targetNodeId: options.targetNodeId,
    kind: 'dependency',
    metadata: {},
  };

  return attachTypeScriptGovernanceModelExpansion(relation, {
    kind: 'relation',
    technology: 'typescript',
    relationKind: 'import',
    ...(options.specifier ? { importSpecifiers: [options.specifier] } : {}),
    import: {
      ...(options.sourceFile ? { sourceFile: options.sourceFile } : {}),
      ...(options.specifier ? { specifier: options.specifier } : {}),
      importKind: options.importKind ?? 'static-import',
      external: options.external ?? false,
    },
  });
}

export function createDependencyRelation(options: {
  sourceNodeId: string;
  targetNodeId: string;
  dependencyType?:
    | 'dependencies'
    | 'devDependencies'
    | 'peerDependencies'
    | 'optionalDependencies';
  packageName?: string;
  specifier?: string;
  packageManager?: 'pnpm' | 'npm' | 'yarn';
}): GovernanceRelation {
  const relation: GovernanceRelation = {
    id: `typescript:dependency:${options.sourceNodeId}->${options.targetNodeId}:${options.dependencyType ?? 'dependencies'}`,
    sourceNodeId: options.sourceNodeId,
    targetNodeId: options.targetNodeId,
    kind: 'dependency',
    metadata: {},
  };

  return attachTypeScriptGovernanceModelExpansion(relation, {
    kind: 'relation',
    technology: 'typescript',
    relationKind: 'package-dependency',
    packageDependency: {
      packageManager: options.packageManager ?? 'pnpm',
      dependencyType: options.dependencyType ?? 'dependencies',
      packageName:
        options.packageName ?? options.targetNodeId.replace(/^package:/u, ''),
      specifier: options.specifier ?? '^1.0.0',
    },
  });
}

export function createPathMappingRelation(options: {
  tsconfigNodeId: string;
  targetNodeId: string;
  alias: string;
  target: string;
  tsconfig?: string;
}): GovernanceRelation {
  const relation: GovernanceRelation = {
    id: `typescript:path-mapping:${options.tsconfigNodeId}->${options.targetNodeId}:${options.alias}`,
    sourceNodeId: options.tsconfigNodeId,
    targetNodeId: options.targetNodeId,
    kind: 'traceability',
    metadata: {},
  };

  return attachTypeScriptGovernanceModelExpansion(relation, {
    kind: 'relation',
    technology: 'typescript',
    relationKind: 'path-alias',
    pathMapping: {
      alias: options.alias,
      target: options.target,
      tsconfig: options.tsconfig ?? 'tsconfig.base.json',
    },
  });
}
