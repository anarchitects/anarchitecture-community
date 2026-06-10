import type {
  GovernanceNode,
  GovernanceNodeInput,
  GovernanceRuntimeReference,
  GovernanceRelation,
  GovernanceRelationInput,
  GovernanceWorkspace,
} from '../src/index.js';
// @ts-expect-error GovernanceProjectInput is no longer part of the public API.
import type { GovernanceProjectInput } from '../src/index.js';
// @ts-expect-error GovernanceDependencyInput is no longer part of the public API.
import type { GovernanceDependencyInput } from '../src/index.js';
// @ts-expect-error GovernanceProject is no longer part of the public API.
import type { GovernanceProject } from '../src/index.js';
// @ts-expect-error GovernanceDependency is no longer part of the public API.
import type { GovernanceDependency } from '../src/index.js';
// @ts-expect-error GovernanceCompatibilityWorkspace is no longer part of the public API.
import type { GovernanceCompatibilityWorkspace } from '../src/index.js';

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
const nodeInput: GovernanceNodeInput = {
  id: node.id,
};
const relationInput: GovernanceRelationInput = {
  sourceNodeId: relation.sourceNodeId,
  targetNodeId: relation.targetNodeId,
};
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
void nodeInput;
void relationInput;
void reference;
void legacyProjectReference;
