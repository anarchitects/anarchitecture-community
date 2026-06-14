import type {
  TypeScriptWorkspaceDetectionDiagnostic,
  TypeScriptWorkspaceIndicators,
} from './types.js';

const DIAGNOSTIC_SOURCE = 'governance.typescript_adapter';

export function invalidPackageJsonDiagnostic(
  filePath: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_package_json',
    message: `Failed to parse package.json file "${filePath}".`,
    source: DIAGNOSTIC_SOURCE,
    path: '/package.json',
  };
}

export function invalidPackageMetadataJsonDiagnostic(
  filePath: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_package_metadata_json',
    message: `Failed to parse package metadata file "${filePath}" as JSON.`,
    source: DIAGNOSTIC_SOURCE,
    path: '/package.json',
  };
}

export function unsupportedPackageMetadataFormatDiagnostic(
  filePath: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.unsupported_package_metadata_format',
    message: `Package metadata file "${filePath}" must contain a JSON object.`,
    source: DIAGNOSTIC_SOURCE,
    path: '/package.json',
  };
}

export function invalidPackageGovernanceMetadataDiagnostic(
  filePath: string,
  metadataPath: readonly string[] = ['governance'],
): TypeScriptWorkspaceDetectionDiagnostic {
  const pathLabel = metadataPath.join('.');

  return {
    code: 'governance.typescript_adapter.invalid_package_governance_metadata',
    message: `Package metadata file "${filePath}" has invalid governance metadata at "${pathLabel}"; expected an object.`,
    source: DIAGNOSTIC_SOURCE,
    path: `/package.json/${metadataPath.join('/')}`,
  };
}

export function invalidPackageGovernanceMetadataFieldDiagnostic(
  filePath: string,
  field: string,
  metadataPath: readonly string[] = ['governance'],
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_package_governance_metadata_field',
    message: `Package metadata file "${filePath}" has invalid governance metadata field "${field}"; expected a string value.`,
    source: DIAGNOSTIC_SOURCE,
    path: `/package.json/${metadataPath.join('/')}/${field}`,
  };
}

export function invalidPackageGovernanceMetadataPathConfigDiagnostic(): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_package_governance_metadata_path_config',
    message:
      'Package governance metadata path configuration must be a non-empty array of non-empty string segments.',
    source: DIAGNOSTIC_SOURCE,
    path: '/packageGovernanceMetadataConfig/path',
  };
}

export function invalidPackageGovernanceMetadataPathResolutionDiagnostic(
  filePath: string,
  metadataPath: readonly string[],
  resolvedPath: readonly string[],
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_package_governance_metadata_path_resolution',
    message: `Package metadata file "${filePath}" could not resolve governance metadata path "${metadataPath.join('.')}" because "${resolvedPath.join('.')}" is not an object.`,
    source: DIAGNOSTIC_SOURCE,
    path: `/package.json/${resolvedPath.join('/')}`,
  };
}

export function invalidPackageGovernanceMetadataFieldMappingConfigDiagnostic(
  field: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_package_governance_metadata_field_mapping_config',
    message: `Package governance metadata field mapping for "${field}" must be a non-empty string.`,
    source: DIAGNOSTIC_SOURCE,
    path: `/packageGovernanceMetadataConfig/fields/${field}`,
  };
}

export function invalidPackageGovernanceMetadataFieldMappingFormatDiagnostic(): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_package_governance_metadata_field_mapping_format',
    message:
      'Package governance metadata field mapping configuration must be an object when provided.',
    source: DIAGNOSTIC_SOURCE,
    path: '/packageGovernanceMetadataConfig/fields',
  };
}

export function partialWorkspaceDetectionDiagnostic(
  indicators: TypeScriptWorkspaceIndicators,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.partial_workspace_detection',
    message:
      'Repository has TypeScript or JavaScript indicators but no explicit workspace-manager indicator.',
    source: DIAGNOSTIC_SOURCE,
    details: {
      detectedIndicators: detectedIndicators(indicators),
    },
  };
}

export function noWorkspaceIndicatorsDiagnostic(): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.no_workspace_indicators',
    message:
      'Repository does not contain supported TypeScript or JavaScript workspace indicators.',
    source: DIAGNOSTIC_SOURCE,
  };
}

