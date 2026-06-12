import type {
  GovernanceNode,
  GovernanceRelation,
  GovernanceWorkspace,
  Violation,
} from '../model/models.js';
import {
  type DocumentationPresenceOptions,
  deriveAllowedLayerDependenciesFromLayerOrder,
  normalizeGovernanceProfile,
  type MissingDomainOptions,
  type MissingLayerOptions,
  type NodeNameConventionOptions,
  type TagConventionOptions,
  type GovernanceDomainBoundaryRuleOptions,
  type GovernanceLayerBoundaryRuleOptions,
  type GovernanceOwnershipPresenceRuleOptions,
} from './profile.js';
import { isAllowedDomainDependency } from './domain-dependency-policy.js';
import {
  getDocumentationPresence,
  resolveDocumentationPresenceOptions,
} from './documentation.js';
import type {
  GovernanceRule,
  GovernanceRuleApplicability,
  GovernanceRuleContext,
  GovernanceRuleResult,
} from './rules.js';

type SynchronousGovernanceRule<TOptions = unknown> =
  GovernanceRule<TOptions> & {
    evaluate(context: GovernanceRuleContext<TOptions>): GovernanceRuleResult;
  };

const DEPENDENCY_RELATION_APPLICABILITY = {
  relationKinds: ['dependency'],
} satisfies GovernanceRuleApplicability;

export const domainBoundaryRule: SynchronousGovernanceRule = {
  id: 'domain-boundary',
  name: 'Domain Boundary',
  description:
    'Enforces allowed dependencies between nodes in different domains.',
  category: 'boundary',
  defaultSeverity: 'error',
  applicability: DEPENDENCY_RELATION_APPLICABILITY,
  evaluate({ workspace, profile }) {
    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[domainBoundaryRule.id];
    if (ruleConfig?.enabled === false) {
      return {};
    }

    const options = (ruleConfig?.options as
      | GovernanceDomainBoundaryRuleOptions
      | undefined) ?? {
      allowedDependencies: profile.allowedDomainDependencies,
    };
    const severity = ruleConfig?.severity ?? domainBoundaryRule.defaultSeverity;

    return {
      violations: evaluateDomainBoundaryViolations(
        workspace,
        options,
        severity,
      ),
    };
  },
};

export const layerBoundaryRule: SynchronousGovernanceRule = {
  id: 'layer-boundary',
  name: 'Layer Boundary',
  description:
    'Enforces allowed dependencies between declared architectural layers.',
  category: 'boundary',
  defaultSeverity: 'warning',
  applicability: DEPENDENCY_RELATION_APPLICABILITY,
  evaluate({ workspace, profile }) {
    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[layerBoundaryRule.id];
    if (ruleConfig?.enabled === false) {
      return {};
    }

    const options = (ruleConfig?.options as
      | GovernanceLayerBoundaryRuleOptions
      | undefined) ?? {
      allowedDependencies:
        profile.allowedLayerDependencies ??
        deriveAllowedLayerDependenciesFromLayerOrder(profile.layers),
      layers: [...profile.layers],
      usesExplicitDependencies: profile.allowedLayerDependencies !== undefined,
    };
    const severity = ruleConfig?.severity ?? layerBoundaryRule.defaultSeverity;

    return {
      violations: evaluateLayerBoundaryViolations(workspace, options, severity),
    };
  },
};

export const ownershipPresenceRule: SynchronousGovernanceRule = {
  id: 'ownership-presence',
  name: 'Ownership Presence',
  description: 'Requires canonical ownership data when profiles demand it.',
  category: 'ownership',
  defaultSeverity: 'warning',
  evaluate({ workspace, profile }) {
    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[ownershipPresenceRule.id];
    if (ruleConfig?.enabled === false) {
      return {};
    }

    const options = (ruleConfig?.options as
      | GovernanceOwnershipPresenceRuleOptions
      | undefined) ?? {
      required: profile.ownership.required,
    };
    const severity =
      ruleConfig?.severity ?? ownershipPresenceRule.defaultSeverity;

    if (!options.required) {
      return {};
    }

    return {
      violations: getApplicableNodes(workspace, ownershipPresenceRule).flatMap(
        (node) => evaluateOwnershipPresence(node, severity),
      ),
    };
  },
};

