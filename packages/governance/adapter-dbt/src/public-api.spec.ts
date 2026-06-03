import * as adapterDbt from './index.js';

describe('dbt adapter public API', () => {
  it('exports contract helpers and metadata from the package root', () => {
    expect(adapterDbt.DBT_ADAPTER_VALIDATION_MODES).toEqual([
      'strict',
      'lenient',
    ]);
    expect(typeof adapterDbt.isDbtAdapterValidationMode).toBe('function');
    expect(adapterDbt.DBT_GOVERNANCE_ADAPTER_ID).toBe('governance-adapter:dbt');
    expect(adapterDbt.dbtGovernanceAdapterMetadata.name).toBe(
      'dbt Governance Adapter',
    );
  });
});
