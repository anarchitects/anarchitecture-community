import {
  buildGovernanceWorkspace,
  type GovernanceNode,
  type GovernanceRelation,
  type GovernanceWorkspaceAdapter,
  type GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

import { loadGenericWorkspaceAdapterResult } from './internal/manual-workspace/load-workspace.js';

export type AgovDependencyType = 'static' | 'dynamic' | 'implicit' | 'unknown';

export interface AgovDependenciesFilters {
  source?: string;
  target?: string;
  node?: string;
  type?: AgovDependencyType;
}

export interface AgovDependenciesWorkspace {
  id: string;
  name: string;
  root: string;
}

export interface AgovDependencyEntry {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceNodeName?: string;
  targetNodeName?: string;
  kind: string;
  type: AgovDependencyType;
  sourceFile?: string;
}

export interface AgovDependenciesNode {
  id: string;
  name?: string;
  kind: string;
  root?: string;
}

export interface AgovDependenciesSummary {
  totalDependencies: number;
  byType: Array<{ type: AgovDependencyType; count: number }>;
  nodeCount: number;
  sourceNodeCount: number;
  targetNodeCount: number;
  topOutgoing: Array<{
    nodeId: string;
    nodeName: string;
    count: number;
  }>;
  topIncoming: Array<{
    nodeId: string;
    nodeName: string;
    count: number;
  }>;
}

export interface AgovDependenciesResult {
  command: 'dependencies';
  workspace: AgovDependenciesWorkspace;
  dependencies: AgovDependencyEntry[];
  nodes: AgovDependenciesNode[];
  summary: AgovDependenciesSummary;
}

export interface AgovDependenciesWithWorkspacePathOptions {
  workspacePath: string;
  workspaceAdapter?: undefined;
  workspaceAdapterInput?: undefined;
  filters?: AgovDependenciesFilters;
}

export interface AgovDependenciesWithAdapterOptions<TInput = unknown> {
  workspaceAdapter: GovernanceWorkspaceAdapter<TInput>;
  workspaceAdapterInput: TInput;
  workspacePath?: undefined;
  filters?: AgovDependenciesFilters;
}

export type AgovDependenciesOptions<TInput = unknown> =
  | AgovDependenciesWithWorkspacePathOptions
  | AgovDependenciesWithAdapterOptions<TInput>;

export async function runAgovDependencies<TInput = unknown>(
  options: AgovDependenciesOptions<TInput>,
): Promise<AgovDependenciesResult> {
  const workspaceAdapterResult = resolveWorkspaceAdapterResult(options);
  const workspace = buildGovernanceWorkspace(workspaceAdapterResult);
  const filteredDependencies = applyDependencyFilters(
    workspace.nodes,
    workspace.relations,
    options.filters,
  ).map((relation) => normalizeDependency(relation, workspace.nodes));
  const scopedNodes = collectReferencedNodes(
    workspace.nodes,
    filteredDependencies,
  ).map(normalizeNode);

  return {
    command: 'dependencies',
    workspace: {
      id: workspace.id,
      name: workspace.name,
      root: workspace.root,
    },
    dependencies: filteredDependencies,
    nodes: scopedNodes,
    summary: buildSummary(filteredDependencies, scopedNodes),
  };
}

function resolveWorkspaceAdapterResult<TInput>(
  options: AgovDependenciesOptions<TInput>,
): GovernanceWorkspaceAdapterResult {
  if ('workspaceAdapter' in options && options.workspaceAdapter) {
    return options.workspaceAdapter.loadWorkspace(
      options.workspaceAdapterInput,
    );
  }

  return loadGenericWorkspaceAdapterResult(options.workspacePath);
}

function applyDependencyFilters(
  nodes: GovernanceNode[],
  relations: GovernanceRelation[],
  filters: AgovDependenciesFilters | undefined,
): GovernanceRelation[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const dependencyRelations = relations.filter(isDependencyRelation);

  if (!filters) {
    return sortDependencies(dependencyRelations);
  }

  return sortDependencies(
    dependencyRelations.filter((relation) => {
      const sourceNode = nodeById.get(relation.sourceNodeId);
      const targetNode = nodeById.get(relation.targetNodeId);
      const dependencyType = normalizeDependencyType(relation);

      if (
        filters.source &&
        !matchesNodeFilter(sourceNode, relation.sourceNodeId, filters.source)
      ) {
        return false;
      }

      if (
        filters.target &&
        !matchesNodeFilter(targetNode, relation.targetNodeId, filters.target)
      ) {
        return false;
      }

      if (
        filters.node &&
        !matchesNodeFilter(sourceNode, relation.sourceNodeId, filters.node) &&
        !matchesNodeFilter(targetNode, relation.targetNodeId, filters.node)
      ) {
        return false;
      }

      if (filters.type && dependencyType !== filters.type) {
        return false;
      }

      return true;
    }),
  );
}

function matchesNodeFilter(
  node: GovernanceNode | undefined,
  nodeId: string,
  expected: string,
): boolean {
  return nodeId === expected || node?.name === expected;
}

function sortDependencies(
  relations: GovernanceRelation[],
): GovernanceRelation[] {
  return [...relations].sort((left, right) => {
    return (
      left.sourceNodeId.localeCompare(right.sourceNodeId) ||
      left.targetNodeId.localeCompare(right.targetNodeId) ||
      normalizeDependencyType(left).localeCompare(
        normalizeDependencyType(right),
      ) ||
      left.id.localeCompare(right.id)
    );
  });
}

function normalizeDependency(
  relation: GovernanceRelation,
  nodes: readonly GovernanceNode[],
): AgovDependencyEntry {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));

  return {
    id: relation.id,
    sourceNodeId: relation.sourceNodeId,
    targetNodeId: relation.targetNodeId,
    ...(nodeById.get(relation.sourceNodeId)?.name
      ? { sourceNodeName: nodeById.get(relation.sourceNodeId)?.name }
      : {}),
    ...(nodeById.get(relation.targetNodeId)?.name
      ? { targetNodeName: nodeById.get(relation.targetNodeId)?.name }
      : {}),
    kind: relation.kind,
    type: normalizeDependencyType(relation),
    ...(readStringMetadata(relation.metadata, 'sourceFile')
      ? { sourceFile: readStringMetadata(relation.metadata, 'sourceFile') }
      : {}),
  };
}

