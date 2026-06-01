import type {
  GovernanceRuntimeReference,
  Ownership,
  GovernanceWorkspace,
} from './models.js';
import type { ProfileOverrides } from './profile.js';

export interface GovernanceWorkspaceAdapterResult {
  workspace?: GovernanceWorkspace;
  workspaceId?: string;
  workspaceName?: string;
  workspaceRoot?: string;
  projects?: GovernanceProjectInput[];
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
  overrides: ProfileOverrides = { projectOverrides: {} },
): GovernanceWorkspace {
  const projectsInput = resolveProjects(adapterResult);
  const dependenciesInput = resolveDependencies(adapterResult);

  return {
    id: adapterResult.workspaceId ?? adapterResult.workspace?.id ?? 'workspace',
    name:
      adapterResult.workspaceName ??
      adapterResult.workspace?.name ??
      'workspace',
    root: adapterResult.workspaceRoot ?? adapterResult.workspace?.root ?? '',
    projects: projectsInput.map((project) => {
      const projectName = normalizeProjectName(project);
      const projectTags = project.tags ?? [];
      const projectMetadata = project.metadata ?? {};
      const override = overrides.projectOverrides[projectName] ?? {};
      const domain =
        override.domain ??
        project.domain ??
        tagValue(projectTags, 'domain') ??
        tagValue(projectTags, 'scope');
      const layer =
        override.layer ?? project.layer ?? tagValue(projectTags, 'layer');

      const ownershipFromMeta = readOwnershipFromMetadata(projectMetadata);

      return {
        id: project.id,
        name: projectName,
        root: project.root ?? '',
        type: normalizeProjectType(project.type),
        tags: projectTags,
        domain,
        layer,
        ownership: resolveOwnership(
          ownershipFromMeta,
          override.ownershipTeam,
          project.ownership,
        ),
        metadata: {
          ...projectMetadata,
          ...(override.documentation !== undefined
            ? { documentation: override.documentation }
            : {}),
        },
      };
    }),
    dependencies: dependenciesInput.map((dependency) => ({
      source: dependency.sourceProjectId,
      target: dependency.targetProjectId,
      type: normalizeDependencyType(dependency.type),
      sourceFile: dependency.sourceFile,
    })),
  };
}

export const buildGovernanceInventory = buildGovernanceWorkspace;

export const normalizeGovernanceWorkspace = buildGovernanceWorkspace;

export const buildGovernanceWorkspaceFromAdapterResult =
  buildGovernanceWorkspace;

function resolveProjects(
  adapterResult: GovernanceWorkspaceAdapterResult,
): GovernanceProjectInput[] {
  if (adapterResult.projects) {
    return adapterResult.projects;
  }

  if (adapterResult.workspace) {
    return adapterResult.workspace.projects.map((project) => ({
      id: project.id,
      name: project.name,
      root: project.root,
      type: project.type,
      domain: project.domain,
      layer: project.layer,
      tags: project.tags,
      ownership: project.ownership,
      metadata: project.metadata,
    }));
  }

  return [];
}

function resolveDependencies(
  adapterResult: GovernanceWorkspaceAdapterResult,
): GovernanceDependencyInput[] {
  if (adapterResult.dependencies) {
    return adapterResult.dependencies;
  }

  if (adapterResult.workspace) {
    return adapterResult.workspace.dependencies.map((dependency) => ({
      sourceProjectId: dependency.source,
      targetProjectId: dependency.target,
      type: dependency.type,
      sourceFile: dependency.sourceFile,
    }));
  }

  return [];
}

function normalizeProjectName(project: GovernanceProjectInput): string {
  return project.name ?? project.id;
}

function tagValue(tags: string[], prefix: string): string | undefined {
  const found = tags.find((tag) => tag.startsWith(`${prefix}:`));
  return found?.split(':').slice(1).join(':');
}

function normalizeProjectType(
  type: string | undefined,
): 'application' | 'library' | 'tool' | 'unknown' {
  if (type === 'application' || type === 'app') return 'application';
  if (type === 'library' || type === 'lib') return 'library';
  if (type === 'tool') return 'tool';
  return 'unknown';
}

function normalizeDependencyType(
  type: string | undefined,
): 'static' | 'dynamic' | 'implicit' | 'unknown' {
  if (type === 'static' || type === 'dynamic' || type === 'implicit') {
    return type;
  }

  return 'unknown';
}

function readOwnershipFromMetadata(
  metadata: Record<string, unknown>,
): string | undefined {
  const direct = metadata.ownership;
  if (typeof direct === 'string' && direct) {
    return direct;
  }

  if (direct && typeof direct === 'object') {
    const team = (direct as Record<string, unknown>).team;
    if (typeof team === 'string' && team) {
      return team;
    }
  }

  return undefined;
}

function resolveOwnership(
  metadataTeam: string | undefined,
  overrideTeam: string | undefined,
  adapterOwnership:
    | {
        team?: string;
        contacts?: string[];
        source?: string;
      }
    | undefined,
): Ownership {
  const contacts = adapterOwnership?.contacts ?? [];
  const team = overrideTeam ?? metadataTeam ?? adapterOwnership?.team;

  if (team && contacts.length) {
    return {
      team,
      contacts,
      source: 'merged',
    };
  }

  if (team) {
    return {
      team,
      contacts: [],
      source: normalizeOwnershipSource(adapterOwnership?.source),
    };
  }

  if (contacts.length) {
    return {
      contacts,
      source: 'codeowners',
    };
  }

  return {
    source: 'none',
  };
}

function normalizeOwnershipSource(
  source: string | undefined,
): Ownership['source'] {
  if (source === 'merged' || source === 'project-metadata') {
    return source;
  }

  if (source === 'codeowners') {
    return 'codeowners';
  }

  return 'project-metadata';
}
