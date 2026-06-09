import type {
  GovernanceNode,
  GovernanceRuntimeReference,
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
const reference = {
  nodeId: node.id,
  relatedNodeIds: [node.id],
  relatedRelationIds: [relation.id],
} satisfies GovernanceRuntimeReference;

const legacyProjectReference: GovernanceRuntimeReference = {
  // @ts-expect-error Runtime references no longer accept project-specific ids.
  projectId: node.id,
};

void node;
void relation;
void reference;
void legacyProjectReference;
