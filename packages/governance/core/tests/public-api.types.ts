import type {
  GovernanceNode,
  GovernanceRelation,
  GovernanceWorkspace,
} from '../src/index.js';

const workspace = {
  id: 'workspace',
  name: 'Workspace',
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

void node;
void relation;

// @ts-expect-error GovernanceProject is no longer part of the public Core API.
type RemovedGovernanceProject = import('../src/index.js').GovernanceProject;

// @ts-expect-error GovernanceDependency is no longer part of the public Core API.
type RemovedGovernanceDependency = import('../src/index.js').GovernanceDependency;

// @ts-expect-error GovernanceProjectInput is no longer part of the public Core API.
type RemovedGovernanceProjectInput = import('../src/index.js').GovernanceProjectInput;

// @ts-expect-error GovernanceDependencyInput is no longer part of the public Core API.
type RemovedGovernanceDependencyInput = import('../src/index.js').GovernanceDependencyInput;
