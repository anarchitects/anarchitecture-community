import * as adapterDbt from './index.js';

describe('dbt adapter public API', () => {
  it('exports contract helpers and metadata from the package root', () => {
    expect(adapterDbt.DBT_ADAPTER_VALIDATION_MODES).toEqual([
      'strict',
      'lenient',
    ]);
    expect(typeof adapterDbt.isDbtAdapterValidationMode).toBe('function');
    expect(typeof adapterDbt.detectDbtProject).toBe('function');
    expect(typeof adapterDbt.resolveDbtProjectContext).toBe('function');
    expect(typeof adapterDbt.loadDbtArtifacts).toBe('function');
    expect(typeof adapterDbt.loadDbtManifest).toBe('function');
    expect(typeof adapterDbt.loadDbtProjectConfig).toBe('function');
    expect(typeof adapterDbt.validateDbtManifest).toBe('function');
    expect(typeof adapterDbt.normalizeDbtArtifacts).toBe('function');
    expect(adapterDbt.DBT_GOVERNANCE_ADAPTER_ID).toBe('governance-adapter:dbt');
    expect(adapterDbt.dbtGovernanceAdapterMetadata.name).toBe(
      'dbt Governance Adapter',
    );
  });
});
