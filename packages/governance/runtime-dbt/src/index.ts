export const DBT_GOVERNANCE_RUNTIME_ID = 'governance-runtime:dbt' as const;
export const DBT_GOVERNANCE_RUNTIME_PACKAGE_NAME =
  '@anarchitects/governance-runtime-dbt' as const;

export const dbtGovernanceRuntimeMetadata = {
  id: DBT_GOVERNANCE_RUNTIME_ID,
  name: 'dbt Governance Runtime',
  packageName: DBT_GOVERNANCE_RUNTIME_PACKAGE_NAME,
  description: 'dbt Governance runtime composition boundary.',
} as const;

export type DbtGovernanceRuntimeMetadata = typeof dbtGovernanceRuntimeMetadata;
