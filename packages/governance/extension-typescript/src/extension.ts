import type {
  GovernanceExtensionDefinition,
  GovernanceExtensionHost,
} from '@anarchitects/governance-core';

export const TYPESCRIPT_GOVERNANCE_EXTENSION_ID =
  'governance-extension:typescript';

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
      'Future TypeScript-specific rules',
      'Future TypeScript-specific metrics',
      'Future TypeScript-specific recommendations',
      'Future TypeScript-specific enrichers',
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

export function createTypeScriptGovernanceExtension(): GovernanceExtensionDefinition {
  return {
    ...governanceTypeScriptExtension,
  };
}

export function registerTypeScriptGovernanceExtension(
  host: GovernanceExtensionHost,
): void {
  void host;
  // #237 only establishes the package boundary. TypeScript-specific
  // contributions move here in #238 and #239.
}

export default governanceTypeScriptExtension;
