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
  details?: Record<string, unknown>;
}

function createDiagnostic({
  code,
  message,
  inputField,
  path,
  details,
}: DbtDiagnosticOptions): DbtAdapterDiagnostic {
  return {
    code,
    message,
    severity: 'error',
    kind: 'error',
    category: 'configuration',
    source: DIAGNOSTIC_SOURCE,
    ...(inputField ? { inputField } : {}),
    ...(path ? { path } : {}),
    ...(details ? { details } : {}),
  };
}

export function missingProjectDirectoryDiagnostic(): DbtAdapterDiagnostic {
  return createDiagnostic({
    code: 'governance.dbt_adapter.missing_project_directory',
    message:
      'Adapter input must provide an existing dbt project directory or an explicit dbt_project.yml path.',
    inputField: 'paths.projectDir',
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
    },
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
  });
}
