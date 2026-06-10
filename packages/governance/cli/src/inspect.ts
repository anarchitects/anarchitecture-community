import {
  buildGovernanceWorkspace,
  type GovernanceCapability,
  type GovernanceDiagnostic,
  type GovernanceNode,
  type GovernanceRelation,
  type GovernanceWorkspace,
  type GovernanceWorkspaceAdapter,
  type GovernanceWorkspaceAdapterResult,
} from '@anarchitects/governance-core';

import { loadGenericWorkspaceAdapterResult } from './internal/manual-workspace/load-workspace.js';

export interface AgovInspectFilters {
  node?: string;
  domain?: string;
  layer?: string;
  type?: string;
}

export interface AgovInspectWorkspace {
  id: string;
  name: string;
  root: string;
  metadata?: Record<string, unknown>;
}

export interface AgovInspectAdapterMetadata {
  id: string;
  metadata?: Record<string, unknown>;
  capabilities: GovernanceCapability[];
  diagnostics: GovernanceDiagnostic[];
}

export interface AgovInspectSummary {
  workspaceName: string;
  nodeCount: number;
  relationCount: number;
  distinctNodeKinds: string[];
  distinctRelationKinds: string[];
  distinctDomains: string[];
  distinctLayers: string[];
  ownershipCoverage: {
    covered: number;
    total: number;
    ratio: number;
  };
}

export interface AgovInspectResult {
  command: 'inspect';
  workspace: AgovInspectWorkspace;
  nodes: GovernanceNode[];
  relations: GovernanceRelation[];
  summary?: AgovInspectSummary;
  adapter: AgovInspectAdapterMetadata;
}

export interface AgovInspectWithWorkspacePathOptions {
  workspacePath: string;
  workspaceAdapter?: undefined;
  workspaceAdapterInput?: undefined;
  filters?: AgovInspectFilters;
}

export interface AgovInspectWithAdapterOptions<TInput = unknown> {
  workspaceAdapter: GovernanceWorkspaceAdapter<TInput>;
  workspaceAdapterInput: TInput;
  workspacePath?: undefined;
  filters?: AgovInspectFilters;
}

export type AgovInspectOptions<TInput = unknown> =
  | AgovInspectWithWorkspacePathOptions
  | AgovInspectWithAdapterOptions<TInput>;

const MANUAL_WORKSPACE_ADAPTER_ID = 'governance-cli:manual-workspace';

export async function runAgovInspect<TInput = unknown>(
  options: AgovInspectOptions<TInput>,
): Promise<AgovInspectResult> {
  const workspaceAdapterResult = resolveWorkspaceAdapterResult(options);
  const workspace = buildGovernanceWorkspace(workspaceAdapterResult);
  const filteredWorkspace = applyInspectFilters(workspace, options.filters);

  return {
    command: 'inspect',
    workspace: normalizeWorkspace(workspace, workspaceAdapterResult),
    nodes: sortNodes(filteredWorkspace.nodes),
    relations: sortRelations(filteredWorkspace.relations),
    summary: buildSummary(filteredWorkspace),
    adapter: normalizeAdapterMetadata(
      workspaceAdapterResult,
      resolveAdapterId(options),
    ),
  };
}

function resolveWorkspaceAdapterResult<TInput>(
  options: AgovInspectOptions<TInput>,
): GovernanceWorkspaceAdapterResult {
  if ('workspaceAdapter' in options && options.workspaceAdapter) {
    return options.workspaceAdapter.loadWorkspace(
      options.workspaceAdapterInput,
    );
  }

  return loadGenericWorkspaceAdapterResult(options.workspacePath);
}

function resolveAdapterId<TInput>(options: AgovInspectOptions<TInput>): string {
  if ('workspaceAdapter' in options && options.workspaceAdapter) {
    return options.workspaceAdapter.id;
  }

  return MANUAL_WORKSPACE_ADAPTER_ID;
}

function normalizeWorkspace(
  workspace: GovernanceWorkspace,
  workspaceAdapterResult: GovernanceWorkspaceAdapterResult,
): AgovInspectWorkspace {
  return {
    id: workspace.id,
    name: workspace.name,
    root: workspace.root,
    ...(workspaceAdapterResult.metadata
      ? { metadata: workspaceAdapterResult.metadata }
      : {}),
  };
}

