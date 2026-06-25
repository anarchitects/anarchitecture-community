import type {
  GovernanceNode,
  GovernanceWorkspace,
  GovernanceWorkspaceEnricher,
  GovernanceWorkspaceEnricherInput,
} from '@anarchitects/governance-core';

import { getDbtNodes, toResolverInput } from './dbt-graph.js';
import { resolveDbtGovernanceMetadata } from './resolvers.js';

export const dbtCanonicalMetadataEnricher =
  createDbtCanonicalMetadataEnricher();

export function createDbtCanonicalMetadataEnricher(): GovernanceWorkspaceEnricher {
  return {
    enrichWorkspace: (input) => enrichDbtWorkspace(input),
  };
}

function enrichDbtWorkspace(
  input: GovernanceWorkspaceEnricherInput,
): GovernanceWorkspace {
  const dbtNodes = getDbtNodes(input.workspace);

  if (dbtNodes.length === 0) {
    return input.workspace;
  }

  const resolutionsByNodeId = new Map(
    dbtNodes.map((node) => [
      node.id,
      resolveDbtGovernanceMetadata(toResolverInput(node)),
    ]),
  );

  let changed = false;
  const nodes = input.workspace.nodes.map((node) => {
    const resolution = resolutionsByNodeId.get(node.id);

    if (!resolution) {
      return node;
    }

    const enrichedNode = enrichNodeWithResolvedDomain(node, resolution.domain);
    if (enrichedNode !== node) {
      changed = true;
    }

    return enrichedNode;
  });

  if (!changed) {
    return input.workspace;
  }

  return {
    ...input.workspace,
    nodes,
  };
}

function enrichNodeWithResolvedDomain(
  node: GovernanceNode,
  domain: { status: string; value?: string },
): GovernanceNode {
  if (
    node.classification?.domain ||
    node.classification?.scope ||
    domain.status !== 'resolved' ||
    !domain.value
  ) {
    return node;
  }

  return {
    ...node,
    classification: {
      ...(node.classification ?? {}),
      domain: domain.value,
    },
  };
}