export function invalidWorkspaceConfigDiagnostic(
  path: string,
  message: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_workspace_config',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function unsupportedWorkspaceFormatDiagnostic(
  path: string,
  message: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.unsupported_workspace_format',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function noWorkspacePackagesFoundDiagnostic(
  patterns: readonly string[],
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.no_workspace_packages_found',
    message: 'Workspace patterns did not resolve to any package roots.',
    source: DIAGNOSTIC_SOURCE,
    details: {
      patterns: [...patterns],
    },
  };
}

export function invalidTsConfigDiagnostic(
  path: string,
  message: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_tsconfig',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function invalidTsConfigExtendsDiagnostic(
  path: string,
  message: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_tsconfig_extends',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function circularTsConfigExtendsDiagnostic(
  path: string,
  chain: readonly string[],
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.circular_tsconfig_extends',
    message: 'Circular tsconfig extends chain detected.',
    source: DIAGNOSTIC_SOURCE,
    path,
    details: {
      chain: [...chain],
    },
  };
}

export function invalidPathAliasDiagnostic(
  path: string,
  message: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_path_alias',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function invalidDiscoveryPatternDiagnostic(
  path: string,
  message: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_discovery_pattern',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function discoveryPatternNoMatchesDiagnostic(
  pattern: string,
  path: string,
  metadata?: Record<string, unknown>,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.discovery_pattern_no_matches',
    message: `Discovery pattern "${pattern}" did not match any package roots.`,
    source: DIAGNOSTIC_SOURCE,
    path,
    ...(metadata ? { metadata } : {}),
  };
}

export function duplicateProjectRootDiagnostic(
  root: string,
  path: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.duplicate_project_root',
    message: `Duplicate discovered project root "${root}" is not allowed.`,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function duplicateProjectNameDiagnostic(
  name: string,
  path: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.duplicate_project_name',
    message: `Duplicate discovered project name "${name}" is not allowed.`,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function invalidTagTemplateDiagnostic(
  path: string,
  message: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_tag_template',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function invalidProjectNameTemplateDiagnostic(
  path: string,
  message: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_project_name_template',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function invalidDiscoveryProjectionDiagnostic(
  path: string,
  message: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.invalid_discovery_projection',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function sourceFileParseErrorDiagnostic(
  path: string,
  message: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.source_file_parse_error',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function unresolvedImportDiagnostic(
  path: string,
  message: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.unresolved_import',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function nonLiteralDynamicImportDiagnostic(
  path: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.non_literal_dynamic_import',
    message:
      'Dynamic import specifier must be a string literal for deterministic analysis.',
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function unsupportedImportSyntaxDiagnostic(
  path: string,
  message: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.unsupported_import_syntax',
    message,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function sourceFileOutsideProjectDiagnostic(
  path: string,
  filePath: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.source_file_outside_project',
    message: `Source file "${filePath}" does not belong to a discovered governance node root.`,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function resolvedImportOutsideProjectDiagnostic(
  path: string,
  filePath: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.resolved_import_outside_project',
    message: `Resolved import file "${filePath}" does not belong to a discovered governance node root.`,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function unresolvedInternalImportDiagnostic(
  path: string,
  sourceFile: string,
  specifier: string,
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.unresolved_internal_import',
    message: `Internal import specifier "${specifier}" from "${sourceFile}" could not be mapped to a discovered governance node.`,
    source: DIAGNOSTIC_SOURCE,
    path,
  };
}

export function ambiguousProjectMatchDiagnostic(
  path: string,
  filePath: string,
  nodeIds: readonly string[],
): TypeScriptWorkspaceDetectionDiagnostic {
  return {
    code: 'governance.typescript_adapter.ambiguous_project_match',
    message: `File "${filePath}" matched multiple discovered governance nodes.`,
    source: DIAGNOSTIC_SOURCE,
    path,
    details: {
      nodeIds: [...nodeIds],
    },
  };
}

function detectedIndicators(
  indicators: TypeScriptWorkspaceIndicators,
): string[] {
  const detected: string[] = [];

  if (indicators.packageJson) {
    detected.push('packageJson');
  }

  if (indicators.pnpmWorkspace) {
    detected.push('pnpmWorkspace');
  }

  if (indicators.packageManagerWorkspaces) {
    detected.push('packageManagerWorkspaces');
  }

  if (indicators.tsconfig) {
    detected.push('tsconfig');
  }

  if (indicators.tsconfigBase) {
    detected.push('tsconfigBase');
  }

  return detected;
}
