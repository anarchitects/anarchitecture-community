import type {
  GovernanceDependency,
  GovernanceProject,
  Violation,
} from '../model/models.js';
import { toGovernanceCompatibilityWorkspace } from '../compatibility/internal-workspace.js';
import {
  deriveAllowedLayerDependenciesFromLayerOrder,
  normalizeGovernanceProfile,
  type MissingDomainOptions,
  type MissingLayerOptions,
  type ProjectNameConventionOptions,
  type TagConventionOptions,
  type GovernanceDomainBoundaryRuleOptions,
  type GovernanceLayerBoundaryRuleOptions,
  type GovernanceOwnershipPresenceRuleOptions,
} from './profile.js';
import type {
  GovernanceRule,
  GovernanceRuleContext,
  GovernanceRuleResult,
} from './rules.js';

type SynchronousGovernanceRule<TOptions = unknown> =
  GovernanceRule<TOptions> & {
    evaluate(context: GovernanceRuleContext<TOptions>): GovernanceRuleResult;
  };

export const domainBoundaryRule: SynchronousGovernanceRule = {
  id: 'domain-boundary',
  name: 'Domain Boundary',
  description:
    'Enforces allowed dependencies between projects in different domains.',
  category: 'boundary',
  defaultSeverity: 'error',
  evaluate({ workspace, profile }) {
    const compatibilityWorkspace =
      toGovernanceCompatibilityWorkspace(workspace);

    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[domainBoundaryRule.id];
    if (ruleConfig?.enabled === false) {
      return {};
    }
    const options = ruleConfig?.options as
      | GovernanceDomainBoundaryRuleOptions
      | undefined;
    const severity = ruleConfig?.severity ?? domainBoundaryRule.defaultSeverity;
    const projectByName = projectByNameMap(compatibilityWorkspace.projects);
    const violations = compatibilityWorkspace.dependencies.flatMap(
      (dependency) => {
        const source = projectByName.get(dependency.source);
        const target = projectByName.get(dependency.target);

        return evaluateDomainBoundaryDependency(
          source,
          target,
          dependency,
          options ?? {
            allowedDependencies: profile.allowedDomainDependencies,
          },
          severity,
        );
      },
    );

    return { violations };
  },
};

export const layerBoundaryRule: SynchronousGovernanceRule = {
  id: 'layer-boundary',
  name: 'Layer Boundary',
  description:
    'Enforces allowed dependencies between declared architectural layers.',
  category: 'boundary',
  defaultSeverity: 'warning',
  evaluate({ workspace, profile }) {
    const compatibilityWorkspace =
      toGovernanceCompatibilityWorkspace(workspace);

    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[layerBoundaryRule.id];
    if (ruleConfig?.enabled === false) {
      return {};
    }
    const options = ruleConfig?.options as
      | GovernanceLayerBoundaryRuleOptions
      | undefined;
    const normalizedOptions = options ?? {
      allowedDependencies:
        profile.allowedLayerDependencies ??
        deriveAllowedLayerDependenciesFromLayerOrder(profile.layers),
      layers: [...profile.layers],
      usesExplicitDependencies: profile.allowedLayerDependencies !== undefined,
    };
    const severity = ruleConfig?.severity ?? layerBoundaryRule.defaultSeverity;
    const projectByName = projectByNameMap(compatibilityWorkspace.projects);
    const declaredLayers = new Set(normalizedOptions.layers);

    const violations = compatibilityWorkspace.dependencies.flatMap(
      (dependency) => {
        const source = projectByName.get(dependency.source);
        const target = projectByName.get(dependency.target);

        return evaluateLayerBoundaryDependency(
          source,
          target,
          dependency,
          declaredLayers,
          normalizedOptions,
          severity,
        );
      },
    );

    return { violations };
  },
};

export const ownershipPresenceRule: SynchronousGovernanceRule = {
  id: 'ownership-presence',
  name: 'Ownership Presence',
  description:
    'Requires ownership metadata or CODEOWNERS coverage when profiles demand it.',
  category: 'ownership',
  defaultSeverity: 'warning',
  evaluate({ workspace, profile }) {
    const compatibilityWorkspace =
      toGovernanceCompatibilityWorkspace(workspace);

    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[ownershipPresenceRule.id];
    if (ruleConfig?.enabled === false) {
      return {};
    }
    const options = ruleConfig?.options as
      | GovernanceOwnershipPresenceRuleOptions
      | undefined;
    const normalizedOptions = options ?? {
      required: profile.ownership.required,
      metadataField: profile.ownership.metadataField,
    };
    const severity =
      ruleConfig?.severity ?? ownershipPresenceRule.defaultSeverity;

    if (!normalizedOptions.required) {
      return {};
    }

    const violations = compatibilityWorkspace.projects.flatMap((project) =>
      evaluateOwnershipPresence(project, severity),
    );

    return { violations };
  },
};

