import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { extractPackageGovernanceMetadata } from './extract-package-governance-metadata.js';
import { DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG } from './workspace-adapter.js';

describe('extractPackageGovernanceMetadata', () => {
  it('extracts valid default governance metadata', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({
        name: '@fixture/package',
        governance: {
          domain: 'booking',
          layer: 'domain',
          scope: 'booking',
          owner: 'booking-team',
        },
      }),
    );

    const result = extractPackageGovernanceMetadata(packageRoot);

    expect(result.packageJsonPath).toBe(path.join(packageRoot, 'package.json'));
    expect(result.metadata).toEqual({
      domain: 'booking',
      layer: 'domain',
      scope: 'booking',
      owner: 'booking-team',
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('treats missing governance metadata as valid absence', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(packageRoot, JSON.stringify({ name: '@fixture/package' }));

    const result = extractPackageGovernanceMetadata(packageRoot);

    expect(result.metadata).toBeUndefined();
    expect(result.diagnostics).toEqual([]);
  });

  it('returns diagnostics when governance metadata is not an object', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({
        name: '@fixture/package',
        governance: 'booking',
      }),
    );

    const result = extractPackageGovernanceMetadata(packageRoot);

    expect(result.metadata).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.invalid_package_governance_metadata',
        message: `Package metadata file "${path.join(packageRoot, 'package.json')}" has invalid governance metadata at "governance"; expected an object.`,
        source: 'governance.typescript_adapter',
        path: '/package.json/governance',
      },
    ]);
  });

  it('returns diagnostics for non-string governance field values', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({
        governance: {
          domain: 'booking',
          owner: 42,
        },
      }),
    );

    const result = extractPackageGovernanceMetadata(packageRoot);

    expect(result.metadata).toEqual({
      domain: 'booking',
    });
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.invalid_package_governance_metadata_field',
        message: `Package metadata file "${path.join(packageRoot, 'package.json')}" has invalid governance metadata field "owner"; expected a string value.`,
        source: 'governance.typescript_adapter',
        path: '/package.json/governance/owner',
      },
    ]);
  });

  it('extracts partial governance metadata when present', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({
        governance: {
          domain: 'booking',
          scope: 'booking',
        },
      }),
    );

    const result = extractPackageGovernanceMetadata(packageRoot);

    expect(result.metadata).toEqual({
      domain: 'booking',
      scope: 'booking',
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('supports a custom governance field mapping', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({
        governance: {
          boundedContext: 'booking',
          architecturalLayer: 'domain',
          moduleScope: 'booking',
          owningTeam: 'booking-team',
        },
      }),
    );

    const result = extractPackageGovernanceMetadata(packageRoot, {
      ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
      fields: {
        domain: 'boundedContext',
        layer: 'architecturalLayer',
        scope: 'moduleScope',
        owner: 'owningTeam',
      },
    });

    expect(result.metadata).toEqual({
      domain: 'booking',
      layer: 'domain',
      scope: 'booking',
      owner: 'booking-team',
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('extracts partial governance metadata with a custom field mapping', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({
        governance: {
          boundedContext: 'booking',
          moduleScope: 'booking',
        },
      }),
    );

    const result = extractPackageGovernanceMetadata(packageRoot, {
      ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
      fields: {
        domain: 'boundedContext',
        layer: 'architecturalLayer',
        scope: 'moduleScope',
        owner: 'owningTeam',
      },
    });

    expect(result.metadata).toEqual({
      domain: 'booking',
      scope: 'booking',
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('handles missing mapped fields gracefully', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({
        governance: {
          boundedContext: 'booking',
        },
      }),
    );

    const result = extractPackageGovernanceMetadata(packageRoot, {
      ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
      fields: {
        domain: 'boundedContext',
        layer: 'architecturalLayer',
        scope: 'moduleScope',
        owner: 'owningTeam',
      },
    });

    expect(result.metadata).toEqual({
      domain: 'booking',
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('returns diagnostics for invalid field mapping configuration and falls back to defaults', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({
        governance: {
          domain: 'booking',
          owner: 'booking-team',
        },
      }),
    );

    const result = extractPackageGovernanceMetadata(packageRoot, {
      ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
      fields: {
        ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG.fields,
        owner: '',
      },
    });

    expect(result.metadata).toEqual({
      domain: 'booking',
      owner: 'booking-team',
    });
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.invalid_package_governance_metadata_field_mapping_config',
        message:
          'Package governance metadata field mapping for "owner" must be a non-empty string.',
        source: 'governance.typescript_adapter',
        path: '/packageGovernanceMetadataConfig/fields/owner',
      },
    ]);
  });

  it('falls back to default field mappings when some mappings are omitted', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({
        governance: {
          boundedContext: 'booking',
          layer: 'domain',
          scope: 'booking',
          owner: 'booking-team',
        },
      }),
    );

    const result = extractPackageGovernanceMetadata(packageRoot, {
      ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
      fields: {
        domain: 'boundedContext',
      },
    });

    expect(result.metadata).toEqual({
      domain: 'booking',
      layer: 'domain',
      scope: 'booking',
      owner: 'booking-team',
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('supports a custom nested governance metadata path', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({
        anarchitects: {
          governance: {
            domain: 'booking',
            layer: 'domain',
          },
        },
      }),
    );

    const result = extractPackageGovernanceMetadata(packageRoot, {
      ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
      path: ['anarchitects', 'governance'],
    });

    expect(result.metadata).toEqual({
      domain: 'booking',
      layer: 'domain',
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('treats a missing configured metadata path as valid absence', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({
        governance: {
          domain: 'booking',
        },
      }),
    );

    const result = extractPackageGovernanceMetadata(packageRoot, {
      ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
      path: ['anarchitects', 'governance'],
    });

    expect(result.metadata).toBeUndefined();
    expect(result.diagnostics).toEqual([]);
  });

  it('returns diagnostics when a configured path resolves through a non-object value', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({
        anarchitects: 'booking',
      }),
    );

    const result = extractPackageGovernanceMetadata(packageRoot, {
      ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
      path: ['anarchitects', 'governance'],
    });

    expect(result.metadata).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.invalid_package_governance_metadata_path_resolution',
        message: `Package metadata file "${path.join(packageRoot, 'package.json')}" could not resolve governance metadata path "anarchitects.governance" because "anarchitects" is not an object.`,
        source: 'governance.typescript_adapter',
        path: '/package.json/anarchitects',
      },
    ]);
  });

  it('returns diagnostics for invalid metadata path configuration', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({
        governance: {
          domain: 'booking',
        },
      }),
    );

    const result = extractPackageGovernanceMetadata(packageRoot, {
      ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
      path: [],
    });

    expect(result.metadata).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.invalid_package_governance_metadata_path_config',
        message:
          'Package governance metadata path configuration must be a non-empty array of non-empty string segments.',
        source: 'governance.typescript_adapter',
        path: '/packageGovernanceMetadataConfig/path',
      },
    ]);
  });
});

function makeTempPackageRoot(): string {
  return mkdtempSync(
    path.join(
      tmpdir(),
      'governance-typescript-package-governance-metadata-extractor-',
    ),
  );
}

function writePackageJson(packageRoot: string, content: string): void {
  writeFileSync(path.join(packageRoot, 'package.json'), content, 'utf8');
}
