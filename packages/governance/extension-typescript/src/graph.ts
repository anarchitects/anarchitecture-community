import type {
  GovernanceCapability,
  GovernanceExtensionModelExpansionCarrier,
  GovernanceNode,
  GovernanceRelation,
  GovernanceRuntimeReference,
  GovernanceWorkspace,
} from '@anarchitects/governance-core';

import type {
  TypeScriptGovernanceModelExpansionData,
  TypeScriptGovernanceNodeExpansionData,
  TypeScriptGovernanceRelationExpansionData,
} from './contracts.js';
import { getTypeScriptGovernanceModelExpansion } from './contracts.js';

const TYPESCRIPT_RELATION_KINDS = new Set([
  'dependency',
  'import',
  'traceability',
]);

export function getTypeScriptNodes(
  workspace: GovernanceWorkspace,
): GovernanceNode[] {
  return workspace.nodes.filter((node) => isTypeScriptNode(node));
}

export function getTypeScriptRelations(
  workspace: GovernanceWorkspace,
): GovernanceRelation[] {
  const nodeById = new Map(
    workspace.nodes.map((node) => [node.id, node] as const),
  );

  return workspace.relations.filter((relation) =>
    isTypeScriptRelation(relation, nodeById),
  );
}

export function getTypeScriptProjectNodes(
  workspace: GovernanceWorkspace,
): GovernanceNode[] {
  return getTypeScriptNodes(workspace).filter(
    (node) =>
      getTypeScriptNodeExpansionData(node)?.nodeKind === 'workspace-project' ||
      node.kind === 'typescript-workspace-project',
  );
}

export function getTsconfigNodes(
  workspace: GovernanceWorkspace,
): GovernanceNode[] {
  return getTypeScriptNodes(workspace).filter(
    (node) =>
      getTypeScriptNodeExpansionData(node)?.nodeKind === 'tsconfig' ||
      node.kind === 'typescript-tsconfig',
  );
}

export function getImportRelations(
  workspace: GovernanceWorkspace,
): GovernanceRelation[] {
  return getTypeScriptRelations(workspace).filter(
    (relation) =>
      getTypeScriptRelationExpansionData(relation)?.relationKind === 'import' ||
      relation.kind === 'import',
  );
}

export function getDependencyRelations(
  workspace: GovernanceWorkspace,
): GovernanceRelation[] {
  return getTypeScriptRelations(workspace).filter(
    (relation) =>
      getTypeScriptRelationExpansionData(relation)?.relationKind ===
        'package-dependency' ||
      (relation.kind === 'dependency' &&
        hasPackageManagerMetadata(relation.metadata)),
  );
}

export function getPathMappingRelations(
  workspace: GovernanceWorkspace,
): GovernanceRelation[] {
  return getTypeScriptRelations(workspace).filter(
    (relation) =>
      getTypeScriptRelationExpansionData(relation)?.relationKind ===
        'path-alias' || relation.kind === 'path-mapping',
  );
}

export function isTypeScriptNode(node: GovernanceNode): boolean {
  const expansion = getTypeScriptNodeExpansionData(node);

  return (
    expansion?.technology === 'typescript' ||
    node.technology === 'typescript' ||
    hasTypeScriptMetadata(node.metadata) ||
    hasPackageManagerMetadata(node.metadata) ||
    node.kind.startsWith('typescript-') ||
    (node.kind === 'package-manager-package' &&
      hasPackageManagerMetadata(node.metadata))
  );
}

export function isTypeScriptRelation(
  relation: GovernanceRelation,
  nodeById: ReadonlyMap<string, GovernanceNode>,
): boolean {
  const expansion = getTypeScriptRelationExpansionData(relation);
  if (expansion?.technology === 'typescript') {
    return true;
  }

  if (
    hasTypeScriptMetadata(relation.metadata) ||
    hasPackageManagerMetadata(relation.metadata)
  ) {
    return true;
  }

  if (!TYPESCRIPT_RELATION_KINDS.has(relation.kind)) {
    return false;
  }

  const sourceNode = nodeById.get(relation.sourceNodeId);
  const targetNode = nodeById.get(relation.targetNodeId);

  return Boolean(
    sourceNode &&
      targetNode &&
      isTypeScriptNode(sourceNode) &&
      isTypeScriptNode(targetNode),
  );
}

