import type {
  GovernanceRuntimeReference,
  GovernanceWorkspace,
} from '../model/models.js';
import { buildGovernanceNormalizedGraph } from '../graph/internal-normalization.js';
import type { ProfileOverrides } from '../evaluation/profile.js';

export interface GovernanceWorkspaceAdapterResult {
  workspace?: GovernanceWorkspace;
  workspaceId?: string;
  workspaceName?: string;
  workspaceRoot?: string;
  /**
   * Compatibility output for project-oriented consumers.
   *
   * @deprecated New adapters should emit `nodes` as the primary canonical
   * inventory model and keep `projects` only when compatibility consumers need
   * project/dependency views.
   */
  projects?: GovernanceProjectInput[];
  /**
   * Compatibility output for project dependency-oriented consumers.
   *
   * @deprecated New adapters should emit `relations` as the primary canonical
   * relation model and keep `dependencies` only when compatibility consumers
   * need project/dependency views.
   */
  dependencies?: GovernanceDependencyInput[];
  nodes?: GovernanceNodeInput[];
  relations?: GovernanceRelationInput[];
  capabilities?: GovernanceCapability[];
  diagnostics?: GovernanceDiagnostic[];
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
 * normalization. It is intentionally technology-neutral and additive to the
 * existing project compatibility input.
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
  metadata?: Record<string, unknown>;
}

/**
 * Adapter-facing representation of a relationship between governed nodes
 * before canonical normalization. Legacy project dependencies remain supported
 * through GovernanceDependencyInput.
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
  metadata?: Record<string, unknown>;
}

/**
 * Adapter-facing compatibility representation of a code/project inventory
 * item.
 *
 * @deprecated Prefer `GovernanceNodeInput` for new adapter output. Keep this
 * contract populated only for compatibility with project/dependency consumers.
 */
export interface GovernanceProjectInput {
  id: string;
  name?: string;
  root?: string;
  type?: string;
  domain?: string;
  layer?: string;
  scope?: string;
  tags?: string[];
  ownership?: GovernanceOwnershipInput;
  metadata?: Record<string, unknown>;
}

/**
 * Adapter-facing compatibility representation of a project-to-project
 * dependency.
 *
 * @deprecated Prefer `GovernanceRelationInput` for new adapter output. Keep
 * this contract populated only for compatibility with project/dependency
 * consumers.
 */
export interface GovernanceDependencyInput {
  sourceProjectId: string;
  targetProjectId: string;
  type?: string;
  sourceFile?: string;
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
  _overrides: ProfileOverrides = { projectOverrides: {} },
): GovernanceWorkspace {
  const graph = buildGovernanceNormalizedGraph(adapterResult);
  const root =
    adapterResult.workspaceRoot ?? adapterResult.workspace?.root ?? '';
  const capabilities =
    adapterResult.capabilities ?? adapterResult.workspace?.capabilities;
  const diagnostics =
    adapterResult.diagnostics ?? adapterResult.workspace?.diagnostics;
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
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

export const buildGovernanceInventory = buildGovernanceWorkspace;

export const normalizeGovernanceWorkspace = buildGovernanceWorkspace;

export const buildGovernanceWorkspaceFromAdapterResult =
  buildGovernanceWorkspace;
