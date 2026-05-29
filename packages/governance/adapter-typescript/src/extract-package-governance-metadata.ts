import {
  invalidPackageGovernanceMetadataDiagnostic,
  invalidPackageGovernanceMetadataFieldDiagnostic,
  invalidPackageGovernanceMetadataFieldMappingConfigDiagnostic,
  invalidPackageGovernanceMetadataPathConfigDiagnostic,
  invalidPackageGovernanceMetadataPathResolutionDiagnostic,
} from './diagnostics.js';
import { loadPackageMetadata } from './load-package-metadata.js';
import { DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG } from './workspace-adapter.js';
import type {
  TypeScriptPackageGovernanceMetadataConfig,
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
  config: TypeScriptPackageGovernanceMetadataConfig = DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG,
): ExtractPackageGovernanceMetadataResult {
  const loaded = loadPackageMetadata(packageRoot);
  const metadataPath = normalizeMetadataPath(config.path);
  const fieldMapping = normalizeFieldMapping(config.fields);

  if (!metadataPath) {
    return {
      packageJsonPath: loaded.packageJsonPath,
      diagnostics: [
        ...loaded.diagnostics,
        invalidPackageGovernanceMetadataPathConfigDiagnostic(),
        ...fieldMapping.diagnostics,
      ],
    };
  }

  if (!loaded.packageJson) {
    return {
      packageJsonPath: loaded.packageJsonPath,
      diagnostics: [...loaded.diagnostics, ...fieldMapping.diagnostics],
    };
  }

  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [
    ...loaded.diagnostics,
    ...fieldMapping.diagnostics,
  ];
  const governanceValue = resolvePath(
    loaded.packageJson,
    metadataPath,
    loaded.packageJsonPath,
    diagnostics,
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
      invalidPackageGovernanceMetadataDiagnostic(
        loaded.packageJsonPath,
        metadataPath,
      ),
    );

    return {
      packageJsonPath: loaded.packageJsonPath,
      diagnostics,
    };
  }

  const metadata: TypeScriptPackageGovernanceMetadata = {};

  for (const targetField of GOVERNANCE_METADATA_FIELDS) {
    const sourceField = fieldMapping.fields[targetField];
    const fieldValue = governanceRecord[sourceField];

    if (fieldValue === undefined) {
      continue;
    }

    if (typeof fieldValue !== 'string') {
      diagnostics.push(
        invalidPackageGovernanceMetadataFieldDiagnostic(
          loaded.packageJsonPath,
          sourceField,
          metadataPath,
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

function resolvePath(
  value: unknown,
  pathSegments: readonly string[],
  filePath: string,
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[],
): unknown {
  let current: unknown = value;
  const resolvedPath: string[] = [];

  for (const segment of pathSegments) {
    const currentRecord = asRecord(current);

    if (!currentRecord) {
      diagnostics.push(
        invalidPackageGovernanceMetadataPathResolutionDiagnostic(
          filePath,
          pathSegments,
          resolvedPath,
        ),
      );
      return undefined;
    }

    if (!(segment in currentRecord)) {
      return undefined;
    }

    current = currentRecord[segment];
    resolvedPath.push(segment);
  }

  return current;
}

function normalizeMetadataPath(
  pathSegments: readonly string[],
): string[] | undefined {
  return pathSegments.length > 0 && pathSegments.every(isNonEmptyString)
    ? [...pathSegments]
    : undefined;
}

function normalizeFieldMapping(
  fields: TypeScriptPackageGovernanceMetadataConfig['fields'],
): {
  fields: Record<(typeof GOVERNANCE_METADATA_FIELDS)[number], string>;
  diagnostics: TypeScriptWorkspaceDetectionDiagnostic[];
} {
  const diagnostics: TypeScriptWorkspaceDetectionDiagnostic[] = [];
  const normalized = {
    ...DEFAULT_TYPESCRIPT_PACKAGE_GOVERNANCE_METADATA_CONFIG.fields,
  } as Record<(typeof GOVERNANCE_METADATA_FIELDS)[number], string>;

  for (const field of GOVERNANCE_METADATA_FIELDS) {
    const configuredField = fields[field];

    if (configuredField === undefined) {
      continue;
    }

    if (!isNonEmptyString(configuredField)) {
      diagnostics.push(
        invalidPackageGovernanceMetadataFieldMappingConfigDiagnostic(field),
      );
      continue;
    }

    normalized[field] = configuredField;
  }

  return {
    fields: normalized,
    diagnostics,
  };
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
