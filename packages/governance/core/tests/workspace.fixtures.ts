import { normalizeGovernanceGraph } from '../src/core/index.js';
import type {
  GovernanceWorkspaceAdapterResult,
  GovernanceNode,
  GovernanceRelation,
  GovernanceWorkspace,
} from '../src/core/index.js';

export const bookingTeamOwnership = {
  team: 'booking-team',
  contacts: ['@booking-team'],
  source: 'project-metadata',
} satisfies NonNullable<GovernanceNode['ownership']>;

export const platformTeamOwnership = {
  team: 'platform-team',
  contacts: ['@platform-team'],
  source: 'project-metadata',
} satisfies NonNullable<GovernanceNode['ownership']>;

export const coreTestNodes = [
  {
    id: 'booking-ui',
    name: 'booking-ui',
    kind: 'library',
    root: 'libs/booking/ui',
    classification: {
      domain: 'booking',
      layer: 'ui',
    },
    tags: ['scope:booking', 'layer:ui', 'type:ui'],
    ownership: {
      team: 'booking-team',
      contacts: ['@booking-team'],
      source: 'project-metadata',
    },
    metadata: {
      documentation: true,
    },
  },
  {
    id: 'booking-domain',
    name: 'booking-domain',
    kind: 'library',
    root: 'libs/booking/domain',
    classification: {
      domain: 'booking',
      layer: 'domain',
    },
    tags: ['scope:booking', 'layer:domain', 'type:domain'],
    ownership: {
      team: 'booking-team',
      contacts: ['@booking-team'],
      source: 'codeowners',
    },
    metadata: {
      ownership: {
        team: 'booking-team',
      },
    },
  },
  {
    id: 'platform-shell',
    name: 'platform-shell',
    kind: 'application',
    root: 'apps/platform-shell',
    classification: {
      domain: 'platform',
      layer: 'app',
    },
    tags: ['scope:platform', 'layer:app', 'type:app'],
    ownership: {
      team: 'platform-team',
      contacts: ['@platform-team'],
      source: 'codeowners',
    },
    metadata: {},
  },
] satisfies GovernanceNode[];

export const coreTestRelations = [
  {
    id: 'canonical:booking-ui->booking-domain:dependency:0',
    sourceNodeId: 'booking-ui',
    targetNodeId: 'booking-domain',
    kind: 'dependency',
    metadata: {
      dependencyType: 'static',
    },
  },
  {
    id: 'canonical:platform-shell->booking-ui:dependency:1',
    sourceNodeId: 'platform-shell',
    targetNodeId: 'booking-ui',
    kind: 'dependency',
    metadata: {
      dependencyType: 'static',
      sourceFile: 'apps/platform-shell/src/main.ts',
    },
  },
] satisfies GovernanceRelation[];

export const coreTestAdapterResult = {
  workspaceRoot: '/virtual/workspace',
  nodes: coreTestNodes,
  relations: coreTestRelations,
} satisfies GovernanceWorkspaceAdapterResult;

const coreTestGraph = normalizeGovernanceGraph(coreTestAdapterResult);

export const coreTestWorkspace = {
  id: 'test-workspace',
  name: 'Test Workspace',
  root: '/virtual/workspace',
  nodes: coreTestGraph.nodes,
  relations: coreTestGraph.relations,
} satisfies GovernanceWorkspace;

export const coreTestWorkspaceWithDanglingDependency = {
  id: 'edge-workspace',
  name: 'Edge Workspace',
  root: '/virtual/workspace',
  nodes: coreTestGraph.nodes,
  relations: [
    ...coreTestGraph.relations,
    {
      id: 'legacy:booking-ui->missing-project:static:2',
      sourceNodeId: 'booking-ui',
      targetNodeId: 'missing-project',
      kind: 'dependency',
      metadata: {
        dependencyType: 'static',
      },
    },
  ],
} satisfies GovernanceWorkspace;

export function findDanglingRelations(
  workspace: GovernanceWorkspace,
): GovernanceRelation[] {
  const nodeIds = new Set(workspace.nodes.map((node) => node.id));

  return workspace.relations.filter(
    (relation) =>
      !nodeIds.has(relation.sourceNodeId) ||
      !nodeIds.has(relation.targetNodeId),
  );
}
