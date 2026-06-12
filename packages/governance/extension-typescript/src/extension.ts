import type {
  GovernanceExtensionDefinition,
  GovernanceExtensionHost,
} from '@anarchitects/governance-core';

import type { TypeScriptGovernanceExtensionContributions } from './contracts.js';
import { TYPESCRIPT_GOVERNANCE_EXTENSION_ID } from './constants.js';
import { typescriptGovernanceDiagnosticsProvider } from './diagnostics.js';
import { typescriptGovernanceMetricProvider } from './metrics.js';
import { typescriptGovernanceRecommendationProvider } from './recommendations.js';
import { typescriptGovernanceSignalProvider } from './signals.js';
import {
  registerTypeScriptGovernanceExtensionContributions,
  type TypeScriptGovernanceExtensionOptions,
} from './contracts.js';

export interface TypeScriptGovernanceExtensionMetadata {
  id: typeof TYPESCRIPT_GOVERNANCE_EXTENSION_ID;
  name: string;
  technology: 'typescript';
  responsibilities: string[];
  nonResponsibilities: string[];
}

export const typescriptGovernanceExtensionMetadata: TypeScriptGovernanceExtensionMetadata =
  {
    id: TYPESCRIPT_GOVERNANCE_EXTENSION_ID,
    name: 'TypeScript Governance Extension',
    technology: 'typescript',
    responsibilities: [
      'TypeScript-specific governance interpretation',
      'Interpreting canonical TypeScript and package-manager graph data',
    ],
    nonResponsibilities: [
      'TypeScript workspace extraction',
      'TypeScript project discovery',
      'tsconfig parsing',
      'dependency graph discovery',
      'CLI orchestration',
      'reporting',
      'canonical Governance Core semantics',
    ],
  };

export const governanceTypeScriptExtension: GovernanceExtensionDefinition = {
  id: typescriptGovernanceExtensionMetadata.id,
  name: typescriptGovernanceExtensionMetadata.name,
  register: registerTypeScriptGovernanceExtension,
};

export function createTypeScriptGovernanceExtension(
  options: TypeScriptGovernanceExtensionOptions = {},
): GovernanceExtensionDefinition {
  if (!options.contributions && !options.version) {
    return {
      ...governanceTypeScriptExtension,
    };
  }

  return {
    id: governanceTypeScriptExtension.id,
    name: governanceTypeScriptExtension.name,
    ...(options.version ? { version: options.version } : {}),
    register: (host) =>
      registerTypeScriptGovernanceExtension(host, options.contributions),
  };
}

export function registerTypeScriptGovernanceExtension(
  host: GovernanceExtensionHost,
  contributions: TypeScriptGovernanceExtensionContributions = {},
): void {
  registerTypeScriptGovernanceExtensionContributions(host, {
    ...contributions,
    signalProviders: [
      typescriptGovernanceSignalProvider,
      ...(contributions.signalProviders ?? []),
    ],
    metricProviders: [
      typescriptGovernanceMetricProvider,
      ...(contributions.metricProviders ?? []),
    ],
    diagnosticProviders: [
      typescriptGovernanceDiagnosticsProvider,
      ...(contributions.diagnosticProviders ?? []),
    ],
    recommendationProviders: [
      typescriptGovernanceRecommendationProvider,
      ...(contributions.recommendationProviders ?? []),
    ],
  });
}

export default governanceTypeScriptExtension;
