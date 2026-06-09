import type { GovernanceWorkspaceAdapterResult } from '../adapter/adapter.js';
import type { GovernanceNode, GovernanceRelation } from '../model/models.js';
import {
  buildGovernanceNormalizedGraph,
  type GovernanceNormalizedGraph,
} from './internal-normalization.js';

export type { GovernanceNormalizedGraph } from './internal-normalization.js';
export type GovernanceNormalizedNode = GovernanceNode;
export type GovernanceNormalizedRelation = GovernanceRelation;

/**
 * Internal graph normalization for the canonical workspace transition.
 * It accepts legacy project/dependency fields and canonical node/relation
 * fields without changing downstream graph consumers.
 */
export function normalizeGovernanceGraph(
  adapterResult: GovernanceWorkspaceAdapterResult,
): GovernanceNormalizedGraph {
  return buildGovernanceNormalizedGraph(adapterResult);
}
