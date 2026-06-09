import type {
  GovernanceNode,
  GovernanceRelation,
  GovernanceWorkspace,
} from '../src/index.js';

const workspace = {
  id: 'workspace',
  name: 'Workspace',
  root: '/workspace',
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
