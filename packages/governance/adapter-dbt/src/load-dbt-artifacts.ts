import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { parseDocument } from 'yaml';

import type {
  DbtArtifactLoadResult,
  DbtAdapterDiagnostic,
  DbtManifest,
  DbtManifestLoadResult,
  DbtProjectConfig,
  DbtProjectConfigLoadResult,
  DbtProjectContext,
} from './contracts.js';
import {
  incompleteManifestFieldDiagnostic,
  invalidDbtProjectConfigDiagnostic,
  malformedDbtProjectYamlDiagnostic,
  malformedManifestJsonDiagnostic,
  missingArtifactFileDiagnostic,
  missingArtifactPathDiagnostic,
  unsupportedManifestShapeDiagnostic,
} from './diagnostics.js';

type ArtifactRecord = Record<string, unknown>;

export function loadDbtArtifacts(
  projectContext: DbtProjectContext,
): DbtArtifactLoadResult {
  const manifestResult = loadDbtManifest(
    projectContext.artifactPaths.manifestPath,
  );
  const projectConfigResult = loadDbtProjectConfig(
    projectContext.dbtProjectPath,
  );
  const diagnostics = [
    ...projectContext.diagnostics,
    ...manifestResult.diagnostics,
    ...projectConfigResult.diagnostics,
  ];

  if (!manifestResult.manifest || !projectConfigResult.projectConfig) {
    return {
      supported: false,
      diagnostics,
    };
  }

  return {
    supported: true,
    diagnostics,
    artifacts: {
      manifest: manifestResult.manifest,
      projectConfig: projectConfigResult.projectConfig,
    },
  };
}

