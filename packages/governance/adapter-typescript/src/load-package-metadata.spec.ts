import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadPackageMetadata } from './load-package-metadata.js';

describe('loadPackageMetadata', () => {
  it('reads and parses a valid package.json file', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(
      packageRoot,
      JSON.stringify({ name: '@fixture/package', version: '1.0.0' }),
    );

    const result = loadPackageMetadata(packageRoot);

    expect(result.packageJsonPath).toBe(path.join(packageRoot, 'package.json'));
    expect(result.packageJson).toEqual({
      name: '@fixture/package',
      version: '1.0.0',
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('handles missing package.json without diagnostics', () => {
    const packageRoot = makeTempPackageRoot();

    const result = loadPackageMetadata(packageRoot);

    expect(result.packageJsonPath).toBe(path.join(packageRoot, 'package.json'));
    expect(result.packageJson).toBeUndefined();
    expect(result.diagnostics).toEqual([]);
  });

  it('returns diagnostics for invalid package.json JSON', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(packageRoot, '{"name":');

    const result = loadPackageMetadata(packageRoot);

    expect(result.packageJson).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.invalid_package_metadata_json',
        message: `Failed to parse package metadata file "${path.join(packageRoot, 'package.json')}" as JSON.`,
        source: 'governance.typescript_adapter',
        path: '/package.json',
      },
    ]);
  });

  it('returns diagnostics for non-object package.json content', () => {
    const packageRoot = makeTempPackageRoot();
    writePackageJson(packageRoot, '[]');

    const result = loadPackageMetadata(packageRoot);

    expect(result.packageJson).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.unsupported_package_metadata_format',
        message: `Package metadata file "${path.join(packageRoot, 'package.json')}" must contain a JSON object.`,
        source: 'governance.typescript_adapter',
        path: '/package.json',
      },
    ]);
  });

  it('returns diagnostics for unreadable package.json paths', () => {
    const packageRoot = makeTempPackageRoot();
    mkdirSync(path.join(packageRoot, 'package.json'));

    const result = loadPackageMetadata(packageRoot);

    expect(result.packageJson).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        code: 'governance.typescript_adapter.invalid_package_metadata_json',
        message: `Failed to parse package metadata file "${path.join(packageRoot, 'package.json')}" as JSON.`,
        source: 'governance.typescript_adapter',
        path: '/package.json',
      },
    ]);
  });
});

function makeTempPackageRoot(): string {
  return mkdtempSync(
    path.join(tmpdir(), 'governance-typescript-package-metadata-loader-'),
  );
}

function writePackageJson(packageRoot: string, content: string): void {
  writeFileSync(path.join(packageRoot, 'package.json'), content, 'utf8');
}
