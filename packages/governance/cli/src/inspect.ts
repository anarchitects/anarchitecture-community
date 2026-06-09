import {
  buildGovernanceWorkspace,
  normalizeGovernanceGraph,
  type GovernanceCapability,
  type GovernanceDependency,
  type GovernanceDiagnostic,
  type GovernanceNode,
  type GovernanceProject,
  type GovernanceRelation,
  type GovernanceWorkspace,
  type GovernanceWorkspaceAdapter,
  type GovernanceWorkspaceAdapterResult,
  type Ownership,
} from '@anarchitects/governance-core';

import { loadGenericWorkspaceAdapterResult } from './internal/manual-workspace/load-workspace.js';
import { toCompatibilityWorkspace } from './workspace-compat.js';

type GovernanceGraph = ReturnType<typeof normalizeGovernanceGraph>;

export interface AgovInspectFilters {
  project?: string;
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

export interface AgovInspectProject {
  id: string;
  name: string;
  root: string;
  type: GovernanceProject['type'];
  tags: string[];
  domain?: string;
  layer?: string;
  ownership?: Ownership;
  metadata: Record<string, unknown>;
}

export interface AgovInspectDependency {
  source: string;
  target: string;
  type: GovernanceDependency['type'];
  sourceFile?: string;
}

export interface AgovInspectSummary {
  workspaceName: string;
  nodeCount: number;
  relationCount: number;
  projectCount: number;
  dependencyCount: number;
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
  projects: AgovInspectProject[];
  dependencies: AgovInspectDependency[];
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
  const filteredWorkspace = applyInspectFilters(
    toCompatibilityWorkspace(workspace),
    options.filters,
  );
  const graph = normalizeGovernanceGraph(workspaceAdapterResult);
  const filteredGraph = applyInspectGraphFilters(
    graph,
    filteredWorkspace,
    options.filters,
  );
  const projects = sortProjects(filteredWorkspace.projects).map(
    normalizeProject,
  );
  const dependencies = sortDependencies(filteredWorkspace.dependencies).map(
    normalizeDependency,
  );

  return {
    command: 'inspect',
    workspace: normalizeWorkspace(workspace, workspaceAdapterResult),
    nodes: sortNodes(filteredGraph.nodes),
    relations: sortRelations(filteredGraph.relations),
    projects,
    dependencies,
    summary: buildSummary(
      filteredWorkspace.name,
      filteredGraph.nodes,
      filteredGraph.relations,
      projects,
      dependencies,
    ),
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

function normalizeProject(project: GovernanceProject): AgovInspectProject {
  return {
    id: project.id,
    name: project.name,
    root: project.root,
    type: project.type,
    tags: [...project.tags],
    ...(project.domain ? { domain: project.domain } : {}),
    ...(project.layer ? { layer: project.layer } : {}),
    ...(project.ownership ? { ownership: project.ownership } : {}),
    metadata: { ...project.metadata },
  };
}

function normalizeDependency(
  dependency: GovernanceDependency,
): AgovInspectDependency {
  return {
    source: dependency.source,
    target: dependency.target,
    type: dependency.type,
    ...(dependency.sourceFile ? { sourceFile: dependency.sourceFile } : {}),
  };
}

function applyInspectFilters(
  workspace: ReturnType<typeof toCompatibilityWorkspace>,
  filters: AgovInspectFilters | undefined,
): ReturnType<typeof toCompatibilityWorkspace> {
  if (!filters) {
    return workspace;
  }

  const projects = workspace.projects.filter((project) => {
    if (
      filters.project &&
      project.id !== filters.project &&
      project.name !== filters.project
    ) {
      return false;
    }

    if (filters.domain && project.domain !== filters.domain) {
      return false;
    }

    if (filters.layer && project.layer !== filters.layer) {
      return false;
    }

    if (filters.type && project.type !== filters.type) {
      return false;
    }

    return true;
  });

  const projectIds = new Set(projects.map((project) => project.id));
  const dependencies = workspace.dependencies.filter(
    (dependency) =>
      projectIds.has(dependency.source) || projectIds.has(dependency.target),
  );

  return {
    ...workspace,
    projects,
    dependencies,
  };
}

function applyInspectGraphFilters(
  graph: GovernanceGraph,
  workspace: ReturnType<typeof toCompatibilityWorkspace>,
  filters: AgovInspectFilters | undefined,
): GovernanceGraph {
  if (!filters) {
    return graph;
  }

  const nodeIds = new Set(workspace.projects.map((project) => project.id));
  const nodes = graph.nodes.filter((node) => nodeIds.has(node.id));
  const relations = graph.relations.filter(
    (relation) =>
      nodeIds.has(relation.sourceNodeId) || nodeIds.has(relation.targetNodeId),
  );

  return {
    nodes,
    relations,
  };
}

function sortNodes(
  nodes: readonly GovernanceNode[],
): GovernanceNode[] {
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

    return left.id.localeCompare(right.id);
  });
}

function sortProjects(projects: GovernanceProject[]): GovernanceProject[] {
  return [...projects].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) {
      return byName;
    }

    const byId = left.id.localeCompare(right.id);
    if (byId !== 0) {
      return byId;
    }

    return left.root.localeCompare(right.root);
  });
}

function sortDependencies(
  dependencies: GovernanceDependency[],
): GovernanceDependency[] {
  return [...dependencies].sort((left, right) => {
    const bySource = left.source.localeCompare(right.source);
    if (bySource !== 0) {
      return bySource;
    }

    const byTarget = left.target.localeCompare(right.target);
    if (byTarget !== 0) {
      return byTarget;
    }

    const byType = left.type.localeCompare(right.type);
    if (byType !== 0) {
      return byType;
    }

    return (left.sourceFile ?? '').localeCompare(right.sourceFile ?? '');
  });
}

function buildSummary(
  workspaceName: string,
  nodes: GovernanceNode[],
  relations: GovernanceRelation[],
  projects: AgovInspectProject[],
  dependencies: AgovInspectDependency[],
): AgovInspectSummary {
  const distinctDomains = uniqueSortedValues(
    projects.flatMap((project) => (project.domain ? [project.domain] : [])),
  );
  const distinctLayers = uniqueSortedValues(
    projects.flatMap((project) => (project.layer ? [project.layer] : [])),
  );
  const ownershipCovered = projects.filter((project) => {
    const ownership = project.ownership;
    return Boolean(ownership?.team) || (ownership?.contacts?.length ?? 0) > 0;
  }).length;

  return {
    workspaceName,
    nodeCount: nodes.length,
    relationCount: relations.length,
    projectCount: projects.length,
    dependencyCount: dependencies.length,
    distinctNodeKinds: uniqueSortedValues(nodes.map((node) => node.kind)),
    distinctRelationKinds: uniqueSortedValues(
      relations.map((relation) => relation.kind),
    ),
    distinctDomains,
    distinctLayers,
    ownershipCoverage: {
      covered: ownershipCovered,
      total: projects.length,
      ratio: projects.length > 0 ? ownershipCovered / projects.length : 0,
    },
  };
}

function uniqueSortedValues(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