export function getTypeScriptMetadata(
  subject:
    | {
        metadata?: Record<string, unknown>;
        extensions?: Record<string, unknown>;
      }
    | undefined,
): Record<string, unknown> | undefined {
  const expansion = getTypeScriptExpansionData(
    subject as GovernanceExtensionModelExpansionCarrier | undefined,
  );

  if (expansion?.kind === 'node') {
    return buildNodeTypeScriptMetadata(expansion);
  }

  if (expansion?.kind === 'relation') {
    return buildRelationTypeScriptMetadata(expansion);
  }

  return asRecord(subject?.metadata?.typescript);
}

export function getPackageManagerMetadata(
  subject:
    | {
        metadata?: Record<string, unknown>;
        extensions?: Record<string, unknown>;
      }
    | undefined,
): Record<string, unknown> | undefined {
  const expansion = getTypeScriptExpansionData(
    subject as GovernanceExtensionModelExpansionCarrier | undefined,
  );

  if (expansion?.kind === 'workspace') {
    return {
      ...(expansion.packageManager
        ? { packageManager: expansion.packageManager }
        : {}),
      ...(expansion.workspacePackageName
        ? { packageName: expansion.workspacePackageName }
        : {}),
      ...(expansion.packageJsonPath
        ? { packageJsonPath: expansion.packageJsonPath }
        : {}),
      ...(expansion.packageJson ? { packageJson: expansion.packageJson } : {}),
      workspace: true,
    };
  }

  if (expansion?.kind === 'node') {
    return buildNodePackageManagerMetadata(expansion);
  }

  if (expansion?.kind === 'relation') {
    return buildRelationPackageManagerMetadata(expansion);
  }

  return asRecord(subject?.metadata?.packageManager);
}

export function hasTypeScriptMetadata(metadata: unknown): boolean {
  return Boolean(asRecord(asRecord(metadata)?.typescript));
}

export function hasPackageManagerMetadata(metadata: unknown): boolean {
  return Boolean(asRecord(asRecord(metadata)?.packageManager));
}

export function findNodeById(
  workspace: GovernanceWorkspace,
  nodeId: string,
): GovernanceNode | undefined {
  return workspace.nodes.find((node) => node.id === nodeId);
}

export function toNodeReference(
  node: GovernanceNode | string,
): GovernanceRuntimeReference {
  return {
    nodeId: typeof node === 'string' ? node : node.id,
  };
}

export function toRelationReference(
  relation: GovernanceRelation,
): GovernanceRuntimeReference {
  return {
    nodeId: relation.sourceNodeId,
    relationId: relation.id,
    relatedNodeIds: normalizeIds([
      relation.sourceNodeId,
      relation.targetNodeId,
    ]),
    relatedRelationIds: [relation.id],
  };
}

export function normalizeIds(ids: readonly (string | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))].sort();
}

export function readStringMetadata(
  value: Record<string, unknown> | undefined,
  path: readonly string[],
): string | undefined {
  const resolved = readPathValue(value, path);
  return typeof resolved === 'string' && resolved.length > 0
    ? resolved
    : undefined;
}

export function readRecordMetadata(
  value: Record<string, unknown> | undefined,
  path: readonly string[],
): Record<string, unknown> | undefined {
  return asRecord(readPathValue(value, path));
}

export function readBooleanMetadata(
  value: Record<string, unknown> | undefined,
  path: readonly string[],
): boolean | undefined {
  const resolved = readPathValue(value, path);
  return typeof resolved === 'boolean' ? resolved : undefined;
}

export function relationKey(relation: GovernanceRelation): string {
  return `${relation.sourceNodeId}->${relation.targetNodeId}`;
}

export function getWorkspacePackageManager(
  capabilities: readonly GovernanceCapability[],
): string | undefined {
  const capability = capabilities.find(
    (entry) => entry.id === 'governance.typescript.workspace',
  );
  const data = asRecord(capability?.data);
  const packageManager = data?.packageManager;

  return typeof packageManager === 'string' && packageManager.length > 0
    ? packageManager
    : undefined;
}

export function getTsconfigCapability(
  capabilities: readonly GovernanceCapability[],
): GovernanceCapability | undefined {
  return capabilities.find(
    (entry) => entry.id === 'governance.typescript.tsconfig',
  );
}