export const projectNameConventionRule: SynchronousGovernanceRule = {
  id: 'project-name-convention',
  name: 'Project Name Convention',
  description:
    'Validates project names against an explicitly configured regular expression.',
  category: 'convention',
  defaultSeverity: 'warning',
  evaluate({ workspace, profile }) {
    const compatibilityWorkspace =
      toGovernanceCompatibilityWorkspace(workspace);

    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[projectNameConventionRule.id];
    const options = ruleConfig?.options as
      | ProjectNameConventionOptions
      | undefined;

    if (!ruleConfig?.enabled || !options?.pattern) {
      return {};
    }

    const pattern = new RegExp(options.pattern);
    const severity =
      ruleConfig.severity ?? projectNameConventionRule.defaultSeverity;

    return {
      violations: compatibilityWorkspace.projects.flatMap((project) =>
        evaluateProjectNameConvention(project, options, pattern, severity),
      ),
    };
  },
};

export const tagConventionRule: SynchronousGovernanceRule = {
  id: 'tag-convention',
  name: 'Tag Convention',
  description:
    'Validates required and allowed generic tag prefixes and tag value patterns.',
  category: 'metadata',
  defaultSeverity: 'warning',
  evaluate({ workspace, profile }) {
    const compatibilityWorkspace =
      toGovernanceCompatibilityWorkspace(workspace);

    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[tagConventionRule.id];
    const options = ruleConfig?.options as TagConventionOptions | undefined;

    if (
      !ruleConfig?.enabled ||
      !options ||
      !hasTagConventionConfiguration(options)
    ) {
      return {};
    }

    const severity = ruleConfig.severity ?? tagConventionRule.defaultSeverity;
    const valuePattern = options.valuePattern
      ? new RegExp(options.valuePattern)
      : undefined;

    return {
      violations: compatibilityWorkspace.projects.flatMap((project) =>
        evaluateTagConvention(project, options, valuePattern, severity),
      ),
    };
  },
};

export const missingDomainRule: SynchronousGovernanceRule = {
  id: 'missing-domain',
  name: 'Missing Domain',
  description: 'Requires a domain on projects when explicitly configured.',
  category: 'metadata',
  defaultSeverity: 'warning',
  evaluate({ workspace, profile }) {
    const compatibilityWorkspace =
      toGovernanceCompatibilityWorkspace(workspace);

    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[missingDomainRule.id];
    const options = ruleConfig?.options as MissingDomainOptions | undefined;

    if (!ruleConfig?.enabled || !options?.required) {
      return {};
    }

    const severity = ruleConfig.severity ?? missingDomainRule.defaultSeverity;

    return {
      violations: compatibilityWorkspace.projects.flatMap((project) =>
        evaluateMissingDomain(project, severity),
      ),
    };
  },
};

export const missingLayerRule: SynchronousGovernanceRule = {
  id: 'missing-layer',
  name: 'Missing Layer',
  description: 'Requires a layer on projects when explicitly configured.',
  category: 'metadata',
  defaultSeverity: 'warning',
  evaluate({ workspace, profile }) {
    const compatibilityWorkspace =
      toGovernanceCompatibilityWorkspace(workspace);

    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[missingLayerRule.id];
    const options = ruleConfig?.options as MissingLayerOptions | undefined;

    if (!ruleConfig?.enabled || !options?.required) {
      return {};
    }

    const severity = ruleConfig.severity ?? missingLayerRule.defaultSeverity;

    return {
      violations: compatibilityWorkspace.projects.flatMap((project) =>
        evaluateMissingLayer(project, severity),
      ),
    };
  },
};

export const coreBuiltInPolicyRules: GovernanceRule[] = [
  domainBoundaryRule,
  layerBoundaryRule,
  ownershipPresenceRule,
  projectNameConventionRule,
  tagConventionRule,
  missingDomainRule,
  missingLayerRule,
];