export const projectNameConventionRule: SynchronousGovernanceRule = {
  // Keep the legacy rule id stable while
  // evaluating canonical nodes directly.
  id: 'project-name-convention',
  name: 'Node Name Convention',
  description:
    'Validates node names against an explicitly configured regular expression.',
  category: 'convention',
  defaultSeverity: 'warning',
  evaluate({ workspace, profile }) {
    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[projectNameConventionRule.id];
    const options = ruleConfig?.options as
      | NodeNameConventionOptions
      | undefined;

    if (!ruleConfig?.enabled || !options?.pattern) {
      return {};
    }

    const pattern = new RegExp(options.pattern);
    const severity =
      ruleConfig.severity ?? projectNameConventionRule.defaultSeverity;

    return {
      violations: getApplicableNodes(
        workspace,
        projectNameConventionRule,
      ).flatMap((node) =>
        evaluateNodeNameConvention(node, options, pattern, severity),
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
      violations: getApplicableNodes(workspace, tagConventionRule).flatMap(
        (node) => evaluateTagConvention(node, options, valuePattern, severity),
      ),
    };
  },
};

export const missingDomainRule: SynchronousGovernanceRule = {
  id: 'missing-domain',
  name: 'Missing Domain',
  description: 'Requires a domain on nodes when explicitly configured.',
  category: 'metadata',
  defaultSeverity: 'warning',
  evaluate({ workspace, profile }) {
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
      violations: getApplicableNodes(workspace, missingDomainRule).flatMap(
        (node) => evaluateMissingDomain(node, severity),
      ),
    };
  },
};

export const missingLayerRule: SynchronousGovernanceRule = {
  id: 'missing-layer',
  name: 'Missing Layer',
  description: 'Requires a layer on nodes when explicitly configured.',
  category: 'metadata',
  defaultSeverity: 'warning',
  evaluate({ workspace, profile }) {
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
      violations: getApplicableNodes(workspace, missingLayerRule).flatMap(
        (node) => evaluateMissingLayer(node, severity),
      ),
    };
  },
};

export const documentationGapRule: SynchronousGovernanceRule = {
  id: 'documentation-gap',
  name: 'Documentation Gap',
  description: 'Requires documentation metadata on canonical nodes.',
  category: 'documentation',
  defaultSeverity: 'warning',
  evaluate({ workspace, profile }) {
    if (!profile) {
      return {};
    }

    const normalizedProfile = normalizeGovernanceProfile(profile);
    const ruleConfig = normalizedProfile.rules[documentationGapRule.id];
    if (ruleConfig?.enabled === false) {
      return {};
    }

    const options =
      (ruleConfig?.options as DocumentationPresenceOptions | undefined) ??
      resolveDocumentationPresenceOptions(profile);
    const severity =
      ruleConfig?.severity ?? documentationGapRule.defaultSeverity;

    return {
      violations: getApplicableNodes(workspace, documentationGapRule).flatMap(
        (node) => evaluateDocumentationGap(node, options, severity),
      ),
    };
  },
};

