import {
  invalidPackageGovernanceMetadataDiagnostic,
  invalidPackageGovernanceMetadataFieldDiagnostic,
} from './diagnostics.js';
import { loadPackageMetadata } from './load-package-metadata.js';
import { DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG } from './workspace-adapter.js';
import type {
  TypeScriptPackageGovernanceMetadata,
  TypeScriptWorkspaceDetectionDiagnostic,
} from './types.js';

export interface ExtractPackageGovernanceMetadataResult {
  packageJsonPath: string;
  metadata?: TypeScriptPackageGovernanceMetadata;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
}

export function extractPackageGovernanceMetadata(
  packageRoot: string,
): ExtractPackageGovernanceMetadataResult {
  const loaded = loadPackageMetadata(packageRoot);

  if (!loaded.packageJson) {
    return {
      packageJsonPath: loaded.packageJsonPath,
      diagnostics: [...loaded.diagnostics],
    };
  }

  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [
    ...loaded.diagnostics,
  ];
  const governanceValue = resolvePath(
    loaded.packageJson,
    DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG.path,
  );

  if (governanceValue === undefined) {
    return {
      packageJsonPath: loaded.packageJsonPath,
      diagnostics,
    };
  }

  const governanceRecord = asRecord(governanceValue);

  if (!governanceRecord) {
    diagnostics.push(
      invalidPackageGovernanceMetadataDiagnostic(loaded.packageJsonPath),
    );

    return {
      packageJsonPath: loaded.packageJsonPath,
      diagnostics,
    };
  }

  const metadata: TypeScriptPackageGovernanceMetadata = {};

  for (const targetField of GOVERNANCE_METADATA_FIELDS) {
    const sourceField =
      DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG.fields[targetField];
    const fieldValue = governanceRecord[sourceField];

    if (fieldValue === undefined) {
      continue;
    }

    if (typeof fieldValue !== 'string') {
      diagnostics.push(
        invalidPackageGovernanceMetadataFieldDiagnostic(
          loaded.packageJsonPath,
          sourceField,
        ),
      );
      continue;
    }

    metadata[targetField] = fieldValue;
  }

  return {
    packageJsonPath: loaded.packageJsonPath,
    metadata: hasMetadataFields(metadata) ? metadata : undefined,
    diagnostics,
  };
}

const GOVERNANCE_METADATA_FIELDS = [
  'domain',
  'layer',
  'scope',
  'owner',
] as const;

function resolvePath(value: unknown, pathSegments: readonly string[]): unknown {
  let current: unknown = value;

  for (const segment of pathSegments) {
    const currentRecord = asRecord(current);

    if (!currentRecord) {
      return undefined;
    }

    current = currentRecord[segment];
  }

  return current;
}

function hasMetadataFields(
  metadata: TypeScriptPackageGovernanceMetadata,
): boolean {
  return GOVERNANCE_METADATA_FIELDS.some(
    (field) => metadata[field] !== undefined,
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