export function evaluateCoreBuiltInPolicyViolations(
  context: GovernanceRuleContext,
): Violation[] {
  if (!context.profile) {
    return [];
  }

  const { profile } = context;
  const workspace = toGovernanceCompatibilityWorkspace(context.workspace);
  const normalizedProfile = normalizeGovernanceProfile(profile);
  const domainRuleConfig = normalizedProfile.rules[domainBoundaryRule.id];
  const domainEnabled = domainRuleConfig?.enabled !== false;
  const domainOptions = (domainRuleConfig?.options as
    | GovernanceDomainBoundaryRuleOptions
    | undefined) ?? {
    allowedDependencies: profile.allowedDomainDependencies,
  };
  const domainSeverity =
    domainRuleConfig?.severity ?? domainBoundaryRule.defaultSeverity;
  const layerRuleConfig = normalizedProfile.rules[layerBoundaryRule.id];
  const layerEnabled = layerRuleConfig?.enabled !== false;
  const layerOptions = (layerRuleConfig?.options as
    | GovernanceLayerBoundaryRuleOptions
    | undefined) ?? {
    allowedDependencies:
      profile.allowedLayerDependencies ??
      deriveAllowedLayerDependenciesFromLayerOrder(profile.layers),
    layers: [...profile.layers],
    usesExplicitDependencies: profile.allowedLayerDependencies !== undefined,
  };
  const layerSeverity =
    layerRuleConfig?.severity ?? layerBoundaryRule.defaultSeverity;
  const ownershipRuleConfig = normalizedProfile.rules[ownershipPresenceRule.id];
  const ownershipEnabled = ownershipRuleConfig?.enabled !== false;
  const ownershipOptions = (ownershipRuleConfig?.options as
    | GovernanceOwnershipPresenceRuleOptions
    | undefined) ?? {
    required: profile.ownership.required,
    metadataField: profile.ownership.metadataField,
  };
  const ownershipSeverity =
    ownershipRuleConfig?.severity ?? ownershipPresenceRule.defaultSeverity;
  const projectByName = projectByNameMap(workspace.projects);
  const declaredLayers = new Set(layerOptions.layers);
  const violations: Violation[] = [];

  for (const dependency of workspace.dependencies) {
    const source = projectByName.get(dependency.source);
    const target = projectByName.get(dependency.target);

    if (domainEnabled) {
      violations.push(
        ...evaluateDomainBoundaryDependency(
          source,
          target,
          dependency,
          domainOptions,
          domainSeverity,
        ),
      );
    }
    if (layerEnabled) {
      violations.push(
        ...evaluateLayerBoundaryDependency(
          source,
          target,
          dependency,
          declaredLayers,
          layerOptions,
          layerSeverity,
        ),
      );
    }
  }

  if (ownershipEnabled && ownershipOptions.required) {
    for (const project of workspace.projects) {
      violations.push(...evaluateOwnershipPresence(project, ownershipSeverity));
    }
  }

  for (const rule of [
    projectNameConventionRule,
    tagConventionRule,
    missingDomainRule,
    missingLayerRule,
  ]) {
    violations.push(...evaluateSynchronousRuleViolations(rule, context));
  }

  return violations;
}

export function evaluateGovernancePolicies(
  workspace: GovernanceRuleContext['workspace'],
  profile: GovernanceRuleContext['profile'],
): Violation[];
export function evaluateGovernancePolicies(
  context: GovernanceRuleContext,
): Violation[];
export function evaluateGovernancePolicies(
  workspaceOrContext:
    | GovernanceRuleContext['workspace']
    | GovernanceRuleContext,
  profile?: GovernanceRuleContext['profile'],
): Violation[] {
  if (isGovernanceRuleContext(workspaceOrContext)) {
    return evaluateCoreBuiltInPolicyViolations(workspaceOrContext);
  }

  return evaluateCoreBuiltInPolicyViolations({
    workspace: workspaceOrContext,
    profile,
  });
}

export const evaluateBuiltInGovernancePolicies = evaluateGovernancePolicies;

function isGovernanceRuleContext(
  value: GovernanceRuleContext['workspace'] | GovernanceRuleContext,
): value is GovernanceRuleContext {
  return 'workspace' in value;
}

