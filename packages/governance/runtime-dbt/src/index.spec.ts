import * as runtimeDbt from './index.js';

describe('dbt runtime public API', () => {
  it('exports the runtime boundary metadata from the package root', () => {
    expect(runtimeDbt.DBT_GOVERNANCE_RUNTIME_ID).toBe('governance-runtime:dbt');
    expect(runtimeDbt.DBT_GOVERNANCE_RUNTIME_PACKAGE_NAME).toBe(
      '@anarchitects/governance-runtime-dbt',
    );
    expect(runtimeDbt.dbtGovernanceRuntimeMetadata).toEqual({
      id: 'governance-runtime:dbt',
      name: 'dbt Governance Runtime',
      packageName: '@anarchitects/governance-runtime-dbt',
      description: 'dbt Governance runtime composition boundary.',
    });
  });
});
