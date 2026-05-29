import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { extractPackageGovernanceMetadata } from './extract-package-governance-metadata.js';

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
