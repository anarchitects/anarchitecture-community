import { normalizeGovernanceGraph } from '../src/core/index.js';
import type {
  GovernanceWorkspaceAdapterResult,
  Ownership,
} from '../src/core/index.js';
import type {
  GovernanceCompatibilityWorkspace,
  GovernanceDependency,
  GovernanceNode,
  GovernanceProject,
  GovernanceRelation,
  GovernanceWorkspace,
} from '../src/core/model/models.js';

export const bookingTeamOwnership = {
  team: 'booking-team',
  contacts: ['@booking-team'],
  source: 'project-metadata',
} satisfies Ownership;

export const platformTeamOwnership = {
  team: 'platform-team',
  contacts: ['@platform-team'],
  source: 'project-metadata',
} satisfies Ownership;

export const coreTestProjects = [
  {
    id: 'booking-ui',
    name: 'booking-ui',
    root: 'libs/booking/ui',
    type: 'library',
    domain: 'booking',
    layer: 'ui',
    tags: ['scope:booking', 'type:ui'],
    ownership: bookingTeamOwnership,
    metadata: {
      documentation: true,
    },
  },
  {
    id: 'booking-domain',
    name: 'booking-domain',
    root: 'libs/booking/domain',
    type: 'library',
    domain: 'booking',
    layer: 'domain',
    tags: ['scope:booking', 'type:domain'],
    ownership: bookingTeamOwnership,
    metadata: {},
  },
  {
    id: 'platform-shell',
    name: 'platform-shell',
    root: 'apps/platform-shell',
    type: 'application',
    domain: 'platform',
    layer: 'app',
    tags: ['scope:platform', 'type:app'],
    ownership: platformTeamOwnership,
    metadata: {},
  },
] satisfies GovernanceProject[];

export const coreTestDependencies = [
  {
    source: 'booking-ui',
    target: 'booking-domain',
    type: 'static',
  },
  {
    source: 'platform-shell',
    target: 'booking-ui',
    type: 'static',
    sourceFile: 'apps/platform-shell/src/main.ts',
  },
] satisfies GovernanceDependency[];

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
  projects: coreTestProjects,
  dependencies: coreTestDependencies,
} satisfies GovernanceCompatibilityWorkspace;

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
  projects: coreTestProjects,
  dependencies: [
    ...coreTestDependencies,
    {
      source: 'booking-ui',
      target: 'missing-project',
      type: 'static',
    },
  ],
} satisfies GovernanceCompatibilityWorkspace;

export function findDanglingDependencies(
  workspace: GovernanceWorkspace,
): GovernanceDependency[] {
  const compatibilityWorkspace = workspace as GovernanceCompatibilityWorkspace;
  const projectIds = new Set(
    compatibilityWorkspace.projects.map((project) => project.id),
  );

  return compatibilityWorkspace.dependencies.filter(
    (dependency) =>
      !projectIds.has(dependency.source) || !projectIds.has(dependency.target),
  );
}
