import type {
  DbtAdapterDiagnostic,
  DbtAdapterInputField,
} from './contracts.js';

const DIAGNOSTIC_SOURCE = 'governance.dbt_adapter';

interface DbtDiagnosticOptions {
  code: string;
  message: string;
  inputField?: DbtAdapterInputField;
  path?: string;
  dbtUniqueId?: string;
  details?: Record<string, unknown>;
  severity?: DbtAdapterDiagnostic['severity'];
  kind?: DbtAdapterDiagnostic['kind'];
  category?: DbtAdapterDiagnostic['category'];
  recommendation?: string;
}

function createDiagnostic({
  code,
  message,
  inputField,
  path,
  dbtUniqueId,
  details,
  severity,
  kind,
  category,
  recommendation,
}: DbtDiagnosticOptions): DbtAdapterDiagnostic {
  return {
    code,
    message,
    severity: severity ?? 'error',
    kind: kind ?? 'error',
    category: category ?? 'configuration',
    source: DIAGNOSTIC_SOURCE,
    ...(inputField ? { inputField } : {}),
    ...(path ? { path } : {}),
    ...(dbtUniqueId ? { dbtUniqueId } : {}),
    ...(recommendation ? { recommendation } : {}),
    ...(details ? { details } : {}),
  };
}

export function missingProjectDirectoryDiagnostic(
  projectDir?: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.missing_project_directory',
    message:
      'Adapter input must provide an existing dbt project directory or an explicit dbt_project.yml path.',
    inputField: 'paths.projectDir',
    ...(projectDir ? { path: projectDir } : {}),
    recommendation:
      'Provide a valid projectDir input or an explicit dbtProjectPath that points to dbt_project.yml.',
  });
}

export function missingDbtProjectPathDiagnostic(
  projectDir: string,
  inputField: DbtAdapterInputField,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.missing_dbt_project_file',
    message: `No dbt_project.yml file was found for project directory "${projectDir}".`,
    inputField,
    path: projectDir,
    recommendation:
      'Ensure the directory contains dbt_project.yml or pass an explicit dbtProjectPath.',
  });
}

export function invalidDbtProjectPathDiagnostic(
  dbtProjectPath: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.invalid_dbt_project_path',
    message: `Explicit dbt project path "${dbtProjectPath}" must point to a file named "dbt_project.yml".`,
    inputField: 'paths.dbtProjectPath',
    path: dbtProjectPath,
    recommendation:
      'Pass the absolute or relative path to a file named dbt_project.yml.',
  });
}

export function inconsistentProjectInputsDiagnostic(
  projectDir: string,
  dbtProjectPath: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.inconsistent_project_inputs',
    message:
      'Provided projectDir and dbtProjectPath do not resolve to the same dbt project directory.',
    inputField: 'paths.dbtProjectPath',
    path: dbtProjectPath,
    details: {
      projectDir,
      dbtProjectPath,
    },
    recommendation:
      'Align projectDir and dbtProjectPath so they refer to the same dbt project.',
  });
}

export function missingArtifactPathDiagnostic(
  artifactName: string,
  inputField: DbtAdapterInputField,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.missing_artifact_path',
    message: `Adapter input did not provide a path for required artifact "${artifactName}".`,
    inputField,
    recommendation: `Provide an explicit path for ${artifactName}.`,
  });
}

export function missingArtifactFileDiagnostic(
  artifactName: string,
  filePath: string,
  inputField: DbtAdapterInputField,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.missing_artifact_file',
    message: `Required artifact "${artifactName}" was not found at "${filePath}".`,
    inputField,
    path: filePath,
    recommendation: `Ensure ${artifactName} exists at the provided path before invoking the adapter.`,
  });
}

export function malformedManifestJsonDiagnostic(
  manifestPath: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.malformed_manifest_json',
    message: `Failed to parse manifest JSON file "${manifestPath}".`,
    inputField: 'paths.manifestPath',
    path: manifestPath,
    recommendation:
      'Regenerate manifest.json or provide a valid JSON manifest artifact.',
  });
}

export function malformedDbtProjectYamlDiagnostic(
  dbtProjectPath: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.malformed_dbt_project_yaml',
    message: `Failed to parse dbt project YAML file "${dbtProjectPath}".`,
    inputField: 'paths.dbtProjectPath',
    path: dbtProjectPath,
    recommendation:
      'Fix the YAML syntax in dbt_project.yml or provide a valid project configuration file.',
  });
}

export function unsupportedManifestShapeDiagnostic(
  manifestPath: string,
  message: string,
  pathLabel?: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.unsupported_manifest_shape',
    message,
    inputField: 'paths.manifestPath',
    path: pathLabel ?? manifestPath,
    details: {
      manifestPath,
    },
    recommendation:
      'Provide a dbt manifest artifact with the minimum supported object structure.',
  });
}

export function incompleteManifestFieldDiagnostic(
  manifestPath: string,
  fieldPath: string,
  message: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.incomplete_manifest_field',
    message,
    inputField: 'paths.manifestPath',
    path: fieldPath,
    details: {
      manifestPath,
      fieldPath,
    },
    recommendation:
      'Regenerate the manifest so required fields are present and populated.',
  });
}