function normalizeAdapterMetadata(
  workspaceAdapterResult: GovernanceWorkspaceAdapterResult,
  adapterId: string,
): AgovInspectAdapterMetadata {
  return {
    id: adapterId,
    ...(workspaceAdapterResult.metadata
      ? { metadata: workspaceAdapterResult.metadata }
      : {}),
    capabilities: [...(workspaceAdapterResult.capabilities ?? [])],
    diagnostics: [...(workspaceAdapterResult.diagnostics ?? [])],
  };
}

function applyInspectFilters(
  workspace: GovernanceWorkspace,
  filters: AgovInspectFilters | undefined,
): GovernanceWorkspace {
  if (!filters) {
    return workspace;
  }

  const nodes = workspace.nodes.filter((node) => {
    if (
      filters.node &&
      node.id !== filters.node &&
      node.name !== filters.node
    ) {
      return false;
    }

    if (filters.domain && readNodeDomain(node) !== filters.domain) {
      return false;
    }

    if (filters.layer && readNodeLayer(node) !== filters.layer) {
      return false;
    }

    if (filters.type && node.kind !== filters.type) {
      return false;
    }

    return true;
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const relations = workspace.relations.filter(
    (relation) =>
      nodeIds.has(relation.sourceNodeId) || nodeIds.has(relation.targetNodeId),
  );

  return {
    ...workspace,
    nodes,
    relations,
  };
}

function sortNodes(nodes: readonly GovernanceNode[]): GovernanceNode[] {
  return [...nodes].sort((left, right) => {
    const byKind = left.kind.localeCompare(right.kind);
    if (byKind !== 0) {
      return byKind;
    }

    return left.id.localeCompare(right.id);
  });
}

function sortRelations(
  relations: readonly GovernanceRelation[],
): GovernanceRelation[] {
  return [...relations].sort((left, right) => {
    const byKind = left.kind.localeCompare(right.kind);
    if (byKind !== 0) {
      return byKind;
    }

    return (
      left.sourceNodeId.localeCompare(right.sourceNodeId) ||
      left.targetNodeId.localeCompare(right.targetNodeId) ||
      left.id.localeCompare(right.id)
    );
  });
}

function buildSummary(workspace: GovernanceWorkspace): AgovInspectSummary {
  const distinctDomains = uniqueSortedValues(
    workspace.nodes.flatMap((node) => {
      const domain = readNodeDomain(node);
      return domain ? [domain] : [];
    }),
  );
  const distinctLayers = uniqueSortedValues(
    workspace.nodes.flatMap((node) => {
      const layer = readNodeLayer(node);
      return layer ? [layer] : [];
    }),
  );
  const ownershipCovered = workspace.nodes.filter((node) => {
    const ownership = node.ownership;
    return Boolean(ownership?.team) || (ownership?.contacts?.length ?? 0) > 0;
  }).length;

  return {
    workspaceName: workspace.name,
    nodeCount: workspace.nodes.length,
    relationCount: workspace.relations.length,
    distinctNodeKinds: uniqueSortedValues(
      workspace.nodes.map((node) => node.kind),
    ),
    distinctRelationKinds: uniqueSortedValues(
      workspace.relations.map((relation) => relation.kind),
    ),
    distinctDomains,
    distinctLayers,
    ownershipCoverage: {
      covered: ownershipCovered,
      total: workspace.nodes.length,
      ratio:
        workspace.nodes.length > 0
          ? ownershipCovered / workspace.nodes.length
          : 0,
    },
  };
}

function readNodeDomain(node: GovernanceNode): string | undefined {
  const domain = node.classification?.domain;
  if (typeof domain === 'string' && domain.length > 0) {
    return domain;
  }

  const scope = node.classification?.scope;
  return typeof scope === 'string' && scope.length > 0 ? scope : undefined;
}

function readNodeLayer(node: GovernanceNode): string | undefined {
  const layer = node.classification?.layer;
  return typeof layer === 'string' && layer.length > 0 ? layer : undefined;
}

function uniqueSortedValues(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
