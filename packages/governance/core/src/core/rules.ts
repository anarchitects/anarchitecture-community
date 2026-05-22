import type { GovernanceCapability, GovernanceDiagnostic } from './adapter.js';
import type { Measurement, Violation, GovernanceWorkspace } from './models.js';
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

export interface GovernanceRuleContext<TOptions = unknown> {
  workspace: GovernanceWorkspace;
  profile?: GovernanceProfile;
  options?: TOptions;
  capabilities?: GovernanceCapability[];
  diagnostics?: GovernanceDiagnostic[];
}

export interface GovernanceRuleResult {
  violations?: Violation[];
  signals?: GovernanceSignal[];
  measurements?: Measurement[];
}

export interface GovernanceRuleExecutionResult {
  violations: Violation[];
  signals: GovernanceSignal[];
  measurements: Measurement[];
}

export interface GovernanceRule<TOptions = unknown> {
  id: string;
  name: string;
  description?: string;
  category: GovernanceRuleCategory;
  defaultSeverity: GovernanceRuleSeverity;
  evaluate(
    context: GovernanceRuleContext<TOptions>,
  ): GovernanceRuleResult | Promise<GovernanceRuleResult>;
}

export interface GovernanceRulePack<TOptions = unknown> {
  id: string;
  name: string;
  rules: GovernanceRule<TOptions>[];
}
