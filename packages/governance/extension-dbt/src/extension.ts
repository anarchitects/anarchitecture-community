import type {
  GovernanceExtensionDefinition,
  GovernanceExtensionHost,
} from '@anarchitects/governance-core';

import type { DbtGovernanceExtensionContributions } from './contracts.js';
import { dbtGovernanceDiagnosticsProvider } from './diagnostics.js';
import { dbtArchitectureBasicRulePack } from './rule-pack.js';
import { dbtGovernanceSignalProvider } from './signals.js';
import {
  registerDbtGovernanceExtensionContributions,
  type DbtGovernanceExtensionOptions,
} from './contracts.js';

export const DBT_GOVERNANCE_EXTENSION_ID = 'governance-extension:dbt';

export interface DbtGovernanceExtensionMetadata {
  id: typeof DBT_GOVERNANCE_EXTENSION_ID;
  name: string;
  technology: 'dbt';
  responsibilities: string[];
  nonResponsibilities: string[];
}

export const dbtGovernanceExtensionMetadata: DbtGovernanceExtensionMetadata = {
  id: DBT_GOVERNANCE_EXTENSION_ID,
  name: 'dbt Governance Extension',
  technology: 'dbt',
  responsibilities: [
    'dbt-specific governance interpretation',
    'Interpreting normalized dbt governance data',
  ],
  nonResponsibilities: [
    'Loading raw dbt artifacts',
    'Normalizing dbt resources',
    'Running dbt commands',
    'Composing runtime packages',
    'Implementing Python host behavior',
  ],
};

export const dbtGovernanceExtension: GovernanceExtensionDefinition = {
  id: dbtGovernanceExtensionMetadata.id,
  name: dbtGovernanceExtensionMetadata.name,
  register: registerDbtGovernanceExtension,
};

export const governanceDbtExtension = dbtGovernanceExtension;

export function createDbtGovernanceExtension(
  options: DbtGovernanceExtensionOptions = {},
): GovernanceExtensionDefinition {
  if (!options.contributions && !options.version) {
    return {
      ...dbtGovernanceExtension,
    };
  }

  return {
    id: dbtGovernanceExtension.id,
    name: dbtGovernanceExtension.name,
    ...(options.version ? { version: options.version } : {}),
    register: (host) =>
      registerDbtGovernanceExtension(host, options.contributions),
  };
}

export function registerDbtGovernanceExtension(
  host: GovernanceExtensionHost,
  contributions: DbtGovernanceExtensionContributions = {},
): void {
  registerDbtGovernanceExtensionContributions(host, {
    ...contributions,
    rulePacks: [
      dbtArchitectureBasicRulePack,
      ...(contributions.rulePacks ?? []),
    ],
    signalProviders: [
      dbtGovernanceSignalProvider,
      ...(contributions.signalProviders ?? []),
    ],
    diagnosticProviders: [
      dbtGovernanceDiagnosticsProvider,
      ...(contributions.diagnosticProviders ?? []),
    ],
  });
}

export default dbtGovernanceExtension;