export const coreBuiltInPolicyRules: GovernanceRule[] = [
  domainBoundaryRule,
  layerBoundaryRule,
  ownershipPresenceRule,
  documentationGapRule,
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

  const { profile, workspace } = context;
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
  };
  const ownershipSeverity =
    ownershipRuleConfig?.severity ?? ownershipPresenceRule.defaultSeverity;
  const violations: Violation[] = [];

  if (domainEnabled) {
    violations.push(
      ...evaluateDomainBoundaryViolations(
        workspace,
        domainOptions,
        domainSeverity,
      ),
    );
  }
  if (layerEnabled) {
    violations.push(
      ...evaluateLayerBoundaryViolations(
        workspace,
        layerOptions,
        layerSeverity,
      ),
    );
  }
  if (ownershipEnabled && ownershipOptions.required) {
    for (const node of getApplicableNodes(workspace, ownershipPresenceRule)) {
      violations.push(...evaluateOwnershipPresence(node, ownershipSeverity));
    }
  }

  for (const rule of [
    documentationGapRule,
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

function evaluateDomainBoundaryViolations(
  workspace: GovernanceWorkspace,
  options: GovernanceDomainBoundaryRuleOptions,
  severity: Violation['severity'],
): Violation[] {
  const nodeById = nodeByIdMap(workspace.nodes);

  return getApplicableRelations(workspace, domainBoundaryRule).flatMap(
    (relation) => {
      const source = nodeById.get(relation.sourceNodeId);
      const target = nodeById.get(relation.targetNodeId);

      return evaluateDomainBoundaryRelation(
        source,
        target,
        relation,
        options,
        severity,
      );
    },
  );
}

function evaluateLayerBoundaryViolations(
  workspace: GovernanceWorkspace,
  options: GovernanceLayerBoundaryRuleOptions,
  severity: Violation['severity'],
): Violation[] {
  const nodeById = nodeByIdMap(workspace.nodes);
  const declaredLayers = new Set(options.layers);

  return getApplicableRelations(workspace, layerBoundaryRule).flatMap(
    (relation) => {
      const source = nodeById.get(relation.sourceNodeId);
      const target = nodeById.get(relation.targetNodeId);

      return evaluateLayerBoundaryRelation(
        source,
        target,
        relation,
        declaredLayers,
        options,
        severity,
      );
    },
  );
}

function evaluateDomainBoundaryRelation(
  source: GovernanceNode | undefined,
  target: GovernanceNode | undefined,
  relation: GovernanceRelation,
  options: GovernanceDomainBoundaryRuleOptions,
  severity: Violation['severity'],
): Violation[] {
  if (!source || !target) {
    return [];
  }

  const sourceDomain = getNodeDomain(source);
  const targetDomain = getNodeDomain(target);
  if (
    !sourceDomain ||
    !targetDomain ||
    sourceDomain === targetDomain ||
    isAllowedDomainDependency(
      options.allowedDependencies,
      sourceDomain,
      targetDomain,
    )
  ) {
    return [];
  }

  return [
    {
      id: `${relation.id}:domain-boundary`,
      ruleId: domainBoundaryRule.id,
      subjectId: source.id,
      severity,
      category: 'boundary',
      message: `Node ${getNodeName(source)} in domain ${sourceDomain} depends on ${getNodeName(target)} in domain ${targetDomain}.`,
      reference: {
        relationId: relation.id,
        relatedNodeIds: [relation.sourceNodeId, relation.targetNodeId],
      },
      details: {
        sourceSubject: source.id,
        targetSubject: target.id,
        sourceDomain,
        targetDomain,
        dependencyType: getRelationDependencyType(relation),
      },
      recommendation:
        'Move the dependency behind an API or adjust domain boundaries in the governance profile.',
    },
  ];
}

function evaluateLayerBoundaryRelation(
  source: GovernanceNode | undefined,
  target: GovernanceNode | undefined,
  relation: GovernanceRelation,
  declaredLayers: Set<string>,
  options: GovernanceLayerBoundaryRuleOptions,
  severity: Violation['severity'],
): Violation[] {
  if (!source || !target) {
    return [];
  }

  const sourceLayer = getNodeLayer(source);
  const targetLayer = getNodeLayer(target);
  if (
    !sourceLayer ||
    !targetLayer ||
    !declaredLayers.has(sourceLayer) ||
    !declaredLayers.has(targetLayer) ||
    isLayerDependencyAllowed(
      options.allowedDependencies,
      sourceLayer,
      targetLayer,
    )
  ) {
    return [];
  }

  return [
    {
      id: `${relation.id}:layer-boundary`,
      ruleId: layerBoundaryRule.id,
      subjectId: source.id,
      severity,
      category: 'boundary',
      message: `Layer violation: ${getNodeName(source)} (${sourceLayer}) depends on ${getNodeName(target)} (${targetLayer}).`,
      reference: {
        relationId: relation.id,
        relatedNodeIds: [relation.sourceNodeId, relation.targetNodeId],
      },
      details: {
        sourceSubject: source.id,
        targetSubject: target.id,
        sourceLayer,
        targetLayer,
        dependencyType: getRelationDependencyType(relation),
        ...(options.usesExplicitDependencies
          ? {
              allowedTargets: options.allowedDependencies[sourceLayer] ?? [],
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
  node: GovernanceNode,
  severity: Violation['severity'],
): Violation[] {
  if (node.ownership?.team || (node.ownership?.contacts?.length ?? 0) > 0) {
    return [];
  }

  return [
    {
      id: `${node.id}:ownership-presence`,
      ruleId: ownershipPresenceRule.id,
      subjectId: node.id,
      severity,
      category: 'ownership',
      message: `Node ${getNodeName(node)} has no canonical ownership data.`,
      reference: {
        nodeId: node.id,
      },
      recommendation: 'Add canonical ownership data to the node.',
    },
  ];
}

function evaluateNodeNameConvention(
  node: GovernanceNode,
  options: NodeNameConventionOptions,
  pattern: RegExp,
  severity: Violation['severity'],
): Violation[] {
  const nodeName = getNodeName(node);
  if (pattern.test(nodeName)) {
    return [];
  }

  return [
    {
      id: `${node.id}:node-name-convention`,
      ruleId: projectNameConventionRule.id,
      subjectId: node.id,
      severity,
      category: 'convention',
      message:
        options.message ??
        `Node ${nodeName} does not match the configured naming convention.`,
      reference: {
        nodeId: node.id,
      },
      details: {
        nodeName,
        pattern: options.pattern,
      },
      recommendation:
        'Rename the node or update the configured name pattern when the convention is intentional.',
    },
  ];
}

function evaluateTagConvention(
  node: GovernanceNode,
  options: TagConventionOptions,
  valuePattern: RegExp | undefined,
  severity: Violation['severity'],
): Violation[] {
  const violations: Violation[] = [];
  const prefixSeparator = options.prefixSeparator ?? ':';
  const nodeTags = getNodeTags(node);
  const nodeName = getNodeName(node);

  for (const requiredPrefix of options.requiredPrefixes ?? []) {
    if (
      !nodeTags.some((tag) =>
        tag.startsWith(`${requiredPrefix}${prefixSeparator}`),
      )
    ) {
      violations.push({
        id: `${node.id}:tag-convention-required:${requiredPrefix}`,
        ruleId: tagConventionRule.id,
        subjectId: node.id,
        severity,
        category: 'metadata',
        message: `Node ${nodeName} is missing a tag with required prefix ${requiredPrefix}.`,
        reference: {
          nodeId: node.id,
        },
        details: {
          requiredPrefix,
          tags: nodeTags,
        },
        recommendation:
          'Add a tag with the required prefix or relax the configured requiredPrefixes list.',
      });
    }
  }

  for (const tag of nodeTags) {
    const { prefix, value } = splitGovernanceTag(tag, prefixSeparator);

    if (
      options.allowedPrefixes &&
      options.allowedPrefixes.length > 0 &&
      !options.allowedPrefixes.includes(prefix)
    ) {
      violations.push({
        id: `${node.id}:tag-convention-allowed:${tag}`,
        ruleId: tagConventionRule.id,
        subjectId: node.id,
        severity,
        category: 'metadata',
        message: `Node ${nodeName} uses tag ${tag} with disallowed prefix ${prefix}.`,
        reference: {
          nodeId: node.id,
        },
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
        id: `${node.id}:tag-convention-value:${tag}`,
        ruleId: tagConventionRule.id,
        subjectId: node.id,
        severity,
        category: 'metadata',
        message: `Node ${nodeName} has tag ${tag} with a value that does not match the configured pattern.`,
        reference: {
          nodeId: node.id,
        },
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
  node: GovernanceNode,
  severity: Violation['severity'],
): Violation[] {
  if (node.classification?.domain) {
    return [];
  }

  return [
    {
      id: `${node.id}:missing-domain`,
      ruleId: missingDomainRule.id,
      subjectId: node.id,
      severity,
      category: 'metadata',
      message: `Node ${getNodeName(node)} is missing domain metadata.`,
      reference: {
        nodeId: node.id,
      },
      recommendation:
        'Populate the node domain through adapter normalization, metadata, or canonical classification.',
    },
  ];
}

function evaluateMissingLayer(
  node: GovernanceNode,
  severity: Violation['severity'],
): Violation[] {
  if (node.classification?.layer) {
    return [];
  }

  return [
    {
      id: `${node.id}:missing-layer`,
      ruleId: missingLayerRule.id,
      subjectId: node.id,
      severity,
      category: 'metadata',
      message: `Node ${getNodeName(node)} is missing layer metadata.`,
      reference: {
        nodeId: node.id,
      },
      recommendation:
        'Populate the node layer through adapter normalization, metadata, or canonical classification.',
    },
  ];
}

function evaluateDocumentationGap(
  node: GovernanceNode,
  options: DocumentationPresenceOptions,
  severity: Violation['severity'],
): Violation[] {
  const documentationPresence = getDocumentationPresence(node, options);
  if (documentationPresence.documented) {
    return [];
  }

  return [
    {
      id: `${node.id}:documentation-gap`,
      ruleId: documentationGapRule.id,
      subjectId: node.id,
      severity,
      category: 'documentation',
      message: `Missing documentation metadata for node ${getNodeName(node)}.`,
      reference: {
        nodeId: node.id,
      },
      details: {
        metadataKeys: [...(options.metadataKeys ?? [])].sort((left, right) =>
          left.localeCompare(right),
        ),
        requireAny: options.requireAny ?? true,
        matchedMetadataKeys: documentationPresence.matchingMetadataKeys,
      },
      recommendation:
        'Populate the configured documentation metadata on the node.',
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

function getApplicableNodes(
  workspace: GovernanceWorkspace,
  rule: GovernanceRule,
): GovernanceNode[] {
  return [...workspace.nodes]
    .filter((node) =>
      matchesNodeApplicability(node, workspace, rule.applicability),
    )
    .sort(compareNodes);
}

function getApplicableRelations(
  workspace: GovernanceWorkspace,
  rule: GovernanceRule,
): GovernanceRelation[] {
  const nodeById = nodeByIdMap(workspace.nodes);

  return [...workspace.relations]
    .filter((relation) =>
      matchesRelationApplicability(
        relation,
        workspace,
        nodeById,
        rule.applicability,
      ),
    )
    .sort(compareRelations);
}

function matchesNodeApplicability(
  node: GovernanceNode,
  workspace: GovernanceWorkspace,
  applicability: GovernanceRuleApplicability | undefined,
): boolean {
  if (!applicability) {
    return true;
  }

  if (!matchesCapabilityApplicability(workspace, applicability)) {
    return false;
  }
  if (
    applicability.nodeKinds &&
    applicability.nodeKinds.length > 0 &&
    !applicability.nodeKinds.includes(node.kind)
  ) {
    return false;
  }
  if (
    applicability.technologies &&
    applicability.technologies.length > 0 &&
    !applicability.technologies.includes(node.technology ?? '')
  ) {
    return false;
  }
  if (
    applicability.perspectiveIds &&
    applicability.perspectiveIds.length > 0 &&
    !applicability.perspectiveIds.includes(node.perspective?.id ?? '')
  ) {
    return false;
  }
  if (
    applicability.classification &&
    !matchesPartialRecord(applicability.classification, node.classification)
  ) {
    return false;
  }
  if (
    applicability.ownership &&
    !matchesPartialRecord(applicability.ownership, node.ownership)
  ) {
    return false;
  }
  if (
    applicability.metadata &&
    !matchesPartialRecord(applicability.metadata, node.metadata)
  ) {
    return false;
  }

  return true;
}

function matchesRelationApplicability(
  relation: GovernanceRelation,
  workspace: GovernanceWorkspace,
  nodeById: Map<string, GovernanceNode>,
  applicability: GovernanceRuleApplicability | undefined,
): boolean {
  if (!applicability) {
    return true;
  }

  if (!matchesCapabilityApplicability(workspace, applicability)) {
    return false;
  }
  if (
    applicability.relationKinds &&
    applicability.relationKinds.length > 0 &&
    !applicability.relationKinds.includes(relation.kind)
  ) {
    return false;
  }
  if (
    applicability.perspectiveIds &&
    applicability.perspectiveIds.length > 0 &&
    !applicability.perspectiveIds.includes(relation.perspective?.id ?? '')
  ) {
    return false;
  }
  if (
    applicability.metadata &&
    !matchesPartialRecord(applicability.metadata, relation.metadata)
  ) {
    return false;
  }
  if (applicability.technologies && applicability.technologies.length > 0) {
    const sourceTechnology = nodeById.get(relation.sourceNodeId)?.technology;
    const targetTechnology = nodeById.get(relation.targetNodeId)?.technology;
    if (
      !applicability.technologies.includes(sourceTechnology ?? '') &&
      !applicability.technologies.includes(targetTechnology ?? '')
    ) {
      return false;
    }
  }

  return true;
}

function matchesCapabilityApplicability(
  workspace: GovernanceWorkspace,
  applicability: GovernanceRuleApplicability,
): boolean {
  if (
    !applicability.capabilityIds ||
    applicability.capabilityIds.length === 0
  ) {
    return true;
  }

  const capabilityIds = new Set(
    (workspace.capabilities ?? []).map((capability) => capability.id),
  );

  return applicability.capabilityIds.every((capabilityId) =>
    capabilityIds.has(capabilityId),
  );
}

function matchesPartialRecord(
  expected: object,
  actual: object | undefined,
): boolean {
  return Object.entries(expected).every(
    ([key, value]) => readObjectValue(actual, key) === value,
  );
}

function getNodeDomain(node: GovernanceNode): string | undefined {
  return node.classification?.domain ?? node.classification?.scope;
}

function getNodeLayer(node: GovernanceNode): string | undefined {
  return node.classification?.layer;
}

function getNodeName(node: GovernanceNode): string {
  return node.name ?? node.id;
}

function getNodeTags(node: GovernanceNode): string[] {
  return [
    ...new Set([...(node.tags ?? []), ...(node.classification?.tags ?? [])]),
  ].sort((left, right) => left.localeCompare(right));
}

function getRelationDependencyType(relation: GovernanceRelation): string {
  const metadataType = relation.metadata['dependencyType'];
  return typeof metadataType === 'string' && metadataType.length > 0
    ? metadataType
    : relation.kind;
}

function nodeByIdMap(nodes: GovernanceNode[]): Map<string, GovernanceNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function readObjectValue(record: object | undefined, key: string): unknown {
  return record ? (record as Record<string, unknown>)[key] : undefined;
}

function compareNodes(left: GovernanceNode, right: GovernanceNode): number {
  return left.id.localeCompare(right.id);
}

function compareRelations(
  left: GovernanceRelation,
  right: GovernanceRelation,
): number {
  return (
    left.id.localeCompare(right.id) ||
    left.sourceNodeId.localeCompare(right.sourceNodeId) ||
    left.targetNodeId.localeCompare(right.targetNodeId)
  );
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