function collectReferencedNodes(
  nodes: GovernanceNode[],
  dependencies: AgovDependencyEntry[],
): GovernanceNode[] {
  const referencedNodeIds = new Set<string>();

  for (const dependency of dependencies) {
    referencedNodeIds.add(dependency.sourceNodeId);
    referencedNodeIds.add(dependency.targetNodeId);
  }

  return [...nodes]
    .filter((node) => referencedNodeIds.has(node.id))
    .sort((left, right) => {
      return (
        (left.name ?? '').localeCompare(right.name ?? '') ||
        left.id.localeCompare(right.id)
      );
    });
}

function normalizeNode(node: GovernanceNode): AgovDependenciesNode {
  return {
    id: node.id,
    ...(node.name ? { name: node.name } : {}),
    kind: node.kind,
    ...((node.root ?? node.path) ? { root: node.root ?? node.path } : {}),
  };
}

function buildSummary(
  dependencies: AgovDependencyEntry[],
  nodes: AgovDependenciesNode[],
): AgovDependenciesSummary {
  const byTypeMap = countBy(dependencies, (dependency) => dependency.type);
  const sourceCounts = countBy(
    dependencies,
    (dependency) => dependency.sourceNodeId,
  );
  const targetCounts = countBy(
    dependencies,
    (dependency) => dependency.targetNodeId,
  );
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return {
    totalDependencies: dependencies.length,
    byType: [...byTypeMap.entries()]
      .map(([type, count]) => ({ type: type as AgovDependencyType, count }))
      .sort((left, right) => left.type.localeCompare(right.type)),
    nodeCount: nodes.length,
    sourceNodeCount: sourceCounts.size,
    targetNodeCount: targetCounts.size,
    topOutgoing: toTopNodeCounts(sourceCounts, nodesById),
    topIncoming: toTopNodeCounts(targetCounts, nodesById),
  };
}

function countBy<T>(
  values: T[],
  projector: (value: T) => string,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = projector(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function toTopNodeCounts(
  counts: Map<string, number>,
  nodesById: Map<string, AgovDependenciesNode>,
): Array<{ nodeId: string; nodeName: string; count: number }> {
  return [...counts.entries()]
    .map(([nodeId, count]) => ({
      nodeId,
      nodeName: nodesById.get(nodeId)?.name ?? nodeId,
      count,
    }))
    .sort((left, right) => {
      return (
        right.count - left.count ||
        left.nodeName.localeCompare(right.nodeName) ||
        left.nodeId.localeCompare(right.nodeId)
      );
    });
}

function isDependencyRelation(relation: GovernanceRelation): boolean {
  return relation.kind === 'dependency';
}

function normalizeDependencyType(
  relation: GovernanceRelation,
): AgovDependencyType {
  const type = readStringMetadata(relation.metadata, 'dependencyType');
  if (type === 'static' || type === 'dynamic' || type === 'implicit') {
    return type;
  }

  return 'unknown';
}

function readStringMetadata(
  metadata: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
