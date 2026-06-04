import {
  DBT_GOVERNANCE_EXTENSION_ID,
  createDbtGovernanceExtension,
  dbtGovernanceExtension,
  dbtGovernanceExtensionMetadata,
} from './index.js';

describe('dbt Governance extension', () => {
  it('loads through the package public entrypoint', async () => {
    const loaded = await import('./index.js');

    expect(loaded.dbtGovernanceExtension).toBe(dbtGovernanceExtension);
    expect(loaded.default).toBe(dbtGovernanceExtension);
  });

  it('exposes stable extension identity and metadata', () => {
    expect(dbtGovernanceExtension).toMatchObject({
      id: DBT_GOVERNANCE_EXTENSION_ID,
      name: 'dbt Governance Extension',
    });
    expect(dbtGovernanceExtension.version).toBeUndefined();
    expect(dbtGovernanceExtensionMetadata).toMatchObject({
      id: DBT_GOVERNANCE_EXTENSION_ID,
      technology: 'dbt',
      responsibilities: expect.arrayContaining([
        'dbt-specific governance interpretation',
        'Interpreting normalized dbt governance data',
      ]),
      nonResponsibilities: expect.arrayContaining([
        'Loading raw dbt artifacts',
        'Normalizing dbt resources',
        'Running dbt commands',
        'Composing runtime packages',
        'Implementing Python host behavior',
      ]),
    });
  });

  it('creates independent extension definitions for future hosts', () => {
    const created = createDbtGovernanceExtension();

    expect(created).toEqual(dbtGovernanceExtension);
    expect(created).not.toBe(dbtGovernanceExtension);
    expect(created.register).toBe(dbtGovernanceExtension.register);
  });
});