function evaluateDomainBoundaryDependency(
  source: GovernanceProject | undefined,
  target: GovernanceProject | undefined,
  dependency: GovernanceDependency,
  options: GovernanceDomainBoundaryRuleOptions,
  severity: Violation['severity'],
): Violation[] {
  if (!source || !target) {
    return [];
  }

  if (
    !source.domain ||
    !target.domain ||
    source.domain === target.domain ||
    isDomainDependencyAllowed(
      options.allowedDependencies,
      source.domain,
      target.domain,
    )
  ) {
    return [];
  }

  return [
    {
      id: `${source.name}-${target.name}-domain`,
      ruleId: 'domain-boundary',
      project: source.name,
      severity,
      category: 'boundary',
      message: `Project ${source.name} in domain ${source.domain} depends on ${target.name} in domain ${target.domain}.`,
      details: {
        targetProject: target.name,
        sourceDomain: source.domain,
        targetDomain: target.domain,
        dependencyType: dependency.type,
      },
      recommendation:
        'Move the dependency behind an API or adjust domain boundaries in the governance profile.',
    },
  ];
}

function evaluateLayerBoundaryDependency(
  source: GovernanceProject | undefined,
  target: GovernanceProject | undefined,
  _dependency: GovernanceDependency,
  declaredLayers: Set<string>,
  options: GovernanceLayerBoundaryRuleOptions,
  severity: Violation['severity'],
): Violation[] {
  if (!source || !target) {
    return [];
  }

  if (
    !source.layer ||
    !target.layer ||
    !declaredLayers.has(source.layer) ||
    !declaredLayers.has(target.layer) ||
    isLayerDependencyAllowed(
      options.allowedDependencies,
      source.layer,
      target.layer,
    )
  ) {
    return [];
  }

  return [
    {
      id: `${source.name}-${target.name}-layer`,
      ruleId: 'layer-boundary',
      project: source.name,
      severity,
      category: 'boundary',
      message: `Layer violation: ${source.name} (${source.layer}) depends on ${target.name} (${target.layer}).`,
      details: {
        targetProject: target.name,
        sourceLayer: source.layer,
        targetLayer: target.layer,
        ...(options.usesExplicitDependencies
          ? {
              allowedTargets: options.allowedDependencies[source.layer] ?? [],
            }
          : {
              order: options.layers,
            }),
      },
      recommendation: options.usesExplicitDependencies
        ? 'Refactor the dependency or update allowedLayerDependencies in the governance profile when the dependency is intentional.'
        : 'Refactor dependency direction so higher-level layers depend on same or lower-level layers only.',
    },
  ];
}

function evaluateOwnershipPresence(
  project: GovernanceProject,
  severity: Violation['severity'],
): Violation[] {
  if (
    project.ownership?.team ||
    (project.ownership?.contacts?.length ?? 0) > 0
  ) {
    return [];
  }

  return [
    {
      id: `${project.name}-ownership`,
      ruleId: 'ownership-presence',
      project: project.name,
      severity,
      category: 'ownership',
      message: `Project ${project.name} has no ownership metadata or CODEOWNERS mapping.`,
      recommendation:
        'Add ownership metadata in project configuration or ensure CODEOWNERS covers the project root.',
    },
  ];
}

function evaluateProjectNameConvention(
  project: GovernanceProject,
  options: ProjectNameConventionOptions,
  pattern: RegExp,
  severity: Violation['severity'],
): Violation[] {
  if (pattern.test(project.name)) {
    return [];
  }

  return [
    {
      id: `${project.name}-project-name-convention`,
      ruleId: 'project-name-convention',
      project: project.name,
      severity,
      category: 'convention',
      message:
        options.message ??
        `Project ${project.name} does not match the configured naming convention.`,
      details: {
        projectName: project.name,
        pattern: options.pattern,
      },
      recommendation:
        'Rename the project or update the configured name pattern when the convention is intentional.',
    },
  ];
}

