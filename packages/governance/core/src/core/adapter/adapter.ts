import type {
  GovernanceRuntimeReference,
  GovernanceWorkspace,
} from '../model/models.js';
import { buildGovernanceNormalizedGraph } from '../graph/internal-normalization.js';
import type { GovernanceExtensionModelExpansionMap } from '../../extensions/model-expansions.js';

export interface GovernanceWorkspaceAdapterResult {
  workspace?: GovernanceWorkspace;
  workspaceId?: string;
  workspaceName?: string;
  workspaceRoot?: string;
  nodes?: GovernanceNodeInput[];
  relations?: GovernanceRelationInput[];
  capabilities?: GovernanceCapability[];
  diagnostics?: GovernanceDiagnostic[];
  extensions?: GovernanceExtensionModelExpansionMap;
  metadata?: Record<string, unknown>;
}

export type GovernanceWorkspaceAdapterProbeConfidence =
  | 'none'
  | 'low'
  | 'medium'
  | 'high';

export interface GovernanceWorkspaceAdapterProbeResult {
  supported: boolean;
  confidence?: GovernanceWorkspaceAdapterProbeConfidence;
  reasons?: string[];
  diagnostics?: GovernanceDiagnostic[];
  capabilities?: GovernanceCapability[];
  metadata?: Record<string, unknown>;
}

export interface GovernanceWorkspaceAdapter<TInput = unknown> {
  id: string;
  probe?(input: TInput): GovernanceWorkspaceAdapterProbeResult;
  loadWorkspace(input: TInput): GovernanceWorkspaceAdapterResult;
}

export type GovernanceNodeKind =
  | 'project'
  | 'asset'
  | 'resource'
  | 'workflow'
  | 'unknown'
  | (string & {});

export type GovernanceRelationKind =
  | 'dependency'
  | 'lineage'
  | 'ownership'
  | 'traceability'
  | 'deployment'
  | 'execution'
  | 'conformance'
  | 'drift'
  | 'unknown'
  | (string & {});

export type GovernanceAuthority =
  | 'intended'
  | 'documented'
  | 'discovered'
  | 'inferred'
  | 'authoritative'
  | (string & {});

export type GovernanceConfidence = number;

export interface GovernancePerspective {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface GovernanceSource {
  id: string;
  name: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

export interface GovernanceEvidence {
  id: string;
  type: string;
  source?: string | GovernanceSource;
  reference?: string;
  description?: string;
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}

/**
 * Adapter-facing governance classification before canonical normalization.
 * Keep platform-specific classification systems in metadata until they become
 * stable Core semantics.
 */
export interface GovernanceClassificationInput {
  domain?: string;
  boundedContext?: string;
  capability?: string;
  layer?: string;
  scope?: string;
  system?: string;
  product?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Adapter-facing representation of a governed item before canonical
 * normalization. It is intentionally technology-neutral.
 */
export interface GovernanceNodeInput {
  id: string;
  name?: string;
  kind?: GovernanceNodeKind;
  technology?: string;
  sourceSystem?: string;
  root?: string;
  path?: string;
  tags?: string[];
  classification?: GovernanceClassificationInput;
  ownership?: GovernanceOwnershipInput;
  perspective?: GovernancePerspective;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  extensions?: GovernanceExtensionModelExpansionMap;
  // Adapter-specific or extension-owned expansion data can be attached here.
  // Core keeps metadata opaque unless a generic canonical contract says
  // otherwise. One generic Core contract currently reads
  // metadata.governance.kind to distinguish governed assets from
  // evidence/context subjects for rule applicability.
  metadata?: Record<string, unknown>;
}

/**
 * Adapter-facing representation of a relationship between governed nodes
 * before canonical normalization.
 */
export interface GovernanceRelationInput {
  id?: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind?: GovernanceRelationKind;
  perspective?: GovernancePerspective;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  extensions?: GovernanceExtensionModelExpansionMap;
  // Relation metadata may carry source-specific facts, but Core only interprets
  // it through explicit generic contracts.
  metadata?: Record<string, unknown>;
}

export interface GovernanceOwnershipInput {
  team?: string;
  contacts?: string[];
  stewards?: string[];
  productOwner?: string;
  technicalOwner?: string;
  businessOwner?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface GovernanceCapability<TData = unknown> {
  id: string;
  version?: string;
  source?: string;
  producer?: string;
  data?: TData;
  metadata?: Record<string, unknown>;
}

export type GovernanceDiagnosticSeverity =
  | 'info'
  | 'warning'
  | 'error'
  | (string & {});

export type GovernanceDiagnosticKind =
  | 'observation'
  | 'warning'
  | 'violation'
  | 'error'
  | 'recommendation'
  | (string & {});

export type GovernanceDiagnosticCategory =
  | 'adapter'
  | 'configuration'
  | 'capability'
  | 'evidence'
  | 'conformance'
  | 'drift'
  | 'reporting'
  | (string & {});

export interface GovernanceDiagnostic {
  id?: string;
  code: string;
  message: string;
  severity?: GovernanceDiagnosticSeverity;
  kind?: GovernanceDiagnosticKind;
  category?: GovernanceDiagnosticCategory;
  source?: string;
  reference?: GovernanceRuntimeReference;
  perspective?: GovernancePerspective;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  recommendation?: string;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function buildGovernanceWorkspace(
  adapterResult: GovernanceWorkspaceAdapterResult,
): GovernanceWorkspace {
  const graph = buildGovernanceNormalizedGraph(adapterResult);
  const root =
    adapterResult.workspaceRoot ?? adapterResult.workspace?.root ?? '';
  const capabilities =
    adapterResult.capabilities ?? adapterResult.workspace?.capabilities;
  const diagnostics =
    adapterResult.diagnostics ?? adapterResult.workspace?.diagnostics;
  const extensions =
    adapterResult.extensions ?? adapterResult.workspace?.extensions;
  const metadata = adapterResult.metadata ?? adapterResult.workspace?.metadata;

  return {
    id: adapterResult.workspaceId ?? adapterResult.workspace?.id ?? 'workspace',
    name:
      adapterResult.workspaceName ??
      adapterResult.workspace?.name ??
      'workspace',
    root,
    nodes: graph.nodes,
    relations: graph.relations,
    ...(capabilities !== undefined ? { capabilities } : {}),
    ...(diagnostics !== undefined ? { diagnostics } : {}),
    ...(extensions !== undefined ? { extensions } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

export const buildGovernanceInventory = buildGovernanceWorkspace;

export const normalizeGovernanceWorkspace = buildGovernanceWorkspace;

export const buildGovernanceWorkspaceFromAdapterResult =
  buildGovernanceWorkspace;
