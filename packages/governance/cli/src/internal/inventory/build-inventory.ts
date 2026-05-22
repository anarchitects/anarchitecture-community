import {
  GovernanceDependencyInput,
  GovernanceProjectInput,
  GovernanceWorkspaceAdapterResult,
  GovernanceDependency,
  GovernanceProject,
  GovernanceWorkspace,
  Ownership,
  ProfileOverrides,
} from '@anarchitects/governance-core';

export function buildInventory(
  adapterResult: GovernanceWorkspaceAdapterResult,
  overrides: ProfileOverrides = { projectOverrides: {} },
): GovernanceWorkspace {
  const projectsInput = resolveProjects(adapterResult);
  const dependenciesInput = resolveDependencies(adapterResult);

  const projects: GovernanceProject[] = projectsInput.map((project) => {
    const projectId = normalizeProjectId(project);
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

    const ownership: Ownership = resolveOwnership(
      ownershipFromMeta,
      override.ownershipTeam,
      project.ownership,
    );

    return {
      id: projectId,
      name: projectName,
      root: project.root ?? '',
      type: normalizeProjectType(project.type),
      tags: projectTags,
      domain,
      layer,
      ownership,
      metadata: {
        ...projectMetadata,
        ...(override.documentation !== undefined
          ? { documentation: override.documentation }
          : {}),
      },
    };
  });

  const dependencies: GovernanceDependency[] = dependenciesInput.map((dep) => ({
    source: dep.sourceProjectId,
    target: dep.targetProjectId,
    type: normalizeDependencyType(dep.type),
    sourceFile: dep.sourceFile,
  }));

  return {
    id: adapterResult.workspaceId ?? adapterResult.workspace?.id ?? 'workspace',
    name:
      adapterResult.workspaceName ??
      adapterResult.workspace?.name ??
      'workspace',
    root: adapterResult.workspaceRoot ?? adapterResult.workspace?.root ?? '',
    projects,
    dependencies,
  };
}

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

function normalizeProjectId(project: GovernanceProjectInput): string {
  return project.id;
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