function evaluateTagConvention(
  project: GovernanceProject,
  options: TagConventionOptions,
  valuePattern: RegExp | undefined,
  severity: Violation['severity'],
): Violation[] {
  const violations: Violation[] = [];
  const prefixSeparator = options.prefixSeparator ?? ':';

  for (const requiredPrefix of options.requiredPrefixes ?? []) {
    if (
      !project.tags.some((tag) =>
        tag.startsWith(`${requiredPrefix}${prefixSeparator}`),
      )
    ) {
      violations.push({
        id: `${project.name}-tag-convention-required-${requiredPrefix}`,
        ruleId: 'tag-convention',
        project: project.name,
        severity,
        category: 'metadata',
        message: `Project ${project.name} is missing a tag with required prefix ${requiredPrefix}.`,
        details: {
          requiredPrefix,
          tags: project.tags,
        },
        recommendation:
          'Add a tag with the required prefix or relax the configured requiredPrefixes list.',
      });
    }
  }

  for (const tag of project.tags) {
    const { prefix, value } = splitGovernanceTag(tag, prefixSeparator);

    if (
      options.allowedPrefixes &&
      options.allowedPrefixes.length > 0 &&
      !options.allowedPrefixes.includes(prefix)
    ) {
      violations.push({
        id: `${project.name}-tag-convention-allowed-${tag}`,
        ruleId: 'tag-convention',
        project: project.name,
        severity,
        category: 'metadata',
        message: `Project ${project.name} uses tag ${tag} with disallowed prefix ${prefix}.`,
        details: {
          tag,
          prefix,
          allowedPrefixes: options.allowedPrefixes,
        },
        recommendation:
          'Rename the tag to use an allowed prefix or expand the allowedPrefixes rule configuration.',
      });
    }

    if (valuePattern && !valuePattern.test(value)) {
      violations.push({
        id: `${project.name}-tag-convention-value-${tag}`,
        ruleId: 'tag-convention',
        project: project.name,
        severity,
        category: 'metadata',
        message: `Project ${project.name} has tag ${tag} with a value that does not match the configured pattern.`,
        details: {
          tag,
          value,
          valuePattern: options.valuePattern,
        },
        recommendation:
          'Normalize the tag value or update the configured valuePattern when the convention is intentional.',
      });
    }
  }

  return violations;
}

function evaluateMissingDomain(
  project: GovernanceProject,
  severity: Violation['severity'],
): Violation[] {
  if (project.domain) {
    return [];
  }

  return [
    {
      id: `${project.name}-missing-domain`,
      ruleId: 'missing-domain',
      project: project.name,
      severity,
      category: 'metadata',
      message: `Project ${project.name} is missing domain metadata.`,
      recommendation:
        'Populate the project domain through adapter normalization, metadata, or project overrides.',
    },
  ];
}

function evaluateMissingLayer(
  project: GovernanceProject,
  severity: Violation['severity'],
): Violation[] {
  if (project.layer) {
    return [];
  }

  return [
    {
      id: `${project.name}-missing-layer`,
      ruleId: 'missing-layer',
      project: project.name,
      severity,
      category: 'metadata',
      message: `Project ${project.name} is missing layer metadata.`,
      recommendation:
        'Populate the project layer through adapter normalization, metadata, or project overrides.',
    },
  ];
}

function evaluateSynchronousRuleViolations(
  rule: GovernanceRule,
  context: GovernanceRuleContext,
): Violation[] {
  const result = rule.evaluate(context) as GovernanceRuleResult;

  return result.violations ?? [];
}

function projectByNameMap(
  projects: GovernanceProject[],
): Map<string, GovernanceProject> {
  return new Map(projects.map((project) => [project.name, project]));
}

function isDomainDependencyAllowed(
  allowedDependencies: Record<string, string[]>,
  sourceDomain: string,
  targetDomain: string,
): boolean {
  const direct = allowedDependencies[sourceDomain];
  if (direct && (direct.includes(targetDomain) || direct.includes('*'))) {
    return true;
  }

  const wildcard = allowedDependencies['*'];
  if (wildcard && (wildcard.includes(targetDomain) || wildcard.includes('*'))) {
    return true;
  }

  return false;
}

function isLayerDependencyAllowed(
  allowedLayerDependencies: Record<string, string[]>,
  sourceLayer: string,
  targetLayer: string,
): boolean {
  return (allowedLayerDependencies[sourceLayer] ?? []).includes(targetLayer);
}

function hasTagConventionConfiguration(options: TagConventionOptions): boolean {
  return (
    (options.requiredPrefixes?.length ?? 0) > 0 ||
    (options.allowedPrefixes?.length ?? 0) > 0 ||
    typeof options.valuePattern === 'string'
  );
}

function splitGovernanceTag(
  tag: string,
  prefixSeparator: string,
): { prefix: string; value: string } {
  const separatorIndex = tag.indexOf(prefixSeparator);

  if (separatorIndex === -1) {
    return {
      prefix: tag,
      value: tag,
    };
  }

  return {
    prefix: tag.slice(0, separatorIndex),
    value: tag.slice(separatorIndex + prefixSeparator.length),
  };
}
