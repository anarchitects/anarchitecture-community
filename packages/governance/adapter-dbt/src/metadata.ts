export const DBT_GOVERNANCE_ADAPTER_ID = 'governance-adapter:dbt';

export interface DbtGovernanceAdapterMetadata {
  id: typeof DBT_GOVERNANCE_ADAPTER_ID;
  name: string;
  integration: 'dbt';
  status: 'normalization';
  responsibilities: string[];
  nonGoals: string[];
}

export const dbtGovernanceAdapterMetadata: DbtGovernanceAdapterMetadata = {
  id: DBT_GOVERNANCE_ADAPTER_ID,
  name: 'dbt Governance Adapter',
  integration: 'dbt',
  status: 'normalization',
  responsibilities: [
    'dbt discovery',
    'dbt project detection',
    'dbt loading',
    'dbt artifact validation',
    'dbt validation',
    'dbt resource normalization',
    'dbt normalization',
    'dbt metadata preservation',
    'dbt adapter contract definition',
  ],
  nonGoals: [
    'dbt dependency mapping implementation',
    'dbt rules, metrics, scores, or recommendations',
    'TypeScript runtime composition',
    'dbt-native Python host experience',
  ],
};

export default dbtGovernanceAdapterMetadata;
