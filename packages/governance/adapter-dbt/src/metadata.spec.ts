import {
  DBT_GOVERNANCE_ADAPTER_ID,
  dbtGovernanceAdapterMetadata,
} from './index.js';

describe('dbt Governance adapter metadata', () => {
  it('loads through the package public entrypoint', async () => {
    const loaded = await import('./index.js');

    expect(loaded.dbtGovernanceAdapterMetadata).toBe(
      dbtGovernanceAdapterMetadata,
    );
    expect(loaded.default).toBe(dbtGovernanceAdapterMetadata);
  });

  it('describes the package boundary without implementation claims', () => {
    expect(dbtGovernanceAdapterMetadata).toMatchObject({
      id: DBT_GOVERNANCE_ADAPTER_ID,
      name: 'dbt Governance Adapter',
      integration: 'dbt',
      status: 'normalization',
      responsibilities: expect.arrayContaining([
        'dbt discovery',
        'dbt project detection',
        'dbt loading',
        'dbt artifact validation',
        'dbt validation',
        'dbt resource normalization',
        'dbt dependency mapping',
        'dbt metadata preservation',
        'dbt adapter contract definition',
      ]),
      nonGoals: expect.arrayContaining([
        'TypeScript runtime composition',
        'dbt-native Python host experience',
      ]),
    });
  });
});