export function loadDbtManifest(
  manifestPath: string | undefined,
): DbtManifestLoadResult {
  const diagnostics: DbtManifestLoadResult['diagnostics'] = [];

  if (!manifestPath) {
    diagnostics.push(
      missingArtifactPathDiagnostic('manifest.json', 'paths.manifestPath'),
    );
    return {
      supported: false,
      diagnostics,
    };
  }

  if (!isExistingFile(manifestPath)) {
    diagnostics.push(
      missingArtifactFileDiagnostic(
        'manifest.json',
        manifestPath,
        'paths.manifestPath',
      ),
    );
    return {
      supported: false,
      diagnostics,
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
  } catch {
    diagnostics.push(malformedManifestJsonDiagnostic(manifestPath));
    return {
      supported: false,
      diagnostics,
    };
  }

  diagnostics.push(...validateDbtManifest(parsed, manifestPath));

  if (diagnostics.length > 0) {
    return {
      supported: false,
      diagnostics,
    };
  }

  return {
    supported: true,
    diagnostics,
    manifest: parsed as DbtManifest,
  };
}

export function loadDbtProjectConfig(
  dbtProjectPath: string | undefined,
): DbtProjectConfigLoadResult {
  const diagnostics: DbtProjectConfigLoadResult['diagnostics'] = [];

  if (!dbtProjectPath) {
    diagnostics.push(
      missingArtifactPathDiagnostic('dbt_project.yml', 'paths.dbtProjectPath'),
    );
    return {
      supported: false,
      diagnostics,
    };
  }

  if (!isExistingFile(dbtProjectPath)) {
    diagnostics.push(
      missingArtifactFileDiagnostic(
        'dbt_project.yml',
        dbtProjectPath,
        'paths.dbtProjectPath',
      ),
    );
    return {
      supported: false,
      diagnostics,
    };
  }

  let parsed: unknown;

  try {
    const document = parseDocument(readFileSync(dbtProjectPath, 'utf8'), {
      merge: false,
      strict: true,
      uniqueKeys: false,
    });

    if (document.errors.length > 0) {
      throw new Error(document.errors[0]?.message ?? 'Invalid YAML.');
    }

    parsed = document.toJS();
  } catch {
    diagnostics.push(malformedDbtProjectYamlDiagnostic(dbtProjectPath));
    return {
      supported: false,
      diagnostics,
    };
  }

  const projectConfig = toDbtProjectConfig(parsed, dbtProjectPath, diagnostics);

  if (!projectConfig) {
    return {
      supported: false,
      diagnostics,
    };
  }

  return {
    supported: true,
    diagnostics,
    projectConfig,
  };
}

export function validateDbtManifest(
  manifest: unknown,
  manifestPath: string,
): DbtAdapterDiagnostic[] {
  const diagnostics: DbtAdapterDiagnostic[] = [];
  const record = asRecord(manifest);

  if (!record) {
    diagnostics.push(
      unsupportedManifestShapeDiagnostic(
        manifestPath,
        'dbt manifest must be a JSON object.',
      ),
    );
    return diagnostics;
  }

  const metadata = asRecord(record.metadata);
  if (!metadata) {
    diagnostics.push(
      incompleteManifestFieldDiagnostic(
        manifestPath,
        `${manifestPath}#/metadata`,
        'dbt manifest must define a metadata object.',
      ),
    );
  } else {
    const dbtSchemaVersion = metadata.dbt_schema_version;
    if (typeof dbtSchemaVersion !== 'string' || dbtSchemaVersion.length === 0) {
      diagnostics.push(
        incompleteManifestFieldDiagnostic(
          manifestPath,
          `${manifestPath}#/metadata/dbt_schema_version`,
          'dbt manifest metadata.dbt_schema_version is required.',
        ),
      );
    } else if (!isSupportedManifestSchemaVersion(dbtSchemaVersion)) {
      diagnostics.push(
        unsupportedManifestShapeDiagnostic(
          manifestPath,
          `dbt manifest schema version "${dbtSchemaVersion}" is not supported.`,
          `${manifestPath}#/metadata/dbt_schema_version`,
        ),
      );
    }

    const projectName = metadata.project_name;
    if (typeof projectName !== 'string' || projectName.trim().length === 0) {
      diagnostics.push(
        incompleteManifestFieldDiagnostic(
          manifestPath,
          `${manifestPath}#/metadata/project_name`,
          'dbt manifest metadata.project_name is required.',
        ),
      );
    }
  }

  if (!('nodes' in record)) {
    diagnostics.push(
      incompleteManifestFieldDiagnostic(
        manifestPath,
        `${manifestPath}#/nodes`,
        'dbt manifest nodes collection is required.',
      ),
    );
  } else if (!asRecord(record.nodes)) {
    diagnostics.push(
      unsupportedManifestShapeDiagnostic(
        manifestPath,
        'dbt manifest nodes collection must be an object.',
        `${manifestPath}#/nodes`,
      ),
    );
  }

  validateOptionalRecord(manifestPath, record.sources, 'sources', diagnostics);
  validateOptionalRecord(
    manifestPath,
    record.parent_map,
    'parent_map',
    diagnostics,
  );
  validateOptionalRecord(
    manifestPath,
    record.child_map,
    'child_map',
    diagnostics,
  );

  return diagnostics;
}

function toDbtProjectConfig(
  value: unknown,
  dbtProjectPath: string,
  diagnostics: DbtAdapterDiagnostic[],
): DbtProjectConfig | undefined {
  const record = asRecord(value);

  if (!record) {
    diagnostics.push(
      invalidDbtProjectConfigDiagnostic(
        dbtProjectPath,
        'dbt_project.yml must define a YAML object.',
      ),
    );
    return undefined;
  }

  const name = record.name;
  if (typeof name !== 'string' || name.trim().length === 0) {
    diagnostics.push(
      invalidDbtProjectConfigDiagnostic(
        dbtProjectPath,
        'dbt_project.yml must define a non-empty project name.',
        `${dbtProjectPath}#/name`,
      ),
    );
    return undefined;
  }

  const configVersion = readOptionalNumber(
    record['config-version'],
    'config-version',
    dbtProjectPath,
    diagnostics,
  );
  const modelPaths = readOptionalStringArray(
    record['model-paths'],
    'model-paths',
    dbtProjectPath,
    diagnostics,
  );
  const seedPaths = readOptionalStringArray(
    record['seed-paths'],
    'seed-paths',
    dbtProjectPath,
    diagnostics,
  );
  const snapshotPaths = readOptionalStringArray(
    record['snapshot-paths'],
    'snapshot-paths',
    dbtProjectPath,
    diagnostics,
  );
  const analysisPaths = readOptionalStringArray(
    record['analysis-paths'],
    'analysis-paths',
    dbtProjectPath,
    diagnostics,
  );
  const macroPaths = readOptionalStringArray(
    record['macro-paths'],
    'macro-paths',
    dbtProjectPath,
    diagnostics,
  );
  const testPaths = readOptionalStringArray(
    record['test-paths'],
    'test-paths',
    dbtProjectPath,
    diagnostics,
  );

  if (diagnostics.length > 0) {
    return undefined;
  }

  return {
    ...record,
    name,
    ...(record.version !== undefined
      ? { version: record.version as string | number }
      : {}),
    ...(typeof record.profile === 'string' ? { profile: record.profile } : {}),
    ...(configVersion !== undefined ? { configVersion } : {}),
    ...(modelPaths ? { modelPaths } : {}),
    ...(seedPaths ? { seedPaths } : {}),
    ...(snapshotPaths ? { snapshotPaths } : {}),
    ...(analysisPaths ? { analysisPaths } : {}),
    ...(macroPaths ? { macroPaths } : {}),
    ...(testPaths ? { testPaths } : {}),
  };
}

function validateOptionalRecord(
  manifestPath: string,
  value: unknown,
  field: string,
  diagnostics: DbtAdapterDiagnostic[],
): void {
  if (value === undefined) {
    return;
  }

  if (!asRecord(value)) {
    diagnostics.push(
      unsupportedManifestShapeDiagnostic(
        manifestPath,
        `dbt manifest ${field} collection must be an object when provided.`,
        `${manifestPath}#/${field}`,
      ),
    );
  }
}

function readOptionalNumber(
  value: unknown,
  field: string,
  dbtProjectPath: string,
  diagnostics: DbtAdapterDiagnostic[],
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    diagnostics.push(
      invalidDbtProjectConfigDiagnostic(
        dbtProjectPath,
        `dbt_project.yml field "${field}" must be a number when provided.`,
        `${dbtProjectPath}#/${field}`,
      ),
    );
    return undefined;
  }

  return value;
}

function readOptionalStringArray(
  value: unknown,
  field: string,
  dbtProjectPath: string,
  diagnostics: DbtAdapterDiagnostic[],
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || !value.every(isNonEmptyString)) {
    diagnostics.push(
      invalidDbtProjectConfigDiagnostic(
        dbtProjectPath,
        `dbt_project.yml field "${field}" must be an array of non-empty strings when provided.`,
        `${dbtProjectPath}#/${field}`,
      ),
    );
    return undefined;
  }

  return [...value];
}

function isSupportedManifestSchemaVersion(value: string): boolean {
  return /(?:^|\/)manifest\/v\d+\.json$/u.test(value);
}

function asRecord(value: unknown): ArtifactRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as ArtifactRecord)
    : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isExistingFile(filePath: string): boolean {
  return (
    path.isAbsolute(filePath) &&
    existsSync(filePath) &&
    statSync(filePath).isFile()
  );
}