function readPathValue(
  value: Record<string, unknown> | undefined,
  path: readonly string[],
): unknown {
  let current: unknown = value;

  for (const segment of path) {
    const currentRecord = asRecord(current);
    if (!currentRecord || !(segment in currentRecord)) {
      return undefined;
    }
    current = currentRecord[segment];
  }

  return current;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function getTypeScriptExpansionData(
  subject: GovernanceExtensionModelExpansionCarrier | undefined,
): TypeScriptGovernanceModelExpansionData | undefined {
  return getTypeScriptGovernanceModelExpansion(subject)?.data;
}

function getTypeScriptNodeExpansionData(
  subject: GovernanceExtensionModelExpansionCarrier | undefined,
): TypeScriptGovernanceNodeExpansionData | undefined {
  const expansion = getTypeScriptExpansionData(subject);
  return expansion?.kind === 'node' ? expansion : undefined;
}

function getTypeScriptRelationExpansionData(
  subject: GovernanceExtensionModelExpansionCarrier | undefined,
): TypeScriptGovernanceRelationExpansionData | undefined {
  const expansion = getTypeScriptExpansionData(subject);
  return expansion?.kind === 'relation' ? expansion : undefined;
}

function buildNodeTypeScriptMetadata(
  expansion: TypeScriptGovernanceNodeExpansionData,
): Record<string, unknown> | undefined {
  if (expansion.nodeKind === 'workspace-project') {
    return {
      workspaceProject: {
        ...(expansion.workspaceProject?.id
          ? { id: expansion.workspaceProject.id }
          : {}),
        ...(expansion.workspaceProject?.type
          ? { type: expansion.workspaceProject.type }
          : {}),
        ...(expansion.workspaceProject?.projectRoot
          ? { projectRoot: expansion.workspaceProject.projectRoot }
          : {}),
      },
    };
  }

  if (expansion.nodeKind === 'tsconfig' && expansion.tsconfig) {
    return {
      tsconfig: {
        ...expansion.tsconfig,
      },
    };
  }

  return undefined;
}

function buildRelationTypeScriptMetadata(
  expansion: TypeScriptGovernanceRelationExpansionData,
): Record<string, unknown> | undefined {
  if (expansion.relationKind === 'import' && expansion.import) {
    return {
      import: {
        ...expansion.import,
      },
    };
  }

  if (expansion.relationKind === 'path-alias' && expansion.pathMapping) {
    return {
      pathMapping: {
        ...expansion.pathMapping,
      },
    };
  }

  if (
    expansion.relationKind === 'workspace-member' &&
    expansion.workspaceMember
  ) {
    return {
      workspaceMember: {
        ...expansion.workspaceMember,
      },
    };
  }

  return undefined;
}

function buildNodePackageManagerMetadata(
  expansion: TypeScriptGovernanceNodeExpansionData,
): Record<string, unknown> | undefined {
  const hasPackageManagerData =
    expansion.packageManager !== undefined ||
    expansion.packageName !== undefined ||
    expansion.packageJsonPath !== undefined ||
    expansion.packageJson !== undefined ||
    expansion.packageManagerPackage !== undefined;

  if (!hasPackageManagerData) {
    return undefined;
  }

  return {
    ...(expansion.packageManager
      ? { packageManager: expansion.packageManager }
      : {}),
    ...(expansion.packageName ? { packageName: expansion.packageName } : {}),
    ...(expansion.packageJsonPath
      ? { packageJsonPath: expansion.packageJsonPath }
      : {}),
    ...(expansion.packageJson ? { packageJson: expansion.packageJson } : {}),
    ...(expansion.packageManagerPackage ?? {}),
  };
}

function buildRelationPackageManagerMetadata(
  expansion: TypeScriptGovernanceRelationExpansionData,
): Record<string, unknown> | undefined {
  if (!expansion.packageDependency) {
    return undefined;
  }

  return {
    ...(expansion.packageDependency.packageManager
      ? { packageManager: expansion.packageDependency.packageManager }
      : {}),
    ...(expansion.packageDependency.dependencyType
      ? { dependencyType: expansion.packageDependency.dependencyType }
      : {}),
    ...(expansion.packageDependency.packageName
      ? { packageName: expansion.packageDependency.packageName }
      : {}),
    ...(expansion.packageDependency.specifier
      ? { specifier: expansion.packageDependency.specifier }
      : {}),
  };
}
