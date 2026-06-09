import type {
  GovernanceDependency,
  GovernanceDependencyInput,
  GovernanceNode,
  GovernanceNormalizedGraph,
  GovernanceProject,
  GovernanceProjectInput,
  GovernanceRelation,
  GovernanceWorkspace,
} from '../src/index.js';

const workspace = {
  id: 'workspace',
  name: 'Workspace',
  root: '/workspace',
  projects: [
    {
      id: 'node-a',
      name: 'Node A',
      root: 'apps/node-a',
      type: 'application',
      tags: [],
      metadata: {},
    },
  ],
  dependencies: [
    {
      source: 'node-a',
      target: 'node-a',
      type: 'static',
    },
  ],
  nodes: [
    {
      id: 'node-a',
      kind: 'project',
      tags: [],
      metadata: {},
    },
  ],
  relations: [
    {
      id: 'relation-a',
      sourceNodeId: 'node-a',
      targetNodeId: 'node-a',
      kind: 'dependency',
      metadata: {},
    },
  ],
} satisfies GovernanceWorkspace;

const node: GovernanceNode = workspace.nodes[0];
const relation: GovernanceRelation = workspace.relations[0];
const project: GovernanceProject = workspace.projects[0];
const dependency: GovernanceDependency = workspace.dependencies[0];
const graph: GovernanceNormalizedGraph = {
  nodes: workspace.nodes,
  relations: workspace.relations,
};

const projectInput: GovernanceProjectInput = {
  id: 'node-a',
  root: 'apps/node-a',
};

const dependencyInput: GovernanceDependencyInput = {
  sourceProjectId: 'node-a',
  targetProjectId: 'node-a',
};

void node;
void relation;
void project;
void dependency;
void graph;
void projectInput;
void dependencyInput;
