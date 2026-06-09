import type {
  GovernanceAuthority,
  GovernanceCapability,
  GovernanceClassificationInput,
  GovernanceConfidence,
  GovernanceDiagnostic,
  GovernanceEvidence,
  GovernanceNodeInput,
  GovernanceOwnershipInput,
  GovernancePerspective,
  GovernanceRelationInput,
  GovernanceSource,
} from '../adapter/adapter.js';
import type {
  GovernanceAssessment,
  Measurement,
  Recommendation,
  Violation,
  GovernanceWorkspace,
} from '../model/models.js';
import type { GovernanceProfile } from './profile.js';
import type { GovernanceSignal } from './signals.js';

export type GovernanceRuleSeverity = Violation['severity'];

export type GovernanceRuleCategory =
  | Violation['category']
  | 'convention'
  | 'metadata'
  | 'structure'
  | 'snapshot'
  | 'drift'
  | 'ai'
  | (string & {});

export type GovernanceRuleOutputKind =
  | 'violation'
  | 'finding'
  | 'signal'
  | 'metric'
  | 'measurement'
  | 'recommendation'
  | 'conformance'
  | 'drift'
  | (string & {});

export type GovernanceConformanceStatus =
  | 'conformant'
  | 'non-conformant'
  | 'partial'
  | 'not-applicable'
  | 'unknown'
  | (string & {});

export type GovernanceDriftStatus =
  | 'no-drift'
  | 'drift-detected'
  | 'accepted-drift'
  | 'unknown'
  | (string & {});

export type GovernanceDriftClassification =
  | 'intent-vs-documented'
  | 'intent-vs-implemented'
  | 'documented-vs-implemented'
  | 'implemented-vs-runtime'
  | (string & {});

/**
 * Describes when a rule is meaningful without hardcoding a technology or host.
 * Hosts may use this contract for future rule selection; the current engine
 * keeps evaluating the supplied rules in order for backward compatibility.
 */
export interface GovernanceRuleApplicability {
  perspectiveIds?: string[];
  capabilityIds?: string[];
  nodeKinds?: string[];
  relationKinds?: string[];
  technologies?: string[];
  classification?: Partial<GovernanceClassificationInput>;
  ownership?: Partial<GovernanceOwnershipInput>;
  metadata?: Record<string, unknown>;
}

export interface GovernanceRuleFinding {
  id: string;
  ruleId?: string;
  severity: GovernanceRuleSeverity;
  category: GovernanceRuleCategory;
  message: string;
  nodeId?: string;
  relationId?: string;
  relatedNodeIds?: string[];
  relatedRelationIds?: string[];
  recommendation?: string;
  perspective?: GovernancePerspective;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}

export interface GovernanceConformanceResult {
  id: string;
  ruleId?: string;
  status: GovernanceConformanceStatus;
  expected?: unknown;
  observed?: unknown;
  rationale?: string;
  findingIds?: string[];
  signalIds?: string[];
  perspective?: GovernancePerspective;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}

export interface GovernanceDriftResult {
  id: string;
  ruleId?: string;
  status: GovernanceDriftStatus;
  classification?: GovernanceDriftClassification;
  indicator?: string;
  intent?: unknown;
  documentedReality?: unknown;
  implementedReality?: unknown;
  runtimeReality?: unknown;
  baseline?: unknown;
  current?: unknown;
  rationale?: string;
  findingIds?: string[];
  signalIds?: string[];
  perspective?: GovernancePerspective;
  source?: GovernanceSource;
  evidence?: GovernanceEvidence[];
  authority?: GovernanceAuthority;
  confidence?: GovernanceConfidence;
  metadata?: Record<string, unknown>;
}

export interface GovernanceRuleContext<TOptions = unknown> {
  workspace: GovernanceWorkspace;
  profile?: GovernanceProfile;
  options?: TOptions;
  capabilities?: GovernanceCapability[];
  diagnostics?: GovernanceDiagnostic[];
  nodes?: GovernanceNodeInput[];
  relations?: GovernanceRelationInput[];
  classifications?: GovernanceClassificationInput[];
  ownership?: GovernanceOwnershipInput[];
  perspectives?: GovernancePerspective[];
  sources?: GovernanceSource[];
  evidence?: GovernanceEvidence[];
  findings?: GovernanceRuleFinding[];
  signals?: GovernanceSignal[];
  measurements?: Measurement[];
  assessments?: GovernanceAssessment[];
  metadata?: Record<string, unknown>;
}

export interface GovernanceRuleResult {
  violations?: Violation[];
  findings?: GovernanceRuleFinding[];
  signals?: GovernanceSignal[];
  measurements?: Measurement[];
  metrics?: Measurement[];
  recommendations?: Recommendation[];
  conformance?: GovernanceConformanceResult[];
  drift?: GovernanceDriftResult[];
  metadata?: Record<string, unknown>;
}

export interface GovernanceRuleExecutionResult {
  violations: Violation[];
  signals: GovernanceSignal[];
  measurements: Measurement[];
  findings?: GovernanceRuleFinding[];
  recommendations?: Recommendation[];
  conformance?: GovernanceConformanceResult[];
  drift?: GovernanceDriftResult[];
}

export interface GovernanceRule<TOptions = unknown> {
  id: string;
  name: string;
  description?: string;
  category: GovernanceRuleCategory;
  defaultSeverity: GovernanceRuleSeverity;
  metadata?: Record<string, unknown>;
  applicability?: GovernanceRuleApplicability;
  produces?: GovernanceRuleOutputKind[];
  evaluate(
    context: GovernanceRuleContext<TOptions>,
  ): GovernanceRuleResult | Promise<GovernanceRuleResult>;
}

export interface GovernanceRulePack<TOptions = unknown> {
  id: string;
  name: string;
  rules: GovernanceRule<TOptions>[];
}
