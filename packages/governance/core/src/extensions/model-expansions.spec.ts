import {
  getGovernanceExtensionModelExpansion,
  hasGovernanceExtensionModelExpansion,
  listGovernanceExtensionModelExpansions,
  withGovernanceExtensionModelExpansion,
  type GovernanceExtensionModelExpansionCarrier,
} from './model-expansions.js';

describe('governance extension model expansions', () => {
  it('attaches and retrieves versioned extension-owned expansions by extension id', () => {
    const carrier: GovernanceExtensionModelExpansionCarrier = {
      extensions: {
        'governance-extension:dbt': {
          extensionId: 'governance-extension:dbt',
          contractVersion: '1',
          data: {
            kind: 'workspace',
          },
        },
      },
    };

    const updated = withGovernanceExtensionModelExpansion(carrier, {
      extensionId: 'governance-extension:typescript',
      contractVersion: '2',
      data: {
        kind: 'node',
        role: 'workspace-project',
      },
    });

    expect(
      hasGovernanceExtensionModelExpansion(updated, 'governance-extension:dbt'),
    ).toBe(true);
    expect(
      getGovernanceExtensionModelExpansion(
        updated,
        'governance-extension:typescript',
      ),
    ).toEqual({
      extensionId: 'governance-extension:typescript',
      contractVersion: '2',
      data: {
        kind: 'node',
        role: 'workspace-project',
      },
    });
    expect(listGovernanceExtensionModelExpansions(updated)).toHaveLength(2);
  });

  it('returns deterministic empty results for carriers without expansions', () => {
    expect(
      getGovernanceExtensionModelExpansion(
        undefined,
        'governance-extension:typescript',
      ),
    ).toBeUndefined();
    expect(
      hasGovernanceExtensionModelExpansion(
        undefined,
        'governance-extension:typescript',
      ),
    ).toBe(false);
    expect(listGovernanceExtensionModelExpansions(undefined)).toEqual([]);
  });
});
