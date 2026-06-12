import { GovernanceException } from '../diagnostics/exceptions.js';
import {
  HealthStatusThresholds,
  Measurement,
  Violation,
} from '../model/models.js';

export const DEFAULT_HEALTH_STATUS_THRESHOLDS: HealthStatusThresholds = {
  goodMinScore: 85,
  warningMinScore: 70,
};

export type AllowedLayerDependencies = Record<string, string[]>;

export interface GovernanceNodeOverride {
  domain?: string;
  layer?: string;
  ownershipTeam?: string;
  documentation?: boolean;
}

export interface GovernanceProfile {
  name: string;
  description?: string;
  boundaryPolicySource: 'profile' | 'eslint';
  layers: string[];
  rules?: Record<string, GovernanceRuleConfig>;
  allowedLayerDependencies?: AllowedLayerDependencies;
  allowedDomainDependencies: Record<string, string[]>;
  ownership: {
    required: boolean;
  };
  health: {
    statusThresholds: HealthStatusThresholds;
  };
  metrics: Record<Measurement['id'], number>;
}

export interface GovernanceRuleConfig<TOptions = unknown> {
  enabled?: boolean;
  severity?: Violation['severity'];
  options?: TOptions;
}

export interface GovernanceDomainBoundaryRuleOptions {
  allowedDependencies: Record<string, string[]>;
}

export interface GovernanceLayerBoundaryRuleOptions {
  allowedDependencies: AllowedLayerDependencies;
  layers: string[];
  usesExplicitDependencies: boolean;
}

export interface GovernanceOwnershipPresenceRuleOptions {
  required: boolean;
}

export interface GovernanceScoringProfile {
  statusThresholds: HealthStatusThresholds;
  metricWeights: Record<Measurement['id'], number>;
}

export interface GovernanceProfileSourceMetadata {
  boundaryPolicySource: GovernanceProfile['boundaryPolicySource'];
}

export interface NodeNameConventionOptions {
  pattern: string;
  message?: string;
}

export interface NodeRootConventionOptions {
  patterns: string[];
  message?: string;
  requireRoot?: boolean;
}

export interface TagConventionOptions {
  requiredPrefixes?: string[];
  allowedPrefixes?: string[];
  valuePattern?: string;
  prefixSeparator?: string;
}

export interface DocumentationPresenceOptions {
  metadataKeys?: string[];
  requireAny?: boolean;
}

export interface MissingDomainOptions {
  required?: boolean;
}

export interface MissingLayerOptions {
  required?: boolean;
}

export interface ForbiddenDependencyTypeOptions {
  allowedTypes?: string[];
}

export interface NormalizedGovernanceProfile {
  name: string;
  description?: string;
  rules: Record<string, GovernanceRuleConfig>;
  scoring: GovernanceScoringProfile;
  exceptions: GovernanceException[];
  nodeOverrides: Record<string, GovernanceNodeOverride>;
  profileSource: GovernanceProfileSourceMetadata;
}

export interface ProfileOverrides {
  boundaryPolicySource?: GovernanceProfile['boundaryPolicySource'];
  layers?: string[];
  rules?: Record<string, GovernanceRuleConfig>;
  allowedLayerDependencies?: AllowedLayerDependencies;
  allowedDomainDependencies?: Record<string, string[]>;
  ownership?: Partial<GovernanceProfile['ownership']>;
  health?: {
    statusThresholds?: Partial<HealthStatusThresholds>;
  };
  metrics?: Partial<Record<string, number>>;
  exceptions?: GovernanceException[];
  nodeOverrides: Record<string, GovernanceNodeOverride>;
}

export function deriveAllowedLayerDependenciesFromLayerOrder(
  layers: string[],
): AllowedLayerDependencies {
  return Object.fromEntries(
    layers.map((sourceLayer, index) => [sourceLayer, layers.slice(index)]),
  );
}

export function normalizeGovernanceProfile(
  profile: GovernanceProfile,
  options: Partial<Pick<ProfileOverrides, 'exceptions' | 'nodeOverrides'>> = {},
): NormalizedGovernanceProfile {
  const allowedLayerDependencies =
    profile.allowedLayerDependencies ??
    deriveAllowedLayerDependenciesFromLayerOrder(profile.layers);
  const defaultRules: Record<string, GovernanceRuleConfig> = {
    'domain-boundary': {
      enabled: true,
      severity: 'error',
      options: {
        allowedDependencies: profile.allowedDomainDependencies,
      } satisfies GovernanceDomainBoundaryRuleOptions,
    },
    'layer-boundary': {
      enabled: true,
      severity: 'warning',
      options: {
        allowedDependencies: allowedLayerDependencies,
        layers: [...profile.layers],
        usesExplicitDependencies:
          profile.allowedLayerDependencies !== undefined,
      } satisfies GovernanceLayerBoundaryRuleOptions,
    },
    'ownership-presence': {
      enabled: true,
      severity: 'warning',
      options: {
        required: profile.ownership.required,
      } satisfies GovernanceOwnershipPresenceRuleOptions,
    },
    'documentation-gap': {
      enabled: true,
      severity: 'warning',
      options: {
        metadataKeys: ['documentation'],
        requireAny: true,
      } satisfies DocumentationPresenceOptions,
    },
  };
  const explicitRules = Object.fromEntries(
    Object.entries(profile.rules ?? {}).map(([ruleId, ruleConfig]) => [
      ruleId,
      {
        ...(defaultRules[ruleId] ?? {}),
        ...ruleConfig,
        ...(ruleConfig.options !== undefined
          ? { options: ruleConfig.options }
          : defaultRules[ruleId]?.options !== undefined
            ? { options: defaultRules[ruleId]?.options }
            : {}),
      } satisfies GovernanceRuleConfig,
    ]),
  );

  return {
    name: profile.name,
    description: profile.description,
    rules: {
      ...defaultRules,
      ...explicitRules,
    },
    scoring: {
      statusThresholds: profile.health.statusThresholds,
      metricWeights: profile.metrics,
    },
    exceptions: options.exceptions ?? [],
    nodeOverrides: options.nodeOverrides ?? {},
    profileSource: {
      boundaryPolicySource: profile.boundaryPolicySource,
    },
  };
}
