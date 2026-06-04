import type {
  GovernanceExtensionDefinition,
  GovernanceExtensionHost,
} from '@anarchitects/governance-core';

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

export function createDbtGovernanceExtension(): GovernanceExtensionDefinition {
  return {
    ...dbtGovernanceExtension,
  };
}

export function registerDbtGovernanceExtension(
  host: GovernanceExtensionHost,
): void {
  void host;
  // #275 establishes the package boundary only. No dbt-specific contributions
  // are registered until normalized adapter output interpretation is defined.
}

export default dbtGovernanceExtension;
