import type {
  GovernanceProfile,
  GovernanceWorkspace,
  Measurement,
  Violation,
} from '../core/index.js';
import type { GovernanceSignal } from '../core/evaluation/signals.js';
import type {
  GovernanceCapabilityRegistry,
  GovernanceCapabilityRequirement,
} from './capabilities.js';
import type { GovernanceExtensionModelExpansionMap } from './model-expansions.js';

export interface GovernanceExtensionHostContext {
  // Kept as a portable host-provided string. Core does not read from the
  // filesystem or assume Nx semantics; it only carries the workspace root.
  workspaceRoot: string;
  profileName: string;
  // Opaque extension-owned configuration routed by the host. Canonical profile
  // policy does not belong here, and Core does not interpret these options.
  options: Readonly<Record<string, unknown>>;
  // Hosts may attach extension-owned runtime context here using the same
  // versioned envelope model used for canonical subjects.
  extensions?: GovernanceExtensionModelExpansionMap;
  inventory: GovernanceWorkspace;
  // Hosts compose adapter, extension, profile, and execution concerns through
  // Core-owned capabilities. Adapters should not import extension packages.
  capabilities: GovernanceCapabilityRegistry;
}

export interface GovernanceExtensionDefinition {
  id: string;
  name?: string;
  version?: string;
  requiredCapabilities?: GovernanceCapabilityRequirement[];
  optionalCapabilities?: GovernanceCapabilityRequirement[];
  register(host: GovernanceExtensionHost): void | Promise<void>;
}

export interface GovernanceExtensionHost {
  readonly context: GovernanceExtensionHostContext;
  registerEnricher(enricher: GovernanceWorkspaceEnricher): void;
  registerRulePack(rulePack: GovernanceExtensionRulePack): void;
  registerSignalProvider(signalProvider: GovernanceSignalProvider): void;
  registerMetricProvider(metricProvider: GovernanceMetricProvider): void;
}

export interface GovernanceExtensionExecutionInput {
  workspace: GovernanceWorkspace;
  profile: GovernanceProfile;
  context: GovernanceExtensionHostContext;
}

export type GovernanceWorkspaceEnricherInput =
  GovernanceExtensionExecutionInput;

export type GovernanceRulePackInput = GovernanceExtensionExecutionInput;

export interface GovernanceSignalProviderInput
  extends GovernanceExtensionExecutionInput {
  violations: Violation[];
  signals: GovernanceSignal[];
}

export interface GovernanceMetricProviderInput
  extends GovernanceExtensionExecutionInput {
  signals: GovernanceSignal[];
  measurements: Measurement[];
  violations: Violation[];
}

export interface GovernanceWorkspaceEnricher {
  enrichWorkspace(
    input: GovernanceWorkspaceEnricherInput,
  ): GovernanceWorkspace | Promise<GovernanceWorkspace>;
}

export interface GovernanceExtensionRulePack {
  evaluate(input: GovernanceRulePackInput): Violation[] | Promise<Violation[]>;
}

export interface GovernanceSignalProvider {
  provideSignals(
    input: GovernanceSignalProviderInput,
  ): GovernanceSignal[] | Promise<GovernanceSignal[]>;
}

export interface GovernanceMetricProvider {
  provideMetrics(
    input: GovernanceMetricProviderInput,
  ): Measurement[] | Promise<Measurement[]>;
}
