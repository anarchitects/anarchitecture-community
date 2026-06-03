export const DBT_GOVERNANCE_ADAPTER_ID = 'governance-adapter:dbt';

export interface DbtGovernanceAdapterMetadata {
  id: typeof DBT_GOVERNANCE_ADAPTER_ID;
  name: string;
  integration: 'dbt';
  status: 'scaffold';
  responsibilities: string[];
  nonGoals: string[];
}

export const dbtGovernanceAdapterMetadata: DbtGovernanceAdapterMetadata = {
  id: DBT_GOVERNANCE_ADAPTER_ID,
  name: 'dbt Governance Adapter',
  integration: 'dbt',
  status: 'scaffold',
  responsibilities: [
    'dbt discovery',
    'dbt loading',
    'dbt validation',
    'dbt normalization',
    'dbt metadata preservation',
  ],
  nonGoals: [
    'dbt artifact loading implementation',
    'dbt project detection implementation',
    'dbt normalization implementation',
    'dbt rules, metrics, scores, diagnostics, recommendations, or extension meaning',
    'TypeScript runtime composition',
    'dbt-native Python host experience',
  ],
};

export default dbtGovernanceAdapterMetadata;