export function invalidDbtProjectConfigDiagnostic(
  dbtProjectPath: string,
  message: string,
  pathLabel?: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.invalid_dbt_project_config',
    message,
    inputField: 'paths.dbtProjectPath',
    path: pathLabel ?? dbtProjectPath,
    details: {
      dbtProjectPath,
    },
    recommendation:
      'Fix the dbt project configuration so required fields have the expected types.',
  });
}

export function skippedDbtResourceTypeDiagnostic(
  resourceType: string,
  uniqueId?: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.skipped_resource_type',
    message: `Skipped unsupported dbt resource type "${resourceType}".`,
    severity: 'warning',
    kind: 'warning',
    category: 'adapter',
    dbtUniqueId: uniqueId,
    details: {
      ...(uniqueId ? { uniqueId } : {}),
      resourceType,
    },
    recommendation:
      'Add adapter support for this resource type if downstream governance needs it.',
  });
}

export function unsupportedDbtResourceShapeDiagnostic(
  resourceType: string,
  message: string,
  uniqueId?: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.unsupported_resource_shape',
    message,
    severity: 'warning',
    kind: 'warning',
    category: 'adapter',
    dbtUniqueId: uniqueId,
    details: {
      ...(uniqueId ? { uniqueId } : {}),
      resourceType,
    },
    recommendation:
      'Ensure the manifest resource entry is an object with the expected dbt fields.',
  });
}

export function missingDbtResourceIdentityDiagnostic(
  resourceType: string,
  field: string,
  uniqueId?: string,
  path?: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.missing_resource_identity',
    message: `dbt resource type "${resourceType}" is missing required identity field "${field}".`,
    severity: 'warning',
    kind: 'warning',
    category: 'adapter',
    dbtUniqueId: uniqueId,
    path,
    details: {
      ...(uniqueId ? { uniqueId } : {}),
      resourceType,
      field,
    },
    recommendation:
      'Regenerate the manifest or fix the underlying dbt resource so identity fields are present.',
  });
}

export function incompleteDbtMetadataDiagnostic(
  uniqueId: string,
  missingFields: string[],
  path?: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.incomplete_metadata',
    message:
      'Normalized dbt resource is missing optional metadata that downstream extensions may use for dbt-aware analysis.',
    severity: 'info',
    kind: 'observation',
    category: 'adapter',
    dbtUniqueId: uniqueId,
    path,
    details: {
      uniqueId,
      missingFields,
    },
    recommendation:
      'Provide manifest artifacts with richer dbt metadata if downstream extensions need these facts.',
  });
}

export function partialDbtNormalizationDiagnostic({
  normalizedCount,
  skippedCount,
  invalidCount,
}: {
  normalizedCount: number;
  skippedCount: number;
  invalidCount: number;
}): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.partial_normalization',
    message:
      'dbt manifest normalization completed with skipped or invalid resources.',
    severity: 'warning',
    kind: 'warning',
    category: 'adapter',
    details: {
      normalizedCount,
      skippedCount,
      invalidCount,
    },
    recommendation:
      'Review skipped or invalid resource diagnostics to understand incomplete adapter coverage.',
  });
}

export function unresolvedDbtDependencyTargetDiagnostic(
  sourceUniqueId: string,
  targetUniqueId: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.unresolved_dependency_target',
    message: `dbt dependency target "${targetUniqueId}" could not be resolved from manifest artifacts.`,
    severity: 'warning',
    kind: 'warning',
    category: 'adapter',
    dbtUniqueId: sourceUniqueId,
    details: {
      sourceUniqueId,
      targetUniqueId,
    },
    recommendation:
      'Ensure the manifest includes the referenced upstream resource or use matching artifact versions.',
  });
}

export function dependencyTargetNotNormalizedDiagnostic(
  sourceUniqueId: string,
  targetUniqueId: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.dependency_target_not_normalized',
    message: `dbt dependency target "${targetUniqueId}" was present in manifest artifacts but was not normalized as a governance node.`,
    severity: 'warning',
    kind: 'warning',
    category: 'adapter',
    dbtUniqueId: sourceUniqueId,
    details: {
      sourceUniqueId,
      targetUniqueId,
    },
    recommendation:
      'Review the target resource diagnostics to determine why the dependency target could not be normalized.',
  });
}

export function unsupportedDbtDependencyShapeDiagnostic(
  sourceUniqueId: string,
  field: string,
): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.unsupported_dependency_shape',
    message: `dbt dependency metadata for "${sourceUniqueId}" has unsupported shape at "${field}".`,
    severity: 'warning',
    kind: 'warning',
    category: 'adapter',
    dbtUniqueId: sourceUniqueId,
    details: {
      sourceUniqueId,
      field,
    },
    recommendation:
      'Provide manifest dependency metadata with depends_on.nodes as an array of dbt unique IDs.',
  });
}

export function partialDbtDependencyMappingDiagnostic({
  mappedCount,
  unresolvedCount,
  notNormalizedCount,
  unsupportedCount,
}: {
  mappedCount: number;
  unresolvedCount: number;
  notNormalizedCount: number;
  unsupportedCount: number;
}): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.partial_dependency_mapping',
    message:
      'dbt dependency mapping completed with unresolved or unsupported dependency metadata.',
    severity: 'warning',
    kind: 'warning',
    category: 'adapter',
    details: {
      mappedCount,
      unresolvedCount,
      notNormalizedCount,
      unsupportedCount,
    },
    recommendation:
      'Review dependency diagnostics to understand which manifest edges could not be mapped.',
  });
}
