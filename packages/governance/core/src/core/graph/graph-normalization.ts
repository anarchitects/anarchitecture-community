import type { GovernanceWorkspaceAdapterResult } from '../adapter/adapter.js';
import type { GovernanceNode, GovernanceRelation } from '../model/models.js';
import { buildGovernanceNormalizedGraph } from './internal-normalization.js';

export function normalizeGovernanceGraph(
  adapterResult: GovernanceWorkspaceAdapterResult,
): {
  nodes: GovernanceNode[];
  relations: GovernanceRelation[];
} {
  return buildGovernanceNormalizedGraph(adapterResult);
}
